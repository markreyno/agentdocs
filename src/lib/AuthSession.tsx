import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchMe,
  signOut as apiSignOut,
  type AuthSessionInfo,
  type AuthUser,
} from './authClient'

interface AuthContextValue {
  user: AuthUser | null
  session: AuthSessionInfo | null
  loading: boolean
  refresh: () => Promise<void>
  setUser: (user: AuthUser | null, session?: AuthSessionInfo | null) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSessionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await fetchMe()
      setUserState(result?.user ?? null)
      setSession(result?.session ?? null)
    } catch {
      setUserState(null)
      setSession(null)
    }
  }, [])

  useEffect(() => {
    void refresh().finally(() => setLoading(false))
  }, [refresh])

  const setUser = useCallback((next: AuthUser | null, nextSession?: AuthSessionInfo | null) => {
    setUserState(next)
    if (nextSession !== undefined) setSession(nextSession)
    if (!next) setSession(null)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await apiSignOut()
    } finally {
      setUserState(null)
      setSession(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, session, loading, refresh, setUser, signOut }),
    [user, session, loading, refresh, setUser, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
