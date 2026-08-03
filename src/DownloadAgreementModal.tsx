import { useState } from 'react'

interface DownloadAgreementModalProps {
  onClose: () => void
  onAccept: () => void
}

export default function DownloadAgreementModal({ onClose, onAccept }: DownloadAgreementModalProps) {
  const [agreed, setAgreed] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] font-sans p-4">
      <div
        role="dialog"
        aria-labelledby="download-agreement-title"
        aria-modal="true"
        className="bg-white dark:bg-[#1f2028] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4">
          <h2
            id="download-agreement-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            Before you download
          </h2>
          <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-[#23242c] p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-3">
            <p>
              agentdocs is provided <strong>as is</strong>, without warranties of any kind. By
              downloading and using this software, you agree that the authors and distributors are{' '}
              <strong>not liable</strong> for any loss, damage, cost, or claim arising from your use
              of the product — including but not limited to data loss, interrupted work, or outcomes
              produced by AI features.
            </p>
            <p>
              The desktop app may ask you to supply your own third-party API keys (for example
              Anthropic, OpenAI, or Google). You are solely responsible for those keys: how they are
              stored and used on your device, any usage or billing they incur, and any consequences
              if a key is leaked, misused, or revoked. We are not liable for charges, account
              actions, or security incidents related to your API keys.
            </p>
            <p>
              Use of AI providers is subject to each provider&apos;s own terms. You use this product
              at your own risk.
            </p>
          </div>

          <label className="mt-4 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 shrink-0"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
              I understand and agree that agentdocs is provided without liability, and that I am
              solely responsible for my API keys and their use.
            </span>
          </label>
        </div>

        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={!agreed}
            onClick={onAccept}
            className="flex-1 bg-indigo-600 text-white text-sm font-medium rounded-lg py-2.5 px-4 cursor-pointer hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Agree &amp; download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg py-2.5 px-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
