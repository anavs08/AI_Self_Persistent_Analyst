
"use client";
import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    id: "dcf",
    label: "DCF Valuation",
    color: "var(--accent)",
    desc: "Discounted Cash Flow — intrinsic value from projected free cash flows",
    fields: [
      { key: "free_cash_flows",      label: "FCF Projections ($M, comma-separated)", type: "text",   placeholder: "100, 120, 144, 172, 207", isArray: true },
      { key: "terminal_growth_rate", label: "Terminal Growth Rate",                  type: "number", placeholder: "0.03" },
      { key: "discount_rate",        label: "Discount Rate (WACC)",                  type: "number", placeholder: "0.10" },
      { key: "shares_outstanding",   label: "Shares Outstanding ($M, optional)",     type: "number", placeholder: "15000", optional: true },
    ],
  },
  {
    id: "capm",
    label: "CAPM",
    color: "var(--green)",
    desc: "Capital Asset Pricing Model — expected return from beta and market risk premium",
    fields: [
      { key: "risk_free_rate", label: "Risk-Free Rate (10Y Treasury)", type: "number", placeholder: "0.045" },
      { key: "beta",           label: "Stock Beta",                    type: "number", placeholder: "1.2" },
      { key: "market_return",  label: "Expected Market Return",        type: "number", placeholder: "0.10" },
    ],
  },
  {
    id: "ddm",
    label: "DDM",
    color: "var(--amber)",
    desc: "Dividend Discount Model — fair value of a dividend-paying stock",
    fields: [
      { key: "current_dividend", label: "Current Annual Dividend ($)", type: "number", placeholder: "2.40" },
      { key: "growth_rate",      label: "Dividend Growth Rate",        type: "number", placeholder: "0.05" },
      { key: "required_return",  label: "Required Return",             type: "number", placeholder: "0.09" },
    ],
  },
  {
    id: "sharpe",
    label: "Sharpe Ratio",
    color: "#a78bfa",
    desc: "Risk-adjusted return — excess return per unit of volatility",
    fields: [
      { key: "portfolio_return",  label: "Portfolio Return (annualized)", type: "number", placeholder: "0.14" },
      { key: "risk_free_rate",    label: "Risk-Free Rate",                type: "number", placeholder: "0.045" },
      { key: "portfolio_std_dev", label: "Portfolio Std Dev (annualized)", type: "number", placeholder: "0.18" },
    ],
  },
  {
    id: "bond",
    label: "Bond Pricing",
    color: "#f472b6",
    desc: "Price any bond from its coupon rate and yield to maturity",
    fields: [
      { key: "face_value",        label: "Face Value ($)",         type: "number", placeholder: "1000" },
      { key: "coupon_rate",       label: "Coupon Rate",            type: "number", placeholder: "0.05" },
      { key: "yield_to_maturity", label: "Yield to Maturity",      type: "number", placeholder: "0.06" },
      { key: "years_to_maturity", label: "Years to Maturity",      type: "number", placeholder: "10" },
    ],
  },
  {
    id: "var",
    label: "Value at Risk",
    color: "var(--red)",
    desc: "Maximum expected loss at a given confidence level over a holding period",
    fields: [
      { key: "portfolio_value",  label: "Portfolio Value ($)",       type: "number", placeholder: "1000000" },
      { key: "expected_return",  label: "Expected Return (annual)",  type: "number", placeholder: "0.10" },
      { key: "std_dev",          label: "Std Dev (annual)",          type: "number", placeholder: "0.20" },
      { key: "confidence_level", label: "Confidence Level",          type: "number", placeholder: "0.95" },
    ],
  },
  {
    id: "wacc",
    label: "WACC",
    color: "#34d399",
    desc: "Weighted Average Cost of Capital — minimum required return on invested capital",
    fields: [
      { key: "equity_value",   label: "Market Cap ($M)",       type: "number", placeholder: "2000000" },
      { key: "debt_value",     label: "Total Debt ($M)",       type: "number", placeholder: "50000" },
      { key: "cost_of_equity", label: "Cost of Equity",        type: "number", placeholder: "0.10" },
      { key: "cost_of_debt",   label: "Pre-tax Cost of Debt",  type: "number", placeholder: "0.04" },
      { key: "tax_rate",       label: "Tax Rate",              type: "number", placeholder: "0.21" },
    ],
  },
  {
    id: "pe",
    label: "P/E Fair Value",
    color: "#fb923c",
    desc: "Fair value using P/E multiple and PEG ratio analysis",
    fields: [
      { key: "eps",           label: "EPS (TTM or Forward)",   type: "number", placeholder: "6.50" },
      { key: "peer_pe_ratio", label: "Peer Average P/E",       type: "number", placeholder: "28" },
      { key: "growth_rate",   label: "EPS Growth Rate",        type: "number", placeholder: "0.15", optional: true },
    ],
  },
];

