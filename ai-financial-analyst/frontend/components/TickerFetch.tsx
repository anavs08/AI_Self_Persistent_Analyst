
"use client";
import { useState } from "react";
import { Search, TrendingUp, FileText, Rss, Database, CheckCircle, AlertCircle, Loader } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type FetchResult = {
  ticker: string;
  price: Record<string, any>;
  overview: Record<string, any>;
  filings: number;
  news: number;
  errors: string[];
};

const PRESET_TICKERS = ["AAPL","MSFT","NVDA","TSLA","GOOGL","JPM","GS","AMZN","META","AMD","INTC","NFLX","COIN","PLTR","V","JNJ","KO","PEP"];

export default function TickerFetch() {
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<FetchResult[]>([]);
  const [error,   setError]   = useState<string | null>(null);

  const fetchTicker = async (ticker: string) => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(t);
    setError(null);
    try {
      const resp = await fetch(`${API}/fetch/ticker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: FetchResult = await resp.json();
      setResults(prev => {
        const filtered = prev.filter(r => r.ticker !== t);
        return [data, ...filtered];
      });
    } catch (err: any) {
      setError(`Failed to fetch ${t}: ${err.message}`);
    } finally {
      setLoading(null);
      setInput("");
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchTicker(input);
  };

  return (
    <div style={{ height: "100%", overflow: "auto", padding: 24 }}>
      <div className="fade-in" style={{ marginBottom: 20 }}>
        <h1 className="font-display" style={{ fontSize: 22, fontWeight: 800 }}>Ticker Data Fetcher</h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          Fetch real-time price, company overview, SEC filings, and news for any ticker and store in ChromaDB
        </p>
      </div>

      {/* Search bar */}
      <div className="fade-in-1" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>Enter any ticker symbol to fetch and ingest its data</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "var(--bg-3)", border: "1px solid var(--border-2)", borderRadius: 8, padding: "8px 14px" }}>
            <Search size={15} color="var(--text-muted)" />
            <input
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={onKey}
              placeholder="e.g. AAPL, TSLA, COIN..."
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 14, fontFamily: "DM Mono" }}
            />
          </div>
          <button
            onClick={() => fetchTicker(input)}
            disabled={!!loading || !input.trim()}
            style={{ padding: "8px 20px", borderRadius: 8, background: input.trim() && !loading ? "var(--accent)" : "var(--border)", border: "none", color: input.trim() && !loading ? "#000" : "var(--text-dim)", cursor: input.trim() && !loading ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 13 }}>
            {loading ? "Fetching..." : "Fetch"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "var(--red-glow)", border: "1px solid rgba(244,63,94,0.3)", fontSize: 12, color: "var(--red)" }}>
            {error}
          </div>
        )}

        {/* Preset tickers */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8 }}>Quick fetch</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PRESET_TICKERS.map(t => (
              <button key={t} onClick={() => fetchTicker(t)} disabled={!!loading}
                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border-2)", background: "var(--bg-3)", color: loading === t ? "var(--accent)" : "var(--text-muted)", cursor: loading ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "DM Mono", display: "flex", alignItems: "center", gap: 5 }}>
                {loading === t && <Loader size={10} style={{ animation: "spin 1s linear infinite" }} />}
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* What gets fetched */}
      <div className="fade-in-2" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { icon: TrendingUp, label: "Price Data",     desc: "Real-time quote via Alpha Vantage",    color: "var(--accent)" },
          { icon: Database,   label: "Company Info",   desc: "Sector, P/E, market cap, description", color: "var(--green)" },
          { icon: FileText,   label: "SEC Filings",    desc: "10-K, 10-Q, 8-K via EDGAR API",        color: "var(--amber)" },
          { icon: Rss,        label: "News Sentiment", desc: "Latest articles via Alpha Vantage",     color: "#a78bfa" },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon size={14} color={color} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="fade-in-3">
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, fontWeight: 500 }}>
            Fetched tickers — all data stored in ChromaDB
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {results.map((r, i) => (
              <div key={i} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ padding: "12px 16px", background: "var(--bg-3)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="font-display" style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)" }}>{r.ticker}</span>
                    {r.overview?.name && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.overview.name}</span>}
                    {r.overview?.sector && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(0,212,255,0.08)", color: "var(--accent)", border: "1px solid rgba(0,212,255,0.2)", fontFamily: "DM Mono" }}>{r.overview.sector}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[
                      { label: `${r.filings} filings`, color: "var(--amber)" },
                      { label: `${r.news} news chunks`, color: "var(--green)" },
                    ].map(({ label, color }) => (
                      <span key={label} className="font-mono" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "var(--bg-2)", color, border: "1px solid var(--border)" }}>{label}</span>
                    ))}
                  </div>
                </div>

                {/* Price row */}
                {r.price?.price && (
                  <div style={{ padding: "10px 16px", display: "flex", gap: 24, borderBottom: r.overview?.description ? "1px solid var(--border)" : "none" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Price</div>
                      <div className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>${r.price.price}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Change</div>
                      <div className="font-mono" style={{ fontSize: 13, color: parseFloat(r.price.change) >= 0 ? "var(--green)" : "var(--red)" }}>
                        {r.price.change >= 0 ? "+" : ""}{r.price.change} ({r.price.change_pct}%)
                      </div>
                    </div>
                    {r.overview?.pe_ratio && r.overview.pe_ratio !== "None" && (
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>P/E</div>
                        <div className="font-mono" style={{ fontSize: 13, color: "var(--text)" }}>{r.overview.pe_ratio}</div>
                      </div>
                    )}
                    {r.overview?.market_cap && (
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Market Cap</div>
                        <div className="font-mono" style={{ fontSize: 13, color: "var(--text)" }}>
                          ${(parseInt(r.overview.market_cap) / 1e9).toFixed(0)}B
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>52W Range</div>
                      <div className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.price.low} — {r.price.high}</div>
                    </div>
                  </div>
                )}

                {/* Description */}
                {r.overview?.description && (
                  <div style={{ padding: "10px 16px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>{r.overview.description}</div>
                  </div>
                )}

                {/* Errors */}
                {r.errors?.length > 0 && (
                  <div style={{ padding: "8px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {r.errors.map((e, j) => (
                      <span key={j} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--amber-glow)", color: "var(--amber)", border: "1px solid rgba(245,158,11,0.3)" }}>{e}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
