from langchain_community.document_loaders import PyPDFLoader, TextLoader, UnstructuredHTMLLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from ..config import *

def load_document(file_path):
    ext = file_path.split('.')[-1].lower()
    try:
        if ext == 'pdf':
            loader = PyPDFLoader(file_path)
        elif ext == 'txt':
            loader = TextLoader(file_path)
        elif ext in ['html', 'htm']:
            loader = UnstructuredHTMLLoader(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")
        
        return loader.load()
    except Exception as e:
        print(f"Error loading document {file_path}: {str(e)}")
        return []

def split_documents(documents):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )
    return splitter.split_documents(documents)