// ── Tool runner ───────────────────────────────────────────────────────────────

async function runTool(toolId: string, inputs: Record<string, any>): Promise<any> {
  const toolMap: Record<string, string> = {
    dcf: "dcf_valuation", capm: "capm_expected_return", ddm: "ddm_valuation",
    sharpe: "sharpe_ratio", bond: "bond_price", var: "value_at_risk",
    wacc: "wacc_calculation", pe: "pe_fair_value",
  };

  const resp = await fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Run the ${toolMap[toolId]} tool with these exact inputs and show me the structured result: ${JSON.stringify(inputs)}. Use the tool directly and present the output clearly.`,
      history: [],
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// ── Visualizations ────────────────────────────────────────────────────────────

function DCFChart({ result }: { result: any }) {
  if (!result?.yearly_pv_fcfs) return null;
  const data = result.yearly_pv_fcfs.map((v: number, i: number) => ({
    year: `Y${i + 1}`, pv: v,
  }));
  data.push({ year: "Terminal", pv: result.pv_terminal_value });
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>PV of Cash Flows by Year</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--text-dim)", fontFamily: "DM Mono" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "var(--text-dim)", fontFamily: "DM Mono" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", borderRadius: 6, fontSize: 11, fontFamily: "DM Mono" }} />
          <Bar dataKey="pv" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 ? "var(--amber)" : "var(--accent)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CAPMChart({ result }: { result: any }) {
  if (!result?.expected_return) return null;
  const rf   = parseFloat(result.risk_free_rate) / 100;
  const er   = parseFloat(result.expected_return) / 100;
  const beta = result.beta;
  const data = [0, 0.5, 1, 1.5, 2].map(b => ({
    beta: b,
    return: (rf + b * (parseFloat(result.market_return)/100 - rf)) * 100,
  }));
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Security Market Line</div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="beta" tick={{ fontSize: 10, fill: "var(--text-dim)", fontFamily: "DM Mono" }} tickLine={false} axisLine={false} label={{ value: "Beta", position: "insideBottom", offset: -2, fontSize: 10, fill: "var(--text-dim)" }} />
          <YAxis tick={{ fontSize: 9, fill: "var(--text-dim)", fontFamily: "DM Mono" }} tickLine={false} axisLine={false} unit="%" />
          <Tooltip contentStyle={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", borderRadius: 6, fontSize: 11, fontFamily: "DM Mono" }} formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Expected Return"]} />
          <Line type="monotone" dataKey="return" stroke="var(--green)" strokeWidth={2} dot={false} />
          <ReferenceLine x={beta} stroke="var(--accent)" strokeDasharray="4 2" label={{ value: `β=${beta}`, position: "top", fontSize: 9, fill: "var(--accent)" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function WACCChart({ result }: { result: any }) {
  if (!result?.equity_weight) return null;
  const ew = parseFloat(result.equity_weight);
  const dw = parseFloat(result.debt_weight);
  const data = [
    { name: "Equity", weight: ew, cost: parseFloat(result.cost_of_equity), color: "var(--accent)" },
    { name: "Debt",   weight: dw, cost: parseFloat(result.after_tax_cost_of_debt), color: "var(--amber)" },
  ];
  return (
    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Capital Structure</div>
        <div style={{ height: 8, borderRadius: 4, overflow: "hidden", background: "var(--border)", display: "flex" }}>
          <div style={{ width: `${ew}%`, background: "var(--accent)" }} />
          <div style={{ width: `${dw}%`, background: "var(--amber)" }} />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
          {data.map(d => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
              <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.name} {d.weight}%</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Component Costs</div>
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 4, left: 10, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 9, fill: "var(--text-dim)", fontFamily: "DM Mono" }} tickLine={false} axisLine={false} unit="%" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--text-dim)", fontFamily: "DM Mono" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "var(--bg-3)", border: "1px solid var(--border-2)", borderRadius: 6, fontSize: 11 }} formatter={(v: any) => [`${v}%`, "Cost"]} />
            <Bar dataKey="cost" radius={[0, 3, 3, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GenericResultCard({ result }: { result: any }) {
  if (!result || typeof result !== "object") return null;
  const entries = Object.entries(result).filter(([k]) => k !== "model" && k !== "error" && !Array.isArray(result[k]));
  return (
    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {entries.map(([key, value]) => (
        <div key={key} style={{ padding: "8px 10px", background: "var(--bg-3)", borderRadius: 6, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize", marginBottom: 2 }}>
            {key.replace(/_/g, " ")}
          </div>
          <div className="font-mono" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>
            {String(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Tools() {
  const [selectedTool, setSelectedTool] = useState(TOOLS[0]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [rawAnswer, setRawAnswer] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToolSelect = (tool: typeof TOOLS[0]) => {
    setSelectedTool(tool);
    setInputs({});
    setResult(null);
    setRawAnswer("");
    setError(null);
  };

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setRawAnswer("");

    try {
      // Parse inputs
      const parsed: Record<string, any> = {};
      for (const field of selectedTool.fields) {
        const val = inputs[field.key];
        if (!val && !field.optional) {
          setError(`Missing required field: ${field.label}`);
          setLoading(false);
          return;
        }
        if (!val) continue;
        if (field.isArray) {
          parsed[field.key] = val.split(",").map(v => parseFloat(v.trim()));
        } else {
          parsed[field.key] = parseFloat(val);
        }
      }

      const data = await runTool(selectedTool.id, parsed);
      setRawAnswer(data.answer || "");

      // Try to extract JSON from the answer
      try {
        const jsonMatch = data.answer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          setResult(JSON.parse(jsonMatch[0]));
        }
      } catch {}

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>

      {/* Tool selector sidebar */}
      <div style={{ width: 220, borderRight: "1px solid var(--border)", background: "var(--bg-2)", padding: 12, display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
        <div className="font-display" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", padding: "4px 8px", letterSpacing: "0.06em", marginBottom: 4 }}>
          FINANCIAL TOOLS
        </div>
        {TOOLS.map(tool => {
          const on = tool.id === selectedTool.id;
          return (
            <button key={tool.id} onClick={() => handleToolSelect(tool)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: on ? `1px solid ${tool.color}40` : "1px solid transparent", background: on ? `${tool.color}10` : "transparent", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.15s" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: on ? tool.color : "var(--text-dim)", flexShrink: 0 }} />
              <div>
                <div className="font-display" style={{ fontSize: 12, fontWeight: 600, color: on ? "var(--text)" : "var(--text-muted)" }}>{tool.label}</div>
              </div>
            </button>
          );
        })}
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>How it works</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.5 }}>
            Each tool calls the backend calculation engine directly. Claude also calls these automatically during chat when quantitative analysis is needed.
          </div>
        </div>
      </div>

      {/* Tool workspace */}
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div className="fade-in" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: selectedTool.color }} />
            <h1 className="font-display" style={{ fontSize: 22, fontWeight: 800 }}>{selectedTool.label}</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{selectedTool.desc}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Input panel */}
          <div className="fade-in-1" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
            <div className="font-display" style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Inputs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {selectedTool.fields.map(field => (
                <div key={field.key}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
                    {field.label}
                    {field.optional && <span style={{ color: "var(--text-dim)", marginLeft: 4 }}>(optional)</span>}
                  </div>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={inputs[field.key] || ""}
                    onChange={e => setInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                    style={{ width: "100%", background: "var(--bg-3)", border: "1px solid var(--border-2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text)", fontFamily: "DM Mono", outline: "none" }}
                    onFocus={e => (e.target.style.borderColor = selectedTool.color)}
                    onBlur={e => (e.target.style.borderColor = "var(--border-2)")}
                  />
                </div>
              ))}
            </div>

            <button onClick={handleRun} disabled={loading} style={{ marginTop: 16, width: "100%", padding: "10px", borderRadius: 8, background: loading ? "rgba(0,212,255,0.1)" : selectedTool.color, border: `1px solid ${selectedTool.color}`, color: loading ? selectedTool.color : "#000", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, fontFamily: "DM Sans", transition: "all 0.15s" }}>
              {loading ? "Calculating..." : `Run ${selectedTool.label}`}
            </button>

            {error && (
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "var(--red-glow)", border: "1px solid rgba(244,63,94,0.3)", fontSize: 12, color: "var(--red)" }}>
                {error}
              </div>
            )}
          </div>

          {/* Output panel */}
          <div className="fade-in-2" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
            <div className="font-display" style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Results</div>

            {!result && !rawAnswer && !loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${selectedTool.color}15`, border: `1px solid ${selectedTool.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: selectedTool.color, opacity: 0.5 }} />
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Fill in inputs and click Run</div>
              </div>
            )}

            {loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${selectedTool.color}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Running calculation...</div>
              </div>
            )}

            {result && (
              <>
                <GenericResultCard result={result} />
                {selectedTool.id === "dcf"    && <DCFChart result={result} />}
                {selectedTool.id === "capm"   && <CAPMChart result={result} />}
                {selectedTool.id === "wacc"   && <WACCChart result={result} />}
              </>
            )}

            {rawAnswer && !result && (
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {rawAnswer}
              </div>
            )}
          </div>
        </div>

        {/* Analyst interpretation */}
        {rawAnswer && (
          <div className="fade-in-3" style={{ marginTop: 16, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
              <div className="font-display" style={{ fontSize: 13, fontWeight: 700 }}>Analyst Interpretation</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
              {rawAnswer}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
