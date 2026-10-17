export function selectResponse(sourceA, sourceB, preference = 'latency') {
  const successful = [['sourceA', sourceA], ['sourceB', sourceB]].filter(([,r]) => r.status === 'success' && r.text?.trim());
  const unavailable = reason => ({ source: null, preference, reason, status: 'unavailable' });
  if (!successful.length) return unavailable('Neither model returned a successful answer.');
  if (successful.length === 1) return {source:successful[0][0],preference,status:'selected',reason:'Only this model returned a successful answer. Answer quality has not been graded.'};
  if (sourceA.modelName === sourceB.modelName) return {source:'sourceA',preference,status:'selected',reason:'Both slots use the same model and response; no independent winner.'};
  const metric = preference === 'throughput' ? 'tokPerSec' : 'latencyMs';
  if (!successful.every(([,r]) => Number.isFinite(r[metric]) && r[metric] >= 0)) return unavailable('Cannot compare: the selected performance measurement is unavailable for one or both models.');
  const a = sourceA[metric], b = sourceB[metric];
  if (a === b) return {source:'sourceA',preference,status:'selected',reason:'Measured performance is tied; showing model A. Answer quality has not been graded.'};
  const source = (preference === 'throughput' ? a > b : a < b) ? 'sourceA' : 'sourceB';
  const r = source === 'sourceA' ? sourceA : sourceB;
  return {source,preference,status:'selected',reason:preference === 'throughput' ? 'Highest measured generation speed: '+r.tokPerSec+' tok/s. Answer quality has not been graded.' : 'Lowest measured response time: '+r.latencyMs+' ms. Answer quality has not been graded.'};
}
