# Parallel — The Decision Simulator

**Compare two choices across the same 10,000 possible futures.**

Parallel is a working relocation-decision prototype. A higher salary can look compelling until rent, moving costs, unemployment and the commute enter the picture. This prototype lets you inspect those trade-offs, change one assumption and ask what would reverse the result.

The first scenario is a move from Manchester to London. Every input is illustrative. There is no live salary, rental-market or personal-account data.

## Run the Python prototype

Requires Python 3.10+ and a modern browser. NumPy is the only Python dependency.

```bash
python -m pip install -r requirements.txt
python -m parallel.server
```

Open **http://127.0.0.1:8000**. The footer will identify **Python / NumPy engine · local API**. All simulations then run in Python; the browser renders the results.

The development server binds to loopback. Deploy behind a suitable application server if adapting it for Internet use.

## Browser demo

The hosted version runs the deterministic JavaScript port in a Web Worker. It does not run Python on the hosting service. The two implementations share a model version, random-number stream, ordering of draws and quantile convention; the automated parity checks compare terminal outcomes path by path.

You can also serve `dist/` with any static web server. There are no CDN dependencies, API keys, model subscriptions, build step or account requirements for the simulation. Browser microphone and speech support varies; the typed version is complete.

## Try this demo

1. Reset the example. Look at the £850 difference in monthly take-home pay.
2. Ask **“Show me the downside.”** Both choices experienced the same economic and personal shocks.
3. Ask **“What would change my mind?”** Inspect the London rent tipping point.
4. Ask **“Lower London rent by £200.”** The planner validates the update and reuses the same seed.
5. Ask **“Value my time at twenty pounds an hour.”** The cash chart remains separate from the time-adjusted comparison.
6. Ask **“Undo.”** Then export the decision run.

The default seed-42 run has a 23.9% London-ahead fraction and an average London cash difference of −£1,593 over 36 months. At £1,450 London rent, those become 94.35% and +£5,825. These are model outputs, not real-world success probabilities. The mean-score rent tipping point is about £1,607/month, not the 50% win-probability threshold.

## Alexa+ track implementation

This is explicitly a **simulated Alexa+ experience**, using the alternate submission path in the hackathon rules. It has a multi-turn, bounded tool planner, scenario state, validation, compare/re-run, downside inspection, tipping-point calculation, undo and an exportable tool trace. The planner is rule-based and supports the advertised commands; it is not a general language model and does not pretend to answer arbitrary questions.

There is **no live Alexa+ integration**, Amazon SDK runtime, MCP server or Bedrock call in this version. No AWS mini-challenge integration is claimed. Microphone input uses browser speech recognition; optional spoken output uses browser speech synthesis. A browser speech service may process voice input according to its own settings; typed commands require neither microphone access nor a speech service.

Official rules and organizer clarification:

- https://amazonappdev2026.devpost.com/rules
- https://amazonappdev2026.devpost.com/forum_topics/45397-what-exactly-are-you-looking-for-in-the-alexa-track

## Verify the model

Node.js is only needed for cross-runtime and planner checks.

```bash
python -m unittest discover -s tests -v
node tests/test_agent.cjs
```

Tests check identical-option symmetry, seed reproducibility, rent and salary monotonicity, the exact mean tipping point, cash/commute separation, buffer monotonicity, regret identities, validation and HTTP handler behavior. Three configurations compare the browser and Python terminal balances and summaries. These checks verify the implementation; they do not validate the illustrative assumptions against real data.

To reproduce the reference run:

```bash
python -m parallel.engine --scenario docs/default-scenario.json --output run.json
```

To reproduce an exported dashboard run, extract its `simulation.scenario` object to a JSON file and pass that path to `--scenario`.

## What is modelled

- Monthly cash flows and a one-off moving cost, over 1–60 months.
- World-level wage growth, inflation and rent growth.
- Shared monthly spending variation, unexpected bills and employment-shock draws.
- Different job-loss hazard thresholds, fixed re-employment duration and 20% fallback pay.
- Pointwise savings quantiles, worst-decile average savings, buffer breaches, paired win fraction, expected regret and the mean-score rent tipping point.
- Optional explicit value of commute time, applied to score rather than cash balances.

See [the model specification](docs/MODEL.md) for equations, distributions and limitations.

## Source map

```text
parallel/engine.py          Python simulation and validation
parallel/server.py          Local HTTP API and dashboard serving
dist/model.js               Browser simulation port
dist/simulation-worker.js   Off-main-thread browser computation
dist/agent.js               Bounded intent-to-tool planner
dist/app.js                 Dashboard, state, voice and exports
docs/PROJECT_STORY.md       Devpost-ready project description
docs/DEMO_GUIDE.md          Two-minute recording script
docs/MODEL.md               Mathematical specification
tests/                     Properties, parity and API checks
```

## Submission status

This repository is a prototype package, not a completed hackathon submission. Before submitting: upload the complete source to GitHub, provide access for judges as required by the rules, record the actual working simulated experience in an English video under three minutes and use the correct track label. A private hosted preview alone does not give judges access. No public GitHub repository or demo-video URL has been created by this package.

Development assistance: OpenAI Codex was used to implement and document this prototype. Describe that assistance accurately if the submission form asks. Do not claim independent manual authorship or external user testing that did not occur.

## License

MIT. See `LICENSE`.
