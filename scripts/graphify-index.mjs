import 'dotenv/config';
import { spawn } from 'node:child_process';
import { graphifyExecutable, projectRoot } from '../server/graphify.mjs';
const child = spawn(await graphifyExecutable(), ['extract', '.', '--code-only', '--no-cluster', '--max-workers', '2'], { cwd: projectRoot, stdio: 'inherit', windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
child.on('error', e => { console.error('Cannot run Graphify: '+e.message+'. Set GRAPHIFY_BIN in .env.'); process.exitCode=1; });
child.on('exit', code => { process.exitCode=code ?? 1; });
