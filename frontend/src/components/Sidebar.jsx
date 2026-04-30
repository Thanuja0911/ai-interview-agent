import { useState } from "react"
import { Upload, Briefcase, Building2, ChevronRight, CheckCircle2, FileText, AlertCircle, Loader2 } from "lucide-react"

export default function Sidebar({
  sessionReady,
  isLoading,
  error,
  onResumeUpload,
  onStartSession,
  onClearError,
}) {
  const [file, setFile] = useState(null)
  const [resumePreview, setResumePreview] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [jobRole, setJobRole] = useState("")
  const [companyContext, setCompanyContext] = useState("")
  const [uploadStatus, setUploadStatus] = useState("idle") // idle | uploading | done | error

  async function handleFileChange(e) {
    const selected = e.target.files[0]
    if (!selected) return

    setFile(selected)
    setUploadStatus("uploading")
    onClearError()

    const result = await onResumeUpload(selected)
    if (result) {
      setSessionId(result.session_id)
      setResumePreview(result.resume_preview)
      setUploadStatus("done")
    } else {
      setUploadStatus("error")
    }
  }

  async function handleStart() {
    if (!sessionId || !jobRole.trim() || isLoading) return
    await onStartSession(sessionId, jobRole.trim(), companyContext.trim())
  }

  const canStart = sessionId && jobRole.trim() && !isLoading

  return (
    <aside className="w-72 min-w-[288px] h-full flex flex-col border-r border-white/5 bg-[#0d0d16]">

      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold font-mono">AI</span>
          </div>
          <span className="text-white font-semibold tracking-tight">InterviewAgent</span>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-mono">adaptive · resume-aware · scored</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-rose-400/8 border border-rose-400/20">
            <AlertCircle size={13} className="text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Resume Upload */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Resume
          </label>

          <div className={`
            relative rounded-lg border-2 border-dashed p-4 text-center cursor-pointer
            transition-colors duration-200
            ${uploadStatus === "done"
              ? "border-violet-500/40 bg-violet-500/5"
              : uploadStatus === "error"
              ? "border-rose-500/40 bg-rose-500/5"
              : "border-white/10 hover:border-white/20 bg-white/2"
            }
          `}>
            <input
              type="file"
              accept=".pdf"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              disabled={isLoading}
            />

            {uploadStatus === "uploading" ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="text-violet-400 animate-spin" />
                <span className="text-xs text-violet-300">Parsing resume...</span>
              </div>
            ) : uploadStatus === "done" ? (
              <div className="flex items-center gap-2 justify-center">
                <FileText size={14} className="text-violet-400 shrink-0" />
                <span className="text-xs text-violet-300 truncate max-w-[140px]">{file?.name}</span>
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
              </div>
            ) : (
              <div>
                <Upload size={18} className="mx-auto text-slate-500 mb-2" />
                <p className="text-xs text-slate-500">Drop PDF or click to upload</p>
              </div>
            )}
          </div>

          {/* Resume preview */}
          {resumePreview && (
            <div className="mt-3 px-3 py-2.5 rounded-lg bg-white/2 border border-white/6">
              <p className="text-xs text-slate-500 font-mono mb-1">Preview</p>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{resumePreview}</p>
            </div>
          )}
        </div>

        {/* Job Role */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Target Role
          </label>
          <div className="relative">
            <Briefcase size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              disabled={isLoading}
              className="
                w-full bg-white/4 border border-white/8 rounded-lg
                pl-8 pr-3 py-2.5 text-sm text-slate-200
                placeholder:text-slate-600
                focus:outline-none focus:border-violet-500/50 focus:bg-white/6
                disabled:opacity-40
              "
            />
          </div>
        </div>

        {/* Company Context */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Company Context
            <span className="ml-2 text-slate-600 normal-case font-normal">optional</span>
          </label>
          <div className="relative">
            <Building2 size={13} className="absolute left-3 top-3 text-slate-500" />
            <textarea
              value={companyContext}
              onChange={(e) => setCompanyContext(e.target.value)}
              placeholder="e.g. Fast-growing fintech startup, Series B"
              rows={3}
              disabled={isLoading}
              className="
                w-full bg-white/4 border border-white/8 rounded-lg
                pl-8 pr-3 py-2.5 text-sm text-slate-200 resize-none
                placeholder:text-slate-600
                focus:outline-none focus:border-violet-500/50 focus:bg-white/6
                disabled:opacity-40
              "
            />
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="
            w-full flex items-center justify-center gap-2
            bg-violet-600 hover:bg-violet-500
            text-white text-sm font-semibold
            py-2.5 rounded-lg
            disabled:opacity-30 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-violet-500/50
          "
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {sessionReady ? "Loading..." : "Starting..."}
            </>
          ) : (
            <>
              {sessionReady ? "Restart Interview" : "Start Interview"}
              <ChevronRight size={15} />
            </>
          )}
        </button>

        {/* Checklist — shows what's still needed */}
        {!sessionReady && (
          <div className="space-y-2">
            {[
              { done: uploadStatus === "done", label: "Resume uploaded" },
              { done: jobRole.trim().length > 0, label: "Role specified" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${item.done ? "bg-emerald-400" : "bg-slate-700"}`} />
                <span className={`text-xs font-mono ${item.done ? "text-emerald-400" : "text-slate-600"}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer status */}
      <div className="px-5 py-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${sessionReady ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
          <span className="text-xs text-slate-500 font-mono">
            {sessionReady ? "session active" : "ready to configure"}
          </span>
        </div>
      </div>
    </aside>
  )
}