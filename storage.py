import chromadb.config
from langchain_openai import OpenAIEmbeddings
# from langchain_community import Chroma
from langchain_community.vectorstores import Chroma
import chromadb


def get_vectorstore(collection_name, persist_directory='chroma_db_db')-> Chroma:
    settings=chromadb.config.Settings(
        is_persistent=True,
        persist_directory=str(persist_directory),
        anonymized_telemetry=False
    )

    chroma_client=chromadb.PersistentClient()
    
    vectorstore= Chroma(
        collection_name=collection_name,
        embedding_function=OpenAIEmbeddings(),
        client_settings=settings,
        client=chroma_client
    )
    return vectorstore
import os
def get_history(query: str):
    vectorstore=get_vectorstore(os.environ['COLLECTION_NAME'])
    try:
        result, score=vectorstore.similarity_search_with_score(query=query, k=1)[0]
        print('Score is: ', score)
        print('doc is: ', result)
        if score>float(os.environ['QUESTION_DISTANCE_THRESHOLD']):
            raise LookupError('Can\'t find the similar question')
        return {'similar_question': result.page_content, **result.metadata}
    except LookupError:
        return None