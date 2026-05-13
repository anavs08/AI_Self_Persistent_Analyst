"use client";
import { useState, useEffect, useRef } from "react";
import { TrendingUp, FileText, Rss, Database, Play, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const SOURCE_CONFIG = [
  { id:"market",  label:"Market Data",      icon:TrendingUp, color:"var(--accent)", desc:"Daily OHLCV via Alpha Vantage for 9 major tickers.",          tags:["AAPL","MSFT","NVDA","TSLA","GOOGL","JPM","GS","AMZN","META"] },
  { id:"filings", label:"SEC Filings",       icon:FileText,   color:"var(--amber)",  desc:"10-K, 10-Q, 8-K filings via SEC EDGAR API.",                  tags:["10-K","10-Q","8-K"] },
  { id:"news",    label:"Financial News",    icon:Rss,        color:"var(--green)",  desc:"News sentiment via Alpha Vantage NEWS_SENTIMENT API.",         tags:["Sentiment","Alpha Vantage"] },
  { id:"macro",   label:"Macro Indicators",  icon:Database,   color:"#a78bfa",       desc:"CPI, GDP, Fed Funds, VIX, unemployment via FRED API.",         tags:["CPI","FEDFUNDS","GDP","UNRATE","VIX"] },
];

const statusColor: Record<string,string> = { live:"var(--green)", idle:"var(--text-dim)", error:"var(--red)" };

export default function DataSources() {
  const [selected,    setSelected]    = useState("market");
  const [counts,      setCounts]      = useState<Record<string,number>>({});
  const [runLog,      setRunLog]      = useState<any[]>([]);
  const [triggering,  setTriggering]  = useState<string|null>(null);
  // Track count at the moment Run Now was clicked so we know when ingestion has produced new chunks
  const prevCountRef  = useRef<number>(0);
  const pollTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef   = useRef<number>(0);

  // ── Core fetch ──────────────────────────────────────────────────────────────
  const fetchStatus = async () => {
    try {
      const [ingestRes, schedRes] = await Promise.all([
        fetch(`${API}/ingest/status`),
        fetch(`${API}/scheduler/status`),
      ]);
      if (ingestRes.ok) {
        const d = await ingestRes.json();
        setCounts(d.counts || {});
        return d.counts || {};
      }
      if (schedRes.ok) {
        const d = await schedRes.json();
        setRunLog(d.recent_runs || []);
      }
    } catch {}
    return null;
  };

  // ── Idle refresh every 10s ───────────────────────────────────────────────
  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 10000);
    return () => {
      clearInterval(iv);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // ── Stop polling once count increases or deadline passes ─────────────────
  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  // ── Run Now ───────────────────────────────────────────────────────────────
  const triggerIngest = async () => {
    if (triggering) return;                          // prevent double-click
    const src = selected;
    prevCountRef.current = counts[src] || 0;         // snapshot current count
    deadlineRef.current  = Date.now() + 3 * 60_000; // 3-minute hard timeout
    setTriggering(src);
    stopPolling();

    try {
      await fetch(`${API}/ingest`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ source: src }),
      });
    } catch {}

    // Aggressive poll every 2s until the count for this source increases
    pollTimerRef.current = setInterval(async () => {
      const latest = await fetchStatus();
      if (!latest) return;

      const newCount = (latest[src] || 0);
      const increased = newCount > prevCountRef.current;
      const timedOut  = Date.now() > deadlineRef.current;

      if (increased || timedOut) {
        stopPolling();
        setTriggering(null);
        // One final fetch after a short delay to catch the scheduler log
        setTimeout(fetchStatus, 1500);
      }
    }, 2000);
  };

  const src  = SOURCE_CONFIG.find(s => s.id === selected)!;
  const Icon = src.icon;
  // Backend sends log.chunks not log.records
  const srcLogs = runLog.filter(r => r.source === selected).slice(0, 6);

  return (
    <div style={{ height:"100%", display:"flex", overflow:"hidden" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div style={{ width:240, borderRight:"1px solid var(--border)", background:"var(--bg-2)", padding:12, display:"flex", flexDirection:"column", gap:6 }}>
        <div className="font-display" style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", padding:"4px 8px", letterSpacing:"0.06em", marginBottom:4 }}>SOURCES</div>
        {SOURCE_CONFIG.map(s => {
          const SIcon  = s.icon;
          const on     = s.id === selected;
          const count  = counts[s.id] || 0;
          const status = count > 0 ? "live" : "idle";
          const isRunning = triggering === s.id;
          return (
            <button key={s.id} onClick={() => setSelected(s.id)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8,
                border: on ? "1px solid rgba(0,212,255,0.2)" : "1px solid transparent",
                background: on ? "rgba(0,212,255,0.06)" : "transparent",
                cursor:"pointer", textAlign:"left", width:"100%" }}>
              <SIcon size={14} color={s.color}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500, color: on ? "var(--text)" : "var(--text-muted)" }}>{s.label}</div>
                <div className="font-mono" style={{ fontSize:10, color: isRunning ? "var(--green)" : statusColor[status] }}>
                  {isRunning ? "ingesting…" : `${count.toLocaleString()} chunks`}
                </div>
              </div>
              {/* Pulse dot — green & animated when running */}
              <div
                className={isRunning || status === "live" ? "pulse-dot" : ""}
                style={{ width:6, height:6, borderRadius:"50%",
                  background: isRunning ? "var(--green)" : statusColor[status],
                  flexShrink:0 }}/>
            </button>
          );
        })}
      </div>

      {/* ── Detail panel ────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflow:"auto", padding:24 }}>

        {/* Header */}
        <div className="fade-in" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div style={{ display:"flex", gap:14, alignItems:"center" }}>
            <div style={{ width:44, height:44, borderRadius:12, background:`${src.color}18`, border:`1px solid ${src.color}40`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon size={20} color={src.color}/>
            </div>
            <div>
              <h2 className="font-display" style={{ fontSize:18, fontWeight:800 }}>{src.label}</h2>
              <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{src.desc}</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={triggerIngest} disabled={!!triggering}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8,
                border:"1px solid var(--accent)", background:"rgba(0,212,255,0.08)",
                cursor: triggering ? "not-allowed" : "pointer",
                color: triggering ? "var(--text-dim)" : "var(--accent)",
                fontSize:12, fontWeight:600, transition:"all 0.15s" }}>
              <Play size={13}/>
              {triggering === selected ? "Running…" : "Run Now"}
            </button>
            <button onClick={fetchStatus}
              style={{ padding:"8px 12px", borderRadius:8, border:"1px solid var(--border-2)", background:"var(--bg-3)", cursor:"pointer", color:"var(--text-muted)" }}>
              <RefreshCw size={13}/>
            </button>
          </div>
        </div>

        {/* Active ingestion banner */}
        {triggering === selected && (
          <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:8, background:"rgba(0,212,255,0.06)", border:"1px solid rgba(0,212,255,0.2)", display:"flex", alignItems:"center", gap:10 }}>
            <div className="pulse-dot" style={{ width:8, height:8, borderRadius:"50%", background:"var(--green)", flexShrink:0 }}/>
            <span style={{ fontSize:12, color:"var(--text-muted)" }}>
              Ingesting <strong style={{ color:"var(--accent)" }}>{src.label}</strong> — count updates automatically when chunks arrive…
            </span>
            {/* Animated progress bar */}
            <div style={{ flex:1, height:3, background:"var(--border)", borderRadius:2, overflow:"hidden", marginLeft:8 }}>
              <div style={{ height:"100%", background:"linear-gradient(90deg,var(--accent),var(--green))",
                animation:"slide 1.4s ease-in-out infinite", borderRadius:2 }}/>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="fade-in-1" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
          {[
            { label:"Chunks in DB",  value: triggering === selected ? "…" : (counts[selected]||0).toLocaleString() },
            { label:"Status",        value: triggering === selected ? "Ingesting" : counts[selected] > 0 ? "Live" : "Empty" },
            { label:"Collection",    value:"long_term" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background:"var(--bg-2)", border:"1px solid var(--border)", borderRadius:10, padding:"14px 16px" }}>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:6 }}>{label}</div>
              <div className="font-display" style={{ fontSize:18, fontWeight:700, color: label === "Status" && value === "Ingesting" ? "var(--green)" : "var(--text)" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="fade-in-2" style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:8, fontWeight:500 }}>Configured Identifiers</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {src.tags.map(t => (
              <span key={t} className="font-mono"
                style={{ padding:"4px 10px", borderRadius:6, background:`${src.color}12`, border:`1px solid ${src.color}30`, fontSize:11, color:src.color }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Run log — uses log.chunks (backend field), not log.records */}
        <div className="fade-in-3">
          <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:8, fontWeight:500 }}>
            Recent Run Log{" "}
            {srcLogs.length === 0 && <span style={{ color:"var(--text-dim)" }}>(no runs recorded yet for this source)</span>}
          </div>
          <div style={{ background:"var(--bg-2)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
            {srcLogs.length > 0 ? srcLogs.map((log, i) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 14px",
                borderBottom: i < srcLogs.length - 1 ? "1px solid var(--border)" : "none" }}>
                {log.error
                  ? <AlertCircle size={13} color="var(--amber)" style={{ marginTop:2, flexShrink:0 }}/>
                  : <CheckCircle size={13} color="var(--green)"  style={{ marginTop:2, flexShrink:0 }}/>}
                <span className="font-mono" style={{ fontSize:10, color:"var(--text-dim)", flexShrink:0 }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-mono" style={{ fontSize:11, color: log.error ? "var(--amber)" : "var(--text-muted)" }}>
                  {log.error
                    ? `Error: ${log.error}`
                    /* backend sends log.chunks — fall back to log.records for older versions */
                    : `Wrote ${log.chunks ?? log.records ?? "?"} chunks to ChromaDB`}
                </span>
              </div>
            )) : (
              <div style={{ padding:"20px 14px", textAlign:"center" }}>
                <span style={{ fontSize:12, color:"var(--text-dim)" }}>Click Run Now to ingest data for this source</span>
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes slide {
          0%   { transform: translateX(-100%); width: 60%; }
          50%  { transform: translateX(80%);   width: 60%; }
          100% { transform: translateX(200%);  width: 60%; }
        }
      `}</style>
    </div>
  );
}
