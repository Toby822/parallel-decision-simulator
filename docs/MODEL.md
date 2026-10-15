# Model specification — parallel-1.0

All example inputs are invented for demonstration. This is a conditional cash-flow simulation and a stated-preference comparison. It is not a calibrated model of Manchester, London, unemployment or career outcomes.

## State and cash flows

For option i and world w:

`S[i,w,0] = initial_savings - moving_cost[i]`

`S[i,w,m] = S[i,w,m-1] + net_income[i] * wage_multiplier[i,w,m] - rent[i] * rent_multiplier[w,m] - (living_costs[i] * spending_multiplier[w,m] + commute_cost[i]) * inflation_multiplier[w,m] - surprise_bill[w,m]`

The initial moving cost is paid before month 1. A buffer breach occurs if the balance is strictly below the user’s buffer at **any** observed time, including immediately after moving. A negative balance represents an unfinanced shortfall; interest and borrowing constraints are not modelled.

`year = floor((m-1)/12)`; pay and rent change on the next annual anniversary. Non-rent living and transport costs inflate smoothly using `(1+inflation[w])^((m-1)/12)`.

## Random inputs

| Quantity | Distribution and timing |
| --- | --- |
| Shared wage-growth deviation | Normal(0, 0.025), once per world |
| Inflation | User mean + Normal(0, 0.015), clipped to [−0.05, 0.20], once per world |
| Annual rent growth | World inflation + Normal(0, 0.025), clipped to [−0.10, 0.20], once per world |
| Monthly living-cost multiplier | Lognormal with log SD = user cost volatility; log mean = −0.5 × SD², so its mean is 1 |
| Employment shock | A shared Uniform(0,1) draw each month; option-specific monthly hazard `1 - (1 - annual_risk)^(1/12)` |
| Unexpected bill | 3% probability per month; bill size Uniform(£300, £1,500) |

If employed and the shock is below the option’s hazard, unemployment starts in that month. Income is 20% of the otherwise applicable wage for `recovery_months` consecutive months. The option then becomes employed again and can experience another spell. Recovery duration and fallback income are assumptions, not policy estimates. Annual risk is the at-least-one-shock probability over twelve susceptible months; unemployment spells reduce time susceptible to another shock.

The wage multiplier is `max(0.5, 1 + assumed_growth[i] + world_growth_deviation)^year`, multiplied by the employed/fallback pay fraction. There are no wage cuts from job transitions beyond fallback months.

## Coupling choices across worlds

This prototype uses common random numbers for both options, including shared personal shocks. Macro conditions and monthly uniforms are identical; exposure and thresholds vary by option. This is a strong dependence assumption about counterfactual outcomes, not empirical evidence that two employers have identical risk. In particular, paired win probabilities and regret depend on the joint distribution. They should be stress-tested against alternative dependence structures before real use.

The implementation draws world-level wage, inflation and rent normals first, then a spending normal, job uniform, bill-occurrence uniform and bill-size uniform for each month. Changing an input without changing seed, path count or horizon retains the draw alignment. Changing the horizon changes how subsequent worlds consume the random stream; do not interpret world indices as the same worlds across different horizons.

## Outputs

**Cash:** terminal savings and pointwise 10th/50th/90th percentiles.

**Optional score:** `cash - commute_hours_per_month × months × time_value_per_hour`. The commute preference is deterministic and has no effect on cash paths.

**Paired difference:** `D[w] = score[B,w] - score[A,w]`. Positive means London scores higher.

**London ahead fraction:** empirical `P(D > 1e-8)`. Absolute differences ≤ 1e-8 are ties, reported separately. An identical pair has 100% ties, not a forced 50/50 result.

**Expected regret:** `mean(max(score[A,w], score[B,w]) - score[i,w])`. The difference in regrets equals the opposite difference in mean scores. The lower regret belongs to the option with the higher mean score; it is an explanation of the mean objective, not an independent voting criterion.

**Worst-decile mean:** mean of the lowest `floor(paths/10)` terminal cash balances. It is distinct from the 10th percentile cutoff.

**Rent tipping point:** because rent enters linearly and does not affect any shock probabilities, let `C[w] = sum_m rent_multiplier[w,m]`. The London base rent at mean-score equality is `current_rent_B + mean(D)/mean(C)`. This holds other inputs fixed and uses the same paths. The value need not produce a 50% ahead fraction. A negative threshold means no non-negative base rent achieves equality under the remaining assumptions.

**Simulation noise:** sample SD(D)/sqrt(paths) for the standard error of the mean paired difference; Wilson 95% interval for the ahead fraction. Neither captures input-estimation error or model error.

**Perfect-information bound:** `mean(max(score_A,score_B)) - max(mean(score_A),mean(score_B))`. Exported for inspection only; it is an upper bound on all-future information under the model, not the value of obtaining a rent quote or the recommended price of advice.

## Reproducibility

RNG: xorshift32, unsigned 32-bit state. Seed zero maps to 0xA341316C. Uniform output `(state + 0.5) / 2^32`. Normals use the cosine branch of Box–Muller with two fresh uniforms per call. This lightweight generator is reproducible across runtimes; it is not cryptographic and has not been independently certified for production simulation.

Python uses NumPy’s default linear quantile interpolation. JavaScript reproduces this convention. Floating-point arithmetic may differ at the last few bits; parity tests use an absolute tolerance of 1e-7 GBP for individual terminal values.

## Unmodelled factors

No live data, tax calculation, asset returns, cash interest, debt costs, job-search costs, promotion process, household change, geographic wellbeing, social ties or long-term career option value. Costs are nominal. The horizon is finite and there is no terminal value assigned to career progression. These omissions limit any real decision inferred from this prototype.
