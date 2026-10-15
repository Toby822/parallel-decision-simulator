/* A bounded, inspectable planner for the simulated Alexa+ experience.
   It only emits supported tool actions. It never invents a probability. */
(function(root){
  'use strict';
  function spokenNumbers(text){
    const small={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
    const word='(?:'+Object.keys(small).join('|')+'|hundred|thousand)';
    const regex=new RegExp('\\b(?:minus\\s+)?'+word+'(?:[\\s-]+(?:and[\\s-]+)?'+word+')*\\b','g');
    return text.replace(regex,phrase=>{let total=0,part=0;const neg=phrase.startsWith('minus');for(const w of phrase.split(/[\s-]+/)){if(w in small)part+=small[w];else if(w==='hundred')part=Math.max(1,part)*100;else if(w==='thousand'){total+=Math.max(1,part)*1000;part=0;}}return String((neg?-1:1)*(total+part));});
  }
  function plan(text,scenario){
    const t=spokenNumbers(text.toLowerCase().trim().replace(/,/g,'')),number=t.match(/(?:£|gbp\s*)?(-?\d+(?:\.\d+)?)/),v=number?Number(number[1]):null;
    if((t.match(/-?\d+(?:\.\d+)?/g)||[]).length>1)return{tool:'help'};
    const target=/manchester|option a|stay/.test(t)?0:1;
    if(/\bundo\b|previous|go back/.test(t))return{tool:'undo'};
    if(/\breset\b|start again/.test(t))return{tool:'reset'};
    if(/export|save (the |my )?(run|decision)|download/.test(t))return{tool:'export_decision'};
    if(/why|explain|what matters|what drives|assumption/.test(t))return{tool:'explain_result'};
    if(/worst|downside|buffer|emergency/.test(t)&&v===null)return{tool:'inspect_downside'};
    if(/break.?even|maximum rent|highest rent|rent ceiling|what would change|change my mind|tipping/.test(t))return{tool:'find_tipping_point'};
    if(/rent/.test(t)&&v!==null){
      const change=/lower|cheaper|reduce|less|drop/.test(t)?-v:/higher|increase|more|raise/.test(t)?v:null;
      return{tool:'update_assumption',option:target,field:'rent',value:change===null?v:scenario.options[target].rent+change};
    }
    if(/salary|income|take.?home|pay/.test(t)&&v!==null){
      const change=/lower|reduce|less|cut/.test(t)?-v:/higher|increase|more|raise|extra/.test(t)?v:null;
      return{tool:'update_assumption',option:target,field:'income',value:change===null?v:scenario.options[target].income+change};
    }
    if(/time|hour|commut/.test(t)&&v!==null)return{tool:'update_assumption',field:'time_value',value:v};
    if(/compare|simulate|run|should i|offer|move|summary/.test(t))return{tool:'compare_options'};
    return{tool:'help'};
  }
  const api={plan};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ParallelAgent=api;
})(typeof globalThis!=='undefined'?globalThis:this);
