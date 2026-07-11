import DesktopApp from './DesktopApp'
import WebApp from './WebApp'
import { isDesktopApp } from './lib/isDesktop'

export default function App() {
  return isDesktopApp() ? <DesktopApp /> : <WebApp />
}
