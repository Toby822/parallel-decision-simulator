'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../sim.js');
const s=Engine.defaults();
const r=Engine.evaluate(s),again=Engine.evaluate(s);
assert.deepEqual(r,again,'same seed should reproduce complete simulation');
assert.equal(r.strategies.length,3);
assert.equal(r.params.paths,32);
assert.equal(r.params.steps,720);
assert.equal(r.detail.ladder.length,13);
assert.ok(Number.isFinite(r.summary.pairedFlowVsInventory.mean));
assert.ok(r.summary.pairedFlowVsInventory.ci95[0]<=r.summary.pairedFlowVsInventory.mean);
assert.ok(r.summary.pairedFlowVsInventory.ci95[1]>=r.summary.pairedFlowVsInventory.mean);
assert.ok(Math.abs(r.summary.pairedFlowVsInventory.mean-(r.strategies[2].mean-r.strategies[1].mean))<1e-9);
assert.ok(r.detail.records.length>0);
for(const st of r.strategies){
 assert.ok(Number.isFinite(st.mean),'finite P&L');
 assert.ok(Math.abs(st.mean-(st.spread+st.carry-st.fees))<1e-8,'accounting identity');
 assert.equal(st.traces.length,s.steps+1);
 assert.equal(st.inventory.length,s.steps+1);
 assert.equal(st.terminals.length,s.paths);
 assert.equal(st.traces[0],0);
 assert.ok(st.ci95[0]<=st.mean && st.ci95[1]>=st.mean);
 assert.ok(st.p05<=st.median && st.median<=st.p95);
 assert.equal(st.markouts.length,4);
 assert.ok(st.fills>0 && st.maxInv<=s.inventoryLimit);
}
assert.notDeepEqual(Engine.evaluate({...s,seed:42}).strategies[0].terminals,r.strategies[0].terminals,'different seeds vary paths');
for(const k of ['paths','steps','mid','tick','halfSpread','volatility','toxicity','latency','arrivalRate','inventoryLimit','riskAversion','feePerFill']){const x={...s};x[k]=NaN;assert.throws(()=>Engine.validate(x),k);}
for(const [k,v] of [['paths',0],['steps',0],['inventoryLimit',0],['toxicity',1.2],['latency',-10],['seed',-1],['seed',1.3]]){assert.throws(()=>Engine.validate({...s,[k]:v}),k+' invalid');}
const stress=Engine.stress(s);assert.equal(stress.cells.length,5);assert.ok(stress.cells.every(row=>row.length===5&&row.every(Number.isFinite)));
const small={...s,paths:8,steps:200},market=Engine.tape(small,0);
const all=['fixed','inventory','flow'].map(x=>Engine.simulateStrategy(small,market,x,true));
assert.ok(all.every(x=>x.eq.length===small.steps+1));
assert.deepEqual(market.mid,Engine.tape(small,0).mid,'identical shared shock tape');
// Future shock edits cannot alter earlier fills or trading decisions.
const altered={...market,events:market.events.map(x=>({...x})),mid:market.mid.slice()};
for(let t=130;t<small.steps;t++){altered.events[t].active=false;}
const original=Engine.simulateStrategy(small,market,'flow',true);
const changed=Engine.simulateStrategy(small,altered,'flow',true);
assert.deepEqual(original.records.filter(x=>x.t<130),changed.records.filter(x=>x.t<130),'no future-event lookahead');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const ids=[...app.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
for(const id of new Set(ids)){if(!html.includes('id="'+id+'"'))throw new Error('Missing HTML id: '+id);}
console.log('MARKOUT LAB PASS — reproducibility, paired tapes, P&L identity, risk, no lookahead, inputs, DOM integrity and stress surface.');