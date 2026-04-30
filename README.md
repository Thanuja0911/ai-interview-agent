# AI Interview Agent

An adaptive, resume aware technical interview system powered by a multi-agent AI architecture. The system conducts personalized interviews, evaluates answers in real time using the LLM-as-judge pattern, and adjusts question difficulty dynamically based on candidate performance.

---

## Demo

Kindly watch the demo to understand the entire flow of the project.

> https://drive.google.com/file/d/1YS9OJLDj9snJcVd_CStiHHogitQIYFLB/view?usp=sharing

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│          Frontend — React + Tailwind (5173)          │
│  Sidebar │ ChatPanel │ ScorePanel │ ScorecardModal   │
└────┬─────────┬──────────────┬───────────────┬───────┘
     │         │              │               │
     ▼         ▼              ▼               ▼
/upload-resume  /start-session  /answer    /scorecard
     │                          │
     ▼                          ▼
┌─────────────────────────────────────────────────────┐
│              In-Memory Session Store                 │
│  resume_text · job_role · conversation_history[]     │
│  scores[] · turn_count · difficulty_level            │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   EvaluatorAgent           InterviewerAgent
   temp=0 · LLM-as-judge    temp=0.7 · resume-aware
   → AnswerScore (Pydantic)  → next question
          │                         │
          └────────────┬────────────┘
                       ▼
              Adaptive Logic
         avg>7 → hard · avg<4 → easy
                       │
                       ▼
           Scorecard Generator
           Holistic eval · temp=0
           → FinalScorecard (Pydantic)
```

---

## What Makes This Different

### Multi-agent design with distinct roles ###
The system uses two specialized Claude agents per interview turn rather than one monolithic prompt. The EvaluatorAgent runs at temperature 0 — deterministic, consistent judgment optimized for scoring. The InterviewerAgent runs at temperature 0.7 — creative, varied question generation that avoids repetition across turns. Each agent has a purpose-built system prompt with explicit rubrics and behavioral rules. This separation of concerns mirrors how production AI evaluation pipelines are architected at scale.

### Adaptive personalization driven by real signal ### 
Personalization here is not cosmetic. The system maintains a rolling average score across all turns and recalculates difficulty level after every answer using concrete thresholds — above 7 escalates to hard mode, below 4 softens to easy. This changes the InterviewerAgent's prompt context, which changes its tone, question depth, and topic selection. A candidate who starts weak and recovers gets a genuinely different interview than one who peaks early. This is what personalization means in AI systems — behavior that changes based on accumulated signal, not just user preferences.

### LLM-as-judge evaluation made visible: ### 
The EvaluatorAgent implements the LLM-as-judge pattern: using one language model call to evaluate the output of another. Rather than writing brittle rule-based scoring logic, the system prompts Claude to act as an expert evaluator and return a structured `AnswerScore` object — validated by Pydantic before it touches the frontend. This pattern is used in production for RLHF data generation, content moderation, and answer quality grading at companies like Anthropic, OpenAI, and Scale AI. The frontend surfaces this evaluation live — score ring, depth badge, coaching feedback, and follow-up detection — making the AI judgment pipeline transparent to the user.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React + Vite | React 18 |
| Styling | Tailwind CSS | v3 |
| Backend | FastAPI | 0.110+ |
| Server | Uvicorn | 0.29+ |
| AI Provider | Anthropic Claude | claude-sonnet-4-5 |
| Resume Parsing | pdfplumber | 0.10+ |
| Validation | Pydantic | v2 |

---

## How to Run Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- An Anthropic API key ([get one here](https://console.anthropic.com))

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/interview-agent.git
cd interview-agent
```

### 2. Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Open .env and add your ANTHROPIC_API_KEY

# Start the backend
uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`
Interactive API docs at `http://localhost:8000/docs`

### 3. Frontend setup

```bash
# In a new terminal tab, from the project root
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

### 4. Run an interview

1. Open `http://localhost:5173`
2. Upload a PDF resume in the left sidebar
3. Enter a target job role and optional company context
4. Click **Start Interview**
5. Answer questions in the chat panel — watch the score ring and difficulty badge update live
6. Click **Finish Interview** after 5+ turns to generate your scorecard
7. Click **Export Report** to download the full interview artifact as JSON

---

## API Reference

### `POST /upload-resume`
Upload a PDF resume and initialize a session.

**Request:** `multipart/form-data` with field `file` (PDF only)

**Response:**
```json
{
  "session_id": "uuid-string",
  "resume_preview": "First 300 characters of parsed resume...",
  "character_count": 2847
}
```

---

### `POST /start-session`
Attach a job role to an existing session and generate the first interview question.

**Request:**
```json
{
  "session_id": "uuid-string",
  "job_role": "Senior Frontend Engineer",
  "company_context": "Fast-growing fintech startup"
}
```

