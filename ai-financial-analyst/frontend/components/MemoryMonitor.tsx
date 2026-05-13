
"use client";
import { useState, useEffect, useRef } from "react";
import { Brain, Trash2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Insight = { query: string; timestamp: string; tickers: string; preview: string; tag?: string };

export default function MemoryMonitor() {
  const [insights,    setInsights]    = useState<Insight[]>([]);
  const [stats,       setStats]       = useState({ long_term: 0, episodic: 0, insights: 0 });
  const [expanded,    setExpanded]    = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [pruning,     setPruning]     = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const ivRef = useRef<any>(null);

  const fetchAll = async () => {
    try {
      const [insRes, statusRes] = await Promise.all([
        fetch(`${API}/insights`),
        fetch(`${API}/status`),
      ]);
      if (insRes.ok) { const d = await insRes.json(); setInsights(d.insights || []); }
      if (statusRes.ok) {
        const d = await statusRes.json();
        const mem = d.memory || {};
        setStats({
          long_term: mem.long_term?.count ?? 0,
          episodic:  mem.episodic?.count  ?? 0,
          insights:  d.insight_count ?? 0,
        });
      }
    } catch {}
    setLoading(false);
    setLastRefresh(new Date());
  };

  useEffect(() => {
    fetchAll();
    ivRef.current = setInterval(fetchAll, 15000);
    return () => clearInterval(ivRef.current);
  }, []);

  const triggerPrune = async () => {
    setPruning(true);
    await fetch(`${API}/memory/prune`, { method: "POST" }).catch(() => {});
    setTimeout(() => { fetchAll(); setPruning(false); }, 3000);
  };

  const formatTime = (ts: string) => { try { return new Date(ts).toLocaleString(); } catch { return ts; } };

  return (
    <div style={{ height: "100%", overflow: "auto", padding: 24 }}>
      <div className="fade-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 22, fontWeight: 800 }}>Memory Monitor</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Live view of what the analyst has learned and stored across sessions
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{lastRefresh.toLocaleTimeString()}</span>
          <button onClick={fetchAll} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-2)", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}>
            <RefreshCw size={12} />
          </button>
          <button onClick={triggerPrune} disabled={pruning} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--red)", background: "transparent", cursor: pruning ? "not-allowed" : "pointer", color: "var(--red)", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
            <Trash2 size={12} />{pruning ? "Pruning..." : "Prune Now"}
          </button>
        </div>
      </div>

      {/* Stats — no replay buffer */}
      <div className="fade-in-1" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Long-Term Store",  value: stats.long_term, color: "var(--accent)",  sub: "All ingested + insight chunks" },
          { label: "Episodic Buffer",  value: stats.episodic,  color: "var(--green)",   sub: "Recent context window" },
          { label: "Stored Insights",  value: stats.insights,  color: "#f472b6",        sub: "Self-generated analyst memory" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
            <div className="font-display" style={{ fontSize: 26, fontWeight: 700, color, letterSpacing: "-0.02em" }}>{value.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Callout */}
      <div className="fade-in-2" style={{ marginBottom: 20, padding: "14px 18px", borderRadius: 10, background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Brain size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div className="font-display" style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>How persistent learning works</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Every analyst response is embedded and stored back into ChromaDB as a tagged insight chunk. Future queries retrieve these prior analyses as context, so the analyst builds on its own reasoning over time. Staleness decay, deduplication, and context ordering keep the memory accurate and efficient.
          </div>
        </div>
      </div>

      {/* Insights list */}
      <div className="fade-in-3" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="font-display" style={{ fontSize: 13, fontWeight: 700 }}>Stored Insights</span>
            <span className="font-mono" style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 10 }}>{insights.length} entries</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Click any row to expand</span>
        </div>

        {loading && <div style={{ padding: 32, textAlign: "center", fontSize: 12, color: "var(--text-dim)" }}>Loading...</div>}

        {!loading && insights.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Brain size={32} color="var(--text-dim)" />
            <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>No insights stored yet</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", maxWidth: 360, textAlign: "center" }}>
              Start a conversation in Analyst Chat. Every substantive response is stored here automatically.
            </div>
          </div>
        )}

        {insights.map((insight, i) => {
          const isExpanded = expanded === i;
          const tickers = insight.tickers ? insight.tickers.split(",").filter(Boolean) : [];
          return (
            <div key={i} style={{ borderBottom: i < insights.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div onClick={() => setExpanded(isExpanded ? null : i)}
                style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 18px", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(244,114,182,0.12)", border: "1px solid rgba(244,114,182,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span className="font-mono" style={{ fontSize: 10, color: "#f472b6" }}>{i + 1}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                    {insight.tag && (
                      <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.25)", fontSize: 10, color: "#f472b6", fontWeight: 600, fontFamily: "DM Mono", flexShrink: 0 }}>
                        {insight.tag}
                      </span>
                    )}
                    {tickers.map(t => (
                      <span key={t} className="font-mono" style={{ padding: "2px 7px", borderRadius: 4, background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", fontSize: 10, color: "var(--accent)" }}>{t}</span>
                    ))}
                    <span className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: "auto" }}>{formatTime(insight.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, marginBottom: 3 }}>{insight.query}</div>
                  {!isExpanded && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{insight.preview}</div>
                  )}
                </div>
                <div style={{ color: "var(--text-dim)", flexShrink: 0 }}>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {isExpanded && (
                <div style={{ padding: "0 18px 14px 56px" }}>
                  <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bg-3)", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {insight.preview}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Memory health */}
      <div className="fade-in-4" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div className="font-display" style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Memory Health</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {[
            { label: "Staleness Decay",  desc: "Market data loses 50% weight every 7 days. Insights decay over 30 days.", color: "var(--accent)", status: "Active" },
            { label: "Deduplication",    desc: "Chunks with 72%+ Jaccard similarity are merged before reaching Claude.", color: "var(--green)",  status: "Active" },
            { label: "Context Ordering", desc: "Most relevant chunk placed first and last to counter lost-in-the-middle.", color: "var(--amber)", status: "Active" },
          ].map(({ label, desc, color, status }) => (
            <div key={label} style={{ padding: "12px 14px", background: "var(--bg-3)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}</span>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: `${color}15`, color, border: `1px solid ${color}30`, fontFamily: "DM Mono" }}>{status}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
