from pydantic import BaseModel
from typing import List, Literal


class AnswerScore(BaseModel):
    score: int                    # 1-10
    depth: Literal["shallow", "adequate", "strong"]
    relevance: Literal["low", "medium", "high"]
    feedback: str                 # one coaching line shown to candidate
    follow_up_needed: bool        # true if answer was incomplete


class FinalScorecard(BaseModel):
    overall_score: float
    strengths: List[str]
    improvement_areas: List[str]
    hiring_recommendation: Literal["strong_yes", "yes", "maybe", "no"]
    per_turn_scores: List[AnswerScore]
    summary: str