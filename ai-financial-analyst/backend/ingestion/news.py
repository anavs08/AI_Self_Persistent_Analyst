"""
Financial News Ingestion — Alpha Vantage News Sentiment API
Fetches news per ticker individually to avoid empty combined results.
"""
import httpx
import os
import hashlib
import asyncio
from datetime import datetime
from typing import List, Dict, Any

BASE_URL     = "https://www.alphavantage.co/query"
NEWS_TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL"]  # 5 calls, one per ticker
CHUNK_WORDS  = 300
OVERLAP      = 50


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


async def fetch_ticker_news(ticker: str, api_key: str, limit: int = 10) -> List[Dict]:
    """Fetch news for a single ticker."""
    url = (
        f"{BASE_URL}?function=NEWS_SENTIMENT"
        f"&tickers={ticker}"
        f"&limit={limit}"
        f"&sort=LATEST"
        f"&apikey={api_key}"
    )
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    if "Note" in data or "Information" in data:
        print(f"[news] Rate limit hit for {ticker}")
        return []
    if "Error Message" in data:
        print(f"[news] Error for {ticker}: {data['Error Message']}")
        return []

    articles = data.get("feed", [])
    print(f"[news] {ticker}: {len(articles)} articles")
    return articles


async def fetch_news_feeds(
    tickers: List[str] = NEWS_TICKERS,
    limit_per_ticker: int = 10,
) -> List[Dict[str, Any]]:
    """
    Fetch news for each ticker individually.
    5 tickers x 10 articles = up to 50 articles, using 5 API calls.
    Spaces calls 13 seconds apart to respect the 5/min rate limit.
    """
    api_key   = get_api_key()
    all_articles = []
    seen_urls    = set()

    for i, ticker in enumerate(tickers):
        articles = await fetch_ticker_news(ticker, api_key, limit_per_ticker)
        for a in articles:
            url = a.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_articles.append(a)
        # Rate limit spacing — skip delay after last ticker
        if i < len(tickers) - 1:
            await asyncio.sleep(13)

    print(f"[news] Total unique articles: {len(all_articles)}")

    chunks = []
    for article in all_articles:
        url_a    = article.get("url", "")
        title    = article.get("title", "")
        summary  = article.get("summary", "")
        source   = article.get("source", "Unknown")
        pub_date = article.get("time_published", str(datetime.utcnow()))

        if not title:
            continue

        sentiment       = article.get("overall_sentiment_label", "Neutral")
        sentiment_score = article.get("overall_sentiment_score", 0)
        ticker_mentions = ", ".join(
            f"{t['ticker']} ({t['ticker_sentiment_label']})"
            for t in article.get("ticker_sentiment", [])[:5]
        )

        full_text = (
            f"{title}. {summary} "
            f"Overall sentiment: {sentiment} (score: {sentiment_score:.3f}). "
            f"Tickers mentioned: {ticker_mentions}."
        )

        for j, chunk in enumerate(chunk_text(full_text)):
            chunks.append({
                "id": f"news_{hashlib.sha256(url_a.encode()).hexdigest()[:16]}_{j}",
                "text": f"Financial news from {source} published {pub_date}: {chunk}",
                "metadata": {
                    "source":          "news",
                    "feed":            source,
                    "title":           title,
                    "url":             url_a,
                    "pub_date":        pub_date,
                    "sentiment":       sentiment,
                    "sentiment_score": float(sentiment_score),
                    "chunk_index":     j,
                },
            })

    print(f"[news] Ingested {len(chunks)} chunks from {len(all_articles)} articles")
    return chunks
