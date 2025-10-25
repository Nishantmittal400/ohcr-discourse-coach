import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000/api";

type Metric = {
  label: string;
  value: string | number;
};

export default function Dashboard({ data, sessionId }: { data: any; sessionId: string }) {
  const [utterances, setUtterances] = useState<any[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setUtterances([]);
      return;
    }

    let ignore = false;
    fetch(`${API_BASE}/results/${sessionId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!ignore) {
          setUtterances(j.utterances || []);
        }
      })
      .catch(() => {
        if (!ignore) setUtterances([]);
      });

    return () => {
      ignore = true;
    };
  }, [sessionId]);

  const metrics: Metric[] = [
    { label: "KC Score", value: `${(data.metrics.kc_score * 100).toFixed(1)}%` },
    { label: "OHCR Coverage", value: `${(data.metrics.ohcr_index * 100).toFixed(1)}%` },
    { label: "Avg HC-Depth", value: data.metrics.avg_hc_depth },
    { label: "Student Talk", value: `${(data.metrics.student_talk_pct * 100).toFixed(0)}%` },
    { label: "Level-5 Presence", value: `${(data.metrics.level5_pct * 100).toFixed(0)}%` },
    { label: "Max HC-Depth", value: data.metrics.max_hc_depth },
  ];

  const cards = data.feedback || [];

  return (
    <div className="results-grid">
      <div className="card">
        <div className="card__title">Core metrics</div>
        <div className="metric-grid">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
      </div>

      <div className="card timeline-card">
        <div className="card__title">OHCR timeline</div>
        <Timeline utterances={utterances} />
      </div>

      <div className="card">
        <div className="card__title">Prescriptive coaching tips</div>
        {cards.length === 0 ? (
          <div className="empty-state">✅ No critical improvements — great session!</div>
        ) : (
          <div className="feedback-list">
            {cards.map((c: any) => (
              <div className="feedback-card" key={c.title}>
                <div className="feedback-card__title">{c.title}</div>
                <div className="feedback-card__why">{c.why}</div>
                <ul>
                  {c.how.map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-card">
      <span className="metric-card__label">{label}</span>
      <span className="metric-card__value">{value}</span>
    </div>
  );
}

function Timeline({ utterances }: { utterances: any[] }) {
  if (!utterances || utterances.length === 0) {
    return <div className="empty-state">No timeline data yet.</div>;
  }

  const hasOHCR = utterances.some((u) => "ohcr" in u);
  if (!hasOHCR) {
    return <div className="empty-state">No OHCR sequences detected in this recording.</div>;
  }

  const start = Math.min(...utterances.map((u) => u.t_start || 0));
  const end = Math.max(...utterances.map((u) => u.t_end || 0));
  const duration = Math.max(1, end - start);

  const legend = [
    { tag: "O", label: "Observe", className: "O" },
    { tag: "H", label: "Hypothesize", className: "H" },
    { tag: "C", label: "Challenge", className: "C" },
    { tag: "R", label: "Resolve", className: "R" },
    { tag: "?", label: "Other", className: "unknown" },
  ];

  return (
    <>
      <div className="timeline-track">
        {utterances.map((u, index) => {
          const width = ((u.t_end - u.t_start) / duration) * 100;
          const offset = ((u.t_start - start) / duration) * 100;
          const tag = u.ohcr || "?";
          const tagClass = tag && tag !== "?" ? tag : "unknown";

          return (
            <span
              key={`${u.u_id || index}-${tag}-${u.t_start}`}
              className={`timeline-segment timeline-segment--${tagClass}`}
              style={{ left: `${offset}%`, width: `${Math.max(width, 0.8)}%` }}
              title={`${tag.toUpperCase()} • ${u.t_start.toFixed(1)}s – ${u.t_end.toFixed(1)}s`}
            />
          );
        })}
      </div>

      <div className="timeline-legend">
        {legend.map((item) => (
          <span key={item.tag} className="legend-item">
            <span className={`legend-swatch timeline-segment--${item.className}`}></span>
            {item.label}
          </span>
        ))}
      </div>
    </>
  );
}