**Response:**
```json
{
  "status": "session_ready",
  "session_id": "uuid-string",
  "job_role": "Senior Frontend Engineer",
  "first_question": "You built a React weather app and ran into CORS errors...",
  "difficulty_level": "medium"
}
```

---

### `POST /answer`
Submit a candidate answer. Runs the full adaptive interview loop.

**Request:**
```json
{
  "session_id": "uuid-string",
  "current_question": "Walk me through how you fixed the CORS error...",
  "answer": "I routed the request through a Netlify serverless function..."
}
```

**Response:**
```json
{
  "next_question": "You mentioned serverless functions — what are the cold start...",
  "score": {
    "score": 7,
    "depth": "strong",
    "relevance": "high",
    "feedback": "Good instinct on the proxy — next time mention the trade-offs...",
    "follow_up_needed": false
  },
  "rolling_average": 6.5,
  "difficulty_level": "medium",
  "difficulty_changed": false,
  "difficulty_direction": null,
  "turn_count": 1,
  "session_complete": false
}
```

---

### `GET /scorecard/{session_id}`
Generate and return the final interview scorecard. Requires at least 2 completed turns.

**Response:**
```json
{
  "overall_score": 7.2,
  "strengths": ["..."],
  "improvement_areas": ["..."],
  "hiring_recommendation": "yes",
  "per_turn_scores": [...],
  "summary": "...",
  "session_metadata": {
    "job_role": "Junior Frontend Engineer",
    "company_context": "Early-stage startup",
    "total_turns": 5,
    "final_difficulty_reached": "hard"
  },
  "conversation_history": [...],
  "raw_scores": [...]
}
```

---

## Example Scorecard

```json
{
  "overall_score": 7.4,
  "hiring_recommendation": "yes",
  "strengths": [
    "Clear articulation of technical trade-offs with real examples",
    "Demonstrated incremental delivery mindset under uncertainty",
    "Consistent ability to explain debugging process step by step"
  ],
  "improvement_areas": [
    "Needs more depth on performance measurement and quantifying impact",
    "Should address scalability implications proactively without prompting"
  ],
  "summary": "Candidate demonstrates solid junior-to-mid frontend fundamentals with a clear bias toward shipping and learning from real constraints. Communicates debugging processes well and shows genuine ownership of past work. Would benefit from more deliberate thinking about system-level trade-offs before answering.",
  "per_turn_scores": [
    {
      "score": 5,
      "depth": "adequate",
      "relevance": "high",
      "feedback": "Good recall of what you did — add why you chose that approach over alternatives.",
      "follow_up_needed": true
    },
    {
      "score": 8,
      "depth": "strong",
      "relevance": "high",
      "feedback": "Excellent breakdown of the CORS fix — the proxy approach shows solid API intuition.",
      "follow_up_needed": false
    },
    {
      "score": 7,
      "depth": "strong",
      "relevance": "medium",
      "feedback": "Strong on localStorage limits — extend to IndexedDB and service workers next time.",
      "follow_up_needed": false
    },
    {
      "score": 9,
      "depth": "strong",
      "relevance": "high",
      "feedback": "Outstanding answer — you addressed edge cases without being prompted.",
      "follow_up_needed": false
    },
    {
      "score": 8,
      "depth": "strong",
      "relevance": "high",
      "feedback": "Good system thinking — the scalability consideration shows senior instincts emerging.",
      "follow_up_needed": false
    }
  ],
  "session_metadata": {
    "job_role": "Junior Frontend Engineer",
    "company_context": "Early-stage startup, small team",
    "total_turns": 5,
    "final_difficulty_reached": "hard"
  }
}
```

---

## What I Learned

Building this project gave me concrete experience with patterns I had studied theoretically but never implemented end to end.

The most significant learning was implementing the **LLM-as-judge pattern** in a production-like context. I had read about it as a concept but designing the EvaluatorAgent's system prompt — writing a rubric precise enough to produce consistent scores at temperature 0 — taught me how much prompt engineering work goes into making structured output reliable. The Pydantic validation layer was essential: it turned "hopefully Claude returned the right shape" into a hard runtime guarantee with a clear error surface when it failed.

**Agentic loop design** was the second major insight. The core interview loop is deceptively simple — evaluate, update state, generate — but getting the context injection right took real iteration. Every piece of session state (resume text, conversation history, difficulty level, follow-up signal) needed to reach the right agent at the right time. I learned to think about agents not as AI magic but as functions with specific inputs and outputs that need to be composed deliberately.

The **session state trade-off** between in-memory and persistent storage became real when I thought through failure modes. In-memory is fast and zero-infrastructure, but a server restart loses all sessions. For a production system I would add Redis with TTL-keyed sessions — the session store module is isolated specifically to make that swap a one-file change.

**Resume-aware context injection** — what I call the RAG-adjacent pattern — showed me how much the quality of an AI system depends on what context you inject and how you format it. Clean resume text produced grounded, specific questions. Noisy extraction produced generic ones. The pdfplumber cleaning step mattered more than I expected.

---

## License

MIT
