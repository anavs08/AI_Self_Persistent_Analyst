"""
Enhanced Evaluation Endpoints
Adds three stronger metrics on top of existing evaluation:

1. Precision@5      — fraction of top-5 chunks that are genuinely relevant
2. Faithfulness     — LLM-as-judge: does the answer cite claims supported by retrieved chunks?
3. A/B Persistence  — retrieval quality WITH vs WITHOUT the insight store
"""
import json
import time
import os
from typing import Dict, Any, List
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import JSONResponse

router_eval = APIRouter()

# Shared result store (module-level, survives across requests in same process)
_enhanced_results: Dict[str, Any] = {}

# ── Benchmark queries with relevance labels ────────────────────────────────────
# Each query has a list of terms that a RELEVANT chunk should contain at least one of.
# This lets us compute Precision@k without a hand-labelled corpus.
LABELLED_QUERIES = [
    {"query": "NVIDIA revenue growth and earnings",
     "relevant_terms": ["nvda","nvidia","revenue","earnings","gpu","data center"],
     "expected_sources": ["market","filings","news"], "expected_tickers": ["NVDA"]},
    {"query": "Federal Reserve interest rate decisions",
     "relevant_terms": ["federal reserve","fed","interest rate","fomc","funds rate","monetary"],
     "expected_sources": ["macro","news"], "expected_tickers": []},
    {"query": "Apple quarterly earnings and margins",
     "relevant_terms": ["aapl","apple","earnings","margin","iphone","revenue","eps"],
     "expected_sources": ["market","filings"], "expected_tickers": ["AAPL"]},
    {"query": "Microsoft cloud revenue Azure growth",
     "relevant_terms": ["msft","microsoft","azure","cloud","revenue","growth"],
     "expected_sources": ["market","filings","news"], "expected_tickers": ["MSFT"]},
    {"query": "CPI inflation data consumer prices",
     "relevant_terms": ["cpi","inflation","consumer price","price index","pce"],
     "expected_sources": ["macro"], "expected_tickers": []},
    {"query": "Tesla production delivery numbers",
     "relevant_terms": ["tsla","tesla","production","delivery","vehicles","ev"],
     "expected_sources": ["market","filings"], "expected_tickers": ["TSLA"]},
    {"query": "Goldman Sachs investment banking revenue",
     "relevant_terms": ["gs","goldman","investment banking","revenue","trading"],
     "expected_sources": ["market","filings"], "expected_tickers": ["GS"]},
    {"query": "yield curve inversion recession signal",
     "relevant_terms": ["yield curve","inversion","t10y2y","treasury","recession","spread"],
     "expected_sources": ["macro","news"], "expected_tickers": []},
    {"query": "Meta Platforms advertising revenue social",
     "relevant_terms": ["meta","facebook","advertising","revenue","social","instagram"],
     "expected_sources": ["market","filings","news"], "expected_tickers": ["META"]},
    {"query": "JPMorgan credit losses loan portfolio",
     "relevant_terms": ["jpm","jpmorgan","credit","loan","loss","provision","banking"],
     "expected_sources": ["market","filings"], "expected_tickers": ["JPM"]},
]

FAITHFULNESS_QUESTIONS = [
    {"question": "What has been NVDA stock performance over the last month?",
     "expect_tool": False},
    {"question": "Calculate the expected return for AAPL using CAPM with beta 1.2",
     "expect_tool": True},
    {"question": "What is the current Federal Reserve monetary policy stance?",
     "expect_tool": False},
    {"question": "Compare MSFT and META recent stock performance",
     "expect_tool": False},
]


def _is_relevant(chunk_text: str, chunk_meta: dict, relevant_terms: List[str]) -> bool:
    """
    Heuristic relevance judgment: a chunk is relevant if its text or
    ticker metadata contains at least one of the expected terms.
    """
    text_lower = chunk_text.lower()
    ticker_lower = chunk_meta.get("ticker", "").lower()
    source = chunk_meta.get("source", "")
    combined = text_lower + " " + ticker_lower
    return any(term.lower() in combined for term in relevant_terms)


