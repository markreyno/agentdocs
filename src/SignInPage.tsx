interface SignInPageProps {
  onBack: () => void
}

export default function SignInPage({ onBack }: SignInPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a2e] to-[#16213e] text-gray-100 flex flex-col font-serif">
      <nav className="flex items-center justify-between px-12 py-5 border-b border-white/8">
        <span className="text-xl font-bold tracking-tight text-white">agentdocs</span>
        <button
          onClick={onBack}
          className="px-5 py-2 rounded-md border border-white/30 text-gray-200 text-sm font-sans hover:bg-white/10 transition-colors cursor-pointer"
        >
          ← Back
        </button>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Sign in</h1>
          <p className="text-gray-400 text-sm font-sans text-center mb-8">
            Welcome back to agentdocs
          </p>

          <form className="space-y-5" onSubmit={e => e.preventDefault()}>
            <div>
              <label htmlFor="username" className="block text-sm text-gray-400 font-sans mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-sans placeholder:text-gray-600 focus:outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 transition-colors"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-gray-400 font-sans mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-sans placeholder:text-gray-600 focus:outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/30 transition-colors"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold font-sans shadow-[0_4px_24px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_32px_rgba(99,102,241,0.55)] hover:-translate-y-0.5 transition-all cursor-pointer border-none"
            >
              Sign in
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
