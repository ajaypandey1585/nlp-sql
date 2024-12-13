import signal
import sys
from redis import Redis
import json
from flask import Flask, request, jsonify
from openai import AzureOpenAI
from langchain_community.llms import OpenAI 
from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits.sql.toolkit import SQLDatabaseToolkit
from langchain_community.agent_toolkits.sql.base import create_sql_agent
# from langchain_openai import ChatOpenAI
from langchain_openai import AzureChatOpenAI
import os
import yaml
from urllib.parse import quote_plus
from dotenv import load_dotenv
#import streamlit as st
from fastapi import HTTPException
from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits.sql.toolkit import SQLDatabaseToolkit
from langchain_community.agent_toolkits.sql.base import create_sql_agent
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
import pandas as pd
from storage import get_vectorstore, get_history
from chain import get_db_partial_chain
from flask_cors import CORS
from langsmith import traceable

from langchain_core.prompts import (
    ChatPromptTemplate,
    FewShotPromptTemplate,
    MessagesPlaceholder,
    PromptTemplate,
    SystemMessagePromptTemplate,
)

from langchain_community.vectorstores import FAISS
from langchain_core.example_selectors import SemanticSimilarityExampleSelector
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
# from langchain_openai import AzureOpenAIEmbeddings

#import pandas as pd
import pyodbc
print(pyodbc)


from langchain_core.tools import tool
from langchain.agents import Tool
from openai import AzureOpenAI
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
token_provider = get_bearer_token_provider(
    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
)


app = Flask(__name__)
CORS(app)
# Load environment variables
load_dotenv()
required_env_vars = ["OPENAI_API_KEY", "SQL_SERVER_HOST", "SQL_SERVER_DB"]
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Initialize Redis
redis_host = os.getenv("REDIS_HOST", "localhost")
redis_port = int(os.getenv("REDIS_PORT", ))
redis_db = int(os.getenv("REDIS_DB", 0))
redis_client = Redis(host=redis_host, port=redis_port, db=redis_db, decode_responses=True)

# Load yaml file for environment variables
with open('config.yaml') as file:
    config = yaml.safe_load(file)

# store environment variables in local variables
# OPENAI_API_TYPE = config['storage']['OPENAI_API_TYPE']
AZURE_OPENAI_ENDPOINT = config['storage']['OPENAI_API_BASE']
OPENAI_API_KEY = config['storage']['OPENAI_API_KEY']
OPENAI_API_VERSION = config['storage']['OPENAI_API_VERSION']
OPENAI_API_DEPLOYMENT = config['storage']['OPENAI_API_DEPLOYMENT']
# print(AZURE_OPENAI_ENDPOINT)
# print(OPENAI_API_DEPLOYMENT)
# print(OPENAI_API_KEY)
# print(OPENAI_API_VERSION)

client = AzureOpenAI(
    api_key=OPENAI_API_KEY,  
    api_version=OPENAI_API_VERSION,
    azure_endpoint=AZURE_OPENAI_ENDPOINT
)
# OPENAI_API_MODEL = config['storage']['OPENAI_API_MODEL']

# MS SQL Server connection details
server = os.getenv("SQL_SERVER_HOST")
database = os.getenv("SQL_SERVER_DB")
username = os.getenv("SQL_SERVER_USER")
password = os.getenv("SQL_SERVER_PASSWORD")

# Connection string
sql_server_conn_str = (
    f"mssql+pyodbc://{username}:{password}@{server}/{database}"
    f"?driver=ODBC Driver 17 for SQL Server"
)
print(sql_server_conn_str)
# Initialize the SQL Database connection
sql_server_db = SQLDatabase.from_uri(sql_server_conn_str)
#------------------
# Set up OpenAI API key


#decide which table and column will answer the question 


