"""
RAG Retriever v3 — with memory quality pipeline.
Applies staleness decay, deduplication, and context ordering
to retrieved chunks before building the prompt.
"""
from typing import List, Dict, Any, Tuple
from memory.store import query

MAX_CONTEXT_TOKENS = 3000
SOURCE_LABELS = {
    "market":   "Market Data",
    "filings":  "SEC Filing",
    "news":     "Financial News",
    "macro":    "Macro Indicator",
    "insights": "Prior Analysis",
}


def retrieve(
    user_query: str,
    n_long_term: int = 10,
    n_episodic: int = 4,
    source_filter: str | None = None,
) -> Tuple[List[Dict], str]:
    """
    Retrieve relevant context with full memory quality pipeline applied.
    Pulls more chunks than needed (n=10) to give the deduplication and
    staleness filter room to work, then trims to context window budget.
    """
    from memory.memory_manager import process_retrieved_chunks

    where = {"source": source_filter} if source_filter else None

    lt_chunks = query(user_query, "long_term", n_results=n_long_term, where=where)
    ep_chunks = query(user_query, "episodic",  n_results=n_episodic,  where=where)

    # Merge and deduplicate by id
    seen, merged = set(), []
    for chunk in lt_chunks + ep_chunks:
        if chunk["id"] not in seen:
            seen.add(chunk["id"])
            merged.append(chunk)

    # Apply memory quality pipeline:
    # staleness decay -> deduplication -> re-sort -> context ordering
    merged = process_retrieved_chunks(merged)

    # Trim to context window budget
    lines, word_count, included = [], 0, []
    for chunk in merged:
        words = chunk["text"].split()
        if word_count + len(words) > MAX_CONTEXT_TOKENS:
            break
        source_label = SOURCE_LABELS.get(chunk["metadata"].get("source", ""), "Source")
        lines.append(f"[{source_label}] {chunk['text']}")
        word_count += len(words)
        included.append(chunk)

    return included, "\n\n".join(lines)


def build_prompt(
    user_query: str,
    context_str: str,
    history: List[Dict[str, str]] | None = None,
) -> List[Dict[str, str]]:
    """
    Build the Claude message list with conversation history and retrieved context.
    """
    system = """You are an expert AI financial analyst with deep knowledge of markets, macroeconomics, corporate finance, and investment strategy. You have access to a persistent memory store containing real market data, SEC filings, macro indicators, financial news, and your own prior analyses. You also have financial calculation tools (DCF, DDM, CAPM, Sharpe Ratio, Bond Pricing, VaR, WACC, P/E, Portfolio Metrics).

Rules:
1. Always give a direct, substantive answer. Never hedge excessively.
2. Use provided context as your primary source. Reason confidently from available data.
3. Calculate and state returns, ranges, and trends directly from price data.
4. Draw on your broader financial expertise to supplement context.
5. Lead with the key insight, then support with data and calculations.
6. Never output warning boxes or disclaimers about missing data. Weave limitations naturally.
7. Cite source types naturally (e.g. "according to recent market data", "per the SEC filing").
8. When context includes Prior Analysis, build on it and note if conditions have changed.
9. End with a clear takeaway or investment implication.
10. You have full memory of this conversation. Use prior turns to understand follow-up questions without asking for clarification."""

    messages = []
    if history:
        for turn in history:
            role = turn.get("role", "")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content.strip():
                messages.append({"role": role, "content": content})

    current_content = (
        f"[Memory context — ordered by relevance and recency]\n{context_str}\n\n---\n\n{user_query}"
        if context_str else user_query
    )
    messages.append({"role": "user", "content": current_content})

    return [{"role": "system", "content": system}] + messages
