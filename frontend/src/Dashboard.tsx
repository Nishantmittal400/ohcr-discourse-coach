import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000/api";

export default function Dashboard({ data, sessionId }:{data:any; sessionId:string}) {
  const [utterances, setUtterances] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/results/${sessionId}`)
      .then(r => r.json())
      .then(j => setUtterances(j.utterances || []));
  }, [sessionId]);

  const m = data.metrics;
  const cards = data.feedback || [];

  return (
    <div style={{marginTop:24}}>
      <h2>Results</h2>

      <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12}}>
        <MetricCard label="KC Score" value={(m.kc_score*100).toFixed(1) + "%"} />
        <MetricCard label="OHCR Coverage" value={(m.ohcr_index*100).toFixed(1) + "%"} />
        <MetricCard label="Avg HC-Depth" value={m.avg_hc_depth} />
        <MetricCard label="Student Talk" value={(m.student_talk_pct*100).toFixed(0)+"%"} />
        <MetricCard label="Level-5 Presence" value={(m.level5_pct*100).toFixed(0)+"%"} />
        <MetricCard label="Max HC-Depth" value={m.max_hc_depth} />
      </div>

      <h3 style={{marginTop:24}}>OHCR Timeline</h3>
      <Timeline utterances={utterances} />

      <h3 style={{marginTop:24}}>Prescriptive Feedback</h3>
      {cards.length === 0 ? (
        <div style={{padding:12, background:"#f6ffed", border:"1px solid #b7eb8f", borderRadius:8}}>
          ✅ No critical improvements — great session!
        </div>
      ) : cards.map((c:any,i:number)=>(
        <div key={i} style={{padding:12, marginBottom:8, background:"#f9fafb", border:"1px solid #eee", borderRadius:12}}>
          <div style={{fontWeight:600}}>{c.title}</div>
          <div style={{fontStyle:"italic", color:"#555"}}>{c.why}</div>
          <ul style={{marginTop:6}}>
            {c.how.map((h:string,idx:number)=><li key={idx}>{h}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MetricCard({label, value}:{label:string; value:any}) {
  return (
    <div style={{border:"1px solid #eee", borderRadius:12, padding:12}}>
      <div style={{color:"#666", fontSize:13}}>{label}</div>
      <div style={{fontSize:22, fontWeight:700}}>{value}</div>
    </div>
  );
}

function Timeline({ utterances }:{utterances:any[]}) {
  if (!utterances || utterances.length === 0) return <div>No timeline data.</div>;
  const hasOHCR = utterances.some(u => "ohcr" in u);
  if (!hasOHCR) return <div style={{color:"#666"}}>No OHCR sequences detected in this recording.</div>;

  const start = Math.min(...utterances.map(u => u.t_start || 0));
  const end   = Math.max(...utterances.map(u => u.t_end || 0));
  const dur   = Math.max(1, end - start);
  const color = (tag:string) => ({O:"#2563eb", H:"#10b981", C:"#f59e0b", R:"#ef4444", "?":"#9ca3af"} as any)[tag] || "#9ca3af";

  return (
    <div style={{border:"1px solid #eee", borderRadius:12, padding:8}}>
      <div style={{display:"flex", height:24}}>
        {utterances.map((u,i)=> {
          const w = ((u.t_end - u.t_start)/dur)*100;
          const ml = ((u.t_start - start)/dur)*100;
          const tag = u.ohcr || "?";
          return <div key={i} title={`${tag} (${u.t_start.toFixed(1)}s)`} style={{
            width: `${w}%`, marginLeft: `${i===0?ml:0}%`, background: color(tag)
          }} />;
        })}
      </div>
      <div style={{marginTop:8, fontSize:12, color:"#666"}}>Blue=O, Green=H, Orange=C, Red=R, Grey=?</div>
    </div>
  );
}
