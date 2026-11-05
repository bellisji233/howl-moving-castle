import * as T from 'three';
import type {Materials} from './materials';
import {box,rod,lathe,extrude,mergePart,type Vec} from './geometry';
import {LandscapeAssets,villageHouse,randomFrom} from './LandscapeAssets';
import {RIGS,sunDirection} from './Lighting';
import {revealUniforms,patchReveal,REVEAL_VERTEX_HEAD,REVEAL_FRAGMENT_HEAD,REVEAL_FOLD,REVEAL_DISCARD,REVEAL_SEAM,type RevealUniforms} from './Reveal';
export type Destination='studio'|'meadow'|'harbor'|'capital'|'night';
export const DESTINATIONS:Record<Destination,{name:string;short:string;color:string}>={
 studio:{name:'结构工坊',short:'工坊',color:'#b7ad8c'},
 meadow:{name:'荒地与花田',short:'花田',color:'#729559'},
 harbor:{name:'港口城市',short:'港口',color:'#4d7f9b'},
 capital:{name:'王都暮色',short:'王都',color:'#b06651'},
 night:{name:'星夜小屋',short:'星夜',color:'#303c51'},
};
export const DESTINATION_ORDER:Destination[]=['studio','meadow','harbor','capital','night'];
const PI=Math.PI;
const height=(x:number,z:number)=>{
 const mask=T.MathUtils.smoothstep(Math.abs(x),8,35);
 return mask*(2.8+2.2*Math.sin(x*.053+z*PI/80)+1.4*Math.cos(z*PI/40-x*.047)+.7*Math.sin(x*.21+z*PI/20))+T.MathUtils.smoothstep(Math.abs(x),65,160)*(10+8*Math.sin(x*.025+z*PI/80)**2);
};
const cottageX=-26,cottageZ=-18;
const terrainHeight=(x:number,z:number,night:boolean)=>{const h=height(x,z);return night?T.MathUtils.lerp(height(cottageX,cottageZ),h,T.MathUtils.smoothstep(Math.hypot(x-cottageX,z-cottageZ),5.8,11)):h;};
const mat=(c:string)=>new T.MeshStandardMaterial({color:c,roughness:1});
interface World{root:T.Group;tiles:T.Group[];sky:T.Mesh;backdrop?:T.Group;water?:T.ShaderMaterial;stars?:T.Points;reveal:RevealUniforms;aoExclude:T.Object3D[];}
function skyDome(id:Destination,reveal:RevealUniforms){
 const rig=RIGS[id];
 const sky=new T.Mesh(new T.SphereGeometry(265,48,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,
  uniforms:{uTop:{value:new T.Color(rig.skyTop)},uHorizon:{value:new T.Color(rig.skyHorizon)},uCloud:{value:new T.Color(rig.cloud)},uClouds:{value:rig.clouds},uGlow:{value:rig.sunGlow},uSun:{value:sunDirection(rig)},uSunColor:{value:new T.Color(rig.sunColor)},
   uSkyCut:reveal.uSkyCut,uRevealSide:reveal.uRevealSide,uRevealActive:reveal.uRevealActive,uRevealColor:reveal.uRevealColor,uRevealGlow:reveal.uRevealGlow},
  vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec3 vDir;uniform vec3 uTop,uHorizon,uCloud,uSun,uSunColor,uRevealColor;uniform float uClouds,uGlow,uSkyCut,uRevealSide,uRevealActive,uRevealGlow;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}float fbm(vec2 p){return n(p)*.53+n(p*2.03)*.27+n(p*4.01)*.13+n(p*8.1)*.07;}
 void main(){vec3 d=normalize(vDir);
  // The new sky closes over from the zenith while the ground front runs outward.
  if(uRevealActive>.5&&(uRevealSide>.5?d.y<uSkyCut:d.y>uSkyCut))discard;
  float h=max(0.,d.y);vec3 color=mix(uHorizon,uTop,pow(clamp(h*1.6,0.,1.),.55));
  vec2 uv=d.xz/max(.10,d.y+.16)*1.8;float cloud=smoothstep(.53,.73,fbm(uv+vec2(7,2)))*smoothstep(.01,.16,d.y);float light=fbm(uv*.7+10.);
  color=mix(color,mix(uHorizon,uCloud,.65+light*.35),cloud*uClouds*.88);
  float sunDot=max(0.,dot(d,normalize(uSun)));color+=uSunColor*(pow(sunDot,14.)*.14+pow(sunDot,900.)*1.6)*uGlow;
  color+=uRevealColor*uRevealGlow*uRevealActive*exp(-abs(d.y-uSkyCut)*38.)*.7;
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`}));
 sky.renderOrder=-5;return sky;
}
/** A painted backdrop range: unlit, colours pre-mixed toward the horizon for distance. */
function ridgeRing(id:Destination,seed:number,radius:number,peak:number,base:string,haze:number,snow:string|null){
 const rig=RIGS[id],r=randomFrom(seed),segments=240,pos:number[]=[],col:number[]=[];
 const freq=[2,5,9,17,31,57],amp=[.32,.26,.18,.12,.08,.04],phase=freq.map(()=>r()*PI*2);
 const heightAt=(a:number)=>{let h=0;for(let k=0;k<freq.length;k++)h+=amp[k]*(1-Math.abs(Math.sin(a*freq[k]*.5+phase[k])));return h;};
 const horizon=new T.Color(rig.skyHorizon),body=new T.Color(base).lerp(horizon,haze),foot=body.clone().lerp(horizon,.55),cap=snow?new T.Color(snow).lerp(horizon,haze*.7):body,c=new T.Color();
 for(let i=0;i<segments;i++){
  const a0=i/segments*PI*2,a1=(i+1)/segments*PI*2,h0=heightAt(a0),h1=heightAt(a1);
  const v=(a:number,y:number)=>[Math.cos(a)*radius,y,Math.sin(a)*radius];
  const top=(h:number)=>{c.copy(body).lerp(cap,T.MathUtils.smoothstep(h,.58,.78));return[c.r,c.g,c.b];};
  // Rows, not one tall quad: colour follows absolute height, so the snow line stays level.
  const rows=[0,.45,.62,.74,.86,1],shade=(y:number)=>{const k=T.MathUtils.clamp((y+6)/(peak*.55+6),0,1);const [r0,g0,b0]=top(y/peak);c.setRGB(r0,g0,b0).lerp(foot,1-k);return[c.r,c.g,c.b];};
  for(let j=0;j<rows.length-1;j++){
   const y00=-6+(h0*peak+6)*rows[j],y01=-6+(h0*peak+6)*rows[j+1],y10=-6+(h1*peak+6)*rows[j],y11=-6+(h1*peak+6)*rows[j+1];
   pos.push(...v(a0,y00),...v(a0,y01),...v(a1,y11),...v(a0,y00),...v(a1,y11),...v(a1,y10));
   col.push(...shade(y00),...shade(y01),...shade(y11),...shade(y00),...shade(y11),...shade(y10));
  }
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));
 const m=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,fog:false,side:T.DoubleSide}));m.renderOrder=-4;return m;
}
/** The royal palace closes the boulevard vista; unlit and hazed like the ranges. */
function palace(id:Destination){
 const rig=RIGS[id],g=new T.Group(),horizon=new T.Color(rig.skyHorizon);
 const tone=(c:string,k:number)=>new T.MeshBasicMaterial({color:new T.Color(c).lerp(horizon,k),fog:false});
 const wall=tone('#d6b294',.52),shade=tone('#8f7064',.55),roof=tone('#56697c',.5),gold=tone('#e2b56a',.42),lit=tone('#ffc77d',.35);
 box(g,shade,[0,2,0],[110,4,26]);
 box(g,wall,[0,13,0],[48,18,16]);box(g,shade,[0,22.6,0],[49,1.2,17]);
 for(const side of [-1,1]){box(g,wall,[side*38,9,3],[28,14,12]);box(g,roof,[side*38,17,3],[29,2.2,13]);for(let i=0;i<7;i++)box(g,lit,[side*(27+i*3.6),11,9.1],[1.1,2.2,.2]);}
 for(let i=0;i<11;i++){box(g,lit,[-20+i*4,16,8.1],[1.4,3,.2]);box(g,lit,[-20+i*4,10,8.1],[1.4,3,.2]);}
 lathe(g,wall,[[10,23],[10,33],[10.6,33.6]]);lathe(g,roof,[[10.6,33.6],[9.6,38],[7,42.5],[3.6,45],[.1,45.8]]);
 lathe(g,gold,[[1.6,45.4],[1.8,48],[.6,50],[.05,55]]);
 for(const [x,z] of [[-22,-6],[22,-6],[-22,7],[22,7],[-52,4],[52,4]] as [number,number][]){
  const tall=Math.abs(x)<30?34:26;rod(g,wall,[x,0,z],[x,tall,z],3.2);rod(g,shade,[x,tall,z],[x,tall+1,z],3.6);
  lathe(g,roof,[[3.4,tall+1],[.1,tall+12]],[x,0,z]);rod(g,gold,[x,tall+12,z],[x,tall+15,z],.25);
 }
 mergePart(g);g.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=false;o.renderOrder=-3;}});
 return g;
}
function flowerGeometry(){const p:number[]=[],n:number[]=[];const tri=(a:Vec,b:Vec,c:Vec)=>{p.push(...a,...b,...c);for(let k=0;k<3;k++)n.push(0,1,0);};for(let i=0;i<5;i++){const a=i*PI*2/5,b=a+.48;const v=(r:number,t:number,y:number):Vec=>[Math.cos(t)*r,y,Math.sin(t)*r];tri([0,0,0],v(.17,a,.04),v(.25,b,.09));tri([0,0,0],v(.25,b,.09),v(.17,a+.96,.04));}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));return g;}
function grassGeometry(){const p:number[]=[];for(let j=0;j<3;j++){const a=j*PI/3,c=Math.cos(a),s=Math.sin(a);p.push(-.045*c,0,-.045*s,.045*c,0,.045*s,.10*c,.30+j*.04,.10*s);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;}
function addPlants(tile:T.Group,assets:LandscapeAssets,night:boolean,seed:number){
 const random=randomFrom(seed),dummy=new T.Object3D(),color=new T.Color();
 const blades=new T.InstancedMesh(grassGeometry(),new T.MeshStandardMaterial({color:night?'#486857':'#718f55',side:T.DoubleSide,roughness:1}),2900);
 const blossoms=new T.InstancedMesh(flowerGeometry(),new T.MeshStandardMaterial({color:'#fff',side:T.DoubleSide,roughness:1}),1100);
 for(let i=0;i<2900;i++){
  const side=i%2?1:-1,x=side*(5.5+Math.pow(random(),1.7)*(i<1100?17:45)),z=(random()-.5)*158;let h=terrainHeight(x,z,night);
  const avoid=night&&Math.hypot(x-cottageX,z-cottageZ)<5.6;
  dummy.position.set(x,h-.01,z);dummy.rotation.set(0,random()*PI*2,(random()-.5)*.2);dummy.scale.setScalar(avoid?0:.5+random()*1.3);dummy.updateMatrix();blades.setMatrixAt(i,dummy.matrix);
  color.setHSL(.20+random()*.075,.22+random()*.18,.27+random()*.20);blades.setColorAt(i,color);
  if(i<1100){dummy.position.y=h+.18+random()*.25;dummy.rotation.x=(random()-.5)*.5;dummy.scale.setScalar(avoid?0:.5+random()*.8);dummy.updateMatrix();blossoms.setMatrixAt(i,dummy.matrix);color.set(['#e7d9b6','#e7b9b6','#f1e8b2','#b2b5d3','#f0ead2'][i%5]);blossoms.setColorAt(i,color);}
 }
 blades.instanceMatrix.needsUpdate=blossoms.instanceMatrix.needsUpdate=true;if(blades.instanceColor)blades.instanceColor.needsUpdate=true;if(blossoms.instanceColor)blossoms.instanceColor.needsUpdate=true;tile.add(blades,blossoms);
}
function addTrees(parent:T.Group,assets:LandscapeAssets,night:boolean){
 const r=randomFrom(night?33:711),leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),assets.leaf,600),dummy=new T.Object3D(),color=new T.Color();let q=0;
 for(let i=0;i<24;i++){
  const x=(i%2?1:-1)*(34+r()*65),z=-76+r()*152,y=terrainHeight(x,z,night),h=3+r()*4;
  if(night&&Math.hypot(x-cottageX,z-cottageZ)<12)continue;
  rod(parent,assets.bark,[x,y,z],[x+.15,y+h,z],.19,.07);
  for(let j=0;j<3;j++){const a=j*2.1+r();rod(parent,assets.bark,[x,y+h*.55,z],[x+Math.cos(a)*1.5,y+h*.9,z+Math.sin(a)*1.5],.055,.02);}
  for(let j=0;j<25;j++){
   const a=r()*PI*2,rr=Math.sqrt(r())*(i%3===0?1.15:2.4);dummy.position.set(x+Math.cos(a)*rr,y+h-.6+r()*(i%3===0?3.2:1.6),z+Math.sin(a)*rr);dummy.scale.set(.65+r()*.8,.65+r()*(i%3===0?1.1:.65),.65+r()*.8);dummy.rotation.set(r(),r(),r());dummy.updateMatrix();leaves.setMatrixAt(q,dummy.matrix);color.setHSL(.21+r()*.055,.22+r()*.1,.23+r()*.14);leaves.setColorAt(q,color);q++;
  }
 }
 leaves.count=q;parent.add(leaves);
}
function addShip(g:T.Group,a:LandscapeAssets,x:number,z:number,scale=1,turn=0){
 const s=new T.Group();s.position.set(x,-.18,z);s.rotation.y=turn;s.scale.setScalar(scale);g.add(s);
 const hull=new T.Shape();hull.moveTo(0,-5.8);hull.bezierCurveTo(1.7,-4,2,0,1.7,3.8);hull.quadraticCurveTo(1.1,5.2,0,5.9);hull.quadraticCurveTo(-1.1,5.2,-1.7,3.8);hull.bezierCurveTo(-2,0,-1.7,-4,0,-5.8);
 const geo=new T.ExtrudeGeometry(hull,{depth:1.05,bevelEnabled:true,bevelSize:.28,bevelThickness:.25,bevelSegments:2,steps:1});geo.rotateX(-PI/2);const body=new T.Mesh(geo,a.timber);body.position.y=.15;s.add(body);
 box(s,a.ink,[0,1.17,0],[3.35,.09,8.8]);box(s,a.timber,[0,1.23,0],[3.15,.08,8.6]);
 for(const side of [-1,1]){rod(s,a.timber,[side*1.55,1.2,-3.8],[side*1.55,1.7,-3.8],.055);rod(s,a.timber,[side*1.55,1.7,-3.8],[side*1.5,1.7,3.8],.07);}
 box(s,a.walls[3],[0,1.7,2.7],[1.7,1,1.8]);box(s,a.roofs[2],[0,2.25,2.7],[1.95,.12,2]);
 for(const mz of [-2.3,1.4]){
  rod(s,a.timber,[0,1.2,mz],[0,9.2,mz],.075,.045);
  for(const level of [4.5,7.5]){
   rod(s,a.ink,[-2.9,level,mz],[2.9,level,mz],.045);
   const sail=new T.Shape([new T.Vector2(-2.7,0),new T.Vector2(2.7,0),new T.Vector2(2.1,-2.1),new T.Vector2(-2.1,-2.1)]);const sg=new T.ShapeGeometry(sail,8);const sp=sg.getAttribute('position');for(let i=0;i<sp.count;i++)sp.setZ(i,Math.sin((sp.getX(i)+2.7)/5.4*PI)*.4);sg.computeVertexNormals();const sm=new T.Mesh(sg,a.sail);sm.position.set(0,level-.08,mz);s.add(sm);
  }
  for(const side of [-1,1])rod(s,a.ink,[side*1.4,1.6,mz+2],[0,8.8,mz],.016);
 }
}
export class EnvironmentWorld{
 root=new T.Group();active:Destination='studio';previous:Destination|null=null;private worlds=new Map<Destination,World>();private palettes=new Map<boolean,LandscapeAssets>();
 constructor(private library?:Materials){this.root.name='DESTINATION_LANDSCAPES';this.show('studio');}
 prepare(id:Destination){if(!this.worlds.has(id)){const w=id==='studio'?this.buildStudio():this.build(id);this.worlds.set(id,w);this.root.add(w.root);w.root.visible=false;}}
 show(id:Destination){this.prepare(id);for(const [k,w]of this.worlds){w.root.visible=k===id;w.reveal.uRevealActive.value=0;w.reveal.uRevealGlow.value=0;if(w.stars)(w.stars.material as T.PointsMaterial).opacity=.86;}this.active=id;this.previous=null;}
 /** Both worlds stay live; the arriving one grows outward from the castle. */
 beginReveal(from:Destination,to:Destination,color:string){
  this.prepare(from);this.prepare(to);
  for(const [k,w]of this.worlds){w.root.visible=k===from||k===to;const u=w.reveal;u.uRevealActive.value=w.root.visible?1:0;u.uRevealSide.value=k===to?1:0;u.uRevealRadius.value=0;u.uSkyCut.value=1.01;u.uRevealColor.value.set(color);}
  this.previous=from;this.active=to;
 }
 setReveal(radius:number,skyCut:number,glow:number,skyMix:number){
  for(const id of [this.previous,this.active]){if(!id)continue;const w=this.worlds.get(id)!,u=w.reveal;u.uRevealRadius.value=radius;u.uSkyCut.value=skyCut;u.uRevealGlow.value=glow;
   if(w.stars)(w.stars.material as T.PointsMaterial).opacity=.86*(id===this.active?skyMix:1-skyMix);}
 }
 endReveal(){this.show(this.active);}
 update(bodyZ:number,time:number,animated:boolean){
  for(const w of this.worlds.values()){
   if(!w.root.visible)continue;const center=Math.floor((bodyZ+80)/160);w.tiles.forEach((tile,i)=>tile.position.z=(center+i-1)*160);
   w.sky.position.z=bodyZ;if(w.backdrop)w.backdrop.position.z=bodyZ;if(w.stars)w.stars.position.z=bodyZ;if(w.water)w.water.uniforms.uTime.value=animated?time:0;
   w.reveal.uRevealCenter.value.set(0,bodyZ);
  }
 }
 aoExclude(){const out:T.Object3D[]=[];for(const w of this.worlds.values())if(w.root.visible)out.push(...w.aoExclude);return out;}
 stats(){const w=this.worlds.get(this.active);let triangles=0,drawObjects=0;w?.root.traverse(o=>{if(o instanceof T.Mesh){drawObjects++;triangles+=((o.geometry.index?.count||o.geometry.getAttribute('position').count)/3)*(o instanceof T.InstancedMesh?o.count:1);}else if(o instanceof T.Points)drawObjects++;});return{destination:this.active,cachedWorlds:this.worlds.size,triangles,drawObjects};}
 /** Each world owns clones of the shared palette, so two worlds can sit on opposite sides of the front. */
 private finish(root:T.Group,reveal:RevealUniforms,skip:T.Object3D[]){
  const clones=new Map<T.Material,T.Material>();
  root.traverse(o=>{if(!(o instanceof T.Mesh)||skip.includes(o)||o.material instanceof T.ShaderMaterial)return;const source=o.material as T.Material;let copy=clones.get(source);if(!copy){copy=source.clone();patchReveal(copy,reveal);clones.set(source,copy);}o.material=copy;});
 }
 private buildStudio():World{
  const root=new T.Group(),reveal=revealUniforms(),sky=skyDome('studio',reveal),backdrop=new T.Group();root.name='studio';root.add(sky,backdrop);
  const floor=new T.Mesh(new T.CircleGeometry(250,96),new T.MeshBasicMaterial({color:'#ebe6db'}));floor.rotation.x=-PI/2;floor.position.y=-.02;backdrop.add(floor);
  // Fine concentric marks situate the model without turning the floor into a grid.
  const marks:T.Mesh[]=[];
  for(const radius of [4.6,4.72]){const circle=new T.Mesh(new T.RingGeometry(radius,radius+.012,100),new T.MeshBasicMaterial({color:'#c6c4b6',transparent:true,opacity:.45,depthWrite:false}));circle.rotation.x=-PI/2;circle.position.y=.002;backdrop.add(circle);marks.push(circle);}
  this.finish(root,reveal,[sky]);
  return{root,tiles:[],sky,backdrop,reveal,aoExclude:[sky,...marks]};
 }
 private build(id:Exclude<Destination,'studio'>):World{
  const night=id==='night',rural=night||id==='meadow',root=new T.Group(),tiles:T.Group[]=[],reveal=revealUniforms();if(!this.palettes.has(night))this.palettes.set(night,new LandscapeAssets(night));const a=this.palettes.get(night)!,sky=skyDome(id,reveal);root.name=id;root.add(sky);let water:T.ShaderMaterial|undefined;
  const backdrop=new T.Group();root.add(backdrop);
  if(rural){backdrop.add(ridgeRing(id,night?41:17,250,night?38:48,night?'#2d3f4f':'#7f95a5',night?.32:.58,night?'#8d9cad':'#eef0ec'),ridgeRing(id,night?73:29,212,night?18:24,night?'#233530':'#62795c',night?.28:.46,null));}
  if(id==='capital'){const p=palace(id);p.position.set(-62,0,-232);p.rotation.y=.24;p.scale.setScalar(.62);backdrop.add(p);}
  if(id==='harbor'){backdrop.add(ridgeRing(id,53,250,22,'#6f8a92',.5,null));}
  if(id==='harbor')water=new T.ShaderMaterial({uniforms:{uTime:{value:0},...reveal},
   vertexShader:`${REVEAL_VERTEX_HEAD}uniform float uTime;varying vec3 p;varying float dist;void main(){p=position;vec3 q=position;q.y+=.035*sin(q.x*.6+q.z*.33+uTime*.55);vec4 rvW=modelMatrix*vec4(q,1.);${REVEAL_FOLD}vec4 mv=viewMatrix*rvW;dist=-mv.z;gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`${REVEAL_FRAGMENT_HEAD}uniform float uTime;varying vec3 p;varying float dist;void main(){${REVEAL_DISCARD}float wave=sin(p.x*.67+p.z*.24+sin(p.z*.45+uTime*.35)*.8-uTime*.5);float sparkle=pow(max(0.,wave),18.)*.13;float broad=sin(p.z*.12+p.x*.07)*.5+.5;vec3 c=mix(vec3(.10,.22,.26),vec3(.22,.35,.36),broad)+sparkle;float mist=smoothstep(75.,190.,dist);c=mix(c,vec3(.42,.50,.50),mist*.8);gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
gl_FragColor.rgb+=${REVEAL_SEAM};}`});
  for(let index=0;index<3;index++){
   const tile=new T.Group();tile.position.z=(index-1)*160;tiles.push(tile);root.add(tile);const land=new T.Group(),props=new T.Group(),trees=new T.Group();tile.add(land,props,trees);const r=randomFrom(881);
   if(rural){
    const geo=new T.PlaneGeometry(360,160,100,54);geo.rotateX(-PI/2);const pos=geo.getAttribute('position'),colors:number[]=[];const shade=new T.Color(night?'#2e4a3b':'#627f50'),light=new T.Color(night?'#5c735d':'#a1b47d'),c=new T.Color();
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),h=terrainHeight(x,z,night);pos.setY(i,h-.018);const f=.5+.20*Math.sin(x*.15+z*PI/40)+.16*Math.cos(x*.23-z*PI/20);c.copy(shade).lerp(light,f);const path=(1-T.MathUtils.smoothstep(Math.abs(x+.9*Math.sin(z*PI/80)),2.4,6.8))*.27;c.lerp(new T.Color('#c1b68a'),path);colors.push(c.r,c.g,c.b);}
    geo.computeVertexNormals();geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));const uv=geo.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*25,uv.getY(i)*11);tile.add(new T.Mesh(geo,a.grass));addPlants(tile,a,night,674);addTrees(trees,a,night);
   }else{
    if(water){const sea=new T.PlaneGeometry(380,160,64,32);sea.rotateX(-PI/2);const o=new T.Mesh(sea,water);o.position.y=-.65;tile.add(o);box(land,a.stone,[35,-.6,0],[108,1.15,160]);box(land,a.road,[4,-.035,0],[42,.07,160]);for(const x of [-16.8,24.8])box(land,a.stone,[x,.03,0],[.4,.15,160]);
     // Deep masonry quay, coping stones and intermittent mooring posts.
     box(land,a.stone,[-17.5,-.35,0],[1.0,1.2,160]);for(let z=-76;z<80;z+=4){box(land,a.stone,[-17.55,.10,z],[1.1,.24,3.8]);if(Math.round(z)%12===4){rod(props,a.ink,[-16.4,0,z],[-16.4,.8,z],.16);box(props,a.ink,[-16.4,.83,z],[.6,.12,.3]);}}
    }else{box(land,a.stone,[0,-.16,0],[360,.3,160]);box(land,a.road,[0,-.025,0],[23,.05,160]);for(const side of [-1,1])box(land,a.stone,[side*12.2,.025,0],[1.4,.12,160]);}
    // Irregular contiguous blocks replace the former ring of isolated towers.
    const sides=id==='harbor'?[1]:[-1,1];
    for(const side of sides)for(let row=0;row<3;row++){
     let z=-78;let j=0;while(z<78){const w=4.1+r()*3.5,h=5+r()*6+(row===2?3:0),d=5+r()*2.5;const x=side*(id==='harbor'?34+row*12:38+row*12)+(r()-.5)*2;villageHouse(props,a,[x,0,z+w/2],w,h,d,j+row*3+(side<0?2:0),-side*PI/2,row===0&&j%3===0);z+=w+.6+r()*1.2;j++;}
    }
    if(id==='harbor'){
     // Across the bay: a second continuous waterfront, with a lower-density skyline behind it.
     box(land,a.stone,[-81,-.15,0],[29,.8,160]);let z=-77;let j=0;while(z<78){const w=4+r()*4;villageHouse(props,a,[-77,0,z+w/2],w,6+r()*8,6,j++,PI/2);z+=w+.45;}
     for(let i=0;i<6;i++){const z0=-66+i*27;box(props,a.timber,[-26,-.05,z0],[18,.22,2.5]);for(const end of [-34,-20])for(const q of [-.9,.9])rod(props,a.ink,[end,-1.4,z0+q],[end,.35,z0+q],.12);addShip(props,a,-39-r()*16,z0+7,.68+r()*.2,.15+r()*.5);}
     for(let z=-65;z<80;z+=24){
      const x=-13.8;rod(props,a.ink,[x,0,z],[x,3.4,z],.065);box(props,a.ink,[x,3.4,z],[.5,.65,.5]);box(props,a.glass,[x,3.4,z],[.35,.45,.35]);rod(props,a.ink,[x,3.8,z],[x,4.05,z],.32,.03);
      for(let j=0;j<3;j++)box(props,a.timber,[-12.9+j*.35,.48,z+3],[.28,.10,2.2]);for(const zz of [-.7,.7])box(props,a.ink,[-12.55,.23,z+3+zz],[1,.5,.12]);
      for(let j=0;j<2;j++){box(props,a.timber,[-15,.4+j*.7,z+6],[1.05,.7,1.05]);for(const k of [-.4,.4])box(props,a.trim,[-15+k,.4+j*.7,z+6.54],[.06,.7,.04]);}
     }
     const lighthouse=new T.Group();lighthouse.position.set(-64,0,-52);props.add(lighthouse);rod(lighthouse,a.stone,[0,0,0],[0,17,0],1.35,1);rod(lighthouse,a.ink,[0,17,0],[0,19,0],1.3);rod(lighthouse,a.glass,[0,17.4,0],[0,18.6,0],1.08);rod(lighthouse,a.roofs[2],[0,19,0],[0,20.8,0],1.55,.04);
    }else{
     const tower=new T.Group();tower.position.set(-48,0,-35);props.add(tower);box(tower,a.walls[1],[0,9,0],[4.3,18,4.3]);box(tower,a.stone,[0,18,0],[5,.35,5]);rod(tower,a.roofs[2],[0,18.1,0],[0,25.5,0],3.6,.08);
     for(const side of [-1,1]){const dial=new T.Mesh(new T.CircleGeometry(1.35,32),mat('#dfd3b4'));dial.position.set(0,15.5,side*2.18);if(side<0)dial.rotation.y=PI;tower.add(dial);rod(tower,a.ink,[0,15.5,side*2.2],[.7,16.05,side*2.2],.05);rod(tower,a.ink,[0,15.5,side*2.2],[0,16.4,side*2.2],.06);}
     // Ornamental iron lamps, stone curbs and street-level awnings give the road a human scale.
     for(let z=-70;z<80;z+=21)for(const side of [-1,1]){const x=side*13.5;rod(props,a.ink,[x,.1,z],[x,3.6,z],.065);box(props,a.ink,[x,3.5,z],[.48,.7,.48]);box(props,a.glass,[x,3.52,z],[.33,.48,.33]);rod(props,a.ink,[x,3.9,z],[x,4.15,z],.3,.03);}
    }
   }
   if(night){
    const y=terrainHeight(cottageX,cottageZ,true),house=villageHouse(props,a,[cottageX,y,cottageZ],7.2,3.6,6,3,.55,true,true);
    box(house,a.stone,[0,-.4,0],[7.65,.8,6.5]);
    for(const x of [-3.48,0,3.48])box(house,a.timber,[x,1.8,3.1],[.18,3.6,.15]);for(const y0 of [.2,3.4])box(house,a.timber,[0,y0,3.1],[7.2,.16,.14]);
    rod(house,a.timber,[-3.5,3.6,3.15],[0,6.48,3.15],.075);rod(house,a.timber,[0,6.48,3.15],[3.5,3.6,3.15],.075);
    box(house,a.ink,[0,4.9,3.1],[1.15,1.35,.08]);box(house,a.glass,[0,4.9,3.17],[.85,1.1,.06]);box(house,a.timber,[0,4.9,3.23],[.06,1.1,.04]);
    for(const x of [-2.4,2.4]){box(house,a.ink,[x,1.9,3.13],[1.25,1.3,.08]);box(house,a.glass,[x,1.9,3.19],[1.05,1.12,.04]);box(house,a.timber,[x,1.9,3.23],[.06,1.12,.04]);box(house,a.timber,[x,1.9,3.23],[1.05,.06,.04]);box(house,a.timber,[x,1.2,3.4],[1.5,.26,.4]);}
    for(const side of [-1,1]){box(house,a.ink,[side*3.65,1.9,0],[.08,1.3,1.2]);box(house,a.glass,[side*3.7,1.9,0],[.04,1.1,.95]);box(house,a.timber,[side*3.74,1.9,0],[.03,1.1,.06]);}
    for(const y0 of [.45,1.25,1.8])box(house,a.trim,[0,y0,3.22],[.55,.06,.035]);rod(house,a.glass,[.28,1.0,3.24],[.28,1.0,3.3],.035);
    const pool=new T.Mesh(new T.CircleGeometry(6,40),new T.MeshBasicMaterial({color:'#d6b46c',transparent:true,opacity:.13,depthWrite:false}));pool.rotation.x=-PI/2;pool.scale.set(1,.6,1);pool.position.set(0,.025,5);house.add(pool);
    for(let i=0;i<9;i++){const x=-.5+Math.sin(i*.5)*.7,z=4+i*.7;box(house,a.stone,[x,-.015,z],[.9,.06,.5],[0,(i%3)*.2,0]);}
    for(const side of [-1,1])for(let i=0;i<5;i++){const x=side*5,z=1+i*1.8;rod(house,a.timber,[x,-.1,z],[x,.85,z],.055);if(i<4)for(const y0 of [.35,.68])rod(house,a.timber,[x,y0,z],[x,y0,z+1.8],.045);}
   }
   mergePart(land);mergePart(props);
   // Leaves remain instanced, static trunks are only a few dozen calls per tile.
   const leafChildren=trees.children.filter(o=>o instanceof T.InstancedMesh);leafChildren.forEach(o=>trees.remove(o));mergePart(trees);leafChildren.forEach(o=>trees.add(o));
   tile.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;o.receiveShadow=false;}});
  }
  let stars:T.Points|undefined;
  if(night){const r=randomFrom(222),p:number[]=[],colors:number[]=[];for(let i=0;i<900;i++){const angle=r()*PI*2,y=.015+r()*.87,rr=Math.sqrt(1-y*y)*210;p.push(Math.cos(angle)*rr,y*210,Math.sin(angle)*rr);const c=new T.Color().setHSL(.12+r()*.12,.18,.6+r()*.4);colors.push(c.r,c.g,c.b);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));stars=new T.Points(geo,new T.PointsMaterial({vertexColors:true,size:.32,sizeAttenuation:true,fog:false,transparent:true,opacity:.86}));root.add(stars);const moon=new T.Mesh(new T.SphereGeometry(3.1,24,16),new T.MeshBasicMaterial({color:'#e1dcc1',fog:false}));moon.position.set(-95,10,-150);stars.add(moon);}
  const grass=tiles.flatMap(tile=>tile.children.filter(o=>o instanceof T.InstancedMesh&&o.count>1000));
  const aoExclude:T.Object3D[]=[sky,backdrop,...grass];if(stars)aoExclude.push(stars);
  root.traverse(o=>{if(o instanceof T.Mesh&&(o.material as T.Material).transparent)aoExclude.push(o);});
  this.finish(root,reveal,[sky]);
  return{root,tiles,sky,backdrop,water,stars,reveal,aoExclude};
 }
}
