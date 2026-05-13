"""
Scheduler — Premium Alpha Vantage upgrade
With premium API access (75 requests/min, no daily limit):
  - Market data:   every 15 minutes (was 24h) — uses entitlement=delayed for 15-min delayed quotes
  - News:          every 2 hours (was 24h)
  - Macro (FRED):  every 6 hours (unchanged — FRED updates daily)
  - Filings (EDGAR): every 12 hours (was 4h — EDGAR doesn't update that often)
  - Memory prune:  every 12 hours (unchanged)
"""
import asyncio
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger    = logging.getLogger(__name__)
scheduler = BackgroundScheduler()

_run_log: list = []


def _log(source: str, n: int, error: str | None = None):
    _run_log.append({
        "source":    source,
        "chunks":    n,
        "error":     error,
        "timestamp": datetime.utcnow().isoformat(),
    })
    if len(_run_log) > 100:
        _run_log.pop(0)


def _run_async(coro):
    """Run an async function from a sync scheduler job."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                future.result()
        else:
            loop.run_until_complete(coro)
    except RuntimeError:
        asyncio.run(coro)


# ── Ingestion jobs ─────────────────────────────────────────────────────────────

async def _ingest_market():
    try:
        from ingestion.market import fetch_market_data_async
        from memory.store import upsert_chunks, add_to_episodic
        chunks = await fetch_market_data_async()
        n = upsert_chunks(chunks, "long_term")
        add_to_episodic(chunks[-256:])
        _log("market", n)
        print(f"[scheduler] market: {n} chunks written")
    except Exception as e:
        _log("market", 0, str(e))
        print(f"[scheduler] market error: {e}")


async def _ingest_news():
    try:
        from ingestion.news import fetch_news_feeds
        from memory.store import upsert_chunks, add_to_episodic
        chunks = await fetch_news_feeds()
        n = upsert_chunks(chunks, "long_term")
        add_to_episodic(chunks[-128:])
        _log("news", n)
        print(f"[scheduler] news: {n} chunks written")
    except Exception as e:
        _log("news", 0, str(e))
        print(f"[scheduler] news error: {e}")


async def _ingest_filings():
    try:
        from ingestion.filings import fetch_recent_filings
        from memory.store import upsert_chunks
        chunks = await fetch_recent_filings()
        n = upsert_chunks(chunks, "long_term")
        _log("filings", n)
        print(f"[scheduler] filings: {n} chunks written")
    except Exception as e:
        _log("filings", 0, str(e))
        print(f"[scheduler] filings error: {e}")


async def _ingest_macro():
    try:
        from ingestion.macro import fetch_macro_indicators
        from memory.store import upsert_chunks, add_to_episodic
        chunks = await fetch_macro_indicators()
        n = upsert_chunks(chunks, "long_term")
        add_to_episodic(chunks[-64:])
        _log("macro", n)
        print(f"[scheduler] macro: {n} chunks written")
    except Exception as e:
        _log("macro", 0, str(e))
        print(f"[scheduler] macro error: {e}")


async def _prune_memory():
    try:
        from memory.memory_manager import prune_stale_insights
        n = prune_stale_insights(max_age_days=90, max_insights=500)
        _log("prune", n)
        print(f"[scheduler] prune: removed {n} stale insights")
    except Exception as e:
        _log("prune", 0, str(e))
        print(f"[scheduler] prune error: {e}")


# ── Sync wrappers for APScheduler ─────────────────────────────────────────────

def job_market():   _run_async(_ingest_market())
def job_news():     _run_async(_ingest_news())
def job_filings():  _run_async(_ingest_filings())
def job_macro():    _run_async(_ingest_macro())
def job_prune():    _run_async(_prune_memory())


# ── Start scheduler ────────────────────────────────────────────────────────────

def start_scheduler():
    # Market data every 15 minutes — premium allows this
    scheduler.add_job(job_market,  IntervalTrigger(minutes=15), id="market",  replace_existing=True)
    # News every 2 hours — plenty of fresh articles without hammering the API
    scheduler.add_job(job_news,    IntervalTrigger(hours=2),    id="news",    replace_existing=True)
    # Filings every 12 hours — SEC EDGAR updates a few times per day at most
    scheduler.add_job(job_filings, IntervalTrigger(hours=12),   id="filings", replace_existing=True)
    # Macro every 6 hours — FRED data is daily but worth catching same-day releases
    scheduler.add_job(job_macro,   IntervalTrigger(hours=6),    id="macro",   replace_existing=True)
    # Prune stale insights every 12 hours
    scheduler.add_job(job_prune,   IntervalTrigger(hours=12),   id="prune",   replace_existing=True)

    scheduler.start()
    print("[scheduler] Started. market/15min, news/2h, filings/12h, macro/6h, prune/12h")


def get_schedule_status() -> list:
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id":       job.id,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        })
    return jobs


def get_run_log() -> list:
    return list(reversed(_run_log))
