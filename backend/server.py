from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Depends, Form, Response, Request, Header
from fastapi.responses import StreamingResponse
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
import bcrypt
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
import PyPDF2
from docx import Document
import io
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Load Sentence-BERT model
model = SentenceTransformer('all-MiniLM-L6-v2')

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'nemsu-dmrs-secret-key-2025')
JWT_ALGORITHM = 'HS256'

# Emergent Auth
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: str
    name: str
    role: str  # 'Faculty', 'Administrative', 'Admin'
    designation: Optional[str] = None
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    role: str
    designation: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None

class DocumentUpload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    document_type: str
    access_level: str
    content: str
    file_name: str
    file_content: bytes
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Optional[dict] = None

class SearchQuery(BaseModel):
    query: str
    search_mode: str
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

class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    designation: Optional[str] = None

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

async def get_current_user(request: Request, authorization: Optional[str] = Header(None)):
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    # Check session_token cookie first
    session_token = request.cookies.get('session_token')
    
    # Fallback to Authorization header
    if not session_token and authorization and authorization.startswith('Bearer '):
        session_token = authorization.replace('Bearer ', '')
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user = await db.users.find_one({"user_id": session['user_id']}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def perform_bm25_search(query: str, documents: list) -> list:
    if not documents:
        return []
    tokenized_docs = [doc['content'].lower().split() for doc in documents]
    bm25 = BM25Okapi(tokenized_docs)
    tokenized_query = query.lower().split()
    scores = bm25.get_scores(tokenized_query)
    for i, doc in enumerate(documents):
        doc['score'] = float(scores[i])
    return sorted(documents, key=lambda x: x['score'], reverse=True)

def perform_semantic_search(query: str, documents: list) -> list:
    if not documents:
        return []
    query_embedding = model.encode([query])
    doc_contents = [doc['content'] for doc in documents]
    doc_embeddings = model.encode(doc_contents)
    similarities = cosine_similarity(query_embedding, doc_embeddings)[0]
    for i, doc in enumerate(documents):
        doc['score'] = float(similarities[i])
    return sorted(documents, key=lambda x: x['score'], reverse=True)

def perform_hybrid_search(query: str, documents: list) -> list:
    if not documents:
        return []
    bm25_results = perform_bm25_search(query, [doc.copy() for doc in documents])
    bm25_scores = {doc['id']: doc['score'] for doc in bm25_results}
    semantic_results = perform_semantic_search(query, [doc.copy() for doc in documents])
    semantic_scores = {doc['id']: doc['score'] for doc in semantic_results}
    max_bm25 = max(bm25_scores.values()) if bm25_scores else 1
    max_semantic = max(semantic_scores.values()) if semantic_scores else 1
    for doc in documents:
        bm25_norm = bm25_scores.get(doc['id'], 0) / max_bm25 if max_bm25 > 0 else 0
        semantic_norm = semantic_scores.get(doc['id'], 0) / max_semantic if max_semantic > 0 else 0
        doc['score'] = 0.4 * bm25_norm + 0.6 * semantic_norm
    return sorted(documents, key=lambda x: x['score'], reverse=True)

# Auth Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister, response: Response):
    # Validate email domain for non-admin
    if not user_data.email.endswith('@nemsu.edu.ph'):
        raise HTTPException(status_code=400, detail="Only @nemsu.edu.ph emails are allowed")
    
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        designation=user_data.designation
    )
    
    user_doc = user.model_dump()
    user_doc['password'] = hashed_password.decode('utf-8')
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user.user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7*24*60*60,
        httponly=True,
        samesite="none",
        secure=True
    )
    
    return {
        "session_token": session_token,
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "designation": user.designation
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user['user_id'],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7*24*60*60,
        httponly=True,
        samesite="none",
        secure=True
    )
    
    return {
        "session_token": session_token,
        "user": {
            "user_id": user['user_id'],
            "email": user['email'],
            "name": user['name'],
            "role": user['role'],
            "designation": user.get('designation'),
            "picture": user.get('picture')
        }
    }

