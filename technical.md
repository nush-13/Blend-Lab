# BlendLab — Project Flow and Agent Handoff

## Purpose and working directory


The central workflow is: **discover installed models → compare prompt responses → run repeatable checks → inspect measured capabilities → ask for an evidence-based recommendation → save and compare experiments**. Graphify adds repository evidence to coding prompts.

This document describes the inspected source, not a fresh runtime certification. The application uses React/Vite/TypeScript with an Express backend and Ollama. FastAPI and SQLite are product intentions, not the current implementation.

## Typical user journey

1. Start Ollama with models already installed, then start BlendLab. The app discovers models and loads saved experiment history.
2. In Playground, select model A and B, enter a prompt, optionally enable Graphify context, and compare their answers and measured inference statistics.
3. In Benchmarks, select models and test cases, start a run, and inspect per-case outputs and evaluations as they are persisted.
4. Open Capability Curve to compare category-level correctness and latency from a completed run. Drill into its underlying cases or open that run in Benchmarks.
5. Open BlendPilot, select a completed run, category, comparison model, preference, and evidence threshold. Get a recommendation supported by that run, or an explicit insufficient-evidence result.
6. Use Experiments to name a configuration, run and save it, reload it for another run, or compare two saved experiments.

## Dashboard features

### Playground — interactive model comparison

- Model cards open a selector containing installed Ollama models. Refresh models reloads discovery; missing models/connection errors are visible.
- Enter a custom prompt or choose a preset for creative/code output, Rust, JSON constraints, or reasoning.
- Switch between two panels (A and candidate) and three panels (A, candidate, B). Answers can be copied.
- Run sends the same prompt and sampling settings to both models, sequentially to reduce memory pressure. Selecting the same ID generates once and marks the second response as reused.
- Panels report actual model IDs, input/output tokens, wall-clock latency, generation duration, total Ollama duration, and throughput when metadata is available. Missing measurements remain N/A. Failure and pending states are separate from successful output.
- The ratio slider is **routing**, not blending: 0–50% selects all of A's response; above 50% selects all of B's. The candidate reuses the selected response and its measurements; it is not a third inference. Merge-method controls are hidden in Ollama mode.
- Demo mode exists explicitly for canned Playground output. Do not confuse it with actual inference or benchmark evidence.
- Prompt/response state is transient; the global Reset currently resets the routing ratio to 40 rather than clearing a conversation.

### Graphify context — repository-grounded coding prompts

The **Use Graphify context** checkbox sits below the Playground prompt. It is supported in Ollama mode. Off means an ordinary prompt. On means the backend queries this project's local graph before inference and gives both models identical evidence plus the user's question.

An expandable evidence panel displays retrieved source excerpts, symbols, file/line references, index timestamp, retrieval duration, truncation, and source-change warnings. It also exposes the graph context sent to the models. Models are asked to cite sources and treat repository text as data, not instructions. These instructions do not guarantee correct answers or citations.

`npm run graphify:index` runs the installed **graphifyy** CLI in code-only mode and writes `graphify-out/graph.json`. Rebuild after code changes; there is no automatic watcher. This uses local AST extraction, not a hosted Graphify account or semantic document/media extraction.

`server/graphify.mjs` invokes the executable using an argument array with a timeout, limits graph text, and adds up to three bounded source excerpts. Reads are restricted to approved project code paths and package.json, with canonical-path checks. The installed Hermes launcher is auto-detected; `GRAPHIFY_BIN` can override it. Missing graphs, failed queries, and no readable matches produce explicit errors rather than silently dropping context.

**Graphify currently augments Playground comparisons only.** Benchmarks, capability aggregation, and BlendPilot do not automatically compare graph-on versus graph-off runs or store Graphify provenance.

### Benchmarks — actual test execution

Users choose one or more discovered models and deterministic test cases, then start a run. The backend supports up to eight distinct model IDs and one active benchmark run per process. It evaluates model/case pairs sequentially; the UI polls saved progress and allows reviewing previous runs.

The current catalog has 11 small cases across code, arithmetic, reasoning, JSON, instruction following, classification, and summarization. Scoring uses normalized answer equality (case-insensitive), required source fragments, or an exact JSON object. Code checks do not compile or execute generated code; the summary check expects a prescribed sentence. These are narrow behavioral checks, not HumanEval, a subjective writing judge, or a general intelligence score.

