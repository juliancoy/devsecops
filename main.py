import os

from langchain_anthropic import ChatAnthropic
from langgraph.constants import START, END
from langgraph.graph import StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver
import search
from chat import Chatbot
from state import State, route_tools


def stream_graph_updates(u_input: str):
    for event in graph.stream({"messages": [("user", u_input)]}):
        for value in event.values():
            print("Assistant:", value["messages"][-1].content)

def load_env(file_path=".env"):
    with open(file_path, "r") as file:
        for line in file:
            # Remove any leading/trailing whitespace
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith("#"):
                continue
            # Split the line into key and value
            key, value = line.split('=', 1)
            # Remove any leading/trailing whitespace around the key and value
            key = key.strip()
            value = value.strip()
            # Set the environment variable
            os.environ[key] = value

if __name__ == "__main__":
    load_env()
    api_key: str = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        raise RuntimeError("The ANTHROPIC_API_KEY environment variable is not set.")
    graph_builder = StateGraph(State)
    # chat
    anthro = ChatAnthropic(model="claude-3-5-haiku-20241022")
    chatLlm = anthro.bind_tools([search.ddg])
    # memory
    memory = MemorySaver()
    # node
    cb = Chatbot(chatLlm)
    graph_builder.add_node("chatbot", cb.process_state)
    tool_node = ToolNode(tools=[search.ddg])
    graph_builder.add_node("tools", tool_node)
    graph_builder.add_conditional_edges(
        "chatbot",
        route_tools,
        # The following dictionary lets you tell the graph to interpret the condition's outputs as a specific node
        # It defaults to the identity function, but if you
        # want to use a node named something else apart from "tools",
        # You can update the value of the dictionary to something else
        # e.g., "tools": "my_tools"
        {"tools": "tools", END: END},
    )
    # Any time a tool is called, we return to the chatbot to decide the next step
    graph_builder.add_edge("tools", "chatbot")
    graph_builder.add_edge(START, "chatbot")
    graph = graph_builder.compile()
    while True:
        try:
            user_input = input("User: ")
            if user_input.lower() in ["quit", "exit", "q"]:
                print("Goodbye!")
                break

            stream_graph_updates(user_input)
        except:
            # fallback if input() is not available, debugger case
            user_input = "What do you know about LangGraph?"
            print("User: " + user_input)
            stream_graph_updates(user_input)
            break


