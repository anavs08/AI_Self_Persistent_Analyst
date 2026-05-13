# AI Financial Analyst — Self-Persistent Learning System

> EECS E6895 Advanced Big Data and AI · Columbia University · Anav Srinivas

A self-persistent AI financial analyst that continuously learns from its own interactions. Every analyst response is embedded and written back into a ChromaDB vector store, enriching future queries through a **Retrieval-Augmented Continual Learning (RACL)** feedback loop.

**Demo:** https://www.youtube.com/watch?v=T7xpqOItEoA

---

## What it does

- Ingests real financial data from 4 public APIs on a continuous schedule
- Answers financial questions using Claude Sonnet with RAG over a local ChromaDB store
- Stores every analyst response as an insight chunk — retrieved in future queries
- Invokes 9 quantitative financial tools automatically (DCF, CAPM, Sharpe, VaR, WACC, etc.)
- Applies staleness decay, Jaccard deduplication, and context-window ordering to maintain retrieval quality
- Evaluates itself with Precision@5, MRR, LLM-as-judge faithfulness, and an A/B self-persistence test

---

## System Architecture

```
Data Sources          Memory Layer              Reasoning
─────────────         ─────────────────         ──────────────────
Alpha Vantage  ──┐    Long-Term Store   ──┐     RAG Retriever
SEC EDGAR      ──┼──► Episodic Buffer   ──┼───► Claude Sonnet ──► Response
FRED API       ──┤    Insight Store  ◄──┘       9 Financial Tools    │
AV News        ──┘    (self-generated)                               │
                       ▲                                             │
                       └─────── Embed + Tag ◄────────────────────────┘
                                (RACL feedback loop)
```

---

## Repository Structure

```
ai-financial-analyst/
├── backend/
│   ├── api/
│   │   └── routes.py          # All FastAPI endpoints
│   ├── ingestion/
│   │   ├── market.py          # Alpha Vantage OHLCV
│   │   ├── filings.py         # SEC EDGAR
│   │   ├── news.py            # AV News Sentiment
│   │   ├── macro.py           # FRED macro indicators
│   │   └── on_demand.py       # Any-ticker fetch
│   ├── memory/
│   │   ├── store.py           # ChromaDB collections
│   │   ├── retriever.py       # RAG retrieval + prompt builder
│   │   ├── session_memory.py  # Insight store writer
│   │   └── memory_manager.py  # Staleness decay + pruning
│   ├── tools/
│   │   └── finance.py         # 9 financial calculation tools
│   ├── evaluation/
│   │   └── question_bank.py   # 50-question benchmark bank
│   ├── enhanced_eval.py       # Precision@5, MRR, faithfulness, A/B test
│   ├── scheduler.py           # APScheduler ingestion jobs
│   ├── main.py                # FastAPI app entry point
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── app/
    │   └── page.tsx           # Root layout + tab routing
    └── components/
        ├── Sidebar.tsx        # Navigation
        ├── DataSources.tsx    # Ingestion control + live counts
        ├── MemoryMonitor.tsx  # Insight store browser
        ├── Chat.tsx           # Streaming analyst chat
        ├── TickerFetch.tsx    # On-demand ticker ingestion
        └── Evaluation.tsx     # Benchmark suite UI
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- API keys for: [Alpha Vantage](https://www.alphavantage.co/) (premium recommended), [FRED](https://fred.stlouisfed.org/docs/api/fred/), [Anthropic](https://console.anthropic.com/)

---

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/ai-financial-analyst.git
cd ai-financial-analyst
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create your `.env` file:

```bash
cp .env.example .env
```

Fill in `.env`:

```env
ALPHA_VANTAGE_KEY=your_key_here
FRED_API_KEY=your_key_here
ANTHROPIC_API_KEY=sk-ant-...
CHROMA_PATH=./data/chroma_db
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

### Ingesting Data

Go to the **Data Sources** tab and click **Run Now** on any source, or wait for the scheduler to run automatically:

