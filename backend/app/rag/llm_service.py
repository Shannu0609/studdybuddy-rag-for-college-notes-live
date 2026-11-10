import logging
import time
from typing import Sequence

from google import genai
from google.genai import types

from app.config import get_settings
from app.rag.vector_store import RetrievedChunk

logger = logging.getLogger(__name__)

FALLBACK_MODELS = (
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
)


class LLMConfigurationError(Exception):
    """Raised when GEMINI_API_KEY is missing or invalid."""


class LLMGenerationError(Exception):
    """Raised when the Gemini API request fails."""


def _is_placeholder_key(api_key: str) -> bool:
    cleaned = api_key.strip()
    return not cleaned or cleaned in {
        "your_gemini_api_key_here",
        "your-gemini-api-key",
        "REPLACE_ME",
    }


def _build_context_block(chunks: Sequence[RetrievedChunk]) -> str:
    blocks = []
    for idx, chunk in enumerate(chunks, start=1):
        blocks.append(
            f"[Source {idx} | Document: {chunk.document_name} | Page: {chunk.page_number} | Relevance: {chunk.similarity_score:.2f}]\n"
            f"{chunk.content}"
        )
    return "\n\n---\n\n".join(blocks)


def _build_history_block(history: Sequence[tuple[str, str]]) -> str:
    if not history:
        return "None"
    lines = []
    for role, content in history[-6:]:
        speaker = "Student" if role == "user" else "Study Buddy AI"
        trimmed = content[:600] + ("..." if len(content) > 600 else "")
        lines.append(f"{speaker}: {trimmed}")
    return "\n".join(lines)


def _is_transient_or_unavailable(error_text: str) -> bool:
    upper = error_text.upper()
    return any(
        token in upper
        for token in (
            "503",
            "504",
            "DEADLINE_EXCEEDED",
            "TIMEOUT",
            "UNAVAILABLE",
            "429",
            "RESOURCE_EXHAUSTED",
            "404",
            "NOT_FOUND",
        )
    )


class GeminiLLMService:
    """Google Gemini answer generator strictly grounded in retrieved note chunks."""

    SYSTEM_INSTRUCTION = (
        "You are Study Buddy AI, a precise academic study assistant for college students.\n"
        "Strict grounding rules:\n"
        "1. Answer ONLY using the facts, definitions, formulas, and explanations present in the provided 'RETRIEVED STUDY NOTES' context.\n"
        "2. Do NOT use outside knowledge or invent information not present in the retrieved excerpts.\n"
        "3. If multiple documents appear in context and some are administrative forms or cover pages while others contain relevant academic material, focus on and cite the relevant study notes.\n"
        "4. If NONE of the retrieved excerpts contain relevant information to answer the question, respond clearly with:\n"
        "\"Your uploaded notes do not contain sufficient information to answer this question.\"\n"
        "5. Always cite the document name and page number inline when stating facts from a source, e.g., [lecture_notes.pdf, p. 3].\n"
        "6. Use clear, student-friendly Markdown formatting (headings, bullet points, numbered steps, or code/math where helpful)."
    )

    def generate_answer(
        self,
        question: str,
        chunks: Sequence[RetrievedChunk],
        history: Sequence[tuple[str, str]] = (),
    ) -> str:
        settings = get_settings()
        if _is_placeholder_key(settings.GEMINI_API_KEY):
            raise LLMConfigurationError(
                "GEMINI_API_KEY is not configured. Add a valid key to backend/.env and restart the server."
            )

        context_block = _build_context_block(chunks)
        history_block = _build_history_block(history)

        user_prompt = (
            f"RECENT CONVERSATION CONTEXT:\n{history_block}\n\n"
            f"RETRIEVED STUDY NOTES:\n{context_block}\n\n"
            f"STUDENT QUESTION:\n{question}\n\n"
            "Provide a clear, well-structured answer strictly grounded in the retrieved study notes above, "
            "with inline source citations like [filename.pdf, p. N]."
        )

        http_options = types.HttpOptions(
            timeout=25000,
            retry_options=types.HttpRetryOptions(attempts=1),
        )
        try:
            client = genai.Client(
                api_key=settings.GEMINI_API_KEY.strip(),
                http_options=http_options,
            )
        except TypeError:
            client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())

        config = types.GenerateContentConfig(
            system_instruction=self.SYSTEM_INSTRUCTION,
            temperature=0.2,
            max_output_tokens=2048,
        )

        candidate_models = [settings.GEMINI_MODEL] + [
            m for m in FALLBACK_MODELS if m != settings.GEMINI_MODEL
        ]

        last_exc: Exception | None = None
        for idx, model_name in enumerate(candidate_models):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=user_prompt,
                    config=config,
                )
                text = (getattr(response, "text", None) or "").strip()
                if not text:
                    raise LLMGenerationError("Gemini returned an empty response.")
                if idx > 0:
                    logger.info("Answered successfully using fallback Gemini model %s", model_name)
                return text
            except LLMConfigurationError:
                raise
            except Exception as exc:
                msg = str(exc)
                if "API_KEY_INVALID" in msg or "API key not valid" in msg or "401" in msg:
                    raise LLMConfigurationError(
                        "The configured GEMINI_API_KEY was rejected by Google Gemini API. Please verify your key."
                    ) from exc

                last_exc = exc
                if _is_transient_or_unavailable(msg) and idx < len(candidate_models) - 1:
                    logger.warning(
                        "Gemini model %s unavailable (%s); trying fallback model...",
                        model_name,
                        msg[:140],
                    )
                    time.sleep(0.25)
                    continue
                logger.exception("Gemini API generation error on model %s", model_name)
                break

        raise LLMGenerationError(
            f"Failed to generate answer from Gemini API: {last_exc}"
        ) from last_exc


_llm_service: GeminiLLMService | None = None


def get_llm_service() -> GeminiLLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = GeminiLLMService()
    return _llm_service
