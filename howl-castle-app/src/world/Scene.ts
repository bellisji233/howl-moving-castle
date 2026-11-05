import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Castle } from './Castle';
import {EnvironmentWorld,DESTINATIONS,type Destination} from './Environment';
import {EnvironmentMaps,RIGS,mixedRig,blendRig,sunDirection,type MixedRig} from './Lighting';
import {RenderPipeline} from './Pipeline';
import type { PartId } from '../assets/parts';
import {derivePose,SimulationClock,GAIT,LEGS,type CastlePose} from '../simulation/derivePose';
import {AutoTour,type TourFrame} from '../tour/AutoTour';

export type ViewId='hero'|'front'|'left'|'rear'|'top';
const VIEWS:Record<ViewId,[number,number,number]>={hero:[24,14,34],front:[0,8.8,40],left:[-40,9.3,0],rear:[0,10.5,-40],top:[.01,44,.01]};
interface Move {start:number;from:T.Vector3;to:T.Vector3;targetFrom:T.Vector3;targetTo:T.Vector3;}
export const WORLD_TRANSITION_MS=2600;
const CAMERA_MOVE_MS=1150;
/** Quintic ease: zero velocity and acceleration at both ends, so shots settle instead of stopping. */
const smoother=(x:number)=>{const t=T.MathUtils.clamp(x,0,1);return t*t*t*(t*(t*6-15)+10);};

