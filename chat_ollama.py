from typing import Dict, Any, List, Optional, Union, Sequence, Callable
from langchain_ollama import ChatOllama as LangChainChatOllama
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain.tools import BaseTool, StructuredTool
from langchain.agents import initialize_agent, AgentType, AgentExecutor
from langchain.agents.structured_chat.base import StructuredChatAgent
from langchain.memory import ConversationBufferMemory
from langchain.schema import OutputParserException
from pydantic import BaseModel, Field
from dataclasses import dataclass
import asyncio


@dataclass
class CustomTool:
    """Simple tool implementation for direct function execution."""
    name: str
    description: str
    func: Callable
    handle_errors: bool = True

    def invoke(self, input_text: str) -> str:
        """Execute the tool function with error handling."""
        try:
            return str(self.func(input_text))
        except Exception as e:
            if self.handle_errors:
                return f"Error executing {self.name}: {str(e)}"
            raise


class ChatOllama:
    def __init__(
            self,
            model_name: str = "deepseek-coder-v2",
            tools: Optional[Sequence[Union[BaseTool, CustomTool]]] = None,
            verbose: bool = False
    ):
        """
        Initialize ChatOllama with specified model and tools.

        Args:
            model_name (str): Name of the Ollama model to use
            tools (Sequence[Union[BaseTool, CustomTool]], optional): List of tools
            verbose (bool): Whether to enable verbose output
        """
        self.model_name = model_name
        self.tools = list(tools) if tools else []
        self.verbose = verbose
        self.chat_model = LangChainChatOllama(model=model_name)
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )

        # Separate tools by type
        self.custom_tools = [t for t in self.tools if isinstance(t, CustomTool)]
        self.base_tools = [t for t in self.tools if isinstance(t, BaseTool)]

        # Initialize agent only if we have BaseTools
        self.agent = self._initialize_agent() if self.base_tools else None

    def _initialize_agent(self) -> AgentExecutor:
        """Initialize the LangChain agent with BaseTool instances."""
        agent = StructuredChatAgent.from_llm_and_tools(
            llm=self.chat_model,
            tools=self.base_tools,
            verbose=self.verbose
        )

        return AgentExecutor.from_agent_and_tools(
            agent=agent,
            tools=self.base_tools,
            memory=self.memory,
            verbose=self.verbose,
            handle_parsing_errors=True,
            max_iterations=3
        )

    async def _execute_custom_tools(self, message: str) -> List[str]:
        """Execute all custom tools in parallel."""

        async def execute_tool(tool: CustomTool) -> str:
            try:
                return await asyncio.get_event_loop().run_in_executor(
                    None, tool.invoke, message
                )
            except Exception as e:
                if self.verbose:
                    print(f"Tool error: {str(e)}")
                return f"Error executing {tool.name}: {str(e)}"

        tasks = [execute_tool(tool) for tool in self.custom_tools]
        results = await asyncio.gather(*tasks)
        return [r for r in results if r]

    def _handle_agent_error(self, error: Exception, message: str) -> str:
        """Handle agent errors gracefully."""
        if isinstance(error, OutputParserException):
            # If it's a parsing error, try to use the base chat model
            try:
                ai_response = self.chat_model.invoke(message)
                return ai_response.content if isinstance(ai_response, AIMessage) else str(ai_response)
            except Exception as e:
                return f"Error: Unable to process the request. {str(e)}"
        return f"Error: {str(error)}"

    def chat(self, message: str) -> Dict[str, str]:
        """
        Single-turn chat interface.

        Args:
            message (str): Human message

        Returns:
            Dict[str, str]: Response from the assistant
        """
        responses = []

        # Process custom tools if any exist
        if self.custom_tools:
            try:
                # Run custom tools in parallel using asyncio
                tool_responses = asyncio.run(self._execute_custom_tools(message))
                responses.extend(tool_responses)
            except Exception as e:
                if self.verbose:
                    print(f"Custom tools error: {str(e)}")
                responses.append(f"Error executing custom tools: {str(e)}")

        # Process agent with BaseTools if it exists
        if self.agent:
            try:
                agent_response = self.agent.invoke({
                    "input": message
                })
                responses.append(agent_response["output"])
            except Exception as e:
                if self.verbose:
                    print(f"Agent error: {str(e)}")
                responses.append(self._handle_agent_error(e, message))

        # If no tools/agents processed the message, use base chat model
        if not responses:
            ai_response = self.chat_model.invoke(message)
            responses.append(ai_response.content if isinstance(ai_response, AIMessage)
                             else str(ai_response))

        return {
            "role": "assistant",
            "content": "\n".join(filter(None, responses))
        }

    def reset_conversation(self):
        """Reset the conversation memory."""
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )
        if self.agent:
            self.agent = self._initialize_agent()


# Example usage
def main():
    # Define the calculator tool's input schema
    class CalculatorInput(BaseModel):
        expression: str = Field(
            ...,
            description="The mathematical expression to evaluate"
        )

    # Create the calculator function
    def calculate(expression: str) -> str:
        try:
            return str(eval(expression))
        except Exception as e:
            return f"Error: {str(e)}"

    # Create the calculator tool with proper schema
    calculator_tool = StructuredTool.from_function(
        name="calculator",
        description="Useful for performing basic math operations. Input should be a mathematical expression like '2 + 2' or '3 * 4'.",
        func=calculate,
        args_schema=CalculatorInput
    )

    # Example 2: Custom Tool
    def weather_lookup(input_text: str) -> str:
        # Simple example that extracts city name and returns weather
        return f"Weather information for input '{input_text}': Sunny, 72°F"

    weather_tool = CustomTool(
        name="weather",
        description="Look up weather information",
        func=weather_lookup,
        handle_errors=True
    )

    # Initialize ChatOllama with both types of tools
    chat = ChatOllama(
        model_name="deepseek-coder-v2",
        tools=[calculator_tool, weather_tool],
        verbose=True
    )

    # Example conversation
    queries = [
        "What is 2 + 2?",
        "What's the weather in New York?",
        "Can you multiply 4 by 3?"
    ]

    for query in queries:
        print(f"\nHuman: {query}")
        response = chat.chat(query)
        print(f"Assistant: {response['content']}")

    # Reset the conversation
    chat.reset_conversation()


if __name__ == "__main__":
    main()