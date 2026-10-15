/* The browser port of parallel/engine.py. Deterministic by design.
   Node/Python parity is checked in tests/test_parity.py. */
(function(root) {
  'use strict';
  const VERSION = 'parallel-1.0';
  const clone = x => JSON.parse(JSON.stringify(x));
  function defaults() { return {
    months:36, paths:10000, seed:42, savings:12000, buffer:5000,
    inflation:0.03, cost_volatility:0.12, time_value:0,
    options:[
      {name:'Stay in Manchester',income:2900,rent:900,costs:850,commute_cost:100,commute_hours:16,moving_cost:0,growth:0.035,job_loss:0.06,recovery_months:3},
      {name:'Take the London offer',income:3750,rent:1650,costs:900,commute_cost:180,commute_hours:32,moving_cost:2400,growth:0.055,job_loss:0.08,recovery_months:3}
    ]}; }
  function validate(s) {
    const num=(x,lo,hi,name,int=false)=>{
      if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi||(int&&!Number.isInteger(x))) throw Error(`${name} must be ${int?'an integer':'a number'} between ${lo} and ${hi}`);
    };
    if(!s||typeof s!=='object') throw Error('Scenario must be an object');
    num(s.months,1,60,'months',true);num(s.paths,100,20000,'paths',true);num(s.seed,0,4294967295,'seed',true);
    [['savings',0,1000000],['buffer',0,1000000],['inflation',-.05,.2],['cost_volatility',0,.5],['time_value',0,100]].forEach(([k,l,h])=>num(s[k],l,h,k));
    if(!Array.isArray(s.options)||s.options.length!==2) throw Error('Exactly two options are required');
    s.options.forEach(o=>{
      if(typeof o.name!=='string'||o.name.length<1||o.name.length>80)throw Error('Each option needs a name of 1–80 characters');
      [['income',0,50000],['rent',0,20000],['costs',0,20000],['commute_cost',0,5000],['commute_hours',0,200],['moving_cost',0,100000],['growth',-.2,.3],['job_loss',0,.8],['recovery_months',1,24]].forEach(([k,l,h])=>num(o[k],l,h,k,k==='recovery_months'));
    });
  }
  class RNG {
    constructor(seed){this.state=seed||0xA341316C;}
    uniform(){let x=this.state;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x>>>0;return(this.state+.5)/4294967296;}
    normal(){return Math.sqrt(-2*Math.log(this.uniform()))*Math.cos(2*Math.PI*this.uniform());}
  }
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  function quantile(sorted,p){const x=(sorted.length-1)*p,i=Math.floor(x);return sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*(x-i);}
  const sorted=a=>Array.from(a).sort((x,y)=>x-y);
  function wilson(k,n){const p=k/n,z=1.959963984540054,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return[Math.max(0,c-h),Math.min(1,c+h)];}
  function simulate(input,includeSamples=true){
    const s=clone(input||defaults());validate(s);
    const n=s.paths,M=s.months,rng=new RNG(s.seed),opt=s.options;
    const all=[Array.from({length:M+1},()=>new Float64Array(n)),Array.from({length:M+1},()=>new Float64Array(n))];
    const low=[new Float64Array(n),new Float64Array(n)],rcoeff=new Float64Array(n),icoeff=[new Float64Array(n),new Float64Array(n)];
    const hazard=opt.map(o=>1-Math.pow(1-o.job_loss,1/12));
    for(let w=0;w<n;w++){
      const economy=.025*rng.normal(),inflation=Math.max(-.05,Math.min(.2,s.inflation+.015*rng.normal())),rg=Math.max(-.1,Math.min(.2,inflation+.025*rng.normal()));
      const b=opt.map(o=>s.savings-o.moving_cost),lo=b.slice(),down=[0,0];
      all[0][0][w]=b[0];all[1][0][w]=b[1];
      for(let m=1;m<=M;m++){
        const spend=Math.exp(s.cost_volatility*rng.normal()-.5*s.cost_volatility**2),ju=rng.uniform(),bu=rng.uniform(),bs=rng.uniform(),surprise=bu<.03?300+1200*bs:0;
        const year=Math.floor((m-1)/12),rm=Math.pow(1+rg,year),im=Math.pow(1+inflation,(m-1)/12);rcoeff[w]+=rm;
        for(let i=0;i<2;i++){
          const o=opt[i];if(down[i]===0&&ju<hazard[i])down[i]=o.recovery_months;
          const paid=down[i]>0?.2:1;if(down[i]>0)down[i]--;
          const wm=Math.pow(Math.max(.5,1+o.growth+economy),year)*paid;icoeff[i][w]+=wm;
          b[i]+=o.income*wm-o.rent*rm-(o.costs*spend+o.commute_cost)*im-surprise;
          lo[i]=Math.min(lo[i],b[i]);all[i][m][w]=b[i];
        }
      }
      low[0][w]=lo[0];low[1][w]=lo[1];
    }
    const end=[all[0][M],all[1][M]],tc=opt.map(o=>o.commute_hours*M*s.time_value),score=end.map((a,i)=>a.map(v=>v-tc[i]));
    const delta=new Float64Array(n),cash=new Float64Array(n),best=new Float64Array(n),reg=[new Float64Array(n),new Float64Array(n)];
    let successes=0,ties=0;
    for(let w=0;w<n;w++){
      delta[w]=score[1][w]-score[0][w];cash[w]=end[1][w]-end[0][w];best[w]=Math.max(score[0][w],score[1][w]);
      reg[0][w]=best[w]-score[0][w];reg[1][w]=best[w]-score[1][w];
      if(delta[w]>1e-8)successes++;if(Math.abs(delta[w])<=1e-8)ties++;
    }
    const summaries=opt.map((o,i)=>{
      const e=sorted(end[i]);return{name:o.name,mean:mean(end[i]),median:quantile(e,.5),p10:quantile(e,.1),p90:quantile(e,.9),
        worst_decile_mean:mean(e.slice(0,Math.max(1,Math.floor(n/10)))),buffer_breach:low[i].filter(v=>v<s.buffer).length/n,
        expected_regret:mean(reg[i]),commute_hours:o.commute_hours*M,time_adjusted_mean:mean(score[i]),
        timeline:all[i].map(a=>{const t=sorted(a);return[quantile(t,.1),quantile(t,.5),quantile(t,.9)];})};
    });
    const md=mean(delta),d=sorted(delta);let v=0;for(const x of delta)v+=(x-md)**2;
    let min=d[0],max=d[n-1];if(min===max){min-=.5;max+=.5;}
    const edges=Array.from({length:33},(_,i)=>min+(max-min)*i/32),counts=Array(32).fill(0);
    for(const x of delta)counts[Math.min(31,Math.floor((x-min)/(max-min)*32))]++;
    const result={model_version:VERSION,scenario:s,options:summaries,comparison:{
      probability_b_ahead:successes/n,ties:ties/n,probability_interval:wilson(successes,n),mean_difference:md,median_difference:quantile(d,.5),cash_mean_difference:mean(cash),
      difference_p10:quantile(d,.1),difference_p90:quantile(d,.9),monte_carlo_se:Math.sqrt(v/(n-1)/n),preferred:md>1e-8?1:md< -1e-8?0:-1,
      break_even_rent_b:opt[1].rent+md/mean(rcoeff),rent_change_per_100:mean(rcoeff)*100,income_b_change_per_100:mean(icoeff[1])*100,
      perfect_information_upper_bound:Math.max(0,mean(best)-Math.max(mean(score[0]),mean(score[1]))),histogram:{counts,edges}}};
    if(includeSamples){result.worlds=Array.from({length:101},(_,i)=>{const w=Math.floor(i*(n-1)/100);return{index:w,a:all[0].map(a=>a[w]),b:all[1].map(a=>a[w])};});result.terminal={a:Array.from(end[0]),b:Array.from(end[1])};}
    return result;
  }
  const api={defaults,validate,simulate,RNG,VERSION};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ParallelModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
