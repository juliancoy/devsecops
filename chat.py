from langchain_core.language_models import LanguageModelInput
from langchain_core.messages import BaseMessage
from langchain_core.runnables import Runnable

from state import State

class Chatbot:
    def __init__(self, blm: Runnable[LanguageModelInput, BaseMessage]):
        self.blm = blm

    def process_state(self, state: State):
        return {"messages": [self.blm.invoke(state["messages"])]}
