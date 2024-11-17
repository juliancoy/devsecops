import os
from enum import Enum
from typing import TypedDict, Annotated, List
from uuid import uuid4

from langchain.agents import Tool, AgentExecutor
from langchain.agents import create_openai_tools_agent
from langchain_anthropic import ChatAnthropic
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.language_models import BaseLanguageModel
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import START, END
from langgraph.graph import StateGraph, add_messages
from langgraph.prebuilt import ToolNode
from langgraph.store.memory import InMemoryStore


class QueryType(Enum):
    CODE = "code"
    CHAT_MISTRAL = "chat_mistral"
    CHAT_HAIKU = "chat_haiku"
    TOOLS = "tools"
    END = "end"


class State(TypedDict):
    messages: Annotated[list, add_messages]
    query_type: str


def create_agent_executor(llm: BaseLanguageModel, toollist: List[Tool], system_prompt: str) -> AgentExecutor:
    """Create an agent executor with the given LLM and tools."""
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
        ("human", "{input}")
    ])

    agent = create_openai_tools_agent(llm, tools, prompt)

    return AgentExecutor.from_agent_and_tools(
        agent=agent,
        tools=toollist,
        handle_parsing_errors=True,
        max_iterations=3,
        verbose=True
    )


def detect_query_type(state: State) -> str:
    """
    Route messages based on content type.
    """
    if isinstance(state, list):
        messages = state
    else:
        messages = state.get("messages", [])

    if not messages:
        return QueryType.CHAT_MISTRAL.value

    last_message = messages[-1]
    if isinstance(last_message, tuple):
        content = last_message[1]
    elif isinstance(last_message, HumanMessage):
        content = last_message.content
    else:
        if hasattr(last_message, "tool_calls") and len(last_message.tool_calls) > 0:
            return QueryType.TOOLS.value
        return QueryType.END.value

    content = content.lower()

    code_keywords = [
        "code", "function", "programming", "debug", "error",
        "python", "javascript", "java", "cpp", "c++",
        "algorithm", "compile", "syntax", "git", "github"
    ]

    if any(keyword in content for keyword in code_keywords):
        return QueryType.CODE.value

    # Alternate between models based on message count
    message_count = len([m for m in messages if isinstance(m, (tuple, HumanMessage))])
    return QueryType.CHAT_HAIKU.value if message_count % 2 == 0 else QueryType.CHAT_MISTRAL.value


class CodeNode:
    """Node specifically for handling code-related queries with Deepseek."""

    def __init__(self, llm: ChatOllama):
        self.llm = llm

    def process_state(self, state: State) -> dict:
        """Process code-related queries directly with Deepseek."""
        try:
            last_message = state["messages"][-1]
            if isinstance(last_message, tuple):
                content = last_message[1]
            else:
                content = last_message.content

            messages = [
                SystemMessage(
                    content="You are a code-focused AI assistant. Provide clean, well-documented code and clear explanations."),
                HumanMessage(content=content)
            ]

            response = self.llm.invoke(messages)
            return {"messages": [response]}
        except Exception as ex:
            print(f"Error in CodeNode processing: {str(ex)}")
            return {"messages": [AIMessage(
                content="I encountered an error processing your code request. Could you please rephrase or try again?")]}


class ChatNode:
    """Node for handling chat queries with tools."""

    def __init__(self, agent: AgentExecutor):
        self.agent = agent

    def process_state(self, state: State) -> dict:
        """Process chat queries using the agent executor."""
        try:
            last_message = state["messages"][-1]
            if isinstance(last_message, tuple):
                content = last_message[1]
            else:
                content = last_message.content

            response = self.agent.invoke({"input": content})
            return {"messages": [AIMessage(content=response["output"])]}
        except Exception as ex:
            print(f"Error in ChatNode processing: {str(ex)}")
            return {"messages": [AIMessage(
                content="I encountered an error processing your request. Could you please rephrase or try again?")]}


def stream_graph_updates(u_input: str):
    """Stream graph updates with proper checkpointing configuration."""
    try:
        # Initial state
        initial_state = {
            "messages": [("user", u_input)],
            "query_type": "",
        }

        config = {
            "configurable": {
                "thread_id": str(uuid4()),
                "checkpoint_ns": "chat_interaction"
            }
        }

        for event in graph.stream(initial_state, config=config):
            for value in event.values():
                if "messages" in value:
                    if isinstance(value["messages"][-1], (HumanMessage, SystemMessage)):
                        print("Assistant:", value["messages"][-1].content)
                    elif isinstance(value["messages"][-1], tuple):
                        print("Assistant:", value["messages"][-1][1])
                    else:
                        print("Assistant:", value["messages"][-1])
    except Exception as ex:
        print(f"Error in stream_graph_updates: {str(ex)}")

