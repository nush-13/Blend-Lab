import 'dotenv/config';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
const server=createApp({enableInferenceLogging:false}).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
try {
  const base='http://127.0.0.1:'+server.address().port;
  const tags=await (await fetch(base+'/api/ollama/models')).json();
  const model=process.env.OLLAMA_TEST_MODEL || tags.models?.[0]?.name;
  assert.ok(model,tags.error || 'No installed models');
  const response=await fetch(base+'/api/ollama/compare',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({modelA:model,modelB:model,prompt:'In inferModel, which file sends requests to Ollama? Reply with the filename only.',useGraphifyContext:true,maxTokens:32,temperature:0,timeoutSeconds:600}),
  });
  const data=await response.json();
  assert.equal(response.status,200,data.error);
  assert.equal(data.sourceA.status,'success',data.sourceA.error);
  assert.ok(data.sourceA.outputTokens>0);
  assert.ok(data.graphifyContext.sources.some(s=>s.file==='server/app.mjs'));
  assert.equal(data.sourceA.text,data.sourceB.text);
  console.log(JSON.stringify({project:process.cwd(),model,answer:data.sourceA.text,outputTokens:data.sourceA.outputTokens,retrievalMs:data.graphifyContext.retrievalMs,sources:data.graphifyContext.sources.map(s=>s.file+':'+s.line)},null,2));
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
