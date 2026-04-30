import { useEffect, useState, useRef } from "react"
import { TrendingUp, Target, Layers, MessageSquare, AlertTriangle } from "lucide-react"

const SCORE_RING_COLOR = (score) => {
  if (!score) return "#334155"
  if (score >= 7) return "#34d399"
  if (score >= 4) return "#fbbf24"
  return "#f87171"
}

const DEPTH_CONFIG = {
  shallow:  { label: "Shallow",  color: "text-rose-400",    bg: "bg-rose-400/10"    },
  adequate: { label: "Adequate", color: "text-amber-400",   bg: "bg-amber-400/10"   },
  strong:   { label: "Strong",   color: "text-emerald-400", bg: "bg-emerald-400/10" },
}

const RELEVANCE_CONFIG = {
  low:    { label: "Low",    color: "text-rose-400",    dots: 1 },
  medium: { label: "Medium", color: "text-amber-400",   dots: 2 },
  high:   { label: "High",   color: "text-emerald-400", dots: 3 },
}

function ScoreRing({ score }) {
  const size = 80
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = score ? (score / 10) * circumference : 0
  const color = SCORE_RING_COLOR(score)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#1e293b" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-xl font-bold font-mono"
          style={{ color: score ? color : "#475569" }}
        >
          {score ?? "—"}
        </span>
      </div>
    </div>
  )
}

function RelevanceDots({ level }) {
  const config = RELEVANCE_CONFIG[level]
  if (!config) return null

  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors duration-500 ${
            i <= config.dots
              ? config.color.replace("text-", "bg-")
              : "bg-slate-700"
          }`}
        />
      ))}
      <span className={`text-xs font-medium ml-1 ${config.color}`}>
        {config.label}
      </span>
    </div>
  )
}

export default function ScorePanel({ currentScore, rollingAverage }) {
  const depth = currentScore ? DEPTH_CONFIG[currentScore.depth] : null

  // Track when score changes so we can pulse the coaching section
  const [coachingPulse, setCoachingPulse] = useState(false)
  const prevScoreRef = useRef(null)

  useEffect(() => {
    // Only pulse when we receive a genuinely new score
    if (
      currentScore &&
      currentScore.feedback !== prevScoreRef.current
    ) {
      prevScoreRef.current = currentScore.feedback
      setCoachingPulse(true)
      setTimeout(() => setCoachingPulse(false), 800)
    }
  }, [currentScore])

  return (
    <aside className="w-64 min-w-[256px] h-full flex flex-col border-l border-white/5 bg-[#0d0d16]">

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={14} className="text-violet-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Live Score
          </span>
        </div>
        {rollingAverage != null && (
          <p className="text-xs text-slate-500 font-mono mt-1">
            rolling avg{" "}
            <span className={`font-semibold ${
              rollingAverage >= 7 ? "text-emerald-400"
              : rollingAverage >= 4 ? "text-amber-400"
              : "text-rose-400"
            }`}>
              {rollingAverage.toFixed(1)}
            </span>
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

        {/* Score ring */}
        <div className="flex flex-col items-center gap-3">
          <ScoreRing score={currentScore?.score} />
          <div className="text-center">
            <p className="text-xs text-slate-500 font-mono">last answer</p>
            {currentScore ? (
              <p className="text-sm font-semibold text-slate-200 mt-0.5">
                {currentScore.score >= 7
                  ? "Strong"
                  : currentScore.score >= 4
                  ? "Adequate"
                  : "Needs Work"}
              </p>
            ) : (
              <p className="text-sm text-slate-600 mt-0.5">No answers yet</p>
            )}
          </div>
        </div>

        <div className="border-t border-white/5" />

        {/* Depth */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers size={12} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">
              Depth
            </span>
          </div>
          {depth ? (
            <div className={`
              inline-flex items-center px-3 py-1.5 rounded-lg
              text-xs font-semibold
              transition-all duration-300
              ${depth.color} ${depth.bg}
            `}>
              {depth.label}
            </div>
          ) : (
            <div className="text-xs text-slate-600 font-mono">—</div>
          )}
        </div>

        {/* Relevance */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target size={12} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">
              Relevance
            </span>
          </div>
          {currentScore ? (
            <RelevanceDots level={currentScore.relevance} />
          ) : (
            <div className="text-xs text-slate-600 font-mono">—</div>
          )}
        </div>

        <div className="border-t border-white/5" />

        {/* Coaching feedback — pulses on new score */}
        <div className={`
          rounded-xl p-3 border transition-all duration-500
          ${coachingPulse
            ? "bg-violet-500/10 border-violet-500/30"
            : "bg-transparent border-transparent"
          }
        `}>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={12} className={`
              transition-colors duration-300
              ${coachingPulse ? "text-violet-400" : "text-slate-500"}
            `} />
            <span className={`
              text-xs font-mono uppercase tracking-wider
              transition-colors duration-300
              ${coachingPulse ? "text-violet-400" : "text-slate-500"}
            `}>
              Coaching
            </span>
            {coachingPulse && (
              <span className="ml-auto text-xs text-violet-400 font-mono animate-pulse">
                new
              </span>
            )}
          </div>
          {currentScore ? (
            <p className={`
              text-xs leading-relaxed transition-colors duration-300
              ${coachingPulse ? "text-slate-200" : "text-slate-400"}
            `}>
              {currentScore.feedback}
            </p>
          ) : (
            <p className="text-xs text-slate-600 leading-relaxed">
              Submit an answer to see coaching feedback.
            </p>
          )}
        </div>

        {/* Follow-up needed indicator */}
        {currentScore?.follow_up_needed && (
          <div className="
            px-3 py-2.5 rounded-lg
            bg-amber-400/8 border border-amber-400/20
            flex items-start gap-2
          ">
            <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-400 font-semibold">Follow-up incoming</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Your answer left a gap — the AI will probe further before moving on.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}