import { useState, useRef, useEffect } from "react"
import { Send, TrendingUp, TrendingDown, Minus, Flag, Loader2, ArrowUp, ArrowDown } from "lucide-react"

const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", glow: "shadow-emerald-400/20" },
  medium: { label: "Medium", color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20",  glow: "shadow-amber-400/20"   },
  hard:   { label: "Hard",   color: "text-rose-400",    bg: "bg-rose-400/10",    border: "border-rose-400/20",   glow: "shadow-rose-400/20"    },
}

const SCORE_COLOR = (score) => {
  if (score >= 7) return "text-emerald-400"
  if (score >= 4) return "text-amber-400"
  return "text-rose-400"
}

const SCORE_BG = (score) => {
  if (score >= 7) return "bg-emerald-400/8 border-emerald-400/15"
  if (score >= 4) return "bg-amber-400/8 border-amber-400/15"
  return "bg-rose-400/8 border-rose-400/15"
}

// ── Difficulty Badge ───────────────────────────────────────────────────────────
// Accepts `animate` prop — when true, plays a scale pulse to catch the eye.
// This runs for exactly one render cycle after difficulty changes.
function DifficultyBadge({ level, direction, animate }) {
  const config = DIFFICULTY_CONFIG[level] || DIFFICULTY_CONFIG.medium

  const DirectionIcon =
    direction === "up" ? TrendingUp
    : direction === "down" ? TrendingDown
    : Minus

  return (
    <div className={`
      flex items-center gap-1.5 px-2.5 py-1 rounded-full border
      text-xs font-semibold font-mono shadow-lg
      ${config.color} ${config.bg} ${config.border} ${config.glow}
      ${animate ? "scale-110" : "scale-100"}
      transition-transform duration-300
    `}>
      <DirectionIcon size={11} />
      {config.label}
    </div>
  )
}

// ── Difficulty Toast ───────────────────────────────────────────────────────────
// Slides in from the top for 2 seconds then fades out.
// Explains the adaptation in plain language so the user understands why it changed.
function DifficultyToast({ direction, level, rollingAverage, visible }) {
  if (!visible || !direction) return null

  const isUp = direction === "up"
  const Icon = isUp ? ArrowUp : ArrowDown

  return (
    <div className={`
      absolute top-16 left-1/2 -translate-x-1/2 z-20
      flex items-center gap-2 px-4 py-2.5 rounded-full
      border backdrop-blur-sm text-xs font-medium
      transition-all duration-500
      ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}
      ${isUp
        ? "bg-rose-400/10 border-rose-400/20 text-rose-300"
        : "bg-emerald-400/10 border-emerald-400/20 text-emerald-300"
      }
    `}>
      <Icon size={11} />
      {isUp
        ? `Difficulty raised to ${level} — avg score ${rollingAverage?.toFixed(1)} ↑`
        : `Difficulty eased to ${level} — avg score ${rollingAverage?.toFixed(1)} ↓`
      }
    </div>
  )
}

