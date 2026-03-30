import os
from dotenv import load_dotenv
from supabase.client import Client, create_client
from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# 1. Connect to Supabase
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# 2. Setup the exact same Embeddings used in ingest.py
embeddings = HuggingFaceInferenceAPIEmbeddings(
    api_key=os.environ.get("HF_API_KEY"),
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# 3. Connect to our Vector Store and set it up to search
vector_store = SupabaseVectorStore(
    client=supabase,
    embedding=embeddings,
    table_name="documents",
    query_name="match_documents",
)

# Patch match_args so that the RPC call includes the params the SQL function expects:
#   match_documents(query_embedding, match_count, match_threshold)
_original_match_args = vector_store.match_args

def _patched_match_args(query, filter=None):
    ret = _original_match_args(query, filter)
    ret.setdefault("match_count", 10)
    ret.setdefault("match_threshold", 0.0)
    return ret

vector_store.match_args = _patched_match_args

# 'k': 3 means we want it to fetch the 3 most relevant chunks of text
retriever = vector_store.as_retriever(search_kwargs={"k": 3})

# 4. Setup Groq (The Brain)
llm = ChatGroq(
    temperature=0,  # 0 means it will be factual and not "creative"
    model_name="llama-3.3-70b-versatile",
    groq_api_key=os.environ.get("GROQ_API_KEY")
)

# 5. Create the Prompt Template
template = """
You are a helpful and knowledgeable medical assistant. Use the following pieces of retrieved context to answer the question.
If you don't know the answer, just say that you don't know.

IMPORTANT – you MUST format your answer like this:
- Start with a short introductory paragraph.
- Put each bullet point or numbered item on its OWN line, starting with "- " or "1. ".
- Separate sections with a blank line.
- Use **bold** for key medical terms.
- Never write everything in one long paragraph.

Context: {context}

Question: {question}

Answer:
"""
prompt = PromptTemplate(
    input_variables=["context", "question"],
    template=template,
)

# 6. Build the Chain (Bridge between Supabase and Groq)
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

qa_chain = (
    RunnableParallel(context=retriever | format_docs, question=RunnablePassthrough())
    | prompt
    | llm
    | StrOutputParser()
)

# 7. FastAPI Server
app = FastAPI()

# CORS – allow the frontend to call the API even during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve path to the sibling 'frontend' folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))          # .../backend
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")  # .../frontend

# Serve static files (CSS, JS) from the frontend folder
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


class ChatRequest(BaseModel):
    message: str


@app.get("/")
async def serve_frontend():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        response = qa_chain.invoke(request.message)
        return {"response": response}
    except Exception as e:
        return {"response": f"Sorry, an error occurred: {str(e)}"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🤖 Medical Chatbot server starting on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)