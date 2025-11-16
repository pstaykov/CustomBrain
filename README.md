# CustomBrain

CustomBrain is a small experimental project that demonstrates a simple RAG (retrieval-augmented generation) workflow using local PDF loading, Hugging Face embeddings, and Pinecone as the vector database. The repository contains two small backend scripts:

- `backend/delete.py` - resets (deletes and recreates) a Pinecone index named `custombrain`.
- `backend/RAG.py` - loads `attention.pdf`, chunks it, creates embeddings, uploads them to Pinecone (if index is empty), and runs a single test query via a chain.

**Important:** this project expects a Pinecone API key and (optionally) an Ollama local server for the `OllamaLLM` LLM used in the RAG pipeline. Keep secrets out of version control.

**Quick Links**
- Backend scripts: `backend/delete.py`, `backend/RAG.py`
- Environment: `backend/.env` (should contain `PINECONE_API_KEY`)

**Local Usage Overview**

**Prerequisites**
- Python 3.10+ recommended.
- A Pinecone account and API key (or a running Pinecone-compatible server).
- Optional: Ollama running locally if you want to use the `OllamaLLM` model referenced in `RAG.py`.

**Setup & Run (PowerShell)**

1. Create and activate a virtual environment (optional but recommended):

```powershell
python -m venv .venv
; .\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r backend/requirements.txt
```

3. Add your Pinecone API key. Copy the example env and edit it:

```powershell
copy backend\.env.example backend\.env
# then edit backend\.env and paste your PINECONE_API_KEY
notepad backend\.env
```

4. Reset the Pinecone index (run `delete.py`):

```powershell
python backend/delete.py
```

5. Run the RAG pipeline (loads `attention.pdf`, populates the index if empty, and runs a test query):

```powershell
python backend/RAG.py
```

**Files & Behavior**
- `backend/delete.py`:
	- Uses `python-dotenv` to load `PINECONE_API_KEY` from `backend/.env`.
	- Instantiates Pinecone client and deletes and recreates an index named `custombrain` with dimension `384`.

- `backend/RAG.py`:
	- Loads `attention.pdf` using `PyPDFLoader` (from `langchain_community.document_loaders`).
	- Splits documents with a `RecursiveCharacterTextSplitter` (chunk_size=1000, overlap=200).
	- Uses `HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")` to generate embeddings.
	- Uses `Pinecone` client and `PineconeVectorStore` to upload documents when the index is empty.
	- Builds a simple RAG chain using a `ChatPromptTemplate` and an `OllamaLLM` and runs a test query: "What is attention mechanism?".

**Security & Notes**
- The `OllamaLLM` requires Ollama running locally and the named model available (`deepseek-r1:8b` in the example). If you don't have Ollama, replace the LLM with an OpenAI/other LLM wrapper supported by LangChain.
- Package names for some LangChain integrations vary; if installation fails, check the package's PyPI name or install `langchain` and the specific integration package.

**Troubleshooting**
- If `pinecone` imports fail, try `pip install pinecone-client`.
- If `langchain_...` packages cannot be found, try `pip install langchain` and then the relevant integration packages (e.g. `pip install langchain-ollama langchain-huggingface`).

**Next steps / Improvements**
- Add a proper CLI or small Flask/FastAPI server to query the chain interactively.
- Add unit tests for the document loading & splitting logic.
- Add a small sanity-check script to verify connectivity to Pinecone and Ollama.

