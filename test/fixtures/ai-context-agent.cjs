// Reject immediate steering and injection; the next turn must carry fresh context.
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
  const m=JSON.parse(line);if(m.id===undefined)return;
  if(m.method==='initialize')return send({id:m.id,result:{userAgent:'context-fixture'}});
  if(m.method==='account/read')return send({id:m.id,result:{account:{type:'chatgpt',planType:'plus'}}});
  if(['thread/start','thread/resume'].includes(m.method))return send({id:m.id,result:{thread:{id:'context-thread'}}});
  if(m.method==='turn/start'){
    const text=m.params.input[0].text;
    send({id:m.id,result:{turn:{id:'context-turn'}}});
    if(text.startsWith('New instruction')){
      if(!text.includes('context captured when this prompt was sent')||!text.includes('"revision":2'))process.exit(9);
      send({method:'item/agentMessage/delta',params:{delta:'Fresh context received.'}});
      send({method:'turn/completed',params:{turn:{id:'context-turn',status:'completed'}}});
    }else send({method:'item/agentMessage/delta',params:{delta:'READY'}});
    return;
  }
  if(['turn/steer','thread/inject_items'].includes(m.method)){
    send({id:m.id,error:{code:-32602,message:'fixture delivery failed'}});
    if(m.method==='thread/inject_items')send({method:'turn/completed',params:{turn:{id:'context-turn',status:'completed'}}});
    return;
  }
  send({id:m.id,result:{}});
});
