"""
On-Demand Data Fetcher
Fetches market data, filings, and news for any ticker on request.
Called from the new Ticker tab in the frontend.
"""
import httpx
import os
from typing import List, Dict, Any

BASE_URL = "https://www.alphavantage.co/query"

# EDGAR CIK lookup — extended list
KNOWN_CIKS = {
    "AAPL":  "0000320193", "MSFT": "0000789019", "NVDA": "0001045810",
    "TSLA":  "0001318605", "GOOGL":"0001652044", "GOOG": "0001652044",
    "JPM":   "0000019617", "GS":   "0000886982", "AMZN": "0001018724",
    "META":  "0001326801", "BRK":  "0001067983", "V":    "0001403161",
    "JNJ":   "0000200406", "XOM":  "0000034088", "WMT":  "0000104169",
    "UNH":   "0000731766", "MA":   "0001141391", "PG":   "0000080424",
    "HD":    "0000354950", "CVX":  "0000093410", "ABBV": "0001551152",
    "MRK":   "0000310158", "PFE":  "0000078003", "LLY":  "0000059478",
    "KO":    "0000021344", "PEP":  "0000077476", "COST": "0000909832",
    "INTC":  "0000050863", "AMD":  "0000002488", "CRM":  "0001108524",
    "NFLX":  "0001065280", "UBER": "0001543151", "SPOT": "0001639920",
    "PYPL":  "0001633917", "SQ":   "0001512673", "SHOP": "0001594805",
    "SNOW":  "0001640147", "PLTR": "0001321655", "COIN": "0001679788",
}

EDGAR_HEADERS = {
    "User-Agent": "ai-financial-analyst research@columbia.edu",
    "Accept":     "application/json",
}


async def lookup_cik(ticker: str) -> str | None:
    """Look up CIK for a ticker — check known list first, then EDGAR search."""
    ticker = ticker.upper()
    if ticker in KNOWN_CIKS:
        return KNOWN_CIKS[ticker]

    # Try EDGAR company search API
    try:
        async with httpx.AsyncClient(headers=EDGAR_HEADERS, timeout=15) as client:
            resp = await client.get(
                f"https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&dateRange=custom&startdt=2020-01-01&forms=10-K"
            )
            if resp.is_success:
                data = resp.json()
                hits = data.get("hits", {}).get("hits", [])
                if hits:
                    entity_id = hits[0].get("_source", {}).get("entity_id", "")
                    if entity_id:
                        return str(entity_id).zfill(10)
    except Exception:
        pass
    return None


async def fetch_ticker_price(ticker: str, api_key: str) -> Dict[str, Any]:
    """Fetch latest price quote."""
    url = f"{BASE_URL}?function=GLOBAL_QUOTE&symbol={ticker}&apikey={api_key}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    quote = data.get("Global Quote", {})
    if not quote or "05. price" not in quote:
        return {}
    return {
        "price":      round(float(quote["05. price"]), 2),
        "change":     round(float(quote["09. change"]), 2),
        "change_pct": quote["10. change percent"].replace("%", ""),
        "volume":     quote["06. volume"],
        "prev_close": round(float(quote["08. previous close"]), 2),
        "high":       round(float(quote["03. high"]), 2),
        "low":        round(float(quote["04. low"]), 2),
    }


async def fetch_ticker_overview(ticker: str, api_key: str) -> Dict[str, Any]:
    """Fetch company overview — sector, market cap, P/E, etc."""
    url = f"{BASE_URL}?function=OVERVIEW&symbol={ticker}&apikey={api_key}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
    if not data or "Symbol" not in data:
        return {}
    return {
        "name":         data.get("Name", ticker),
        "sector":       data.get("Sector", ""),
        "industry":     data.get("Industry", ""),
        "market_cap":   data.get("MarketCapitalization", ""),
        "pe_ratio":     data.get("PERatio", ""),
        "eps":          data.get("EPS", ""),
        "dividend":     data.get("DividendYield", ""),
        "52w_high":     data.get("52WeekHigh", ""),
        "52w_low":      data.get("52WeekLow", ""),
        "description":  data.get("Description", "")[:500],
        "exchange":     data.get("Exchange", ""),
    }


