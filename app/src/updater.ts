import { dialog, app } from 'electron'
import { autoUpdater, CancellationToken } from 'electron-updater'
const ProgressBar = require('electron-progressbar')
const Store = require('electron-store')
import logger from 'electron-log'

logger.transports.file.level = 'info'
autoUpdater.logger = logger

const store = new Store()

const checkForUpdatesAvailable = app.isPackaged

const init = () => {
  autoUpdater.setFeedURL({ provider: 'github', owner: 'purocean', repo: 'yn'})
  autoUpdater.autoDownload = false

  autoUpdater.on('update-available', async info => {
    const { response } = await dialog.showMessageBox({
      cancelId: 999,
      type: 'question',
      buttons: ['下载更新', '取消', '不再提醒'],
      title: '发现新版本',
      message: `当前版本 ${app.getVersion()}\n最新版本：${info.version}`
    })

    if (response === 0) {
      const progressBar = new ProgressBar({
        title: '下载更新',
        text: `${info.version}`,
        detail: '正在下载新版本 ',
        browserWindow: {
          closable: true,
          webPreferences: {
            nodeIntegration: true
          }
        }
      })

      const cancellationToken = new CancellationToken()
      autoUpdater.downloadUpdate(cancellationToken).catch(e => {
        progressBar.close()
        if (e.message !== 'Cancelled') {
          dialog.showMessageBox({
            type: 'info',
            title: '出现一点错误',
            message: e.message,
          })
        }
      })

      progressBar.on('aborted', () => {
        console.log('cancel download')
        cancellationToken.cancel()
      })

      const reportUpdateError = (e: any) => {
        progressBar.detail = '下载失败： ' + e
      }

      autoUpdater.once('error', e => {
        if (progressBar._window != null) {
          reportUpdateError(e)
        } else {
          progressBar.on('ready', () => {
            reportUpdateError(e)
          })
        }
      })

      autoUpdater.once('download-progress', (d) => {
        progressBar.value = d.percent
      })

      autoUpdater.once('update-downloaded', () => {
        progressBar.close()

        dialog.showMessageBox({
          cancelId: 999,
          type: 'question',
          buttons: ['立即安装', '推迟'],
          defaultId: 0,
          message: '新版本下载完成，是否要立即安装？'
        }).then(result => {
          if (result.response === 0) {
            setImmediate(() => {
              autoUpdater.quitAndInstall()
            })
          }
        })
      })
    } else if (response === 2) {
      store.set('dontCheckUpdates', true)
    }
  })
}

const checkForUpdates = () => {
  store.set('dontCheckUpdates', false)
  if (!checkForUpdatesAvailable) {
    dialog.showMessageBox({
      type: 'info',
      title: '检查更新不可用',
      message: '安装到系统的应用才可检查更新',
    })
    return false
  }

  autoUpdater.once('update-not-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '无新版本',
      message: '当前已经是最新版本',
    })
  })

  autoUpdater.checkForUpdates()
}

const autoCheckForUpdates = () => {
  if (!store.get('dontCheckUpdates')) {
    if (checkForUpdatesAvailable) {
      autoUpdater.checkForUpdates()
    }
  }
}

export {
  init,
  checkForUpdates,
  autoCheckForUpdates
}