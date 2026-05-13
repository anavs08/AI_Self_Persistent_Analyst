"""
ChromaDB Memory Layer
Manages three collections mirroring the architecture slide:
  - long_term   : persistent semantic memory (all ingested chunks)
  - episodic    : short-term recent context window
  - replay      : training replay buffer (sampled chunks for LoRA runs)

Embedding is handled by chromadb's default all-MiniLM-L6-v2 via
sentence-transformers (dim=384). Swap the embedding_function for
a larger model (e.g. BAAI/bge-large-en) when GPU is available.
"""
import chromadb
from chromadb.utils import embedding_functions
from typing import List, Dict, Any, Optional
import os
import random

DB_PATH = os.getenv("CHROMA_PATH", "./data/chromadb")

# Use the default SentenceTransformer embedding (all-MiniLM-L6-v2)
# This runs on CPU with no API key required.
_ef = embedding_functions.DefaultEmbeddingFunction()


def get_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(path=DB_PATH)


def get_collection(name: str) -> chromadb.Collection:
    client = get_client()
    return client.get_or_create_collection(
        name=name,
        embedding_function=_ef,
        metadata={"hnsw:space": "cosine"},
    )


# ── Public API ────────────────────────────────────────────────────────────────

def upsert_chunks(
    chunks: List[Dict[str, Any]],
    collection_name: str = "long_term",
) -> int:
    """
    Upsert a list of chunks into a ChromaDB collection.
    Each chunk must have: id (str), text (str), metadata (dict).
    Returns the number of chunks written.
    """
    if not chunks:
        return 0

    col = get_collection(collection_name)

    # ChromaDB upsert in batches of 512 to avoid memory spikes
    batch_size = 512
    written = 0
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        col.upsert(
            ids       = [c["id"] for c in batch],
            documents = [c["text"] for c in batch],
            metadatas = [c["metadata"] for c in batch],
        )
        written += len(batch)

    return written


def query(
    query_text: str,
    collection_name: str = "long_term",
    n_results: int = 8,
    where: Optional[Dict] = None,
) -> List[Dict[str, Any]]:
    """
    Semantic search against a collection.

    Returns:
        List of dicts with keys: id, text, metadata, distance
    """
    col = get_collection(collection_name)
    kwargs: Dict[str, Any] = {
        "query_texts": [query_text],
        "n_results": n_results,
    }
    if where:
        kwargs["where"] = where

    results = col.query(**kwargs)
    out = []
    for i, doc in enumerate(results["documents"][0]):
        out.append({
            "id":       results["ids"][0][i],
            "text":     doc,
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        })
    return out


def add_to_episodic(chunks: List[Dict[str, Any]], max_size: int = 2048) -> int:
    """
    Add recent chunks to the episodic buffer.
    Trims the oldest entries when the buffer exceeds max_size.
    """
    col = get_collection("episodic")
    current_count = col.count()

    # Trim if needed
    if current_count + len(chunks) > max_size:
        to_delete = current_count + len(chunks) - max_size
        existing = col.get(limit=to_delete)
        if existing["ids"]:
            col.delete(ids=existing["ids"])

    return upsert_chunks(chunks, "episodic")


def sample_replay_buffer(n: int = 256) -> List[Dict[str, Any]]:
    """
    Sample n random chunks from long_term store for the replay buffer.
    Used during LoRA fine-tuning to prevent catastrophic forgetting.
    """
    col = get_collection("long_term")
    total = col.count()
    if total == 0:
        return []

    n = min(n, total)
    all_ids = col.get(limit=total)["ids"]
    sampled_ids = random.sample(all_ids, n)
    result = col.get(ids=sampled_ids, include=["documents", "metadatas"])

    return [
        {"id": rid, "text": doc, "metadata": meta}
        for rid, doc, meta in zip(
            result["ids"], result["documents"], result["metadatas"]
        )
    ]


def collection_stats() -> Dict[str, Any]:
    """Return count and metadata for all three collections."""
    stats = {}
    for name in ("long_term", "episodic", "replay"):
        try:
            col = get_collection(name)
            stats[name] = {"count": col.count()}
        except Exception as e:
            stats[name] = {"count": 0, "error": str(e)}
    return stats