def load_env(file_path=".env"):
    with open(file_path, "r") as file:
        for line in file:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

if __name__ == "__main__":
    load_env()

    # Initialize models
    api_key: str = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        raise RuntimeError("The ANTHROPIC_API_KEY environment variable is not set.")

    # Initialize LLMs
    haiku = ChatAnthropic(model="claude-3-5-haiku-20241022")
    mistral = ChatOllama(model="mistral")
    deepseek = ChatOllama(model="deepseek-coder-v2")

    # Initialize tools
    ddg = DuckDuckGoSearchRun()
    search_tool = Tool(
        name="search",
        func=ddg.run,
        description="Useful for searching the internet for current information."
    )
    tools = [search_tool]

    # Create agent executors with specific prompts
    haiku_prompt = """You are a helpful AI assistant using Claude Haiku. 
    Use the available tools when needed to provide accurate and up-to-date information.
    Always respond in a clear and concise manner."""

    mistral_prompt = """You are a helpful AI assistant using Mistral. 
    Use the available tools when needed to provide accurate and up-to-date information.
    Always respond in a clear and concise manner."""

    deepseek_prompt = """You are a code-focused AI assistant using Deepseek Coder.
    Analyze code, fix bugs, and provide programming assistance. Use tools when needed.
    Always respond with clean, well-documented code and clear explanations."""

    # Create agents with simplified prompts
    haiku_agent = create_agent_executor(haiku, tools, haiku_prompt)
    mistral_agent = create_agent_executor(mistral, tools, mistral_prompt)

    # Create nodes
    haiku_node = ChatNode(haiku_agent)
    mistral_node = ChatNode(mistral_agent)
    deepseek_node = CodeNode(deepseek)
    tool_node = ToolNode(tools=tools)

    # Build graph
    graph_builder = StateGraph(State)

    # Add nodes
    graph_builder.add_node("haiku", haiku_node.process_state)
    graph_builder.add_node("mistral", mistral_node.process_state)
    graph_builder.add_node("deepseek", deepseek_node.process_state)
    graph_builder.add_node("tools", tool_node)

    # Add conditional edges from START
    graph_builder.add_conditional_edges(
        START,
        detect_query_type,
        {
            QueryType.CODE.value: "deepseek",
            QueryType.CHAT_MISTRAL.value: "mistral",
            QueryType.CHAT_HAIKU.value: "haiku",
            QueryType.TOOLS.value: "tools",
            QueryType.END.value: END
        }
    )

    # Add edges from each LLM node
    for node in ["haiku", "mistral", "deepseek"]:
        graph_builder.add_conditional_edges(
            node,
            detect_query_type,
            {
                QueryType.CODE.value: "deepseek",
                QueryType.CHAT_MISTRAL.value: "mistral",
                QueryType.CHAT_HAIKU.value: "haiku",
                QueryType.TOOLS.value: "tools",
                QueryType.END.value: END
            }
        )

    # Tools edge
    graph_builder.add_conditional_edges(
        "tools",
        detect_query_type,
        {
            QueryType.CODE.value: "deepseek",
            QueryType.CHAT_MISTRAL.value: "mistral",
            QueryType.CHAT_HAIKU.value: "haiku",
            QueryType.TOOLS.value: "tools",
            QueryType.END.value: END
        }
    )
    checkpointer = MemorySaver()
    kvstore = InMemoryStore()
    # Compile graph
    graph = graph_builder.compile(
        checkpointer=checkpointer,
        store=kvstore
    )
    # graph = graph_builder.compile()

    print("Multi-LLM chat system initialized. Type 'quit' to exit.")

    # Run interactive loop
    while True:
        try:
            user_input = input("User: ")
            if user_input.lower() in ["quit", "exit", "q"]:
                print("Goodbye!")
                break

            stream_graph_updates(user_input)
        except Exception as e:
            print(f"An error occurred: {e}")
            print(f"Error details: {str(e)}")
            break