@api_router.post("/auth/google")
async def google_auth(request: Request, x_session_id: str = Header(..., alias="X-Session-ID")):
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                EMERGENT_AUTH_URL,
                headers={"X-Session-ID": x_session_id},
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
        
        # Validate email domain
        if not data['email'].endswith('@nemsu.edu.ph'):
            raise HTTPException(status_code=403, detail="Only @nemsu.edu.ph emails are allowed")
        
        # Check if user exists
        user = await db.users.find_one({"email": data['email']}, {"_id": 0})
        
        if user:
            # Update existing user
            await db.users.update_one(
                {"user_id": user['user_id']},
                {"$set": {
                    "name": data['name'],
                    "picture": data.get('picture')
                }}
            )
            user_id = user['user_id']
            role = user['role']
            designation = user.get('designation')
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = {
                "user_id": user_id,
                "email": data['email'],
                "name": data['name'],
                "role": "Faculty",  # Default role
                "designation": None,
                "picture": data.get('picture'),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(new_user)
            role = "Faculty"
            designation = None
        
        # Create session
        session_token = data['session_token']
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "user": {
                "user_id": user_id,
                "email": data['email'],
                "name": data['name'],
                "role": role,
                "designation": designation,
                "picture": data.get('picture')
            },
            "session_token": session_token
        }
    
    except httpx.HTTPError as e:
        logging.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, current_user: dict = Depends(get_current_user)):
    session_token = request.cookies.get('session_token')
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    return {"message": "Logged out successfully"}

