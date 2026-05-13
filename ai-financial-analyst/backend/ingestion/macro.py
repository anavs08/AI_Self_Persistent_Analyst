"""
Macro Indicators Ingestion
Fetches economic data from the FRED API (Federal Reserve Economic Data).
Converts observations into descriptive text chunks for the vector store.
"""
import httpx
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any

FRED_BASE = "https://api.stlouisfed.org/fred"

# Key FRED series to track
SERIES = [
    {"id": "CPIAUCSL",  "name": "CPI (All Urban Consumers)",        "unit": "index"},
    {"id": "FEDFUNDS",  "name": "Federal Funds Effective Rate",     "unit": "%"},
    {"id": "GDP",       "name": "Gross Domestic Product",           "unit": "billions USD"},
    {"id": "UNRATE",    "name": "Unemployment Rate",                "unit": "%"},
    {"id": "PCE",       "name": "Personal Consumption Expenditures","unit": "billions USD"},
    {"id": "T10Y2Y",    "name": "10-Year minus 2-Year Treasury Spread","unit": "%"},
    {"id": "VIXCLS",    "name": "CBOE Volatility Index (VIX)",      "unit": "index"},
    {"id": "DGS10",     "name": "10-Year Treasury Constant Maturity","unit": "%"},
]


async def fetch_macro_indicators(
    series: List[Dict] = SERIES,
    observations_back: int = 12,
    fred_api_key: str | None = None,
) -> List[Dict[str, Any]]:
    """
    Fetch recent observations for each FRED series and convert to text chunks.

    Args:
        series:            List of FRED series configs.
        observations_back: Number of recent observations to fetch per series.
        fred_api_key:      FRED API key. Falls back to FRED_API_KEY env var.
                           Without a key, uses the public demo endpoint (rate limited).

    Returns:
        List of dicts with keys: id, text, metadata
    """
    api_key = fred_api_key or os.getenv("FRED_API_KEY", "")
    chunks = []
    end = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=observations_back * 35)).strftime("%Y-%m-%d")

    async with httpx.AsyncClient(timeout=20) as client:
        for s in series:
            try:
                params = {
                    "series_id":        s["id"],
                    "observation_start": start,
                    "observation_end":   end,
                    "sort_order":        "desc",
                    "limit":             observations_back,
                    "file_type":         "json",
                }
                if api_key:
                    params["api_key"] = api_key

                resp = await client.get(f"{FRED_BASE}/series/observations", params=params)
                if resp.status_code != 200:
                    print(f"[macro] {s['id']}: HTTP {resp.status_code}")
                    continue

                data = resp.json()
                observations = data.get("observations", [])

                for obs in observations:
                    date = obs.get("date", "unknown")
                    value = obs.get("value", ".")
                    if value == ".":
                        continue  # FRED uses "." for missing

                    text = (
                        f"Macro indicator: {s['name']} ({s['id']}) "
                        f"on {date} was {value} {s['unit']}."
                    )
                    chunks.append({
                        "id": f"macro_{s['id']}_{date}",
                        "text": text,
                        "metadata": {
                            "source":    "macro",
                            "series_id": s["id"],
                            "name":      s["name"],
                            "unit":      s["unit"],
                            "date":      date,
                            "value":     float(value),
                        },
                    })

            except Exception as e:
                print(f"[macro] Error fetching {s['id']}: {e}")

    print(f"[macro] Ingested {len(chunks)} macro observations")
    return chunks
