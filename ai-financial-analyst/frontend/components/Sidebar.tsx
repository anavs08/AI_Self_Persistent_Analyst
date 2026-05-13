"use client";
import { Database, Brain, MessageSquare, Activity, ChevronRight, FlaskConical, Search } from "lucide-react";

const nav = [
  { id: "data",       label: "Data Sources", icon: Database },
  { id: "memory",     label: "Memory",       icon: Brain },
  { id: "chat",       label: "Analyst Chat", icon: MessageSquare },
  { id: "ticker",     label: "Fetch Ticker", icon: Search },
  { id: "evaluation", label: "Evaluation",   icon: FlaskConical },
];

export default function Sidebar({ active, onNav }: { active: string; onNav: (id: string) => void }) {
  return (
    <aside style={{ width: 220, minWidth: 220, background: "var(--bg-2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", zIndex: 10 }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,var(--accent),var(--accent-2))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px var(--accent-glow)" }}>
            <Activity size={16} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>ANALYST</div>
            <div className="font-mono" style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.08em" }}>SELF-PERSISTENT AI</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} />
          <span className="font-mono" style={{ fontSize: 10, color: "var(--green)" }}>SYSTEM ONLINE</span>
        </div>
        <div className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>Model: Claude Sonnet</div>
        <div className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>Memory: ChromaDB local</div>
        <div className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>50 eval questions</div>
      </div>
      <nav style={{ flex: 1, padding: "8px" }}>
        {nav.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button key={id} onClick={() => onNav(id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, marginBottom: 2, background: on ? "rgba(0,212,255,0.08)" : "transparent", border: on ? "1px solid rgba(0,212,255,0.2)" : "1px solid transparent", color: on ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
              onMouseEnter={e => { if (!on) { (e.currentTarget as HTMLElement).style.color = "var(--text)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}}
              onMouseLeave={e => { if (!on) { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}}>
              <Icon size={15} strokeWidth={on ? 2.5 : 1.8} />
              <span className="font-display" style={{ fontSize: 12, fontWeight: 600, flex: 1, letterSpacing: "0.03em" }}>{label}</span>
              {on && <ChevronRight size={12} />}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
        <div className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>v0.4.0</div>
        <div className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>Self-Persistent RAG</div>
      </div>
    </aside>
  );
}
