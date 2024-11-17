from typing import Dict, Any
from langgraph.graph import StateGraph, END
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, AIMessage


# Define the state for the conversational graph
class ConversationState:
    def __init__(self):
        self.messages = []
        self.model_name = "deepseek-coder-v2"

    def add_message(self, message):
        self.messages.append(message)
        return self


# Create the Ollama chat node
def create_ollama_chat_node(model_name="deepseek-coder-v2"):
    # Initialize the Ollama chat model
    ollama_model = ChatOllama(model=model_name)

    def chat_node(state: ConversationState) -> Dict[str, Any]:
        # Get the last human message
        human_message = state.messages[-1]
        # Convert HumanMessage to string
        human_message_content = human_message.content if isinstance(human_message, HumanMessage) else str(human_message)
        # Generate AI response
        ai_response = ollama_model.invoke(human_message_content)
        # Update the state with the AI message
        new_state = state.add_message(ai_response)
        return {
            "messages": new_state.messages
        }

    chat_node = bind_tools(chat_node, tools=[tool_function])
    return chat_node


# Build the conversation graph
def build_conversation_graph():
    # Initialize the state graph
    graph_builder = StateGraph(ConversationState)
    # Add the Ollama chat node
    graph_builder.add_node("ollama_chat", create_ollama_chat_node())
    # Define the entry point
    graph_builder.set_entry_point("ollama_chat")
    # Set the end state
    graph_builder.add_edge("ollama_chat", END)
    # Compile the graph
    conversation_graph = graph_builder.compile()
    return conversation_graph


# Example usage
def main():
    # Build the conversation graph
    conversation_graph = build_conversation_graph()

    # Initial state
    initial_state = ConversationState()

    # Add a human message
    initial_state.add_message(HumanMessage(content="Tell me a joke about programming"))

    # Run the conversation
    result = conversation_graph.invoke(initial_state)

    # Print the conversation
    for message in result['messages']:
        if isinstance(message, HumanMessage):
            print(f"Human: {message.content}")
        elif isinstance(message, AIMessage):
            print(f"AI: {message.content}")


if __name__ == "__main__":
    main()