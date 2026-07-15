import { openDesktopDownload } from './lib/desktopDownload'
import { DEMO_USAGE_LIMIT } from './lib/demoUsage'

interface DownloadModalProps {
  onClose?: () => void
}

export default function DownloadModal({ onClose }: DownloadModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] font-sans p-4">
      <div className="bg-white dark:bg-[#1f2028] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Demo limit reached
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            You&apos;ve used all {DEMO_USAGE_LIMIT} free demo agent requests. Download the desktop
            app for unlimited agent access, your own API keys, and full offline support. You can
            keep editing your document in the browser.
          </p>
        </div>

        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={openDesktopDownload}
            className="flex-1 bg-indigo-600 text-white text-sm font-medium rounded-lg py-2.5 px-4 cursor-pointer hover:bg-indigo-700 transition-colors"
          >
            Download desktop app
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg py-2.5 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Keep browsing
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
