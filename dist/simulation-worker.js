importScripts('model.js');
self.onmessage = function(event) {
  const {id,scenario}=event.data;
  try {self.postMessage({id,result:ParallelModel.simulate(scenario)});}
  catch(error){self.postMessage({id,error:error.message});}
};