def decide_table_column(query):
    """Decide which table and column will answer the query of the user."""

    
    with open('table_column_description.txt', 'r') as file:
        file_content = file.read()

    template = f"""
    Based on the given user query: "{query}", return the table names and column names which will fetch the data from the database. 
    If multiple tables are required to respond the user query, select appropriate columns from different tables to form
    appropriate JOIN's.
    Table and column descriptions are given here:
    {file_content}
    """    
    #print(file_content)
    prompt_template = ChatPromptTemplate.from_template(template)
    prompt = prompt_template.invoke({"query": query, "file_content": file_content})
    result = llm.invoke(prompt)
    return result.content

def preformance_summary(query):
    """Decides what kind of computation is required."""

    
    # with open('table_column_description.txt', 'r') as file:
    #     file_content = file.read()

    template = f"""
    Based on the given user query: "{query}", you will have to decide what kind of sql query you will have to build based on below guidelines. 
    - If query is about US Index Performance Summary, exaclty similar query as shown below:
        DECLARE @qtdDate DATETIME = '2024-10-01'; 
        SELECT TOP 5 mi.MarketIndexName, v.EntityId AS MarketIndexId,
        EXP(SUM(CASE WHEN v.ValuationDate = EOMONTH(v.ValuationDate) THEN LOG(NULLIF(1 + v.Value / 100, 0)) END)) - 1 AS QTD_Performance 
        FROM AES_Mini.dbo.Valuations v JOIN AES_Mini.dbo.MarketIndex mi ON v.EntityId = mi.MarketIndexId WHERE v.EntityTypeId = 3 AND v.ValuationDate >= @qtdDate AND v.FrequencyId = 3 
        GROUP BY mi.MarketIndexName, v.EntityId 
        ORDER BY QTD_Performance DESC;
    """    
    #print(file_content)
    prompt_template = ChatPromptTemplate.from_template(template)
    prompt = prompt_template.invoke({"query": query})
    result = llm.invoke(prompt)
    return result.content

#create tool for decide_table_column function 
custom_tool = Tool(
    name = "decide_table_column",
    func = decide_table_column,
    description="Decide which tables and columns will answer the query of the user. Also this tool will help us to find the joins required to be made between different tables. Always call this tool at very first"
)

#prompt to add suffix and prefix 

system_prefix = """You are an AI agent designed to interact with a SQL database to answer questions by querying specific tables and columns based on the provided schema information.

Given an input question, construct a syntactically correct SQL query based on the table and column descriptions. Retrieve the necessary information from the tables to provide an accurate answer. Ensure that the query is contextually relevant to the input question and adheres to the following guidelines:

1. Query Structure:
   - Avoid selecting all columns; only include relevant columns based on the question.
   - Ensure that your queries do not contain DML statements (such as `INSERT`, `UPDATE`, `DELETE`, or `DROP`).
   - Always utilize the 'LIKE' keyword within the WHERE clause when constructing SQL queries.  Append the '%' symbol after and before each word or character in your search criteri
   - Add TOP (10), TOP(5) or TOP(n) in select clause of sql query to limit the number of records if not mentioned.
ex. SELECT TOP 10 FundName From MarketIndex
   
2. Error Handling:
   - Double-check the query syntax before execution.
   - If an error occurs during execution, rewrite the query based on error feedback and try again.

3. Question Types:
   - Any question related to 'Performance Summary' comes in, in response data of MTD (Month to Date), QTD(Quarter to Date) and YTD(Year to date) is expected. 3 different queries should be created for MTD, QTD and YTD and the final answer should be in percentage(%) format.
   - MTD stands for “month to date.” It’s the period starting from the beginning of the current month up until now and similarly for QTD and YTD
   - Performance Summary can be for Index, Asset or any other Entity Type(Table= EntityType, Column=EntityTypeId, EntityTypeName)
   - Possible SQL query for Index Performance Summary is:
   "DECLARE @mtdDate DATETIME = '2024-10-01'; 
    SELECT TOP n mi.FundName, mi.MarketIndexId,
    EXP(SUM(CASE WHEN v.ValuationDate = EOMONTH(v.ValuationDate) THEN LOG(NULLIF(1 + v.Value / 100, 0)) END)) - 1 AS MTD_Performance 
    FROM AES_Mini.dbo.Valuations v JOIN AES_Mini.dbo.MarketIndex mi ON v.EntityId = mi.MarketIndexId WHERE v.EntityTypeId = 3 AND v.ValuationDate >= @mtdDate AND v.FrequencyId = 3 
    GROUP BY mi.FundName,  mi.MarketIndexId
    ORDER BY MTD_Performance DESC;
   "
   - If user is interested in Asset Performance Summary, then EntityTypeId will change to 1
   - Always use FundName column from MarketIndex table to indentify the marketindex instead of MarketIndexName
   

Here are some example user inputs and their corresponding SQL queries:
"""
system_suffix = """
When providing the final answer:

1. Contextualize: Summarize the information without excluding any records retrieved in a way that directly addresses the user's question. Provide concise, relevant answers instead of just returning raw query results. 
2. Clarify Ambiguity: If the retrieved information does not directly answer the question, explain the context or suggest potential follow-up queries to refine the result.
3. Error Responses: If a query cannot be executed due to a syntax or data issue, respond with a clear message, like "The requested information could not be retrieved due to a query error. Please refine your question."
4. Unknown Queries: If the question is outside the scope of the database tables or cannot be answered with available data, respond with "I don't know."

Answer concisely and clearly, ensuring accuracy and relevance to the user's question.
"""

