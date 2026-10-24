const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
function providerEnvironment(directory,provider) {
  const env={...process.env,TEMP:path.join(directory,'temp'),TMP:path.join(directory,'temp')};
  for(const key of ['OPENAI_API_KEY','OPENAI_BASE_URL','ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL','CLAUDE_CODE_OAUTH_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY'])delete env[key];
  env[provider==='codex'?'CODEX_HOME':'CLAUDE_CONFIG_DIR']=path.join(directory,provider);
  return env;
}
function resolveExecutable(command,env=process.env) {
  const names=process.platform==='win32'&&!path.extname(command)?[command+'.exe',command+'.cmd',command]:[command];
  const directories=path.isAbsolute(command)?['']:(env.PATH||env.Path||'').split(path.delimiter);
  for(const directory of directories)for(const name of names){const full=directory?path.join(directory,name):name;if(fs.existsSync(full)&&fs.statSync(full).isFile())return full;}
  throw Error(`Cannot find ${command}. Install its CLI or choose its executable in AI connection settings.`);
}
function spawnAgent(command,args,options={}) {
  const executable=resolveExecutable(command,options.env);
  // npm launchers are shell programs. Run their adjacent JS entry via Node
  // instead of putting prompts or credentials through cmd.exe quoting.
  if(/\.cmd$/i.test(executable)) {
    const source=fs.readFileSync(executable,'utf8'),match=source.match(/%dp0%\\([^"\r\n]+\.js)/i)||source.match(/%~dp0\\([^"\r\n]+\.js)/i);
    if(!match)throw Error('Choose the native CLI executable; this launcher cannot be run without a shell.');
    return spawn(resolveExecutable('node',options.env),[path.resolve(path.dirname(executable),match[1]),...args],{...options,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
  }
  return spawn(executable,args,{...options,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
}
function stopAgent(child) {
  if(!child||!child.pid||child.exitCode!==null||child.killed)return;
  if(process.platform==='win32') {
    const killer=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    killer.on('error',()=>child.kill());
  } else child.kill('SIGTERM');
}
function lines(stream,callback,onError=()=>{}) {
  let buffer='';stream.setEncoding('utf8');stream.on('data',chunk=>{buffer+=chunk;if(buffer.length>32*1024*1024){onError(Error('Agent output line is too large.'));buffer='';return;}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end).trim();buffer=buffer.slice(end+1);if(line)callback(line);}});stream.on('end',()=>{if(buffer.trim())callback(buffer.trim());});
}
module.exports={spawnAgent,stopAgent,lines,resolveExecutable,providerEnvironment};
