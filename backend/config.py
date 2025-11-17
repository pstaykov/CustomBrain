import os

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Pinecone configuration
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = "custombrain"
NAMESPACE = "custombrain-namespace"

# LangChain configuration
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
LLM_MODEL = "deepseek-r1:8b"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# Upload directory
UPLOAD_DIR = "uploads"
