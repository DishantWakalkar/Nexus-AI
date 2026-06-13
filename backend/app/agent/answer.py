import os
import logging
from groq import Groq
from app.retrieval.retriever import HybridRetriever
from app.security.permissions import filter_chunks_by_permission

logger = logging.getLogger("nexusai.agent.answer")


class AnswerEngine:
    """
    Takes a user query + retrieved chunks and generates
    a cited answer using Groq (Llama 3.3 70B).

    Rules enforced:
    - Answer ONLY from provided chunks — no outside knowledge
    - Every claim must cite a source
    - If answer not found — say so honestly, never hallucinate
    - Permission-filtered chunks only
    """

    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set")
        self.client = Groq(api_key=api_key)
        self.retriever = HybridRetriever()
        self.model = "llama-3.3-70b-versatile"

    def ask(
        self,
        query: str,
        company_id: str,
        user_id: str,
        source_filter: str | None = None,
    ) -> dict:
        """
        Main method — retrieves relevant chunks then generates
        a cited answer. Returns answer + sources used.
        """
        logger.info(f"Question received: '{query[:80]}' company={company_id}")

        # Step 1 — retrieve relevant chunks
        chunks = self.retriever.retrieve(
            query=query,
            company_id=company_id,
            source_filter=source_filter,
        )

        if not chunks:
            return {
                "answer": "I could not find any relevant information in your connected documents. Try syncing your sources or rephrasing the question.",
                "sources": [],
                "chunks_used": 0,
            }

        # Step 2 — filter by user permissions
        chunks = filter_chunks_by_permission(chunks, user_id, company_id)

        if not chunks:
            return {
                "answer": "I found relevant documents but you do not have permission to access them. Contact your workspace admin.",
                "sources": [],
                "chunks_used": 0,
            }

        # Step 3 — build context block for the LLM
        context = self._build_context(chunks)

        # Step 4 — generate answer
        answer_text = self._generate_answer(query, context)

        # Step 5 — build sources list for the UI
        sources = self._extract_sources(chunks)

        return {
            "answer": answer_text,
            "sources": sources,
            "chunks_used": len(chunks),
        }

    def _build_context(self, chunks: list[dict]) -> str:
        """
        Format chunks into a numbered context block.
        Each chunk gets a [SOURCE N] tag so the LLM can cite it.
        """
        parts = []
        for i, chunk in enumerate(chunks, 1):
            title = chunk.get("title") or "Untitled"
            source = chunk.get("source", "unknown")
            content = chunk.get("content", "")
            url = chunk.get("metadata", {}).get("url", "")

            parts.append(
                f"[SOURCE {i}]\n"
                f"Title: {title}\n"
                f"From: {source}\n"
                f"URL: {url}\n"
                f"Content:\n{content}\n"
            )

        return "\n---\n".join(parts)

    def _generate_answer(self, query: str, context: str) -> str:
        """
        Call Groq with a strict grounding prompt.
        Model MUST cite sources and MUST NOT use outside knowledge.
        """
        system_prompt = """You are NexusAI, a company knowledge assistant.

Your job is to answer questions using ONLY the document chunks provided to you.

STRICT RULES:
1. Answer ONLY from the provided sources — never use outside knowledge
2. Cite every claim using [SOURCE N] notation inline
3. If the answer is not in the sources say exactly: "I could not find this information in your documents."
4. Never guess, infer, or hallucinate — only state what the sources explicitly say
5. Be concise and direct — no filler phrases like "Great question!"
6. If multiple sources support a point cite all of them: [SOURCE 1][SOURCE 3]

FORMAT:
- Answer in clear paragraphs with inline citations
- End with a ## Sources section listing: Source N — Title (from: notion/drive/slack)"""

        user_message = f"""Here are the relevant document chunks:

{context}

---

Question: {query}

Answer using only the sources above. Cite every claim with [SOURCE N]."""

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=1024,
            temperature=0.1,      # low temperature = more factual, less creative
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
        )

        content = response.choices[0].message.content
        return content if content is not None else "I could not find this information in your documents."

    def _extract_sources(self, chunks: list[dict]) -> list[dict]:
        """
        Build a deduplicated list of source documents used.
        Returned to the frontend to show clickable source cards.
        """
        seen_docs = set()
        sources = []

        for i, chunk in enumerate(chunks, 1):
            doc_id = chunk.get("doc_id")
            if doc_id not in seen_docs:
                seen_docs.add(doc_id)
                sources.append({
                    "source_number": i,
                    "title": chunk.get("title") or "Untitled",
                    "source": chunk.get("source"),
                    "url": chunk.get("metadata", {}).get("url", ""),
                    "doc_id": doc_id,
                })

        return sources