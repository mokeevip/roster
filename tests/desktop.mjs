import { _electron as electron } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const directory = await mkdtemp(path.join(tmpdir(), 'roster-desktop-'));
const options = { executablePath: path.resolve('release/win-unpacked/班级花名册.exe'), env: { ...process.env, ROSTER_TEST_DATA: directory } };
let app;
try {
  app = await electron.launch(options);
  let page = await app.firstWindow();
  await page.waitForSelector('#add-class');
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
  await page.locator('#add-class').click();
  await page.locator('#text-dialog-input').fill('桌面验证班');
  await page.locator('#text-dialog button[value="ok"]').click();
  await page.locator('#paste-input').fill('甲\t男\n乙\t女');
  await page.locator('#paste-import').click(); await page.locator('#confirm-import').click();
  assert.equal(await page.locator('#member-rows tr').count(), 2);
  const saved = JSON.parse(await readFile(path.join(directory, 'data/project.json'), 'utf8'));
  assert.equal(saved.classes[1].name, '桌面验证班');
  await app.close(); app = null;
  app = await electron.launch(options); page = await app.firstWindow();
  await page.waitForSelector('#member-rows tr');
  assert.equal(await page.locator('#member-rows tr').count(), 2);
  const pdfSize = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })).length);
  assert.ok(pdfSize > 5000);
  console.log('桌面包验证通过：独立窗口、默认最大化、新建班级、录入、程序目录保存、重启恢复、PDF。');
} finally { if (app) await app.close(); await rm(directory, { recursive: true, force: true, maxRetries: 5 }); }
