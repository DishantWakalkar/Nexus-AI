import os
import logging
from typing import TypedDict, Optional
from groq import Groq
from langgraph.graph import StateGraph, END

from app.retrieval.retriever import HybridRetriever
from app.security.permissions import filter_chunks_by_permission

logger = logging.getLogger("nexusai.agent.graph")


# ─── STATE ────────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    query: str
    company_id: str
    user_id: str
    source_filter: Optional[str]

    needs_clarification: bool
    clarification_question: Optional[str]

    chunks: list[dict]
    retrieval_attempts: int

    answer: Optional[str]
    sources: list[dict]
    chunks_used: int


# ─── NODES ────────────────────────────────────────────────────────────────
class NexusAgent:
    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not set")
        self.client = Groq(api_key=api_key)
        self.model = "llama-3.3-70b-versatile"
        self.retriever = HybridRetriever()
        self.graph = self._build_graph()

    # ── Node 1: classify whether the query is answerable as-is ──
    def _classify_query(self, state: AgentState) -> AgentState:
        query = state["query"]
        words = query.lower().split()

        ambiguous_signals = {"it", "that", "this", "they", "those", "them"}

        is_too_short = len(words) <= 2
        contains_pronoun = any(w.strip("?,.!") in ambiguous_signals for w in words)

        if is_too_short or contains_pronoun:
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=100,
                temperature=0,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You decide if a user question to a company knowledge "
                            "assistant is too ambiguous to answer without more context — "
                            "for example it refers to something not defined in the question itself, "
                            "like 'it', 'that', or 'they' with no clear referent. "
                            "Reply with exactly one word: AMBIGUOUS or CLEAR."
                        ),
                    },
                    {"role": "user", "content": query},
                ],
            )
            verdict = (response.choices[0].message.content or "").strip().upper()
            state["needs_clarification"] = "AMBIGUOUS" in verdict
        else:
            state["needs_clarification"] = False

        if state["needs_clarification"]:
            logger.info(f"Query flagged as ambiguous: '{query}'")
        return state

    # ── Node 2a: ask for clarification (terminal path) ──
    def _ask_clarification(self, state: AgentState) -> AgentState:
        query = state["query"]
        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=150,
            temperature=0.3,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are NexusAI, a company knowledge assistant. "
                        "The user's question is ambiguous. Ask ONE short, "
                        "specific clarifying question to understand what they need. "
                        "Do not answer the question itself."
                    ),
                },
                {"role": "user", "content": query},
            ],
        )
        state["clarification_question"] = response.choices[0].message.content
        state["answer"] = state["clarification_question"]
        state["sources"] = []
        state["chunks_used"] = 0
        return state

    # ── Node 2b: retrieve relevant chunks ──
    def _retrieve(self, state: AgentState) -> AgentState:
        attempts = state.get("retrieval_attempts", 0)
        chunks = self.retriever.retrieve(
            query=state["query"],
            company_id=state["company_id"],
            source_filter=state.get("source_filter"),
        )
        chunks = filter_chunks_by_permission(
            chunks, state["user_id"], state["company_id"]
        )
        state["chunks"] = chunks
        state["retrieval_attempts"] = attempts + 1
        logger.info(f"Retrieval attempt {state['retrieval_attempts']}: {len(chunks)} chunks")
        return state

    # ── Node 3: evaluate if retrieval was sufficient ──
    def _evaluate_retrieval(self, state: AgentState) -> str:
        chunks = state["chunks"]
        attempts = state["retrieval_attempts"]

        if not chunks and attempts < 2:
            return "retry"
        return "generate"

    # ── Node 4: retry with relaxed source filter ──
    def _retrieve_broader(self, state: AgentState) -> AgentState:
        logger.info("Retrying retrieval without source filter")
        state["source_filter"] = None
        return self._retrieve(state)

    # ── Node 5: generate the final answer ──
    def _generate_answer(self, state: AgentState) -> AgentState:
        chunks = state["chunks"]

        if not chunks:
            state["answer"] = (
                "I could not find any relevant information in your connected "
                "documents. Try syncing your sources or rephrasing the question."
            )
            state["sources"] = []
            state["chunks_used"] = 0
            return state

        context = self._build_context(chunks)
        answer_text = self._call_llm(state["query"], context)

        state["answer"] = answer_text
        state["sources"] = self._extract_sources(chunks)
        state["chunks_used"] = len(chunks)
        return state

    # ── helpers ──
    def _build_context(self, chunks: list[dict]) -> str:
        parts = []
        for i, chunk in enumerate(chunks, 1):
            title = chunk.get("title") or "Untitled"
            source = chunk.get("source", "unknown")
            content = chunk.get("content", "")
            url = chunk.get("metadata", {}).get("url", "")
            parts.append(
                f"[SOURCE {i}]\nTitle: {title}\nFrom: {source}\nURL: {url}\nContent:\n{content}\n"
            )
        return "\n---\n".join(parts)

    def _call_llm(self, query: str, context: str) -> str:
        system_prompt = """You are NexusAI, a company knowledge assistant.

Answer ONLY using the provided sources. Cite every claim with [SOURCE N].
If the answer is not in the sources, say: "I could not find this information in your documents."
Never use outside knowledge. Be concise. Do not add a Sources section — sources are shown separately."""

        user_message = f"Sources:\n\n{context}\n\n---\n\nQuestion: {query}"

        response = self.client.chat.completions.create(
            model=self.model,
            max_tokens=1024,
            temperature=0.1,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        content = response.choices[0].message.content
        return content if content else "I could not find this information in your documents."

    def _extract_sources(self, chunks: list[dict]) -> list[dict]:
        seen = set()
        sources = []
        for i, chunk in enumerate(chunks, 1):
            doc_id = chunk.get("doc_id")
            if doc_id not in seen:
                seen.add(doc_id)
                sources.append({
                    "source_number": i,
                    "title": chunk.get("title") or "Untitled",
                    "source": chunk.get("source"),
                    "url": chunk.get("metadata", {}).get("url", ""),
                    "doc_id": doc_id,
                })
        return sources

    # ── BUILD THE GRAPH ──
    def _build_graph(self):
        graph = StateGraph(AgentState)

        graph.add_node("classify_query", self._classify_query)
        graph.add_node("ask_clarification", self._ask_clarification)
        graph.add_node("retrieve", self._retrieve)
        graph.add_node("retrieve_broader", self._retrieve_broader)
        graph.add_node("generate_answer", self._generate_answer)

        graph.set_entry_point("classify_query")

        graph.add_conditional_edges(
            "classify_query",
            lambda s: "ambiguous" if s["needs_clarification"] else "clear",
            {"ambiguous": "ask_clarification", "clear": "retrieve"},
        )

        graph.add_conditional_edges(
            "retrieve",
            self._evaluate_retrieval,
            {"retry": "retrieve_broader", "generate": "generate_answer"},
        )

        graph.add_edge("retrieve_broader", "generate_answer")
        graph.add_edge("ask_clarification", END)
        graph.add_edge("generate_answer", END)

        return graph.compile()

    # ── PUBLIC ENTRY POINT ──
    def run(
        self,
        query: str,
        company_id: str,
        user_id: str,
        source_filter: Optional[str] = None,
    ) -> dict:
        initial_state: AgentState = {
            "query": query,
            "company_id": company_id,
            "user_id": user_id,
            "source_filter": source_filter,
            "needs_clarification": False,
            "clarification_question": None,
            "chunks": [],
            "retrieval_attempts": 0,
            "answer": None,
            "sources": [],
            "chunks_used": 0,
        }

        final_state = self.graph.invoke(initial_state)

        return {
            "answer": final_state["answer"],
            "sources": final_state["sources"],
            "chunks_used": final_state["chunks_used"],
            "needs_clarification": final_state["needs_clarification"],
        }