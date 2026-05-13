
"use client";
import { useState, useEffect } from "react";
import { TrendingUp, FileText, Rss, Database, RefreshCw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const SOURCE_META: Record<string, { icon: any; color: string; label: string }> = {
  market:  { icon: TrendingUp, color: "var(--accent)", label: "Market Data" },
  filings: { icon: FileText,   color: "var(--amber)",  label: "SEC Filings" },
  news:    { icon: Rss,        color: "var(--green)",  label: "Financial News" },
  macro:   { icon: Database,   color: "#a78bfa",       label: "Macro Indicators" },
};

export default function Dashboard() {
  const [status, setStatus]   = useState<any>(null);
  const [counts, setCounts]   = useState<any>({});
  const [prices, setPrices]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = async () => {
    try {
      const [statusRes, ingestRes, pricesRes] = await Promise.all([
        fetch(`${API}/status`),
        fetch(`${API}/ingest/status`),
        fetch(`${API}/prices`),
      ]);
      if (statusRes.ok)  setStatus(await statusRes.json());
      if (ingestRes.ok)  { const d = await ingestRes.json(); setCounts(d.counts || {}); }
      if (pricesRes.ok)  {
        const d = await pricesRes.json();
        setPrices(Object.entries(d.prices || {}).map(([sym, v]: any) => ({ sym, ...v })));
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 30000); return () => clearInterval(iv); }, []);

  const totalRecords = Object.values(counts).reduce((a: any, b: any) => a + b, 0) as number;
  const memory = status?.memory || {};
  const longTermCount = memory?.long_term?.count ?? 0;
  const episodicCount = memory?.episodic?.count ?? 0;

  const tickerItems = prices.length > 0 ? [...prices, ...prices] : [
    { sym: "AAPL", price: "—", change_pct: 0 }, { sym: "MSFT", price: "—", change_pct: 0 },
    { sym: "NVDA", price: "—", change_pct: 0 }, { sym: "TSLA", price: "—", change_pct: 0 },
  ].concat([{ sym: "AAPL", price: "—", change_pct: 0 }, { sym: "MSFT", price: "—", change_pct: 0 }]);

  const sourceList = Object.entries(SOURCE_META).map(([id, meta]) => ({
    id, ...meta, records: counts[id] || 0,
    status: counts[id] > 0 ? "live" : "idle",
  }));

  const statusColor: Record<string, string> = { live: "var(--green)", idle: "var(--text-dim)" };

  // Build simple bar chart from counts
  const chartData = sourceList.map(s => ({ name: s.label.split(" ")[0], records: s.records }));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Ticker */}
      <div style={{ background: "var(--bg-3)", borderBottom: "1px solid var(--border)", padding: "6px 0", overflow: "hidden", flexShrink: 0 }}>
        <div className="ticker-inner" style={{ display: "flex", whiteSpace: "nowrap" }}>
          {tickerItems.map((t, i) => (
            <span key={i} className="font-mono" style={{ fontSize: 11, padding: "0 24px", color: (t.change_pct ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>
              <span style={{ color: "var(--text-muted)" }}>{t.sym}</span>
              {"  "}{typeof t.price === "number" ? t.price.toFixed(2) : t.price}
              {"  "}{typeof t.change_pct === "number" ? `${t.change_pct > 0 ? "+" : ""}${t.change_pct.toFixed(2)}%` : ""}
            </span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
        <div className="fade-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>System Dashboard</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Live data from ChromaDB and Alpha Vantage
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
            <RefreshCw size={13} color="var(--text-muted)" style={{ cursor: "pointer" }} onClick={fetchAll} />
          </div>
        </div>

        {/* Metric cards */}
        <div className="fade-in-1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Total Records",     value: loading ? "..." : totalRecords.toLocaleString() },
            { label: "Vector Embeddings", value: loading ? "..." : longTermCount.toLocaleString() },
            { label: "Episodic Buffer",   value: loading ? "..." : episodicCount.toLocaleString() },
            { label: "Model",             value: status?.model?.split("-").slice(0,2).join("-") ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
              <div className="font-display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="fade-in-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, marginBottom: 16 }}>
          {/* Sources */}
          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span className="font-display" style={{ fontSize: 13, fontWeight: 700 }}>Data Sources</span>
            </div>
            {sourceList.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: "var(--bg-3)", border: "1px solid var(--border)", marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={15} color={s.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</div>
                    <div className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{s.records.toLocaleString()} records</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div className={s.status === "live" ? "pulse-dot" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor[s.status] }} />
                    <span className="font-mono" style={{ fontSize: 10, color: statusColor[s.status] }}>{s.status.toUpperCase()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Records by source chart */}
          <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <span className="font-display" style={{ fontSize: 13, fontWeight: 700 }}>Records by Source</span>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Live counts from ChromaDB long-term store</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-rec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-dim)", fontFamily: "DM Mono" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-dim)", fontFamily: "DM Mono" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", borderRadius: 6, fontSize: 11, fontFamily: "DM Mono" }} />
                <Area type="monotone" dataKey="records" stroke="var(--accent)" strokeWidth={2} fill="url(#g-rec)" dot={{ fill: "var(--accent)", r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory layer */}
        <div className="fade-in-3" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span className="font-display" style={{ fontSize: 13, fontWeight: 700 }}>Memory Layer Status</span>
            <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>ChromaDB local · 3 collections</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: "Long-Term Store",  count: longTermCount,  color: "var(--accent)", detail: "Persistent semantic memory" },
              { label: "Episodic Buffer",  count: episodicCount,  color: "var(--green)",  detail: "Recent context window" },
              { label: "Replay Buffer",    count: memory?.replay?.count ?? 0, color: "var(--amber)", detail: "Training replay samples" },
            ].map(({ label, count, color, detail }) => {
              const maxCount = Math.max(longTermCount, 1);
              const pct = Math.min(Math.round((count / maxCount) * 100), 100);
              return (
                <div key={label} style={{ padding: "12px 14px", background: "var(--bg-3)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
                    <span className="font-mono" style={{ fontSize: 11, color }}>{count.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 1s ease" }} />
                  </div>
                  <div className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
