import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const result = await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, write: false, format: 'iife', target: ['chrome100'], legalComments: 'inline' });
const html = await readFile('src/index.html', 'utf8');
const css = await readFile('src/style.css', 'utf8');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile('班级花名册.html', html.replaceAll('__APP_VERSION__', version).replace('/* INLINE_STYLE */', css).replace('/* INLINE_SCRIPT */', result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')));
console.log('已生成：班级花名册.html（包含全部依赖，可直接离线打开）');
