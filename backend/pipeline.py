# backend/pipeline.py
"""
This file runs the analysis pipeline:
- Transcribe MP3 using open-source Whisper (local, no API keys)
- Segment into utterances
- Tag discourse acts (Question / Statement / Regulatory)
- Infer roles (teacher/student) with simple heuristics
- Label OHCR (Observe/Hypothesize/Challenge/Resolve) using cues
- Compute metrics + feedback tips
Outputs JSON files in backend/results/{session_id}/
"""

import os, json, re, uuid
from typing import List, Dict
import whisper

PAUSE_S = 0.6  # utterance boundary if gap between segments exceeds this

def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)

def transcribe(audio_path: str) -> List[Dict]:
    """Run Whisper locally and return a list of word/segment-like chunks."""
    model = whisper.load_model("small")  # try "base"/"medium" depending on speed
    result = model.transcribe(audio_path, verbose=False)
    segs = result.get("segments", [])
    return [{"start": s["start"], "end": s["end"], "text": s["text"].strip()} for s in segs]

def segment_utterances(words: List[Dict]) -> List[Dict]:
    """Merge close segments into utterances based on pause threshold."""
    if not words: return []
    utterances, cur = [], {"t_start": words[0]["start"], "t_end": words[0]["end"], "text": words[0]["text"]}
    for w in words[1:]:
        gap = w["start"] - cur["t_end"]
        if gap > PAUSE_S:
            utterances.append(cur)
            cur = {"t_start": w["start"], "t_end": w["end"], "text": w["text"]}
        else:
            cur["t_end"] = w["end"]
            cur["text"] += " " + w["text"]
    utterances.append(cur)
    # Add IDs and duration
    for i, u in enumerate(utterances):
        u["u_id"] = i
        u["duration"] = u["t_end"] - u["t_start"]
    return utterances

QUESTION_RE = re.compile(r"(who|what|why|how|when|where|do|does|did|can|could|would|should|is|are|will)\b.*\?$", re.I)
REG_HINTS = ("open your","submit","turn to","raise your","deadline","attendance")

def tag_acts(utterances: List[Dict]) -> None:
    """Add disc_act: question / statement / regulatory."""
    for u in utterances:
        text = u["text"].lower().strip()
        if any(h in text for h in REG_HINTS):
            u["disc_act"] = "regulatory"
        elif "?" in text or QUESTION_RE.search(text):
            u["disc_act"] = "question"
        else:
            u["disc_act"] = "statement"

def infer_roles(utterances: List[Dict]) -> None:
    """Very simple teacher/student inference; UI can override in future."""
    for i, u in enumerate(utterances):
        t = u["text"].lower()
        if i == 0 or any(x in t for x in ["welcome", "today", "let’s", "now", "observe", "look at", "see this"]):
            u["role"] = "teacher"
        elif any(x in t for x in ["i think", "maybe", "could be", "because", "i feel", "i guess"]) or len(t.split()) < 7:
            u["role"] = "student"
        else:
            u["role"] = "teacher"

def label_ohcr(utterances: List[Dict]) -> None:
    """Rule-based OHCR tagging; safe & explainable baseline."""
    for u in utterances:
        text = u["text"].lower()
        role = u.get("role", "unknown")
        if role=="teacher" and any(k in text for k in ["observe","look at","consider","example","video","see this"]):
            u["ohcr"] = "O"
        elif any(k in text for k in ["maybe","i think","could be","because","suppose","if we"]):
            u["ohcr"] = "H"
        elif any(k in text for k in ["but does","what if","how do we","does that hold","is it always","however","not always"]):
            u["ohcr"] = "C"
        elif role=="teacher" and any(k in text for k in ["so","therefore","we can say","this means","by definition","in summary"]):
            u["ohcr"] = "R"
        else:
            u["ohcr"] = "?"

