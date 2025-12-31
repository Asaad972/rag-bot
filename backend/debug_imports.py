try:
    import langchain
    print(f"LangChain version: {langchain.__version__}")
    from langchain.chains import ConversationalRetrievalChain
    print("Import successful")
except Exception as e:
    print(f"Import failed: {e}")
