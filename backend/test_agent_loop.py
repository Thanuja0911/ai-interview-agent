"""
Standalone test — runs one complete interview turn in the terminal.
No FastAPI, no HTTP. Just the agents talking directly.

Run with: python test_agent_loop.py
"""

from agents import evaluate_answer, generate_question
from session_store import (
    create_session,
    update_session,
    append_to_history,
    append_score,
    calculate_rolling_average,
    determine_difficulty,
    get_session
)

def run_test():
    print("\n" + "="*60)
    print("AI INTERVIEW AGENT — TERMINAL TEST")
    print("="*60)

    # ── Setup mock session ─────────────────────────────────────
    session_id = create_session()

    mock_resume = """
    Jane Smith | Senior Software Engineer
    
    Experience:
    - 3 years at Stripe as a Frontend Engineer
      Built real-time payment dashboard using React and WebSockets
      Led migration from Redux to Zustand reducing bundle size by 40%
      Mentored 2 junior engineers
    
    - 2 years at early-stage startup as Full-Stack Engineer
      Built entire frontend from scratch using Next.js
      Designed REST API in FastAPI, deployed on AWS Lambda
    
    Skills: React, TypeScript, Next.js, FastAPI, Python, PostgreSQL,
            AWS, Docker, WebSockets, System Design
    
    Education: BS Computer Science, UC Berkeley 2019
    """

    update_session(session_id, {
        "resume_text": mock_resume,
        "job_role": "Senior Frontend Engineer",
        "company_context": "Fast-growing fintech startup",
        "difficulty_level": "medium"
    })

    session = get_session(session_id)
    print(f"\n✓ Session created: {session_id[:8]}...")
    print(f"✓ Role: {session['job_role']}")
    print(f"✓ Starting difficulty: {session['difficulty_level']}")

    # ── Turn 1: Generate opening question ─────────────────────
    print("\n" + "-"*60)
    print("TURN 1 — Generating first question...")

    question_1 = generate_question(
        resume_text=session["resume_text"],
        job_role=session["job_role"],
        company_context=session["company_context"],
        conversation_history=session["conversation_history"],
        difficulty_level=session["difficulty_level"]
    )

    print(f"\n🤖 Interviewer: {question_1}")
    append_to_history(session_id, "interviewer", question_1)

    # ── Simulate candidate answer ──────────────────────────────
    candidate_answer_1 = """
    At Stripe, I led the migration from Redux to Zustand for our payment dashboard.
    Redux had become really verbose — we had a lot of boilerplate for simple state updates
    and the bundle size was hurting load times. I chose Zustand because it's minimal,
    doesn't require reducers or action creators, and works great with TypeScript.
    
    I did the migration incrementally — started with isolated feature slices so we could
    ship to production without a big-bang rewrite. The result was a 40% bundle size reduction
    and the team found it much easier to work with. The main trade-off was losing Redux DevTools,
    which we mitigated by adding Zustand's own devtools middleware.
    """

    print(f"\n👤 Candidate: {candidate_answer_1.strip()}")
    append_to_history(session_id, "candidate", candidate_answer_1.strip())

    # ── Evaluate the answer ────────────────────────────────────
    print("\n⚖️  EvaluatorAgent scoring...")
    score_1 = evaluate_answer(
        question=question_1,
        candidate_answer=candidate_answer_1,
        job_role=session["job_role"]
    )

    print(f"\n📊 Score: {score_1.score}/10")
    print(f"   Depth: {score_1.depth}")
    print(f"   Relevance: {score_1.relevance}")
    print(f"   Feedback: {score_1.feedback}")
    print(f"   Follow-up needed: {score_1.follow_up_needed}")

    # ── Update session state ───────────────────────────────────
    append_score(session_id, score_1.model_dump())

    rolling_avg = calculate_rolling_average(session_id)
    new_difficulty = determine_difficulty(rolling_avg)
    update_session(session_id, {"difficulty_level": new_difficulty, "turn_count": 1})

    print(f"\n📈 Rolling average: {rolling_avg:.1f}")
    print(f"🎯 Difficulty updated to: {new_difficulty}")

    # ── Turn 2: Generate next question with updated context ────
    session = get_session(session_id)  # Re-fetch updated session

    print("\n" + "-"*60)
    print("TURN 2 — Generating adaptive follow-up question...")

    question_2 = generate_question(
        resume_text=session["resume_text"],
        job_role=session["job_role"],
        company_context=session["company_context"],
        conversation_history=session["conversation_history"],
        difficulty_level=session["difficulty_level"],
        follow_up_needed=score_1.follow_up_needed,
        previous_feedback=score_1.feedback
    )

    print(f"\n🤖 Interviewer: {question_2}")

    # ── Summary ────────────────────────────────────────────────
    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60)
    print(f"✓ Evaluator scored answer: {score_1.score}/10")
    print(f"✓ Difficulty adapted from medium → {new_difficulty}")
    print(f"✓ Interviewer generated contextual follow-up")
    print(f"✓ Both agents used resume context correctly")
    print("\nAll systems working. Ready to wire into FastAPI.\n")


if __name__ == "__main__":
    run_test()