def compute_metrics(utterances: List[Dict]) -> Dict:
    """Compute basic metrics including HC-depth, OHCR coverage, Level-5 proxy, KC score."""
    n = len(utterances) or 1
    # OHCR coverage
    ohcr_idx = sum(u["ohcr"] in ["O","H","C","R"] for u in utterances) / n
    # HC-depth (count H/C alternations until each R)
    depths, d = [], 0
    for u in utterances:
        if u["ohcr"] in ["H","C"]: d += 1
        if u["ohcr"] == "R":
            depths.append(d//2); d = 0
    avg_hc = sum(depths)/len(depths) if depths else 0
    max_hc = max(depths) if depths else 0
    # student talk %
    student_talk_pct = sum(u.get("role")=="student" for u in utterances)/n
    # simple Level-5 proxy: presence of R near confirmations/application (very naive)
    level5_hits = sum(("therefore" in u["text"].lower() or "apply" in u["text"].lower()) for u in utterances)
    level5_pct = level5_hits / n
    # KC composite (0–1)
    kc = 0.25*ohcr_idx + 0.25*(avg_hc/3) + 0.25*student_talk_pct + 0.25*level5_pct
    return {
        "ohcr_index": round(ohcr_idx,3),
        "avg_hc_depth": round(avg_hc,2),
        "max_hc_depth": int(max_hc),
        "student_talk_pct": round(student_talk_pct,3),
        "level5_pct": round(level5_pct,3),
        "kc_score": round(min(max(kc,0),1),3)
    }

def prescriptions_from_metrics(metrics: Dict) -> List[Dict]:
    """Generate simple, actionable tips based on metrics."""
    cards = []
    if metrics["level5_pct"] < 0.15:
        cards.append({
            "title":"Increase synthesis/application (Level-5)",
            "why":"Level-5 presence is low; synthesis moments were brief.",
            "how":[ "Ask 1 student to restate the rule.",
                    "Apply the idea to a new case before moving on." ]
        })
    if metrics["avg_hc_depth"] < 1.5:
        cards.append({
            "title":"Deepen H↔C loops before Resolve",
            "why":"HC exchanges ended early.",
            "how":[ "Prompt: 'Where might this fail?'", "Add one challenge before closing." ]
        })
    if metrics["student_talk_pct"] < 0.35:
        cards.append({
            "title":"Balance talk time",
            "why":"Students spoke less than 35% of turns.",
            "how":[ "Nominate quieter voices.", "Pause 2–3s after questions." ]
        })
    if metrics["ohcr_index"] < 0.5:
        cards.append({
            "title":"Strengthen OHCR flow",
            "why":"Few utterances matched O/H/C/R pattern.",
            "how":[ "Open each concept with Observe + Knowledge Question.",
                    "Mark a clear Resolve moment that names the concept." ]
        })
    return cards
def prescriptions_from(metrics):
    """Generate prescriptive feedback based on metric thresholds."""
    cards = []

    if metrics["kc_score"] < 0.4:
        cards.append({
            "title": "Encourage Deeper Concept Linking",
            "why": "Knowledge construction score is low, meaning teacher and student dialogue didn’t go deep enough.",
            "how": [
                "Prompt students with open-ended ‘why’ or ‘how’ questions.",
                "Ask follow-ups that connect current discussion to prior knowledge.",
                "Encourage peer-to-peer questioning."
            ]
        })

    if metrics["student_talk_pct"] < 0.25:
        cards.append({
            "title": "Increase Student Talk Ratio",
            "why": "Students spoke less than 25% of the total discourse.",
            "how": [
                "Include student-led reflection rounds.",
                "Ask for multiple viewpoints before summarizing yourself.",
                "Give students short prompts to summarize what was discussed."
            ]
        })

    if metrics["level5_pct"] < 0.15:
        cards.append({
            "title": "Promote Level-5 Discourse",
            "why": "Very few moments reached evaluative or reflective discourse (Level 5).",
            "how": [
                "Ask learners to critique an idea or offer alternative perspectives.",
                "Use metacognitive questions like ‘What led you to that conclusion?’",
                "Encourage summarizing and contrasting multiple solutions."
            ]
        })

    return cards

def run_pipeline(audio_path: str, out_dir: str) -> Dict:
    """Main entry — runs everything and writes JSON artifacts."""
    ensure_dir(out_dir)
    words = transcribe(audio_path)
    with open(os.path.join(out_dir, "words.json"), "w") as f: json.dump(words,f,indent=2)

    utts = segment_utterances(words)
    tag_acts(utts)
    infer_roles(utts)
    label_ohcr(utts)
    with open(os.path.join(out_dir, "utterances.json"), "w") as f: json.dump(utts,f,indent=2)

    metrics = compute_metrics(utts)
    with open(os.path.join(out_dir, "metrics.json"), "w") as f: json.dump(metrics,f,indent=2)

    cards = prescriptions_from(metrics)
    summary = {"metrics": metrics, "feedback": cards}
    with open(os.path.join(out_dir, "summary.json"), "w") as f: json.dump(summary,f,indent=2)

    return summary
