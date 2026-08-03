import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

let lastStatus: UpdateStatus = { state: 'idle' }

function broadcast(status: UpdateStatus) {
  lastStatus = status
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('updater:status', status)
  }
}

export function registerUpdaterHandlers() {
  ipcMain.handle('updater:getVersion', () => app.getVersion())
  ipcMain.handle('updater:getStatus', () => lastStatus)
  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      const status: UpdateStatus = {
        state: 'error',
        message: 'Updates are only available in the installed desktop app.',
      }
      broadcast(status)
      return status
    }
    try {
      await autoUpdater.checkForUpdates()
      return lastStatus
    } catch (err) {
      const status: UpdateStatus = {
        state: 'error',
        message: err instanceof Error ? err.message : 'Update check failed',
      }
      broadcast(status)
      return status
    }
  })
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })
}

/** Start listening for update events and check shortly after launch (packaged builds only). */
export function setupAutoUpdater() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    broadcast({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    broadcast({ state: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    broadcast({ state: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast({ state: 'downloading', percent: progress.percent })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcast({ state: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    broadcast({
      state: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  })

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((err: unknown) => {
      broadcast({
        state: 'error',
        message: err instanceof Error ? err.message : 'Update check failed',
      })
    })
  }, 4_000)
}
