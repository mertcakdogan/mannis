import { listCharacters, resolveCharacter } from '../src/characters/registry';
import { COMPANION_EVENTS } from '../src/characters/events';
import { resolveReaction } from '../src/characters/reactions';
import { BotEngine } from '../src/mochi/engine';
const body = { sx:1, sy:1, ox:0, oy:0, tilt:0, roll:0 };
const poses = document.getElementById('poses')!;
const sizes = document.getElementById('sizes')!;
const picker = document.getElementById('character');
let active = resolveCharacter('stannis');
let reactionSize = 80;
let entries: { canvas:HTMLCanvasElement; pose:string; size:number; engine:BotEngine }[]=[];
function card(pose:string, size:number, parent:HTMLElement) {
 const fig=document.createElement('figure');const canvas=document.createElement('canvas');
 const n=size/0.6;canvas.width=n*2;canvas.height=n*2;canvas.style.width=`${n}px`;canvas.style.height=`${n}px`;
 const label=document.createElement('figcaption');label.textContent=`${pose} · ${size}px`;
 fig.append(canvas,label);parent.append(fig);entries.push({canvas,pose,size:n,engine:new BotEngine()});
}
function show(id:string) {
 active=resolveCharacter(id);entries=[];poses.replaceChildren();sizes.replaceChildren();
 active.renderer?.preload();
 for(const size of [20,44,62])card(active.fallbackPose,size,sizes);
 const variants=new Set([...COMPANION_EVENTS.map(e=>resolveReaction(active,e).pose),...(active.renderer?.idlePoses??[])]);
 for(const pose of variants)card(pose,reactionSize,poses);
}
const compactToggle=document.createElement('button');
compactToggle.textContent='Toggle compact reactions';
compactToggle.addEventListener('click',()=>{reactionSize=reactionSize===80?20:80;show(active.id);});
document.getElementById('background')?.after(compactToggle);
picker?.addEventListener('change',()=>{if(picker instanceof HTMLSelectElement)show(picker.value);});
document.getElementById('background')?.addEventListener('click',()=>document.querySelectorAll('figure').forEach(f=>f.classList.toggle('checker')));
function frame(t:number) {
 for(const {canvas,pose,size,engine} of entries){const ctx=canvas.getContext('2d');if(!ctx)continue;ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,size,size);if(active.renderer)active.renderer.draw(ctx,size,size,pose,body,t);else{engine.update(1/60);engine.draw(ctx,size,size);}}
 requestAnimationFrame(frame);
}
show(listCharacters()[0].id);requestAnimationFrame(frame);
