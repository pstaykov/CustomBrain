from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_ollama import OllamaLLM
from ..config import *

def initialize_llm():
    return OllamaLLM(
        model=LLM_MODEL,
        temperature=0,
        streaming=False
    )

llm = initialize_llm()

def create_rag_chain(vector_store):
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 3}
    )

    def join_docs(doc_list):
        return "\n\n".join([d.page_content for d in doc_list])
    
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
            """)])

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
    
    return rag_chain
