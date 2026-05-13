"""
SEC EDGAR Filings Ingestion
Uses the EDGAR full-text search API — no API key required.
Searches by company name/ticker and fetches recent filing summaries.
"""
import httpx
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any

# EDGAR APIs — no key required, just a valid User-Agent
EDGAR_SEARCH   = "https://efts.sec.gov/LATEST/search-index"
EDGAR_COMPANY  = "https://data.sec.gov/submissions"
EDGAR_HEADERS  = {
    "User-Agent":      "ai-financial-analyst research@columbia.edu",
    "Accept":          "application/json",
    "Accept-Encoding": "gzip, deflate",
}

# Map tickers to EDGAR CIK numbers (zero-padded to 10 digits)
TICKER_TO_CIK = {
    "AAPL":  "0000320193",
    "MSFT":  "0000789019",
    "NVDA":  "0001045810",
    "TSLA":  "0001318605",
    "GOOGL": "0001652044",
    "JPM":   "0000019617",
    "GS":    "0000886982",
    "AMZN":  "0001018724",
    "META":  "0001326801",
}

FORM_TYPES  = ["10-K", "10-Q", "8-K"]
CHUNK_WORDS = 400
OVERLAP     = 60


def clean_text(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-z#0-9]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def chunk_text(text: str) -> List[str]:
    words = text.split()
    chunks, start = [], 0
    while start < len(words):
        end = min(start + CHUNK_WORDS, len(words))
        chunks.append(" ".join(words[start:end]))
        start += CHUNK_WORDS - OVERLAP
    return chunks


async def fetch_company_filings(
    ticker: str,
    cik: str,
    form_types: List[str] = FORM_TYPES,
    max_per_form: int = 3,
) -> List[Dict[str, Any]]:
    """
    Fetch recent filing metadata from EDGAR submissions API for one company.
    Returns chunked text ready for ChromaDB.
    """
    chunks = []

    async with httpx.AsyncClient(headers=EDGAR_HEADERS, timeout=30) as client:
        try:
            url  = f"{EDGAR_COMPANY}/CIK{cik}.json"
            resp = await client.get(url)
            if resp.status_code != 200:
                print(f"[filings] {ticker}: HTTP {resp.status_code} from EDGAR")
                return []

            data     = resp.json()
            name     = data.get("name", ticker)
            filings  = data.get("filings", {}).get("recent", {})

            forms    = filings.get("form",        [])
            dates    = filings.get("filingDate",  [])
            accnos   = filings.get("accessionNumber", [])
            descs    = filings.get("primaryDocument",  [])

            for form_type in form_types:
                count = 0
                for i, form in enumerate(forms):
                    if count >= max_per_form:
                        break
                    if form != form_type:
                        continue

                    filing_date = dates[i] if i < len(dates) else "unknown"
                    accession   = accnos[i] if i < len(accnos) else ""

                    # Build a descriptive text block from metadata
                    text = (
                        f"{name} ({ticker}) filed a {form_type} with the SEC on {filing_date}. "
                        f"Accession number: {accession}. "
                        f"This is a {_form_description(form_type)} filing for {name}, "
                        f"a company in the financial markets with ticker symbol {ticker}."
                    )

                    for j, chunk in enumerate(chunk_text(text)):
                        chunks.append({
                            "id": f"filing_{cik}_{accession.replace('-','')}_{j}",
                            "text": chunk,
                            "metadata": {
                                "source":       "filings",
                                "ticker":       ticker,
                                "company":      name,
                                "form_type":    form_type,
                                "filing_date":  filing_date,
                                "accession":    accession,
                                "chunk_index":  j,
                            },
                        })
                    count += 1

        except Exception as e:
            print(f"[filings] {ticker} error: {e}")

    return chunks


def _form_description(form: str) -> str:
    return {
        "10-K": "annual report",
        "10-Q": "quarterly report",
        "8-K":  "current report (material event)",
    }.get(form, "SEC")


async def fetch_recent_filings(
    tickers: List[str] | None = None,
    form_types: List[str] = FORM_TYPES,
    days_back: int = 90,
) -> List[Dict[str, Any]]:
    """
    Fetch filings for all configured tickers from EDGAR.
    Uses hardcoded CIK map — no network lookup needed.
    """
    if not tickers:
        tickers = list(TICKER_TO_CIK.keys())

    all_chunks = []

    for ticker in tickers:
        cik = TICKER_TO_CIK.get(ticker.upper())
        if not cik:
            print(f"[filings] No CIK for {ticker}, skipping")
            continue

        print(f"[filings] Fetching {ticker} (CIK {cik})...")
        chunks = await fetch_company_filings(ticker, cik, form_types)
        all_chunks.extend(chunks)
        print(f"[filings] {ticker}: {len(chunks)} chunks")

    print(f"[filings] Total: {len(all_chunks)} chunks across {len(tickers)} tickers")
    return all_chunks
