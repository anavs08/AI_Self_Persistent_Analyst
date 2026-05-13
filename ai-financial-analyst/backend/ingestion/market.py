"""
Market Data Ingestion — Alpha Vantage Premium
Uses entitlement=delayed for 15-minute delayed US equity data.
With premium (75 req/min) we can fetch all 9 tickers quickly.
"""
import httpx
import asyncio
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any

BASE_URL = "https://www.alphavantage.co/query"

DEFAULT_TICKERS = [
    "AAPL", "MSFT", "NVDA", "TSLA", "GOOGL",
    "JPM", "GS", "AMZN", "META",
]

CHUNK_WORDS = 300
OVERLAP     = 50


def get_api_key() -> str:
    key = os.getenv("ALPHA_VANTAGE_KEY", "")
    if not key:
        raise ValueError("ALPHA_VANTAGE_KEY not set in backend/.env")
    return key


def chunk_text(text: str) -> List[str]:
    words = text.split()
    chunks, start = [], 0
    while start < len(words):
        end = min(start + CHUNK_WORDS, len(words))
        chunks.append(" ".join(words[start:end]))
        start += CHUNK_WORDS - OVERLAP
    return chunks


async def fetch_ticker_daily(
    ticker: str,
    api_key: str,
    outputsize: str = "compact",
) -> List[Dict[str, Any]]:
    """
    Fetch daily OHLCV time series for one ticker.
    Premium: uses entitlement=delayed for 15-min delayed data.
    compact = last 100 trading days.
    """
    params = {
        "function":    "TIME_SERIES_DAILY",
        "symbol":      ticker,
        "outputsize":  outputsize,
        "apikey":      api_key,
        "entitlement": "delayed",   # Premium: 15-min delayed US equity data
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(BASE_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    if "Note" in data or "Information" in data:
        msg = data.get("Note") or data.get("Information", "")
        print(f"[market] {ticker} rate limit: {msg[:80]}")
        return []

    if "Error Message" in data:
        print(f"[market] {ticker} error: {data['Error Message']}")
        return []

    ts = data.get("Time Series (Daily)", {})
    if not ts:
        print(f"[market] {ticker}: no time series data")
        return []

    chunks  = []
    entries = sorted(ts.items(), reverse=True)[:30]  # last 30 trading days

    for date_str, ohlcv in entries:
        try:
            open_p  = float(ohlcv["1. open"])
            high_p  = float(ohlcv["2. high"])
            low_p   = float(ohlcv["3. low"])
            close_p = float(ohlcv["4. close"])
            volume  = int(ohlcv["5. volume"])
            change  = round(close_p - open_p, 2)
            chg_pct = round((change / open_p) * 100, 2) if open_p else 0
        except (KeyError, ValueError):
            continue

        text = (
            f"{ticker} on {date_str}: open ${open_p:.2f}, high ${high_p:.2f}, "
            f"low ${low_p:.2f}, close ${close_p:.2f}, volume {volume:,}. "
            f"Daily change: {'+'if change>=0 else ''}{change:.2f} ({chg_pct:+.2f}%)."
        )

        for j, chunk in enumerate(chunk_text(text)):
            chunks.append({
                "id": f"market_{ticker}_{date_str}_{j}",
                "text": chunk,
                "metadata": {
                    "source":    "market",
                    "ticker":    ticker,
                    "date":      date_str,
                    "close":     close_p,
                    "volume":    volume,
                    "change_pct":chg_pct,
                },
            })

    print(f"[market] {ticker}: {len(chunks)} chunks ({len(entries)} days)")
    return chunks


async def fetch_market_data_async(
    tickers: List[str] = DEFAULT_TICKERS,
    delay_between: float = 1.0,   # Premium: 75 req/min so 1s spacing is safe
) -> List[Dict[str, Any]]:
    """
    Fetch daily OHLCV for all tickers.
    Premium allows ~75 requests/minute so we use 1s spacing (conservative).
    """
    api_key    = get_api_key()
    all_chunks = []

    for i, ticker in enumerate(tickers):
        chunks = await fetch_ticker_daily(ticker, api_key)
        all_chunks.extend(chunks)
        if i < len(tickers) - 1:
            await asyncio.sleep(delay_between)

    print(f"[market] Total: {len(all_chunks)} chunks across {len(tickers)} tickers")
    return all_chunks


async def get_latest_prices_async(tickers: List[str]) -> Dict[str, Any]:
    """
    Get the most recent closing price for each ticker via GLOBAL_QUOTE.
    Used by the price ticker bar in the frontend.
    """
    api_key = get_api_key()
    prices  = {}

    async with httpx.AsyncClient(timeout=20) as client:
        for ticker in tickers[:10]:   # cap at 10 for the ticker bar
            try:
                resp = await client.get(BASE_URL, params={
                    "function":    "GLOBAL_QUOTE",
                    "symbol":      ticker,
                    "apikey":      api_key,
                    "entitlement": "delayed",
                })
                resp.raise_for_status()
                data  = resp.json()
                quote = data.get("Global Quote", {})
                if "05. price" in quote:
                    prices[ticker] = {
                        "price":      float(quote["05. price"]),
                        "change_pct": quote["10. change percent"].replace("%",""),
                    }
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"[market] price error {ticker}: {e}")

    return prices
