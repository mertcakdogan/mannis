import '../src/style.css';
import { INTEGRATION_AGENTS, State } from '../src/core/state';
import type { BotStateName } from '../src/core/layout';
import { Island } from '../src/island/island';
import { Companion } from '../src/characters';
import { companionSection } from '../src/settings/companion';
import { UploadSeq } from '../src/upload/sequence';
const root = document.getElementById('root');
const controls = document.getElementById('qa-controls');
if (!root || !controls) throw new Error('Preview containers missing');
document.body.style.background = '#24262c';
State.settings.soundEnabled = false;
State.settings.autoCloseInterval = 120;
State.tasks = [
 {id:'preview-coding',name:'Coding agent',color:'#3B9EFF',state:'working',stepIndex:0,steps:['Editing'],source:'claudeCode',isIntegration:false},
 {id:'preview-thinking',name:'Thinking agent',color:'#A78BFA',state:'thinking',stepIndex:0,steps:['Planning'],source:'claudeCode',isIntegration:false},
 {id:'preview-done',name:'Completed agent',color:'#22c55e',state:'finished',stepIndex:0,steps:['Done'],source:'claudeCode',isIntegration:false},
 ...INTEGRATION_AGENTS.filter(task => ['integration_resend', 'integration_n8n', 'integration_vercel', 'integration_github'].includes(task.id)).map(task => ({ ...task })),
];
State.focusId = 'preview-coding';
const island = new Island(root);
island.applySettings();
const picker = companionSection(() => State.settings, id => {
 State.settings.character=id;island.applySettings();
},on => {State.settings.proactive=on;});
controls.append(picker);
const actions:Record<string,()=>void>={};
function button(name:string, act:()=>void) {
 actions[name.toLowerCase()]=act;
 const el=document.createElement('button');el.textContent=name;el.style.padding='10px';
 el.addEventListener('click',act);controls?.append(el);
}
function state(s:BotStateName) {
 State.stateOverride=s;island.expand('overview');State.isPinned=true;State.notify();
}
button('Idle',()=>state('idle'));
button('Coding',()=>state('working'));
button('Permission',()=>state('approval'));
button('Success',()=>{state('finished');Companion.emit({type:'build_success',source:'app'});});
button('Error',()=>state('error'));
button('Greeting',()=>island.launch());
button('Upload',()=>{
 State.droppedFile={name:'asset-check.txt',path:'asset-check.txt'};
 island.expand('upload');State.isPinned=true;
 UploadSeq.enterZone(200,104);State.notify();
});
button('Compact',()=>{island.collapse();});
button('Hidden',()=>island.fsm.forceHidden());
button('Integrations',()=>{
 State.focusId='preview-coding';
 State.tasks=State.tasks.filter(task=>task.id==='preview-coding'||task.isIntegration);
 state('idle');
});
state('idle');
// #compact, #coding… runs that button on load, for screenshots.
actions[location.hash.slice(1)]?.();