def _precision_at_k(chunks: List[Dict], relevant_terms: List[str], k: int = 5) -> float:
    """
    Precision@k: fraction of top-k chunks that are relevant.
    """
    top_k = chunks[:k]
    if not top_k:
        return 0.0
    relevant_count = sum(
        1 for c in top_k
        if _is_relevant(c["text"], c.get("metadata", {}), relevant_terms)
    )
    return round(relevant_count / len(top_k), 3)


def _mrr(chunks: List[Dict], relevant_terms: List[str]) -> float:
    """
    Mean Reciprocal Rank: 1/rank of first relevant chunk, or 0 if none found.
    """
    for i, chunk in enumerate(chunks, 1):
        if _is_relevant(chunk["text"], chunk.get("metadata", {}), relevant_terms):
            return round(1.0 / i, 3)
    return 0.0


def _get_client():
    import anthropic
    return anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))


def _faithfulness_score(question: str, answer: str, context_chunks: List[Dict]) -> Dict:
    """
    LLM-as-judge faithfulness evaluation.
    Asks Claude to verify whether the answer's claims are supported by the retrieved context.
    Returns a score 0-1 and a brief justification.
    """
    if not context_chunks or not answer.strip():
        return {"score": 0.0, "justification": "No context or answer provided", "supported": 0, "total": 0}

    context_str = "\n\n".join(
        f"[Chunk {i+1}] {c['text'][:300]}"
        for i, c in enumerate(context_chunks[:5])
    )

    prompt = f"""You are evaluating whether an AI analyst's answer is faithful to the retrieved context.

QUESTION: {question}

RETRIEVED CONTEXT:
{context_str}

ANALYST ANSWER:
{answer[:600]}

Task: Identify the 3-5 main factual claims in the answer. For each claim, determine if it is:
- SUPPORTED: directly backed by the retrieved context above
- UNSUPPORTED: not found in the context (may be from general knowledge)
- CONTRADICTED: conflicts with the context

Respond in this exact JSON format:
{{
  "claims": [
    {{"claim": "brief claim text", "verdict": "SUPPORTED|UNSUPPORTED|CONTRADICTED"}}
  ],
  "faithfulness_score": 0.0,
  "justification": "one sentence summary"
}}

faithfulness_score = supported_claims / total_claims. Return only JSON."""

    try:
        client = _get_client()
        response = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw.strip())
        supported = sum(1 for c in data.get("claims", []) if c.get("verdict") == "SUPPORTED")
        total     = len(data.get("claims", []))
        return {
            "score":         round(data.get("faithfulness_score", supported / max(total, 1)), 3),
            "justification": data.get("justification", ""),
            "supported":     supported,
            "total":         total,
            "claims":        data.get("claims", []),
        }
    except Exception as e:
        return {"score": 0.0, "justification": f"Eval error: {e}", "supported": 0, "total": 0}


# ── Enhanced Retrieval Evaluation ──────────────────────────────────────────────

