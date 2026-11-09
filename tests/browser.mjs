import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { palettes, cellColor } from '../src/model.js';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', req => { if (/^https?:/.test(req.url())) requests.push(req.url()); });
try {
  await page.goto(pathToFileURL(`${process.cwd()}/班级花名册.html`).href);
  await page.locator('#paste-input').fill('姓名\t性别\n' + Array.from({ length: 52 }, (_, i) => `同学${i + 1}\t${i % 3 ? '男' : '女'}`).join('\n'));
  await page.locator('#paste-import').click();
  await page.locator('#confirm-import').click();
  assert.equal(await page.locator('#member-rows tr').count(), 52);
  await page.locator('[data-panel="layout"]').click();
  assert.ok(await page.locator('.paper').count() > 1);
  await page.locator('#fit-one-page').click();
  assert.equal(await page.locator('.paper').count(), 1);
  await page.locator('#mode').selectOption('group');
  await page.locator('#fit-one-page').click();
  assert.equal(await page.locator('.paper').count(), 1);
  assert.equal(await page.locator('.student-cell').count(), 52);
  assert.deepEqual(await page.locator('#palette option').evaluateAll(options => options.map(option => option.value)), Object.keys(palettes));
  for (const palette of Object.keys(palettes)) {
    await page.locator('#palette').selectOption(palette);
    const actual = await page.locator('.student-cell').first().evaluate(cell => getComputedStyle(cell).backgroundColor);
    const expected = cellColor({ mode: 'group', palette, groupSize: 5 }, 0).match(/../g).map(value => parseInt(value, 16));
    assert.equal(actual, `rgb(${expected.join(', ')})`);
  }
  await page.locator('#palette').selectOption('fresh');
  const fits = await page.locator('.paper').evaluate(p => {
    const footer = p.querySelector('.paper-footer').getBoundingClientRect();
    return [...p.querySelectorAll('.student-cell')].every(c => c.getBoundingClientRect().bottom <= footer.top && c.scrollHeight <= c.clientHeight + 1);
  });
  assert.equal(fits, true);
  await page.locator('#save-layout').click();
  await page.locator('#text-dialog-input').fill('52人分组模板');
  await page.locator('#text-dialog button[value="ok"]').click();
   await page.locator('[data-panel="templates"]').click();
  assert.match(await page.locator('#template-list').textContent(), /52人分组模板/);
   assert.equal(await page.locator('#template-list .template-card').count(), 1);
   await page.locator('#new-template').click();
   assert.equal(await page.locator('#layout-editor-title').textContent(), '新排版');
   await page.locator('#save-layout').click();
  await page.locator('#text-dialog-input').fill('第二个模板');
  await page.locator('#text-dialog button[value="ok"]').click();
   await page.locator('[data-panel="templates"]').click();
   assert.equal(await page.locator('#template-list .template-card').count(), 2);
  page.once('dialog', dialog => dialog.accept());
   await page.locator('.template-card').filter({ hasText: '第二个模板' }).locator('[data-template-delete]').click();
   assert.equal(await page.locator('#template-list .template-card').count(), 1);
  await page.locator('[data-panel="layout"]').click();
  await page.locator('#mode').selectOption('gender');
  await page.locator('[data-panel="templates"]').click();
   await page.locator('.template-open').filter({ hasText: '52人分组模板' }).click();
  assert.equal(await page.locator('#mode').inputValue(), 'group');
   assert.match(await page.locator('#layout-editor-title').textContent(), /52人分组模板/);
   const savedHeight = await page.locator('#rowHeight').inputValue();
   await page.locator('#groupSize').fill('9'); await page.locator('#groupSize').blur();
   await page.locator('#palette').selectOption('sunset');
   await page.locator('#reset-layout').click();
   assert.equal(await page.locator('#mode').inputValue(), 'group');
   assert.equal(await page.locator('#groupSize').inputValue(), '5');
   assert.equal(await page.locator('#palette').inputValue(), 'fresh');
   assert.equal(await page.locator('#rowHeight').inputValue(), savedHeight);
   assert.match(await page.locator('#layout-editor-title').textContent(), /52人分组模板/);
  await page.locator('#add-class').click();
  await page.locator('#text-dialog-input').fill('模板验证班');
  await page.locator('#text-dialog button[value="ok"]').click();
  await page.locator('.class-tab').filter({ hasText: '模板验证班' }).waitFor();
  await page.locator('[data-panel="templates"]').click();
   await page.locator('.template-open').filter({ hasText: '52人分组模板' }).click();
  assert.equal(await page.locator('#mode').inputValue(), 'group');
  assert.equal(await page.locator('#member-rows tr').count(), 0);
  await page.locator('.class-tab').first().click();
  await page.locator('[data-panel="members"]').click();
  await page.locator('#paste-input').fill(Array.from({ length: 11 }, (_, i) => `新增${i + 1}\t男`).join('\n'));
  await page.locator('#paste-import').click();
  await page.locator('#confirm-import').click();
  await page.locator('[data-panel="layout"]').click();
  assert.equal(await page.locator('.student-cell').count(), 63);
  const geometries = await page.locator('.paper').evaluateAll(papers => papers.map(p => {
    const grid = p.querySelector('.paper-grid'), children = [...grid.children], paper = p.getBoundingClientRect();
    const left = children[0].getBoundingClientRect(), right = children[1].getBoundingClientRect();
    return { leftMargin: left.left - paper.left, rightMargin: paper.right - right.right, widthDiff: left.width - right.width, gap: right.left - left.right };
  }));
  for (const g of geometries) { assert.ok(Math.abs(g.leftMargin - g.rightMargin) < 1); assert.ok(Math.abs(g.widthDiff) < 1); assert.ok(g.gap > 20); }
  await page.locator('#reset-layout').click();
  await page.locator('#mode').selectOption('group');
  await page.locator('#groupSize').fill('100'); await page.locator('#groupSize').blur();
  assert.ok(await page.locator('.paper').count() > 1);
  const overflow = await page.locator('.paper').evaluateAll(papers => papers.some(p => {
    const footer = p.querySelector('.paper-footer').getBoundingClientRect();
    return [...p.querySelectorAll('.student-cell')].some(c => c.getBoundingClientRect().bottom > footer.top);
  }));
  assert.equal(overflow, false);
  await page.locator('#tableStyle').check();
  for (const mode of ['gender', 'group']) for (const numbers of [true, false]) {
    await page.locator('#mode').selectOption(mode);
    await page.locator('#showNumbers').setChecked(numbers);
    await page.locator('#blankColumns').fill('12'); await page.locator('#blankColumns').blur();
    assert.equal(await page.locator('.writing-row').count(), 63);
    assert.equal(await page.locator('.writing-blank').count(), 63 * 12);
    assert.equal(await page.locator('.writing-number').count(), numbers ? 63 : 0);
    const valid = await page.locator('.paper').evaluateAll(papers => papers.every(p => {
      const footer = p.querySelector('.paper-footer').getBoundingClientRect();
      return [...p.querySelectorAll('.writing-table')].every(table => {
        const rect = table.getBoundingClientRect(), rows = [...table.querySelectorAll('.writing-row')];
        return rect.bottom <= footer.top + 1 && rows.every((row, i) => {
          const cells = [...row.children], r = row.getBoundingClientRect();
          return cells.every(cell => getComputedStyle(cell).backgroundColor === getComputedStyle(cells[0]).backgroundColor) &&
            Math.abs(cells.at(-1).getBoundingClientRect().right - r.right) < 1 &&
            (!i || Math.abs(rows[i - 1].getBoundingClientRect().bottom - r.top) < 0.1);
        });
      });
    }));
    assert.equal(valid, true);
  }
  await page.locator('#tableStyle').uncheck();
  await page.locator('#showNumbers').check();
  await page.locator('#mode').selectOption('group');
  const groupColors = await page.locator('.student-cell').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor.match(/\d+/g).map(Number)));
  for (let i = 1; i < groupColors.length; i++) {
    assert.ok(groupColors[i].every((value, channel) => value >= groupColors[i - 1][channel]));
    assert.ok(groupColors[i].some((value, channel) => value > groupColors[i - 1][channel]), '跨页后组内颜色应继续变浅');
  }
  const downloadEvent = page.waitForEvent('download'); await page.locator('#export-excel').click();
  const dl = await downloadEvent; assert.ok(dl.suggestedFilename().endsWith('.xlsx'));
  const savedExcel = await dl.path();
  await page.locator('#excel-file').setInputFiles(savedExcel);
  await page.locator('#confirm-import').click();
  assert.equal(await page.locator('.student-cell').count(), 63);
   assert.equal(await page.locator('#template-list .template-card').count(), 1);
  await page.reload(); assert.equal(await page.locator('#member-rows tr').count(), 63);
   assert.equal(await page.locator('#template-list .template-card').count(), 1);
  await page.locator('[data-panel="templates"]').click();
   await page.locator('#template-list .paste-actions [data-template-edit]').click();
  assert.equal(await page.locator('#layout-panel').isVisible(), true);
  assert.match(await page.locator('#template-edit-status').textContent(), /正在编辑「52人分组模板」/);
  assert.equal(await page.locator('#autoFit').isChecked(), false);
  await page.locator('#mode').selectOption('gender');
  assert.equal(await page.locator('#groupSize').isEnabled(), true);
  assert.equal(await page.locator('#groupGap').isEnabled(), true);
  await page.locator('#groupGap').fill('7'); await page.locator('#groupGap').blur();
  assert.equal(await page.locator('#mode').inputValue(), 'group');
  assert.equal(await page.locator('#autoFit').isChecked(), false);
  await page.locator('#groupSize').fill('6');
   await page.locator('#save-layout').click();
   assert.equal(await page.locator('#text-dialog').isVisible(), false);
   assert.equal(await page.locator('#template-list .template-card').count(), 1);
   await page.locator('#groupSize').fill('10'); await page.locator('#groupSize').blur();
   await page.locator('#reset-layout').click();
   assert.equal(await page.locator('#groupSize').inputValue(), '6');
   assert.equal(await page.locator('#groupGap').inputValue(), '7');
   await page.locator('#save-layout').click();
   assert.equal(await page.locator('#text-dialog').isVisible(), false);
   assert.equal(await page.locator('#template-list .template-card').count(), 1);
  assert.match(await page.locator('#toast').textContent(), /修改已保存/);
  await page.reload();
  await page.locator('[data-panel="layout"]').click();
  await page.locator('#groupSize').fill('4'); await page.locator('#groupSize').blur();
  await page.locator('[data-panel="templates"]').click();
   await page.locator('.template-open').filter({ hasText: '52人分组模板' }).click();
  assert.equal(await page.locator('#groupSize').inputValue(), '6');
  assert.equal(await page.locator('#groupGap').inputValue(), '7');
  await page.locator('.class-tab').last().click();
   assert.equal(await page.locator('#layout-editor-title').textContent(), '新排版');
  await page.locator('.class-tab').first().click();
  await page.emulateMedia({ media: 'print' });
  const dimensions = await page.locator('.paper').first().boundingBox();
  assert.ok(Math.abs(dimensions.width - 210 * 96 / 25.4) < 1);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true }); assert.ok(pdf.byteLength > 10000);
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log('浏览器验证通过：离线运行、63人导入、双列对称、跨页、Excel 往返、本地恢复、A4 PDF。');
} finally { await browser.close(); }
