import os
import json
import anthropic
from typing import Optional
from dotenv import load_dotenv

from schemas import AnswerScore, FinalScorecard

load_dotenv()

# Initialize the Anthropic client once at module level.
# This is more efficient than creating a new client per request —
# the client manages connection pooling internally.
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODEL = "claude-sonnet-4-5"  # Pinned — never use "latest" in production
EVALUATOR_TEMPERATURE = 0    # Deterministic judgment
INTERVIEWER_TEMPERATURE = 0.7  # Creative question generation


# ── System Prompts ─────────────────────────────────────────────────────────────
# These are the "personalities" of each agent.
# They are the most important engineering decisions in the whole system.
# A weak system prompt = a weak agent, regardless of model quality.

EVALUATOR_SYSTEM_PROMPT = """You are an expert technical interviewer and talent evaluator with 15 years of experience assessing software engineers at top-tier technology companies.

Your sole job is to evaluate a candidate's answer to an interview question and return a structured JSON score. You are precise, fair, and calibrated — your scores are consistent across candidates.

SCORING RUBRIC:
- Score 1-3 (shallow): Answer is vague, off-topic, missing key concepts, or shows fundamental misunderstanding
- Score 4-6 (adequate): Answer covers the basics but lacks depth, examples, or nuance. Acceptable but not impressive
- Score 7-9 (strong): Answer demonstrates clear understanding, good reasoning, relevant examples, and professional communication
- Score 10 (exceptional): Reserved for answers that exceed expectations — shows mastery, edge case awareness, and the kind of thinking that separates senior engineers

DEPTH ASSESSMENT:
- "shallow": Buzzwords without substance, or a one-line answer to a complex question
- "adequate": Correct but surface-level. Shows awareness but not mastery
- "strong": Demonstrates internalized understanding. Could teach this concept to someone else

RELEVANCE ASSESSMENT:
- "low": Answer drifts significantly from what was asked
- "medium": Mostly on-topic but misses part of the question
- "high": Directly addresses the question with appropriate specificity

FEEDBACK LINE:
Write one coaching sentence. Be specific and actionable — not generic praise or criticism.
Good: "Mention time complexity trade-offs next time to show you've considered performance."
Bad: "Good answer but could be more detailed."

FOLLOW-UP NEEDED:
Set true if the answer was incomplete, evasive, or left a critical part of the question unanswered.

CRITICAL: You must respond with ONLY a valid JSON object. No preamble, no explanation, no markdown code fences. Raw JSON only.

Response format:
{
  "score": <integer 1-10>,
  "depth": <"shallow" | "adequate" | "strong">,
  "relevance": <"low" | "medium" | "high">,
  "feedback": "<one actionable coaching sentence>",
  "follow_up_needed": <true | false>
}"""


INTERVIEWER_SYSTEM_PROMPT = """You are a senior technical interviewer conducting a structured adaptive interview. You are professional, intellectually curious, and direct — you ask sharp questions and follow the candidate's thinking.

Your job is to generate exactly ONE interview question per turn based on the context provided to you.

CORE RULES:
1. Never repeat a topic already covered in the conversation history
2. Always ground your question in the candidate's actual resume — reference their specific experience
3. Adapt your tone and complexity to the difficulty level specified
4. Ask one focused question — not multiple questions bundled together
5. Do not include preamble like "Great answer!" or "Interesting." — get straight to the question
6. Do not number the question or add any prefix

DIFFICULTY CALIBRATION:
- easy: Ask about concepts they've directly used. Keep scope narrow. Use "walk me through" framing.
- medium: Probe understanding beyond surface level. Ask "why" and "how" not just "what". Expect trade-off awareness.
- hard: Push into edge cases, system design implications, failure modes, and architectural decisions. Expect mastery-level reasoning.

RESUME-AWARENESS:
You have the candidate's resume. Use it. Ask about specific projects they listed. Reference technologies they claim proficiency in. If they say they "led" something, ask about the hardest decision they made. Real interviewers do this — it proves you read their resume and it makes the interview feel real.

JOB ROLE AWARENESS:
Tailor questions to the target role. A frontend role gets different questions than a backend or ML role even if the resume is the same.

OUTPUT FORMAT:
Return ONLY the question text. No JSON. No formatting. Just the question as a plain string."""


# ── Evaluator Agent ────────────────────────────────────────────────────────────

def evaluate_answer(
    question: str,
    candidate_answer: str,
    job_role: str
) -> AnswerScore:
    user_message = f"""Job Role: {job_role}

Interview Question: {question}

Candidate's Answer: {candidate_answer}

Evaluate this answer according to your scoring rubric and return the JSON score object."""

    response = client.messages.create(
        model=MODEL,
        max_tokens=500,
        temperature=EVALUATOR_TEMPERATURE,
        system=EVALUATOR_SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )

    raw_json = response.content[0].text.strip()

    # Strip markdown fences if the model added them despite instructions.
    # Claude's RLHF training strongly associates JSON with code blocks —
    # this is a known behavior. We clean defensively rather than fight it.
    cleaned = raw_json
    if cleaned.startswith("```"):
        # Remove opening fence (handles ```json, ```JSON, ``` etc.)
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
        # Remove closing fence
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    try:
        score_data = json.loads(cleaned)
        return AnswerScore(**score_data)
    except (json.JSONDecodeError, Exception) as e:
        raise ValueError(
            f"EvaluatorAgent returned invalid JSON: {e}\n"
            f"Raw response: {raw_json}\n"
            f"Cleaned attempt: {cleaned}"
        )