async def _run_enhanced_retrieval():
    from memory.retriever import retrieve

    results = []
    for item in LABELLED_QUERIES:
        t0 = time.time()
        chunks, _ = retrieve(item["query"], n_long_term=10)
        latency_ms = round((time.time() - t0) * 1000, 1)

        retrieved_sources = [c["metadata"].get("source", "unknown") for c in chunks]
        retrieved_tickers = [c["metadata"].get("ticker", "") for c in chunks if c["metadata"].get("ticker")]

        avg_dist = sum(c["distance"] for c in chunks) / max(len(chunks), 1) if chunks else 1.0
        avg_relevance  = round(max(0.0, 1 - avg_dist / 2), 3)
        precision_at_5 = _precision_at_k(chunks, item["relevant_terms"], k=5)
        mrr            = _mrr(chunks, item["relevant_terms"])
        source_hit     = round(sum(1 for s in item["expected_sources"] if s in retrieved_sources) / max(len(item["expected_sources"]), 1), 2)
        ticker_hit     = round(sum(1 for t in item["expected_tickers"] if t in retrieved_tickers) / max(len(item["expected_tickers"]), 1), 2) if item["expected_tickers"] else 1.0

        results.append({
            "query":          item["query"],
            "chunks_found":   len(chunks),
            "avg_relevance":  avg_relevance,
            "precision_at_5": precision_at_5,
            "mrr":            mrr,
            "latency_ms":     latency_ms,
            "source_hit_rate":source_hit,
            "ticker_hit_rate":ticker_hit,
            "sources_found":  list(set(retrieved_sources)),
        })

    summary = {
        "avg_relevance":    round(sum(r["avg_relevance"]   for r in results) / len(results), 3),
        "avg_precision_5":  round(sum(r["precision_at_5"]  for r in results) / len(results), 3),
        "avg_mrr":          round(sum(r["mrr"]             for r in results) / len(results), 3),
        "avg_latency_ms":   round(sum(r["latency_ms"]      for r in results) / len(results), 1),
        "avg_source_hit":   round(sum(r["source_hit_rate"] for r in results) / len(results), 3),
        "avg_ticker_hit":   round(sum(r["ticker_hit_rate"] for r in results) / len(results), 3),
    }
    _enhanced_results["retrieval"] = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "results":   results,
        "summary":   summary,
    }
    print(f"[eval] Enhanced retrieval: P@5={summary['avg_precision_5']}, MRR={summary['avg_mrr']}, Relevance={summary['avg_relevance']}")


# ── Faithfulness Evaluation ────────────────────────────────────────────────────

async def _run_faithfulness_eval():
    import asyncio
    from memory.retriever import retrieve, build_prompt
    from tools.finance import TOOL_DEFINITIONS, run_tool

    results = []
    for item in FAITHFULNESS_QUESTIONS:
        t0 = time.time()
        chunks, context_str = retrieve(item["question"], n_long_term=8)
        messages = build_prompt(item["question"], context_str)
        retrieval_ms = round((time.time() - t0) * 1000, 1)

        try:
            client    = _get_client()
            system    = messages[0]["content"] if messages and messages[0]["role"] == "system" else ""
            user_msgs = [m for m in messages if m["role"] != "system"]

            t1 = time.time()
            response = client.messages.create(
                model="claude-sonnet-4-5", max_tokens=1024,
                system=system, messages=user_msgs, tools=TOOL_DEFINITIONS,
            )
            tool_used  = any(b.type == "tool_use" for b in response.content)
            tool_names = [b.name for b in response.content if b.type == "tool_use"]

            while response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        r = run_tool(block.name, block.input)
                        tool_results.append({"type":"tool_result","tool_use_id":block.id,"content":json.dumps(r)})
                user_msgs = user_msgs + [
                    {"role":"assistant","content":response.content},
                    {"role":"user","content":tool_results},
                ]
                response = client.messages.create(
                    model="claude-sonnet-4-5", max_tokens=1024,
                    system=system, messages=user_msgs, tools=TOOL_DEFINITIONS,
                )

            answer       = "\n".join(b.text for b in response.content if hasattr(b, "text"))
            inference_ms = round((time.time() - t1) * 1000, 1)

            # Faithfulness: separate LLM call
            faith = await asyncio.to_thread(_faithfulness_score, item["question"], answer, chunks)

            # Tool compliance
            tool_compliant = tool_used if item["expect_tool"] else not tool_used

            # Takeaway
            has_takeaway = any(p in answer.lower() for p in [
                "takeaway","conclusion","implication","therefore","overall",
                "bottom line","investors should","suggests","recommend",
            ])

            results.append({
                "question":      item["question"],
                "answer_preview":answer[:350] + "..." if len(answer) > 350 else answer,
                "chunks_used":   len(chunks),
                "faithfulness":  faith,
                "tool_used":     tool_used,
                "tool_names":    tool_names,
                "tool_compliant":tool_compliant,
                "has_takeaway":  has_takeaway,
                "retrieval_ms":  retrieval_ms,
                "inference_ms":  inference_ms,
            })

        except Exception as e:
            results.append({
                "question":    item["question"],
                "error":       str(e),
                "faithfulness":{"score":0.0,"justification":str(e),"supported":0,"total":0},
                "tool_used":False,"tool_compliant":False,"has_takeaway":False,
                "chunks_used":len(chunks),"tool_names":[],
                "retrieval_ms":retrieval_ms,"inference_ms":0,
            })

    summary = {
        "avg_faithfulness":  round(sum(r["faithfulness"]["score"] for r in results) / len(results), 3),
        "avg_supported_pct": round(sum(
            r["faithfulness"]["supported"] / max(r["faithfulness"]["total"], 1)
            for r in results
        ) / len(results), 3),
        "tool_compliance":   round(sum(1 for r in results if r["tool_compliant"]) / len(results), 3),
        "takeaway_rate":     round(sum(1 for r in results if r.get("has_takeaway")) / len(results), 3),
        "avg_inference_ms":  round(sum(r.get("inference_ms", 0) for r in results) / len(results), 1),
    }
    _enhanced_results["faithfulness"] = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "results":   results,
        "summary":   summary,
    }
    print(f"[eval] Faithfulness: avg={summary['avg_faithfulness']}, tool_compliance={summary['tool_compliance']}")


