import os
import uuid
import unicodedata
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

from session_store import (
    create_session,
    get_session,
    update_session,
    append_to_history,
    append_score,
    calculate_rolling_average,
    determine_difficulty,
)
from resume_parser import parse_resume
from schemas import AnswerScore, FinalScorecard
from agents import evaluate_answer, generate_question, generate_final_scorecard

load_dotenv()

app = FastAPI(
    title="AI Interview Agent",
    description="Adaptive AI-powered technical interview system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request body models ────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    session_id: str
    job_role: str
    company_context: str = ""


class AnswerRequest(BaseModel):
    session_id: str
    answer: str
    # The frontend sends the current question back so we don't
    # need to store "last question" separately in session state.
    # The question was already appended to history when it was generated,
    # but we need it here to pass to the Evaluator.
    current_question: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/")
async def health_check():
    api_key_loaded = bool(os.getenv("ANTHROPIC_API_KEY"))
    return {
        "status": "ok",
        "service": "AI Interview Agent",
        "api_key_configured": api_key_loaded
    }


@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    file_bytes = await file.read()
    resume_text = parse_resume(file_bytes)

    if resume_text is None:
        raise HTTPException(
            status_code=422,
            detail="Could not extract text from PDF. Make sure it's not a scanned image-only PDF."
        )

    session_id = create_session()
    update_session(session_id, {"resume_text": resume_text})

    return {
        "session_id": session_id,
        "resume_preview": resume_text[:300] + "..." if len(resume_text) > 300 else resume_text,
        "character_count": len(resume_text)
    }


@app.post("/start-session")
async def start_session(request: StartSessionRequest):
    session = get_session(request.session_id)

    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Session {request.session_id} not found. Upload a resume first."
        )

    if not session.get("resume_text"):
        raise HTTPException(
            status_code=400,
            detail="No resume found in this session. Upload a resume before starting."
        )

    update_session(request.session_id, {
        "job_role": request.job_role,
        "company_context": request.company_context,
    })

    # Generate the FIRST question immediately on session start.
    # This means the frontend only needs to call /start-session once
    # and gets back a question ready to show — no extra round trip.
    first_question = generate_question(
        resume_text=session["resume_text"],
        job_role=request.job_role,
        company_context=request.company_context,
        conversation_history=[],
        difficulty_level="medium",
    )

    # Store it in history so Turn 1's evaluator has context
    append_to_history(request.session_id, "interviewer", first_question)

    return {
        "status": "session_ready",
        "session_id": request.session_id,
        "job_role": request.job_role,
        "first_question": first_question,
        "difficulty_level": "medium",
        "message": f"Session initialized for {request.job_role} role."
    }


