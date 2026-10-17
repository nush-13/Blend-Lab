# BlendLab

Existing React/Vite/TypeScript playground connected to local Ollama through an Express API bridge.

## Windows launch

Requires Node 22.12+ (or 20.19+) and Ollama with an installed chat model.

```powershell
Set-Location D:\blend-lab-final
npm ci
ollama list
# Run ollama serve in another terminal if Ollama is not running.
npm run dev
```

Open http://localhost:3000. Select installed models from either model card. A single installed model can occupy both slots. Refresh models after installing additional models yourself. BlendLab never downloads weights.

Copy .env.example to .env and set OLLAMA_URL to use another Ollama host. Restart the server after changes. The default is http://127.0.0.1:11434. Keep API_PORT=8000 for the default Vite proxy. The browser API endpoint in Settings is /api/ollama. No API key is required for local Ollama.

Settings forwards temperature, top-p, max output tokens, and timeout to inference. Probe checks connectivity and refreshes models. Failures are displayed without falling back to mocks. Demo mode is an explicit option.

## Manual real-model comparison

Run `ollama list` and choose two different installed model IDs. In BlendLab, select one for Model A and the other for Model B, switch to **All 3 Side-by-Side**, enter a prompt, and run it. The source panels should show their selected IDs and separate input/output token counts, wall-clock latency, Ollama total duration, and Ollama generation duration. Throughput is N/A when Ollama omits generation duration metadata. At 0-50% the candidate routes entirely to A; above 50% it routes entirely to B, so 75% selects B rather than blending 75% from it. The candidate identifies its source and reuses that inference; no model weights are merged. Choosing the same ID for A and B performs one inference and marks the B panel as reused. In development, inspect the server terminal for `[BlendLab inference]` JSON records containing per-request IDs, submitted model IDs, HTTP status, and raw Ollama metrics.

## What is real

Model A and B receive the same prompt sequentially to limit memory pressure. Selecting the same model generates once. Ollama does not merge weights: the candidate reuses A at ratios 0–50%, and B above 50%. Merge algorithm controls are hidden in Ollama mode. Token counts and throughput use Ollama eval_count/eval_duration; latency measures elapsed request time.

Capability Curve aggregates only completed persisted benchmark runs. Pass rates use valid evaluated cases, and latency uses recorded wall-clock durations; these narrow checks do not measure overall intelligence or blend model weights. The Benchmarks and Experiments pages run deterministic checks against discovered Ollama model IDs; run records and named experiment configurations are stored in `.blendlab-data/benchmark-runs.json` and `.blendlab-data/experiments.json`. Experiment history links each configuration to its saved run. Comparisons use only recorded results and identify differing benchmark sets or evaluation settings; missing metrics remain unavailable. Evaluations use exact normalized answers, required code fragments, or an exact JSON object shape, so they are narrow checks rather than subjective quality ratings. Repeating a run creates a new record but does not guarantee identical output from nondeterministic models. Settings are in memory. Alignment guardrails and generation autosave are not implemented. The API binds to loopback and is intended for local use.

## Verification and production

```powershell
npm run lint
npm test
npm run build
npm start
```

Production serves the frontend and API at http://127.0.0.1:8000. Tests use isolated HTTP fixtures for discovery, inference, routing, telemetry, input validation, and errors. For a live test using an already installed model:

```powershell
$env:OLLAMA_TEST_MODEL = 'qwen2.5-coder:7b'
npm run test:live
```

## Graphify context

Install the official graphifyy package. From D:\blend-lab-final run npm run graphify:index to build a local code-only AST graph. No hosted API or model downloads are used. Set GRAPHIFY_BIN in .env if needed; local Hermes installations are auto-detected.

Enable Use Graphify context below the playground prompt. Both models receive identical bounded graph relationships and up to three source excerpts. Expand Graphify evidence used for file/line references, index time, retrieval time, and the context sent to models. Toggle off sends the original prompt unchanged. Missing graphs, failed queries, and no readable matches return explicit errors.

Rebuild after code changes with npm run graphify:index. Selected sources newer than the index are flagged. Increase request timeout in Settings for slower models. Static graph relationships and model citations still need verification. Benchmarks, experiments, and recommendations continue to use their existing execution paths.

Run npm run test:graphify:live for a real local Graphify-to-Ollama smoke test using the first installed model, or set OLLAMA_TEST_MODEL to choose one. It never pulls weights. If Ollama stores models outside its default folder, set OLLAMA_MODELS to the folder containing blobs and manifests before starting ollama serve.


### Explore the code graph

The **Explore code graph** button sits beside **Use Graphify context** in the Playground and opens an interactive map in a new browser tab. The dashboard design stays unchanged.

1. Build or refresh the local graph: `npm run graphify:index`.
2. Start the app with `npm run dev`. Restart it if it was already running before the map endpoint was added.
3. Open the Playground and click **Explore code graph**.
4. Search for a symbol, zoom around the map, and click nodes to inspect their relationships.

The map uses the same `graphify-out/graph.json` as prompt context. Its HTML export is generated on demand and reused until the graph index is newer; source edits still require rebuilding the index. A missing index displays setup instructions.

**The controls are independent:** exploring the map does not enable the checkbox, change the prompt, or invoke Ollama. The checkbox continues supplying repository evidence to model comparisons.

The map is served through `/api/graphify/explore` (normally http://localhost:3000/api/graphify/explore in development). It needs no hosted Graphify account. The native renderer loads vis-network from unpkg.com, so first use requires internet access. Static relationships help explore code; they do not prove runtime behavior.

### Graph node colours

Edit `graphify-colors.json` in the project root. `palette` lists six-digit hex colours in group order; `groupColors` optionally pins a specific community ID, for example `"0": "#45B7D1"`. Reload the map after saving; no index rebuild is needed for colour changes. Nodes and legend are recoloured together, while existing community memberships, names, IDs, and graph relationships remain unchanged. The current code-only, no-cluster index may produce only Community 0, so only its assigned colour appears until Graphify produces additional groups.
