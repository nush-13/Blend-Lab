import { colorGraphHTML } from './graphify-colors.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const execute = promisify(execFile);
export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export async function graphifyExecutable() {
  if (process.env.GRAPHIFY_BIN) return process.env.GRAPHIFY_BIN;
  const hermes = path.join(os.homedir(), 'AppData/Local/hermes/hermes-agent/venv/Scripts/graphify.exe');
  try { await access(hermes); return hermes; } catch { return 'graphify'; }
}
export function createGraphify({ root = projectRoot, run = execute } = {}) {
  const graph = path.join(root, 'graphify-out/graph.json');
  async function status() {
    try { const info = await stat(graph); return { ready: true, indexedAt: info.mtime.toISOString() }; }
    catch { return { ready: false, message: 'Build the local code graph with npm run graphify:index.' }; }
  }
  async function query(question, signal) {
    const started = performance.now();
    const state = await status();
    if (!state.ready) throw Object.assign(new Error(state.message), { status: 503 });
    let stdout;
    try {
      ({ stdout } = await run(await graphifyExecutable(), ['query', question, '--graph', graph, '--budget', '600'], {
        cwd: root, timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true, signal,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      }));
    } catch (error) {
      throw Object.assign(new Error(error.code === 4 ? 'Graphify found no matching code. Name a function or file in your question.' : 'Graphify query failed. Check GRAPHIFY_BIN and rebuild with npm run graphify:index.'), { status: error.code === 4 ? 422 : 503 });
    }
    const lines = stdout.trim().split(/\r?\n/);
    const graphText = [lines[0], ...lines.filter(l => l.startsWith('NODE ')).slice(0, 10), ...lines.filter(l => l.startsWith('EDGE ')).slice(0, 12)].join('\n').slice(0, 3000);
    const sources = [], seen = new Set();
    const canonicalRoot = await realpath(root);
    for (const match of graphText.matchAll(/^NODE (.+?) \[src=(.+?) loc=L(\d+)[^\]]*\]/gm)) {
      const [, symbol, file, location] = match;
      const line = Number(location);
      if (seen.has(file+':'+line) || sources.length >= 3) continue;
      if (!/^(?:src|server|scripts|tests)\/[\w./-]+\.(?:[cm]?js|jsx|ts|tsx|py)$/.test(file) && file !== 'package.json') continue;
      try {
        const target = await realpath(path.resolve(root, file));
        const relative = path.relative(canonicalRoot, target);
        if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
        const info = await stat(target);
        if (info.size > 512000) continue;
        const code = (await readFile(target, 'utf8')).split(/\r?\n/);
        if (line < 1 || line > code.length) continue;
        const snippet = code.slice(line-1,line+12).map((text,i)=>(line+i)+': '+text).join('\n').slice(0,900);
        sources.push({ symbol, file, line, snippet, changedSinceIndex: info.mtime > new Date(state.indexedAt) });
        seen.add(file+':'+line);
      } catch { /* Missing sources are not evidence. */ }
    }
    if (!sources.length) throw Object.assign(new Error('Graphify matched no readable project sources. Rebuild the graph or name a source symbol.'), { status: 422 });
    return { text: graphText+'\nSOURCE EXCERPTS\n'+sources.map(s=>s.file+':'+s.line+'\n'+s.snippet).join('\n\n'), sources, indexedAt: state.indexedAt, retrievalMs: Math.round(performance.now()-started), truncated: stdout.trim().length > graphText.length };
  }
  let exportPending = null;
  async function explore() {
    const state = await status();
    if (!state.ready) throw Object.assign(new Error(state.message), { status: 503 });
    const htmlPath = path.join(root, 'graphify-out/graph.html');
    const currentGraph = await stat(graph);
    let needsExport = true;
    try { needsExport = (await stat(htmlPath)).mtimeMs < currentGraph.mtimeMs; } catch {}
    if (needsExport) {
      if (!exportPending) {
        exportPending = (async () => {
          try {
            await run(await graphifyExecutable(), ['export', 'html', '--graph', graph], {
              cwd: root, timeout: 60000, maxBuffer: 1024 * 1024, windowsHide: true,
              env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
            });
          } catch {
            throw Object.assign(new Error('Could not generate the code map. Check GRAPHIFY_BIN and run npm run graphify:index.'), { status: 503 });
          }
        })().finally(() => { exportPending = null; });
      }
      await exportPending;
    }
    if ((await stat(htmlPath)).size > 20 * 1024 * 1024) throw Object.assign(new Error('Code map is too large to display.'), { status: 413 });
    let colors = {};
    try { colors = JSON.parse(await readFile(path.join(root, 'graphify-colors.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw Object.assign(new Error('Cannot read graphify-colors.json. Check its JSON syntax.'), {status:503}); }
    return colorGraphHTML(await readFile(htmlPath, 'utf8'), colors);
  }
  return { status, query, explore };
}
