# Study Buddy AI — RAG-Based College Notes Assistant

Study Buddy AI is a full-stack Retrieval-Augmented Generation (RAG) web application built for college students. Upload lecture slides, textbook chapters, and course PDFs, then ask questions and receive grounded, citation-backed explanations powered by **PyMuPDF**, **Sentence Transformers (`all-MiniLM-L6-v2`)**, **ChromaDB**, and **Google Gemini API**.

---

## Features

- **JWT Authentication & Per-User Isolation**: Register, log in, reset passwords, update profile & theme, and delete accounts. Each user's uploaded PDFs, ChromaDB embeddings, and chat history are strictly isolated.
- **PDF Ingestion & Vector Indexing**: Drag-and-drop PDF upload with file type/size validation, progress tracking, PyMuPDF page-by-page text extraction, overlapping chunking, `all-MiniLM-L6-v2` embeddings, and persistent ChromaDB storage.
- **Grounded RAG Question Answering**: Retrieves the most relevant chunks from one, multiple, or all selected PDFs, enforces a relevance threshold, cites source document names and page numbers, and refuses to fabricate answers when notes lack sufficient information.
- **Modern SaaS Workspace**: Dark Navy & White theme (with Crisp Light mode toggle), Dashboard analytics, My Documents grid/list view, AI Chat with Markdown rendering and source inspection, and searchable Chat History.

---

## Project Structure

```text
study-buddy-ai/
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   └── services/
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── database/
│   │   ├── models/
│   │   ├── rag/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   ├── .env.example
│   ├── main.py
│   └── requirements.txt
└── README.md
```

---

## Prerequisites

- **Python** 3.11+ (tested on 3.12)
- **Node.js** 18+ and **npm**
- A **Google Gemini API key** from [Google AI Studio](https://aistudio.google.com/)

---

## Local Setup & Running

### 1. Backend Setup (FastAPI + ChromaDB + Gemini)

```bash
cd study-buddy-ai/backend

# Create and activate a virtual environment
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Open `study-buddy-ai/backend/.env` and set your private configuration:

```env
GEMINI_API_KEY=your_actual_gemini_api_key
JWT_SECRET_KEY=replace-with-a-strong-random-secret
```

Start the FastAPI server:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

> **Note on first run:** `sentence-transformers` downloads `all-MiniLM-L6-v2` (~90 MB) from Hugging Face on the first PDF upload or query and caches it locally.

---

### 2. Frontend Setup (React + Vite + Tailwind CSS)

Open a second terminal:

```bash
cd study-buddy-ai/frontend

# Install Node dependencies
npm install

# Configure frontend environment (optional if using default http://127.0.0.1:8000)
cp .env.example .env

# Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key (never exposed to frontend) | Required for AI answers |
| `GEMINI_MODEL` | Gemini model ID | `gemini-3.5-flash` |
| `JWT_SECRET_KEY` | Secret used to sign JWT tokens | Dev default (change in prod) |
| `DATABASE_URL` | SQLite or PostgreSQL SQLAlchemy URI | `sqlite:///./data/study_buddy.db` |
| `CHROMA_PERSIST_DIR` | Persistent ChromaDB directory | `./data/chroma_db` |
| `UPLOAD_DIR` | Directory for uploaded user PDFs | `./uploads` |
| `EMBEDDING_MODEL` | Sentence Transformers model | `all-MiniLM-L6-v2` |
| `MAX_FILE_SIZE_MB` | Maximum allowed PDF upload size | `25` |
| `REDIS_URL` | Optional Redis URL for caching | Empty (in-memory fallback) |
| `SMTP_HOST` / `SMTP_*` | Optional SMTP settings for reset emails | Empty (logs token to console) |

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | FastAPI backend base URL | `http://127.0.0.1:8000` |

---

## Running Backend Tests

```bash
cd study-buddy-ai/backend
pytest -v
```

---

## Deploying to Netlify (Frontend) + Render / Railway (Backend)

Netlify hosts the React + Vite frontend (`netlify.toml` at the repository root configures the build and SPA redirects). Because the FastAPI backend uses PyMuPDF, Sentence Transformers (`all-MiniLM-L6-v2`), PyTorch, and persistent ChromaDB storage, deploy the backend as a Python/Docker service (Render or Railway):

1. **Deploy the Backend** (`backend/Dockerfile` or `render.yaml`):
   - Set `GEMINI_API_KEY`, `JWT_SECRET_KEY`, and `CORS_ORIGIN_REGEX=https://.*\.netlify\.app` (or set `CORS_ORIGINS` to your exact Netlify site URL).
   - Mount persistent storage if using SQLite/ChromaDB locally (configured automatically in `render.yaml`).
2. **Deploy the Frontend on Netlify**:
   - Connect your GitHub repository in Netlify (`netlify.toml` auto-detects `base = "frontend"`, `command = "npm run build"`, `publish = "dist"`, and SPA `/* -> /index.html` redirects).
   - Add environment variable `VITE_API_URL` in Netlify pointing to your deployed backend URL (e.g., `https://your-backend.onrender.com`).
   - Trigger a deploy.


