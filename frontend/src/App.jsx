import { useState } from "react"
import Sidebar from "./components/Sidebar"
import ChatPanel from "./components/ChatPanel"
import ScorePanel from "./components/ScorePanel"
import ScorecardModal from "./components/ScorecardModal"
import { uploadResume, startSession, submitAnswer, getScorecard } from "./api"

export default function App() {
  // ── Session state ───────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState(null)
  const [sessionReady, setSessionReady] = useState(false)

  // ── Interview state ─────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState("")
  const [currentScore, setCurrentScore] = useState(null)
  const [difficultyLevel, setDifficultyLevel] = useState("medium")
  const [difficultyDirection, setDifficultyDirection] = useState(null)
  const [rollingAverage, setRollingAverage] = useState(null)
  const [turnCount, setTurnCount] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)

  // ── UI state ────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [scorecard, setScorecard] = useState(null)
  const [showScorecard, setShowScorecard] = useState(false)

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const clearError = () => setError(null)

  function addMessage(role, content, score = null) {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(), // stable unique key
      role,
      content,
      score,
    }])
  }

  // ── Step 1: Upload resume ───────────────────────────────────────────────────
  // Called by Sidebar when user selects a file.
  // Returns session_id so Sidebar can chain into startSession.
  async function handleResumeUpload(file) {
    clearError()
    setIsLoading(true)
    try {
      const data = await uploadResume(file)
      setSessionId(data.session_id)
      return data // Sidebar needs session_id + resume_preview
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 2: Start session + get first question ──────────────────────────────
  // Called by Sidebar after upload succeeds.
  async function handleStartSession(sid, jobRole, companyContext) {
    clearError()
    setIsLoading(true)

    // Reset all interview state for a fresh session
    setMessages([])
    setCurrentScore(null)
    setDifficultyLevel("medium")
    setDifficultyDirection(null)
    setRollingAverage(null)
    setTurnCount(0)
    setSessionComplete(false)
    setScorecard(null)

    try {
      const data = await startSession(sid, jobRole, companyContext)

      // First question comes back immediately from /start-session
      setCurrentQuestion(data.first_question)
      addMessage("interviewer", data.first_question)
      setSessionReady(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 3: Submit answer + receive score + next question ───────────────────
  // This is the core loop — called every turn from ChatPanel.
  async function handleSubmitAnswer(answerText) {
    if (!sessionId || !currentQuestion || isLoading) return
    clearError()

    // Immediately show the candidate's answer in chat
    // (optimistic UI — don't wait for the API)
    addMessage("candidate", answerText)
    setIsLoading(true)

    try {
      const data = await submitAnswer(sessionId, currentQuestion, answerText)

      // Update the candidate's message with the score it just received.
      // We find the last candidate message and attach the score to it
      // so the inline feedback appears under their answer.
      setMessages(prev => {
        const updated = [...prev]
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "candidate") {
            updated[i] = { ...updated[i], score: data.score }
            break
          }
        }
        return updated
      })

      // Update all live score displays
      setCurrentScore(data.score)
      setRollingAverage(data.rolling_average)
      setDifficultyLevel(data.difficulty_level)
      setDifficultyDirection(data.difficulty_direction)
      setTurnCount(data.turn_count)
      setSessionComplete(data.session_complete)

      // Add next question to chat
      if (data.next_question) {
        setCurrentQuestion(data.next_question)
        addMessage("interviewer", data.next_question)
      }
    } catch (err) {
      setError(err.message)
      // Remove the optimistically added message on failure
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 4: Generate final scorecard ───────────────────────────────────────
  async function handleFinishInterview() {
    if (!sessionId) return
    clearError()
    setIsLoading(true)

    try {
      const data = await getScorecard(sessionId)
      setScorecard(data)
      setShowScorecard(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Sidebar
        sessionReady={sessionReady}
        isLoading={isLoading}
        error={error}
        onResumeUpload={handleResumeUpload}
        onStartSession={handleStartSession}
        onClearError={clearError}
      />

      <ChatPanel
        messages={messages}
        difficultyLevel={difficultyLevel}
        difficultyDirection={difficultyDirection}
        rollingAverage={rollingAverage}
        turnCount={turnCount}
        sessionComplete={sessionComplete}
        isLoading={isLoading}
        sessionReady={sessionReady}
        onSubmitAnswer={handleSubmitAnswer}
        onFinishInterview={handleFinishInterview}
      />

      <ScorePanel currentScore={currentScore} rollingAverage={rollingAverage} />

      {showScorecard && scorecard && (
        <ScorecardModal
          scorecard={scorecard}
          onClose={() => setShowScorecard(false)}
        />
      )}
    </div>
  )
}