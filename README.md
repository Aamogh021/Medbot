# MedBot AI – Medical Chatbot

AI-powered medical assistant using Supabase (vector store), Groq (LLM), and a vanilla JS frontend served by FastAPI.

---

## 📁 Project Structure

```
Medical/
├── frontend/          # HTML, CSS, JS (served as static files)
│   ├── index.html
│   ├── style.css
│   └── script.js
└── backend/
    ├── main.py          # FastAPI server (serves frontend + /chat API)
    ├── ingest.py        # One-time script to push data into Supabase
    ├── .env             # API keys (Supabase, Groq)
    └── requirements.txt
```

---

## 🚀 How to Run

### 1. Install dependencies (first time only)

```bash
cd backend
pip install -r requirements.txt
```

### 2. Make sure your `.env` file has valid keys

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_key
GROQ_API_KEY=gsk_your_groq_key
```

> ⚠️ No spaces after `=` in the `.env` file!

### 3. Ingest data into Supabase (first time only)

```bash
cd backend
python ingest.py
```

You should see: `✅ Data successfully saved to Supabase!`

### 4. Start the server

```bash
cd backend
python main.py
```

You should see: `🤖 Medical Chatbot server starting on http://localhost:8000`

### 5. Open in browser

Go to **http://localhost:8000** — that's it!

---

## 🛑 To Stop the Server

Press `Ctrl + C` in the terminal.

---

## 🔑 API Key Notes

- **Groq API Key**: Get from [console.groq.com](https://console.groq.com) → API Keys
- **Supabase Keys**: Get from your Supabase project → Settings → API
- If you get `Invalid API Key` errors, regenerate the key and update `.env`