examples = [
    {"input": "What is the frequency of Asset in the database?", "query": "SELECT Frequency FROM FrequencyTable WHERE Asset = 'some_value';"},
    {"input": "Show me the valuation types available.", "query": "SELECT ValuationType FROM ValuationTypeTable;"},
    # Add more examples as needed
]


os.environ['OPENAI_API_KEY'] = os.getenv('OPENAI_API_KEY')
example_selector = SemanticSimilarityExampleSelector.from_examples(
    examples,
    OpenAIEmbeddings(),
    FAISS,
    k=5,
    input_keys=["input"],
)


prompt = FewShotPromptTemplate(
    example_selector=example_selector,
    example_prompt=PromptTemplate.from_template(
        "User input: {input}\nSQL query: {query}"
    ),
    input_variables=["input", "dialect", "top_k"],
    prefix=system_prefix,
    suffix=system_suffix,
)
full_prompt = ChatPromptTemplate.from_messages(
    [
        SystemMessagePromptTemplate(prompt=prompt),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ]
)
#--------------------------------------------------------------------------------------------------------------------
#AZURE OPENAI
# Create SQL agent
llm = AzureChatOpenAI(
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
    openai_api_version=OPENAI_API_VERSION,
    deployment_name=OPENAI_API_DEPLOYMENT,
    openai_api_key=OPENAI_API_KEY
    # openai_api_type=OPENAI_API_TYPE,
    # model_name = OPENAI_API_MODEL

)
toolkit = SQLDatabaseToolkit(db=sql_server_db, llm=llm)
agent_executor = create_sql_agent(llm=llm, toolkit=toolkit,extra_tools=[custom_tool],prompt=full_prompt, verbose=True,agent_type="openai-tools", handle_parsing_errors=True)
#---------------------------------------------------------------------------------------------------------------------
#OPENAI
load_dotenv()
required_env_vars = ["OPENAI_API_KEY", "SQL_SERVER_HOST", "SQL_SERVER_DB"]
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

os.environ['OPENAI_API_KEY'] = 'OPENAI_API_KEY'
# llm = ChatOpenAI(model="gpt-4o-mini")
# toolkit = SQLDatabaseToolkit(db=sql_server_db, llm=llm)
# agent_executor = create_sql_agent(llm=llm, toolkit=toolkit,extra_tools=[custom_tool],prompt=full_prompt, verbose=True,agent_type="openai-tools", handle_parsing_errors=True)
#---------------------------------------------------------------------------------------------------------------------