# Profile Routes
@api_router.put("/profile")
async def update_profile(update_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_fields = {}
    if update_data.name:
        update_fields['name'] = update_data.name
    if update_data.designation is not None:
        update_fields['designation'] = update_data.designation
    
    if update_fields:
        await db.users.update_one(
            {"user_id": current_user['user_id']},
            {"$set": update_fields}
        )
    
    updated_user = await db.users.find_one({"user_id": current_user['user_id']}, {"_id": 0, "password": 0})
    return updated_user

# Document Routes
@api_router.post("/documents/upload")
async def upload_document(
    title: str = Form(...),
    document_type: str = Form(...),
    access_level: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    file_content = await file.read()
    
    if file.filename.endswith('.pdf'):
        content = extract_text_from_pdf(file_content)
    elif file.filename.endswith('.docx'):
        content = extract_text_from_docx(file_content)
    elif file.filename.endswith('.txt'):
        content = extract_text_from_txt(file_content)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format")
    
    if not content:
        raise HTTPException(status_code=400, detail="Could not extract text from document")
    
    document_id = str(uuid.uuid4())
    doc_dict = {
        "id": document_id,
        "title": title,
        "document_type": document_type,
        "access_level": access_level,
        "content": content,
        "file_name": file.filename,
        "file_content": file_content,
        "uploaded_by": current_user['user_id'],
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.documents.insert_one(doc_dict)
    
    return {
        "message": "Document uploaded successfully",
        "document_id": document_id,
        "title": title
    }

@api_router.get("/documents")
async def get_documents(current_user: dict = Depends(get_current_user)):
    documents = await db.documents.find({}, {"_id": 0, "content": 0, "file_content": 0}).to_list(1000)
    
    filtered_docs = []
    for doc in documents:
        if current_user['role'] == 'Admin' or doc['access_level'] == 'Public' or doc['uploaded_by'] == current_user['user_id']:
            if isinstance(doc['uploaded_at'], str):
                doc['uploaded_at'] = datetime.fromisoformat(doc['uploaded_at'])
            filtered_docs.append(doc)
    
    return filtered_docs

@api_router.get("/documents/{document_id}")
async def get_document(document_id: str, current_user: dict = Depends(get_current_user)):
    document = await db.documents.find_one({"id": document_id}, {"_id": 0, "file_content": 0})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if current_user['role'] != 'Admin' and document['access_level'] == 'Restricted' and document['uploaded_by'] != current_user['user_id']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if isinstance(document['uploaded_at'], str):
        document['uploaded_at'] = datetime.fromisoformat(document['uploaded_at'])
    
    return document

@api_router.get("/documents/{document_id}/download")
async def download_document(document_id: str, current_user: dict = Depends(get_current_user)):
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Only allow download of public documents or own documents
    if document['access_level'] == 'Restricted' and document['uploaded_by'] != current_user['user_id'] and current_user['role'] != 'Admin':
        raise HTTPException(status_code=403, detail="Cannot download restricted documents")
    
    file_content = document.get('file_content')
    if not file_content:
        raise HTTPException(status_code=404, detail="File content not found")
    
    # Determine content type
    content_type = "application/octet-stream"
    if document['file_name'].endswith('.pdf'):
        content_type = "application/pdf"
    elif document['file_name'].endswith('.docx'):
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif document['file_name'].endswith('.txt'):
        content_type = "text/plain"
    
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename={document['file_name']}"}
    )

@api_router.delete("/documents/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if current_user['role'] != 'Admin' and document['uploaded_by'] != current_user['user_id']:
        raise HTTPException(status_code=403, detail="Only the uploader or admin can delete this document")
    
    await db.documents.delete_one({"id": document_id})
    
    return {"message": "Document deleted successfully"}

# Search Routes
@api_router.post("/search")
async def search_documents(query: SearchQuery, current_user: dict = Depends(get_current_user)):
    documents = await db.documents.find({}, {"_id": 0, "file_content": 0}).to_list(1000)
    
    filtered_docs = []
    for doc in documents:
        if current_user['role'] == 'Admin' or doc['access_level'] == 'Public' or doc['uploaded_by'] == current_user['user_id']:
            filtered_docs.append(doc)
    
    if not filtered_docs:
        return []
    
    if query.search_mode == 'bm25':
        results = perform_bm25_search(query.query, filtered_docs)
    elif query.search_mode == 'semantic':
        results = perform_semantic_search(query.query, filtered_docs)
    elif query.search_mode == 'hybrid':
        results = perform_hybrid_search(query.query, filtered_docs)
    else:
        raise HTTPException(status_code=400, detail="Invalid search mode")
    
    search_results = []
    for doc in results[:20]:
        if doc['score'] > 0.1:
            content = doc['content']
            query_terms = query.query.lower().split()
            content_lower = content.lower()
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
async def chat_search(message: ChatMessage, current_user: dict = Depends(get_current_user)):
    query = SearchQuery(
        query=message.message,
        search_mode='hybrid',
        access_level=message.access_level
    )
    
    results = await search_documents(query, current_user)
    
    if not results:
        return {
            "response": "I couldn't find any documents matching your query. Try using different keywords or phrases.",
            "documents": []
        }
    
    response = f"I found {len(results)} relevant document(s) for your query. Here are the top results:"
    
    return {
        "response": response,
        "documents": results[:5]
    }

# Stats
@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    total_docs = await db.documents.count_documents({})
    user_docs = await db.documents.count_documents({"uploaded_by": current_user['user_id']})
    public_docs = await db.documents.count_documents({"access_level": "Public"})
    
    return {
        "total_documents": total_docs,
        "your_documents": user_docs,
        "public_documents": public_docs
    }

# Admin Routes
@api_router.get("/admin/users")
async def get_all_users(admin_user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.put("/admin/users/{user_id}")
async def update_user_role(
    user_id: str,
    update_data: AdminUserUpdate,
    admin_user: dict = Depends(require_admin)
):
    update_fields = {}
    if update_data.role:
        update_fields['role'] = update_data.role
    if update_data.designation is not None:
        update_fields['designation'] = update_data.designation
    
    if update_fields:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": update_fields}
        )
    
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    return updated_user

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin_user: dict = Depends(require_admin)):
    if user_id == admin_user['user_id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"message": "User deleted successfully"}

@api_router.get("/admin/documents")
async def get_all_documents_admin(admin_user: dict = Depends(require_admin)):
    documents = await db.documents.find({}, {"_id": 0, "content": 0, "file_content": 0}).to_list(1000)
    return documents

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
