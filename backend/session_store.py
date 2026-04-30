import uuid
from typing import Optional


# The single in-memory store — a plain dict.
# Key: session_id (UUID string)
# Value: session dict matching the architecture spec exactly
sessions: dict = {}


def create_session() -> str:
    """
    Generate a new unique session ID and initialize the session object.
    Returns the session_id so the caller can reference it later.
    """
    session_id = str(uuid.uuid4())

    sessions[session_id] = {
        "resume_text": "",
        "job_role": "",
        "company_context": "",
        "conversation_history": [],  # List of {"role": "interviewer"|"candidate", "content": str}
        "scores": [],                # List of AnswerScore dicts, one per turn
        "turn_count": 0,
        "difficulty_level": "medium" # Starts medium, adapts based on rolling avg
    }

    return session_id


def get_session(session_id: str) -> Optional[dict]:
    """
    Retrieve a session by ID.
    Returns None if not found — callers must handle this case.
    """
    return sessions.get(session_id)


def update_session(session_id: str, updates: dict) -> bool:
    """
    Merge a dict of updates into an existing session.
    Returns False if the session doesn't exist.

    We use dict.update() (shallow merge) intentionally —
    callers pass only the keys they want to change.
    """
    session = sessions.get(session_id)
    if not session:
        return False
    session.update(updates)
    return True


def append_to_history(session_id: str, role: str, content: str) -> bool:
    """
    Add one message to the conversation history.
    Role must be 'interviewer' or 'candidate'.

    Keeping history as a list of dicts means we can
    serialize it directly into Claude's messages format later.
    """
    session = sessions.get(session_id)
    if not session:
        return False
    session["conversation_history"].append({
        "role": role,
        "content": content
    })
    return True


def append_score(session_id: str, score_dict: dict) -> bool:
    """
    Append one AnswerScore (as dict) to the session's scores list.
    We store as dict (not Pydantic object) so it's JSON-serializable
    without extra conversion steps at response time.
    """
    session = sessions.get(session_id)
    if not session:
        return False
    session["scores"].append(score_dict)
    return True


def calculate_rolling_average(session_id: str) -> Optional[float]:
    """
    Calculate the mean score across all turns so far.
    Returns None if no scores exist yet (first turn).

    This drives the adaptive difficulty logic in the interview loop.
    """
    session = sessions.get(session_id)
    if not session or not session["scores"]:
        return None

    scores = [s["score"] for s in session["scores"]]
    return sum(scores) / len(scores)


def determine_difficulty(rolling_avg: Optional[float]) -> str:
    """
    Pure function: maps a rolling average score to a difficulty level string.
    Keeping this logic here (not in main.py) makes it easy to tune thresholds.

    Thresholds:
      avg > 7  → hard   (candidate is excelling, push them)
      avg < 4  → easy   (candidate is struggling, give them footing)
      else     → medium (default, stay balanced)
    """
    if rolling_avg is None:
        return "medium"
    if rolling_avg > 7:
        return "hard"
    if rolling_avg < 4:
        return "easy"
    return "medium"