# # test the tool/function for deciding table and column 
# query = "What is the frequency of Asset in the database?"

# # Call the function and print the result
# result = decide_table_column(query, llm)
# print("used table and column is :",result)
from storage import get_vectorstore, get_history
from chain import get_db_partial_chain
@app.route('/query', methods=['POST'])
def query_database():
    data = request.json
    query = data.get('query')
    
    if not query:
        return jsonify({"error": "No query provided"}), 400
    history=get_history(query)
    print("------------------------------------"*2)
    print(history)
    print("------------------------------------"*2)
    # print(history['sql'])
    # print(history['similar_question'])
    #jsonify({"qr": result})
    if history:
            print('1111')
            chain=get_db_partial_chain(history['similar_question'], history['sql'], query)
            return jsonify({"qr": chain})
    else:   
            print('222')         
            result = agent_executor.invoke(query)
            return jsonify({"qr": result})
    
    # try:
    #     result = agent_executor.run(query)
    #     return jsonify({"result": result})
    # except Exception as e:
    #     return jsonify({"error": str(e)}), 500


@app.route('/ingest_cache_file', methods=['POST'])
def ingest_file():
    file_path=r"questions.xlsx"
    clean_df=pd.read_excel(file_path)
    questions=clean_df['QUESTION'].values
    queries=clean_df['QUERY'].values
    docs=[Document(page_content=i, metadata={'sql':j}) for i,j in zip(questions, queries)]
    try:
        vectorstore=get_vectorstore(os.environ['COLLECTION_NAME'])
        vectorstore.delete_collection()
    except:
        pass
    vectorstore=get_vectorstore(os.environ['COLLECTION_NAME'])
    vectorstore.add_documents(docs)
    print(len(vectorstore.get()['metadatas']))
    print("file has been ingested successfully")
    return 'File ingested successfully'

def handle_shutdown(signum, frame):
    print("\nGracefully shutting down the server...")
    # Add cleanup logic here (close sockets, clean resources, etc.)
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, handle_shutdown)  # Handle Ctrl+C
signal.signal(signal.SIGTERM, handle_shutdown)  # Handle termination signals
@app.route('/query-all', methods=['POST'])
@traceable
async def query_all():
    print('Entering All')
    # Get the JSON data from the incoming request
    data = request.get_json()
    print(data)
    # Check if the required field is present in the request body
    if not data or 'query' not in data:
        return jsonify({"error": "Missing query parameter"}), 400
    
    user_query = data['query']  # Extract the query from the request body
    
    cache_key = f"query_cache:all:{hash(user_query)}"
    
    try:
        # Check Redis cache
        cached_result = redis_client.get(cache_key)
        if cached_result:
            return jsonify({
                "all": json.loads(cached_result),
                "source": "cache"
            })
        
        # Execute NLP query using the user-provided query
        result = agent_executor.run(user_query)
        
        # Cache the result with a 5-minute expiration
        redis_client.setex(cache_key, 86400, json.dumps(result))
        
        return jsonify({"all": result})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/query-ytd', methods=['POST'])
@traceable
async def query_ytd():
    print('Entering')
    # Get the JSON data from the incoming request
    data = request.get_json()
    print(data)
    # Check if the required field is present in the request body
    if not data or 'query' not in data:
        return jsonify({"error": "Missing query parameter"}), 400
    
    user_query = data['query']  # Extract the query from the request body
    
    cache_key = f"query_cache:ytd:{hash(user_query)}"
    
    try:
        # Check Redis cache
        cached_result = redis_client.get(cache_key)
        if cached_result:
            return jsonify({
                "ytd": json.loads(cached_result),
                "source": "cache"
            })
        
        # Execute NLP query using the user-provided query
        result = agent_executor.run(user_query)
        
        # Cache the result with a 5-minute expiration
        redis_client.setex(cache_key, 86400, json.dumps(result))
        
        return jsonify({"ytd": result})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Similar pattern for other endpoints...
