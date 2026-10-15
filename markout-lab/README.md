# MARKOUT LAB

### A market microstructure research terminal

**[Launch the interactive research app](https://toby822.github.io/parallel-decision-simulator/markout-lab/)**

Markout Lab is a browser-based, event-driven synthetic market-making simulator. It evaluates **fixed-spread, inventory-skewed and observed-flow-aware quoting** on the same market tapes, then shows how spread capture can be offset by adverse selection and inventory losses.

It was designed as an **investigable experiment**, not a market-data dashboard or an invented profitable trading strategy. The main question is: *why can a market maker collect positive quoted spreads and still lose money?*

## What you can investigate

- Three strategies, identical pre-generated event shocks across each paired comparison.
- Dynamic terminal P&L, inventory risk, 95% confidence interval for sample mean and worst 5% tail diagnostic.
- Exact mark-to-market attribution: **spread capture + inventory P&L − fees = net P&L**.
- Signed post-fill markout at 1, 5, 20 and 50-event horizons.
- Illustrative synthetic depth ladder and a transparent simulated fill tape.
- Latency vs order-flow toxicity stress heatmap.
- Adjustable seed, path count, horizon, spread, volatility, latency and inventory penalties.
- JSON export of the entire run and CSV export of the strategy comparison.

## Reproduce locally

No Python package, API key, market-data account or backend is required for the public App:

```bash
git clone https://github.com/Toby822/parallel-decision-simulator.git
cd parallel-decision-simulator
python -m http.server 8080 --directory markout-lab
```

Open `http://127.0.0.1:8080`. Any static HTTP server works. The simulation runs locally in your browser using JavaScript; all data is synthetic.

## Verify

Requires Node.js:

```bash
node --check markout-lab/sim.js
node --check markout-lab/app.js
node markout-lab/tests/test-sim.cjs
```

GitHub Actions runs these checks on updates, along with the existing Parallel regression suite.

## Model principles

1. **No invented empirical claims.** Every output is conditional on illustrative model assumptions.
2. **No future information.** Flow-aware quoting uses lagged observed flow, not latent state or future events.
3. **Paired experiments.** Strategies run against the same synthetic events, reducing avoidable comparison noise.
4. **Auditable P&L.** Every payoff is reconciled to a cash-plus-inventory mark-to-market identity.
5. **Clear limits.** Fill probability is a transparent queue proxy, not a reconstructed exchange matching engine.

See the [full research methodology](research/METHODS.md) for stochastic dynamics, fill approximation, accounting identities, parameter ranges and limitations.

## Scope

This is an educational quantitative research prototype, not trading advice, a live exchange feed, a profitable trading system, a production market-making engine, or an estimate of real trading returns.

## Technology

JavaScript (pure deterministic simulation), HTML, CSS, SVG, Node.js automated tests and GitHub Actions/Pages. No proprietary feeds or external JavaScript frameworks. Fonts use Google Fonts where available, with local system fallbacks.

MIT license via the repository root.