# ── A/B Self-Persistence Test ──────────────────────────────────────────────────

AB_QUERIES = [
    {"query":"NVDA valuation and earnings outlook",           "relevant_terms":["nvda","nvidia","valuation","earnings","growth"]},
    {"query":"Federal Reserve rate policy macro outlook",     "relevant_terms":["federal reserve","fed","rate","monetary","inflation"]},
    {"query":"Apple stock performance and analyst views",     "relevant_terms":["aapl","apple","stock","analyst","price target"]},
    {"query":"Microsoft Azure cloud growth trajectory",      "relevant_terms":["msft","microsoft","azure","cloud","growth"]},
    {"query":"Yield curve recession risk indicators",         "relevant_terms":["yield curve","recession","t10y2y","inversion","risk"]},
]

async def _run_ab_persistence():
    """
    For each query, do TWO separate retrieval calls:
    - WITH insights:    retrieve from all sources including insight chunks
    - WITHOUT insights: retrieve from long-term store but boost non-insight chunks
      by temporarily down-weighting insights via source filter
    Compare Precision@5 and MRR to quantify the RACL feedback loop's contribution.
    """
    from memory.store import query as store_query
    from memory.memory_manager import process_retrieved_chunks

    def retrieve_with_insights(q, k=10):
        lt = store_query(q, "long_term", n_results=k)
        ep = store_query(q, "episodic",  n_results=4)
        seen, merged = set(), []
        for c in lt + ep:
            if c["id"] not in seen:
                seen.add(c["id"])
                merged.append(c)
        return process_retrieved_chunks(merged)[:k]

    def retrieve_without_insights(q, k=10):
        lt = store_query(q, "long_term", n_results=k + 20)  # fetch extra to compensate
        ep = store_query(q, "episodic",  n_results=4)
        seen, merged = set(), []
        for c in lt + ep:
            if c["id"] not in seen and c.get("metadata", {}).get("source") != "insights":
                seen.add(c["id"])
                merged.append(c)
        return process_retrieved_chunks(merged)[:k]

    results = []
    for item in AB_QUERIES:
        # WITH insights
        chunks_with = retrieve_with_insights(item["query"])
        p5_with  = _precision_at_k(chunks_with, item["relevant_terms"], k=5)
        mrr_with = _mrr(chunks_with, item["relevant_terms"])
        rel_with = round(max(0.0, 1 - (sum(c["distance"] for c in chunks_with) / max(len(chunks_with), 1)) / 2), 3) if chunks_with else 0.0
        n_insights_with = sum(1 for c in chunks_with if c.get("metadata", {}).get("source") == "insights")

        # WITHOUT insights (genuine separate retrieval, insight chunks excluded)
        chunks_without = retrieve_without_insights(item["query"])
        p5_without  = _precision_at_k(chunks_without, item["relevant_terms"], k=5)
        mrr_without = _mrr(chunks_without, item["relevant_terms"])
        rel_without = round(max(0.0, 1 - (sum(c["distance"] for c in chunks_without) / max(len(chunks_without), 1)) / 2), 3) if chunks_without else 0.0

        results.append({
            "query":         item["query"],
            "with_insights": {
                "precision_5": p5_with,
                "mrr":         mrr_with,
                "relevance":   rel_with,
                "n_insights":  n_insights_with,
                "n_chunks":    len(chunks_with),
            },
            "without_insights": {
                "precision_5": p5_without,
                "mrr":         mrr_without,
                "relevance":   rel_without,
                "n_insights":  0,
                "n_chunks":    len(chunks_without),
            },
            "delta": {
                "precision_5": round(p5_with - p5_without, 3),
                "mrr":         round(mrr_with - mrr_without, 3),
                "relevance":   round(rel_with - rel_without, 3),
            },
        })

    avg_delta_p5  = round(sum(r["delta"]["precision_5"] for r in results) / len(results), 3)
    avg_delta_mrr = round(sum(r["delta"]["mrr"]         for r in results) / len(results), 3)
    avg_delta_rel = round(sum(r["delta"]["relevance"]   for r in results) / len(results), 3)

    total_insights = sum(r["with_insights"]["n_insights"] for r in results)

    _enhanced_results["ab_persistence"] = {
        "timestamp":      time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "results":        results,
        "total_insights_in_store": total_insights,
        "summary": {
            "avg_delta_precision_5": avg_delta_p5,
            "avg_delta_mrr":         avg_delta_mrr,
            "avg_delta_relevance":   avg_delta_rel,
            "insight_contribution":  "positive" if avg_delta_p5 > 0 else "neutral" if avg_delta_p5 == 0 else "negative",
            "interpretation": (
                f"Including self-generated insights improves Precision@5 by {avg_delta_p5:+.3f} "
                f"and MRR by {avg_delta_mrr:+.3f} on average across {len(results)} queries."
            ),
        },
    }
    print(f"[eval] A/B: delta P@5={avg_delta_p5:+.3f}, delta MRR={avg_delta_mrr:+.3f}")


