
"use client";
import { useState, useEffect } from "react";
import { Play, TrendingUp, Brain, BarChart2, GitCompare, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ReferenceLine
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Shared ────────────────────────────────────────────────────────────────────

function RunBtn({ onClick, loading, label, color="var(--accent)" }: any) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      display:"flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:8,
      background:loading?`${color}15`:color,border:`1px solid ${color}`,
      color:loading?color:"#000",cursor:loading?"not-allowed":"pointer",
      fontWeight:700,fontSize:12,fontFamily:"DM Sans",flexShrink:0,
    }}>
      <Play size={11}/>{loading?"Running…":label}
    </button>
  );
}

function StatCard({ label, value, color, sub }: any) {
  return (
    <div style={{background:"var(--bg-3)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px"}}>
      <div style={{fontSize:10,color:"var(--text-muted)",marginBottom:4}}>{label}</div>
      <div className="font-display" style={{fontSize:22,fontWeight:700,color,letterSpacing:"-0.02em"}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:"var(--text-dim)",marginTop:3}}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, color="var(--accent)" }: any) {
  return (
    <div style={{height:4,background:"var(--border)",borderRadius:2,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min(value,1)*100}%`,background:color,transition:"width 0.8s ease"}}/>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, color, onRun, loading, runLabel }: any) {
  return (
    <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
          <Icon size={14} color={color}/>
          <span className="font-display" style={{fontSize:14,fontWeight:700}}>{title}</span>
        </div>
        <div style={{fontSize:11,color:"var(--text-muted)"}}>{subtitle}</div>
      </div>
      {onRun&&<RunBtn onClick={onRun} loading={loading} label={runLabel||"Run"} color={color}/>}
    </div>
  );
}

function ProgressSection({ loading, progress, label, color }: any) {
  if (!loading) return null;
  return (
    <div style={{padding:"12px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span className="font-mono" style={{fontSize:11,color:"var(--text-muted)"}}>{label}</span>
        <span className="font-mono" style={{fontSize:11,color}}>{progress}%</span>
      </div>
      <div style={{height:4,background:"var(--border)",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${progress}%`,background:`linear-gradient(90deg,${color},var(--green))`,transition:"width 0.3s"}}/>
      </div>
    </div>
  );
}

// ── Panel 1: Enhanced Retrieval ───────────────────────────────────────────────