The Benchmarks page starts runs with temperature 0, top-p 0.9, 128 output tokens, and a 180-second per-inference timeout. These are separate from Playground defaults. A run records model IDs, case IDs, settings, progress, timestamps, outputs, evaluation scores/statuses, failures, and real timing/token metadata. Inference failures are not fabricated zero-quality measurements. A completed run can still contain failed individual cases; inspect counts and errors.

### Capability Curve — measured evidence visualization

Select a completed persisted run and the models to compare. Switch between pass rate by category and median measured wall latency by category. A model/category table provides evaluated counts, passed cases, failure/unavailable counts, and measurement coverage. Inspect cases to see supporting records; **Open run in Benchmarks** navigates to the detailed run.

Pass rate uses valid evaluated results; absent metrics remain unavailable. Model comparisons check case coverage and identify incomplete sets. These are category charts for existing models, not an empirical sweep of merged model weights. The aggregation currently includes finite recorded wall latencies, including those on failed attempts; do not describe them as pure successful-generation speed.

### BlendPilot — recommendations from saved runs

Choose a completed run, benchmark category, comparison model, correctness-first or latency-first preference, and minimum valid evaluation count (default two). The backend summarizes evaluated/pass counts and successful wall-latency samples in that category.

Eligible alternative models must meet the evidence threshold. Correctness-first ranks by pass rate; latency-first ranks by median successful wall latency, with pass rate as a tie-breaker. The result displays its selected model, supporting counts, baseline comparison, and rationale. Missing evidence returns **insufficient_evidence**, not an invented recommendation.

Important limit: it chooses among alternatives to the selected comparison model. It does not guarantee the recommended alternative outperforms that baseline. It is not a weighted workload optimizer, Pareto solver, or merge-configuration generator. Recommendations do not run new inference or tests.

### Experiments — named, repeatable configurations

Enter a name/description, select installed models and benchmark cases, and set generation options. **Run and save experiment** starts a real benchmark run, follows its progress, then saves a named configuration linked to the completed run.

Saved history shows configuration IDs, creation time, model IDs, cases, and associated run status. **Load config** fills the experiment form for a repeat; it does not load a blended model. Deletion removes the saved experiment entry. Comparing two saved experiments uses recorded per-model pass rates, latency, and failure counts; it flags differing case sets or settings as not comparable. Repeating a configuration creates a new run and does not guarantee deterministic model output.

### Settings and shared controls

Settings switches Ollama/demo mode, configures the browser's BlendLab API endpoint, probes real model discovery, and adjusts Playground temperature, top-p, token limit, and timeout. It shows the discovered catalog and known metadata. Configure the actual Ollama host server-side through `OLLAMA_URL`, not the browser endpoint field.

Settings remain in memory. Alignment guardrails and generation autosave are disabled/unimplemented. The sample-count setting does not generate additional benchmark cases. The header provides refresh/error feedback; Guide opens explanatory product information.

## Data flow and persistence

```text
Browser → src/services/api.ts → Express routes → Ollama /api/tags or /api/chat
                               ├─ optional Graphify query → prompt evidence
                               └─ benchmark executor → evaluator → saved run JSON
Saved runs → Capability Curve / BlendPilot / Experiment comparisons
```

- `src/App.tsx` owns navigation, current model selections, settings, model refresh, and experiment history.
- `server/app.mjs` validates API inputs, discovers models, orchestrates inference, runs benchmarks, and exposes experiment/recommendation endpoints. Its shared `inferModel()` normalizes metadata and failures. Development logs identify individual requests and routing provenance.
- `.blendlab-data/benchmark-runs.json` stores run progress/results; `.blendlab-data/experiments.json` stores named configurations linked by runId. Stores serialize writes through temporary files and rename. They are local JSON stores, not a multi-process database.
- Previously running records with no active execution are marked failed when read after a process restart. Browser navigation does not itself cancel backend benchmark execution.
- Playground results, settings, and recommendations are not durable history. Do not promise SQLite, authentication, deployment hardening, or automatic regression alerts.

## Source map for the next agent

