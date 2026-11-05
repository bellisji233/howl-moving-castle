import * as T from 'three';
import type {Destination} from './Environment';

/** Everything that defines how one destination is lit. Transitions blend two
 * rigs field by field, so sun, sky, fog and exposure never snap. */
export interface LightRig{
  sunColor:string;sunIntensity:number;sunAzimuth:number;sunElevation:number;
  skyTop:string;skyHorizon:string;cloud:string;ground:string;clouds:number;sunGlow:number;
  hemiSky:string;hemiGround:string;hemiIntensity:number;
  fillColor:string;fillIntensity:number;rimColor:string;rimIntensity:number;
  envIntensity:number;exposure:number;fog:string;fogNear:number;fogFar:number;
  bloom:number;windowGlow:number;practical:number;shadowOpacity:number;
}

export const RIGS:Record<Destination,LightRig>={
  studio:{sunColor:'#fff1dc',sunIntensity:3.1,sunAzimuth:-35,sunElevation:50,
    skyTop:'#ece8de',skyHorizon:'#efebe2',cloud:'#efebe2',ground:'#d8d1c1',clouds:0,sunGlow:0,
    hemiSky:'#eef2ec',hemiGround:'#7d6b55',hemiIntensity:.55,fillColor:'#d3dfdc',fillIntensity:.55,rimColor:'#ffe6bd',rimIntensity:1,
    envIntensity:1,exposure:1,fog:'#efebe2',fogNear:52,fogFar:110,bloom:0,windowGlow:1,practical:0,shadowOpacity:.2},
  meadow:{sunColor:'#fff0cf',sunIntensity:3.3,sunAzimuth:-14,sunElevation:42,
    skyTop:'#5f97b8',skyHorizon:'#d3ddca',cloud:'#f8f0d9',ground:'#6f8650',clouds:1,sunGlow:1,
    hemiSky:'#c4dbe8',hemiGround:'#7d8a55',hemiIntensity:.95,fillColor:'#c8dce6',fillIntensity:.5,rimColor:'#fff0d0',rimIntensity:.8,
    envIntensity:.9,exposure:1.08,fog:'#bfcfc8',fogNear:40,fogFar:240,bloom:0,windowGlow:1,practical:0,shadowOpacity:.34},
  harbor:{sunColor:'#ffe8c4',sunIntensity:3.1,sunAzimuth:-48,sunElevation:34,
    skyTop:'#6a9cb9',skyHorizon:'#d8e0d6',cloud:'#f6efdc',ground:'#8c8a78',clouds:1,sunGlow:1,
    hemiSky:'#c0d6e2',hemiGround:'#857a64',hemiIntensity:.85,fillColor:'#c3d8e3',fillIntensity:.5,rimColor:'#fff0d4',rimIntensity:.9,
    envIntensity:.9,exposure:1.05,fog:'#b8c8c8',fogNear:45,fogFar:240,bloom:0,windowGlow:1,practical:0,shadowOpacity:.34},
  capital:{sunColor:'#ffb470',sunIntensity:3.2,sunAzimuth:-24,sunElevation:14,
    skyTop:'#5d6f8c',skyHorizon:'#f0b78a',cloud:'#e9b89c',ground:'#7d6656',clouds:1,sunGlow:1.6,
    hemiSky:'#a99fbe',hemiGround:'#5f4a3e',hemiIntensity:.6,fillColor:'#9fb2d8',fillIntensity:.55,rimColor:'#ffc58c',rimIntensity:1.2,
    envIntensity:.8,exposure:1,fog:'#c9a493',fogNear:38,fogFar:215,bloom:.32,windowGlow:2.4,practical:.7,shadowOpacity:.36},
  night:{sunColor:'#d4dcec',sunIntensity:1.05,sunAzimuth:58,sunElevation:38,
    skyTop:'#0c213d',skyHorizon:'#46636f',cloud:'#2a3d50',ground:'#1f2c28',clouds:0,sunGlow:0,
    hemiSky:'#5a6a80',hemiGround:'#2f3329',hemiIntensity:.62,fillColor:'#a0a9bc',fillIntensity:.35,rimColor:'#b9c6de',rimIntensity:.9,
    envIntensity:.5,exposure:1.06,fog:'#35505a',fogNear:48,fogFar:190,bloom:.6,windowGlow:4.2,practical:1.5,shadowOpacity:.3},
};

