"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, RotateCcw, WifiOff } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  chunks_used?: number;
  ts: string;
  error?: boolean;
  streaming?: boolean;
};

const SOURCE_LABELS: Record<string, string> = {
  market: "Market Data", filings: "SEC Filing", news: "News Feed", macro: "Macro",
};

const suggestions = [
  "Summarize NVDA earnings from last quarter",
  "What is the current Fed stance on interest rates?",
  "Compare AAPL vs MSFT revenue trends",
  "Explain the latest CPI report impact on equities",
];

const now = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 8, padding: "4px 0", alignItems: "center" }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(0,212,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Bot size={14} color="var(--accent)" />
      </div>
      <div style={{ display: "flex", gap: 4, padding: "10px 14px", background: "var(--bg-3)", borderRadius: "2px 10px 10px 10px", border: "1px solid var(--border)" }}>
        {[0, 1, 2].map(i => <div key={i} className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />)}
      </div>
    </div>
  );
}

// Blinking cursor shown at end of a streaming message
function StreamCursor() {
  return (
    <span style={{ display: "inline-block", width: 2, height: "1em", background: "var(--accent)", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 0.8s step-end infinite" }} />
  );
}

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: "assistant",
    content: "Hello. I am your AI financial analyst with persistent memory and streaming responses.\n\nI retrieve relevant context from ChromaDB and stream the response token by token. What would you like to analyze?",
    sources: [], ts: now(),
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`${API.replace("/api/v1", "")}/health`)
      .then(r => setApiOnline(r.ok))
      .catch(() => setApiOnline(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text.trim(), ts: now() };
    setMsgs(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setStreaming(true);

    // Add empty assistant message that we'll fill in token by token
    const assistantIdx = Date.now();
    setMsgs(prev => [...prev, { role: "assistant", content: "", sources: [], ts: now(), streaming: true }]);

    abortRef.current = new AbortController();

    try {
      const resp = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          history: msgs.map(m => ({ role: m.role, content: m.content })),
          source_filter: sourceFilter,
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let sources: string[] = [];
      let chunks_used = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        // Each SSE message is "data: {...}\n\n"
        const lines = raw.split("\n").filter(l => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const payload = JSON.parse(line.slice(6));

            if (payload.error) {
              setMsgs(prev => {
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], content: `Error: ${payload.error}`, streaming: false, error: true };
                return next;
              });
              break;
            }

            if (payload.token !== undefined) {
              // Append token to the last message
              setMsgs(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                next[next.length - 1] = { ...last, content: last.content + payload.token };
                return next;
              });
            }

            if (payload.done) {
              sources = payload.sources || [];
              chunks_used = payload.chunks_used || 0;
              // Finalize the message — remove streaming flag, add sources
              setMsgs(prev => {
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], streaming: false, sources, chunks_used };
                return next;
              });
            }
          } catch {
            // Malformed SSE line, skip
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User cancelled — finalize whatever we have
        setMsgs(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], streaming: false };
          return next;
        });
      } else {
        setMsgs(prev => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant", streaming: false, error: true, ts: now(),
            content: `Backend not reachable. Make sure FastAPI is running:\n\ncd backend && uvicorn main:app --reload\n\nError: ${err.message}`,
          };
          return next;
        });
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const filters = [null, "market", "filings", "news", "macro"];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={16} color="var(--accent)" />
          </div>
          <div>
            <div className="font-display" style={{ fontSize: 13, fontWeight: 700 }}>Analyst Chat</div>
            <div className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {apiOnline === true && <span style={{ color: "var(--green)" }}>API online · streaming enabled · RAG via ChromaDB</span>}
              {apiOnline === false && <span style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: 4 }}><WifiOff size={10} />API offline — run: uvicorn main:app --reload</span>}
              {apiOnline === null && <span style={{ color: "var(--text-dim)" }}>Checking API...</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {streaming && (
            <button onClick={stopStreaming} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--red)", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12 }}>
              Stop
            </button>
          )}
          <button onClick={() => setMsgs([{ role: "assistant", content: "Session reset.", sources: [], ts: now() }])}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-2)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>
            <RotateCcw size={12} />Reset
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ padding: "8px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-dim)", marginRight: 4 }}>Memory filter:</span>
        {filters.map(f => (
          <button key={f ?? "all"} onClick={() => setSourceFilter(f)}
            style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, border: sourceFilter === f ? "1px solid rgba(0,212,255,0.4)" : "1px solid var(--border)", background: sourceFilter === f ? "rgba(0,212,255,0.1)" : "transparent", color: sourceFilter === f ? "var(--accent)" : "var(--text-muted)", cursor: "pointer" }}>
            {f ? SOURCE_LABELS[f] : "All Sources"}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.length === 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)}
                style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-2)", background: "var(--bg-3)", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, textAlign: "left" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.3)"; (e.currentTarget as HTMLElement).style.color = "var(--text)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-2)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
              >{s}</button>
            ))}
          </div>
        )}

        {msgs.map((msg, i) => (
          <div key={i} className="bubble-in" style={{ display: "flex", gap: 10, flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: msg.role === "user" ? "rgba(0,229,160,0.12)" : msg.error ? "rgba(244,63,94,0.12)" : "rgba(0,212,255,0.12)", border: `1px solid ${msg.role === "user" ? "rgba(0,229,160,0.25)" : msg.error ? "rgba(244,63,94,0.25)" : "rgba(0,212,255,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {msg.role === "user" ? <User size={13} color="var(--green)" /> : <Bot size={13} color={msg.error ? "var(--red)" : "var(--accent)"} />}
            </div>
            <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 5, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ padding: "10px 14px", borderRadius: msg.role === "user" ? "10px 2px 10px 10px" : "2px 10px 10px 10px", background: msg.role === "user" ? "rgba(0,229,160,0.07)" : "var(--bg-3)", border: `1px solid ${msg.role === "user" ? "rgba(0,229,160,0.18)" : msg.error ? "rgba(244,63,94,0.25)" : "var(--border)"}`, fontSize: 13, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {msg.content}
                {msg.streaming && <StreamCursor />}
              </div>
              {msg.sources && msg.sources.length > 0 && !msg.streaming && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {msg.sources.map(s => (
                    <span key={s} className="font-mono" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(0,212,255,0.07)", color: "var(--accent)", border: "1px solid rgba(0,212,255,0.15)" }}>
                      {SOURCE_LABELS[s] || s}
                    </span>
                  ))}
                  {msg.chunks_used !== undefined && (
                    <span className="font-mono" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(90,115,148,0.1)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
                      {msg.chunks_used} chunks retrieved
                    </span>
                  )}
                </div>
              )}
              <div className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{msg.ts}</div>
            </div>
          </div>
        ))}

        {loading && !streaming && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-2)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "var(--bg-3)", border: "1px solid var(--border-2)", borderRadius: 12, padding: "8px 8px 8px 14px" }}>
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
            placeholder="Ask the analyst anything..." rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 13, fontFamily: "DM Sans", resize: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }} />
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: input.trim() && !loading ? "var(--accent)" : "var(--border)", border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
            <Send size={14} color={input.trim() && !loading ? "#000" : "var(--text-dim)"} />
          </button>
        </div>
        <div className="font-mono" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6, textAlign: "center" }}>
          Enter to send · Shift+Enter new line · Streaming via SSE · RAG via ChromaDB
        </div>
      </div>
    </div>
  );
}
