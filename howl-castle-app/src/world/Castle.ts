import * as T from 'three';
import { PARTS, type PartId } from '../assets/parts';
import { makeMaterials, type Materials } from './materials';
import { ball, box, rod, pipe, ring, bolts, lathe, mesh, extrude, mergePart, type Vec } from './geometry';
import {MagicDoor} from './MagicDoor';
import {WalkingLimb} from './WalkingLimb';
import {derivePose,type CastlePose,type LimbId,LEGS} from '../simulation/derivePose';

const PI=Math.PI;
type Mat=T.Material;

function dome(g:T.Group,m:Materials,x:number,y:number,z:number,r:number,mat:Mat){
  // Divided plates give the dome seams a geometric edge at every angle.
  const n=12;
  for(let i=0;i<n;i++){
    const geo=new T.SphereGeometry(1,6,10,i*2*PI/n+.007,2*PI/n-.014,0,PI/2);
    mesh(g,geo,i%4===0?m.ironDark:mat,[x,y,z],[r,r*.8,r]);
  }
  ring(g,m.brass,[x,y,z],r+.01,.055,[PI/2,0,0]);
  rod(g,mat,[x,y-.32,z],[x,y,z],r*.98);
  bolts(g,m.ink,[x,y-.15,z],r*.988,20,'y',.035);
  for(let i=0;i<8;i++){
    const a=i/8*PI*2;
    const pts:Vec[]=[];
    for(let k=0;k<=12;k++){const t=k/12*PI/2;pts.push([x+Math.sin(t)*Math.cos(a)*(r+.012),y+Math.cos(t)*r*.8,z+Math.sin(t)*Math.sin(a)*(r+.012)]);}
    pipe(g,m.ink,pts,.012);
  }
  rod(g,m.brass,[x,y+r*.79,z],[x,y+r*.84,z],r*.12);
}

function window(g:T.Group,m:Materials,x:number,y:number,z:number,w:number,h:number,angle=0,lit=true){
  const f=new T.Group();f.position.set(x,y,z);f.rotation.y=angle;g.add(f);
  box(f,m.ink,[0,0,0],[w+.14,h+.14,.1]);
  box(f,lit?m.glass:m.dark,[0,0,.065],[w,h,.025]);
  box(f,m.timber,[0,0,.095],[.045,h,.06]);
  box(f,m.timber,[0,0,.095],[w,.045,.06]);
  box(f,m.boards,[0,-h/2-.07,.12],[w+.27,.08,.28]);
}

function house(parent:T.Group,m:Materials,p:Vec,w:number,h:number,d:number,turn=0,roofRise=.9){
  const g=new T.Group();g.position.set(...p);g.rotation.y=turn;parent.add(g);
  box(g,m.plaster,[0,h/2,0],[w,h,d]);
  for(const z of [-d/2-.025,d/2+.025]){
    for(const x of [-w/2+.045,0,w/2-.045])box(g,m.timber,[x,h/2,z],[.095,h+.12,.09]);
    for(const y of [.08,h*.5,h-.04])box(g,m.timber,[0,y,z],[w+.13,.10,.10]);
    rod(g,m.timber,[-w*.46,.12,z],[0,h*.5,z],.045);
    rod(g,m.timber,[0,h*.5,z],[w*.46,.12,z],.045);
    for(const side of [-1,1]){
      window(g,m,side*w*.25,h*.73,z+Math.sign(z)*.05,w*.24,h*.26,z<0?PI:0,true);
      if(h>1.7)window(g,m,side*w*.25,h*.27,z+Math.sign(z)*.05,w*.2,h*.24,z<0?PI:0,side<0);
    }
  }
  for(const x of [-w/2-.025,w/2+.025]){
    for(const z of [-d/2+.04,d/2-.04])box(g,m.timber,[x,h/2,z],[.08,h,.09]);
    for(const y of [.08,h*.5,h-.04])box(g,m.timber,[x,y,0],[.08,.10,d+.1]);
    window(g,m,x+Math.sign(x)*.04,h*.72,0,d*.4,h*.27,x<0?-PI/2:PI/2);
  }
  extrude(g,m.plaster,[[-w/2,0],[w/2,0],[0,roofRise]],d,[0,h,-d/2], [0,0,0],0);
  for(const z of [-d/2-.035,d/2+.035]){
    rod(g,m.timber,[-w/2,h,z],[0,h+roofRise,z],.07);
    rod(g,m.timber,[0,h+roofRise,z],[w/2,h,z],.07);
    rod(g,m.timber,[0,h,z],[0,h+roofRise,z],.05);
  }
  const half=w/2+.22, rise=roofRise+.1, slope=Math.atan2(rise,half),length=Math.hypot(half,rise);
  for(const side of [-1,1]){
    box(g,m.roofDark,[side*half/2,h+rise/2,0],[length,.09,d+.5],[0,0,-side*slope]);
    const rows=5,cols=Math.ceil((d+.4)/.24);
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const u=(row+.56)/rows;
      box(g,(row+col)%5===0?m.roofDark:m.roof,[side*half*u,h+rise*(1-u)+.065,-(d+.4)/2+(col+.5)*(d+.4)/cols],
        [length/rows+.035,.035,(d+.4)/cols-.013],[0,0,-side*slope]);
    }
    rod(g,m.ink,[side*half,h,-d/2-.3],[side*half,h,d/2+.3],.035);
  }
  rod(g,m.roofDark,[0,h+rise+.05,-d/2-.3],[0,h+rise+.05,d/2+.3],.065);
  return g;
}

