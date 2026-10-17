import {test} from 'node:test';
import assert from 'node:assert/strict';
import {describeOllamaModel,selectComparisonModels} from './ollamaModels';
const local=describeOllamaModel({name:'qwen2.5-coder:latest',details:{family:'qwen2',format:'gguf'}});
const cloud=describeOllamaModel({name:'gemma4:cloud',remote_host:'https://ollama.com',remote_model:'gemma4:31b',details:{parameter_size:'32.7B'}});
test('cloud models are labelled explicitly and missing metadata is not invented',()=>{
  assert.equal(cloud.executionMode,'cloud');assert.equal(cloud.architecture,'Ollama Cloud');
  assert.match(cloud.description,/sent to Ollama servers/);assert.equal(local.executionMode,'local');
  assert.equal(cloud.defaultQuantization,'Unknown');
});
test('comparison selects distinct local and cloud models after discovery or single-model refresh',()=>{
  for(const previous of [[undefined,undefined],[local.id,local.id]]){
    const selected=selectComparisonModels([cloud,local],...previous);
    assert.equal(selected.modelA.id,local.id);assert.equal(selected.modelB.id,cloud.id);
  }
  assert.equal(selectComparisonModels([local]).modelB.id,local.id);
  assert.equal(selectComparisonModels([]).modelA,undefined);
});
test('different existing selections are retained',()=>{
  const selected=selectComparisonModels([local,cloud],cloud.id,local.id);
  assert.equal(selected.modelA.id,cloud.id);assert.equal(selected.modelB.id,local.id);
});
