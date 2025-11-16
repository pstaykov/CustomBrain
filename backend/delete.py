# reset index
from pinecone import Pinecone
from pinecone import ServerlessSpec
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()
api_key = os.getenv("PINECONE_API_KEY")

pc = Pinecone(api_key=api_key)
if "custombrain" in pc.list_indexes():
    pc.delete_index("custombrain")

#recreate index
pc.create_index(
    name="custombrain",
    dimension=384,
    spec=ServerlessSpec(cloud="aws", region="us-east-1")
)

print("Index 'custombrain' has been deleted and recreated.")
