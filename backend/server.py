from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
import PyPDF2
from docx import Document
import io
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Load Sentence-BERT model for semantic search
model = SentenceTransformer('all-MiniLM-L6-v2')

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'nemsu-dmrs-secret-key-2025')
JWT_ALGORITHM = 'HS256'

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: str  # 'Faculty' or 'Administrative'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    role: str

class UserLogin(BaseModel):
    email: str
    password: str

class DocumentUpload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    document_type: str
    access_level: str  # 'Public' or 'Restricted'
    content: str
    file_name: str
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Optional[dict] = None

class SearchQuery(BaseModel):
    query: str
    search_mode: str  # 'bm25', 'semantic', 'hybrid'
    access_level: Optional[str] = None

class SearchResult(BaseModel):
    id: str
    title: str
    document_type: str
    access_level: str
    file_name: str
    snippet: str
    score: float
    uploaded_at: datetime

class ChatMessage(BaseModel):
    message: str
    access_level: Optional[str] = None

# Helper functions
def extract_text_from_pdf(file_content: bytes) -> str:
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        logging.error(f"Error extracting PDF text: {e}")
        return ""

def extract_text_from_docx(file_content: bytes) -> str:
    try:
        doc = Document(io.BytesIO(file_content))
        text = "\n".join([para.text for para in doc.paragraphs])
        return text.strip()
    except Exception as e:
        logging.error(f"Error extracting DOCX text: {e}")
        return ""

def extract_text_from_txt(file_content: bytes) -> str:
    try:
        return file_content.decode('utf-8').strip()
    except Exception as e:
        logging.error(f"Error extracting TXT text: {e}")
        return ""

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def perform_bm25_search(query: str, documents: list) -> list:
    if not documents:
        return []
    
    # Tokenize documents
    tokenized_docs = [doc['content'].lower().split() for doc in documents]
    bm25 = BM25Okapi(tokenized_docs)
    
    # Tokenize query
    tokenized_query = query.lower().split()
    scores = bm25.get_scores(tokenized_query)
    
    # Add scores to documents
    for i, doc in enumerate(documents):
        doc['score'] = float(scores[i])
    
    return sorted(documents, key=lambda x: x['score'], reverse=True)

def perform_semantic_search(query: str, documents: list) -> list:
    if not documents:
        return []
    
    # Generate query embedding
    query_embedding = model.encode([query])
    
    # Generate document embeddings
    doc_contents = [doc['content'] for doc in documents]
    doc_embeddings = model.encode(doc_contents)
    
    # Calculate cosine similarity
    similarities = cosine_similarity(query_embedding, doc_embeddings)[0]
    
    # Add scores to documents
    for i, doc in enumerate(documents):
        doc['score'] = float(similarities[i])
    
    return sorted(documents, key=lambda x: x['score'], reverse=True)

def perform_hybrid_search(query: str, documents: list) -> list:
    if not documents:
        return []
    
    # Get BM25 scores
    bm25_results = perform_bm25_search(query, [doc.copy() for doc in documents])
    bm25_scores = {doc['id']: doc['score'] for doc in bm25_results}
    
    # Get semantic scores
    semantic_results = perform_semantic_search(query, [doc.copy() for doc in documents])
    semantic_scores = {doc['id']: doc['score'] for doc in semantic_results}
    
    # Normalize and combine scores (weighted average: 40% BM25, 60% semantic)
    max_bm25 = max(bm25_scores.values()) if bm25_scores else 1
    max_semantic = max(semantic_scores.values()) if semantic_scores else 1
    
    for doc in documents:
        bm25_norm = bm25_scores.get(doc['id'], 0) / max_bm25 if max_bm25 > 0 else 0
        semantic_norm = semantic_scores.get(doc['id'], 0) / max_semantic if max_semantic > 0 else 0
        doc['score'] = 0.4 * bm25_norm + 0.6 * semantic_norm
    
    return sorted(documents, key=lambda x: x['score'], reverse=True)

# Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role
    )
    
    user_doc = user.model_dump()
    user_doc['password'] = hashed_password.decode('utf-8')
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user.id, user.email, user.role)
    
    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    # Find user
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'], user['email'], user['role'])
    
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "email": user['email'],
            "name": user['name'],
            "role": user['role']
        }
    }

