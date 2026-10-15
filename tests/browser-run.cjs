const fs=require('node:fs');
const model=require('../dist/model.js');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(model.simulate(input)));
