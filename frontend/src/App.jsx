import { useState } from "react";
import Dashboard from "./Dashboard";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export default function App() {
  const [file, setFile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function upload() {
    try {
      if (!file) {
        return alert("Choose an MP3 first.");
      }
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

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] || null);
  };

  const shortSessionId = session?.session_id ? session.session_id.slice(0, 8) : null;

  return (
    <main className="app-shell">
      <header className="hero">
        <span className="hero__tag">
          <span className="hero__tag-dot" />
          Phase 1 · Prototype
        </span>
        <h1>Make classroom thinking visible</h1>
        <p>
          Upload a classroom MP3 to map OHCR moves, student talk ratios, and coaching
          suggestions in seconds—right from your laptop.
        </p>
      </header>

      <section className="card upload-card">
        <div className="upload-card__body">
          <label className="file-select" htmlFor="audio-upload">
            <input
              id="audio-upload"
              className="file-select__input"
              type="file"
              accept=".mp3"
              onChange={handleFileChange}
            />
            <span className="file-select__title">
              {file ? "Ready to analyze" : "Upload classroom audio (.mp3)"}
            </span>
            <span className="file-select__hint">
              {file ? "Click to choose a different file" : "Drag & drop or click to browse · MP3 up to ~120 minutes"}
            </span>
            {file && <span className="file-select__file">{file.name}</span>}
          </label>

          <button className="primary-btn" onClick={upload} disabled={loading}>
            {loading ? "Analyzing…" : "Run OHCR analysis"}
          </button>
        </div>

        <p className="upload-card__note">
          We transcribe locally with Whisper, infer discourse roles, label OHCR moves, and
          surface actionable coaching cards. Audio stays on your machine unless you choose
          to sync it.
        </p>

        {error && <div className="alert alert--error">{error}</div>}
      </section>

      {session?.summary && (
        <section className="results-section">
          <div className="section-heading">
            <div>
              <div className="section-heading__label">Session insights</div>
              <h2>Classroom discourse snapshot</h2>
            </div>
            {session.session_id && (
              <div className="section-heading__meta">
                Session ID · {shortSessionId || session.session_id}
              </div>
            )}
          </div>

          <Dashboard data={session.summary} sessionId={session.session_id} />
        </section>
      )}
    </main>
  );
}