| Source | Schedule | Content |
|--------|----------|---------|
| Alpha Vantage | Every 15 min | OHLCV for 9 tickers |
| AV News | Every 2 h | News sentiment per ticker |
| FRED API | Every 6 h | CPI, GDP, Fed Funds, VIX |
| SEC EDGAR | Every 12 h | 10-K, 10-Q, 8-K filings |

### Chatting with the Analyst

Go to the **Analyst Chat** tab and ask any financial question. The analyst will:
- Retrieve relevant chunks from the vector store
- Invoke financial tools automatically for quantitative questions
- Store its response back into ChromaDB for future retrieval

Example questions:
```
"What has NVDA's price trend been over the last month?"
"Calculate AAPL's expected return using CAPM with beta 1.2"
"What does the current yield curve signal about recession risk?"
"Run a DCF on AMZN assuming FCF growth of 15% for 5 years and 10% WACC"
```

### Fetching Any Ticker On-Demand

Go to the **Fetch Ticker** tab, type any ticker symbol (e.g. `PLTR`, `COIN`, `SNOW`) and click Fetch. The system retrieves price, overview, filings, and news in one call.

### Running Evaluations

Go to the **Evaluation** tab. Three benchmark suites:

| Panel | What it measures |
|-------|-----------------|
| Retrieval Quality | Precision@5, MRR, relevance, source hit rate across 10 labelled queries |
| Faithfulness | LLM-as-judge claim verification against retrieved context (4 questions, ~60s) |
| A/B Self-Persistence | Retrieval WITH vs WITHOUT insight store — directly measures RACL loop contribution |

---

## Financial Tools

The analyst invokes these automatically via the Anthropic tool-use API:

| Tool | Description |
|------|-------------|
| `dcf_valuation` | Discounted Cash Flow with terminal value |
| `dividend_discount_model` | Gordon Growth Model |
| `capm_expected_return` | Capital Asset Pricing Model |
| `sharpe_ratio` | Risk-adjusted return |
| `value_at_risk` | Parametric VaR at configurable confidence |
| `bond_pricing` | Price + Macaulay Duration |
| `wacc_calculator` | Weighted Average Cost of Capital |
| `pe_fair_value` | P/E fair value + PEG ratio |
| `portfolio_metrics` | Return, volatility, Sharpe for a portfolio |

---

## Evaluation Results

Results from a live system after one week of operation:

| Metric | Value |
|--------|-------|
| Precision@5 | 0.927 |
| Mean Reciprocal Rank | 1.000 |
| Avg Faithfulness (LLM-as-judge) | 0.49 |
| Tool Compliance | 1.00 |
| A/B ΔPrecision@5 (with vs without insights) | +0.280 |
| A/B ΔMRR | +0.150 |

The +28% Precision@5 improvement in the A/B test is direct empirical evidence that the RACL self-persistence loop improves retrieval quality over time.

---

## API Reference

Base URL: `http://localhost:8000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | System status + insight count |
| GET | `/prices` | Latest prices for ticker list |
| POST | `/ingest` | Trigger source ingestion |
| GET | `/ingest/status` | Chunk counts per source |
| POST | `/fetch/ticker` | On-demand ticker ingestion |
| POST | `/chat` | RAG chat (non-streaming) |
| POST | `/chat/stream` | SSE streaming chat |
| GET | `/insights` | All stored insights with tags |
| POST | `/memory/prune` | Prune stale insights |
| POST | `/eval/enhanced/retrieval` | Run Precision@5 + MRR benchmark |
| POST | `/eval/faithfulness` | Run LLM-as-judge evaluation |
| POST | `/eval/ab_persistence` | Run A/B self-persistence test |
| GET | `/eval/memory_health` | Memory health metrics |
| GET | `/scheduler/status` | Scheduler job next-run times |

Full interactive docs: `http://localhost:8000/docs`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | Claude Sonnet (`claude-sonnet-4-5`) via Anthropic API |
| Vector Store | ChromaDB (local) |
| Embeddings | `all-MiniLM-L6-v2` (sentence-transformers) |
| Backend | Python 3.11, FastAPI, APScheduler |
| Frontend | Next.js 14, TypeScript, Recharts |
| Data | Alpha Vantage (premium), SEC EDGAR, FRED, AV News |

---
