from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from pinecone import Pinecone
from langchain_pinecone import PineconeVectorStore
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_ollama import OllamaLLM
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
api_key = os.getenv("PINECONE_API_KEY")

# Load PDF
loader = PyPDFLoader("attention.pdf")
docs = loader.load()

# Split
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
docs = splitter.split_documents(docs)

# Embeddings + LLM
emb = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
llm = OllamaLLM(model="deepseek-r1:8b", temperature=0, streaming=False)

# --- PINECONE ---
pc = Pinecone(api_key=api_key)
index = pc.Index("custombrain")

# Vector Store
vector_store = PineconeVectorStore(
    embedding=emb,
    index_name="custombrain",
    namespace="custombrain-namespace"
)

# Upload only if empty
stats = index.describe_index_stats()

if stats.total_vector_count == 0:
    print("Uploading data to Pinecone...")
    vector_store.add_documents(docs)
else:
    print("Index already populated.")

# Retriever
retriever = vector_store.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 3}
)

# Prompt template
prompt_template = ChatPromptTemplate.from_messages([
    ("human", """
You are a helpful assistant answering questions **only** using the context below.
If the answer is not clearly contained in the context, say: "I don't know based on the provided document."

- Prefer to paraphrase in your own words.
- If helpful, quote short phrases from the context.
- Do NOT explain your reasoning step-by-step.

Context:
{context}

Question: {question}

Answer:
    """)
])


# RAG chain and clean context function
def join_docs(doc_list):
    return "\n\n".join([d.page_content for d in doc_list])


rag_chain = (
    {
        "context": lambda x: join_docs(
            retriever.invoke(x["question"])
        ),
        "question": lambda x: x["question"]
    }
    | prompt_template
    | llm
)


# Test query
response = rag_chain.invoke({"question": "What is attention mechanism?"})
print(response)
