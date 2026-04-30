import { X, Download, CheckCircle2, AlertCircle, Star, FileText, Clock, BarChart3 } from "lucide-react"
import { useState } from "react"

const RECOMMENDATION_CONFIG = {
  strong_yes: { label: "Strong Yes",  color: "text-emerald-400", bg: "bg-emerald-400/15", border: "border-emerald-400/30" },
  yes:        { label: "Yes",         color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  maybe:      { label: "Maybe",       color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20"  },
  no:         { label: "No",          color: "text-rose-400",    bg: "bg-rose-400/10",    border: "border-rose-400/20"   },
}

const SCORE_COLOR = (score) => {
  if (score >= 7) return "text-emerald-400"
  if (score >= 4) return "text-amber-400"
  return "text-rose-400"
}

const SCORE_BAR_COLOR = (score) => {
  if (score >= 7) return "bg-emerald-400"
  if (score >= 4) return "bg-amber-400"
  return "bg-rose-400"
}

// ── Report Builder ─────────────────────────────────────────────────────────────
// Constructs a rich structured report from the scorecard + conversation history.
// This is what gets written to the downloaded JSON file.
function buildReport(scorecard) {
  const history = scorecard.conversation_history || []
  const rawScores = scorecard.raw_scores || scorecard.per_turn_scores || []

  // Pair each candidate answer with the question before it and the score it received
  const turns = []
  let scoreIndex = 0

  for (let i = 0; i < history.length; i++) {
    const msg = history[i]
    if (msg.role === "candidate") {
      const question = history[i - 1]?.content || ""
      const score = rawScores[scoreIndex] || null
      scoreIndex++

      turns.push({
        turn: scoreIndex,
        question,
        answer: msg.content,
        evaluation: score ? {
          score: score.score,
          depth: score.depth,
          relevance: score.relevance,
          feedback: score.feedback,
          follow_up_needed: score.follow_up_needed,
        } : null,
      })
    }
  }

  return {
    report_version: "1.0",
    generated_at: new Date().toISOString(),
    candidate_report: {
      job_role: scorecard.session_metadata?.job_role || "Unknown",
      company_context: scorecard.session_metadata?.company_context || "",
      total_turns: scorecard.session_metadata?.total_turns || turns.length,
      final_difficulty_reached: scorecard.session_metadata?.final_difficulty_reached || "medium",
    },
    final_evaluation: {
      overall_score: scorecard.overall_score,
      hiring_recommendation: scorecard.hiring_recommendation,
      summary: scorecard.summary,
      strengths: scorecard.strengths,
      improvement_areas: scorecard.improvement_areas,
    },
    interview_transcript: turns,
  }
}

function handleDownload(scorecard) {
  const report = buildReport(scorecard)
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `interview-report-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Score Bar ──────────────────────────────────────────────────────────────────
function ScoreBar({ score }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold font-mono w-6 ${SCORE_COLOR(score)}`}>
        {score}
      </span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${SCORE_BAR_COLOR(score)}`}
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
    </div>
  )
}

// ── Transcript View ────────────────────────────────────────────────────────────
function TranscriptView({ scorecard }) {
  const report = buildReport(scorecard)
  const turns = report.interview_transcript

  if (!turns.length) {
    return (
      <p className="text-xs text-slate-600 font-mono">No transcript available.</p>
    )
  }

  return (
    <div className="space-y-4">
      {turns.map((turn) => (
        <div key={turn.turn} className="rounded-xl border border-white/6 overflow-hidden">
          {/* Turn header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-white/2 border-b border-white/6">
            <span className="text-xs font-mono text-slate-500">Turn {turn.turn}</span>
            {turn.evaluation && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 capitalize">{turn.evaluation.depth}</span>
                <span className="text-xs text-slate-500">·</span>
                <span className={`text-xs font-bold font-mono ${SCORE_COLOR(turn.evaluation.score)}`}>
                  {turn.evaluation.score}/10
                </span>
              </div>
            )}
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Question */}
            <div>
              <p className="text-xs font-mono text-violet-400 mb-1">Interviewer</p>
              <p className="text-xs text-slate-400 leading-relaxed">{turn.question}</p>
            </div>

            {/* Answer */}
            <div>
              <p className="text-xs font-mono text-slate-500 mb-1">Candidate</p>
              <p className="text-xs text-slate-400 leading-relaxed">{turn.answer}</p>
            </div>

            {/* Feedback */}
            {turn.evaluation?.feedback && (
              <div className={`
                px-3 py-2 rounded-lg text-xs border
                ${turn.evaluation.score >= 7
                  ? "bg-emerald-400/6 border-emerald-400/15 text-emerald-300"
                  : turn.evaluation.score >= 4
                  ? "bg-amber-400/6 border-amber-400/15 text-amber-300"
                  : "bg-rose-400/6 border-rose-400/15 text-rose-300"
                }
              `}>
                {turn.evaluation.feedback}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function ScorecardModal({ scorecard, onClose }) {
  const rec = RECOMMENDATION_CONFIG[scorecard.hiring_recommendation] || RECOMMENDATION_CONFIG.maybe
  const [activeTab, setActiveTab] = useState("summary")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0d0d16] border border-white/10 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h2 className="text-base font-semibold text-white">Interview Scorecard</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {scorecard.session_metadata?.job_role} · {scorecard.session_metadata?.total_turns} turns · difficulty reached{" "}
              <span className="text-slate-400 capitalize">{scorecard.session_metadata?.final_difficulty_reached}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload(scorecard)}
              className="
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                border border-white/8 bg-white/3 hover:bg-white/6
                text-xs text-slate-400 hover:text-slate-200 font-medium
                transition-colors duration-150
              "
            >
              <Download size={12} />
              Export Report
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-white/8 bg-white/3 hover:bg-white/6 flex items-center justify-center transition-colors duration-150"
            >
              <X size={14} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Score hero */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5 bg-white/1">
          <div className="text-center">
            <div className={`text-4xl font-bold font-mono ${SCORE_COLOR(scorecard.overall_score)}`}>
              {scorecard.overall_score.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">/ 10.0</div>
          </div>
          <div className="w-px h-12 bg-white/8" />
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-mono mb-2">
              Hiring Recommendation
            </p>
            <div className={`
              inline-flex items-center gap-1.5 px-3 py-1.5
              rounded-lg border text-sm font-bold
              ${rec.color} ${rec.bg} ${rec.border}
            `}>
              <Star size={13} />
              {rec.label}
            </div>
          </div>

          {/* Mini score trend */}
          <div className="ml-auto">
            <p className="text-xs text-slate-500 font-mono mb-2">Score Trend</p>
            <div className="flex items-end gap-1 h-8">
              {(scorecard.raw_scores || scorecard.per_turn_scores || []).map((s, i) => (
                <div
                  key={i}
                  className={`w-4 rounded-sm transition-all duration-500 ${SCORE_BAR_COLOR(s.score)}`}
                  style={{ height: `${(s.score / 10) * 100}%`, opacity: 0.8 }}
                  title={`Turn ${i + 1}: ${s.score}/10`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 px-6">
          {[
            { id: "summary",    label: "Summary",    icon: BarChart3  },
            { id: "transcript", label: "Transcript", icon: FileText   },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 transition-colors duration-150
                ${activeTab === id
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
                }
              `}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {activeTab === "summary" && (
            <div className="space-y-6">

              {/* Summary paragraph */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Overall Assessment
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">{scorecard.summary}</p>
              </div>

              {/* Strengths + Improvements side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <CheckCircle2 size={11} className="text-emerald-400" />
                    Strengths
                  </h3>
                  <ul className="space-y-2">
                    {scorecard.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0" />
                        <span className="text-xs text-slate-400 leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <AlertCircle size={11} className="text-amber-400" />
                    Improve
                  </h3>
                  <ul className="space-y-2">
                    {scorecard.improvement_areas.map((a, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-amber-400 mt-2 shrink-0" />
                        <span className="text-xs text-slate-400 leading-relaxed">{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Per-turn score breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Turn Breakdown
                </h3>
                <div className="space-y-3">
                  {(scorecard.raw_scores || scorecard.per_turn_scores || []).map((turn, i) => (
                    <div key={i} className="px-4 py-3 rounded-xl bg-white/2 border border-white/6 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-mono">Turn {i + 1}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 capitalize">{turn.depth}</span>
                          <span className="text-xs text-slate-500 capitalize">{turn.relevance} relevance</span>
                        </div>
                      </div>
                      <ScoreBar score={turn.score} />
                      <p className="text-xs text-slate-500 leading-relaxed">{turn.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "transcript" && (
            <TranscriptView scorecard={scorecard} />
          )}
        </div>
      </div>
    </div>
  )
}