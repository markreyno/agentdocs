import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import DownloadAgreementModal from '../DownloadAgreementModal'
import { openDesktopDownload } from './desktopDownload'

interface DownloadAgreementContextValue {
  /** Show the liability agreement; download only runs after the user accepts. */
  requestDesktopDownload: () => void
}

const DownloadAgreementContext = createContext<DownloadAgreementContextValue | null>(null)

export function DownloadAgreementProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const requestDesktopDownload = useCallback(() => {
    setOpen(true)
  }, [])

  const handleAccept = useCallback(() => {
    setOpen(false)
    openDesktopDownload()
  }, [])

  const value = useMemo(() => ({ requestDesktopDownload }), [requestDesktopDownload])

  return (
    <DownloadAgreementContext.Provider value={value}>
      {children}
      {open && (
        <DownloadAgreementModal onClose={() => setOpen(false)} onAccept={handleAccept} />
      )}
    </DownloadAgreementContext.Provider>
  )
}

/** Opens the agreement modal when wrapped in DownloadAgreementProvider; otherwise downloads directly. */
export function useRequestDesktopDownload(): () => void {
  const ctx = useContext(DownloadAgreementContext)
  return ctx?.requestDesktopDownload ?? openDesktopDownload
}
