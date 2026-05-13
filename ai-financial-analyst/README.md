# AI Financial Analyst — Self-Persistent Learning System

An AI financial analyst that continuously learns from market data, SEC filings,
and financial news using LoRA continual fine-tuning on Mistral-7B.

---

## Architecture

```
Data Sources          Processing Layer         Reasoning & Output
─────────────         ─────────────────        ──────────────────
Market Data    ──►    Data Ingestion    ──►    Reasoning Engine
SEC Filings    ──►    & Embedding       ──►    (Mistral-7B + LoRA)
Financial News ──►                      ──►    Analyst Output
Macro (FRED)   ──►    Memory Layer      ──►    (Reports / Chat)
                      ├─ Long-Term VDB          │
                      ├─ Episodic Buffer         │
                      └─ Replay Buffer  ◄────────┘ (feedback loop)
```

**Stack**
| Layer | Technology |
|-------|-----------|
| UI | Next.js 14 (App Router) + Tailwind |
| Backend API | FastAPI (Python) |
| Vector Store | ChromaDB (local persistent) |
| Embeddings | all-MiniLM-L6-v2 (sentence-transformers) |
| Base Model | Mistral-7B-Instruct-v0.3 |
| Fine-Tuning | PEFT / LoRA via HuggingFace |
| Market Data | yfinance |
| Filings | SEC EDGAR API |
| News | RSS (Reuters, FT, WSJ, Yahoo Finance) |
| Macro | FRED API (St. Louis Fed) |

---

## Project Structure

```
ai-financial-analyst/
├── frontend/                   # Next.js app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Root — sidebar + view router
│   │   └── globals.css
│   ├── components/
│   │   ├── Sidebar.tsx         # Nav + system status
│   │   ├── Dashboard.tsx       # Ticker tape, metrics, charts
│   │   ├── DataSources.tsx     # Per-source ingestion control
│   │   ├── Training.tsx        # LoRA config + loss chart
│   │   └── Chat.tsx            # RAG-augmented analyst chat
│   ├── .env.local
│   └── package.json
│
├── backend/                    # FastAPI app
│   ├── main.py                 # App entry point + CORS
│   ├── requirements.txt
│   ├── .env
│   ├── ingestion/
│   │   ├── market.py           # yfinance OHLCV fetcher
│   │   ├── filings.py          # SEC EDGAR async fetcher
│   │   ├── news.py             # RSS feed ingestion
│   │   └── macro.py            # FRED macro indicators
│   ├── memory/
│   │   ├── store.py            # ChromaDB interface (3 collections)
│   │   └── retriever.py        # RAG retriever + prompt builder
│   ├── api/
│   │   └── routes.py           # All /api/v1/* endpoints
│   └── data/
│       └── chromadb/           # Persistent vector store (auto-created)
│
└── README.md
```

---

## Quick Start

### 1. Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure env
cp .env.example .env
# Edit .env — add FRED_API_KEY if you have one (free at fred.stlouisfed.org)

# Start the API
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy env
cp .env.local.example .env.local

# Start dev server
npm run dev
```

Open: http://localhost:3000

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | System health check |
| GET | /api/v1/status | Memory stats + model info |
| GET | /api/v1/prices | Latest ticker prices |
| POST | /api/v1/ingest | Trigger ingestion for a source |
| GET | /api/v1/ingest/status | Record counts per source |
| POST | /api/v1/chat | RAG-augmented analyst query |
| POST | /api/v1/train/start | Start LoRA fine-tuning run |
| GET | /api/v1/train/history | Past training run metadata |

### Example: Trigger market data ingestion

```bash
curl -X POST http://localhost:8000/api/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{"source": "market", "tickers": ["AAPL","MSFT","NVDA"], "period": "5d"}'
```

### Example: Chat query

```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What do recent NVDA earnings say about AI demand?"}'
```

---

## Adding the Model

The backend is ready to serve a local Mistral-7B model. Two options:

### Option A: llama-cpp-python (CPU-friendly, GGUF)

```bash
pip install llama-cpp-python
# Download GGUF from HuggingFace:
# https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.3-GGUF
# Place in: backend/models/mistral-7b-instruct-v0.3.Q4_K_M.gguf
```

Then uncomment the llama-cpp block in `api/routes.py`.

### Option B: HuggingFace Transformers + LoRA (GPU required)

```bash
pip install torch transformers peft accelerate bitsandbytes
# Model downloads automatically on first run via HuggingFace hub
```

Then uncomment the HuggingFace block in `api/routes.py`.

---

## Running a Training Run

Once data is ingested into ChromaDB:

1. Open the **Training** tab in the UI
2. Adjust LoRA rank, learning rate, and steps
3. Click **Start Run**

Or via API:

```bash
curl -X POST http://localhost:8000/api/v1/train/start \
  -H "Content-Type: application/json" \
  -d '{"lora_rank": 16, "learning_rate": 2e-4, "max_steps": 500, "batch_size": 4}'
```

The training pipeline:
1. Samples the replay buffer from ChromaDB (prevents catastrophic forgetting)
2. Combines replay samples with new ingested chunks
3. Runs LoRA fine-tuning for the configured steps
4. Saves the adapter to `backend/models/mistral-analyst-vN/`

---

## Environment Variables

### Backend (`backend/.env`)

```env
CHROMA_PATH=./data/chromadb
FRED_API_KEY=                  # Optional — free at fred.stlouisfed.org
MODEL_PATH=./models/mistral-7b-instruct-v0.3.Q4_K_M.gguf
LORA_ADAPTER_PATH=./models/mistral-analyst-v7
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## Continual Learning Strategy

To prevent catastrophic forgetting during LoRA fine-tuning:

1. **Replay Buffer** — `memory/store.py::sample_replay_buffer()` randomly samples
   previously ingested chunks and mixes them into each training batch.
2. **Elastic Weight Consolidation (EWC)** — planned for v0.2: penalizes changes
   to weights that were important for previous tasks.
3. **Episodic Buffer** — the 2K most recent chunks are kept in a separate
   collection for fast recent-context retrieval during inference.

---

## Roadmap

- [ ] v0.1 — UI + ingestion pipeline (current)
- [ ] v0.2 — Live Mistral inference via llama-cpp-python
- [ ] v0.3 — Automated LoRA training on ingestion schedule
- [ ] v0.4 — EWC regularization + per-task adapters
- [ ] v0.5 — Streaming chat responses (SSE)
- [ ] v0.6 — Portfolio tracking + signal generation
