# AGENTS.md

Two-part app: `backend/` (FastAPI + Python) and `frontend/` (React + Vite + Tailwind). They run as two separate dev servers; both are required to use the app. There is no root-level manifest.

## Run the app

- Backend (from `backend/`): create venv, `pip install -r requirements.txt`, `cp .env.example .env` and set `ANTHROPIC_API_KEY`, then `uvicorn main:app --reload --port 8000`. Port 8000 is fixed — `frontend/src/api.js` hardcodes `BASE_URL = "http://localhost:8000"`, and backend CORS in `main.py` allows only `http://localhost:5173`. Changing ports in one place breaks the other.
- Frontend (from `frontend/`): `npm install && npm run dev` → serves on `http://localhost:5173`.

## Environment

Requirements are fully pinned (`backend/requirements.txt`) — it was built against Python 3.10+, python packages are NOT up to date, install as-is. `agents.py` constructs the Anthropic client at module import with `os.getenv("ANTHROPIC_API_KEY")`; without the key every agent call fails. Model is pinned to `claude-sonnet-4-5` — do not switch to "latest".

## Testing / verification

There is no pytest suite and no frontend test runner. Backend unit tests use stdlib `unittest`.
- `backend/test_resume_parser.py` is the unit test suite (pdfplumber mocked, no API key). Run: `python -m unittest test_resume_parser -v` from `backend/`.
- `backend/test_agent_loop.py` is a standalone terminal script (not a unit test) that exercises both agents against the real Anthropic API. It requires the API key. Run: `python test_agent_loop.py` from `backend/`. It imports `agents.py` at module load, so a blanket `python -m unittest discover` fails without a key — run unit tests by module name.
- Frontend verification: `npm run lint` (eslint) and `npm run build` (vite). `frontend/README.md` is untouched Vite template boilerplate — ignore it.
- For the full loop, hit the API directly: `POST /upload-resume` → `POST /start-session` → `POST /answer` (once per turn) → `GET /scorecard/{session_id}`.

## Architecture

- **In-memory session store** (`backend/session_store.py`): a plain module-level `dict`. Every server restart loses all sessions, so a workflow test that restarts the backend between steps will fail on stale/`404` session ids. A Redis swap is anticipated here — the store is deliberately isolated.
- **Adaptive interview loop** lives in `POST /answer` (`backend/main.py`): evaluate → score → recompute rolling average → adjust difficulty → generate next question → return. `session_complete` triggers at `turn_count >= 5` (constant in `main.py`).
- **Difficulty**: rolling avg `> 7` → hard, `< 4` → easy, else medium (`determine_difficulty` in `session_store.py`).
- **LLM-as-judge**: `EvaluatorAgent` (temperature 0) returns an `AnswerScore` Pydantic model; `InterviewerAgent` (temperature 0.7) generates the next question; the final scorecard is a separate holistic LLM call (temperature 0). All raw JSON responses are defensively cleaned — markdown fences stripped — before Pydantic parsing; parse failure raises `ValueError` → HTTP 500.
- **Scorecard requires ≥ 2 turns** (`backend/main.py`).

## Git

The real project repo (this directory) is nested inside a parent folder that is itself a `git init` repo with no commits. Run git commands from here, not the parent. `backend/.env` and `backend/venv/` are gitignored.