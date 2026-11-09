const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.ROSTER_TEST_DATA || process.env.PORTABLE_EXECUTABLE_DIR || (app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath());
const dataDir = path.join(base, 'data');
let win;
// Persist Chromium's own cache alongside portable application data as well.
app.setPath('userData', path.join(dataDir, 'runtime'));
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    try { fs.mkdirSync(dataDir, { recursive: true }); fs.accessSync(dataDir, fs.constants.W_OK); }
    catch (error) { dialog.showErrorBox('无法保存数据', `请把程序移到可以写入的文件夹后重试。\n数据目录：${dataDir}\n${error.message}`); app.quit(); return; }
    Menu.setApplicationMenu(null);
    ipcMain.on('roster:load', event => {
      try { const file = path.join(dataDir, 'project.json'); event.returnValue = { ok: true, text: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null, directory: dataDir }; }
      catch (error) { event.returnValue = { ok: false, error: error.message }; }
    });
    ipcMain.on('roster:save', (event, text) => {
      try {
        if (typeof text !== 'string' || text.length > 30 * 1024 * 1024) throw new Error('项目数据无效或过大');
        const obj = JSON.parse(text); if (obj.format !== 'class-roster' || !Array.isArray(obj.classes)) throw new Error('项目格式无效');
        const file = path.join(dataDir, 'project.json'), tmp = file + '.tmp';
        fs.writeFileSync(tmp, text, 'utf8'); fs.renameSync(tmp, file); event.returnValue = { ok: true };
      } catch (error) { event.returnValue = { ok: false, error: error.message }; }
    });
    ipcMain.handle('roster:print', async () => {
      const choice = await dialog.showMessageBox(win, { type: 'question', title: '输出花名册', message: '选择打印或保存 PDF', buttons: ['打印', '保存 PDF', '取消'], cancelId: 2 });
      if (choice.response === 2) return { ok: true };
      try {
        if (choice.response === 1) {
          const result = await dialog.showSaveDialog(win, { title: '保存 PDF', defaultPath: '班级花名册.pdf', filters: [{ name: 'PDF 文件', extensions: ['pdf'] }] });
          if (result.canceled) return { ok: true };
          const pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
          fs.writeFileSync(result.filePath, pdf); return { ok: true, saved: true };
        }
        return await new Promise(resolve => win.webContents.print({ silent: false, printBackground: true, pageSize: 'A4', margins: { marginType: 'none' } }, (success, reason) => resolve({ ok: success || /cancel/i.test(reason), error: reason })));
      } catch (error) { return { ok: false, error: error.message }; }
    });
    win = new BrowserWindow({ width: 1440, height: 960, minWidth: 900, minHeight: 650, show: false, title: '班级花名册', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.session.on('will-download', (_event, item) => item.setSaveDialogOptions({ title: '保存文件', defaultPath: item.getFilename() }));
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F11') { event.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
      if (input.type === 'keyDown' && input.key === 'Escape' && win.isFullScreen()) win.setFullScreen(false);
    });
    win.once('ready-to-show', () => { win.maximize(); win.show(); });
    await win.loadFile(path.join(app.getAppPath(), '班级花名册.html'));
  }).catch(error => { dialog.showErrorBox('启动失败', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
