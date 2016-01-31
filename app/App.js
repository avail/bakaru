import path from 'lib/path';
import cache from 'lib/cache';
import setupIpcMain from './ipcMain';

import { setThirdPartyDir } from 'lib/thirdparty/MediaInfo';

export default class App {
  constructor(electron) {
    this.name = 'Bakaru';

    this.electron = electron;
    this.rootDir = process.cwd();
    this.dialog = electron.dialog;
    this.app = electron.app;
    this.ipc = electron.ipcMain;
    this.runningDevMode = false;

    // Hacky workaround d'oh :(
    this.appPath = this.app.getAppPath();
    if (this.appPath.indexOf('default_app') > -1) {
      this.appPath = '';
      this.runningDevMode = true;
    }

    this.mainWindowUrl = `file://${this.appPath}/app/gui/index.html`;
    this.mainWindow = null;

    this._setupVariables();
    setupIpcMain(this);
    this._setupAppEventListeners();
  }

  _setupVariables() {
    setThirdPartyDir(path.thirdParty);
  }


  /**
   * Creates main window
   */
  createMainWindow() {
    this.mainWindow = new this.electron.BrowserWindow({
      width: 850,
      height: 720,
      title: 'Bakaru',
      frame: false,
      icon: this.rootDir + '/icon.png'
    });

    // and load the index.html of the app.
    console.log(this.mainWindowUrl);
    this.mainWindow.loadURL(this.mainWindowUrl);

    this.mainWindow.webContents.on('dom-ready', () => {
      cache.restore(this.mainWindow.webContents);
    });

    if (this.runningDevMode) {
      this.mainWindow.webContents.openDevTools({
        detach: true
      });
    }

    // this.mainWindow.setProgressBar(.5);

    // Emitted when the window is closed.
    this.mainWindow.on('closed', function () {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      this.mainWindow = null;
    });
  }

  /**
   * Setup app events listeners
   *
   * @private
   */
  _setupAppEventListeners() {
    this.app.on('ready', ::this.createMainWindow);

    this.app.on('window-all-closed', () => {
      cache.flush().then(() => {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
          this.app.quit();
        }
      });
    });

    this.app.on('activate', () => {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (this.mainWindow === null) {
        this.createMainWindow();
      }
    });
  }
}
