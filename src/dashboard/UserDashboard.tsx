import { useEffect, useState } from 'react'
import {
  getOrCreateUser,
  listRecentDocuments,
  updateUserDisplayName,
  type DocumentRecord,
  type LocalUser,
} from '../lib/documents'
import { useSkills } from '../lib/skills'
import { useTheme } from '../lib/theme'
import { openWebSignIn } from '../lib/webAccount'
import { NAV_ITEMS, WEB_GATED_COPY, WEB_GATED_SECTIONS } from './constants'
import { DashboardSidebar } from './DashboardSidebar'
import { DashboardTopNav } from './DashboardTopNav'
import { AccountSection } from './sections/AccountSection'
import { BillingSection } from './sections/BillingSection'
import { OverviewSection } from './sections/OverviewSection'
import { PreferencesSection } from './sections/PreferencesSection'
import { SecuritySection } from './sections/SecuritySection'
import { SkillsSection } from './sections/SkillsSection'
import { UsageSection } from './sections/UsageSection'
import type { DashboardSection, UserDashboardProps } from './types'
import { WebGatePanel } from './WebGatePanel'

export type { UserDashboardProps }

export default function UserDashboard({ onBack, onOpenEditor, variant = 'web' }: UserDashboardProps) {
  const isDesktop = variant === 'desktop'
  const [section, setSection] = useState<DashboardSection>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<LocalUser>(() => getOrCreateUser())
  const [email, setEmail] = useState('author@example.com')
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => listRecentDocuments(user.id))
  const [openingWeb, setOpeningWeb] = useState(false)
  const { skills, customSkills, removeSkill } = useSkills()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    setDocuments(listRecentDocuments(user.id))
  }, [user.id])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [section])

  function goTo(id: DashboardSection) {
    setSection(id)
    setSidebarOpen(false)
  }

  function handleDisplayNameBlur(value: string) {
    setUser(updateUserDisplayName(value))
  }

  async function handleOpenWebSignIn() {
    setOpeningWeb(true)
    try {
      await openWebSignIn()
    } finally {
      setOpeningWeb(false)
    }
  }

  const sectionTitle = NAV_ITEMS.find(i => i.id === section)?.label ?? 'Dashboard'
  const showWebGate = isDesktop && WEB_GATED_SECTIONS.has(section)
  const webGateCopy =
    showWebGate && (section === 'billing' || section === 'usage' || section === 'security')
      ? WEB_GATED_COPY[section]
      : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a2e] to-[#16213e] text-gray-100 flex flex-col font-serif">
      <DashboardTopNav
        isDesktop={isDesktop}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(open => !open)}
        onBack={onBack}
        onOpenEditor={onOpenEditor}
      />

      <div className="flex flex-1 min-h-0 relative">
        <DashboardSidebar
          isDesktop={isDesktop}
          sidebarOpen={sidebarOpen}
          section={section}
          displayName={user.displayName}
          email={email}
          onNavigate={goTo}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 min-w-0 px-5 sm:px-10 py-10 sm:py-12">
          <div className="max-w-3xl mx-auto w-full">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{sectionTitle}</h1>
            <p className="text-sm text-gray-500 font-sans mb-8">
              {isDesktop
                ? 'Local account details on this device. Billing and cloud settings open in your browser.'
                : 'Manage your agentdocs account, plan, and AI usage.'}
            </p>

            {webGateCopy && (
              <WebGatePanel
                title={webGateCopy.title}
                body={webGateCopy.body}
                openingWeb={openingWeb}
                onOpenWebSignIn={() => void handleOpenWebSignIn()}
              />
            )}

            {!showWebGate && section === 'overview' && (
              <OverviewSection
                isDesktop={isDesktop}
                documents={documents}
                skillsCount={skills.length}
                theme={theme}
                openingWeb={openingWeb}
                onOpenWebSignIn={() => void handleOpenWebSignIn()}
                onOpenEditor={onOpenEditor}
                onNavigate={goTo}
              />
            )}

            {!showWebGate && section === 'account' && (
              <AccountSection
                isDesktop={isDesktop}
                displayName={user.displayName}
                userId={user.id}
                email={email}
                onEmailChange={setEmail}
                onDisplayNameBlur={handleDisplayNameBlur}
              />
            )}

            {!showWebGate && section === 'billing' && <BillingSection />}

            {!showWebGate && section === 'usage' && <UsageSection />}

            {!showWebGate && section === 'skills' && (
              <SkillsSection
                skills={skills}
                customSkills={customSkills}
                onRemoveSkill={removeSkill}
              />
            )}

            {!showWebGate && section === 'preferences' && (
              <PreferencesSection theme={theme} onToggleTheme={toggleTheme} />
            )}

            {!showWebGate && section === 'security' && (
              <SecuritySection isDesktop={isDesktop} onSignOut={onBack} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
