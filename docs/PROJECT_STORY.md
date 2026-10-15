## Inspiration

An extra £850 a month sounds like a good reason to take a job. Then you look at the rent, the moving costs and the extra time on the train.

I study mathematics and statistics, and I wanted to bring that way of thinking to a decision people actually face. A budget spreadsheet gives you one answer for one set of numbers. I wanted to see what happens when those numbers stop behaving as expected.

That became Parallel: a way to put two choices through the same possible futures before committing to one.

## What it does

The prototype compares staying in Manchester with taking a job in London. It runs 10,000 paired simulations over three years, including changes in income, living costs, rent and employment.

Both choices face the same shocks. If a simulated world has higher inflation or an unexpected bill, both options experience it. This makes it easier to see what the choice itself changes.

The dashboard shows savings ranges, the average outcome in the worst 10% of worlds, the chance of crossing an emergency buffer and expected regret: how much an option falls behind the better choice in hindsight.

The most useful output is a question you can act on. Instead of stopping at “London looks worse,” Parallel calculates the rent at which the average comparison changes. You can ask, “What if I find somewhere £200 cheaper?” and watch the same futures run again.

## The Alexa+ experience

The simulated Alexa+ interface lets you talk through the decision over several turns. You can inspect the downside, change rent or take-home pay, put a value on commute time and undo a change. The chart updates alongside the conversation.

Every answer comes from the simulation results. The planner has a deliberately bounded set of tools, and its last action is visible. It does not invent probabilities or pretend to understand a question it cannot handle.

This is a simulated Alexa+ experience, not a live Alexa+ integration. Typed commands work throughout, with browser voice input and spoken responses where supported.

## How it was built

The calculation engine uses Python and NumPy. A local API connects it to the dashboard. The hosted demo uses a JavaScript port in a Web Worker, so it can run without an account or API key. Automated checks compare the two engines path by path using the same seed.

The interface keeps cash outcomes separate from preferences. Valuing an hour of commuting can change the comparison, but it does not quietly change the savings shown in the chart. Runs can be exported with their assumptions, seed, results and tool history.

## Challenges and what I learned

The hardest part was deciding what a comparison should mean. Comparing two median savings figures misses what happens to both choices in the same world. Expected regret needs that paired comparison.

Another challenge was keeping precision honest. Running more simulations reduces simulation noise; it does not make an assumed job-loss rate more trustworthy. The model exposes its assumptions and separates Monte Carlo error from uncertainty about real life.

## What I am proud of

There is a visible, reproducible change in the demo: reducing London rent by £200 reverses the average financial comparison. You can inspect the input, follow the tool call, see the chart update and export the run. The conversation has a calculation behind it.

## What's next

The next step is testing whether people understand the outputs, especially the difference between a conditional scenario and a forecast. I would then add alternative shock-dependence assumptions and let users compare evidence-backed estimates with their own ranges. A live Alexa+ integration is a later step when access is available.
