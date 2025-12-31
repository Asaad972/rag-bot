import os
import shutil
from typing import List, Optional
import requests
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import PyPDF2
from langchain_community.vectorstores import FAISS
from sentence_transformers import SentenceTransformer

# Load environment variables
load_dotenv()

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Embedding Wrapper to avoid LangChain Pydantic issues
class CustomHuggingFaceEmbeddings:
    def __init__(self, model_name="hkunlp/instructor-base"):
        self.model = SentenceTransformer(model_name)
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        # Instruct models need instruction, but for simplicity we just encode
        embeddings = self.model.encode(texts)
        return embeddings.tolist()
        
    def embed_query(self, text: str) -> List[float]:
        embedding = self.model.encode(text)
        return embedding.tolist()
        
    def __call__(self, input):
        return self.embed_query(input)

# Global State
vectorstore = None
DB_FAISS_PATH = "data/faiss_index"

# Ensure data directory exists
os.makedirs("data/pdfs", exist_ok=True)
os.makedirs("data/faiss_index", exist_ok=True)

def get_pdf_text(pdf_path: str) -> str:
    text = ""
    try:
        with open(pdf_path, 'rb') as f:
            pdf_reader = PyPDF2.PdfReader(f)
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
    return text

def get_text_chunks(text: str):
    # Simple chunking to avoid another dependency import failure
    chunk_size = 1000
    chunk_overlap = 200
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += chunk_size - chunk_overlap
    return chunks

def get_vectorstore():
    global vectorstore
    if vectorstore is not None:
        return vectorstore
    
    if os.path.exists(os.path.join(DB_FAISS_PATH, "index.faiss")):
        print("Loading FAISS index from disk...")
        try:
            embeddings = CustomHuggingFaceEmbeddings(model_name="hkunlp/instructor-base")
            vectorstore = FAISS.load_local(DB_FAISS_PATH, embeddings, allow_dangerous_deserialization=True)
        except Exception as e:
            print(f"Failed to load index: {e}")
            vectorstore = None
    else:
        print("No FAISS index found.")
    return vectorstore

def query_huggingface(prompt: str):
    api_token = os.getenv("HUGGINGFACEHUB_API_TOKEN")
    if not api_token:
        print("Warning: HUGGINGFACEHUB_API_TOKEN missing")
        return "Error: API Token missing in backend"
    
    # Using flan-t5-large via direct API
    api_url = "https://api-inference.huggingface.co/models/google/flan-t5-large"
    headers = {"Authorization": f"Bearer {api_token}"}
    
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_length": 512,
            "temperature": 0.5
        }
    }
    
    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=30)
        if response.status_code != 200:
            return f"HF API Error ({response.status_code}): {response.text}"
            
        result = response.json()
        if isinstance(result, list) and len(result) > 0:
            return result[0].get("generated_text", "")
        if isinstance(result, dict) and 'error' in result:
             return f"HF API Error: {result['error']}"
        return str(result)
    except Exception as e:
        return f"Request Failed: {str(e)}"

@app.on_event("startup")
async def startup_event():
    global vectorstore
    # Initialize normally
    # get_vectorstore() # Lazy load to prevent startup timeout

class ChatRequest(BaseModel):
    question: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    global vectorstore
    
    if not vectorstore:
        vectorstore = get_vectorstore()
    
    if not vectorstore:
         return {"answer": "The knowledge base is empty. Ask the admin to upload PDFs."}

    try:
        # 1. Retrieve
        docs = vectorstore.similarity_search(request.question, k=3)
        context = "\n".join([doc.page_content for doc in docs])
        
        # 2. Generate
        prompt = f"Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.\n\n{context}\n\nQuestion: {request.question}\nHelpful Answer:"
        
        answer = query_huggingface(prompt)
        return {"answer": answer}
        
    except Exception as e:
        print(f"RAG Error: {e}")
        return {"answer": f"Error processing request: {str(e)}"}

@app.post("/api/admin-process-uploads")
async def process_uploads(files: List[UploadFile] = File(...)):
    global vectorstore
    
    saved_files = []
    
    for file in files:
        file_path = f"data/pdfs/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        saved_files.append(file_path)

    all_chunks = []
    for pdf_path in saved_files:
        raw_text = get_pdf_text(pdf_path)
        chunks = get_text_chunks(raw_text)
        all_chunks.extend(chunks)
        
    if not all_chunks:
        return {"status": "error", "message": "No text extracted from PDFs."}
        
    embeddings = CustomHuggingFaceEmbeddings(model_name="hkunlp/instructor-base")
    
    # Critical: FAISS needs a 'embed_documents' styled object.
    if vectorstore is None:
        vectorstore = FAISS.from_texts(texts=all_chunks, embedding=embeddings)
    else:
        vectorstore.add_texts(texts=all_chunks)
        
    # Serialize
    vectorstore.save_local(DB_FAISS_PATH)
    
    return {
        "status": "ok", 
        "added_chunks": len(all_chunks), 
        "total_docs": len(saved_files)
    }

@app.get("/api/info")
async def get_info():
    global vectorstore
    status = "Empty"
    if vectorstore:
        status = "Loaded"
    return {"status": status}
