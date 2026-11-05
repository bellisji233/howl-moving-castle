import {portalMarkup,bindPortal} from './Portal';
import { PARTS, PART_MAP, type PartId } from '../assets/parts';
import type { ViewId, WorkshopScene } from '../world/Scene';

const icons={
  orbit:'<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/>',
  reset:'<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
  plus:'<path d="M5 12h14M12 5v14"/>',minus:'<path d="M5 12h14"/>',
  index:'<path d="M8 6h12M8 12h12M8 18h12"/><path d="M3 6h1M3 12h1M3 18h1"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
};
function icon(name:keyof typeof icons){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;}
export const VIEWS:{id:ViewId;name:string;number:string}[]=[{id:'hero',name:'三分之四',number:'01'},{id:'front',name:'正面',number:'02'},{id:'left',name:'左侧',number:'03'},{id:'rear',name:'背面',number:'04'},{id:'top',name:'顶部',number:'05'}];

export function renderShell(app:HTMLElement){
  app.innerHTML=`
    <a class="skip-link" href="#primary-tools">跳至城堡操作</a>
    <header class="masthead">
      <a class="brand" href="./" aria-label="移动城堡工坊首页"><span class="brand-mark" aria-hidden="true">H<span>↗</span></span><span>奇想建筑<span class="brand-sub">THE IMPOSSIBLE WORKSHOP</span></span></a>
      <div class="edition"><span class="edition-dot"></span> 建筑研究档案 <span class="slash">/</span> NO. 001</div>

      <button class="index-toggle" id="index-toggle" aria-controls="parts-panel" aria-expanded="false">${icon('index')}<span>部件索引</span><span class="index-count">14</span></button>
    </header>
    <main id="main">
      <div class="stage">
        ${portalMarkup()}
        <div class="stage-heading"><p class="eyebrow">THE WALKING CASTLE / 001</p><h1 id="title">哈尔的移动城堡</h1><p>一座能行走、能拆开的奇想建筑。</p></div>
        <button id="selected-part" class="selected-part" hidden aria-controls="inspector">查看部件 <span id="selected-part-name"></span> ↗</button>
        <button id="views-toggle" class="views-toggle" aria-expanded="false" aria-controls="view-controls">观察视角</button>
        <div class="scene" id="scene" aria-busy="true"></div>
      <div class="zoom-tools" role="group" aria-label="缩放"><button id="zoom-in" class="icon-button" aria-label="放大">${icon('plus')}</button><span></span><button id="zoom-out" class="icon-button" aria-label="缩小">${icon('minus')}</button></div>
      </div>
      <aside class="inspector" id="inspector" aria-label="结构工作台" hidden>
        <div class="inspector-head"><div><p class="eyebrow">THE WORKBENCH</p><h2>结构工作台</h2></div><button id="close-inspector" class="icon-button" aria-label="收起结构工作台">${icon('close')}</button></div>
        <div class="inspector-content">
      <section class="motion-tools" aria-label="步态控制">
          <label class="speed-control" for="gait-speed">速度<select id="gait-speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label>
        <div id="motion-details" class="motion-details">
          <label class="phase-label" for="gait-phase">周期位置 <output id="gait-percent">0%</output></label>
          <input type="range" id="gait-phase" min="0" max="1000" step="1" value="0" aria-label="步态周期位置，调整时暂停运动" />
          <div class="foot-readouts" aria-label="四足接地状态与膝关节角度">${[['FL_LIMB','前左'],['FR_LIMB','前右'],['BL_LIMB','后左'],['BR_LIMB','后右']].map(([id,name])=>`<button data-limb="${id}" class="foot-readout"><span class="foot-name">${name}</span><span class="foot-contact">支撑</span><small class="foot-angle">膝 —°</small></button>`).join('')}</div>
          <p class="motion-disclaimer" id="motion-disclaimer">设计步态 · 关节与参数为创意推演</p>
          <button id="reduce-motion" class="reduce-motion" aria-label="减少动态效果" aria-pressed="false">减少动态效果</button>
        </div>
      </section>
      <aside class="observation" id="observation" aria-label="部件说明">
        <p class="eyebrow">FIELD NOTES <span id="note-number">/ 001</span></p>
        <div class="note-rule"></div>
        <p class="note-category" id="note-category">机械与建筑之间</p>
        <h2 id="part-title">拼接而成的生命</h2>
        <p class="part-english" id="part-english">An architecture of imagination</p>
        <p class="part-description" id="part-description">船腹般的机身托起层叠的小屋，四条鸟足撑住不规则的轮廓。试着拖动场景，从另一面认识它。</p>
        <div class="note-foot"><span class="note-dot"></span><span id="part-basis">点击模型，观察独立部件</span></div>
        <button id="clear-selection" class="text-button" hidden>清除选择 <span aria-hidden="true">↗</span></button>
      </aside>
      <section class="teardown-tools" id="teardown-tools" aria-label="结构拆解控制">
        <label class="phase-label" for="explode-amount">拆解程度 <output id="explode-percent">0%</output></label>
        <input type="range" id="explode-amount" min="0" max="1000" step="1" value="0" aria-label="结构拆解程度" />
        <div class="teardown-actions"><button id="isolate-toggle" aria-pressed="false" aria-describedby="isolate-hint" disabled>隔离部件</button></div>
        <div class="restore-row"><button id="restore-parts" class="text-button">复原结构 <span aria-hidden="true">↶</span></button><span>保持运动相位</span></div>
        <p id="isolate-hint" class="mode-hint">先选择一个部件，再单独观察它。</p>
        <p class="mode-disclaimer">内部传动与炉心为创意机械推演</p>
      </section>
        </div>
      </aside>
      <button id="immersive-tools-toggle" class="immersive-tools-toggle" aria-expanded="false" aria-controls="primary-tools" hidden>展开操作 ⌃</button>
      <div class="primary-tools" id="primary-tools" tabindex="-1" role="group" aria-label="城堡操作">
          <button id="play-motion" class="play-button" aria-pressed="false"><span aria-hidden="true">▷</span><span id="play-label">开始行走</span></button>
        <button id="explode-toggle" class="dock-button" aria-pressed="false"><span aria-hidden="true">◇</span><span id="explode-label">拆开城堡</span></button>
        <button id="xray-toggle" aria-pressed="false" class="dock-button">透视外壳</button>
      <div class="tour-control"><button id="tour-toggle" class="tour-toggle" aria-pressed="false" aria-describedby="tour-notice">自动导览</button><span id="tour-notice" class="tour-notice" aria-live="polite" hidden></span></div>
        <button id="inspector-toggle" class="dock-button" aria-expanded="false" aria-controls="inspector">结构工具</button>
        <button id="immersive-toggle" class="dock-button" aria-pressed="false">沉浸模式 <span aria-hidden="true">↗</span></button>
      </div>
      <div class="view-tools" id="view-controls" hidden role="group" aria-label="观察工具" tabindex="-1">
        <span class="view-tools-label">观察视角</span>
        <div class="view-presets">${VIEWS.map(v=>`<button data-view="${v.id}" aria-pressed="${v.id==='hero'}"><span>${v.number}</span>${v.name}</button>`).join('')}</div>
        <span class="tool-divider"></span>
        <button class="icon-button" id="reset" aria-label="回到初始视角" title="回到初始视角">${icon('reset')}</button>
      </div>
      <div class="loading" id="loading" role="status"><span class="loading-mark">H</span><span>正在组装城堡的形状…</span></div>
      <div class="error-state" id="error-state" role="alertdialog" aria-modal="true" aria-labelledby="error-heading" aria-describedby="error-message" tabindex="-1" hidden><p class="eyebrow">THE WORKSHOP IS PAUSED</p><h2 id="error-heading">暂时无法打开三维场景</h2><p id="error-message"></p><button id="retry">重新载入</button></div>
    </main>
    <footer class="page-footer"><p>${icon('orbit')}<span>拖动旋转 <i>·</i> 滚轮缩放 <i>·</i> 点击观察部件</span></p><p>外形参考研究 <span class="footer-separator">/</span> 内部结构为创意机械推演</p></footer>
    <aside id="parts-panel" class="parts-panel" role="dialog" aria-modal="true" aria-labelledby="parts-heading" hidden>
      <div class="panel-head"><div><p class="eyebrow">ANATOMY INDEX</p><h2 id="parts-heading">城堡的组成</h2></div><button id="close-panel" class="icon-button" aria-label="关闭部件索引">${icon('close')}</button></div>
      <p class="panel-intro">从整体到细节，逐一观察构成城堡的十四个结构组。</p>
      <div class="parts-list">${PARTS.map((p,i)=>`<button data-part="${p.id}" aria-pressed="false"><span class="part-number">${String(i+1).padStart(2,'0')}</span><span><strong>${p.name}</strong><small>${p.english}</small></span><span class="part-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>
      <p class="panel-foot">几何结构研究 · 关节与内部机构为创意推演</p>
    </aside>
    <div class="panel-scrim" id="panel-scrim" hidden></div>
    <div class="sr-only" id="announcement" aria-live="polite"></div>`;
  app.dataset.status='loading';app.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select').forEach(control=>control.disabled=true);
}

export function bindWorkshop(scene:WorkshopScene){
  const el=(id:string)=>document.getElementById(id)!;
  const panel=el('parts-panel'),toggle=el('index-toggle');
  const openPanel=(open:boolean)=>{panel.hidden=!open;el('panel-scrim').hidden=!open;toggle.setAttribute('aria-expanded',String(open));
    document.querySelectorAll<HTMLElement>('main,.masthead,.page-footer').forEach(node=>node.inert=open);
    if(open)el('close-panel').focus();else toggle.focus();};
  toggle.addEventListener('click',()=>openPanel(panel.hidden));el('close-panel').addEventListener('click',()=>openPanel(false));el('panel-scrim').addEventListener('click',()=>openPanel(false));
  document.addEventListener('keydown',e=>{
    if(panel.hidden)return;
    if(e.key==='Escape')openPanel(false);
    if(e.key==='Tab'){
      const items=panel.querySelectorAll<HTMLButtonElement>('button');const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  document.querySelectorAll<HTMLButtonElement>('button[data-view]').forEach(button=>button.addEventListener('click',()=>{
    scene.setView(button.dataset.view as ViewId);markView(button.dataset.view!);el('view-controls').hidden=true;el('views-toggle').setAttribute('aria-expanded','false');el('views-toggle').focus({preventScroll:true});
  }));
  function markView(view:string){document.querySelectorAll('button[data-view]').forEach(b=>b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.view===view)));}
  scene.onFreeView=()=>markView('');
  el('reset').setAttribute('aria-label','重置城堡姿态与视角，保留环境');el('reset').setAttribute('title','重置城堡姿态与视角，保留环境');
  el('reset').addEventListener('click',()=>{scene.reset();markView('hero');el('view-controls').hidden=true;el('views-toggle').setAttribute('aria-expanded','false');});
  el('zoom-in').addEventListener('click',()=>scene.zoom(.86));el('zoom-out').addEventListener('click',()=>scene.zoom(1.16));
  el('clear-selection').addEventListener('click',()=>scene.select(null));
  document.querySelectorAll<HTMLButtonElement>('[data-part]').forEach(button=>button.addEventListener('click',()=>{
    scene.select(button.dataset.part as PartId);openPanel(false);
  }));
  el('play-motion').addEventListener('click',()=>scene.setPlaying(!scene.clock.playing));
  el('reduce-motion').addEventListener('click',()=>scene.setReducedMotion(!scene.userReducedMotion));
  el('gait-speed').addEventListener('change',()=>scene.setSpeed(Number((el('gait-speed') as HTMLSelectElement).value)));
  el('gait-phase').addEventListener('input',()=>scene.seekCycles(Number((el('gait-phase') as HTMLInputElement).value)/1000));
  function setInspector(open:boolean){
    el('inspector').hidden=!open;el('app').classList.toggle('inspector-open',open);
    el('inspector-toggle').setAttribute('aria-expanded',String(open));
    if(open)el('close-inspector').focus({preventScroll:true});
  }
  let immersive=false,toolsOpen=false;
  function setImmersiveTools(open:boolean){
    toolsOpen=open;el('app').classList.toggle('immersive-tools-open',open);el('primary-tools').inert=immersive&&!open;
    el('immersive-tools-toggle').setAttribute('aria-expanded',String(open));el('immersive-tools-toggle').textContent=open?'收起操作 ⌄':'展开操作 ⌃';
    for(const id of ['zoom-in','zoom-out','views-toggle','selected-part'])el(id).inert=immersive&&!open;
    if(!open){el('view-controls').hidden=true;el('views-toggle').setAttribute('aria-expanded','false');}
  }
  el('immersive-tools-toggle').addEventListener('click',()=>setImmersiveTools(!toolsOpen));
  function setImmersive(on:boolean){
    immersive=on;if(on)setInspector(false);
    el('app').classList.toggle('immersive',on);el('immersive-tools-toggle').hidden=!on;setImmersiveTools(false);if(on){el('immersive-tools-toggle').focus({preventScroll:true});window.scrollTo({top:0});}
    el('immersive-toggle').setAttribute('aria-pressed',String(on));
    el('immersive-toggle').textContent=on?'退出沉浸 ↙':'沉浸模式 ↗';
  }
  el('inspector-toggle').addEventListener('click',()=>setInspector(el('inspector').hidden));
  el('close-inspector').addEventListener('click',()=>{setInspector(false);el('inspector-toggle').focus();});
  el('selected-part').addEventListener('click',()=>{if(immersive)setImmersive(false);setInspector(true);});
  el('immersive-toggle').addEventListener('click',()=>setImmersive(!immersive));
  el('explode-toggle').addEventListener('click',()=>scene.animateExplosion(scene.explosionTarget===1?0:1));
  el('views-toggle').addEventListener('click',()=>{const open=el('view-controls').hidden;el('view-controls').hidden=!open;el('views-toggle').setAttribute('aria-expanded',String(open));if(open)el('view-controls').querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});});
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||!panel.hidden)return;
    if(immersive){setImmersive(false);el('immersive-toggle').focus();}
    else if(!el('inspector').hidden){setInspector(false);el('inspector-toggle').focus();}
    el('view-controls').hidden=true;el('views-toggle').setAttribute('aria-expanded','false');
  });
  el('explode-amount').addEventListener('input',()=>scene.setExplode(Number((el('explode-amount') as HTMLInputElement).value)/1000));
  el('xray-toggle').addEventListener('click',()=>scene.setXray(!scene.castle.presentation.xray));
  el('isolate-toggle').addEventListener('click',()=>scene.setIsolate(!scene.castle.presentation.isolate));
  el('restore-parts').addEventListener('click',()=>scene.restorePresentation());
  el('tour-toggle').addEventListener('click',()=>scene.setTourEnabled(!scene.tour.enabled));
  document.querySelectorAll<HTMLButtonElement>('[data-limb]').forEach(button=>button.addEventListener('click',()=>scene.select(button.dataset.limb as PartId)));
  scene.onPose=(pose,clock)=>{
    el('reduce-motion').setAttribute('aria-pressed',String(scene.reducedMotion));(el('reduce-motion') as HTMLButtonElement).disabled=scene.systemReducedMotion;el('reduce-motion').title=scene.systemReducedMotion?'系统已开启减少动态效果':'关闭自动镜头和装饰晃动，保留主动操作';el('app').classList.toggle('reduced-motion',scene.reducedMotion);
    el('play-motion').setAttribute('aria-pressed',String(clock.playing));el('play-label').textContent=clock.playing?'暂停行走':'开始行走';
    (el('gait-speed') as HTMLSelectElement).value=String(clock.speed);
    (el('gait-phase') as HTMLInputElement).value=String(Math.round(pose.phase*1000));el('gait-percent').textContent=`${Math.round(pose.phase*100)}%`;
    for(const foot of pose.feet){const row=document.querySelector<HTMLElement>(`[data-limb="${foot.id}"]`)!;row.querySelector('.foot-contact')!.textContent=foot.contact?'支撑':'抬脚';row.querySelector('.foot-angle')!.textContent=`膝 ${foot.kneeAngle.toFixed(1)}°`;row.classList.toggle('is-swing',!foot.contact);}
  };
  scene.onPresentation=(state,selected)=>{
    el('explode-toggle').setAttribute('aria-pressed',String(scene.explosionTarget===1));el('explode-label').textContent=scene.explosionTarget===1?'合拢城堡':'拆开城堡';
    (el('explode-amount') as HTMLInputElement).value=String(Math.round(state.explode*1000));el('explode-percent').textContent=`${Math.round(state.explode*100)}%`;
    el('xray-toggle').setAttribute('aria-pressed',String(state.xray));el('isolate-toggle').setAttribute('aria-pressed',String(state.isolate));
    (el('isolate-toggle') as HTMLButtonElement).disabled=!selected;
    el('motion-disclaimer').textContent=state.explode>0?'拆解视图 · 接地读数对应完整机构':'设计步态 · 关节与参数为创意推演';
    el('isolate-hint').textContent=!selected?'先选择一个部件，再单独观察它。':state.isolate?'隔离中：清除选择或再次点击即可返回。':'已选中部件，可单独观察。';
  };
  scene.onTour=state=>{
    const button=el('tour-toggle') as HTMLButtonElement;button.disabled=state.reduced;button.setAttribute('aria-pressed',String(state.enabled));
    const label=state.active?'停止导览':state.enabled?'取消导览':'自动导览';if(button.textContent!==label)button.textContent=label;
    const notice=state.active?state.name:state.enabled?'已接管 · 闲置35秒后继续':'';const live=el('tour-notice');if(live.textContent!==notice)live.textContent=notice;live.hidden=!notice;
    button.title=state.reduced?'系统减少动态效果已启用，自动导览已关闭':state.enabled?'点击结束自动导览':'环绕外观、足部、脸部与内部结构';
  };
  scene.onSelect=id=>{
    const part=id?PART_MAP.get(id):null;
    el('note-number').textContent=`/ ${part?String(PARTS.indexOf(part)+1).padStart(3,'0'):'001'}`;
    el('note-category').textContent=part?.category||'机械与建筑之间';
    el('part-title').textContent=part?.name||'拼接而成的生命';
    el('part-english').textContent=part?.english||'An architecture of imagination';
    el('part-description').textContent=part?.description||'船腹般的机身托起层叠的小屋，四条鸟足撑住不规则的轮廓。试着拖动场景，从另一面认识它。';
    el('part-basis').textContent=part?.basis||'点击模型，观察独立部件';el('clear-selection').hidden=!part;
    el('observation').classList.toggle('has-selection',!!part);
    el('selected-part').hidden=!part;el('selected-part-name').textContent=part?.name||'';
    el('announcement').textContent=part?`已选中：${part.name}。${part.basis}`:'已清除选择';
    document.querySelectorAll('[data-part]').forEach(b=>b.setAttribute('aria-pressed',String((b as HTMLElement).dataset.part===id)));
  };
  el('loading').hidden=true;el('scene').setAttribute('aria-busy','false');
  document.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button,input,select').forEach(control=>control.disabled=false);el('app').dataset.status='ready';
  bindPortal(scene);scene.refreshState();
}