function balcony(g:T.Group,m:Materials,p:Vec,w:number,d:number,turn=0){
  const b=new T.Group();b.position.set(...p);b.rotation.y=turn;g.add(b);
  box(b,m.boards,[0,0,0],[w,.13,d]);
  for(let i=0;i<8;i++)box(b,m.timber,[-w/2+(i+.5)*w/8,.072,0],[.018,.012,d]);
  for(const side of [-1,1]){
    for(const y of [.4,.75])rod(b,m.ironDark,[side*w/2,y,-d/2],[side*w/2,y,d/2],.025);
    for(const z of [-d/2,d/2])rod(b,m.ironDark,[side*w/2,.05,z],[side*w/2,.78,z],.035);
  }
  for(const y of [.4,.75])rod(b,m.ironDark,[-w/2,y,d/2],[w/2,y,d/2],.028);
  for(let i=0;i<9;i++)rod(b,m.ironDark,[-w/2+i*w/8,.05,d/2],[-w/2+i*w/8,.76,d/2],.018);
  rod(b,m.timber,[-w/2,-.8,-d/2],[-w/2,0,d/2],.07);
  rod(b,m.timber,[w/2,-.8,-d/2],[w/2,0,d/2],.07);
}

function chimney(parent:T.Group,m:Materials,p:Vec,h:number,r:number,lean:number,mat:Mat){
  const g=new T.Group();g.position.set(...p);g.rotation.z=lean;parent.add(g);
  const profile:[number,number][]=[[r*1.14,0],[r*1.14,.18],[r,.23],[r,h*.32],[r*.9,h*.36],[r*.91,h*.72],[r,h*.76],[r,h-.42],[r*1.38,h-.2],[r*1.4,h],[r*1.15,h+.15],[r*.95,h+.2]];
  lathe(g,mat,profile.slice(0,8));
  lathe(g,m.soot,profile.slice(7));
  for(const y of [.23,h*.34,h*.74,h-.4]){
    rod(g,m.brass,[0,y-.05,0],[0,y+.05,0],r*1.1);
    bolts(g,m.ink,[0,y+.06,0],r*1.07,10,'y',.028);
  }
  rod(g,m.dark,[0,h+.1,0],[0,h+.16,0],r*.92);
  ring(g,m.ironDark,[0,h+.18,0],r*1.02,.045,[PI/2,0,0]);
  for(let i=0;i<5;i++){
    const a=i*2*PI/5;
    pipe(g,m.ink,[[Math.cos(a)*r,h*.38,Math.sin(a)*r],[Math.cos(a)*r*.92,h*.65,Math.sin(a)*r*.92],[Math.cos(a)*r,h-.42,Math.sin(a)*r]],.009);
  }
  return g;
}

function gear(g:T.Group,m:Materials,x:number,y:number,z:number,r:number,teeth:number,turn:number){
  const s=new T.Group();s.position.set(x,y,z);s.rotation.x=turn;g.add(s);
  s.userData={animatedGear:true,teeth,initialRotation:turn};
  ring(s,m.brass,[0,0,0],r*.82,r*.13,[0,PI/2,0]);
  rod(s,m.copper,[-.12,0,0],[.12,0,0],r*.27);
  // Joint cylinders run on x; rods are oriented from their actual endpoints.
  for(let i=0;i<teeth;i++){
    const a=i*2*PI/teeth;
    box(s,m.brass,[0,Math.sin(a)*r,Math.cos(a)*r],[.22,r*.17,r*.18],[a,0,0]);
  }
  for(let i=0;i<6;i++){
    const a=i*PI/3;rod(s,m.brass,[0,0,0],[0,Math.sin(a)*r*.81,Math.cos(a)*r*.81],r*.065);
  }
  ring(s,m.copper,[.14,0,0],r*.22,r*.024,[0,PI/2,0]);
  bolts(s,m.copper,[.145,0,0],r*.19,6,'x',.028);
  return s;
}