function RetrievalPanel() {
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [results,  setResults]  = useState<any>(null);

  const run = async () => {
    setLoading(true); setProgress(0); setResults(null);
    await fetch(`${API}/eval/enhanced/retrieval`, {method:"POST"});
    const iv = setInterval(()=>setProgress(p=>Math.min(p+4,90)),200);
    await new Promise(r=>setTimeout(r,8000));
    clearInterval(iv); setProgress(100);
    const res = await fetch(`${API}/eval/enhanced/retrieval/results`);
    if(res.ok) {
      const data = await res.json();
      if(data.summary) setResults(data);
    }
    setLoading(false);
  };

  const barData = results?.results?.map((r:any,i:number)=>({
    name:`Q${i+1}`,
    relevance: parseFloat((r.avg_relevance*100).toFixed(1)),
    precision5:parseFloat((r.precision_at_5*100).toFixed(1)),
    mrr:       parseFloat((r.mrr*100).toFixed(1)),
  }))??[];

  return (
    <div style={{background:"var(--bg-2)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",marginBottom:16}}>
      <SectionHeader icon={TrendingUp} title="Retrieval Quality" color="var(--accent)"
        subtitle="10 labelled queries — measures Relevance, Precision@5, MRR, Source Hit Rate, Ticker Hit Rate"
        onRun={run} loading={loading} runLabel="Run Retrieval"/>
      <ProgressSection loading={loading} progress={progress} label="Evaluating 10 queries…" color="var(--accent)"/>

      {results&&(
        <div style={{padding:"16px 18px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:16}}>
            <StatCard label="Avg Relevance"   value={`${(results.summary.avg_relevance*100).toFixed(1)}%`}   color="var(--accent)"/>
            <StatCard label="Precision@5"     value={`${(results.summary.avg_precision_5*100).toFixed(1)}%`} color="var(--green)"  sub="Fraction of top-5 relevant"/>
            <StatCard label="Mean Recip Rank" value={results.summary.avg_mrr.toFixed(3)}                      color="#a78bfa"       sub="MRR across queries"/>
            <StatCard label="Source Hit Rate" value={`${(results.summary.avg_source_hit*100).toFixed(1)}%`}   color="var(--amber)"/>
            <StatCard label="Ticker Hit Rate" value={`${(results.summary.avg_ticker_hit*100).toFixed(1)}%`}   color="#f472b6"/>
            <StatCard label="Avg Latency"     value={`${results.summary.avg_latency_ms}ms`}                   color="var(--text-muted)"/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Relevance vs Precision@5 per Query</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} margin={{top:2,right:4,left:-22,bottom:0}}>
                  <XAxis dataKey="name" tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false} domain={[0,100]} unit="%"/>
                  <Tooltip contentStyle={{background:"var(--bg-3)",border:"1px solid var(--border-2)",borderRadius:6,fontSize:11,fontFamily:"DM Mono"}}/>
                  <Bar dataKey="relevance"  name="Relevance"   fill="var(--accent)" radius={[3,3,0,0]}/>
                  <Bar dataKey="precision5" name="Precision@5" fill="var(--green)"  radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>MRR per Query</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} margin={{top:2,right:4,left:-22,bottom:0}}>
                  <XAxis dataKey="name" tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false} domain={[0,1]}/>
                  <Tooltip contentStyle={{background:"var(--bg-3)",border:"1px solid var(--border-2)",borderRadius:6,fontSize:11,fontFamily:"DM Mono"}}/>
                  <Bar dataKey="mrr" name="MRR" radius={[3,3,0,0]}>
                    {barData.map((_:any,i:number)=>(
                      <Cell key={i} fill={_.mrr>60?"var(--green)":_.mrr>30?"var(--accent)":"var(--amber)"}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Per-Query Breakdown</div>
          <div style={{borderRadius:8,overflow:"hidden",border:"1px solid var(--border)"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"var(--bg-3)"}}>
                  {["Query","Relevance","Precision@5","MRR","Source Hit","Ticker Hit","Latency"].map(h=>(
                    <th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:10,color:"var(--text-muted)",fontWeight:600,borderBottom:"1px solid var(--border)"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.results.map((r:any,i:number)=>(
                  <tr key={i} style={{borderBottom:i<results.results.length-1?"1px solid var(--border)":"none"}}>
                    <td style={{padding:"7px 10px",fontSize:11,color:"var(--text)",maxWidth:180}}>{r.query}</td>
                    <td style={{padding:"7px 10px"}}><span className="font-mono" style={{fontSize:11,color:r.avg_relevance>0.7?"var(--green)":"var(--amber)"}}>{(r.avg_relevance*100).toFixed(1)}%</span></td>
                    <td style={{padding:"7px 10px"}}><span className="font-mono" style={{fontSize:11,color:r.precision_at_5>0.6?"var(--green)":"var(--amber)"}}>{(r.precision_at_5*100).toFixed(0)}%</span></td>
                    <td style={{padding:"7px 10px"}}><span className="font-mono" style={{fontSize:11,color:"#a78bfa"}}>{r.mrr.toFixed(3)}</span></td>
                    <td style={{padding:"7px 10px"}}><span className="font-mono" style={{fontSize:11,color:r.source_hit_rate>=1?"var(--green)":"var(--amber)"}}>{(r.source_hit_rate*100).toFixed(0)}%</span></td>
                    <td style={{padding:"7px 10px"}}><span className="font-mono" style={{fontSize:11,color:"var(--text-muted)"}}>{(r.ticker_hit_rate*100).toFixed(0)}%</span></td>
                    <td style={{padding:"7px 10px"}}><span className="font-mono" style={{fontSize:11,color:"var(--text-dim)"}}>{r.latency_ms}ms</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!results&&!loading&&<div style={{padding:28,textAlign:"center",color:"var(--text-dim)",fontSize:12}}>Run to benchmark retrieval with Precision@5 and MRR</div>}
    </div>
  );
}

// ── Panel 2: Faithfulness ─────────────────────────────────────────────────────

function FaithfulnessPanel() {
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [results,  setResults]  = useState<any>(null);
  const [expanded, setExpanded] = useState<number|null>(null);

  const run = async () => {
    setLoading(true); setProgress(0); setResults(null);
    await fetch(`${API}/eval/faithfulness`,{method:"POST"});
    const iv = setInterval(()=>setProgress(p=>Math.min(p+1.2,90)),400);
    await new Promise(r=>setTimeout(r,60000));
    clearInterval(iv); setProgress(100);
    const res = await fetch(`${API}/eval/faithfulness/results`);
    if(res.ok) {
      const data = await res.json();
      if(data.summary) setResults(data);
    }
    setLoading(false);
  };

  const radarData = results?[
    {metric:"Faithfulness",  value:parseFloat((results.summary.avg_faithfulness*100).toFixed(1))},
    {metric:"Tool Comply",   value:parseFloat((results.summary.tool_compliance*100).toFixed(1))},
    {metric:"Takeaway Rate", value:parseFloat((results.summary.takeaway_rate*100).toFixed(1))},
    {metric:"Supported%",    value:parseFloat((results.summary.avg_supported_pct*100).toFixed(1))},
  ]:[];

  return (
    <div style={{background:"var(--bg-2)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",marginBottom:16}}>
      <SectionHeader icon={BarChart2} title="Answer Quality — Faithfulness (LLM-as-Judge)" color="var(--green)"
        subtitle="4 questions — Claude verifies each claim in the answer against retrieved context. Takes ~60s."
        onRun={run} loading={loading} runLabel="Run Faithfulness"/>
      <ProgressSection loading={loading} progress={progress} label="Running 4 questions + faithfulness verification…" color="var(--green)"/>

      {results&&(
        <div style={{padding:"16px 18px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <StatCard label="Avg Faithfulness"  value={`${(results.summary.avg_faithfulness*100).toFixed(0)}%`}  color="var(--green)"  sub="Claims backed by context"/>
              <StatCard label="Avg Supported"     value={`${(results.summary.avg_supported_pct*100).toFixed(0)}%`} color="var(--accent)" sub="Supported / total claims"/>
              <StatCard label="Tool Compliance"   value={`${(results.summary.tool_compliance*100).toFixed(0)}%`}   color="#a78bfa"       sub="Tool invoked when expected"/>
              <StatCard label="Takeaway Rate"     value={`${(results.summary.takeaway_rate*100).toFixed(0)}%`}     color="var(--amber)"  sub="Ends with investment implication"/>
            </div>
            <div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Quality Dimensions</div>
              <ResponsiveContainer width="100%" height={170}>
                <RadarChart data={radarData} margin={{top:10,right:20,left:20,bottom:10}}>
                  <PolarGrid stroke="var(--border)"/>
                  <PolarAngleAxis dataKey="metric" tick={{fontSize:9,fill:"var(--text-muted)",fontFamily:"DM Mono"}}/>
                  <Radar dataKey="value" stroke="var(--green)" fill="var(--green)" fillOpacity={0.2}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Per-Question Faithfulness Breakdown</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {results.results.map((r:any,i:number)=>(
              <div key={i} style={{background:"var(--bg-3)",borderRadius:8,border:"1px solid var(--border)",overflow:"hidden"}}>
                <div onClick={()=>setExpanded(expanded===i?null:i)}
                  style={{padding:"10px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"var(--text)",fontWeight:500,marginBottom:6}}>{r.question}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:11,color:"var(--text-muted)"}}>Faithfulness:</span>
                      <span className="font-mono" style={{fontSize:12,color:r.faithfulness.score>0.7?"var(--green)":r.faithfulness.score>0.4?"var(--amber)":"var(--red)",fontWeight:600}}>
                        {(r.faithfulness.score*100).toFixed(0)}%
                      </span>
                      <span style={{fontSize:10,color:"var(--text-dim)"}}>
                        ({r.faithfulness.supported}/{r.faithfulness.total} claims supported)
                      </span>
                      {r.tool_used&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:4,background:"rgba(0,212,255,0.1)",color:"var(--accent)",fontFamily:"DM Mono"}}>Tool: {r.tool_names?.[0]||"used"}</span>}
                      {r.has_takeaway?<CheckCircle size={13} color="var(--green)"/>:<XCircle size={13} color="var(--text-dim)"/>}
                    </div>
                    <div style={{marginTop:6}}>
                      <ProgressBar value={r.faithfulness.score} color={r.faithfulness.score>0.7?"var(--green)":"var(--amber)"}/>
                    </div>
                  </div>
                  <div style={{color:"var(--text-dim)",marginLeft:10,marginTop:2}}>
                    {expanded===i?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
                  </div>
                </div>
                {expanded===i&&(
                  <div style={{padding:"0 14px 12px"}}>
                    <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:6,fontStyle:"italic"}}>
                      {r.faithfulness.justification}
                    </div>
                    {r.faithfulness.claims?.length>0&&(
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        {r.faithfulness.claims.map((c:any,j:number)=>(
                          <div key={j} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"4px 8px",borderRadius:5,
                            background:c.verdict==="SUPPORTED"?"rgba(22,163,74,0.06)":c.verdict==="CONTRADICTED"?"rgba(244,63,94,0.06)":"rgba(90,115,148,0.06)"}}>
                            <span style={{fontSize:10,padding:"1px 5px",borderRadius:3,fontFamily:"DM Mono",flexShrink:0,
                              background:c.verdict==="SUPPORTED"?"var(--green-glow)":c.verdict==="CONTRADICTED"?"var(--red-glow)":"rgba(90,115,148,0.1)",
                              color:c.verdict==="SUPPORTED"?"var(--green)":c.verdict==="CONTRADICTED"?"var(--red)":"var(--text-muted)"}}>
                              {c.verdict}
                            </span>
                            <span style={{fontSize:11,color:"var(--text-muted)"}}>{c.claim}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {r.answer_preview&&(
                      <div style={{marginTop:8,fontSize:11,color:"var(--text-dim)",fontStyle:"italic",lineHeight:1.5}}>
                        "{r.answer_preview}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {!results&&!loading&&<div style={{padding:28,textAlign:"center",color:"var(--text-dim)",fontSize:12}}>Run to verify answer faithfulness — Claude checks each claim against retrieved context</div>}
    </div>
  );
}

// ── Panel 3: A/B Self-Persistence ─────────────────────────────────────────────

function ABPanel() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const run = async () => {
    setLoading(true); setResults(null);
    await fetch(`${API}/eval/ab_persistence`,{method:"POST"});
    await new Promise(r=>setTimeout(r,5000));
    const res = await fetch(`${API}/eval/ab_persistence/results`);
    if(res.ok) {
      const data = await res.json();
      if(data.summary) setResults(data);
    }
    setLoading(false);
  };

  const barData = results?.results?.map((r:any,i:number)=>({
    name:`Q${i+1}`,
    withP5:    parseFloat((r.with_insights.precision_5*100).toFixed(1)),
    withoutP5: parseFloat((r.without_insights.precision_5*100).toFixed(1)),
    withMRR:   parseFloat((r.with_insights.mrr*100).toFixed(1)),
    withoutMRR:parseFloat((r.without_insights.mrr*100).toFixed(1)),
  }))??[];

  const deltaData = results?.results?.map((r:any,i:number)=>({
    name:`Q${i+1}`,
    deltaP5: parseFloat((r.delta.precision_5*100).toFixed(1)),
    deltaMRR:parseFloat((r.delta.mrr*100).toFixed(1)),
  }))??[];

  return (
    <div style={{background:"var(--bg-2)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",marginBottom:16}}>
      <SectionHeader icon={GitCompare} title="A/B Self-Persistence Test" color="#f472b6"
        subtitle="Compares retrieval WITH vs WITHOUT the insight store — directly measures the RACL feedback loop's contribution"
        onRun={run} loading={loading} runLabel={loading?"Running…":"Run A/B Test"}/>

      {loading&&(
        <div style={{padding:"20px 18px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:24,height:24,borderRadius:"50%",border:"2px solid #f472b6",borderTopColor:"transparent",animation:"spin 0.8s linear infinite"}}/>
          <span className="font-mono" style={{fontSize:11,color:"var(--text-muted)"}}>Running 5 queries with and without insight store…</span>
        </div>
      )}

      {results&&(
        <div style={{padding:"16px 18px"}}>
          {/* Summary callout */}
          <div style={{padding:"12px 16px",borderRadius:10,marginBottom:16,
            background:results.summary.avg_delta_precision_5>0?"rgba(244,114,182,0.07)":"rgba(90,115,148,0.07)",
            border:`1px solid ${results.summary.avg_delta_precision_5>0?"rgba(244,114,182,0.3)":"rgba(90,115,148,0.3)"}`}}>
            <div className="font-display" style={{fontSize:13,fontWeight:700,color:"#f472b6",marginBottom:4}}>
              Self-Persistence Impact
            </div>
            <div style={{fontSize:12,color:"var(--text-muted)",lineHeight:1.6}}>
              {results.summary.interpretation}
            </div>
            <div style={{display:"flex",gap:16,marginTop:10}}>
              <div>
                <div style={{fontSize:10,color:"var(--text-dim)"}}>Avg ΔPrecision@5</div>
                <div className="font-mono" style={{fontSize:16,fontWeight:700,
                  color:results.summary.avg_delta_precision_5>0?"var(--green)":results.summary.avg_delta_precision_5<0?"var(--red)":"var(--text-muted)"}}>
                  {results.summary.avg_delta_precision_5>0?"+":""}{(results.summary.avg_delta_precision_5*100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:"var(--text-dim)"}}>Avg ΔMRR</div>
                <div className="font-mono" style={{fontSize:16,fontWeight:700,
                  color:results.summary.avg_delta_mrr>0?"var(--green)":results.summary.avg_delta_mrr<0?"var(--red)":"var(--text-muted)"}}>
                  {results.summary.avg_delta_mrr>0?"+":""}{results.summary.avg_delta_mrr.toFixed(3)}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:"var(--text-dim)"}}>Avg ΔRelevance</div>
                <div className="font-mono" style={{fontSize:16,fontWeight:700,
                  color:results.summary.avg_delta_relevance>0?"var(--green)":results.summary.avg_delta_relevance<0?"var(--red)":"var(--text-muted)"}}>
                  {results.summary.avg_delta_relevance>0?"+":""}{(results.summary.avg_delta_relevance*100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:"var(--text-dim)"}}>Insights in Store</div>
                <div className="font-mono" style={{fontSize:16,fontWeight:700,color:"#f472b6"}}>
                  {results.total_insights_in_store}
                </div>
              </div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Precision@5: With vs Without Insights</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} margin={{top:2,right:4,left:-22,bottom:0}}>
                  <XAxis dataKey="name" tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false} domain={[0,100]} unit="%"/>
                  <Tooltip contentStyle={{background:"var(--bg-3)",border:"1px solid var(--border-2)",borderRadius:6,fontSize:11,fontFamily:"DM Mono"}}/>
                  <Bar dataKey="withP5"    name="With insights"    fill="#f472b6" radius={[3,3,0,0]}/>
                  <Bar dataKey="withoutP5" name="Without insights" fill="var(--border)" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Delta Precision@5 per Query (positive = insight store helps)</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={deltaData} margin={{top:2,right:4,left:-22,bottom:0}}>
                  <XAxis dataKey="name" tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false} unit="%"/>
                  <Tooltip contentStyle={{background:"var(--bg-3)",border:"1px solid var(--border-2)",borderRadius:6,fontSize:11,fontFamily:"DM Mono"}}/>
                  <ReferenceLine y={0} stroke="var(--text-dim)" strokeDasharray="3 2"/>
                  <Bar dataKey="deltaP5" name="ΔPrecision@5" radius={[3,3,0,0]}>
                    {deltaData.map((_:any,i:number)=>(
                      <Cell key={i} fill={_.deltaP5>=0?"var(--green)":"var(--red)"}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{marginTop:12,fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Per-Query Detail</div>
          <div style={{borderRadius:8,overflow:"hidden",border:"1px solid var(--border)"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"var(--bg-3)"}}>
                  {["Query","P@5 With","P@5 Without","ΔP@5","MRR With","MRR Without","ΔMRR","# Insights Used"].map(h=>(
                    <th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:9,color:"var(--text-muted)",fontWeight:600,borderBottom:"1px solid var(--border)"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.results.map((r:any,i:number)=>{
                  const dp5 = r.delta.precision_5;
                  const dm  = r.delta.mrr;
                  return (
                    <tr key={i} style={{borderBottom:i<results.results.length-1?"1px solid var(--border)":"none"}}>
                      <td style={{padding:"7px 8px",fontSize:10,color:"var(--text)",maxWidth:160}}>{r.query}</td>
                      <td style={{padding:"7px 8px"}}><span className="font-mono" style={{fontSize:10,color:"#f472b6"}}>{(r.with_insights.precision_5*100).toFixed(0)}%</span></td>
                      <td style={{padding:"7px 8px"}}><span className="font-mono" style={{fontSize:10,color:"var(--text-muted)"}}>{(r.without_insights.precision_5*100).toFixed(0)}%</span></td>
                      <td style={{padding:"7px 8px"}}><span className="font-mono" style={{fontSize:10,color:dp5>0?"var(--green)":dp5<0?"var(--red)":"var(--text-dim)"}}>{dp5>0?"+":""}{(dp5*100).toFixed(0)}%</span></td>
                      <td style={{padding:"7px 8px"}}><span className="font-mono" style={{fontSize:10,color:"#f472b6"}}>{r.with_insights.mrr.toFixed(3)}</span></td>
                      <td style={{padding:"7px 8px"}}><span className="font-mono" style={{fontSize:10,color:"var(--text-muted)"}}>{r.without_insights.mrr.toFixed(3)}</span></td>
                      <td style={{padding:"7px 8px"}}><span className="font-mono" style={{fontSize:10,color:dm>0?"var(--green)":dm<0?"var(--red)":"var(--text-dim)"}}>{dm>0?"+":""}{dm.toFixed(3)}</span></td>
                      <td style={{padding:"7px 8px"}}><span className="font-mono" style={{fontSize:10,color:"#f472b6"}}>{r.with_insights.n_insights}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!results&&!loading&&(
        <div style={{padding:28,textAlign:"center",color:"var(--text-dim)",fontSize:12}}>
          Run to measure how much the self-persistence feedback loop actually improves retrieval.
          Requires at least a few stored insights — chat first, then run.
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Memory Health Panel ────────────────────────────────────────────────────────

function MemoryHealthPanel() {
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState<any>(null);

  const run = async () => {
    setLoading(true);
    const res = await fetch(`${API}/eval/memory_health`);
    if(res.ok) setData(await res.json());
    setLoading(false);
  };

  useEffect(()=>{run();},[]);

  const sourceData  = data?Object.entries(data.source_breakdown||{}).map(([name,value])=>({name,value})):[];
  const staleData   = data?Object.entries(data.staleness_buckets||{}).map(([name,value])=>({name:name.replace(/_/g," "),value})):[];
  const growthData  = data?.memory_growth||[];
  const tagData     = data?Object.entries(data.insight_tags||{}).map(([tag,count])=>({tag,count})).sort((a:any,b:any)=>b.count-a.count).slice(0,8):[];
  const PIE_COLORS  = ["var(--accent)","var(--green)","var(--amber)","#a78bfa","#f472b6","#34d399"];

  return (
    <div style={{background:"var(--bg-2)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
      <SectionHeader icon={Brain} title="Memory Health" color="#f472b6"
        subtitle="Source distribution, staleness profile, insight growth, and tag analysis — auto-loads on open"
        onRun={run} loading={loading} runLabel="Refresh"/>

      {loading&&!data&&<div style={{padding:24,textAlign:"center",fontSize:12,color:"var(--text-dim)"}}>Loading…</div>}

      {data&&(
        <div style={{padding:"16px 18px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
            <StatCard label="Total Chunks"    value={(data.total_chunks||0).toLocaleString()} color="var(--accent)"/>
            <StatCard label="Stored Insights" value={(data.insight_count||0).toString()}       color="#f472b6" sub="Self-generated"/>
            <StatCard label="Fresh (< 7d)"    value={(data.staleness_buckets?.fresh_0_7d||0).toLocaleString()} color="var(--green)"/>
            <StatCard label="Health Score"    value={`${((data.health_score||0)*100).toFixed(0)}%`} color={data.health_score>0.5?"var(--green)":"var(--amber)"} sub="% fresh chunks"/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            <div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Chunks by Source</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={sourceData} layout="vertical" margin={{top:0,right:20,left:50,bottom:0}}>
                  <XAxis type="number" tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{background:"var(--bg-3)",border:"1px solid var(--border-2)",borderRadius:6,fontSize:11}}/>
                  <Bar dataKey="value" radius={[0,3,3,0]}>
                    {sourceData.map((_:any,i:number)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Staleness Distribution</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={staleData} layout="vertical" margin={{top:0,right:20,left:70,bottom:0}}>
                  <XAxis type="number" tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false} width={65}/>
                  <Tooltip contentStyle={{background:"var(--bg-3)",border:"1px solid var(--border-2)",borderRadius:6,fontSize:11}}/>
                  <Bar dataKey="value" radius={[0,3,3,0]}>
                    {staleData.map((_:any,i:number)=>(
                      <Cell key={i} fill={i===0?"var(--green)":i===1?"var(--accent)":i===2?"var(--amber)":"var(--red)"}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {growthData.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Cumulative Insight Growth Over Time</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={growthData} margin={{top:2,right:4,left:-22,bottom:0}}>
                  <XAxis dataKey="date" tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{background:"var(--bg-3)",border:"1px solid var(--border-2)",borderRadius:6,fontSize:11,fontFamily:"DM Mono"}}/>
                  <Line type="monotone" dataKey="cumulative" name="Total Insights" stroke="#f472b6" strokeWidth={2} dot={{fill:"#f472b6",r:3}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {tagData.length>0&&(
            <div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>Inference Tag Distribution</div>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={tagData} margin={{top:2,right:4,left:-22,bottom:0}}>
                  <XAxis dataKey="tag" tick={{fontSize:8,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:9,fill:"var(--text-dim)",fontFamily:"DM Mono"}} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{background:"var(--bg-3)",border:"1px solid var(--border-2)",borderRadius:6,fontSize:11}}/>
                  <Bar dataKey="count" fill="#f472b6" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {growthData.length===0&&tagData.length===0&&(
            <div style={{padding:16,textAlign:"center",borderRadius:8,background:"var(--bg-3)",border:"1px solid var(--border)"}}>
              <div style={{fontSize:12,color:"var(--text-dim)"}}>No insights yet — chat with the analyst first, then refresh</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Evaluation() {
  return (
    <div style={{height:"100%",overflow:"auto",padding:24}}>
      <div className="fade-in" style={{marginBottom:20}}>
        <h1 className="font-display" style={{fontSize:22,fontWeight:800}}>Evaluation</h1>
        <p style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>
          Four independent evaluation suites — Precision@5 and MRR for retrieval, LLM-as-judge faithfulness for answer quality, A/B test for self-persistence
        </p>
      </div>
      <RetrievalPanel/>
      <FaithfulnessPanel/>
      <ABPanel/>
      <MemoryHealthPanel/>
    </div>
  );
}
