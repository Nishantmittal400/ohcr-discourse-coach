# backend/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os, uuid, shutil, json
from backend.pipeline import run_pipeline


app = FastAPI(title="OHCR Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

BASE_DIR = os.path.dirname(__file__)
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    # save file to disk
    if not file.filename.lower().endswith(".mp3"):
        raise HTTPException(status_code=400, detail="Please upload an .mp3 file")
    session_id = uuid.uuid4().hex[:8]
    sess_upload = os.path.join(UPLOAD_DIR, f"{session_id}.mp3")
    with open(sess_upload, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # run pipeline (synchronous for MVP; later we’ll async/queue this)
    out_dir = os.path.join(RESULTS_DIR, session_id)
    summary = run_pipeline(sess_upload, out_dir)

    return {"session_id": session_id, "summary": summary}

@app.get("/api/results/{session_id}")
def get_results(session_id: str):
    out_dir = os.path.join(RESULTS_DIR, session_id)
    summ_path = os.path.join(out_dir, "summary.json")
    utt_path = os.path.join(out_dir, "utterances.json")
    if not os.path.exists(summ_path):
        raise HTTPException(404, "Not found.")
    with open(summ_path) as f: summary = json.load(f)
    with open(utt_path) as f: utts = json.load(f)
    return {"summary": summary, "utterances": utts}
