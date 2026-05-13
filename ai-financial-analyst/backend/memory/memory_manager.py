"""
Memory Manager v2 — fixes pruning ChromaDB error.
The col.get() call previously passed include=["ids"] which is invalid.
IDs are always returned by ChromaDB without needing to be specified.
"""
import time
import math
from typing import List, Dict, Any
from memory.store import get_collection

DECAY_HALF_LIFE_DAYS       = 30
MARKET_DATA_HALF_LIFE_DAYS = 7


def staleness_penalty(timestamp_str: str, source: str) -> float:
    try:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%SZ", "%Y%m%dT%H%M%S"):
            try:
                ts = time.strptime(timestamp_str, fmt)
                age_days = (time.time() - time.mktime(ts)) / 86400
                break
            except ValueError:
                continue
        else:
            return 1.0
    except Exception:
        return 1.0
    half_life = MARKET_DATA_HALF_LIFE_DAYS if source == "market" else DECAY_HALF_LIFE_DAYS
    return max(math.pow(0.5, age_days / half_life), 0.05)


def apply_staleness_to_chunks(chunks: List[Dict]) -> List[Dict]:
    for chunk in chunks:
        meta      = chunk.get("metadata", {})
        source    = meta.get("source", "unknown")
        timestamp = meta.get("timestamp") or meta.get("pub_date") or meta.get("date", "")
        penalty   = staleness_penalty(str(timestamp), source)
        chunk["distance"] = min(chunk.get("distance", 0.5) / penalty, 2.0)
    return chunks


def jaccard_similarity(a: str, b: str) -> float:
    wa, wb = set(a.lower().split()), set(b.lower().split())
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)


def deduplicate_chunks(chunks: List[Dict], threshold: float = 0.72) -> List[Dict]:
    kept = []
    for candidate in chunks:
        is_dup = False
        for existing in kept:
            if jaccard_similarity(candidate["text"], existing["text"]) >= threshold:
                is_dup = True
                if candidate.get("distance", 1.0) < existing.get("distance", 1.0):
                    kept.remove(existing)
                    kept.append(candidate)
                break
        if not is_dup:
            kept.append(candidate)
    return kept


def order_for_context_window(chunks: List[Dict]) -> List[Dict]:
    if len(chunks) <= 2:
        return chunks
    s = sorted(chunks, key=lambda x: x.get("distance", 1.0))
    if len(s) <= 3:
        return s
    priority = ["market", "filings", "news", "macro", "insights"]
    middle   = sorted(s[2:], key=lambda c: priority.index(c["metadata"].get("source", "insights")) if c["metadata"].get("source") in priority else 99)
    return [s[0]] + middle + [s[1]]


def prune_stale_insights(max_age_days: int = 90, max_insights: int = 500) -> int:
    """
    Delete insight chunks older than max_age_days or beyond max_insights count.
    Uses col.get() with no include parameter — IDs are always returned by ChromaDB.
    """
    try:
        col      = get_collection("long_term")
        all_data = col.get()   # ids and metadatas returned by default

        insight_ids_with_age = []
        for i, meta in enumerate(all_data.get("metadatas") or []):
            if meta.get("source") != "insights":
                continue
            chunk_id  = all_data["ids"][i]
            timestamp = meta.get("timestamp", "")
            penalty   = staleness_penalty(timestamp, "insights")
            age_days  = -DECAY_HALF_LIFE_DAYS * math.log2(max(penalty, 1e-10))
            insight_ids_with_age.append((chunk_id, age_days))

        insight_ids_with_age.sort(key=lambda x: x[1], reverse=True)
        to_delete = [id_ for id_, age in insight_ids_with_age if age > max_age_days]

        remaining = [x for x in insight_ids_with_age if x[0] not in to_delete]
        if len(remaining) > max_insights:
            to_delete.extend([x[0] for x in remaining[max_insights:]])

        if to_delete:
            col.delete(ids=to_delete)
            print(f"[memory_manager] Pruned {len(to_delete)} stale insights")

        return len(to_delete)
    except Exception as e:
        print(f"[memory_manager] Pruning error: {e}")
        return 0


def process_retrieved_chunks(chunks: List[Dict]) -> List[Dict]:
    if not chunks:
        return chunks
    chunks = apply_staleness_to_chunks(chunks)
    chunks = deduplicate_chunks(chunks)
    chunks = sorted(chunks, key=lambda x: x.get("distance", 1.0))
    chunks = order_for_context_window(chunks)
    return chunks