async def fetch_ticker_filings(ticker: str, cik: str, max_filings: int = 5) -> List[Dict]:
    """Fetch recent SEC filings for a ticker using its CIK."""
    chunks = []
    try:
        async with httpx.AsyncClient(headers=EDGAR_HEADERS, timeout=30) as client:
            resp = await client.get(f"https://data.sec.gov/submissions/CIK{cik}.json")
            if not resp.is_success:
                return []
            data     = resp.json()
            name     = data.get("name", ticker)
            filings  = data.get("filings", {}).get("recent", {})
            forms    = filings.get("form", [])
            dates    = filings.get("filingDate", [])
            accnos   = filings.get("accessionNumber", [])

            count = 0
            for i, form in enumerate(forms):
                if form not in ("10-K", "10-Q", "8-K"):
                    continue
                if count >= max_filings:
                    break
                filing_date = dates[i] if i < len(dates) else "unknown"
                accession   = accnos[i] if i < len(accnos) else ""
                text = (
                    f"{name} ({ticker}) filed a {form} with the SEC on {filing_date}. "
                    f"Accession: {accession}."
                )
                chunks.append({
                    "id": f"filing_{cik}_{accession.replace('-','')}",
                    "text": text,
                    "metadata": {
                        "source": "filings", "ticker": ticker,
                        "company": name, "form_type": form,
                        "filing_date": filing_date, "accession": accession,
                    },
                })
                count += 1
    except Exception as e:
        print(f"[fetch] Filings error for {ticker}: {e}")
    return chunks


async def fetch_ticker_news(ticker: str, api_key: str, limit: int = 10) -> List[Dict]:
    """Fetch news for a specific ticker via Alpha Vantage."""
    import hashlib
    from datetime import datetime

    url = f"{BASE_URL}?function=NEWS_SENTIMENT&tickers={ticker}&limit={limit}&sort=LATEST&apikey={api_key}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    articles = data.get("feed", [])
    chunks   = []
    for article in articles:
        url_a    = article.get("url", "")
        title    = article.get("title", "")
        summary  = article.get("summary", "")
        source   = article.get("source", "Unknown")
        pub_date = article.get("time_published", str(datetime.utcnow()))
        sentiment = article.get("overall_sentiment_label", "Neutral")
        score    = article.get("overall_sentiment_score", 0)

        if not title:
            continue

        text = f"{title}. {summary} Sentiment: {sentiment} ({score:.3f})."
        chunks.append({
            "id": f"news_{hashlib.sha256(url_a.encode()).hexdigest()[:16]}_0",
            "text": f"Financial news from {source} published {pub_date}: {text}",
            "metadata": {
                "source": "news", "feed": source, "title": title,
                "url": url_a, "pub_date": pub_date,
                "sentiment": sentiment, "sentiment_score": float(score),
                "chunk_index": 0,
            },
        })
    return chunks


async def ingest_ticker(ticker: str) -> Dict[str, Any]:
    """
    Full ingestion pipeline for a single ticker.
    Fetches price, overview, filings, and news and stores all in ChromaDB.
    Returns a summary of what was ingested.
    """
    from memory.store import upsert_chunks, add_to_episodic

    api_key = os.getenv("ALPHA_VANTAGE_KEY", "")
    ticker  = ticker.upper().strip()
    result  = {"ticker": ticker, "price": {}, "overview": {}, "filings": 0, "news": 0, "errors": []}

    # Price
    try:
        result["price"] = await fetch_ticker_price(ticker, api_key)
    except Exception as e:
        result["errors"].append(f"price: {e}")

    # Overview
    try:
        result["overview"] = await fetch_ticker_overview(ticker, api_key)
    except Exception as e:
        result["errors"].append(f"overview: {e}")

    # Store overview as a chunk
    if result["overview"]:
        ov = result["overview"]
        overview_chunk = [{
            "id": f"overview_{ticker}",
            "text": (
                f"{ov.get('name', ticker)} ({ticker}) is a {ov.get('sector','')} company "
                f"in the {ov.get('industry','')} industry. Market cap: {ov.get('market_cap','')}. "
                f"P/E ratio: {ov.get('pe_ratio','')}. EPS: {ov.get('eps','')}. "
                f"52-week range: {ov.get('52w_low','')} to {ov.get('52w_high','')}. "
                f"{ov.get('description','')}"
            ),
            "metadata": {"source": "filings", "ticker": ticker, "type": "overview"},
        }]
        upsert_chunks(overview_chunk, "long_term")

    # Filings
    try:
        cik = await lookup_cik(ticker)
        if cik:
            filing_chunks = await fetch_ticker_filings(ticker, cik)
            n = upsert_chunks(filing_chunks, "long_term")
            result["filings"] = n
        else:
            result["errors"].append(f"filings: no CIK found for {ticker}")
    except Exception as e:
        result["errors"].append(f"filings: {e}")

    # News
    try:
        news_chunks = await fetch_ticker_news(ticker, api_key)
        n = upsert_chunks(news_chunks, "long_term")
        add_to_episodic(news_chunks[-32:])
        result["news"] = n
    except Exception as e:
        result["errors"].append(f"news: {e}")

    print(f"[fetch] {ticker}: price={bool(result['price'])}, filings={result['filings']}, news={result['news']}")
    return result
