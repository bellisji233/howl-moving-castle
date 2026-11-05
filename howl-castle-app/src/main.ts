import './styles.css';
import { renderShell, bindWorkshop } from './ui/Workshop';
import { WorkshopScene, type ViewId } from './world/Scene';
import type { PartId } from './assets/parts';

renderShell(document.getElementById('app')!);
const qaMode=import.meta.env.DEV?new URLSearchParams(location.search).get('qa'):null;
let runningScene:WorkshopScene|undefined;
const fail=(message:string)=>{
  runningScene?.dispose();runningScene=undefined;
  document.getElementById('loading')!.hidden=true;
  document.getElementById('error-state')!.hidden=false;
  document.getElementById('error-message')!.textContent=message;
  document.getElementById('scene')!.setAttribute('aria-busy','false');
  document.getElementById('app')!.dataset.status='error';
  document.getElementById('app')!.classList.remove('tools-open','note-open');document.querySelectorAll('.is-open,.has-selection').forEach(node=>node.classList.remove('is-open','has-selection'));
  document.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select').forEach(control=>control.disabled=control.id!=='retry');
  for(const selector of ['.stage-heading','.primary-tools','.inspector','.motion-tools','.teardown-tools','.observation','.view-tools','.zoom-tools','.scene','.scene-label','.masthead','.page-footer','.skip-link']){const node=document.querySelector<HTMLElement>(selector);if(node)node.inert=true;}
  document.getElementById('parts-panel')!.hidden=true;document.getElementById('panel-scrim')!.hidden=true;document.querySelector('main')!.inert=false;document.getElementById('error-state')!.focus();
};
document.getElementById('retry')!.addEventListener('click',()=>{const url=new URL(location.href);if(import.meta.env.DEV)url.searchParams.delete('qa');location.assign(url.href);});
document.getElementById('error-state')!.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();document.getElementById('retry')!.focus();}});
document.getElementById('scene')!.addEventListener('sceneerror',(event:Event)=>fail((event as CustomEvent).detail));

// Yield once so the honest loading state is painted before geometry creation.
requestAnimationFrame(()=>setTimeout(()=>{
  try{
    if(qaMode==='no-webgl')throw new Error('Injected WebGL failure for error-state verification');
    const scene=new WorkshopScene(document.getElementById('scene')!);runningScene=scene;bindWorkshop(scene);
    // A deterministic inspection surface for screenshots; actual interaction
    // verification still uses the same visible controls as a visitor.
    Object.assign(window,{workshop:{
      ready:true,version:'P3 interactive teardown study',scene,
      view:(id:ViewId)=>scene.setView(id,true),
      select:(id:PartId|null)=>scene.select(id),stats:()=>scene.stats(),seek:(cycles:number)=>scene.seekCycles(cycles),
    }});
    addEventListener('pagehide',()=>scene.dispose(),{once:true});
    if(qaMode==='context-loss'){const loss=setTimeout(()=>scene.renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext(),1600);addEventListener('pagehide',()=>clearTimeout(loss),{once:true});}
  }catch(error){console.error(error);fail('请确认浏览器已开启图形加速并支持 WebGL 2，然后重新载入。');}
},qaMode==='loading'?2500:30));
