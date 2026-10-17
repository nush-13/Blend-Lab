import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectResponse} from './select-response.mjs';
const a={modelName:'a',status:'success',text:'A',latencyMs:20,tokPerSec:12};
const b={modelName:'b',status:'success',text:'B',latencyMs:10,tokPerSec:6};
test('selects using actual latency or generation throughput',()=>{
 assert.equal(selectResponse(a,b,'latency').source,'sourceB');
 assert.equal(selectResponse(a,b,'throughput').source,'sourceA');
});
test('failed output is excluded regardless of its speed',()=>{
 const result=selectResponse({...a,status:'error',latencyMs:1},b);
 assert.equal(result.source,'sourceB');assert.match(result.reason,/Only this model/);
 assert.equal(selectResponse({...a,status:'error'},{...b,status:'error'}).source,null);
});
test('missing measurements do not produce an invented winner',()=>{
 assert.equal(selectResponse({...a,latencyMs:null},b).status,'unavailable');
 assert.equal(selectResponse(a,{...b,tokPerSec:null},'throughput').source,null);
});
test('ties and reused same-model results are explained honestly',()=>{
 assert.match(selectResponse(a,{...b,latencyMs:20}).reason,/tied/);
 assert.match(selectResponse(a,{...a}).reason,/no independent winner/);
});
