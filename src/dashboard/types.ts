export type DashboardSection =
  | 'overview'
  | 'account'
  | 'billing'
  | 'usage'
  | 'skills'
  | 'preferences'
  | 'security'

export interface UserDashboardProps {
  onBack: () => void
  onOpenEditor?: () => void
  /** Desktop shows local account info; billing/security open the web sign-in in the browser. */
  variant?: 'web' | 'desktop'
}
