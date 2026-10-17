import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from './app.mjs';
import { createGraphify } from './graphify.mjs';

test('Graphify opt-in sends identical context, preserves baseline, and blocks failed retrieval', async t => {
  const calls=[]; let queries=0, fail=false;
  const graphify={ query: async () => { queries++; if(fail) throw Object.assign(new Error('Graph missing'),{status:503}); return {text:'NODE request() evidence',sources:[],retrievalMs:3}; } };
  const app=createApp({enableInferenceLogging:false,graphify,fetchImpl:async (url,options)=>{
    if(String(url).endsWith('/api/tags')) return Response.json({models:[{name:'a'},{name:'b'}]});
    calls.push(JSON.parse(options.body));
    return Response.json({done:true,message:{content:'answer'},eval_count:1,eval_duration:1e9});
  }});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base='http://127.0.0.1:'+server.address().port;
  const compare=body=>fetch(base+'/api/ollama/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'request',modelA:'a',modelB:'b',...body})});
  assert.equal((await compare({})).status,200);
  assert.equal(queries,0);
  assert.deepEqual(calls[0].messages,[{role:'user',content:'request'}]);
  calls.length=0;
  const grounded=await (await compare({useGraphifyContext:true})).json();
  assert.equal(queries,1);
  assert.deepEqual(calls[0].messages,calls[1].messages);
  assert.match(calls[0].messages[1].content,/NODE request/);
  assert.equal(grounded.graphifyContext.retrievalMs,3);
  assert.equal(grounded.sourceA.provenance,'inference');
  fail=true; calls.length=0;
  assert.equal((await compare({useGraphifyContext:true})).status,503);
  assert.equal(calls.length,0);
  assert.equal((await compare({useGraphifyContext:'yes'})).status,400);
});

test('local adapter uses safe arguments, bounded source excerpts, and excludes outside paths',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'blendlab-graphify-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'src')); await mkdir(path.join(root,'graphify-out'));
  await writeFile(path.join(root,'src/app.ts'),'export function request() { return 42; }');
  await writeFile(path.join(root,'graphify-out/graph.json'),'{}');
  const question='request; $(unsafe)';
  const adapter=createGraphify({root,run:async (_command,args)=>{
    assert.equal(args[1],question);
    return {stdout:'NODE request() [src=src/app.ts loc=L1]\nNODE secrets [src=../.env loc=L1]\nEDGE request --calls [EXTRACTED]--> fetch\n'+'x'.repeat(10000)};
  }});
  const result=await adapter.query(question);
  assert.equal(result.sources.length,1);
  assert.equal(result.sources[0].file,'src/app.ts');
  assert.match(result.text,/return 42/);
  assert.ok(result.text.length<6500);
  assert.equal(result.truncated,true);
  await rm(path.join(root,'graphify-out/graph.json'));
  await assert.rejects(adapter.query(question),/graphify:index/);
});

test('Graphify no-match errors are explicit',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'blendlab-graphify-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'graphify-out')); await writeFile(path.join(root,'graphify-out/graph.json'),'{}');
  const adapter=createGraphify({root,run:async()=>{throw {code:4};}});
  await assert.rejects(adapter.query('unknown'),/no matching code/);
});


test('interactive map exports once and reuses the generated HTML', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'blendlab-map-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'graphify-out'));
  await writeFile(path.join(root, 'graphify-out/graph.json'), '{}');
  let exports = 0;
  const adapter = createGraphify({ root, run: async (_command, args) => {
    exports++;
    assert.deepEqual(args, ['export', 'html', '--graph', path.join(root, 'graphify-out/graph.json')]);
    await writeFile(path.join(root, 'graphify-out/graph.html'), '<html>Interactive graph</html>');
    return { stdout: '' };
  } });
  const [left, right] = await Promise.all([adapter.explore(), adapter.explore()]);
  assert.equal(left, '<html>Interactive graph</html>');
  assert.equal(right, left);
  assert.equal(exports, 1);
  assert.equal(await adapter.explore(), left);
  assert.equal(exports, 1);
});

test('map route serves HTML in an isolated origin and explains missing indexes', async t => {
  let fail = false;
  const server = createApp({ graphify: { explore: async () => {
    if (fail) throw Object.assign(new Error('Missing <graph>'), { status: 503 });
    return '<html>Interactive graph</html>';
  } } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/graphify/explore';
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(response.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.equal(await response.text(), '<html>Interactive graph</html>');
  fail = true;
  const unavailable = await fetch(url);
  assert.equal(unavailable.status, 503);
  assert.match(await unavailable.text(), /Missing &lt;graph&gt;/);
});
