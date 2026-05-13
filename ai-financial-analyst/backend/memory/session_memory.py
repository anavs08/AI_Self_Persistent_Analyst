"""
Session Memory Writer v2
Stores analyst insights with a short inference tag summarizing what was learned.
"""
import hashlib
import time
from typing import List
from memory.store import upsert_chunks

MIN_INSIGHT_WORDS = 40

def should_store(response: str) -> bool:
    words = response.split()
    if len(words) < MIN_INSIGHT_WORDS:
        return False
    skip = ["model not loaded", "no context found", "could not reach", "backend not reachable"]
    return not any(p in response.lower() for p in skip)

def extract_tickers(text: str) -> List[str]:
    import re
    candidates = re.findall(r"\b([A-Z]{1,5})\b", text)
    known = {"AAPL","MSFT","NVDA","TSLA","GOOGL","JPM","GS","AMZN","META",
             "BRK","SPY","QQQ","INTC","AMD","CRM","NFLX","UBER","LYFT"}
    return list({c for c in candidates if c in known})

def generate_tag(query: str, response: str) -> str:
    """
    Generate a short 2-4 word inference tag summarizing what was learned.
    Uses simple heuristics — no extra API call needed.
    """
    q = query.lower()
    r = response.lower()

    # Valuation signals
    if any(w in q+r for w in ["dcf","intrinsic value","fair value","undervalued","overvalued"]):
        return "Valuation analysis"
    if any(w in q+r for w in ["pe ratio","p/e","earnings multiple","peg"]):
        return "P/E assessment"
    if "wacc" in q+r or "cost of capital" in q+r:
        return "WACC computed"
    if "capm" in q+r or "expected return" in q+r or "beta" in q+r:
        return "CAPM return est."
    if "sharpe" in q+r:
        return "Risk-adj. return"
    if "bond" in q+r or "yield" in q+r or "duration" in q+r:
        return "Fixed income"
    if "var" in q+r or "value at risk" in q+r:
        return "VaR computed"
    if "ddm" in q+r or "dividend" in q+r:
        return "Dividend model"

    # Market signals
    if any(w in q+r for w in ["bullish","upside","buy","outperform"]):
        return "Bullish signal"
    if any(w in q+r for w in ["bearish","downside","sell","underperform","risk"]):
        return "Bearish signal"
    if "compare" in q or "vs" in q or "versus" in q:
        return "Comparative view"

    # Topic signals
    if any(w in q+r for w in ["fed","interest rate","monetary","inflation","cpi"]):
        return "Macro analysis"
    if any(w in q+r for w in ["earnings","revenue","margin","eps","guidance"]):
        return "Earnings insight"
    if any(w in q+r for w in ["portfolio","allocation","diversif","weight"]):
        return "Portfolio advice"
    if any(w in q+r for w in ["sector","industry","market cap"]):
        return "Sector analysis"
    if any(w in q+r for w in ["trend","momentum","technical","support","resistance"]):
        return "Price trend"

    return "General insight"

def store_insight(
    query: str,
    response: str,
    sources_used: List[str],
    session_id: str = "default",
) -> bool:
    if not should_store(response):
        return False

    tickers = extract_tickers(query + " " + response)
    tag = generate_tag(query, response)
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())

    text = (
        f"Analyst insight generated on {timestamp}. "
        f"Question: {query.strip()} "
        f"Analysis: {response.strip()}"
    )
    chunk_id = f"insight_{hashlib.sha256((query+response[:100]).encode()).hexdigest()[:16]}"

    chunk = {
        "id": chunk_id,
        "text": text,
        "metadata": {
            "source":       "insights",
            "session_id":   session_id,
            "query":        query[:200],
            "tag":          tag,
            "tickers":      ",".join(tickers),
            "sources_used": ",".join(sources_used),
            "timestamp":    timestamp,
        },
    }

    try:
        n = upsert_chunks([chunk], "long_term")
        if n > 0:
            print(f"[memory] Stored insight [{tag}]: \"{query[:50]}...\"")
        return n > 0
    except Exception as e:
        print(f"[memory] Failed to store insight: {e}")
        return False

def get_insight_count() -> int:
    try:
        from memory.store import get_collection
        col = get_collection("long_term")
        all_meta = col.get(include=["metadatas"])["metadatas"]
        return sum(1 for m in all_meta if m.get("source") == "insights")
    except Exception:
        return 0