// ── Message ────────────────────────────────────────────────────────────────────
function Message({ message, isFollowUp }) {
  const isInterviewer = message.role === "interviewer"
  const [scoreVisible, setScoreVisible] = useState(false)

  // Animate score box in after a short delay
  // so it feels like a reveal rather than a pop
  useEffect(() => {
    if (message.score) {
      const t = setTimeout(() => setScoreVisible(true), 120)
      return () => clearTimeout(t)
    }
  }, [message.score])

  return (
    <div className={`flex gap-3 ${isInterviewer ? "" : "flex-row-reverse"}`}>
      <div className={`
        w-7 h-7 rounded-full shrink-0 flex items-center justify-center
        text-xs font-bold font-mono mt-0.5
        ${isInterviewer
          ? "bg-violet-600/30 text-violet-300 border border-violet-500/30"
          : "bg-slate-700/50 text-slate-300 border border-slate-600/30"
        }
      `}>
        {isInterviewer ? "AI" : "You"}
      </div>

      <div className={`flex-1 max-w-[85%] ${isInterviewer ? "" : "flex flex-col items-end"}`}>

        {/* Role label — with follow-up tag if applicable */}
        <div className={`flex items-center gap-2 mb-1.5 ${isInterviewer ? "" : "flex-row-reverse"}`}>
          <p className={`text-xs font-mono ${isInterviewer ? "text-violet-400" : "text-slate-500"}`}>
            {isInterviewer ? "Interviewer" : "You"}
          </p>
          {isInterviewer && isFollowUp && (
            <span className="
              text-xs px-2 py-0.5 rounded-full font-mono font-medium
              bg-amber-400/10 border border-amber-400/20 text-amber-400
            ">
              follow-up
            </span>
          )}
        </div>

        {/* Bubble */}
        <div className={`
          rounded-xl px-4 py-3 text-sm leading-relaxed
          ${isInterviewer
            ? "bg-white/4 border border-white/8 text-slate-200 rounded-tl-sm"
            : "bg-violet-600/15 border border-violet-500/20 text-slate-200 rounded-tr-sm"
          }
        `}>
          {message.content}
        </div>

        {/* Score feedback — fades + slides in */}
        {!isInterviewer && message.score && (
          <div className={`
            mt-2 px-3 py-2 rounded-lg border text-xs max-w-full
            transition-all duration-400
            ${scoreVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-1"
            }
            ${SCORE_BG(message.score.score)}
          `}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-bold font-mono text-sm ${SCORE_COLOR(message.score.score)}`}>
                {message.score.score}/10
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 capitalize">{message.score.depth}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 capitalize">{message.score.relevance} relevance</span>
            </div>
            <p className="text-slate-400 leading-relaxed">{message.score.feedback}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ChatPanel({
  messages,
  difficultyLevel,
  difficultyDirection,
  rollingAverage,
  turnCount,
  sessionComplete,
  isLoading,
  sessionReady,
  onSubmitAnswer,
  onFinishInterview,
}) {
  const [input, setInput] = useState("")
  const [badgeAnimating, setBadgeAnimating] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const prevDifficultyRef = useRef(difficultyLevel)
  const bottomRef = useRef(null)

  // Watch for difficulty changes — trigger badge pulse + toast
  useEffect(() => {
    if (prevDifficultyRef.current !== difficultyLevel) {
      prevDifficultyRef.current = difficultyLevel

      // Pulse the badge
      setBadgeAnimating(true)
      setTimeout(() => setBadgeAnimating(false), 350)

      // Show toast for 2.5 seconds
      setToastVisible(true)
      setTimeout(() => setToastVisible(false), 2500)
    }
  }, [difficultyLevel])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  function handleSubmit() {
    if (!input.trim() || isLoading || !sessionReady) return
    const text = input.trim()
    setInput("")
    onSubmitAnswer(text)
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <main className="flex-1 flex flex-col h-full min-w-0 relative">

      {/* Difficulty change toast — absolute positioned, slides in above header */}
      <DifficultyToast
        direction={difficultyDirection}
        level={difficultyLevel}
        rollingAverage={rollingAverage}
        visible={toastVisible}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0d0d16]/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <DifficultyBadge
            level={difficultyLevel}
            direction={difficultyDirection}
            animate={badgeAnimating}
          />
          {rollingAverage != null && (
            <span className="text-xs text-slate-500 font-mono">
              avg <span className="text-slate-300">{rollingAverage.toFixed(1)}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {sessionComplete && (
            <span className="text-xs text-amber-400 font-mono animate-pulse">
              Interview complete
            </span>
          )}
          <button
            onClick={onFinishInterview}
            disabled={!sessionReady || isLoading}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              border border-white/8 bg-white/3 hover:bg-white/6
              text-xs text-slate-400 hover:text-slate-200 font-medium
              disabled:opacity-30 disabled:cursor-not-allowed
            "
          >
            {isLoading
              ? <Loader2 size={11} className="animate-spin" />
              : <Flag size={11} />
            }
            Finish Interview
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {!sessionReady ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mb-4">
              <span className="text-violet-400 text-lg font-bold font-mono">AI</span>
            </div>
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
              Upload your resume, set the target role, and click{" "}
              <span className="text-violet-400 font-medium">Start Interview</span> to begin.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              // A follow-up is an interviewer message that comes immediately
              // after a candidate message whose score had follow_up_needed: true
              const prevMsg = messages[idx - 1]
              const isFollowUp =
                msg.role === "interviewer" &&
                prevMsg?.role === "candidate" &&
                prevMsg?.score?.follow_up_needed === true

              return (
                <Message
                  key={msg.id}
                  message={msg}
                  isFollowUp={isFollowUp}
                />
              )
            })}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-xs font-bold font-mono text-violet-300">
                  AI
                </div>
                <div className="bg-white/4 border border-white/8 rounded-xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-white/5 bg-[#0d0d16]/50">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !sessionReady
                ? "Start an interview to begin answering"
                : sessionComplete
                ? "Interview complete — click Finish Interview for your scorecard"
                : "Type your answer… (Enter to submit, Shift+Enter for newline)"
            }
            disabled={!sessionReady || isLoading || sessionComplete}
            rows={3}
            className="
              flex-1 bg-white/4 border border-white/8 rounded-xl
              px-4 py-3 text-sm text-slate-200 resize-none
              placeholder:text-slate-600
              focus:outline-none focus:border-violet-500/40 focus:bg-white/6
              disabled:opacity-40 disabled:cursor-not-allowed
            "
          />
          <button
            onClick={handleSubmit}
            disabled={!sessionReady || isLoading || !input.trim() || sessionComplete}
            className="
              w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500
              flex items-center justify-center shrink-0
              disabled:opacity-30 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-violet-500/50
            "
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2 font-mono">
          {sessionReady ? `Turn ${turnCount + 1} of 5` : "—"}
        </p>
      </div>
    </main>
  )
}