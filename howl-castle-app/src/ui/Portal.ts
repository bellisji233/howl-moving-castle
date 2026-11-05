import type {WorkshopScene} from '../world/Scene';
import {DESTINATIONS,DESTINATION_ORDER,type Destination} from '../world/Environment';
import {DOOR_SECTORS} from '../world/DoorDial';

function dialArtwork(){
  const point=(a:number,r:number)=>`${72+Math.cos(a)*r},${72-Math.sin(a)*r}`;
  const sectors=DOOR_SECTORS.map(({id,start})=>`<path d="M72,72 L${point(start,56)} A56,56 0 0 0 ${point(start+Math.PI/2,56)} Z" fill="${DESTINATIONS[id].color}"/>`).join('');
  const ticks=Array.from({length:40},(_,i)=>{const a=i*Math.PI/20;return `<path d="M${point(a,i%5===0?61:64)} L${point(a,67)}"/>`;}).join('');
  const bolts=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4+Math.PI/8;return `<circle cx="${72+Math.cos(a)*69}" cy="${72-Math.sin(a)*69}" r="1.4"/>`;}).join('');
  return `<svg class="portal-art" viewBox="0 0 144 144" aria-hidden="true">
    <circle cx="72" cy="72" r="71" fill="#3c3524"/>
    <circle cx="72" cy="72" r="69" fill="#a58a53" stroke="#c4aa70"/>
    <circle cx="72" cy="72" r="59" fill="#51462e" stroke="#d1b77a"/>
    ${sectors}<path d="M16 72H128M72 16V128" stroke="#ac8f54" stroke-width="1.5"/>
    <circle cx="72" cy="72" r="56.5" fill="none" stroke="#6c5533" stroke-width="2"/>
    <g fill="none" stroke="#55482e" stroke-width="1.1">${ticks}</g>
    <g fill="#58462b" stroke="#cfb77b" stroke-width=".6">${bolts}</g>
    <g id="portal-needle" fill="#dcc087" stroke="#65502c" stroke-width="1">
      <path d="M69 103L63 110L72 123L81 110L75 103L75 39L83 43L72 19L61 43L69 39Z"/>
      <circle cx="72" cy="72" r="12" fill="#b2965c"/>
    </g>
  </svg>`;
}

export function portalMarkup(){return `<nav class="destination-rail" id="destination-rail" aria-label="魔法门目的地">
  <p class="sr-only" id="portal-status" role="status">门的另一端：<span id="portal-place">${DESTINATIONS.studio.name}</span></p>
  <div class="portal-dial" id="portal-dial" role="group" aria-label="四色门盘，点击扇区切换目的地，中央返回工坊">
    ${dialArtwork()}
    ${DESTINATION_ORDER.filter(id=>id!=='studio').map(id=>`<button class="portal-sector portal-${id}" data-destination="${id}" aria-pressed="false" aria-label="${DESTINATIONS[id].name}" title="${DESTINATIONS[id].name} · ${DESTINATION_ORDER.indexOf(id)+1}"><span>${DESTINATIONS[id].short}</span></button>`).join('')}
    <button class="portal-hub" data-destination="studio" aria-pressed="true" aria-label="返回结构工坊" title="返回结构工坊 · 1">工坊</button>
  </div>
  <button class="portal-caption" id="portal-focus" aria-label="查看魔法门" title="查看城堡上的魔法门"><span id="portal-label">${DESTINATIONS.studio.name}</span><span aria-hidden="true"> ↗</span></button>
</nav>`;}

export function bindPortal(scene:WorkshopScene){
  const el=(id:string)=>document.getElementById(id)!;
  const dial=el('portal-dial'),needle=el('portal-needle');
  const buttons=DESTINATION_ORDER.map(id=>dial.querySelector<HTMLButtonElement>(`[data-destination="${id}"]`)!);
  let lastTarget:Destination|null=null,lastAnnounced:Destination='studio';
  const go=(id:Destination)=>scene.setDestination(id);
  buttons.forEach(button=>button.addEventListener('click',()=>go(button.dataset.destination as Destination)));
  // Keep every destination directly reachable by Tab, with arrow navigation as a convenience.
  dial.addEventListener('keydown',e=>{
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(index<0)return;
    let next:number;
    if(e.key==='ArrowRight'||e.key==='ArrowDown')next=(index+1)%buttons.length;
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp')next=(index+buttons.length-1)%buttons.length;
    else if(e.key==='Home')next=0;
    else if(e.key==='End')next=buttons.length-1;
    else return;
    e.preventDefault();buttons[next].focus();
  });
  el('portal-focus').addEventListener('click',()=>scene.focusMagicDoor());
  // Clicking the real door uses exactly the same destination path as the screen dial.
  el('scene').addEventListener('portalopen',()=>{const i=DESTINATION_ORDER.indexOf(scene.environment.active);go(DESTINATION_ORDER[(i+1)%DESTINATION_ORDER.length]);});
  document.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||(e.target as HTMLElement)?.closest?.('input,select,textarea')||!el('parts-panel').hidden)return;
    const n=Number(e.key);if(Number.isInteger(n)&&n>=1&&n<=DESTINATION_ORDER.length){e.preventDefault();go(DESTINATION_ORDER[n-1]);}
  });
  scene.onEnvironment=state=>{
    // The actual mechanism owns interpolation, timing and interruption. No second UI animation.
    const angle=-state.needleAngle*180/Math.PI;
    needle.setAttribute('transform',`rotate(${angle} 72 72)`);
    dial.dataset.angle=String(angle);
    if(lastTarget!==state.target){
      buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.destination===state.target)));
      lastTarget=state.target;
    }
    el('destination-rail').classList.toggle('is-changing',state.changing);
    const text=state.changing?`前往 ${DESTINATIONS[state.target].short}`:DESTINATIONS[state.current].name;
    if(el('portal-label').textContent!==text)el('portal-label').textContent=text;
    // Only announce target changes and arrivals, never every animation frame.
    const status=state.changing?`前往 ${DESTINATIONS[state.target].name}`:DESTINATIONS[state.current].name;
    if(el('portal-place').textContent!==status)el('portal-place').textContent=status;
    el('app').classList.toggle('world-night',state.current==='night');
    if(!state.changing&&state.current!==lastAnnounced){el('announcement').textContent=`已抵达：${DESTINATIONS[state.current].name}`;lastAnnounced=state.current;}
  };
  scene.refreshState();
}
