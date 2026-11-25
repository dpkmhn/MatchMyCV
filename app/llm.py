from functools import lru_cache
from typing import Literal

from langchain_core.language_models import BaseChatModel
from langchain_core.runnables import Runnable

from app.config import get_settings

Size = Literal["small", "large"]


@lru_cache
def get_chat_model(size: Size) -> BaseChatModel:
    """Groq chat model through LangChain. Tests replace `structured` with a fake."""
    from langchain_groq import ChatGroq

    settings = get_settings()
    if settings.missing_keys():
        raise RuntimeError("GROQ_API_KEY is not set. Copy .env.example to .env and add it.")
    model = settings.groq_model_large if size == "large" else settings.groq_model_small
    # max_tokens must be explicit: without it Groq shrinks the completion limit to whatever is
    # left of the per-minute token budget and long outputs get cut off.
    return ChatGroq(
        model=model,
        api_key=settings.groq_api_key,
        temperature=0.1 if size == "small" else 0.3,
        max_tokens=4000 if size == "small" else 8000,
        max_retries=4,
        timeout=90,
    )


def _is_gpt_oss(size: Size) -> bool:
    settings = get_settings()
    name = settings.groq_model_large if size == "large" else settings.groq_model_small
    return name.startswith("openai/gpt-oss")


def structured(schema: type, size: Size = "large") -> Runnable:
    """A runnable that returns a validated instance of the Pydantic `schema`."""
    # gpt-oss can emit broken tool-call JSON on long outputs; Groq's strict JSON-schema mode
    # constrains decoding to the schema instead. Other models use tool calling.
    kwargs = {"method": "json_schema", "strict": True} if _is_gpt_oss(size) else {}
    model = get_chat_model(size)
    if _is_gpt_oss(size):
        model = model.bind(reasoning_effort="medium" if size == "large" else "low")
    runnable = model.with_structured_output(schema, **kwargs)
    # One retry for the occasional malformed generation that fails Pydantic validation.
    return runnable.with_retry(stop_after_attempt=2)
