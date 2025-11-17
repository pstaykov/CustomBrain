from pydantic import BaseModel

class UploadRequest(BaseModel):
    files: list[str]

class UploadResponse(BaseModel):
    success: bool
    file_ids: list[str]

class QueryRequest(BaseModel):
    question: str

class QueryResponse(BaseModel):
    answer: str

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