# ── Interviewer Agent ──────────────────────────────────────────────────────────

def generate_question(
    resume_text: str,
    job_role: str,
    company_context: str,
    conversation_history: list,
    difficulty_level: str,
    follow_up_needed: bool = False,
    previous_feedback: Optional[str] = None
) -> str:
    """
    Generates the next interview question using full session context.

    This is where resume-aware context injection happens:
    the agent sees the full resume, all prior conversation,
    the current difficulty level, and whether a follow-up is needed.

    Temperature 0.7 — we want varied, natural questions.
    The same session context should not produce the same question twice.
    """

    # Format conversation history into a readable transcript
    # so the agent can see what topics have already been covered
    history_str = ""
    if conversation_history:
        lines = []
        for turn in conversation_history:
            role_label = "Interviewer" if turn["role"] == "interviewer" else "Candidate"
            lines.append(f"{role_label}: {turn['content']}")
        history_str = "\n".join(lines)
    else:
        history_str = "No conversation yet — this is the first question."

    # Build the follow-up instruction if needed
    follow_up_instruction = ""
    if follow_up_needed and previous_feedback:
        follow_up_instruction = f"""
IMPORTANT: The candidate's last answer was incomplete. Ask a follow-up that probes the gap identified here:
{previous_feedback}
Do not move to a new topic yet."""

    user_message = f"""CANDIDATE RESUME:
{resume_text}

TARGET JOB ROLE: {job_role}
COMPANY CONTEXT: {company_context if company_context else "Not specified"}
CURRENT DIFFICULTY LEVEL: {difficulty_level}

CONVERSATION HISTORY SO FAR:
{history_str}
{follow_up_instruction}

Generate the next interview question."""

    response = client.messages.create(
        model=MODEL,
        max_tokens=300,  # Questions should be concise — 300 is plenty
        temperature=INTERVIEWER_TEMPERATURE,
        system=INTERVIEWER_SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )

    question = response.content[0].text.strip()
    return question


# ── Final Scorecard Generator ──────────────────────────────────────────────────

def generate_final_scorecard(
    resume_text: str,
    job_role: str,
    conversation_history: list,
    per_turn_scores: list
) -> FinalScorecard:
    """
    Runs a separate LLM call to synthesize the full interview into a scorecard.

    We do NOT just aggregate turn scores mathematically.
    We give Claude the full transcript + all scores and ask it to reason
    holistically — because a candidate who started weak but finished strong
    deserves a different recommendation than one who started strong and faded.

    This is also LLM-as-judge, but at the session level rather than turn level.
    Temperature 0 — this is an evaluation, not a generation.
    """

    # Format full transcript
    transcript_lines = []
    for i, turn in enumerate(conversation_history):
        role_label = "Interviewer" if turn["role"] == "interviewer" else "Candidate"
        transcript_lines.append(f"{role_label}: {turn['content']}")

    transcript_str = "\n\n".join(transcript_lines)

    # Format per-turn scores summary
    scores_summary = []
    for i, score in enumerate(per_turn_scores):
        scores_summary.append(
            f"Turn {i+1}: Score={score['score']}/10, "
            f"Depth={score['depth']}, "
            f"Relevance={score['relevance']}, "
            f"Feedback={score['feedback']}"
        )
    scores_str = "\n".join(scores_summary)

    scorecard_prompt = f"""You are a hiring manager reviewing a completed technical interview.

CANDIDATE RESUME SUMMARY:
{resume_text[:1000]}...

TARGET ROLE: {job_role}

FULL INTERVIEW TRANSCRIPT:
{transcript_str}

PER-TURN EVALUATION SCORES:
{scores_str}

Based on the complete interview, generate a final hiring scorecard.

Return ONLY a valid JSON object with this exact structure — no preamble, no markdown:
{{
  "overall_score": <float 1.0-10.0, weighted toward recent performance>,
  "strengths": [<3-5 specific strengths observed in this interview>],
  "improvement_areas": [<2-4 specific areas for growth>],
  "hiring_recommendation": <"strong_yes" | "yes" | "maybe" | "no">,
  "per_turn_scores": {json.dumps(per_turn_scores)},
  "summary": "<3-4 sentence holistic summary of this candidate for this role>"
}}"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        temperature=0,  # Deterministic — this is a final judgment
        messages=[
            {"role": "user", "content": scorecard_prompt}
        ]
    )

    raw_json = response.content[0].text.strip()

    cleaned = raw_json
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    try:
        scorecard_data = json.loads(cleaned)
        return FinalScorecard(**scorecard_data)
    except (json.JSONDecodeError, Exception) as e:
        raise ValueError(
            f"Scorecard generator returned invalid JSON: {e}\n"
            f"Raw response: {raw_json}\n"
            f"Cleaned attempt: {cleaned}"
        )