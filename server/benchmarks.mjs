const benchmarks = [
  {
    id: 'python-add-function', category: 'code', name: 'Python addition function',
    prompt: 'Return only this Python function, with no markdown: def add(a, b): followed by an indented return a + b.',
    scoringMethod: 'required-fragments', criteria: 'Output must contain the function signature and addition return expression.',
    fragments: ['def add(a, b):', 'return a + b'],
  },
  {
    id: 'python-square-function', category: 'code', name: 'Python square function',
    prompt: 'Return only a Python function named square that accepts n and returns n multiplied by itself. No markdown.',
    scoringMethod: 'required-fragments', criteria: 'Output must define square(n) and return n * n.',
    fragments: ['def square(n):', 'return n * n'],
  },
  {
    id: 'arithmetic-addition', category: 'arithmetic', name: 'Integer addition',
    prompt: 'What is 19 + 23? Reply with digits only.',
    scoringMethod: 'exact-normalized', criteria: 'The trimmed answer must equal 42.', expectedAnswer: '42',
  },
  {
    id: 'arithmetic-multiplication', category: 'arithmetic', name: 'Integer multiplication',
    prompt: 'What is 8 multiplied by 9? Reply with digits only.',
    scoringMethod: 'exact-normalized', criteria: 'The trimmed answer must equal 72.', expectedAnswer: '72',
  },
  {
    id: 'reasoning-socks', category: 'reasoning', name: 'Guaranteed matching pair',
    prompt: 'A drawer contains red and blue socks. What is the minimum number of socks you must take to guarantee two of the same color? Reply with a number only.',
    scoringMethod: 'exact-normalized', criteria: 'The trimmed answer must equal 3.', expectedAnswer: '3',
  },
  {
    id: 'reasoning-order', category: 'reasoning', name: 'Age ordering',
    prompt: 'Dana is older than Lee. Lee is older than Kim. Who is youngest? Reply with the name only.',
    scoringMethod: 'exact-normalized', criteria: 'The answer must identify Kim.', expectedAnswer: 'Kim',
  },
  {
    id: 'json-status-schema', category: 'json', name: 'Strict status JSON',
    prompt: 'Return only a JSON object with exactly these keys and values: id is the number 7, status is the string "ready", retry_count is the number 0. Do not use markdown.',
    scoringMethod: 'exact-json-object', criteria: 'Output must parse as JSON and equal {"id":7,"status":"ready","retry_count":0} with no extra keys.',
    expectedAnswer: { id: 7, status: 'ready', retry_count: 0 },
  },
  {
    id: 'instruction-exact-color', category: 'instruction', name: 'Exact constrained response',
    prompt: 'Reply with exactly the uppercase word BLUE. Do not add punctuation or any other text.',
    scoringMethod: 'exact-normalized', criteria: 'The trimmed answer must equal BLUE.', expectedAnswer: 'BLUE',
  },
  {
    id: 'classification-fruit', category: 'classification', name: 'Single-label classification',
    prompt: 'Classify apple using exactly one label from fruit, vehicle, or mineral. Reply with the label only.',
    scoringMethod: 'exact-normalized', criteria: 'The trimmed answer must equal fruit.', expectedAnswer: 'fruit',
  },
  {
    id: 'summarization-six-words', category: 'summarization', name: 'Constrained six-word summary',
    prompt: 'Summarize this in exactly six words and use this exact wording: "Mira planted four herbs beside school." Return only the summary. Source: Mira started a small herb garden beside her school.',
    scoringMethod: 'exact-normalized', criteria: 'The answer must exactly match the six-word reference summary.', expectedAnswer: 'Mira planted four herbs beside school.',
  },
  {
    id: 'extraction-reference-code', category: 'instruction', name: 'Reference code extraction',
    prompt: 'Extract the reference code from this text and return only the code: "Order note: reference BX-204 was received."',
    scoringMethod: 'exact-normalized', criteria: 'The trimmed answer must equal BX-204.', expectedAnswer: 'BX-204',
  },
];

export const BENCHMARKS = Object.freeze(benchmarks.map(benchmark => Object.freeze(benchmark)));
const benchmarksById = new Map(BENCHMARKS.map(benchmark => [benchmark.id, benchmark]));

export function getBenchmarks(ids) {
  if (!ids) return BENCHMARKS;
  return ids.map(id => benchmarksById.get(id)).filter(Boolean);
}

export function hasBenchmark(id) {
  return benchmarksById.has(id);
}

export function evaluateBenchmark(benchmark, output) {
  const normalizedOutput = output.trim().replace(/\s+/g, ' ');
  let passed = false;
  if (benchmark.scoringMethod === 'exact-normalized') {
    passed = normalizedOutput.toLowerCase() === String(benchmark.expectedAnswer).trim().replace(/\s+/g, ' ').toLowerCase();
  } else if (benchmark.scoringMethod === 'required-fragments') {
    passed = benchmark.fragments.every(fragment => output.includes(fragment));
  } else if (benchmark.scoringMethod === 'exact-json-object') {
    try {
      const actual = JSON.parse(output);
      const expectedKeys = Object.keys(benchmark.expectedAnswer).sort();
      const actualKeys = Object.keys(actual).sort();
      passed = JSON.stringify(actualKeys) === JSON.stringify(expectedKeys) &&
        expectedKeys.every(key => actual[key] === benchmark.expectedAnswer[key]);
    } catch {
      passed = false;
    }
  }
  return { status: 'evaluated', passed, score: passed ? 1 : 0, maxScore: 1, scoringMethod: benchmark.scoringMethod };
}