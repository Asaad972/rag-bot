# Rag-Bot

A full-stack RAG application with Admin PDF upload and User Chat.

## Setup

### Prerequisites
- Node.js & npm
- Python 3.10+
- Supabase Project
- HuggingFace API Token

### 1. Backend Setup (`/backend`)

1. Navigate to backend: `cd backend`
2. Create virtual env: `python -m venv venv`
3. Activate:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Install: `pip install -r requirements.txt`
5. Configure `.env`: Copy `env.example` to `.env` and fill in keys.
6. Run: `python -m uvicorn main:app --reload --port 8000`

### 2. Frontend Setup (Root)

1. Updates dependencies: `npm install`
2. Configure `.env.local`: Copy `env.example` to `.env.local` and fill in keys.
3. Run: `npm run dev`

### 3. Usage

1. **Admin**:
   - Go to `http://localhost:3000/auth` and Log in.
   - Note: Email must match `NEXT_PUBLIC_ADMIN_EMAIL`.
   - Go to `http://localhost:3000/admin`.
   - Upload PDFs.
2. **User**:
   - Register/Login at `/auth`.
   - Go to `/chat`.
   - Ask questions.

## Architecture
- **Frontend**: Next.js 14, Tailwind, Supabase Auth.
- **Backend**: FastAPI, LangChain, FAISS.
- **Storage**: Local `backend/data` (extensible to Supabase Storage).