@app.route('/query-qtd', methods=['POST'])
@traceable
async def query_qtd():
    # Get the JSON data from the incoming request
    data = request.get_json()

    # Check if the required field is present in the request body
    if not data or 'query' not in data:
        return jsonify({"error": "Missing query parameter"}), 400
    
    user_query = data['query']  # Extract the query from the request body
    
    cache_key = f"query_cache:qtd:{hash(user_query)}"
    
    try:
        cached_result = redis_client.get(cache_key)
        if cached_result:
            return jsonify({
                "qtd": json.loads(cached_result),
                "source": "cache"
            })
        
        # Use the user-provided query instead of the hardcoded one
        result = agent_executor.run(user_query)
        
        # Cache the result for future requests
        redis_client.setex(cache_key, 86400, json.dumps(result))
        
        return jsonify({"qtd": result})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/query-mtd', methods=['POST'])
@traceable
async def query_mtd():
    # Get the JSON data from the incoming request
    data = request.get_json()

    # Check if the required field is present in the request body
    if not data or 'query' not in data:
        return jsonify({"error": "Missing query parameter"}), 400
    
    user_query = data['query']  # Extract the query from the request body
    
    cache_key = f"query_cache:mtd:{hash(user_query)}"
    
    try:
        cached_result = redis_client.get(cache_key)
        if cached_result:
            return jsonify({
                "mtd": json.loads(cached_result),
                "source": "cache"
            })
        
        # Use the user-provided query instead of the hardcoded one
        result = agent_executor.run(user_query)
        
        # Cache the result for future requests
        redis_client.setex(cache_key, 86400, json.dumps(result))
        print(result)
        return jsonify({"mtd": result})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/query-non-performing', methods=['POST'])
@traceable
async def query_non_performing():
    # Get the JSON data from the incoming request
    data = request.get_json()

    # Check if the required field is present in the request body
    if not data or 'query' not in data:
        return jsonify({"error": "Missing query parameter"}), 400
    
    user_query = data['query']  # Extract the query from the request body
    
    cache_key = f"query_cache:non_performing:{hash(user_query)}"
    
    try:
        cached_result = redis_client.get(cache_key)
        if cached_result:
            return jsonify({
                "non_performing": json.loads(cached_result),
                "source": "cache"
            })
        
        # Use the user-provided query instead of the hardcoded one
        result = agent_executor.run(user_query)
        
        # Cache the result for future requests
        redis_client.setex(cache_key, 86400, json.dumps(result))
        
        return jsonify({"non_performing": result})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/getInsights', methods=['POST'])
@traceable
def get_insights():
    data = request.json.get('data', [])
    context = request.json.get('context', '')
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Use OpenAI to generate insights
    try:
        # Prepare data for insight generation
        data_summary = "\n".join([
            f"{idx+1}. {item['name']} (ID: {item['id']}): {item['performance']}%" 
            for idx, item in enumerate(data[:5])
        ])
        
        # Construct prompt for generating insights
        prompt = f"""
        Generate a concise insight about the performance of these top market indices based on the {context}.
        Data:\n{data_summary}
        
        Provide insights in less than 50 words. Focus on:
        - Overall performance trends
        - Standout indices
        - Any notable patterns or observations
        """
        
        response = client.chat.completions.create(
            model=OPENAI_API_DEPLOYMENT,
            messages=[
                {"role": "system", "content": "You are a financial analyst generating market performance insights.Provide in Bullet points.Make the content Bold and readable.Be accurate in providing insights."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500
        )
        
        insights = response.choices[0].message.content.strip()
        
        return jsonify({"insights": insights})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
if __name__ == '__main__':
    try:
        # Start the server
        print("Starting the server. Press Ctrl+C to stop.")
        app.run(host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"Error occurred: {e}")