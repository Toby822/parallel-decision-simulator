'use strict';
(() => {
  const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
  const clone=x=>JSON.parse(JSON.stringify(x));
  const money=(v,signed=false)=>(v<0?'−':signed&&v>0?'+':'')+'£'+Math.round(Math.abs(v)).toLocaleString('en-GB');
  const pct=v=>v>0&&v<.001?'<0.1%':(v*100).toFixed(1)+'%';
  let scenario=ParallelModel.defaults(),result=null,engine='browser',runId=0,timer,worldOn=false,sound=false,commandBusy=false;
  let history=[],trace=[],lastAction=null;
  try {const saved=JSON.parse(localStorage.getItem('parallel-scenario-v1'));if(saved){ParallelModel.validate(saved);scenario=saved;}}catch(_){/* A corrupt or old saved run is not reused. */}
  const pending=new Map();
  let worker;
  try{worker=new Worker('simulation-worker.js');worker.onmessage=({data})=>{const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);}};worker.onerror=()=>{worker.terminate();worker=null;for(const p of pending.values())p.reject(Error('Simulation worker unavailable. Please run again.'));pending.clear();};}catch(_){worker=null;}
  function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3800);}
  function sync(){
    $$('[data-field]').forEach(input=>{const key=input.dataset.field;input.value=input.dataset.option!==undefined?scenario.options[Number(input.dataset.option)][key]:scenario[key];});
    $('#time-label').textContent=money(scenario.time_value)+' / hour';
    $('.control-footer>span').textContent='GBP · '+scenario.months+' months';
  }
  function compute(s,id){
    if(engine==='python')return fetch('api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)})
      .then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||'Python simulation failed');return body;});
    if(worker)return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});worker.postMessage({id,scenario:s});});
    return new Promise((resolve,reject)=>setTimeout(()=>{try{resolve(ParallelModel.simulate(s));}catch(e){reject(e);}},20));
  }
  async function run(){
    let s;try{ParallelModel.validate(scenario);s=clone(scenario);}catch(e){toast(e.message);return null;}
    const id=++runId;$('.analysis').setAttribute('aria-busy','true');$('#run-status').innerHTML='<span class="pulse"></span> Simulating…';
    try{
      const r=await compute(s,id);
      if(id===runId){result=r;render();$('.analysis').setAttribute('aria-busy','false');$('#chart-loading').classList.add('hidden');$('#run-status').innerHTML='<span class="pulse"></span> '+s.paths.toLocaleString('en-GB')+' worlds · seed '+s.seed;try{localStorage.setItem('parallel-scenario-v1',JSON.stringify(s));}catch(_){}}
      return r;
    }catch(e){if(id===runId){$('.analysis').setAttribute('aria-busy','false');$('#run-status').textContent='Run failed';$('#chart-loading').textContent=e.message;toast(e.message);}return null;}
  }
  function render(){
    const c=result.comparison,s=result.scenario,ops=result.options,t=s.time_value>0;
    $('#chance').textContent=pct(c.probability_b_ahead);
    $('#chance-title').textContent=t?'London ahead after time cost':'London finishes ahead';
    $('#chance-note').textContent='paired worlds'+(c.ties>0?' · '+pct(c.ties)+' ties':' · conditional on inputs');
    $('#gap-title').textContent=t?'London time-adjusted advantage':'Average London advantage';
    $('#gap').textContent=money(c.mean_difference,true);
    $('#gap-note').textContent='after '+s.months+' months · '+(t?'cash less commute-time cost':'cash savings');
    $('#threshold').textContent=c.break_even_rent_b>=0?money(c.break_even_rent_b):'Below £0';
    $('.chart-head h3').textContent='Savings over the next '+s.months+' months';
    ops.forEach((o,i)=>{const k=i===0?'a':'b';$('#median-'+k).textContent=money(o.median);$('#tail-'+k).textContent=money(o.worst_decile_mean);$('#risk-'+k).textContent=pct(o.buffer_breach);$('#regret-'+k).textContent=money(o.expected_regret);});
    $$('.outcome-card>.small').forEach(el=>el.textContent='median savings after '+s.months+' months');
    const preferred=c.preferred===1?'London':c.preferred===0?'Manchester':'Both options';
    $('#insight-text').textContent=c.break_even_rent_b>=0
      ?`${preferred} has the higher average ${t?'time-adjusted score':'cash outcome'}. London rent of ${money(c.break_even_rent_b)} per month makes the averages equal. That gives you something concrete to negotiate.`
      :'London would need a rent below zero to equal Manchester’s average score with these other inputs. Look at the salary or commute assumptions instead.';
    $('#try-counterfactual').textContent='Try '+money(Math.min(200,s.options[1].rent))+' less in London rent →';
    $('#assumption-note').textContent=`Possible outcomes under your assumptions, not predictions. Buffer: ${money(s.buffer)}. ${t?'Time preference: '+money(s.time_value)+'/hour, applied to the score only. ':''}Career, family and happiness are yours to weigh.`;
    $('#mc-detail').textContent=`For this run: average paired difference ${money(c.mean_difference,true)}, Monte Carlo standard error ${money(c.monte_carlo_se)}. A 95% simulation-noise interval for the London-ahead fraction is ${(c.probability_interval[0]*100).toFixed(1)}–${(c.probability_interval[1]*100).toFixed(1)}%. This measures random simulation error, not confidence that the model describes your life.`;
    chart();
  }
  function chart(){
    if(!result)return;const {options:o,scenario:s}=result;
    const W=760,H=296,L=47,R=16,T=16,B=33,pw=W-L-R,ph=H-T-B;
    let low=Math.min(0,s.buffer,...o.map(a=>Math.min(...a.timeline.map(t=>t[0])))),high=Math.max(s.buffer,...o.map(a=>Math.max(...a.timeline.map(t=>t[2]))));
    const step=Math.max(1000,Math.pow(10,Math.floor(Math.log10(Math.max(1,high-low))))/2);low=Math.floor(low/step)*step;high=Math.ceil(high/step)*step;if(high<=low)high=low+1000;
    const x=m=>L+m/s.months*pw,y=v=>T+ph-(v-low)/(high-low)*ph;
    const line=(a,col)=>a.map((t,m)=>(m?'L':'M')+x(m).toFixed(2)+' '+y(t[col]).toFixed(2)).join(' ');
    let svg='<title id="chart-title">Savings in '+s.paths+' paired worlds over '+s.months+' months</title><desc id="chart-desc">Solid lines: median savings. Shading: pointwise tenth to ninetieth percentiles. Both choices share the same random shocks.</desc><defs><clipPath id="plot"><rect x="'+L+'" y="'+T+'" width="'+pw+'" height="'+ph+'"/></clipPath></defs>';
    for(let i=0;i<=4;i++){const v=low+(high-low)*i/4,yy=y(v);svg+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e9ede5" stroke-dasharray="3 4"/><text x="${L-9}" y="${yy+3}" text-anchor="end">${v<0?'−':''}£${Math.abs(v)>=1000?Math.round(Math.abs(v)/1000)+'k':Math.round(Math.abs(v))}</text>`;}
    [0,.25,.5,.75,1].forEach(f=>{const m=Math.round(f*s.months);svg+=`<text x="${x(m)}" y="${H-9}" text-anchor="middle">${m===0?'Today':'Month '+m}</text>`;});
    svg+='<g clip-path="url(#plot)">';
    if(s.buffer>=low&&s.buffer<=high)svg+=`<line x1="${L}" y1="${y(s.buffer)}" x2="${W-R}" y2="${y(s.buffer)}" stroke="#b9bcad" stroke-dasharray="2 5"/><text x="${L+8}" y="${y(s.buffer)-5}" style="font-size:9px">${money(s.buffer)} buffer</text>`;
    ['#285d50','#b67455'].forEach((color,i)=>{const a=o[i].timeline;const lower=a.slice().reverse().map((t,j)=>'L'+x(s.months-j).toFixed(2)+' '+y(t[0]).toFixed(2)).join(' ');svg+=`<path d="${line(a,2)} ${lower} Z" fill="${color}" opacity=".09"/><path d="${line(a,1)}" stroke="${color}" stroke-width="2.2" fill="none"/>`;for(let m=0;m<=s.months;m++){svg+=`<circle cx="${x(m)}" cy="${y(a[m][1])}" r="5" fill="transparent"><title>${i?'London':'Manchester'}, month ${m}: median ${money(a[m][1])}; middle 80% ${money(a[m][0])} to ${money(a[m][2])}</title></circle>`;}});
    const w=result.worlds[Number($('#world-slider').value)];$('#world-label').textContent='World '+(w.index+1).toLocaleString('en-GB')+(worldOn?' · London '+money(w.b.at(-1)-w.a.at(-1),true):'');
    if(worldOn){['a','b'].forEach((k,i)=>{const pts=w[k].map((v,m)=>(m?'L':'M')+x(m).toFixed(2)+' '+y(v).toFixed(2)).join(' ');svg+=`<path d="${pts}" fill="none" stroke="${i?'#9b4e2c':'#123e32'}" stroke-width="1.4" stroke-dasharray="4 3"/>`;});}
    svg+='</g>';$('#fan-chart').innerHTML=svg;
  }
  function message(role,text){const box=document.createElement('div');box.className='message '+role;const label=document.createElement('span');label.textContent=role==='user'?'YOU':'PARALLEL';const p=document.createElement('p');p.textContent=text;box.append(label,p);$('#conversation').append(box);while($('#conversation').children.length>18)$('#conversation').firstElementChild.remove();$('#conversation').scrollTop=$('#conversation').scrollHeight;if(role==='assistant'&&sound&&'speechSynthesis'in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-GB';u.rate=1; speechSynthesis.speak(u);}}
  function logAction(command,action,steps){lastAction={command,action,steps,seed:scenario.seed,timestamp:new Date().toISOString()};trace.push(lastAction);trace=trace.slice(-100);$('#tool-trace').textContent=JSON.stringify(lastAction,null,2);}
  function explanation(r,tool){
    const c=r.comparison,op=r.options,s=r.scenario,time=s.time_value>0;
    if(tool==='inspect_downside')return `London’s average savings in the worst 10% of worlds are ${money(op[1].worst_decile_mean)}, versus ${money(op[0].worst_decile_mean)} if you stay. It crosses your ${money(s.buffer)} buffer in ${pct(op[1].buffer_breach)} of worlds. Both include the same shocks. These are conditional scenarios, not a forecast.`;
    if(tool==='find_tipping_point')return c.break_even_rent_b>=0?`The London rent tipping point is about ${money(c.break_even_rent_b)} a month. Below that, London has the higher average ${time?'time-adjusted score':'cash savings'}; above it, Manchester does. This holds every other input and every random shock fixed. Want to try a lower rent?`:'Rent alone cannot reverse this comparison within a non-negative rent. Try changing the take-home pay or the commute-time value.';
    if(tool==='explain_result')return `London adds ${money(s.options[1].income-s.options[0].income,true)} in monthly take-home pay, but rent is ${money(s.options[1].rent-s.options[0].rent,true)} higher and moving costs are ${money(s.options[1].moving_cost)}. Its assumed annual job-loss risk is ${(s.options[1].job_loss*100).toFixed(1)}%, versus ${(s.options[0].job_loss*100).toFixed(1)}%. Lowering London rent by £100 improves its average ${time?'score':'savings'} by ${money(c.rent_change_per_100)} over ${s.months} months. Career upside has no assigned cash value here.`;
    return `With these inputs, London finishes ahead in ${pct(c.probability_b_ahead)} of paired worlds${c.ties?' ('+pct(c.ties)+' ties)':''}. Its average ${time?'time-adjusted advantage':'cash advantage'} is ${money(c.mean_difference,true)} after ${s.months} months. ${time?'The savings chart still shows cash only. ':''}Try asking about the downside or the rent tipping point.`;
  }
  async function command(text){
    if(commandBusy||!text.trim())return;commandBusy=true;$('#command-form .send').disabled=true;$('#voice-status').textContent='Thinking it through…';message('user',text);$('#command').value='';
    try{
      const action=ParallelAgent.plan(text,scenario),steps=['interpret_command'];let r=result,prefix='';
      if(action.tool==='help'){logAction(text,action,steps);message('assistant','I can compare the options, inspect the downside, find the rent tipping point, change London or Manchester rent or take-home pay, set the hourly value of your time, undo, reset, or export. Try “Lower London rent by £200”. Please change one assumption at a time.');return;}
      if(action.tool==='export_decision'){logAction(text,action,steps.concat('export_decision'));if(exportRun())message('assistant','I’ve downloaded the inputs, seed, results and tool history as a JSON file. You can reproduce the same run in Python.');else message('assistant','Please wait for the current simulation to finish before exporting.');return;}
      if(action.tool==='update_assumption'){
        const next=clone(scenario);if(action.option!==undefined)next.options[action.option][action.field]=action.value;else next[action.field]=action.value;
        steps.push('validate_assumption');ParallelModel.validate(next);history.push(clone(scenario));scenario=next;sync();steps.push('update_assumption','simulate_paired_worlds');r=await run();prefix='Updated. ';
      }else if(action.tool==='undo'){
        if(!history.length){message('assistant','There isn’t an earlier change in this session to undo yet.');logAction(text,action,steps);return;}
        scenario=history.pop();sync();r=await run();steps.push('restore_assumptions','simulate_paired_worlds');prefix='Previous inputs restored. ';
      }else if(action.tool==='reset'){history.push(clone(scenario));scenario=ParallelModel.defaults();sync();r=await run();steps.push('reset_assumptions','simulate_paired_worlds');prefix='Back to the example. ';}
      else {if(!r||JSON.stringify(r.scenario)!==JSON.stringify(scenario)){r=await run();steps.push('simulate_paired_worlds');}steps.push(action.tool);}
      if(!r)throw Error('The simulation did not finish. Please try again.');
      steps.push('ground_response_in_result');logAction(text,action,steps);message('assistant',prefix+explanation(r,action.tool));
    }catch(e){message('assistant','That change did not run: '+e.message);toast(e.message);}
    finally{commandBusy=false;$('#command-form .send').disabled=false;$('#voice-status').textContent=sound?'Spoken replies enabled':'Ready when you are';}
  }
  function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportRun(){if(!result||$('.analysis').getAttribute('aria-busy')==='true'||JSON.stringify(result.scenario)!==JSON.stringify(scenario)){toast('Wait for the current simulation to finish.');return false;}download('parallel-decision-seed-'+result.scenario.seed+'.json',JSON.stringify({created_at:new Date().toISOString(),engine,simulation:result,tool_history:trace},null,2),'application/json');toast('Reproducible run downloaded.');return true;}
  function reset(){history.push(clone(scenario));scenario=ParallelModel.defaults();sync();run();toast('Example restored. Seed 42.');}
  $$('[data-field]').forEach(input=>input.addEventListener('input',()=>{
    if(!input.validity.valid||input.value===''){input.setAttribute('aria-invalid','true');$('#run-status').textContent='Check the highlighted input';return;}input.removeAttribute('aria-invalid');const next=clone(scenario),value=Number(input.value);
    if(input.dataset.option!==undefined)next.options[Number(input.dataset.option)][input.dataset.field]=value;else next[input.dataset.field]=value;
    try{ParallelModel.validate(next);}catch(e){toast(e.message);return;}history.push(clone(scenario));if(history.length>100)history.shift();scenario=next;$('#time-label').textContent=money(scenario.time_value)+' / hour';clearTimeout(timer);timer=setTimeout(run,200);
  }));
  $('#reset').addEventListener('click',reset);$('#lab-nav').addEventListener('click',()=>$('.workspace').scrollIntoView({behavior:'smooth'}));
  $('#world-slider').addEventListener('input',()=>{worldOn=true;$('#world-toggle').setAttribute('aria-pressed','true');$('#world-toggle').textContent='Hide path ↗';chart();});
  $('#world-toggle').addEventListener('click',()=>{worldOn=!worldOn;$('#world-toggle').setAttribute('aria-pressed',String(worldOn));$('#world-toggle').textContent=worldOn?'Hide path ↗':'Show path ↗';chart();});
  $('#export-top').addEventListener('click',exportRun);$('#export-model').addEventListener('click',exportRun);
  $('#command-form').addEventListener('submit',e=>{e.preventDefault();command($('#command').value);});
  $$('[data-command]').forEach(b=>b.addEventListener('click',()=>command(b.dataset.command)));
  $('#try-counterfactual').addEventListener('click',()=>command('Lower London rent by £'+Math.min(200,scenario.options[1].rent)));
  const fields=[
    ['Manchester: living costs / month','options.0.costs',0,20000,25,1],['London: living costs / month','options.1.costs',0,20000,25,1],
    ['Manchester: transport / month','options.0.commute_cost',0,5000,10,1],['London: transport / month','options.1.commute_cost',0,5000,10,1],
    ['Manchester: commute hours / month','options.0.commute_hours',0,200,1,1],['London: commute hours / month','options.1.commute_hours',0,200,1,1],
    ['Manchester: moving cost','options.0.moving_cost',0,100000,100,1],['London: moving cost','options.1.moving_cost',0,100000,100,1],
    ['Manchester: annual pay growth %','options.0.growth',-20,30,.5,100],['London: annual pay growth %','options.1.growth',-20,30,.5,100],
    ['Manchester: annual job-loss risk %','options.0.job_loss',0,80,.5,100],['London: annual job-loss risk %','options.1.job_loss',0,80,.5,100],
    ['Manchester: job recovery months','options.0.recovery_months',1,24,1,1],['London: job recovery months','options.1.recovery_months',1,24,1,1],
    ['Emergency buffer £','buffer',0,1000000,500,1],['Annual inflation %','inflation',-5,20,.5,100],
    ['Living-cost monthly volatility %','cost_volatility',0,50,1,100],['Months to simulate','months',1,60,1,1],
    ['Number of worlds','paths',100,20000,100,1],['Reproducible random seed','seed',0,4294967295,1,1]
  ];
  const get=(obj,path)=>path.split('.').reduce((x,k)=>x[k],obj);
  const put=(obj,path,v)=>{const p=path.split('.'),last=p.pop();p.reduce((x,k)=>x[k],obj)[last]=v;};
  function assumptionForm(){const grid=$('#assumption-fields');grid.textContent='';fields.forEach(([label,path,min,max,step,scale],i)=>{const wrap=document.createElement('label');wrap.className='field';wrap.htmlFor='assumption-'+i;const caption=document.createElement('span');caption.textContent=label;const input=document.createElement('input');Object.assign(input,{type:'number',min:String(min),max:String(max),step:/(?:months|paths|seed)$/.test(path)?'1':'any',value:String(Math.round(get(scenario,path)*scale*1000)/1000),id:'assumption-'+i,required:true});input.dataset.path=path;input.dataset.scale=scale;wrap.append(caption,input);grid.append(wrap);});$('#assumption-error').textContent='';}
  $$('[data-dialog]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.dialog==='assumptions-dialog')assumptionForm();$('#'+b.dataset.dialog).showModal();}));
  $$('.dialog-close').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}}));
  $('#assumption-form').addEventListener('submit',e=>{e.preventDefault();const next=clone(scenario);$$('#assumption-fields input').forEach(el=>put(next,el.dataset.path,Number(el.value)/Number(el.dataset.scale)));try{ParallelModel.validate(next);history.push(clone(scenario));scenario=next;sync();$('#assumptions-dialog').close();run();}catch(err){$('#assumption-error').textContent=err.message;}});
  $('#sound-toggle').addEventListener('click',()=>{if(!('speechSynthesis'in window)){toast('Spoken responses are unavailable in this browser.');return;}sound=!sound;$('#sound-toggle').setAttribute('aria-pressed',String(sound));$('#sound-toggle').setAttribute('aria-label',sound?'Disable spoken responses':'Enable spoken responses');$('#voice-status').textContent=sound?'Spoken replies enabled':'Ready when you are';if(!sound)speechSynthesis.cancel();});
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null;
  if(Recognition){recognition=new Recognition();recognition.lang='en-GB';recognition.interimResults=false;recognition.onresult=e=>{$('#command').value=e.results[0][0].transcript;command($('#command').value);};recognition.onend=()=>$('#mic').setAttribute('aria-pressed','false');recognition.onerror=()=>{toast('Microphone unavailable. Type your question below.');$('#mic').setAttribute('aria-pressed','false');};}
  $('#mic').addEventListener('click',()=>{if(!recognition){toast('This browser does not support voice input. Typed commands work below.');$('#command').focus();return;}try{$('#mic').setAttribute('aria-pressed','true');recognition.start();}catch(_){recognition.stop();}});
  async function init(){sync();try{const response=await fetch('api/health',{signal:AbortSignal.timeout(1200)});if(response.ok){const body=await response.json();if(body.engine==='Python / NumPy'){engine='python';$('#engine-label').textContent='Python / NumPy engine · local API';}}}catch(_){}await run();}
  init();
})();
