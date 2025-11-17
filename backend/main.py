from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import uuid

from .config import UPLOAD_DIR
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
