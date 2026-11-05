import * as T from 'three';
import {box,rod,ring,bolts,extrude,mergePart,pipe} from './geometry';
import type {Materials} from './materials';
import {DESTINATIONS,type Destination} from './Environment';
import {DOOR_ANGLES,DOOR_SECTORS} from './DoorDial';
export class MagicDoor {
  root=new T.Group();private leaf=new T.Group();private needle=new T.Group();private from=0;private target=0;private gears:T.Group[]=[];
  constructor(parent:T.Group,m:Materials){
    this.root.name='FOUR_COLOR_MAGIC_DOOR';this.root.userData.animatedAttachment=true;
    this.root.position.set(2.78,6.08,-.08);this.root.rotation.y=Math.PI/2+.12;parent.add(this.root);
    const frame=new T.Group();this.root.add(frame);
    for(const x of [-.5,.5])box(frame,m.timber,[x,.91,0],[.14,1.82,.21]);
    box(frame,m.timber,[0,1.86,0],[1.16,.17,.23]);box(frame,m.ironDark,[0,.02,.08],[1.1,.10,.35]);box(frame,m.boards,[0,-.045,.34],[1.3,.12,.8]);
    box(frame,m.dark,[0,.9,-.07],[.9,1.7,.03]);mergePart(frame);
    this.leaf.position.set(-.42,.08,.09);this.root.add(this.leaf);
    const wood=new T.Group();this.leaf.add(wood);
    box(wood,m.boards,[.42,.81,0],[.84,1.62,.1]);
    for(let i=1;i<5;i++)box(wood,m.timber,[i*.168,.81,.056],[.012,1.59,.012]);
    for(const y of [.2,1.4]){box(wood,m.ironDark,[.3,y,.075],[.66,.065,.04]);for(const x of [.08,.48])rod(wood,m.brass,[x,y,.08],[x,y,.12],.018);}
    for(const y of [.25,1.3])rod(wood,m.ironDark,[0,y-.1,0],[0,y+.1,0],.05);
    rod(wood,m.brass,[.66,.64,.06],[.66,.64,.14],.05);ring(wood,m.brass,[.66,.59,.16],.07,.012);
    mergePart(wood);
    const dial=new T.Group();dial.position.set(.44,1.07,.17);this.leaf.add(dial);
    const casting=new T.Group();dial.add(casting);
    const disc=(parent:T.Group,material:T.Material,r:number,depth:number,z:number)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,depth,64),material);o.rotation.x=Math.PI/2;o.position.z=z;parent.add(o);};
    disc(casting,m.ironDark,.257,.065,-.025);disc(casting,m.brass,.25,.055,.006);disc(casting,m.ironDark,.215,.018,.041);
    ring(casting,m.brass,[0,0,.045],.239,.014);ring(casting,m.brass,[0,0,.057],.214,.008);ring(casting,m.copper,[0,0,.063],.207,.004);
    bolts(casting,m.brass,[0,0,.06],.233,8,'z',.012);
    for(let i=0;i<40;i++){const a=i*Math.PI/20,inner=i%5===0?.219:.224;rod(casting,m.ironDark,[Math.sin(a)*inner,Math.cos(a)*inner,.059],[Math.sin(a)*.231,Math.cos(a)*.231,.059],.0018);}
    for(const {id,start} of DOOR_SECTORS){
      const outline:[number,number][]=[[0,0]];for(let i=0;i<=24;i++){const a=start+.025+(Math.PI/2-.05)*i/24;outline.push([Math.cos(a)*.201,Math.sin(a)*.201]);}
      const enamel=new T.MeshStandardMaterial({color:DESTINATIONS[id].color,roughness:.28,metalness:.28,map:m.brass.map,bumpMap:m.brass.bumpMap,bumpScale:.001});
      extrude(casting,enamel,outline,.008,[0,0,.048],[0,0,0],.002);
    }
    for(const a of [0,Math.PI/2])rod(casting,m.brass,[-Math.cos(a)*.204,-Math.sin(a)*.204,.065],[Math.cos(a)*.204,Math.sin(a)*.204,.065],.003);
    for(let i=0;i<2;i++){
      const x=.15+i*.07;pipe(casting,m.copper,[[x,.18,0],[x+.025,.25,0],[x+.04,.29,.005]],.008);rod(casting,m.brass,[x+.04,.27,.005],[x+.04,.30,.005],.014);
    }
    const gear=(x:number,y:number,r:number,teeth:number)=>{
      const g=new T.Group();g.position.set(x,y,.012);dial.add(g);const shape=new T.Shape();for(let i=0;i<teeth*4;i++){const a=i/(teeth*4)*Math.PI*2,rr=r*(i%4===1||i%4===2?1:.85);if(i)shape.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);else shape.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}shape.closePath();const hole=new T.Path();hole.absarc(0,0,r*.57,0,Math.PI*2,true);shape.holes.push(hole);g.add(new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:true,bevelSize:.0018,bevelThickness:.0018,bevelSegments:1,steps:1}),m.brass));
      for(let i=0;i<3;i++){const a=i*Math.PI/3;rod(g,m.brass,[-Math.cos(a)*r*.65,-Math.sin(a)*r*.65,.012],[Math.cos(a)*r*.65,Math.sin(a)*r*.65,.012],.008);}disc(g,m.brass,r*.19,.032,.02);this.gears.push(g);
    };
    gear(.19,-.205,.091,18);gear(-.04,-.274,.075,15);
    rod(casting,m.copper,[-.04,-.274,.01],[.19,-.205,.01],.014);bolts(casting,m.ironDark,[0,0,.055],.233,4,'z',.005);mergePart(casting);
    dial.add(this.needle);
    extrude(this.needle,m.brass,[[-.012,-.10],[-.033,-.15],[0,-.19],[.033,-.15],[.012,-.10],[.012,.11],[.041,.095],[0,.198],[-.041,.095],[-.012,.11]],.012,[0,0,.087],[0,0,0],.002);
    disc(this.needle,m.brass,.039,.027,.108);ring(this.needle,m.copper,[0,0,.125],.028,.003);rod(this.needle,m.ironDark,[-.013,-.006,.127],[.013,.006,.127],.0025);
    this.root.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;o.receiveShadow=true;o.userData.portalControl=true;}});
  }
  state(){return {hingeAngle:this.leaf.rotation.y,needleAngle:this.needle.rotation.z};}
  choose(id:Destination){this.from=this.needle.rotation.z;const difference=DOOR_ANGLES[id]-this.from;this.target=this.from+Math.atan2(Math.sin(difference),Math.cos(difference));}
  update(progress:number,reduced:boolean){const t=Math.min(1,progress/.4),ease=t*t*(3-2*t);this.needle.rotation.z=this.from+(this.target-this.from)*ease;this.gears.forEach((g,i)=>g.rotation.z=this.needle.rotation.z*(i?1.05:-.8));this.leaf.rotation.y=reduced?0:-Math.sin(Math.PI*progress)*1.12;}
}