| Area | Files |
|---|---|
| Navigation and shared state | `src/App.tsx`, `src/components/Navigation.tsx` |
| Playground and response-state rules | `src/components/Playground.tsx`, `src/services/playgroundState.ts` |
| API boundary and contracts | `src/services/api.ts`, `src/types/index.ts`, `server/app.mjs` |
| Graphify | `server/graphify.mjs`, `scripts/graphify-index.mjs` |
| Benchmark execution/scoring/history | `src/components/BenchmarksRunner.tsx`, `server/benchmarks.mjs`, `server/benchmark-run-store.mjs` |
| Capability aggregation | `src/components/CapabilityCurve.tsx`, `src/services/capabilityMetrics.ts` |
| Recommendation policy | `src/components/BlendPilotEvidence.tsx`, `server/blendpilot.mjs` |
| Experiment form/storage/comparison | `src/components/Experiments.tsx`, `src/services/experimentForm.ts`, `server/experiment-store.mjs`, `server/experiments.mjs` |

## Launch, verification, and continuation rules

```powershell
Set-Location D:\blend-lab-final
npm ci
npm run dev                  # frontend :3000, API :8000
npm run graphify:index       # installed graphifyy required
npm run lint
npm test
npm run build
```

Ollama must already be running with installed chat models; no automatic weight downloads. `.env` supports `OLLAMA_URL` (default localhost:11434), `API_PORT` (8000), and optional `GRAPHIFY_BIN`. Vite proxies API requests to port 8000. `npm start` serves the built frontend/API together on port 8000. Live checks: `npm run test:live` and `npm run test:graphify:live`; these use local inference and can be slow.

Preserve design and working flows. Keep measured data distinct from demo output, missing data, errors, and reused/routed responses. Do not claim real weight merging, comprehensive model capability, automatic regression detection, or Graphify benchmark improvements without implementing and measuring them. Future work can add graph-on/off benchmark provenance, stronger evaluators, explicit regression thresholds, and SQLite persistence incrementally.

## Interactive code-map viewer

### User flow

In Playground, **Explore code graph** appears beside **Use Graphify context**, styled like the existing yellow action buttons. It opens a new tab containing Graphify's native interactive repository map. Users can search, zoom, select nodes, and inspect connections. A missing index shows instructions to run `npm run graphify:index` and reload.

The button and checkbox are independent. Opening the map does not submit a prompt, run model inference, or change context selection. The checkbox continues retrieving bounded repository evidence for both models. Both features use the same local graph, rather than separate or mock graph data.

### Request and export flow

`Playground link → GET /api/graphify/explore → createGraphify().explore() → graphify export html --graph <project>/graphify-out/graph.json → graphify-out/graph.html → browser map`

- `src/components/Playground.tsx`: link placement, existing button styling, new-tab behavior, and noopener/noreferrer.
- `server/app.mjs`: HTML endpoint, no-store response, sandbox policy, and escaped human-readable error page.
- `server/graphify.mjs`: checks index existence, compares index/export modification times, exports only when needed, and reads the resulting HTML. Concurrent export requests share one pending operation. Export has a 60-second timeout; HTML larger than 20 MiB is rejected.
- `server/graphify.test.mjs`: tests export reuse/concurrency, HTML delivery, isolation headers, and missing-index error rendering.

### Operational limits

Rebuild with `npm run graphify:index` after source edits. Opening the viewer refreshes a stale HTML export, but does not re-index source files. Use `GRAPHIFY_BIN` if the installed CLI is not found. Restart the running development server after backend changes. The standard development URL uses port 3000; production serves the route on port 8000. Port 8001 was only an isolated verification instance, not the configured default.

Generated HTML runs under a sandbox Content Security Policy without same-origin permission, isolating its scripts from the app origin. The native renderer loads vis-network from unpkg.com, so initial rendering requires internet access even though graph extraction and prompt retrieval are local. No hosted Graphify account or Ollama generation is required to explore the map.

Verification for this addition: TypeScript checks, 44 backend tests plus 15 service tests, and the production build passed. A live HTTP check returned the generated interactive HTML with its renderer, search code, nodes, and isolation headers. Visual browser interaction was not verified in this side conversation.

### Graph node colours

Edit `graphify-colors.json` in the project root. `palette` lists six-digit hex colours in group order; `groupColors` optionally pins a specific community ID, for example `"0": "#45B7D1"`. Reload the map after saving; no index rebuild is needed for colour changes. Nodes and legend are recoloured together, while existing community memberships, names, IDs, and graph relationships remain unchanged. The current code-only, no-cluster index may produce only Community 0, so only its assigned colour appears until Graphify produces additional groups.
