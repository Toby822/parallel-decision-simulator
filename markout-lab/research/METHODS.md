# Markout Lab — research methodology

**Research status:** Synthetic, experimental simulation. Not calibrated to an instrument, trading venue or production execution system.

## Hypothesis

Can an inventory-aware and observed-flow-aware quoting policy improve terminal marked P&L relative to a fixed-spread baseline when order flow may be informed?

This hypothesis is tested under a family of synthetic markets; positive results under one parameterisation are not empirical market alpha.

## Market tape

Each of N independently seeded paths has T events. An AR(1) latent state z evolves as

```
z[t] = 0.94 z[t-1] + 0.34 epsilon[t]
P(aggressive buy | z[t]) = sigmoid(1.4 z[t])
```

A market-order event occurs with parameter `arrivalRate`. Mid-price (USD per unit) then changes by

```
m[t+1] = max(2*tick, m[t]
           + tick * (sigma * epsilon_price[t]
           + 0.8 * toxicity * z[t]
           + 0.38 * toxicity * direction[t] * I[event]))
```

Independent pseudorandom innovations drive latent state, noise, arrivals, aggressor side and simulated fills. All strategies see the **same pre-generated tape**. Paths are independent; within a path, ticks and order-flow signs are not identically distributed due to serial dependence.

The latent state is deliberately hidden from the strategies. The flow-aware strategy uses only **previously observed market-order directions**. After processing event t, the public signal is updated:

```
signal = 0.88 * signal + 0.12 * observed_direction   (when an event occurred)
signal = 0.985 * signal                              (otherwise)
```

An event t fill is evaluated using signal from times strictly earlier than t. The shared-price process is exogenous: trades by our simulator do not impact prices. This simplifies paired comparisons but limits realism.

## Quoting and fill approximation

At each event, the quoting reference is the prior simulated mid (delayed by `floor(latency_ms/40)` events). The mapping from milliseconds to event count is **illustrative**; event timestamps are not generated from a calibrated market clock.

Baseline half-spread: `halfSpreadTicks * tick`. Strategies:

- **Fixed spread:** centre = delayed mid.
- **Inventory skew:** centre = delayed mid − riskAversion × inventory / inventoryLimit × 3.2 ticks.
- **Flow-aware:** same inventory skew plus `signal * toxicity * 3.2 ticks`; half-spread widens as `0.9 * abs(signal) * toxicity` ticks.

Aggressive buys may lift the maker's ask (maker sells one unit); aggressive sells may hit the bid (maker buys one unit). A Bernoulli proxy determines fill probability from quote distance, a queue competition penalty and latency. The Bernoulli uniform is shared, but fill/no-fill outcomes can differ across policies because quotes differ. Orders cannot breach the absolute inventory cap. Fees are charged per executed unit.

This is **not** a full matching engine. There is no queue-position reconstruction, order book event replay, priority matching, partial size fills, market impact, cancellation modelling or venue-specific routing. The displayed depth ladder is illustrative and is not input to the fill model.

## Accounting

Let q be signed maker position change: +1 on bid fill, −1 on ask fill. For fill price p and mid m before the next move:

```
spread_capture += q * (m - p)
fees += fee_per_fill
cash -= q * p + fee_per_fill
inventory += q
inventory_PnL += inventory * (m_next - m)
equity = cash + inventory * m_next
```

Consequently the accounting identity (up to floating-point rounding) is

```
terminal_marked_PnL = spread_capture + inventory_PnL - fees
```

Spread capture can appear positive even when adverse selection and inventory price exposure drive negative total P&L. Signed post-fill markout at horizon h is `q * (m[t+h] - m[t])`, averaged within path then across paths with at least one eligible fill. **It is not an additional P&L debit** and should not be subtracted again.

## Statistical summaries

For each policy, N paths produce terminal P&Ls. We report their arithmetic mean, median, empirical 5% and 95% quantiles, approximate 95% confidence interval `mean ± 1.96*sample_sd/sqrt(N)`, fraction positive and the mean of terminal outcomes at/below the 5th sample quantile (CVaR-style diagnostic). For the incremental observed-flow policy, the app additionally reports a **paired 95% interval** computed from the per-path (flow-aware terminal P&L − inventory-skew terminal P&L), preserving the shared-shocks design. With N=32 this extreme-tail estimate is especially noisy. There is no claimed Sharpe ratio, because no real trading-day time scale, funding rate or independent daily return series has been established.

Risk reports also include maximum absolute inventory and peak-to-trough marked-equity drawdown. Stress heatmap compares the flow-aware mean to the inventory-skew mean (isolating the incremental observed-flow rule) at each toxicity/latency combination using identical tapes for that comparison, but a smaller sample (up to 10 paths and 400 events) for speed. Treat it as a **diagnostic**, not statistical proof of robustness.

## Validation and known limitations

Run `node markout-lab/tests/test-sim.cjs` for seed reproducibility, invariants, input validation, pairwise consistency, causal event-order check and HTML DOM ID checks. JavaScript syntax is independently checked in GitHub Actions.

Parameters, including fee and information-state persistence, are chosen to expose mechanisms, not estimated from market data. Our simulations omit queue timestamps, realistic trade volumes, volatility clustering, cross-asset responses, exchange fee tiers, hedging, funding, margin and model risk. Next research milestones: calibrate the fill proxy against a public historical L2 event dataset; split calibrations chronologically; audit sensitivity to alternative order-flow and price-impact dynamics; and test alternative latency distributions.

## Scientific interpretation

The app is deliberately designed to show losses. A model run that loses money is informative when it exposes which mechanism caused the loss. Do not interpret a positive relative P&L in the default seed as an investable edge.