const COLOR_KEYS=['sunColor','skyTop','skyHorizon','cloud','ground','hemiSky','hemiGround','fillColor','rimColor','fog'] as const;
type ColorKey=typeof COLOR_KEYS[number];
export type MixedRig=Omit<LightRig,ColorKey>&Record<ColorKey,T.Color>;

export function mixedRig(id:Destination):MixedRig{
  const rig=RIGS[id],out={...rig} as unknown as MixedRig;
  for(const key of COLOR_KEYS)out[key]=new T.Color(rig[key]);
  return out;
}
/** Blends into `out`; colours mix in linear space, the sun takes the shorter way round. */
export function blendRig(out:MixedRig,a:Destination,b:Destination,t:number){
  const ra=RIGS[a],rb=RIGS[b];
  for(const key of Object.keys(ra) as (keyof LightRig)[]){
    if((COLOR_KEYS as readonly string[]).includes(key))continue;
    let from=ra[key] as number,to=rb[key] as number;
    if(key==='sunAzimuth'){const d=((to-from+540)%360)-180;to=from+d;}
    (out as unknown as Record<string,number>)[key]=from+(to-from)*t;
  }
  const ca=new T.Color(),cb=new T.Color();
  for(const key of COLOR_KEYS)out[key].copy(ca.set(ra[key])).lerp(cb.set(rb[key]),t);
  return out;
}
export function sunDirection(rig:{sunAzimuth:number;sunElevation:number},target=new T.Vector3()){
  const az=T.MathUtils.degToRad(rig.sunAzimuth),el=T.MathUtils.degToRad(rig.sunElevation);
  return target.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el));
}

/** Reflections come from each destination's own sky, so the castle's iron and
 * brass pick up the place it is standing in instead of a generic room. */
function skyEnvironmentScene(id:Destination){
  const rig=RIGS[id],scene=new T.Scene();
  const dome=new T.Mesh(new T.SphereGeometry(50,48,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,
    uniforms:{uTop:{value:new T.Color(rig.skyTop)},uHorizon:{value:new T.Color(rig.skyHorizon)},uGround:{value:new T.Color(rig.ground)}},
    vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vDir;uniform vec3 uTop,uHorizon,uGround;void main(){vec3 d=normalize(vDir);vec3 sky=mix(uHorizon,uTop,pow(clamp(d.y*1.5,0.,1.),.6));vec3 ground=mix(uHorizon,uGround*.7,smoothstep(0.,.22,-d.y));gl_FragColor=vec4(d.y>0.?sky:ground,1.);}`}));
  scene.add(dome);
  const sun=new T.Mesh(new T.SphereGeometry(id==='night'?1.6:2.6,16,8),new T.MeshBasicMaterial({color:new T.Color(rig.sunColor).multiplyScalar(id==='night'?3:rig.sunIntensity*2.4)}));
  sun.position.copy(sunDirection(rig).multiplyScalar(44));scene.add(sun);
  return scene;
}
/** Studio reflections come from soft boxes around a pale cyclorama, the same
 * arrangement product renders use: one large top panel, two strips, a front kicker. */
function studioEnvironmentScene(){
  const scene=new T.Scene();scene.background=new T.Color('#d8d4cb');
  const panel=(w:number,h:number,p:T.Vector3,k:number,tint='#fff7ec')=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(tint).multiplyScalar(k),side:T.DoubleSide}));m.position.copy(p);m.lookAt(0,0,0);scene.add(m);};
  panel(12,12,new T.Vector3(-2,14,3),2.6);panel(3,14,new T.Vector3(-12,4,6),3.2);panel(3,14,new T.Vector3(12,4,-4),2,'#eef3f6');panel(18,2,new T.Vector3(0,2,14),1.4);
  const floor=new T.Mesh(new T.CircleGeometry(40,32),new T.MeshBasicMaterial({color:'#c8c0b0',side:T.DoubleSide}));floor.rotation.x=-Math.PI/2;floor.position.y=-2;scene.add(floor);
  return scene;
}
export class EnvironmentMaps{
  private cache=new Map<Destination,T.Texture>();private pmrem:T.PMREMGenerator;
  constructor(renderer:T.WebGLRenderer){this.pmrem=new T.PMREMGenerator(renderer);}
  get(id:Destination){
    let texture=this.cache.get(id);
    if(!texture){
      const scene=id==='studio'?studioEnvironmentScene():skyEnvironmentScene(id);
      texture=this.pmrem.fromScene(scene,id==='studio'?.02:.035).texture;this.cache.set(id,texture);
      scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});
    }
    return texture;
  }
  dispose(){for(const texture of this.cache.values())texture.dispose();this.pmrem.dispose();}
}
