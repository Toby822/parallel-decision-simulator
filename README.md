# Parallel — The Decision Simulator

**One decision. Ten thousand possible futures.**

Parallel is a Monte Carlo decision-analysis project built in Python and JavaScript. It compares two choices under the **same simulated economic and personal shocks**, so the results show how the decision changes an outcome—not just how two unrelated forecasts differ.

The worked example asks: *Is a higher-paid job in London worth leaving Manchester once rent, uncertainty and commuting are included?* All numbers are illustrative, and you can change the assumptions.

**[Explore the interactive demo](https://parallel-decision-lab.cleverbloom16.chatgpt.site/)** · [Model specification](docs/MODEL.md) · [Validation notes](docs/VALIDATION.md)

> The linked hosted demo may have access restrictions. You can run the browser interface locally using the instructions below.

## What it does

- **Paired Monte Carlo simulation:** 10,000 hypothetical paths over 36 months by default, using common random numbers for both options.
- **Financial trade-offs:** income, rent, cost inflation, unexpected bills, moving expenses and periods without full pay.
- **Risk, not just averages:** savings distributions, worst-decile outcomes, emergency-buffer breaches, probability one option finishes ahead, and expected regret.
- **Break-even analysis:** calculates the London rent at which mean modelled outcomes tie, with other assumptions held constant.
- **Scenario testing:** change a salary, reduce rent or price your commute time; cash savings and time-adjusted scores stay separate.
- **Interactive dashboard:** inspect individual simulated worlds and export the scenario, random seed and results.
- **Guided voice/text interface:** multi-turn, rule-based what-if commands with optional browser speech input/output. This is a *local simulated assistant*, not a live Alexa integration or an LLM.

### Reference scenario

Under the bundled assumptions, seed 42, 10,000 paths and 36 months:

| Change | London ahead in simulated paths | Mean London cash difference |
| --- | ---: | ---: |
| Original London rent: £1,650/month | 23.90% | −£1,593 |
| Reduce London rent to £1,450/month | 94.35% | +£5,825 |

The mean-difference break-even London rent is approximately **£1,607/month**. These figures describe outcomes **conditional on the model inputs**, not empirically estimated chances of success. A break-even mean is not the same as a 50% win probability.

## Run it yourself

Requires **Python 3.10+**. For the Python/NumPy-backed web interface:

```bash
git clone https://github.com/Toby822/parallel-decision-simulator.git
cd parallel-decision-simulator
python -m pip install -r requirements.txt
python -m parallel.server
```

Open **http://127.0.0.1:8000** in your browser. This local server exposes a `/api/simulate` endpoint and serves the dashboard. It binds to localhost; do not expose this development server directly to the public internet.

To run just the browser implementation (no Python server needed after downloading):

```bash
python -m http.server 8080 --directory dist
```

Open **http://127.0.0.1:8080**. In this mode, the computations run in a JavaScript Web Worker. Voice recognition depends on browser support; typed commands work without it. Both implementations are designed to use matching simulated random draws.

### Try a what-if

1. Start with the sample Manchester/London comparison.
2. Ask **“Show me the downside.”** Then ask **“What would change my mind?”**
3. Ask **“Lower London rent by £200.”** Inspect the updated savings chart and rent threshold.
4. Ask **“Value my time at twenty pounds an hour.”** Notice that the *cash* chart does not change.
5. Ask **“Undo”** or export the run to inspect its assumptions.

## Test and reproduce

Requires **Node.js** as well as Python for the browser parity/planner checks:

```bash
python -m unittest discover -s tests -v
node tests/test_agent.cjs
```

The tests exercise reproducible seeding, identical-option symmetry, input validation, monotonicity, regret identities, cash-versus-time separation, HTTP handlers and **Python/JavaScript numerical parity** across multiple scenarios.

Generate a scenario run as JSON:

```bash
python -m parallel.engine --scenario docs/default-scenario.json --output run.json
```

## How it works

```text
parallel/
  engine.py          Python simulation, statistics and input validation
  server.py          Local HTTP API + static file server

dist/
  index.html         Interactive browser dashboard
  model.js           Matching JavaScript simulation
  simulation-worker.js
  agent.js           Bounded natural-language command parser
  app.js             Chart rendering, state, export and voice controls
  style.css

tests/                Model properties, API, agent and parity tests
docs/MODEL.md         Assumptions, distributions and mathematical definitions
docs/VALIDATION.md    Reference values and validation approach
```

The important modelling choice is **coupling both options within each simulated world**. A shared inflation spike, unexpected bill or employment shock is drawn once and applied to both alternatives. That makes the paired difference informative and reduces unnecessary comparison noise—but it is a modelling assumption, not evidence that two careers share identical risks.

## Limitations and next steps

Parallel is a research/portfolio prototype, **not financial or career advice**. It uses illustrative assumptions rather than calibrated labour-market data. It does not model tax, investment returns, promotions, household changes, personal wellbeing, or long-term career option value. A larger simulation sample reduces Monte Carlo sampling error; it does not validate those assumptions.

Future work: calibrate cost and employment distributions using real data, vary the dependence between options and add out-of-sample sensitivity studies.

## License

MIT — see [LICENSE](LICENSE).

Development note: the project was built with assistance from OpenAI coding tools.
