"""Two options, one set of worlds.

All probabilities are conditional on user assumptions, not population estimates.
The tiny explicit RNG makes the Python engine and browser port reproducible.
"""

from __future__ import annotations

import copy
import math
from typing import Any

import numpy as np

MODEL_VERSION = "parallel-1.0"


def default_scenario() -> dict[str, Any]:
    return {
        "months": 36, "paths": 10000, "seed": 42,
        "savings": 12000, "buffer": 5000, "inflation": 0.03,
        "cost_volatility": 0.12, "time_value": 0,
        "options": [
            {"name": "Stay in Manchester", "income": 2900, "rent": 900,
             "costs": 850, "commute_cost": 100, "commute_hours": 16,
             "moving_cost": 0, "growth": 0.035, "job_loss": 0.06,
             "recovery_months": 3},
            {"name": "Take the London offer", "income": 3750, "rent": 1650,
             "costs": 900, "commute_cost": 180, "commute_hours": 32,
             "moving_cost": 2400, "growth": 0.055, "job_loss": 0.08,
             "recovery_months": 3},
        ],
    }


def validate(s: dict[str, Any]) -> None:
    def number(value, low, high, name, integer=False):
        if isinstance(value, bool) or not isinstance(value, (float, int)):
            raise ValueError(f"{name} must be a number")
        if not math.isfinite(value) or not low <= value <= high:
            raise ValueError(f"{name} must be between {low} and {high}")
        if integer and int(value) != value:
            raise ValueError(f"{name} must be an integer")

    if not isinstance(s, dict):
        raise ValueError("Scenario must be an object")
    number(s.get("months"), 1, 60, "months", True)
    number(s.get("paths"), 100, 20000, "paths", True)
    number(s.get("seed"), 0, 4294967295, "seed", True)
    for key, low, high in [
        ("savings", 0, 1000000), ("buffer", 0, 1000000),
        ("inflation", -0.05, 0.2), ("cost_volatility", 0, 0.5),
        ("time_value", 0, 100),
    ]:
        number(s.get(key), low, high, key)
    options = s.get("options")
    if not isinstance(options, list) or len(options) != 2:
        raise ValueError("Exactly two options are required")
    for i, o in enumerate(options):
        if not isinstance(o, dict) or not isinstance(o.get("name"), str) or not 1 <= len(o["name"]) <= 80:
            raise ValueError("Each option needs a name of 1–80 characters")
        for k, lo, hi in [
            ("income", 0, 50000), ("rent", 0, 20000), ("costs", 0, 20000),
            ("commute_cost", 0, 5000), ("commute_hours", 0, 200),
            ("moving_cost", 0, 100000), ("growth", -0.2, 0.3),
            ("job_loss", 0, 0.8), ("recovery_months", 1, 24),
        ]:
            number(o.get(k), lo, hi, f"option {i}: {k}", k == "recovery_months")


class RNG:
    def __init__(self, seed: int):
        self.state = int(seed) or 0xA341316C

    def uniform(self) -> float:
        x = self.state
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.state = x & 0xFFFFFFFF
        return (self.state + 0.5) / 4294967296

    def normal(self) -> float:
        return math.sqrt(-2 * math.log(self.uniform())) * math.cos(2 * math.pi * self.uniform())


def _wilson(successes: int, n: int) -> list[float]:
    p, z = successes / n, 1.959963984540054
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [max(0, c - half), min(1, c + half)]