# ── Routes ─────────────────────────────────────────────────────────────────────

def register_enhanced_eval(router):
    """Call this from routes.py to register all enhanced eval endpoints."""

    @router.post("/eval/enhanced/retrieval")
    async def run_enhanced_retrieval(background_tasks: BackgroundTasks):
        background_tasks.add_task(_run_enhanced_retrieval)
        return {"status":"started","queries":len(LABELLED_QUERIES),"metrics":["relevance","precision@5","mrr","source_hit","ticker_hit"]}

    @router.get("/eval/enhanced/retrieval/results")
    async def get_enhanced_retrieval():
        if "retrieval" not in _enhanced_results:
            return {"status":"not_run"}
        return _enhanced_results["retrieval"]

    @router.post("/eval/faithfulness")
    async def run_faithfulness(background_tasks: BackgroundTasks):
        background_tasks.add_task(_run_faithfulness_eval)
        return {"status":"started","questions":len(FAITHFULNESS_QUESTIONS),"note":"~60s — makes one extra LLM call per answer for verification"}

    @router.get("/eval/faithfulness/results")
    async def get_faithfulness():
        if "faithfulness" not in _enhanced_results:
            return {"status":"not_run"}
        return _enhanced_results["faithfulness"]

    @router.post("/eval/ab_persistence")
    async def run_ab_persistence(background_tasks: BackgroundTasks):
        background_tasks.add_task(_run_ab_persistence)
        return {"status":"started","queries":len(AB_QUERIES),"note":"Compares retrieval WITH vs WITHOUT insight store"}

    @router.get("/eval/ab_persistence/results")
    async def get_ab_persistence():
        if "ab_persistence" not in _enhanced_results:
            return {"status":"not_run"}
        return _enhanced_results["ab_persistence"]

    @router.get("/eval/enhanced/all")
    async def get_all_enhanced():
        return {
            "retrieval":      _enhanced_results.get("retrieval",      {"status":"not_run"}),
            "faithfulness":   _enhanced_results.get("faithfulness",   {"status":"not_run"}),
            "ab_persistence": _enhanced_results.get("ab_persistence", {"status":"not_run"}),
        }
