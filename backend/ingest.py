import os
from dotenv import load_dotenv
from supabase.client import Client, create_client
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_text_splitters import CharacterTextSplitter

load_dotenv()

# 1. Setup Supabase
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# 2. Setup FREE Hugging Face Embeddings
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# 3. The text we want the AI to learn
text_data = "The capital of France is Paris. It is known for the Eiffel Tower. Aspirin is used to treat pain and fever."

# 4. Split the text into manageable chunks
text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
docs = text_splitter.create_documents([text_data])

# 5. Push the vectors into your Supabase library
vector_store = SupabaseVectorStore.from_documents(
    docs,
    embeddings,
    client=supabase,
    table_name="documents",
    query_name="match_documents",
)

print("✅ Data successfully saved to Supabase!")