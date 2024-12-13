import os
import json
import uuid
import yaml
from typing import Dict, Any

from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI
from langchain_community.utilities import SQLDatabase
from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.memory import MemorySaver
from pydantic import BaseModel, Field
from redis import Redis
from flask import Flask, request, jsonify
from flask_cors import CORS
from langsmith import traceable

from langchain_core.prompts import (
    ChatPromptTemplate,
    FewShotPromptTemplate,
    PromptTemplate,
    SystemMessagePromptTemplate,
    MessagesPlaceholder
)
from langchain_community.vectorstores import FAISS
from langchain_core.example_selectors import SemanticSimilarityExampleSelector
from langchain_openai import OpenAIEmbeddings
from langchain_core.messages import HumanMessage
stateSaved = ''
# Load environment variables
load_dotenv()

class WorkflowState(BaseModel):
    """Represents the state of the NLP to SQL translation workflow."""
    original_query: str = Field(default="")
    table_column_info: str = Field(default="")
    performance_summary_type: str = Field(default="")
    prefix_suffix_details: str = Field(default="")  
    sql_query: str = Field(default="")
    error: str = Field(default="")
    is_performance_query: bool = Field(default=False)
    final_result: Dict[str, Any] = Field(default_factory=dict)

class NLPToSQLWorkflow:
    def __init__(self, config_path='config.yaml'):
        """
        Initialize the NLP to SQL workflow with configuration
        
        Args:
            config_path: Path to configuration YAML file
        """
        # Load configuration
        with open(config_path) as file:
            config = yaml.safe_load(file)
        
        # Azure OpenAI Configuration
        self.azure_config = config['storage']
        
        # Initialize Azure OpenAI Client
        self.llm = AzureChatOpenAI(
            azure_endpoint=self.azure_config['OPENAI_API_BASE'],
            openai_api_version=self.azure_config['OPENAI_API_VERSION'],
            deployment_name=self.azure_config['OPENAI_API_DEPLOYMENT'],
            openai_api_key=self.azure_config['OPENAI_API_KEY']
        )
        
        # Initialize SQL Database
        server = os.getenv("SQL_SERVER_HOST")
        database = os.getenv("SQL_SERVER_DB")
        username = os.getenv("SQL_SERVER_USER")
        password = os.getenv("SQL_SERVER_PASSWORD")
        
        sql_server_conn_str = (
            f"mssql+pyodbc://{username}:{password}@{server}/{database}"
            f"?driver=ODBC Driver 17 for SQL Server"
        )
        self.sql_db = SQLDatabase.from_uri(sql_server_conn_str)
        
        # Redis Configuration
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", 6379))
        redis_db = int(os.getenv("REDIS_DB", 0))
        self.redis_client = Redis(host=redis_host, port=redis_port, db=redis_db, decode_responses=True)
        
        # Prepare Few-Shot Learning Components
        self.prepare_few_shot_template()
    
    def prepare_few_shot_template(self):
        """Prepare the few-shot learning template."""
        # Define example queries and their corresponding SQL queries
        examples = [
            {
                "input": "What is the performance of US market indices for this quarter?", 
                "query": """
                DECLARE @qtdDate DATETIME = '2024-10-01'; 
                SELECT TOP 5 mi.MarketIndexName, v.EntityId AS MarketIndexId,
                EXP(SUM(CASE WHEN v.ValuationDate = EOMONTH(v.ValuationDate) THEN LOG(NULLIF(1 + v.Value / 100, 0)) END)) - 1 AS QTD_Performance 
                FROM AES_Mini.dbo.Valuations v JOIN AES_Mini.dbo.MarketIndex mi ON v.EntityId = mi.MarketIndexId 
                WHERE v.EntityTypeId = 3 AND v.ValuationDate >= @qtdDate AND v.FrequencyId = 3 
                GROUP BY mi.MarketIndexName, v.EntityId 
                ORDER BY QTD_Performance DESC;
                """
            },
            {
                "input": "Show me top 5 asset performances for the month",
                "query": """
                DECLARE @mtdDate DATETIME = '2024-10-01'; 
                SELECT TOP 5 mi.FundName, mi.MarketIndexId,
                EXP(SUM(CASE WHEN v.ValuationDate = EOMONTH(v.ValuationDate) THEN LOG(NULLIF(1 + v.Value / 100, 0)) END)) - 1 AS MTD_Performance 
                FROM AES_Mini.dbo.Valuations v JOIN AES_Mini.dbo.MarketIndex mi ON v.EntityId = mi.MarketIndexId 
                WHERE v.EntityTypeId = 1 AND v.ValuationDate >= @mtdDate AND v.FrequencyId = 3 
                GROUP BY mi.FundName, mi.MarketIndexId
                ORDER BY MTD_Performance DESC;
                """
            }
        ]

        # System prefix and suffix 
        system_prefix = """You are an AI agent designed to interact with a SQL database to answer questions by querying specific tables and columns.

        Query Generation Guidelines:
        1. Query Structure:
        - Select only relevant columns
        - Limit to top N records requested from User
        - Avoid DML statements (INSERT, UPDATE, DELETE)

        2. Performance Summary Rules:
        - Use MTD, QTD, YTD calculations
        - Entity Types: 3 for Market Index, 1 for Assets
        - Use logarithmic calculations for percentage performance
        - Ensure date-based filtering

        3. Valid Queries and Relations for JOIN , shared below 

        """

        system_suffix = """
        Answer Guidelines:
        1. Summarize information concisely
        2. Provide context if needed
        3. Include expert comparative analysis
        4. Ensure accuracy and relevance
        """

        # Create example selector
        example_selector = SemanticSimilarityExampleSelector.from_examples(
            examples,
            OpenAIEmbeddings(),
            FAISS,
            k=2,
            input_keys=["input"]
        )

        # Create few-shot prompt template
        self.few_shot_prompt = FewShotPromptTemplate(
            example_selector=example_selector,
            example_prompt=PromptTemplate.from_template(
                "User input: {input}\nSQL query: {query}"
            ),
            input_variables=["input", "table_column_info"],
            prefix=system_prefix,
            suffix=system_suffix
        )
    
    def load_table_column_descriptions(self):
        """Load table and column descriptions from file."""
        with open('table_column_description.txt', 'r') as file:
            return file.read()
    
    def decide_table_column(self, state: WorkflowState) -> WorkflowState:
        """Decide which tables and columns will answer the query."""
        table_descriptions = self.load_table_column_descriptions()
        
        template = f"""
        Analyze the user query: "{state.original_query}"
        Identify relevant tables and columns to answer the query.
        Describe potential JOIN requirements.
        
        Available Table Descriptions:
        {table_descriptions}
        """
        
        prompt_template = ChatPromptTemplate.from_template(template)
        prompt = prompt_template.invoke({"query": state.original_query})
        result = self.llm.invoke(prompt)
        
        state.table_column_info = result.content
        return state
    
    def check_performance_query(self, state: WorkflowState) -> WorkflowState:
        """Check if the query is a performance-related query."""
        # List of keywords that indicate a performance-related query
        performance_keywords = [
            'performance', 'perform', 'return', 'returns', 
            'gain', 'growth', 'yield', 'ROI', 
            'quarter performance', 'monthly performance',
            'year-to-date', 'month-to-date', 'quarter-to-date'
        ]
        
        # Convert query to lowercase for case-insensitive matching
        lowercase_query = state.original_query.lower()
        
        # Check if any performance keyword is in the query
        state.is_performance_query = any(
            keyword in lowercase_query for keyword in performance_keywords
        )
        
        return state
    
    def performance_summary_strategy(self, state: WorkflowState) -> WorkflowState:
        """Determine the performance summary query strategy."""
        if not state.is_performance_query:
            # If not a performance query, return without further processing
            return state
        
        template = f"""
        Analyze the performance query: "{state.original_query}"
        Determine the appropriate performance summary type:
        - MTD (Month to Date)
        - QTD (Quarter to Date)
        - YTD (Year to Date)
        
        Identify:
        - Entity Type (Market Index, Asset, etc.)
        - Specific performance calculation method
        """
        
        prompt_template = ChatPromptTemplate.from_template(template)
        prompt = prompt_template.invoke({"query": state.original_query})
        result = self.llm.invoke(prompt)
        
        state.performance_summary_type = result.content
        return state
    @traceable
    def generate_sql_query(self, state: WorkflowState) -> WorkflowState:
        """You are an AI agent designed to interact with a SQL database to answer questions by querying specific tables and columns based on the provided schema information.

Given an input question, construct a syntactically correct SQL query based on the table and column descriptions. Retrieve the necessary information from the tables to provide an accurate answer. Ensure that the query is contextually relevant to the input question and adheres to the following guidelines:

1. Query Structure:
   - Avoid selecting all columns; only include relevant columns based on the question.
   - If Top 10,20 , N is mentioned query for Performance query , Fetch Top 10,Top 20 , Top N for each MTD (Month to Date), QTD(Quarter to Date) and YTD(Year to date) 
   - Postivie values need not have '+' sign , Only '-' symbol is mandatory to denote negative values.
   - if Top N Limit is not mentioned in query , the results can be restricted to  Top 10 records.
   - Ensure that your queries do not contain DML statements (such as `INSERT`, `UPDATE`, `DELETE`, or `DROP`).
   
2. Error Handling:
   - Double-check the query syntax before execution.
   - If an error occurs during execution, rewrite the query based on error feedback and try again.

3. Question Types:
   - Any question related to 'Performance Summary' comes in, in response data of MTD (Month to Date), QTD(Quarter to Date) and YTD(Year to date) is expected. 3 different queries should be created for MTD, QTD and YTD.
   - MTD stands for “month to date.” It’s the period starting from the beginning of the current month up until now and similarly for QTD and YTD
   MTD (Month to Date): Period from the first day of the current month (October 1st, 2024) up to the specific date (October 31st, 2024)
   - QTD (Quarter to Date): Period from the first day of the current quarter (October 1st, 2024) up to the specific date (October 31st, 2024)
   - YTD (Year to Date): Period from the first day of the current year (January 1st, 2024) up to the specific date (October 31st, 2024)
   - The above MTD,QTD and YTD date are valid as of today , So compute the dates according to the date requested in query or based on the current date always , if no date is specified.
   - Performance Summary can be for Index, Asset or any other Entity Type(Table= EntityType, Column=EntityTypeId, EntityTypeName)
   - Possible SQL query for Index Performance Summary is:
   "DECLARE @mtdDate DATETIME = '2024-10-01'; 
    SELECT TOP 5 mi.MarketIndexName, mi.MarketIndexId,
    EXP(SUM(CASE WHEN v.ValuationDate = EOMONTH(v.ValuationDate) THEN LOG(NULLIF(1 + v.Value / 100, 0)) END)) - 1 AS MTD_Performance 
    FROM AES_Mini.dbo.Valuations v JOIN AES_Mini.dbo.MarketIndex mi ON v.EntityId = mi.MarketIndexId WHERE v.EntityTypeId = 3 AND v.ValuationDate >= @mtdDate AND v.FrequencyId = 3 
    GROUP BY mi.MarketIndexName,  mi.MarketIndexId
    ORDER BY MTD_Performance DESC OPTION (MAXDOP 0);
   "
   - If user is interested in Asset Performance Summary, then EntityTypeId will change to 1
   - Similarly for MTD (Month to Date), QTD(Quarter to Date) and YTD(Year to date) ,  FrequencyId will remain same. FrequencyId will be 3.

   4. Response Format : 
    - Maintain consistent Mark down syntax format for output response for all performance queries. 
    - This output format should be consistent.Provded below with example for structure.
    - Example : This is for you to understand and maintain this format where you will have the string describing the query and the "Here are the Top N Index performance summaries as of October 31, 2024, broken down into Month to Date (MTD), Quarter to Date (QTD), and Year to Date (YTD):

Here are some example user inputs and their corresponding SQL queries:
Here are the Top 10 Index performance summaries as of October 31, 2024, broken down into Month to Date (MTD), Quarter to Date (QTD), and Year to Date (YTD):
### Month to Date (MTD) Performance
1. **CBOE Volatility Index - VIX** (ID: 5) - **Performance: 21.52%**
2. **Alerian Midstream Energy North America Total Return Index** (ID: 29512) - **Performance: 5.71%**
3. **S&P 500 Information Technology (TR)** (ID: 28729) - **Performance: 3.01%**
4. **S&P 500 Financials (TR)** (ID: 28315) - **Performance: 2.95%**
5. **Russell Midcap Growth Index (TR)** (ID: 29682) - **Performance: 2.94%**

### Quarter to Date (QTD) Performance
1. **CBOE Volatility Index - VIX** (ID: 5) - **Performance: 21.52%**
2. **Alerian Midstream Energy North America Total Return Index** (ID: 29512) - **Performance: 5.71%**
3. **S&P 500 Information Technology (TR)** (ID: 28729) - **Performance: 3.01%**
4. **S&P 500 Financials (TR)** (ID: 28315) - **Performance: 2.95%**
5. **Russell Midcap Growth Index (TR)** (ID: 29682) - **Performance: 2.94%**

### Year to Date (YTD) Performance
1. **CBOE Volatility Index - VIX** (ID: 5) - **Performance: 63.29%**
2. **Alerian Midstream Energy North America Total Return Index** (ID: 29512) - **Performance: 34.63%**
3. **S&P 500 Information Technology (TR)** (ID: 28729) - **Performance: 34.22%**
4. **S&P 1500 Information Technology Index (TR)** (ID: 27690) - **Performance: 33.54%**
5. **S&P 500 Communication Services & Information Technology Index (TR)** (ID: 29480) - **Performance: 33.11%**
- Follow this output format for all performance queries. Ensure that the data is accurate and the format is consistent across all responses.
These performance metrics indicate how well these indices have performed over the specified periods. If you need further details or analysis, feel free to ask!"""
        # If it's not a performance query, skip the performance-specific query generation
        if not state.is_performance_query:
            return state
        
        # Sanitize the original query to prevent potential SQL injection
        sanitized_query = state.original_query.replace("'", "''")
    
         # Additional query validation
        prohibited_keywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE']
        if any(keyword in sanitized_query.upper() for keyword in prohibited_keywords):
            state.error = "Potentially dangerous query detected"
            return state
        
        # Prepare few-shot prompt
        few_shot_prompt = self.few_shot_prompt.format(
            input=state.original_query,
            table_column_info=state.table_column_info
        )
        
        # Create comprehensive prompt template
        full_prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(few_shot_prompt),
            HumanMessage(content=state.original_query),
            MessagesPlaceholder(variable_name="context")
        ])
        
        # Prepare context with additional details
        context = [
            HumanMessage(content=f"Table Column Info: {state.table_column_info}"),
            HumanMessage(content=f"Performance Summary Type: {state.performance_summary_type}")
        ]
        
        # Invoke the prompt
        prompt = full_prompt.invoke({
            "input": state.original_query,
            "context": context
        })
        
        # Generate SQL query
        result = self.llm.invoke(prompt)
        state.sql_query = result.content
        
        return state
    @traceable
    def execute_sql_query(self, state: WorkflowState) -> WorkflowState:
        """Execute the generated SQL query with caching."""
        # If it's not a performance query or no SQL query was generated, skip execution
        if not state.is_performance_query or not state.sql_query:
            return state
        
        try:
            # Check Redis cache first
            cache_key = f"query_cache:{hash(state.original_query)}"
            cached_result = self.redis_client.get(cache_key)
            print(f"cached_result: {cached_result}")
            
            if cached_result:
                state.final_result = json.loads(cached_result)
                return state
            
            # Execute query
            result = self.sql_db.run(state.sql_query)
            print(f"result: {result}")
            state.final_result = result
            
            # Cache result for 5 minutes
            self.redis_client.setex(cache_key, 300, json.dumps(result))
            
        except Exception as e:
            state.error = f"Unexpected Error: {str(e)}"
            print(f"Unexpected Error: {e}")
        
        return state
    
    def format_performance_result(self, state: WorkflowState) -> WorkflowState:
        """Format the performance result with expert analysis."""
        # If it's not a performance query or there's an error, skip formatting
        if not state.is_performance_query or state.error:
            return state
        
        # Add expert analysis generation
        analysis_template = f"""
        Provide an expert analysis of the performance results:
        Query: {state.original_query}
        Results: {json.dumps(state.final_result, indent=2)}
        
        Generate insights focusing on:
        - Comparative performance
        - Key trends
        - Potential implications
        """
        
        prompt_template = ChatPromptTemplate.from_template(analysis_template)
        prompt = prompt_template.invoke({
            "query": state.original_query,
            "results": state.final_result
        })
        
        expert_analysis = self.llm.invoke(prompt)
        
        # Format result with analysis
        state.final_result = {
            "raw_data": state.final_result,
            "expert_analysis": expert_analysis.content
        }
        
        return state
    @traceable
    def build_workflow(self):
        global stateSaved
        """Build the LangGraph workflow."""
        workflow = StateGraph(WorkflowState)
        
        # Add nodes
        workflow.add_node("decide_tables", self.decide_table_column)
        workflow.add_node("check_performance", self.check_performance_query)
        workflow.add_node("performance_strategy", self.performance_summary_strategy)
        workflow.add_node("generate_query", self.generate_sql_query)
        workflow.add_node("execute_query", self.execute_sql_query)
        workflow.add_node("format_result", self.format_performance_result)
        
        # Define workflow edges
        workflow.add_edge(START, "decide_tables")
        workflow.add_edge("decide_tables", "check_performance")
        
        # Conditional routing for performance queries
        workflow.add_conditional_edges(
            "check_performance",
            lambda state: "performance" if state.is_performance_query else "end",
            {
                "performance": "performance_strategy",
                "end": END
            }
        )
        
        workflow.add_edge("performance_strategy", "generate_query")
        workflow.add_edge("generate_query", "execute_query")
        workflow.add_edge("execute_query", "format_result")
        workflow.add_edge("format_result", END)
        
        stateSaved = workflow.compile(checkpointer=MemorySaver())
        return stateSaved
    
    from IPython.display import Image, display
    try:
        display(Image(stateSaved.get_graph().draw_mermaid_png()))
    except Exception:
        # This requires some extra dependencies and is optional
        pass
    
    def run_workflow(self, query: str):
        """Run the entire NLP to SQL translation workflow."""
        workflow = self.build_workflow()
        
        config = {
            "configurable": {
                "thread_id": str(uuid.uuid4()),
                "checkpoint_ns": "nlp_to_sql_workflow",
                "checkpoint_id": f"query_{hash(query)}"
            }
        }
        
        initial_state = WorkflowState(original_query=query)
        result = workflow.invoke(initial_state, config)
        print(f"Final Result: {result}")
        return result.final_result if hasattr(result, 'final_result') else {}

# Flask Application Setup
app = Flask(__name__)
CORS(app)

nlp_to_sql_workflow = NLPToSQLWorkflow()

@app.route('/query', methods=['POST'])
@traceable
def query_database():
    data = request.json
    query = data.get('query')
    
    if not query:
        return jsonify({"error": "No query provided"}), 400
    
    try:
        result = nlp_to_sql_workflow.run_workflow(query)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500  

if __name__ == '__main__':
    app.run(debug=True)