export class WorkshopScene {
  renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.PerspectiveCamera(32,1,.1,380);
  controls:OrbitControls;castle=new Castle();selected:PartId|null=null;
  onSelect:(id:PartId|null)=>void=()=>{};onFreeView:()=>void=()=>{};
  clock=new SimulationClock();pose=derivePose(0);
  userReducedMotion=false;
  onPose:(pose:CastlePose,clock:SimulationClock)=>void=()=>{};
  onPresentation:(state:{explode:number;xray:boolean;isolate:boolean},selected:PartId|null)=>void=()=>{};
  onTour:(state:{enabled:boolean;active:boolean;reduced:boolean;name:string})=>void=()=>{};
  tour=new AutoTour();private tourName='';private tourEntryExplode=0;
  private isolationCamera:{position:T.Vector3;target:T.Vector3;bodyZ:number}|null=null;
  private move:Move|null=null;private ray=new T.Raycaster();private pointer=new T.Vector2();
  private down={x:0,y:0};private dirty=true;private stateDirty=true;private raf=0;private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private lastReduced=this.reduced.matches;
  environment=new EnvironmentWorld(this.castle.materials);
  onEnvironment:(state:{current:Destination;target:Destination;changing:boolean;progress:number;needleAngle:number})=>void=()=>{};
  private destination:Destination='studio';private destinationTarget:Destination='studio';
  private environmentTime=0;
  private hemisphere!:T.HemisphereLight;
  private environmentMove:{start:number;from:Destination}|null=null;
  pipeline:RenderPipeline;private envMaps:EnvironmentMaps;private rig:MixedRig=mixedRig('studio');private envShown:Destination='studio';
  private practical=new T.PointLight('#ffb468',0,22,1.6);private aoRamp=0;private aoBox=new T.Box3();
  private disposed=false;
  private explosionMove:{from:number;to:number;start:number}|null=null;
  private resizeObserver:ResizeObserver;
  private lastTime=performance.now();private lastPublish=0;private followedZ=0;
  private frameDurations:number[]=[];private measuredSeconds=0;private lastMetrics=0;private gpuName='unavailable';
  private ground:T.Mesh;private lights:T.DirectionalLight[]=[];private footprints:T.InstancedMesh;
  private hiddenAt=0;
  private resetTime=()=>{const now=performance.now();if(document.hidden)this.hiddenAt=now;else if(this.hiddenAt){const gap=now-this.hiddenAt;if(this.tour.active)this.tour.started+=gap;if(this.tour.enabled)this.tour.lastInput+=gap;if(this.move)this.move.start+=gap;if(this.explosionMove)this.explosionMove.start+=gap;if(this.environmentMove)this.environmentMove.start+=gap;this.hiddenAt=0;}this.lastTime=now;};
  private trackInput=(event:Event)=>{if((event.target as HTMLElement)?.closest?.('#tour-toggle,#immersive-toggle,#explode-toggle,#destination-rail,#immersive-tools-toggle'))return;if(event instanceof KeyboardEvent&&event.key==='Escape'&&document.getElementById('app')?.classList.contains('immersive'))return;this.takeControl();this.renderer.domElement.dataset.inputLatencyMs=String(Math.max(0,performance.now()-event.timeStamp));};
  constructor(private container:HTMLElement){
    try{this.userReducedMotion=localStorage.getItem('howl-reduced-motion')==='1';}catch{/* Storage is optional in restricted/private browser contexts. */}
    this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
    this.renderer.setClearColor('#eeebe2');this.renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.25:1.5));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
    // Neutral keeps the authored rust, brass and roof colours; ACES pushed them toward grey-orange.
    this.renderer.toneMapping=T.NeutralToneMapping;this.renderer.toneMappingExposure=1;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.info.autoReset=false;
    this.pipeline=new RenderPipeline(this.renderer,this.scene,this.camera,innerWidth<700);this.envMaps=new EnvironmentMaps(this.renderer);
    const gl=this.renderer.getContext(),gpuInfo=gl.getExtension('WEBGL_debug_renderer_info');if(gpuInfo)this.gpuName=String(gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL));
    this.renderer.domElement.setAttribute('aria-label','可旋转和缩放的哈尔移动城堡三维模型；也可使用镜头按钮和部件索引进行观察');
    this.renderer.domElement.setAttribute('role','img');this.renderer.domElement.tabIndex=0;
    this.renderer.domElement.dataset.transition='idle';this.renderer.domElement.dataset.view='hero';
    this.container.append(this.renderer.domElement);
    this.scene.background=new T.Color('#eeebe2');
    this.scene.fog=new T.Fog('#eeebe2',48,100);
    this.hemisphere=new T.HemisphereLight('#e9f0eb','#776550',.55);this.scene.add(this.hemisphere);
    // One key light casts; fill and rim only shape. The key sits on a sphere so each destination can move the sun.
    const sun=new T.DirectionalLight('#fff0d9',3.1);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-12,right:12,top:15,bottom:-12,near:1,far:60});
    sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;sun.shadow.radius=4;this.scene.add(sun,sun.target);this.lights.push(sun);
    const fill=new T.DirectionalLight('#cddbd9',.55);fill.position.set(9,9,-8);this.scene.add(fill,fill.target);this.lights.push(fill);
    const rim=new T.DirectionalLight('#ffe6bd',1);rim.position.set(-4,12,-6);this.scene.add(rim,rim.target);this.lights.push(rim);
    const floor=new T.Mesh(new T.PlaneGeometry(180,180),new T.ShadowMaterial({color:'#3f392f',opacity:.2,depthWrite:false}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-.004;floor.receiveShadow=true;this.scene.add(floor);this.ground=floor;
    // Hearth and window light spilling onto the ground at dusk and night.
    this.practical.position.set(0,3.2,3.4);this.castle.body.add(this.practical);
    this.footprints=new T.InstancedMesh(new T.CircleGeometry(1,16),new T.MeshBasicMaterial({color:'#9ba38c',transparent:true,opacity:.22,depthWrite:false}),12);
    this.footprints.frustumCulled=false;this.scene.add(this.footprints);
    this.scene.add(this.castle.root,this.environment.root);
    this.pipeline.aoExclude=()=>[this.ground,this.footprints,...(this.environmentMove?[this.environment.root]:this.environment.aoExclude())];
    this.applyRig(this.rig,'studio');
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.target.set(0,6.0,0);this.camera.position.set(...VIEWS.hero);
    this.camera.position.sub(this.controls.target).multiplyScalar(.74).add(this.controls.target);
    this.controls.enableDamping=!this.reducedMotion;this.controls.dampingFactor=.09;
    this.controls.minDistance=13;this.controls.maxDistance=64;this.controls.minPolarAngle=.025;this.controls.maxPolarAngle=Math.PI*.48;
    this.controls.enablePan=false;this.controls.rotateSpeed=.65;this.controls.zoomSpeed=.75;
    this.controls.addEventListener('start',()=>{this.move=null;this.renderer.domElement.dataset.transition='idle';this.renderer.domElement.dataset.view='free';this.onFreeView();this.requestRender();});
    this.controls.addEventListener('change',()=>this.requestRender());
    this.renderer.domElement.addEventListener('pointerdown',e=>{this.down={x:e.clientX,y:e.clientY};});
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if(Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>5)return;
      const rect=this.renderer.domElement.getBoundingClientRect();
      this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      this.ray.setFromCamera(this.pointer,this.camera);
      const hits=this.ray.intersectObject(this.castle.root,true).filter(hit=>{let node:T.Object3D|null=hit.object;while(node){if(!node.visible)return false;node=node.parent;}return true;});
      if(hits[0]?.object.userData.portalControl){this.container.dispatchEvent(new CustomEvent('portalopen'));return;}
      const hit=(this.castle.presentation.xray?hits.find(h=>['FIRE','DRIVE'].includes(h.object.userData.partId)):null)||hits[0];
      this.select(hit?(hit.object.userData.partId as PartId):null);
    });
    this.renderer.domElement.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&document.getElementById('app')?.classList.contains('immersive'))return;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Escape','Home'].includes(e.key)){
        e.preventDefault();this.move=null;this.renderer.domElement.dataset.transition='idle';
        if(e.key==='Escape')this.select(null);
        else if(e.key==='Home')this.setView('hero');
        else if(e.key==='+'||e.key==='-')this.zoom(e.key==='+'?.88:1.12);
        else{
          const offset=this.camera.position.clone().sub(this.controls.target);const s=new T.Spherical().setFromVector3(offset);
          if(e.key==='ArrowLeft')s.theta-=.14;if(e.key==='ArrowRight')s.theta+=.14;
          if(e.key==='ArrowUp')s.phi=Math.max(.03,s.phi-.1);if(e.key==='ArrowDown')s.phi=Math.min(Math.PI*.48,s.phi+.1);
          this.camera.position.copy(this.controls.target).add(new T.Vector3().setFromSpherical(s));this.onFreeView();
        }
        this.controls.update();this.requestRender();
      }
    });
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.container.dispatchEvent(new CustomEvent('sceneerror',{detail:'三维画面暂时中断了，重新载入即可再次尝试。'}));});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
    this.controls.update();this.loop();
    this.renderer.domElement.dataset.sceneStats=JSON.stringify(this.stats());
    this.renderer.domElement.dataset.geometryAudit=JSON.stringify(this.auditGeometry());
    document.addEventListener('visibilitychange',this.resetTime);
    document.addEventListener('pointerdown',this.trackInput,true);document.addEventListener('keydown',this.trackInput,true);
  }
  private resize(){
    const w=this.container.clientWidth,h=this.container.clientHeight;this.camera.aspect=w/h;
    // Grid owns the available stage space. Keep a stable field of view when
    // an inspector opens; moving closer here would clip the chimney silhouette.
    this.camera.fov=32*T.MathUtils.clamp(.6/this.camera.aspect,1,1.35);
    this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.pipeline.setSize(w,h,this.renderer.getPixelRatio());this.requestRender();
  }
  private loop=()=>{
    this.raf=requestAnimationFrame(this.loop);
    const now=performance.now(),delta=Math.max(0,(now-this.lastTime)/1000);this.lastTime=now;
    if(this.lastReduced!==this.reducedMotion){this.lastReduced=this.reducedMotion;this.controls.enableDamping=!this.reducedMotion;this.refreshState();}
    if(!document.hidden){this.advanceTour(now);if(!this.reducedMotion)this.environmentTime+=delta;this.advanceEnvironment(now);}

    if(this.explosionMove&&!document.hidden){
      const move=this.explosionMove,t=Math.min(1,(now-move.start)/1400),ease=t*t*t*(t*(t*6-15)+10);
      this.setExplode(T.MathUtils.lerp(move.from,move.to,ease),false);
      if(t===1){this.explosionMove=null;this.renderer.domElement.dataset.explosionTransition='idle';}
    }
    if(this.clock.playing&&!document.hidden){this.clock.advance(delta);this.updatePose();this.dirty=true;this.frameDurations.push(delta*1000);if(this.frameDurations.length>18000)this.frameDurations.shift();this.measuredSeconds+=delta;}
    if(this.move&&!document.hidden){
      const u=Math.min(1,(performance.now()-this.move.start)/CAMERA_MOVE_MS);const eased=smoother(u);
      // Spherical interpolation preserves distance around the model; wide swings
      // also pull back mid-move so the camera arcs around the castle instead of skimming it.
      const a=new T.Spherical().setFromVector3(this.move.from.clone().sub(this.move.targetFrom));
      const b=new T.Spherical().setFromVector3(this.move.to.clone().sub(this.move.targetTo));
      let angle=b.theta-a.theta;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
      const sweep=Math.min(1,(Math.abs(angle)+Math.abs(b.phi-a.phi))/(Math.PI/2));
      const radius=T.MathUtils.lerp(a.radius,b.radius,eased),arc=Math.max(0,Math.max(a.radius,b.radius)*(1+.16*sweep)-radius)*Math.sin(Math.PI*eased);
      const s=new T.Spherical(radius+arc,T.MathUtils.lerp(a.phi,b.phi,eased),a.theta+angle*eased);
      this.controls.target.lerpVectors(this.move.targetFrom,this.move.targetTo,eased);
      this.camera.position.copy(this.controls.target).add(new T.Vector3().setFromSpherical(s));
      this.dirty=true;if(u===1){this.move=null;this.renderer.domElement.dataset.transition='idle';}
    }
    this.controls.update();
    this.environment.update(this.followedZ,this.environmentTime,!this.reducedMotion);
    if(this.environment.active==='harbor'&&!this.reducedMotion)this.dirty=true;
    if(this.aoRamp>0){this.aoRamp=Math.max(0,this.aoRamp-delta*2.2);this.updateAO();this.dirty=true;}
    if(this.dirty){this.renderFrame(now);this.renderer.domElement.dataset.sceneStats=JSON.stringify(this.stats());this.dirty=false;}
    if(now-this.lastPublish>100&&(this.clock.playing||this.stateDirty||this.tour.enabled)){this.publishPose();this.lastPublish=now;}
    if(now-this.lastMetrics>1000&&this.frameDurations.length){const sorted=[...this.frameDurations].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];this.renderer.domElement.dataset.framePerformance=JSON.stringify({samples:sorted.length,measuredSeconds:this.measuredSeconds,medianFps:1000/median,p95FrameMs:sorted[Math.floor(sorted.length*.95)],slowFrames:sorted.filter(t=>t>1000/30).length,stallsOver100ms:sorted.filter(t=>t>100).length,gpu:this.gpuName,viewport:[this.container.clientWidth,this.container.clientHeight],pixelRatio:this.renderer.getPixelRatio()});this.lastMetrics=now;}
  };
  focusMagicDoor(){
    this.takeControl();this.castle.root.updateMatrixWorld(true);
    const target=this.castle.magicDoor.root.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.9,0));
    const direction=new T.Vector3(-.6,.5,4).applyQuaternion(this.castle.magicDoor.root.getWorldQuaternion(new T.Quaternion()));
    this.controls.minDistance=2.8;this.moveCamera(target.clone().add(direction),target);this.onFreeView();
  }
  setDestination(id:Destination){
    if(id===this.destinationTarget&&!this.environmentMove)return;
    // A second choice mid-way lands the first one, then departs from there.
    if(this.environmentMove)this.finishEnvironment();
    if(id===this.destinationTarget)return;
    const from=this.destination;this.environment.prepare(id);this.destinationTarget=id;this.castle.magicDoor.choose(id);
    if(this.reducedMotion){this.destination=id;this.finishEnvironment();return;}
    this.envMaps.get(id);
    this.environment.beginReveal(from,id,this.seamColor(id));
    this.environmentMove={start:performance.now(),from};
    this.publishEnvironment(0);this.requestRender();
  }
  /** The seam is warm magic light tinted by the door colour of the place being opened. */
  private seamColor(id:Destination){return '#'+new T.Color('#ffcf7a').lerp(new T.Color(DESTINATIONS[id].color),.3).getHexString();}
  private applyRig(rig:MixedRig,envId:Destination){
    const [sun,fill,rim]=this.lights;
    sunDirection(rig,sun.position).multiplyScalar(30).add(sun.target.position);
    sun.color.copy(rig.sunColor);sun.intensity=rig.sunIntensity;
    // Low suns throw long shadows; widen the shadow box instead of clipping them.
    const reach=T.MathUtils.clamp(11/Math.tan(T.MathUtils.degToRad(Math.max(8,rig.sunElevation))),12,42),shadowCamera=sun.shadow.camera;
    if(Math.abs(shadowCamera.right-reach)>.5){Object.assign(shadowCamera,{left:-reach,right:reach,top:reach,bottom:-reach,far:30+reach*1.6});shadowCamera.updateProjectionMatrix();}
    fill.color.copy(rig.fillColor);fill.intensity=rig.fillIntensity;rim.color.copy(rig.rimColor);rim.intensity=rig.rimIntensity;
    this.hemisphere.color.copy(rig.hemiSky);this.hemisphere.groundColor.copy(rig.hemiGround);this.hemisphere.intensity=rig.hemiIntensity;
    const fog=this.scene.fog as T.Fog;fog.color.copy(rig.fog);fog.near=rig.fogNear;fog.far=rig.fogFar;
    (this.scene.background as T.Color).copy(rig.fog);
    this.renderer.toneMappingExposure=rig.exposure;this.pipeline.setBloom(rig.bloom);this.castle.setGlow(rig.windowGlow);this.practical.intensity=rig.practical*9;
    (this.ground.material as T.ShadowMaterial).opacity=rig.shadowOpacity;
    if(this.envShown!==envId||!this.scene.environment){this.scene.environment=this.envMaps.get(envId);this.envShown=envId;}
    this.scene.environmentIntensity=rig.envIntensity;this.ground.position.y=envId==='studio'?-.004:.025;
    this.updateAO();
  }
  private updateAO(){this.pipeline.setAO((this.castle.presentation.xray?.35:1)*(1-.55*this.aoRamp));}
  private finishEnvironment(){
    this.environmentMove=null;this.destination=this.destinationTarget;this.environment.show(this.destination);
    this.rig=mixedRig(this.destination);this.applyRig(this.rig,this.destination);this.aoRamp=this.reducedMotion?0:1;
    this.castle.magicDoor.update(1,this.reducedMotion);this.publishEnvironment(1);this.requestRender();
  }
  private advanceEnvironment(now:number){
    const move=this.environmentMove;if(!move)return;
    if(this.reducedMotion){this.finishEnvironment();return;}
    const t=Math.min(1,(now-move.start)/WORLD_TRANSITION_MS);this.castle.magicDoor.update(t,false);
    // The castle arrives first: its light changes while the front is still at its feet.
    const light=smoother(t/.55);blendRig(this.rig,move.from,this.destinationTarget,light);
    const envDip=1-.18*Math.sin(Math.PI*light);this.rig.envIntensity*=envDip;
    this.applyRig(this.rig,light<.5?move.from:this.destinationTarget);
    const front=smoother((t-.06)/.94);
    this.environment.setReveal(3+300*Math.pow(front,2.15),1.01-1.14*T.MathUtils.smoothstep(t,.32,1),1.1*Math.sin(Math.PI*Math.min(1,t*1.04)),T.MathUtils.smoothstep(t,.4,1));
    if(t>=.5)this.destination=this.destinationTarget;
    this.publishEnvironment(t);this.requestRender();
    if(t===1)this.finishEnvironment();
  }
  /** Render-time only: a slight pull-back during a world change, never written into the orbit state. */
  private renderFrame(now:number){
    this.renderer.info.reset();
    // AO only around the castle; at grazing angles far ground turns into a grey band.
    this.aoBox.min.set(-16,-1,this.followedZ-16);this.aoBox.max.set(16,16,this.followedZ+16);this.pipeline.gtao.setSceneClipBox(this.aoBox);
    const move=this.environmentMove;let restore:T.Vector3|null=null;
    if(move&&!this.reducedMotion&&!this.move){
      const t=Math.min(1,(now-move.start)/WORLD_TRANSITION_MS),k=Math.sin(Math.PI*smoother(t));
      restore=this.camera.position.clone();
      const offset=this.camera.position.clone().sub(this.controls.target);this.camera.position.copy(this.controls.target).add(offset.multiplyScalar(1+.07*k)).add(new T.Vector3(0,.9*k,0));
      this.camera.lookAt(this.controls.target);
    }
    this.pipeline.render();
    if(restore){this.camera.position.copy(restore);this.camera.lookAt(this.controls.target);}
  }
  private publishEnvironment(progress:number){
    const state={current:this.destination,target:this.destinationTarget,changing:this.environmentMove!==null,progress,needleAngle:this.castle.magicDoor.state().needleAngle,effect:this.environmentMove?'world-reveal':'idle'};
    this.renderer.domElement.dataset.environment=JSON.stringify({...state,...this.environment.stats(),door:this.castle.magicDoor.state(),fog:{near:(this.scene.fog as T.Fog).near,far:(this.scene.fog as T.Fog).far}});this.onEnvironment(state);
  }
  private updatePose(){
    this.pose=derivePose(this.clock.cycles,!this.reducedMotion);this.castle.applyPose(this.pose);this.castle.applyPresentation(this.selected);
    const z=this.pose.body.position[2],offset=z-this.followedZ;this.followedZ=z;
    this.camera.position.z+=offset;this.controls.target.z+=offset;
    if(this.move)for(const point of [this.move.from,this.move.to,this.move.targetFrom,this.move.targetTo])point.z+=offset;
    this.ground.position.z=z;
    for(const light of this.lights){light.position.z+=offset;light.target.position.z+=offset;}
    const dummy=new T.Object3D();let instance=0;
    for(const leg of LEGS)for(let ago=0;ago<3;ago++){
      const step=Math.floor(this.clock.cycles+leg.offset)-ago;
      dummy.position.set(leg.side*(leg.front?2.72:3),.005,(step-leg.offset+GAIT.stance/2)*GAIT.stride+(leg.front?2.17:-.93)+.4);
      dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(.17,.37,1);dummy.updateMatrix();this.footprints.setMatrixAt(instance++,dummy.matrix);
    }
    this.footprints.instanceMatrix.needsUpdate=true;
    this.footprints.visible=this.castle.presentation.explode===0&&!this.castle.presentation.isolate;
    this.castle.root.updateMatrixWorld(true);this.requestRender();
  }
  private publishPose(){
    const actualFeet=this.pose.feet.map(foot=>{const p=new T.Vector3();this.castle.limbs.get(foot.id)!.foot.getWorldPosition(p);return{id:foot.id,contact:foot.contact,phase:foot.phase,ankle:foot.ankle,renderedAnkle:p.toArray(),hipAngle:foot.hipAngle,kneeAngle:foot.kneeAngle};});
    this.renderer.domElement.dataset.simulation=JSON.stringify({cycles:this.clock.cycles,phase:this.pose.phase,playing:this.clock.playing,speed:this.clock.speed,body:this.pose.body,feet:actualFeet});
    this.onPose(this.pose,this.clock);
    this.publishPresentation();this.publishTour();this.publishEnvironment(this.environmentMove?Math.min(1,(performance.now()-this.environmentMove.start)/WORLD_TRANSITION_MS):1);
    this.stateDirty=false;
  }
  private publishPresentation(){
    const parts=[...this.castle.parts].map(([id,g])=>{const opacities=new Set<number>(),materialModes=new Set<string>(),meshMatrices:number[][]=[];g.traverse(o=>{if(o instanceof T.Mesh){const material=o.material as T.MeshStandardMaterial;opacities.add(material.opacity);materialModes.add(`${material.transparent}:${material.depthWrite}`);if(!this.clock.playing)meshMatrices.push(o.matrixWorld.toArray());}});return{id,visible:g.visible,position:g.position.toArray(),matrix:g.matrixWorld.toArray(),opacities:[...opacities],materialModes:[...materialModes],meshMatrices:this.clock.playing?undefined:meshMatrices};});
    this.renderer.domElement.dataset.presentation=JSON.stringify({...this.castle.presentation,selected:this.selected,parts});
    this.onPresentation(this.castle.presentation,this.selected);
  }
  private publishTour(){const state={enabled:this.tour.enabled,active:this.tour.active,reduced:this.reducedMotion,name:this.tourName,idleMs:Math.max(0,performance.now()-this.tour.lastInput)};this.renderer.domElement.dataset.tour=JSON.stringify(state);this.onTour(state);}
  get reducedMotion(){return this.reduced.matches||this.userReducedMotion;}
  get systemReducedMotion(){return this.reduced.matches;}
  setReducedMotion(on:boolean){this.takeControl();this.userReducedMotion=on;try{localStorage.setItem('howl-reduced-motion',on?'1':'0');}catch{/* The control still works without persistent storage. */}this.lastReduced=this.reducedMotion;this.controls.enableDamping=!this.reducedMotion;if(this.reducedMotion){this.tour.disable();this.move=null;this.renderer.domElement.dataset.transition='idle';}this.refreshState();}
  takeControl(){this.explosionMove=null;this.renderer.domElement.dataset.explosionTransition='idle';this.tour.interrupt(performance.now());this.move=null;this.renderer.domElement.dataset.transition='idle';this.publishTour();}
  setTourEnabled(enabled:boolean){if(enabled&&!this.reducedMotion){this.tourEntryExplode=this.castle.presentation.explode;this.isolationCamera=null;this.tour.enable(performance.now());this.clock.playing=true;this.lastTime=performance.now();}else this.tour.disable();this.publishTour();}
  private advanceTour(now:number){
    if(this.reducedMotion&&this.tour.enabled){this.tour.disable();this.publishTour();return;}
    const wasActive=this.tour.active,frame=this.tour.tick(now);if(!frame)return;
    if(!wasActive){this.tourEntryExplode=this.castle.presentation.explode;this.clock.playing=true;this.publishTour();}
    if(frame.step===0){const u=Math.min(1,(now-this.tour.started)/700);frame.explode=this.tourEntryExplode*(1-u*u*(3-2*u));}
    if(frame.step!==this.tour.step){
      this.tour.step=frame.step;this.tourName=frame.name;this.select(frame.part,false);this.setIsolate(frame.isolate,false);this.setXray(frame.xray,false);this.setExplode(frame.explode,false);
      if(frame.step===1||frame.step===2)this.focusPart(frame.part!);
      else if(frame.step!==4)this.setView(frame.view);
      this.publishTour();
    }
    this.setExplode(frame.explode,false);
  }
  private focusPart(id:PartId){
    this.castle.root.updateMatrixWorld(true);const target=new T.Box3().setFromObject(this.castle.parts.get(id)!).getCenter(new T.Vector3());
    const to=target.clone().add(id.endsWith('_LIMB')?new T.Vector3(-9,4,13):new T.Vector3(9,4.5,16));
    this.moveCamera(to,target);this.renderer.domElement.dataset.view='detail';this.onFreeView();
  }
  get explosionTarget(){return this.explosionMove?.to??(this.castle.presentation.explode>.5?1:0);}
  animateExplosion(target:number){
    this.takeControl();
    if(this.reducedMotion){this.setExplode(target,false);return;}
    this.explosionMove={from:this.castle.presentation.explode,to:T.MathUtils.clamp(target,0,1),start:performance.now()};
    this.renderer.domElement.dataset.explosionTransition='moving';this.requestRender();
  }
  setExplode(value:number,user=true){
    if(user)this.takeControl();const amount=T.MathUtils.clamp(value,0,1),previous=this.castle.presentation.explode;if(amount===previous)return;
    const ratio=(1+.4*amount)/(1+.4*previous),dy=(amount-previous)*1.5;
    const adjust=(position:T.Vector3,target:T.Vector3)=>{position.sub(target).multiplyScalar(ratio);target.y+=dy;position.add(target);};
    adjust(this.camera.position,this.controls.target);if(this.move){adjust(this.move.from,this.move.targetFrom);adjust(this.move.to,this.move.targetTo);}
    this.castle.presentation.explode=amount;this.refreshState();
  }
  setXray(on:boolean,user=true){if(user)this.takeControl();if(this.castle.presentation.xray===on)return;this.castle.presentation.xray=on;this.updateAO();this.refreshState();}
  setIsolate(on:boolean,user=true){
    if(user)this.takeControl();const was=this.castle.presentation.isolate;
    if(user&&on&&!was)this.isolationCamera={position:this.camera.position.clone(),target:this.controls.target.clone(),bodyZ:this.followedZ};
    this.castle.presentation.isolate=on&&this.selected!==null;this.refreshState();
    if(user&&this.castle.presentation.isolate)this.focusPart(this.selected!);
    else if(user&&was&&this.isolationCamera){const saved=this.isolationCamera,offset=this.followedZ-saved.bodyZ;const to=saved.position.clone(),targetTo=saved.target.clone();to.z+=offset;targetTo.z+=offset;this.moveCamera(to,targetTo);this.isolationCamera=null;}
  }
  restorePresentation(){this.takeControl();this.isolationCamera=null;this.castle.presentation.isolate=false;this.castle.presentation.xray=false;this.setExplode(0);this.refreshState();this.setView('hero');}
  refreshState(){this.updatePose();this.publishPose();}
  setPlaying(playing:boolean){this.takeControl();this.clock.playing=playing;this.lastTime=performance.now();this.publishPose();this.requestRender();}
  setSpeed(speed:number){this.takeControl();this.clock.setSpeed(speed);this.publishPose();}
  seekCycles(cycles:number){this.takeControl();if(!Number.isFinite(cycles)||cycles<0)throw new Error('Invalid cycle');this.clock.cycles=cycles;this.clock.playing=false;this.refreshState();}
  reset(){this.tour.disable();this.clock.reset();this.frameDurations=[];this.measuredSeconds=0;delete this.renderer.domElement.dataset.framePerformance;this.restorePresentation();this.refreshState();this.select(null);this.setView('hero');}
  requestRender(){this.dirty=true;this.stateDirty=true;}
  private moveCamera(to:T.Vector3,target:T.Vector3,immediate=false){if(immediate||this.reducedMotion){this.move=null;this.controls.target.copy(target);this.camera.position.copy(to);this.controls.update();this.renderer.domElement.dataset.transition='idle';}else{this.move={start:performance.now(),from:this.camera.position.clone(),to,targetFrom:this.controls.target.clone(),targetTo:target};this.renderer.domElement.dataset.transition='moving';}this.requestRender();}
  setView(view:ViewId,immediate=false){
    this.controls.minDistance=13;
    const target=new T.Vector3(0,6.0+1.5*this.castle.presentation.explode,this.followedZ);const to=new T.Vector3(...VIEWS[view]).sub(new T.Vector3(0,6,0));
    to.multiplyScalar(.74*(1+.4*this.castle.presentation.explode)).add(target);
    this.renderer.domElement.dataset.view=view;
    this.moveCamera(to,target,immediate);
  }
  zoom(factor:number){this.move=null;this.renderer.domElement.dataset.transition='idle';this.renderer.domElement.dataset.view='free';this.onFreeView();const offset=this.camera.position.clone().sub(this.controls.target);offset.multiplyScalar(factor).clampLength(13,64);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();this.requestRender();}
  select(id:PartId|null,user=true){if(user)this.takeControl();const was=this.castle.presentation.isolate;this.selected=id;if(!id&&was)this.setIsolate(false,user);this.castle.select(id);this.castle.applyPresentation(id);this.onSelect(id);this.publishPresentation();this.requestRender();}
  stats(){
    let vertices=0,triangles=0,meshes=0;
    this.castle.root.traverse(o=>{if(o instanceof T.Mesh){meshes++;const g=o.geometry;vertices+=g.getAttribute('position').count;triangles+=(g.index?g.index.count:g.getAttribute('position').count)/3;}});
    return{vertices,triangles,meshes,parts:this.castle.parts.size,drawCalls:this.renderer.info.render.calls,renderer:this.renderer.getContext().getParameter(this.renderer.getContext().RENDERER),gpu:this.gpuName};
  }
  private auditGeometry(){
    let nonFiniteValues=0;
    const parts=[...this.castle.parts].map(([id,group])=>{
      let triangles=0;
      group.traverse(o=>{if(o instanceof T.Mesh){const positions=o.geometry.getAttribute('position');for(let i=0;i<positions.array.length;i++)if(!Number.isFinite(positions.array[i]))nonFiniteValues++;triangles+=(o.geometry.index?o.geometry.index.count:positions.count)/3;}});
      const bounds=new T.Box3().setFromObject(group);
      return{id,triangles,empty:bounds.isEmpty(),min:bounds.min.toArray(),max:bounds.max.toArray()};
    });
    return{parts,nonFiniteValues,allPartsHaveGeometry:parts.every(p=>!p.empty&&p.triangles>0)};
  }
  dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);document.removeEventListener('visibilitychange',this.resetTime);document.removeEventListener('pointerdown',this.trackInput,true);document.removeEventListener('keydown',this.trackInput,true);this.resizeObserver.disconnect();this.controls.dispose();this.pipeline.dispose();this.envMaps.dispose();this.renderer.dispose();}
}
