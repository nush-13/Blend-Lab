import {test} from 'node:test';
import assert from 'node:assert/strict';
import {colorGraphHTML} from './graphify-colors.mjs';
const fixture = 'const RAW_NODES = '+JSON.stringify([{id:'a',label:'A',community:2},{id:'b',label:'B',community:7},{id:'c',label:'C',community:2}])+';\nconst LEGEND = '+JSON.stringify([{cid:2,label:'First',count:2},{cid:7,label:'Second',count:1}])+';';
const data = html => JSON.parse(html.match(/^const RAW_NODES = (.+);$/m)[1]);
test('palette preserves groups, IDs and labels while recolouring nodes and legend',()=>{
  const html=colorGraphHTML(fixture,{palette:['#112233','#445566']});
  const nodes=data(html);
  assert.deepEqual(nodes.map(n=>[n.id,n.community,n.label]),[['a',2,'A'],['b',7,'B'],['c',2,'C']]);
  assert.equal(nodes[0].color.background,'#112233');
  assert.equal(nodes[1].color.background,'#445566');
  assert.equal(nodes[2].color.background,'#112233');
  const legend=JSON.parse(html.match(/^const LEGEND = (.+);$/m)[1]);
  assert.equal(legend[1].color,'#445566');
});
test('explicit group overrides take precedence and invalid colours are rejected',()=>{
  assert.equal(data(colorGraphHTML(fixture,{groupColors:{'7':'#ABCDEF'}}))[1].color.background,'#ABCDEF');
  assert.throws(()=>colorGraphHTML(fixture,{palette:['red;script']}),/Invalid graphify-colors/);
});
