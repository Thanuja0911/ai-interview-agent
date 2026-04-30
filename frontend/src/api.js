// Central API service — all backend communication goes through here.
// Components import functions from this file, never call fetch directly.
// This makes the backend URL configurable and all error handling consistent.

const BASE_URL = "http://localhost:8000"

// Shared fetch wrapper — handles JSON parsing and unified error shape.
// If the backend returns a non-2xx status, we extract FastAPI's
// detail message and throw it so components can display it directly.
async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(error.detail || `Request failed: ${response.status}`)
  }

  return response.json()
}


// ── Resume Upload ─────────────────────────────────────────────────────────────
// Uses FormData — not JSON — because we're sending a binary file.
// The browser sets Content-Type to multipart/form-data automatically.
// Never set Content-Type manually for FormData — it breaks the boundary header.

export async function uploadResume(file) {
  const formData = new FormData()
  formData.append("file", file)

  return apiFetch("/upload-resume", {
    method: "POST",
    body: formData,
    // No Content-Type header — browser sets it with boundary automatically
  })
  // Returns: { session_id, resume_preview, character_count }
}


// ── Start Session ─────────────────────────────────────────────────────────────
export async function startSession(sessionId, jobRole, companyContext) {
  return apiFetch("/start-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      job_role: jobRole,
      company_context: companyContext,
    }),
  })
  // Returns: { status, session_id, job_role, first_question, difficulty_level }
}


// ── Submit Answer ─────────────────────────────────────────────────────────────
export async function submitAnswer(sessionId, currentQuestion, answer) {
  return apiFetch("/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      current_question: currentQuestion,
      answer: answer,
    }),
  })
  // Returns: { next_question, score, rolling_average, difficulty_level,
  //            difficulty_changed, difficulty_direction, turn_count, session_complete }
}


// ── Get Scorecard ─────────────────────────────────────────────────────────────
export async function getScorecard(sessionId) {
  return apiFetch(`/scorecard/${sessionId}`)
  // Returns: FinalScorecard + session_metadata
}