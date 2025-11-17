from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableMap, RunnablePassthrough
from langchain_ollama import OllamaLLM
from ..config import LLM_MODEL


# ----------------------------------------------------
# LLM Initialization
# ----------------------------------------------------
def initialize_llm():
    return OllamaLLM(
        model=LLM_MODEL,
        temperature=0,
        streaming=False
    )


# ----------------------------------------------------
# RAG Chain
# ----------------------------------------------------
def create_rag_chain(vector_store, llm):

    # Pinecone retriever
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 3},
    )

    # ----------------------------------------------
    # Query rewriting LLM
    # ----------------------------------------------
    query_prompt = ChatPromptTemplate.from_messages([
        ("system", "Rewrite the user question into a short, highly relevant search query."),
        ("human", "Question: {question}\n\nSearch query:")
    ])
    query_generator = query_prompt | llm

    # Extract real text from LLM output
    def generate_query(question: str) -> str:
        raw = query_generator.invoke({"question": question})

        # Handle Ollama return types
        if isinstance(raw, dict):
            try:
                raw = raw["message"]["content"]
            except:
                raw = str(raw)

        return str(raw).strip()

    # Join retrieved docs
    def join_docs(docs):
        return "\n\n".join([d.page_content for d in docs])

    # ----------------------------------------------
    # Final Answer Prompt
    # ----------------------------------------------
    answer_prompt = ChatPromptTemplate.from_messages([
        ("human", """
You are a helpful assistant answering questions **only** using the context below.
If the answer is not clearly contained in the context, say: "I don't know based on the provided document."

Context:
{context}

Question: {question}

Answer:
""")
    ])
    # Full RAG Chain
    rag_chain = (
        # Step 1: Rewrite Query
        RunnableMap({
            "search_query": lambda x: generate_query(x["question"]),
            "question": lambda x: x["question"],
        })
        |
        # Step 2: Retrieve from Pinecone
        RunnableMap({
            "context": lambda x: join_docs(
                retriever.invoke(x["search_query"])
            ),
            "question": lambda x: x["question"],
        })
        |
        # Step 3: Answer using context
        answer_prompt
        | llm
    )

    return rag_chain
