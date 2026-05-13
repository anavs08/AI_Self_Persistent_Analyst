
"use client";
import { useState, useEffect } from "react";
import { Play, Square, GitBranch } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const lossHistory = [
  {step:0,loss:0.92},{step:50,loss:0.74},{step:100,loss:0.61},{step:150,loss:0.52},
  {step:200,loss:0.46},{step:250,loss:0.41},{step:300,loss:0.37},{step:350,loss:0.34},
  {step:400,loss:0.32},{step:450,loss:0.315},{step:500,loss:0.312},
];

export default function Training() {
  const [running,  setRunning]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [rank,     setRank]     = useState("16");
  const [lr,       setLr]       = useState("2e-4");
  const [steps,    setSteps]    = useState("500");
  const [history,  setHistory]  = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/train/history`)
      .then(r => r.json())
      .then(d => setHistory(d.runs || []))
      .catch(() => {});
  }, []);

  const startRun = async () => {
    setRunning(true); setProgress(0);
    try {
      await fetch(`${API}/train/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lora_rank: parseInt(rank), learning_rate: parseFloat(lr), max_steps: parseInt(steps), batch_size: 4 }),
      });
    } catch {}
    const iv = setInterval(() => {
      setProgress(p => { if (p >= 100) { clearInterval(iv); setRunning(false); return 100; } return p + 0.4; });
    }, 80);
  };

  return (
    <div style={{ height:"100%", overflow:"auto", padding:24 }}>
      <div className="fade-in" style={{ marginBottom:20 }}>
        <h1 className="font-display" style={{ fontSize:22, fontWeight:800 }}>Training Monitor</h1>
        <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>LoRA continual fine-tuning on Mistral-7B-Instruct-v0.3</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.5fr", gap:16, marginBottom:16 }}>
        <div className="fade-in-1" style={{ background:"var(--bg-2)", border:"1px solid var(--border)", borderRadius:10, padding:18 }}>
          <div className="font-display" style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Run Configuration</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { label:"Base Model",   value:"mistral-7b-instruct-v0.3", mono:true },
              { label:"Method",       value:"LoRA (PEFT)", mono:false },
              { label:"LoRA Rank",    value:rank,  editable:true, set:setRank },
              { label:"Learning Rate",value:lr,    editable:true, set:setLr },
              { label:"Max Steps",    value:steps, editable:true, set:setSteps },
              { label:"Batch Size",   value:"4",   mono:true },
              { label:"Data Source",  value:"ChromaDB long_term", mono:false },
            ].map(({ label, value, mono, editable, set }) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:12, color:"var(--text-muted)" }}>{label}</span>
                {editable && set ? (
                  <input value={value} onChange={e => set(e.target.value)} style={{ background:"var(--bg-3)", border:"1px solid var(--border-2)", borderRadius:6, padding:"3px 8px", width:100, fontSize:11, color:"var(--text)", fontFamily:"DM Mono", textAlign:"right", outline:"none" }}/>
                ) : (
                  <span className={mono?"font-mono":""} style={{ fontSize:11, color:"var(--accent)" }}>{value}</span>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop:16, display:"flex", gap:8 }}>
            <button onClick={startRun} disabled={running} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"10px", borderRadius:8, background:running?"rgba(0,212,255,0.1)":"var(--accent)", border:"1px solid var(--accent)", color:running?"var(--accent)":"#000", cursor:running?"not-allowed":"pointer", fontWeight:600, fontSize:12 }}>
              <Play size={13}/>{running?"Training...":"Start Run"}
            </button>
            {running && <button onClick={() => setRunning(false)} style={{ padding:"10px 14px", borderRadius:8, background:"transparent", border:"1px solid var(--red)", color:"var(--red)", cursor:"pointer" }}><Square size={13}/></button>}
          </div>
          {(running || progress > 0) && (
            <div style={{ marginTop:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span className="font-mono" style={{ fontSize:10, color:"var(--text-muted)" }}>Step {Math.floor(progress/100*parseInt(steps))} / {steps}</span>
                <span className="font-mono" style={{ fontSize:10, color:"var(--accent)" }}>{progress.toFixed(1)}%</span>
              </div>
              <div style={{ height:4, background:"var(--border)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${progress}%`, borderRadius:2, background:"linear-gradient(90deg,var(--accent),var(--green))", transition:"width 0.1s linear" }}/>
              </div>
              {running && <div className="font-mono" style={{ fontSize:10, color:"var(--text-dim)", marginTop:4 }}>est. loss: {(0.92-(progress/100)*0.61).toFixed(3)}</div>}
            </div>
          )}
        </div>

        <div className="fade-in-2" style={{ background:"var(--bg-2)", border:"1px solid var(--border)", borderRadius:10, padding:18 }}>
          <div style={{ marginBottom:14 }}>
            <div className="font-display" style={{ fontSize:13, fontWeight:700 }}>Training Loss (latest run)</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lossHistory} margin={{ top:4, right:4, left:-24, bottom:0 }}>
              <XAxis dataKey="step" tick={{ fontSize:9, fill:"var(--text-dim)", fontFamily:"DM Mono" }} tickLine={false} axisLine={false}/>
              <YAxis tick={{ fontSize:9, fill:"var(--text-dim)", fontFamily:"DM Mono" }} tickLine={false} axisLine={false} domain={["auto","auto"]}/>
              <Tooltip contentStyle={{ background:"var(--bg-3)", border:"1px solid var(--border-2)", borderRadius:6, fontSize:11, fontFamily:"DM Mono" }}/>
              <Line type="monotone" dataKey="loss" stroke="var(--accent)" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Run history from API */}
      <div className="fade-in-3" style={{ background:"var(--bg-2)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
        <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
          <span className="font-display" style={{ fontSize:13, fontWeight:700 }}>Run History</span>
        </div>
        {history.length > 0 ? history.map((run, i) => (
          <div key={run.id} style={{ display:"flex", alignItems:"center", gap:16, padding:"12px 18px", borderBottom:i<history.length-1?"1px solid var(--border)":"none" }}>
            <GitBranch size={13} color="var(--text-dim)"/>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <span className="font-mono" style={{ fontSize:12 }}>{run.adapter || run.id}</span>
                <span className="font-mono" style={{ fontSize:10, padding:"2px 7px", borderRadius:4, background:run.status==="completed"?"var(--green-glow)":"var(--red-glow)", color:run.status==="completed"?"var(--green)":"var(--red)" }}>{run.status}</span>
              </div>
              <div className="font-mono" style={{ fontSize:10, color:"var(--text-dim)", marginTop:2 }}>{run.steps} steps</div>
            </div>
            <div className="font-mono" style={{ fontSize:13, color:run.loss?"var(--accent)":"var(--red)" }}>{run.loss?`loss ${run.loss}`:"failed"}</div>
          </div>
        )) : (
          <div style={{ padding:"24px", textAlign:"center" }}>
            <span style={{ fontSize:12, color:"var(--text-dim)" }}>No training runs yet. Start a run above.</span>
          </div>
        )}
      </div>
    </div>
  );
}