@api_router.post("/documents/upload")
async def upload_document(
    title: str = Form(...),
    document_type: str = Form(...),
    access_level: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(verify_token)
):
    # Read file content
    file_content = await file.read()
    
    # Extract text based on file type
    if file.filename.endswith('.pdf'):
        content = extract_text_from_pdf(file_content)
    elif file.filename.endswith('.docx'):
        content = extract_text_from_docx(file_content)
    elif file.filename.endswith('.txt'):
        content = extract_text_from_txt(file_content)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use PDF, DOCX, or TXT.")
    
    if not content:
        raise HTTPException(status_code=400, detail="Could not extract text from document")
    
    # Create document record
    document = DocumentUpload(
        title=title,
        document_type=document_type,
        access_level=access_level,
        content=content,
        file_name=file.filename,
        uploaded_by=current_user['user_id']
    )
    
    doc_dict = document.model_dump()
    doc_dict['uploaded_at'] = doc_dict['uploaded_at'].isoformat()
    
    await db.documents.insert_one(doc_dict)
    
    return {
        "message": "Document uploaded successfully",
        "document_id": document.id,
        "title": document.title
    }

@api_router.get("/documents")
async def get_documents(current_user: dict = Depends(verify_token)):
    documents = await db.documents.find({}, {"_id": 0, "content": 0}).to_list(1000)
    
    # Filter based on access level
    filtered_docs = []
    for doc in documents:
        if doc['access_level'] == 'Public' or doc['uploaded_by'] == current_user['user_id']:
            if isinstance(doc['uploaded_at'], str):
                doc['uploaded_at'] = datetime.fromisoformat(doc['uploaded_at'])
            filtered_docs.append(doc)
    
    return filtered_docs

@api_router.post("/search")
async def search_documents(
    query: SearchQuery,
    current_user: dict = Depends(verify_token)
):
    # Get all documents
    documents = await db.documents.find({}, {"_id": 0}).to_list(1000)
    
    # Filter based on access level
    filtered_docs = []
    for doc in documents:
        if doc['access_level'] == 'Public' or doc['uploaded_by'] == current_user['user_id']:
            filtered_docs.append(doc)
    
    if not filtered_docs:
        return []
    
    # Perform search based on mode
    if query.search_mode == 'bm25':
        results = perform_bm25_search(query.query, filtered_docs)
    elif query.search_mode == 'semantic':
        results = perform_semantic_search(query.query, filtered_docs)
    elif query.search_mode == 'hybrid':
        results = perform_hybrid_search(query.query, filtered_docs)
    else:
        raise HTTPException(status_code=400, detail="Invalid search mode")
    
    # Format results
    search_results = []
    for doc in results[:20]:  # Top 20 results
        if doc['score'] > 0.1:  # Threshold for relevance
            # Create snippet
            content = doc['content']
            query_terms = query.query.lower().split()
            content_lower = content.lower()
            
            # Find first occurrence of any query term
            snippet_start = 0
            for term in query_terms:
                idx = content_lower.find(term)
                if idx != -1:
                    snippet_start = max(0, idx - 50)
                    break
            
            snippet = content[snippet_start:snippet_start + 200] + "..."
            
            search_results.append(SearchResult(
                id=doc['id'],
                title=doc['title'],
                document_type=doc['document_type'],
                access_level=doc['access_level'],
                file_name=doc['file_name'],
                snippet=snippet,
                score=doc['score'],
                uploaded_at=datetime.fromisoformat(doc['uploaded_at']) if isinstance(doc['uploaded_at'], str) else doc['uploaded_at']
            ))
    
    return search_results

@api_router.post("/chat")
async def chat_search(
    message: ChatMessage,
    current_user: dict = Depends(verify_token)
):
    # Use hybrid search for chat interface
    query = SearchQuery(
        query=message.message,
        search_mode='hybrid',
        access_level=message.access_level
    )
    
    results = await search_documents(query, current_user)
    
    # Format response as conversational
    if not results:
        return {
            "response": "I couldn't find any documents matching your query. Try using different keywords or phrases.",
            "documents": []
        }
    
    response = f"I found {len(results)} relevant document(s) for your query. Here are the top results:"
    
    return {
        "response": response,
        "documents": results[:5]  # Top 5 for chat
    }

@api_router.get("/documents/{document_id}")
async def get_document(
    document_id: str,
    current_user: dict = Depends(verify_token)
):
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check access
    if document['access_level'] == 'Restricted' and document['uploaded_by'] != current_user['user_id']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if isinstance(document['uploaded_at'], str):
        document['uploaded_at'] = datetime.fromisoformat(document['uploaded_at'])
    
    return document

@api_router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(verify_token)
):
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Only uploader can delete
    if document['uploaded_by'] != current_user['user_id']:
        raise HTTPException(status_code=403, detail="Only the uploader can delete this document")
    
    await db.documents.delete_one({"id": document_id})
    
    return {"message": "Document deleted successfully"}

@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(verify_token)):
    total_docs = await db.documents.count_documents({})
    user_docs = await db.documents.count_documents({"uploaded_by": current_user['user_id']})
    public_docs = await db.documents.count_documents({"access_level": "Public"})
    
    return {
        "total_documents": total_docs,
        "your_documents": user_docs,
        "public_documents": public_docs
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