@app.post("/answer")
async def submit_answer(request: AnswerRequest):
    """
    The core interview loop. Called once per turn after the first question.

    Exactly what happens in order:
    1. Validate session exists and has required context
    2. Append candidate's answer to conversation history
    3. EvaluatorAgent scores the answer → AnswerScore
    4. Score stored in session
    5. Rolling average recalculated
    6. Difficulty level updated based on average
    7. InterviewerAgent generates next question with full updated context
    8. Next question appended to conversation history
    9. Return next question + score + updated difficulty to frontend

    This single endpoint IS the adaptive interview engine.
    Everything else in the system exists to support this loop.
    """

    # ── 1. Validate session ────────────────────────────────────
    session = get_session(request.session_id)

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Please start a new interview."
        )

    if not session.get("job_role"):
        raise HTTPException(
            status_code=400,
            detail="Session not initialized. Call /start-session first."
        )

    if not request.answer.strip():
        raise HTTPException(
            status_code=400,
            detail="Answer cannot be empty."
        )

    # ── 2. Append candidate answer to history ──────────────────
    # Sanitize the answer — strip control characters that break JSON
    # serialization downstream. This handles copy-pasted text, voice
    # transcription output, and browser quirks that inject hidden chars.

    def sanitize_text(text: str) -> str:
        # Normalize unicode (e.g. smart quotes → standard quotes)
        text = unicodedata.normalize("NFKC", text)
        # Remove control characters except newline and tab
        cleaned = "".join(
            ch for ch in text
            if unicodedata.category(ch) != "Cc"
            or ch in ("\n", "\t")
        )
        return cleaned.strip()

    clean_answer = sanitize_text(request.answer)

    if not clean_answer:
        raise HTTPException(
            status_code=400,
            detail="Answer cannot be empty."
        )

    append_to_history(request.session_id, "candidate", clean_answer)
    # append_to_history(request.session_id, "candidate", request.answer.strip())

    # ── 3. Evaluate the answer (LLM-as-judge) ─────────────────
    try:
        score: AnswerScore = evaluate_answer(
            question=request.current_question,
            candidate_answer=clean_answer,
            job_role=session["job_role"]
        )
    except ValueError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Evaluation failed: {str(e)}"
        )

    # ── 4. Store score in session ──────────────────────────────
    append_score(request.session_id, score.model_dump())

    # ── 5 & 6. Recalculate rolling average + update difficulty ─
    rolling_avg = calculate_rolling_average(request.session_id)
    previous_difficulty = session["difficulty_level"]
    new_difficulty = determine_difficulty(rolling_avg)

    # Track whether difficulty changed this turn for the frontend
    # to show the trend arrow (Step 8 in Phase 4)
    difficulty_changed = new_difficulty != previous_difficulty
    difficulty_direction = None
    if difficulty_changed:
        difficulty_levels = ["easy", "medium", "hard"]
        prev_idx = difficulty_levels.index(previous_difficulty)
        new_idx = difficulty_levels.index(new_difficulty)
        difficulty_direction = "up" if new_idx > prev_idx else "down"

    update_session(request.session_id, {
        "difficulty_level": new_difficulty,
        "turn_count": session["turn_count"] + 1
    })

    # ── 7. Generate next question with full updated context ────
    # Re-fetch session so we get the updated conversation history
    # (which now includes the candidate's answer we just appended)
    updated_session = get_session(request.session_id)

    try:
        next_question = generate_question(
            resume_text=updated_session["resume_text"],
            job_role=updated_session["job_role"],
            company_context=updated_session["company_context"],
            conversation_history=updated_session["conversation_history"],
            difficulty_level=new_difficulty,
            follow_up_needed=score.follow_up_needed,
            previous_feedback=score.feedback
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Question generation failed: {str(e)}"
        )

    # ── 8. Append next question to history ────────────────────
    append_to_history(request.session_id, "interviewer", next_question)

    # ── 9. Return everything the frontend needs ────────────────
    return {
        "next_question": next_question,
        "score": score.model_dump(),
        "rolling_average": round(rolling_avg, 2) if rolling_avg else None,
        "difficulty_level": new_difficulty,
        "difficulty_changed": difficulty_changed,
        "difficulty_direction": difficulty_direction,
        "turn_count": updated_session["turn_count"],
        "session_complete": updated_session["turn_count"] >= 5
        # session_complete signals the frontend to show "Finish Interview"
        # Default is 5 turns — easily configurable
    }


@app.get("/scorecard/{session_id}")
async def get_scorecard(session_id: str):
    """
    Generates and returns the final interview scorecard.

    Requires at least 2 completed turns before generating.
    Runs a holistic LLM evaluation over the full transcript —
    not a mathematical average of turn scores.

    Why a separate LLM call?
    Trajectory, recovery, and pattern matter. A candidate who scored
    3,3,9,9,9 is fundamentally different from one who scored 6,6,6,6,6
    even though their averages are similar. Only an LLM reading the
    full transcript can reason about that distinction.
    """
    session = get_session(session_id)

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found."
        )

    if not session["scores"]:
        raise HTTPException(
            status_code=400,
            detail="No answers submitted yet. Complete at least one turn before requesting a scorecard."
        )

    if len(session["scores"]) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 turns required for a meaningful scorecard."
        )

    try:
        scorecard: FinalScorecard = generate_final_scorecard(
            resume_text=session["resume_text"],
            job_role=session["job_role"],
            conversation_history=session["conversation_history"],
            per_turn_scores=session["scores"]
        )
    except ValueError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Scorecard generation failed: {str(e)}"
        )

    # Return the scorecard plus session metadata the frontend needs
    # to render the report header (name, role, turn count)
    return {
        **scorecard.model_dump(),
        "session_metadata": {
            "job_role": session["job_role"],
            "company_context": session["company_context"],
            "total_turns": session["turn_count"],
            "final_difficulty_reached": session["difficulty_level"]
        },
        # Include full transcript so frontend can build the export report.
        # We already have this in session — no extra LLM call needed.
        "conversation_history": session["conversation_history"],
        "raw_scores": session["scores"]
    }