from fastapi import HTTPException
import requests
import os

api_url = "http://localhost:8000"

def reset_index():
    url = f"{api_url}/index/reset"
    try:
        response = requests.post(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error resetting index: {e}")
        return None

def init_index():
    url = f"{api_url}/index/init"
    try:
        response = requests.post(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error initializing index: {e}")
        return None

def upload_file(file_path: str):
    url = f"{api_url}/upload/"
    files = {"files": open(file_path, "rb")}
    try:
        response = requests.post(url, files=files)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error uploading file: {e}")
        return None

def query(question: str):
    url = f"{api_url}/query/"
    data = {"question": question}
    try:
        response = requests.post(url, json=data)
        response.raise_for_status()
        return response.json()["answer"]
    except Exception as e:
        print(f"Error during query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    print("Resetting index...")
    print(reset_index())

    print("Initializing index...")
    print(init_index())

    print("Uploading file...")
    upload_result = upload_file(r"backend\Attention.pdf")
    print("Upload result:", upload_result)

    print("Querying system...")
    answer = query("What is the attention mechanism?")
    print("Answer:", answer)
    print("Done.")