def simulate(scenario: dict[str, Any] | None = None, *, include_samples: bool = True) -> dict[str, Any]:
    s = copy.deepcopy(scenario if scenario is not None else default_scenario())
    validate(s)
    n, months = int(s["paths"]), int(s["months"])
    rng = RNG(s["seed"])
    paths = np.empty((2, n, months + 1), dtype=float)
    mins = np.empty((2, n), dtype=float)
    rent_coeff = np.zeros(n)
    income_coeff = np.zeros((2, n))
    options = s["options"]
    hazard = [1 - (1 - o["job_loss"]) ** (1 / 12) for o in options]
    for w in range(n):
        economy = 0.025 * rng.normal()
        inflation = max(-0.05, min(0.2, s["inflation"] + 0.015 * rng.normal()))
        rent_growth = max(-0.1, min(0.2, inflation + 0.025 * rng.normal()))
        balances = [s["savings"] - o["moving_cost"] for o in options]
        low = balances.copy()
        downtime = [0, 0]
        for i in range(2):
            paths[i, w, 0] = balances[i]
        for m in range(1, months + 1):
            spending = math.exp(s["cost_volatility"] * rng.normal() - 0.5 * s["cost_volatility"] ** 2)
            job_u, bill_u, bill_size = rng.uniform(), rng.uniform(), rng.uniform()
            surprise = (300 + 1200 * bill_size) if bill_u < 0.03 else 0
            year = (m - 1) // 12
            rent_mult = (1 + rent_growth) ** year
            inflation_mult = (1 + inflation) ** ((m - 1) / 12)
            rent_coeff[w] += rent_mult
            for i, o in enumerate(options):
                if downtime[i] == 0 and job_u < hazard[i]:
                    downtime[i] = o["recovery_months"]
                paid = 0.2 if downtime[i] > 0 else 1
                if downtime[i] > 0:
                    downtime[i] -= 1
                wage_mult = max(0.5, 1 + o["growth"] + economy) ** year * paid
                income_coeff[i, w] += wage_mult
                balances[i] += o["income"] * wage_mult - o["rent"] * rent_mult - (
                    o["costs"] * spending + o["commute_cost"]
                ) * inflation_mult - surprise
                low[i] = min(low[i], balances[i])
                paths[i, w, m] = balances[i]
        mins[:, w] = low

    end = paths[:, :, -1]
    time_cost = np.array([o["commute_hours"] * months * s["time_value"] for o in options])
    score = end - time_cost[:, None]
    delta = score[1] - score[0]
    cash_delta = end[1] - end[0]
    best = np.maximum(score[0], score[1])
    regret = best[None, :] - score
    summaries = []
    for i, o in enumerate(options):
        p10, median, p90 = np.quantile(end[i], [0.1, 0.5, 0.9]).tolist()
        summaries.append({
            "name": o["name"], "mean": float(end[i].mean()), "median": median,
            "p10": p10, "p90": p90,
            "worst_decile_mean": float(np.sort(end[i])[:max(1, n // 10)].mean()),
            "buffer_breach": float(np.mean(mins[i] < s["buffer"])),
            "expected_regret": float(regret[i].mean()),
            "commute_hours": o["commute_hours"] * months,
            "time_adjusted_mean": float(score[i].mean()),
            "timeline": np.quantile(paths[i], [0.1, 0.5, 0.9], axis=0).T.tolist(),
        })
    mean_delta = float(delta.mean())
    threshold = options[1]["rent"] + mean_delta / float(rent_coeff.mean())
    # EVPI for the already-modelled path outcome: an upper bound on the
    # value of all future information, not the price of a rental quote.
    evpi = float(best.mean() - max(score[0].mean(), score[1].mean()))
    successes = int(np.sum(delta > 1e-8))
    ties = int(np.sum(np.abs(delta) <= 1e-8))
    counts, edges = np.histogram(delta, bins=32)
    result = {
        "model_version": MODEL_VERSION, "scenario": s, "options": summaries,
        "comparison": {
            "probability_b_ahead": successes / n, "ties": ties / n,
            "probability_interval": _wilson(successes, n),
            "mean_difference": mean_delta, "median_difference": float(np.median(delta)),
            "cash_mean_difference": float(cash_delta.mean()),
            "difference_p10": float(np.quantile(delta, 0.1)),
            "difference_p90": float(np.quantile(delta, 0.9)),
            "monte_carlo_se": float(delta.std(ddof=1) / math.sqrt(n)),
            "preferred": 1 if mean_delta > 1e-8 else (0 if mean_delta < -1e-8 else -1),
            "break_even_rent_b": threshold,
            "rent_change_per_100": float(rent_coeff.mean() * 100),
            "income_b_change_per_100": float(income_coeff[1].mean() * 100),
            "perfect_information_upper_bound": evpi,
            "histogram": {"counts": counts.tolist(), "edges": edges.tolist()},
        },
    }
    if include_samples:
        chosen = np.linspace(0, n - 1, 101, dtype=int)
        result["worlds"] = [{"index": int(w), "a": paths[0, w].tolist(), "b": paths[1, w].tolist()} for w in chosen]
        result["terminal"] = {"a": end[0].tolist(), "b": end[1].tolist()}
    return result


if __name__ == "__main__":
    import argparse
    import json
    from pathlib import Path

    parser = argparse.ArgumentParser(description="Reproduce a Parallel decision run")
    parser.add_argument("--scenario", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    config = json.loads(args.scenario.read_text()) if args.scenario else default_scenario()
    output = simulate(config)
    encoded = json.dumps(output, indent=2, allow_nan=False)
    if args.output:
        args.output.write_text(encoded + "\n")
    else:
        print(encoded)
