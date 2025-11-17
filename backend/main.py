from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict
import os
import uuid
from .config import UPLOAD_DIR, PINECONE_API_KEY
from .services.doc_loader import load_document, split_documents
from .services.vectorstore import initialize_vector_store, check_index_empty
from .services.RAG import initialize_llm, create_rag_chain
from .models import UploadRequest, QueryRequest, UploadResponse, QueryResponse

# Initialize FastAPI
app = FastAPI()

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize components
vector_store = initialize_vector_store()
llm = initialize_llm()
rag_chain = create_rag_chain(vector_store)

@app.post("/upload/", response_model=UploadResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    file_paths = []
    for file in files:
        file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}-{file.filename}")
        with open(file_path, "wb") as f:
            f.write(await file.read())
        file_paths.append(file_path)
    
    try:
        documents = []
        for file_path in file_paths:
            docs = load_document(file_path)
            if docs:
                documents.extend(docs)
        
        if not documents:
            raise HTTPException(status_code=400, detail="No valid documents to process")
        
        split_docs = split_documents(documents)
        
        if check_index_empty(vector_store):
            vector_store.add_documents(split_docs)
        
        return UploadResponse(
            success=True,
            file_ids=[f"{uuid.uuid4()}-{file.filename}" for file in files]
        )
    except Exception as e:
        for file_path in file_paths:
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/query/", response_model=QueryResponse)
async def query_document(request: QueryRequest):
    try:
        response = rag_chain.invoke({"question": request.question})
        return QueryResponse(answer=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