export class Castle {
  root=new T.Group();
  body=new T.Group();
  parts=new Map<PartId,T.Group>();
  limbs=new Map<LimbId,WalkingLimb>();
  private gears:T.Group[]=[];
  presentation={explode:0,xray:false,isolate:false};
  /** Window and hearth brightness; dusk and night raise it so the windows carry the scene. */
  private glow=1;private selected:PartId|null=null;
  materials=makeMaterials();
  magicDoor!:MagicDoor;
  constructor(){
    this.root.name='HOWL_CASTLE';
    this.body.name='MOVING_BODY';this.body.rotation.order='ZXY';this.root.add(this.body);
    for(const definition of PARTS){const g=new T.Group();g.name=definition.id;g.userData={partId:definition.id,definition};this.parts.set(definition.id,g);(definition.id.endsWith('_LIMB')?this.root:this.body).add(g);}
    this.hull();this.face();this.houses();this.turrets();this.chimneys();this.pipework();this.drive();this.fire();this.magicDoor=new MagicDoor(this.parts.get('HOUSE_B')!,this.materials);
    for(const leg of LEGS)this.limbs.set(leg.id,new WalkingLimb(this.parts.get(leg.id)!,this.materials,leg.side));
    for(const g of this.parts.values()){
      if(!g.name.endsWith('_LIMB')){
        const attachments=g.children.filter(c=>c.userData.animatedAttachment);attachments.forEach(c=>g.remove(c));
        const gears=g.children.filter(c=>c.userData.animatedGear) as T.Group[];
        for(const gear of gears){mergePart(gear);gear.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});g.remove(gear);this.gears.push(gear);}
        mergePart(g);if(gears.length)g.add(...gears);if(attachments.length)g.add(...attachments);
      }
      const anchors:Partial<Record<PartId,Vec>>={CORE:[0,4.5,0],FACE:[0,5,1.1],HOUSE_A:[-2.22,5,.35],HOUSE_B:[1.65,6.05,.12],HOUSE_REAR:[-.53,6.02,-2.02],TURRETS:[0,7.1,0],CHIMNEYS:[0,8.5,-1],PIPES:[0,3.5,0],DRIVE:[2.7,4.2,0],FIRE:[-2.5,5.5,.7]};
      const anchor=anchors[g.name as PartId];
      if(anchor){g.position.set(...anchor);for(const child of g.children){if(child instanceof T.Mesh)child.geometry.translate(-anchor[0],-anchor[1],-anchor[2]);else child.position.sub(new T.Vector3(...anchor));}}
      // Each part owns its materials so selection can never tint another part.
      g.traverse(o=>{if(o instanceof T.Mesh){o.material=(o.material as T.Material).clone();o.userData.partId=g.name;const mat=o.material as T.MeshStandardMaterial;o.userData.baseEmissive=mat.emissive.clone();o.userData.baseEmissiveIntensity=mat.emissiveIntensity;}});
      if(g.name==='FIRE')g.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});
      g.userData.initialPosition=g.position.clone();g.userData.initialQuaternion=g.quaternion.clone();
    }
    this.applyPose(derivePose(0));
  }
  applyPose(pose:CastlePose){
    const [x,y,z]=pose.body.position;this.root.position.z=z;this.body.position.set(x,y,0);this.body.rotation.set(pose.body.rx,0,pose.body.rz,'ZXY');
    for(const foot of pose.feet)this.limbs.get(foot.id)!.apply(foot,z);
    for(const [id,g] of this.parts){g.quaternion.copy(g.userData.initialQuaternion);if(id==='HOUSE_A'||id==='HOUSE_B'||id==='HOUSE_REAR')g.rotation.z=pose.sway.house*(id==='HOUSE_A'?-1:1);if(id==='CHIMNEYS')g.rotation.z=pose.sway.chimney;(g.userData.posedQuaternion??=new T.Quaternion()).copy(g.quaternion);}
    for(let i=0;i<this.gears.length;i++){const gear=this.gears[i];gear.rotation.x=gear.userData.initialRotation+pose.cycles*PI*2*(i%2?-1:1)*20/gear.userData.teeth;}
    this.root.updateMatrixWorld(true);
  }
  applyPresentation(selected:PartId|null){
    for(const [id,g] of this.parts){
      const definition=g.userData.definition;const delay=id==='FACE'?0:id==='CHIMNEYS'?.12:id.startsWith('HOUSE')?.08:id.endsWith('_LIMB')?.18:.04;
      const u=T.MathUtils.clamp((this.presentation.explode-delay)/(1-delay),0,1),amount=u*u*(3-2*u);
      g.position.copy(g.userData.initialPosition).addScaledVector(new T.Vector3(...definition.explode),amount);
      g.quaternion.copy(g.userData.posedQuaternion||g.userData.initialQuaternion);
      if(id.startsWith('HOUSE'))g.rotateY((id==='HOUSE_A'?-.1:.1)*amount);
      g.visible=!this.presentation.isolate||id===selected;
      const translucent=this.presentation.xray&&!this.presentation.isolate&&!id.endsWith('_LIMB')&&id!=='DRIVE'&&id!=='FIRE';
      g.traverse(o=>{if(o instanceof T.Mesh){const mat=o.material as T.MeshStandardMaterial;const opacity=translucent?.17:1;if(mat.opacity!==opacity){if(mat.transparent!==translucent)mat.needsUpdate=true;mat.transparent=translucent;mat.opacity=opacity;mat.depthWrite=!translucent;}}});
    }
    this.root.updateMatrixWorld(true);
  }
  private hull(){
    const g=this.parts.get('CORE')!,m=this.materials;
    const profile:[number,number][]=[[.45,2.42],[1.25,2.57],[2.08,2.96],[2.53,3.65],[2.66,4.8],[2.48,5.75],[1.85,6.45],[.2,6.7]];
    const count=16;
    for(let i=0;i<count;i++){
      lathe(g,[m.iron,m.copper,m.ironDark,m.iron][i%4],profile,[0,0,-.18],[1,1,1.04],i*2*PI/count+.005,2*PI/count-.01);
      const a=i/count*PI*2;pipe(g,m.ink,profile.slice(1,-1).map(([r,y])=>[Math.sin(a)*(r+.01),y,-.18+Math.cos(a)*(r+.01)*1.04] as Vec),.018);
      for(const [r,y] of profile.slice(1,-1))ball(g,m.ink,[Math.sin(a)*(r+.03),y,-.18+Math.cos(a)*(r+.03)*1.04],[.038,.038,.038]);
    }
    for(const [r,y] of [[2.1,2.98],[2.56,3.72],[2.66,4.7],[2.45,5.8]])ring(g,m.ironDark,[0,y,-.18],r,.045,[PI/2,0,0],[1,1.04,1]);
    box(g,m.ironDark,[0,2.9,0],[4.35,.3,4.6]);
    for(const x of [-1.85,1.85]){
      rod(g,m.brass,[x,2.8,-2.15],[x,2.8,2.15],.13);
      for(const z of [-1.55,1.55])rod(g,m.ironDark,[x,2.8,z],[x,3.5,z],.2);
    }
    // Rear plating, vents and structural ribs are modeled, not a facade.
    for(let i=0;i<7;i++){
      const x=(i-3)*.5;
      box(g,m.copper,[x,4.5,-2.65+Math.abs(x)*.16],[.46,1.55,.09],[.08,0,(i-3)*.03]);
      for(let j=0;j<4;j++)box(g,m.dark,[x,4.25+j*.19,-2.715+Math.abs(x)*.16],[.28,.055,.03]);
    }
    for(const x of [-1.85,1.85])pipe(g,m.ink,[[x,3,-1.8],[x,4.2,-2.2],[x*.8,5.8,-1.9],[x*.6,6.4,-1.4]],.08);
    // Belly keel and a short rear exhaust housing.
    lathe(g,m.ironDark,[[.1,2.26],[1.15,2.3],[1.6,2.5],[1.85,2.7]],[0,0,-.3],[1,1,1.2]);
    for(let i=0;i<12;i++)box(g,m.ink,[(i-5.5)*.24,2.55,-.25],[.055,.12,2.8]);
  }
  private face(){
    const g=this.parts.get('FACE')!,m=this.materials;
    dome(g,m,0,5.25,1.12,2.49,m.iron);
    // A plated brow and narrowing cheek shell bridge the dome to the mouth.
    for(let i=0;i<11;i++){
      const a=-PI*.52+i*PI*1.04/10;
      const x=Math.sin(a)*2.49,z=1.12+Math.cos(a)*2.49;
      box(g,i%3===0?m.copper:m.iron,[x,4.98,z],[.72,.52,.12],[0,a,0]);
      ball(g,m.ink,[x,4.98,z+.09],[.046,.046,.046]);
    }
    for(const side of [-1,1]){
      const eye=new T.Group();eye.position.set(side*1.09,6.04,3.02);eye.rotation.y=side*.15;eye.rotation.x=-.12;g.add(eye);
      rod(eye,m.copper,[0,0,-.13],[0,0,.44],.44,.34);
      rod(eye,m.dark,[0,0,.445],[0,0,.46],.294);
      ring(eye,m.brass,[0,0,.45],.344,.067);
      ring(eye,m.ink,[0,0,.47],.264,.024);
      bolts(eye,m.ink,[0,0,.49],.35,10,'z',.026);
      // Small reflected inner bevel, still a hollow black aperture.
      ring(eye,m.ironDark,[0,0,.475],.215,.018);
      extrude(g,side<0?m.rust:m.iron,[[0,0],[.9,-.14],[1.02,-1.23],[.54,-1.6],[-.06,-.93]],.14,[side*1.45,4.85,2.45],[0,side*-.45,side<0?0:-.06]);
      pipe(g,m.brass,[[side*2.12,4.65,2.1],[side*2.18,3.91,2.25],[side*1.4,3.32,2.67]],.07);
    }
    // The mouth is a real recessed opening with side walls and an open lower jaw.
    box(g,m.dark,[0,3.95,2.86],[2.45,1.24,.18]);
    extrude(g,m.iron,[[-1.45,.43],[-1.26,.98],[0,1.3],[1.26,.98],[1.45,.43],[1.1,.39],[1.02,.71],[-1.02,.71],[-1.1,.39]],.22,[0,3.59,2.93]);
    for(let i=0;i<7;i++){
      const x=(i-3)*.31;extrude(g,m.boards,[[-.11,.15],[.12,.15],[.07,-.19],[-.04,-.22]],.17,[x,4.18,3.18]);
    }
    lathe(g,m.copper,[[.1,-.28],[1.1,-.22],[1.6,.05],[1.81,.43]],[0,3.1,2.03],[1,1,.73],-PI*.5,PI);
    pipe(g,m.ironDark,[[-1.79,3.53,2.03],[-1.27,3.4,3.0],[0,3.35,3.36],[1.27,3.4,3.0],[1.79,3.53,2.03]],.065);
    for(const side of [-1,1]){
      rod(g,m.brass,[side*1.82,3.74,2.15],[side*1.82,3.74,2.47],.23);
      bolts(g,m.ink,[side*1.82,3.74,2.49],.18,8,'z',.028);
    }
    const ramp=new T.Group();ramp.position.set(0,3.35,2.9);ramp.rotation.x=.28;g.add(ramp);
    box(ramp,m.boards,[0,0,.86],[1.22,.10,1.85]);
    for(let i=0;i<9;i++)box(ramp,m.timber,[0,.062,.05+i*.2],[1.16,.025,.024]);
    for(const side of [-1,1])rod(ramp,m.ironDark,[side*.59,.04,-.08],[side*.59,.04,1.8],.025);
    bolts(g,m.ink,[0,4.72,3.13],.1,4,'z',.025);
  }
  private houses(){
    const m=this.materials;
    const a=this.parts.get('HOUSE_A')!;
    house(a,m,[-2.22,5.0,.35],1.72,1.65,1.72,-.23,.63);
    dome(a,m,-2.15,6.52,.35,1.12,m.ironDark);
    balcony(a,m,[-2.64,4.93,1.04],1.52,.65,-.25);
    // Projecting stove pipe and side lean-to.
    house(a,m,[-2.6,6.95,-.85],1.15,1.24,1.0,-.12,.6);
    for(const x of [-3.0,-1.55])rod(a,m.timber,[x,4.25,.18],[x,5.05,1.4],.07);
    const b=this.parts.get('HOUSE_B')!;
    house(b,m,[1.65,6.05,.12],1.96,2.12,1.8,.12,.86);
    const upper=house(b,m,[.36,8.0,-.51],2.15,1.77,1.9,-.12,1.16);upper.rotation.z=-.06;
    house(b,m,[2.25,7.63,-.88],1.04,1.21,1.3,.18,.67);
    balcony(b,m,[2.2,6.12,.58],1.85,.61,.12);
    for(const x of [1.0,2.35])rod(b,m.timber,[x,5.25,-.13],[x,6.1,.74],.09);
    // An external stair gives a human scale to the stack of buildings.
    for(let i=0;i<8;i++)box(b,m.boards,[2.7,5.75+i*.16,-.54-i*.17],[.64,.07,.23]);
    for(const x of [2.41,3.0]){
      rod(b,m.ironDark,[x,6.4,-.55],[x,7.55,-1.75],.028);
      for(let i=0;i<5;i++)rod(b,m.ironDark,[x,5.76+i*.28,-.55-i*.29],[x,6.4+i*.28,-.55-i*.29],.022);
    }
    const rear=this.parts.get('HOUSE_REAR')!;
    house(rear,m,[-.53,6.02,-2.02],2.4,2.02,1.65,PI,.78);
    house(rear,m,[-.65,8.23,-1.91],1.34,1.23,1.3,PI+.07,.81);
    balcony(rear,m,[-.42,6.07,-2.94],2.42,.64,PI);
    for(const x of [-1.42,.45])rod(rear,m.timber,[x,5.1,-2.37],[x,6.05,-3.1],.09);
    // Heavy timber braces follow the roofline rather than floating above it.
    rod(rear,m.timber,[-1.7,6.0,-2.32],[1.0,8.0,-2.32],.045);
    for(let i=0;i<7;i++){
      const y=5.9+i*.35;
      rod(rear,m.ironDark,[-1.87,y,-2.85],[-1.4,y,-2.85],.028);
    }
    for(const x of [-1.91,-1.36])rod(rear,m.ironDark,[x,5.72,-2.85],[x,8.25,-2.85],.035);
  }
  private turrets(){
    const g=this.parts.get('TURRETS')!,m=this.materials;
    // A second substantial, drum-backed head is a silhouette feature of the
    // reference. It overlaps the dwellings instead of sitting like a hat.
    lathe(g,m.copper,[[1.12,7.0],[1.53,7.3],[1.6,8.55]],[-.95,0,.15]);
    dome(g,m,-.95,8.55,.15,1.65,m.ironDark);
    for(const y of [7.36,8.28])ring(g,m.brass,[-.95,y,.15],1.6,.045,[PI/2,0,0]);
    for(let i=0;i<16;i++){
      const a=i*PI/8;
      rod(g,m.ink,[-.95+Math.sin(a)*1.61,7.35,.15+Math.cos(a)*1.61],[-.95+Math.sin(a)*1.61,8.5,.15+Math.cos(a)*1.61],.014);
      ball(g,m.ink,[-.95+Math.sin(a)*1.63,8.3,.15+Math.cos(a)*1.63],[.03,.03,.03]);
    }
    for(const x of [-1.54,-.38]){
      rod(g,m.copper,[x,9.06,1.57],[x,9.06,1.84],.25);
      rod(g,m.dark,[x,9.06,1.84],[x,9.06,1.85],.19);
      ring(g,m.brass,[x,9.06,1.87],.225,.04);
      bolts(g,m.ink,[x,9.06,1.89],.23,8,'z',.02);
    }
    // Small forward dome and its two compact portholes.
    dome(g,m,1.94,7.1,.9,.9,m.ironDark);
    rod(g,m.copper,[1.94,6.05,.9],[1.94,7.05,.9],.87);
    for(const x of [1.64,2.17]){
      rod(g,m.copper,[x,7.39,1.59],[x,7.39,1.82],.18);
      rod(g,m.dark,[x,7.39,1.82],[x,7.39,1.835],.13);
      ring(g,m.brass,[x,7.39,1.84],.16,.03);
    }
    const tower=new T.Group();tower.position.set(2.12,7.44,-1.84);tower.rotation.z=-.045;g.add(tower);
    lathe(tower,m.plaster,[[.5,0],[.64,.22],[.64,2.12],[.69,2.25]]);
    for(let i=0;i<8;i++){
      const a=i*PI/4;rod(tower,m.copper,[Math.sin(a)*.65,.2,Math.cos(a)*.65],[Math.sin(a)*.65,2.3,Math.cos(a)*.65],.035);
      if(i%2===0)window(tower,m,Math.sin(a)*.66,1.22,Math.cos(a)*.66,.3,.73,a);
    }
    for(const y of [.18,2.18])ring(tower,m.brass,[0,y,0],.69,.055,[PI/2,0,0]);
    lathe(tower,m.patina,[[.01,3.45],[.2,3.1],[.38,2.75],[.62,2.42],[.82,2.25],[.82,2.18]]);
    for(let i=0;i<8;i++){
      const a=i*PI/4;
      pipe(tower,m.ink,[[Math.sin(a)*.82,2.25,Math.cos(a)*.82],[Math.sin(a)*.39,2.77,Math.cos(a)*.39],[0,3.45,0]],.012);
    }
    rod(tower,m.brass,[0,3.4,0],[0,3.85,0],.024);
    ball(tower,m.brass,[0,3.8,0],[.065,.065,.065]);
    // A projecting stained-glass lantern on the left rear.
    const lantern=new T.Group();lantern.position.set(-2.32,7.52,-1.7);lantern.rotation.z=.08;g.add(lantern);
    lathe(lantern,m.copper,[[.12,-.55],[.53,-.2],[.58,0],[.58,1.52],[.65,1.62],[.42,2.2],[.05,2.66]]);
    for(let i=0;i<6;i++){
      const a=i*PI/3;const f=new T.Group();f.position.set(Math.sin(a)*.573,.79,Math.cos(a)*.573);f.rotation.y=a;lantern.add(f);
      box(f,m.ink,[0,0,0],[.5,1.23,.045]);
      for(let row=0;row<4;row++)for(let col=0;col<2;col++)box(f,[m.glass,m.glassGreen,m.glassRed][(row+col+i)%3],[(col-.5)*.207,(row-1.5)*.272,.032],[.19,.25,.025]);
      for(const x of [-.24,0,.24])box(f,m.brass,[x,0,.06],[.025,1.25,.035]);
      for(let j=0;j<5;j++)box(f,m.brass,[0,-.6+j*.3,.06],[.49,.022,.035]);
    }
    ring(lantern,m.brass,[0,0,0],.61,.045,[PI/2,0,0]);
    ring(lantern,m.brass,[0,1.6,0],.66,.04,[PI/2,0,0]);
  }
  private chimneys(){
    const g=this.parts.get('CHIMNEYS')!,m=this.materials;
    // Stacks are kept stocky: tall straight flues made the silhouette read as an antenna crown.
    chimney(g,m,[-1.67,8.0,-.62],3.75,.36,.15,m.copper);
    chimney(g,m,[1.04,8.03,-2.05],4.65,.36,-.11,m.iron);
    chimney(g,m,[-.32,8.93,-1.16],3.7,.26,-.04,m.copper);
    chimney(g,m,[1.24,8.47,.12],2.82,.25,.11,m.rust);
    // The crooked auxiliary flue has a bent elbow and an umbrella cap.
    pipe(g,m.copper,[[-2.0,7.4,-.1],[-2.06,8.36,-.1],[-2.44,8.75,-.1],[-2.43,9.4,-.1]],.14);
    mesh(g,new T.ConeGeometry(.3,.24,8),m.ironDark,[-2.43,9.5,-.1]);
    // Crane and rigging, deliberately asymmetric.
    rod(g,m.ironDark,[-.12,9.4,-1.2],[-.12,12.1,-1.2],.055);
    const top:Vec=[-.12,11.5,-1.2],left:Vec=[-2.16,11.78,-1.2],right:Vec=[1.7,12.08,-1.2];
    rod(g,m.ironDark,left,right,.045);
    rod(g,m.brass,[-.12,11.05,-1.2],left,.028);
    rod(g,m.brass,[-.12,11.05,-1.2],right,.028);
    pipe(g,m.rope,[left,[-1.4,10.93,-1.2],top],.013);
    rod(g,m.rope,[1.55,12.05,-1.2],[1.55,11.38,-1.2],.012);
    ring(g,m.ironDark,[1.55,11.3,-1.2],.08,.022);
    // Front side hoist with tension cable, connected to an actual bracket.
    const start:Vec=[-2.0,6.78,1.3],end:Vec=[-3.68,8.2,1.5];
    rod(g,m.ironDark,start,end,.045);
    rod(g,m.ironDark,[-2,7.05,1.3],end,.034);
    for(let i=0;i<5;i++){
      const t=i/5;rod(g,m.brass,[-2-1.68*t,6.78+1.42*t,1.3+.2*t],[-2-1.68*(t+.2),7.05+1.15*(t+.2),1.3+.2*(t+.2)],.019);
    }
    pipe(g,m.rope,[end,[-3.65,6.9,1.5],[-2.72,5.8,1.48]],.014);
    ring(g,m.ironDark,[-3.68,8.2,1.5],.1,.025);
  }
  private pipework(){
    const g=this.parts.get('PIPES')!,m=this.materials;
    const runs:Vec[][]=[
      [[-1.8,3.3,1.6],[-2.6,3.52,1.68],[-3.23,4.01,1.2],[-3.25,4.64,.55],[-2.92,4.93,.18]],
      [[-2.02,3.05,-.8],[-2.96,3.28,-.9],[-3.11,4.2,-1.33],[-3.12,5.54,-1.34],[-2.72,5.94,-1.55]],
      [[2.08,3.4,-1.8],[2.93,3.67,-1.85],[3.18,4.1,-1.85],[3.18,5.46,-1.85],[2.82,5.8,-1.9]],
      [[.6,3.55,-2.4],[.64,4.1,-3.0],[1.15,4.46,-3.13],[1.76,4.56,-2.7]],
    ];
    runs.forEach((pts,i)=>{pipe(g,i%2?m.ironDark:m.copper,pts,i===0?.18:.15);pts.slice(1,-1).forEach(p=>ball(g,m.brass,p,[.205,.205,.205]));});
    for(const side of [-1,1]){
      // Fins are ribbed plates spanning y/z, not unsupported decorative cards.
      const f=new T.Group();f.position.set(side*2.45,4.16,-.5);f.rotation.y=side*PI/2;g.add(f);
      extrude(f,m.copper,[[0,-.8],[1.25,-1.02],[.91,-.37],[1.47,.14],[.86,.36],[1.2,1.04],[0,.78]],.06);
      for(const [x,y] of [[1.25,-1.02],[1.47,.14],[1.2,1.04]])rod(f,m.brass,[0,0,.08],[x,y,.08],.04);
      rod(f,m.ironDark,[0,-.85,0],[0,.85,0],.075);
      bolts(f,m.ink,[0,0,.095],.14,6,'z',.025);
    }
    // Rear serpentine line and its mounting brackets.
    pipe(g,m.brass,[[-1.8,4.6,-2.25],[-1.75,5.3,-2.56],[-.9,5.65,-2.7],[.9,5.65,-2.7],[1.72,6.0,-2.27]],.09);
    for(const x of [-1.2,0,1.2])box(g,m.ironDark,[x,5.58,-2.67],[.18,.3,.18]);
  }
  private drive(){
    const g=this.parts.get('DRIVE')!,m=this.materials;
    gear(g,m,2.69,4.53,.12,.83,20,.23);
    gear(g,m,2.73,3.58,-.67,.66,16,.08);
    gear(g,m,2.7,5.58,-.68,.45,12,-.16);
    gear(g,m,2.9,3.14,.52,.36,10,.4);
    gear(g,m,0,4.45,0,.91,24,.12);
    gear(g,m,0,3.35,-.65,.46,12,.15);
    rod(g,m.steel,[-1.95,3.35,-.65],[2.75,3.35,-.65],.11);
    for(const x of [-1.8,1.8]){
      rod(g,m.ironDark,[x,3.12,-.65],[x,3.58,-.65],.22);
      ring(g,m.brass,[x,3.35,-.65],.19,.035,[0,PI/2,0]);
    }
    rod(g,m.copper,[2.88,4.53,.12],[2.92,3.58,-.67],.075);
    for(const y of [3.15,4.15,5.15]){
      rod(g,m.ironDark,[2.4,y,-1.18],[2.9,y,-1.18],.11);
      bolts(g,m.ink,[2.93,y,-1.18],.09,5,'x',.02);
    }
    pipe(g,m.steel,[[2.4,2.95,-.4],[2.83,3.0,-1.1],[2.87,4.12,-1.18]],.1);
  }
  private fire(){
    const g=this.parts.get('FIRE')!,m=this.materials;
    // An authored internal furnace, visible through x-ray and disassembly.
    const flameProfile:[number,number][]=[[.02,-.55],[.27,-.48],[.47,-.23],[.36,.05],[.24,.29],[.11,.52],[.005,.75]];
    for(const [material,position,size] of [[m.ember,[0,4.65,0],[1,1,1]],[m.fire,[0,4.56,.23],[.58,.72,.58]]] as [Mat,Vec,Vec][]){
      const flame=lathe(g,material,flameProfile,position,size);const vertices=flame.geometry.getAttribute('position');
      for(let i=0;i<vertices.count;i++)vertices.setX(i,vertices.getX(i)+.17*((vertices.getY(i)+.55)/1.3)**2);
      flame.geometry.computeVertexNormals();
    }
    for(const y of [3.9,5.48])rod(g,m.ironDark,[0,y-.08,0],[0,y+.08,0],.82);
    for(let i=0;i<8;i++){
      const a=i*PI/4,x=Math.sin(a)*.73,z=Math.cos(a)*.73;
      rod(g,m.brass,[x,3.95,z],[x,5.45,z],.045);
    }
    for(const y of [4.02,4.7,5.4])ring(g,m.brass,[0,y,0],.78,.045,[PI/2,0,0]);
    pipe(g,m.copper,[[0,5.5,0],[.5,5.8,0],[1.18,5.3,-.3],[1.2,4.05,-.65]],.12);
    pipe(g,m.ironDark,[[-.72,4.3,0],[-1.23,4.1,-.65],[-1.25,3.35,-.65]],.1);
    pipe(g,m.copper,[[-.72,4.7,0],[-1.65,4.9,.4],[-2.4,5.3,.73],[-3.23,5.53,.73]],.13);
    const room=new T.Group();room.position.set(-3.21,5.53,.73);room.rotation.y=-PI/2-.23;g.add(room);
    box(room,m.dark,[0,0,0],[.8,.74,.07]);
    extrude(room,m.copper,[[-.47,-.43],[-.47,.29],[0,.52],[.47,.29],[.47,-.43],[.32,-.43],[.32,.2],[0,.36],[-.32,.2],[-.32,-.43]],.1,[0,0,.04]);
    for(let i=0;i<7;i++){
      const x=(i-3)*.087;
      mesh(room,new T.ConeGeometry(.065,.27+Math.sin(i*2)*.09,5),m.fire,[x,-.19,.135]);
      rod(room,m.ink,[x,-.38,.2],[x,.05,.2],.012);
    }
    box(room,m.ironDark,[0,-.42,.15],[.97,.1,.39]);
  }
  setGlow(value:number){if(Math.abs(value-this.glow)<.005)return;this.glow=value;this.select(this.selected);}
  select(id:PartId|null){
    this.selected=id;
    for(const [partId,g] of this.parts)g.traverse(o=>{if(o instanceof T.Mesh){const mat=o.material as T.MeshStandardMaterial,base=o.userData.baseEmissiveIntensity*this.glow;if(partId===id){if(o.userData.baseEmissiveIntensity>0)mat.emissive.copy(o.userData.baseEmissive);else mat.emissive.set('#9b551d');mat.emissiveIntensity=Math.max(.22,base);}else{mat.emissive.copy(o.userData.baseEmissive);mat.emissiveIntensity=base;}}});
  }
}
