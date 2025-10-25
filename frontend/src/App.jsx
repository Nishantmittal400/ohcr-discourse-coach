import { useState } from "react";
import Dashboard from "./Dashboard";

const API_BASE = "http://localhost:8000/api";

export default function App() {
  const [file, setFile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function upload() {
    try {
      if (!file) return alert("Choose an MP3 first.");
      setError("");
      setLoading(true);
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSession(data);
    } catch (e) {
      setError(e?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{maxWidth: 900, margin: "30px auto", fontFamily: "system-ui"}}>
      <h1>OHCR Discourse Coach</h1>
      <p>Upload a class MP3 to analyze discourse flow and knowledge construction.</p>

      <div style={{margin:"16px 0", padding:12, border:"1px solid #ddd", borderRadius:12}}>
        <input type="file" accept=".mp3" onChange={e => setFile(e.target.files?.[0] || null)} />
        <button onClick={upload} disabled={loading} style={{marginLeft:12}}>
          {loading ? "Analyzing…" : "Upload & Analyze"}
        </button>
        {error && <div style={{color:"#b91c1c", marginTop:8}}>{error}</div>}
      </div>

      {session?.summary && (
        <Dashboard data={session.summary} sessionId={session.session_id} />
      )}
    </div>
  );
}
