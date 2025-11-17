from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import uuid
from pinecone import Pinecone

from .config import UPLOAD_DIR, PINECONE_API_KEY, PINECONE_INDEX_NAME
from .services.doc_loader import load_document, split_documents
from .services.vectorstore import initialize_vector_store
from .services.RAG import initialize_llm, create_rag_chain
from .models import UploadResponse, QueryRequest, QueryResponse
from .models import ChatRequest, ChatResponse
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  
load_dotenv(os.path.join(BASE_DIR, ".env"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory
os.makedirs(UPLOAD_DIR, exist_ok=True)

conversation_history = []
vector_store = None
rag_chain = None
llm = None


# ------------------------------
# Helpers
# ------------------------------

def ensure_index_exists():
    if vector_store is None:
        raise HTTPException(status_code=404, detail="No vector index is initialized.")

    #try:
        #vector_store.describe_index_stats()
    #except Exception:
        #raise HTTPException(status_code=404, detail="Vector index not found or inaccessible.")


# ------------------------------
# Index management
# ------------------------------

@app.post("/index/init")
def init_index():
    global vector_store, rag_chain, llm

    try:
        llm = initialize_llm()                 
        vector_store = initialize_vector_store()
        rag_chain = create_rag_chain(vector_store, llm)

        return {"success": True, "message": "Index initialized successfully."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/index/reset")
def reset_index():
    ensure_index_exists()

    try:
        vector_store.delete(delete_all=True)
        return {"success": True, "message": "Index cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------
# Admin / List endpoints
# ------------------------------


@app.get("/index/list")
def list_indices():
    """Return a list of available Pinecone indexes for the configured API key."""
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        raw_indexes = pc.list_indexes()

        # Convert Pinecone index objects to dictionaries
        indexes = []
        if raw_indexes:
            try:
                # raw_indexes might be IndexList or similar; try to iterate
                for idx in raw_indexes:
                    idx_dict = {}
                    
                    # Try multiple ways to extract data from the object
                    if isinstance(idx, dict):
                        idx_dict = idx
                    elif hasattr(idx, 'to_dict') and callable(idx.to_dict):
                        idx_dict = idx.to_dict()
                    elif hasattr(idx, '__dict__'):
                        idx_dict = vars(idx).copy()
                    else:
                        # Fallback: try to extract common attributes
                        for attr in ['name', 'dimension', 'metric', 'host', 'status', 'spec', 'deletion_protection', 'vector_type', 'tags']:
                            if hasattr(idx, attr):
                                val = getattr(idx, attr)
                                # Convert status and spec objects to dicts if they have __dict__
                                if hasattr(val, '__dict__') and not isinstance(val, (str, int, float, bool, list)):
                                    val = vars(val)
                                idx_dict[attr] = val
                    
                    if idx_dict:
                        indexes.append(idx_dict)
            except Exception as e:
                import traceback
                print(f"Error converting indexes: {e}")
                traceback.print_exc()

        # Provide helpful diagnostics
        result = {
            "indexes": indexes,
            "configured_index": PINECONE_INDEX_NAME,
            "api_key_present": bool(PINECONE_API_KEY)
        }

        # If our configured index is present, try to include basic stats
        configured_idx_name = PINECONE_INDEX_NAME
        for idx_dict in indexes:
            if isinstance(idx_dict, dict) and idx_dict.get("name") == configured_idx_name:
                try:
                    idx = pc.Index(PINECONE_INDEX_NAME)
                    stats = idx.describe_index_stats()

                    # Safely extract numeric stats
                    total = None
                    try:
                        if isinstance(stats, dict):
                            total = stats.get('total_vector_count') or stats.get('totalVectorCount')
                        elif hasattr(stats, 'get'):
                            total = stats.get('total_vector_count')
                        elif hasattr(stats, 'total_vector_count'):
                            total = getattr(stats, 'total_vector_count')
                    except Exception:
                        total = None

                    if isinstance(total, (int, float)):
                        total_val = int(total)
                    else:
                        total_val = None

                    result["configured_index_stats"] = {"total_vector_count": total_val}
                except Exception:
                    result["configured_index_stats"] = None
                break

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/uploads/list")
def list_uploaded_files():
    """Return a list of uploaded (temporary) files currently in the upload directory."""
    try:
        files = []
        if os.path.exists(UPLOAD_DIR):
            for fname in os.listdir(UPLOAD_DIR):
                fpath = os.path.join(UPLOAD_DIR, fname)
                try:
                    stat = os.stat(fpath)
                    files.append({
                        "name": fname,
                        "size": stat.st_size,
                        "mtime": stat.st_mtime
                    })
                except Exception:
                    files.append({"name": fname})

        return {"files": files, "upload_dir": UPLOAD_DIR}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------
# Upload
# ------------------------------

@app.post("/upload/", response_model=UploadResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    ensure_index_exists()

    file_paths = []
    saved_file_ids = []

    for file in files:
        file_id = f"{uuid.uuid4()}-{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, file_id)

        with open(file_path, "wb") as f:
            f.write(await file.read())

        file_paths.append(file_path)
        saved_file_ids.append(file_id)

    try:
        documents = []
        for file_path in file_paths:
            docs = load_document(file_path)
            if docs:
                documents.extend(docs)

        if not documents:
            raise HTTPException(status_code=400, detail="No valid documents to process")

        split_docs = split_documents(documents)
        vector_store.add_documents(split_docs)

        for file_path in file_paths:
            if os.path.exists(file_path):
                os.remove(file_path)

        return UploadResponse(success=True, file_ids=saved_file_ids)

    except Exception as e:

        for file_path in file_paths:
            if os.path.exists(file_path):
                os.remove(file_path)

        raise HTTPException(status_code=400, detail=str(e))


# ------------------------------
# Query
# ------------------------------

@app.post("/query/", response_model=QueryResponse)
async def query_document(request: QueryRequest):
    ensure_index_exists()

    try:
        answer = rag_chain.invoke({"question": request.question})
        return QueryResponse(answer=answer)

    except Exception as e:
        import traceback
        print("\n" + "="*80)
        print("🔥🔥🔥 ERROR INSIDE /query/ 🔥🔥🔥")
        print("="*80)
        traceback.print_exc()
        print("Exception object:", repr(e))
        print("="*80 + "\n")
        raise HTTPException(status_code=500, detail=str(e))



# ------------------------------
# Chat
# ------------------------------

@app.post("/chat/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    global llm, conversation_history

    if llm is None:
        raise HTTPException(status_code=400, detail="LLM is not initialized. Call /index/init first.")

    try:
        # Save user's message
        conversation_history.append(("human", request.message))

        # Convert history into ChatPromptTemplate format
        messages = []
        for role, text in conversation_history:
            messages.append((role, text))

        # Build prompt
        prompt = ChatPromptTemplate.from_messages(messages)

        # Run LLM
        response_text = (prompt | llm).invoke({})

        # Save assistant reply
        conversation_history.append(("assistant", response_text))

        return ChatResponse(response=response_text)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/reset")
def reset_chat():
    global conversation_history
    conversation_history = []
    return {"success": True, "message": "Chat memory cleared."}


# ------------------------------
# Health
# ------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok"}
