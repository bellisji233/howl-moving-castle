// Design units and an authored gait, not measured dimensions or dynamics.
export type Vec3=[number,number,number];
export type LimbId='FL_LIMB'|'FR_LIMB'|'BL_LIMB'|'BR_LIMB';
export const GAIT={stride:1.35,cadence:.52,stance:.76,lift:.45,ankleHeight:.44,upper:1.75,lower:1.72} as const;
export const LEGS:{id:LimbId;side:number;front:boolean;offset:number}[]=[
  {id:'FL_LIMB',side:-1,front:true,offset:0},
  {id:'FR_LIMB',side:1,front:true,offset:.5},
  {id:'BL_LIMB',side:-1,front:false,offset:.75},
  {id:'BR_LIMB',side:1,front:false,offset:.25},
];
export const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const scale=(a:Vec3,n:number):Vec3=>[a[0]*n,a[1]*n,a[2]*n];
export const length=(a:Vec3)=>Math.hypot(...a);
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const smooth=(u:number)=>u*u*(3-2*u);
const TAU=Math.PI*2;

export function solveIK(hip:Vec3,target:Vec3,pole:Vec3,upper=GAIT.upper,lower=GAIT.lower){
  const delta=sub(target,hip),raw=length(delta),distance=clamp(raw,Math.abs(upper-lower)+1e-6,upper+lower-1e-6);
  const direction=raw>1e-9?scale(delta,1/raw):[0,-1,0] as Vec3;
  let bend=sub(pole,scale(direction,dot(pole,direction)));
  if(length(bend)<1e-7){const fallback:Vec3=Math.abs(direction[0])<.8?[1,0,0]:[0,0,1];bend=sub(fallback,scale(direction,dot(fallback,direction)));}
  bend=scale(bend,1/length(bend));
  const a=(upper*upper-lower*lower+distance*distance)/(2*distance),h=Math.sqrt(Math.max(0,upper*upper-a*a));
  const knee=add(add(hip,scale(direction,a)),scale(bend,h));
  const ankle=add(hip,scale(direction,distance));
  return{hip,knee,ankle,reachable:Math.abs(distance-raw)<1e-5,
    hipAngle:Math.acos(clamp(-(knee[1]-hip[1])/upper,-1,1))*180/Math.PI,
    kneeAngle:180-Math.acos(clamp((upper*upper+lower*lower-distance*distance)/(2*upper*lower),-1,1))*180/Math.PI};
}

export function rotateBody(p:Vec3,rx:number,rz:number):Vec3{
  const y=p[1]*Math.cos(rx)-p[2]*Math.sin(rx),z=p[1]*Math.sin(rx)+p[2]*Math.cos(rx);
  return[p[0]*Math.cos(rz)-y*Math.sin(rz),p[0]*Math.sin(rz)+y*Math.cos(rz),z];
}
export interface FootPose {id:LimbId;phase:number;step:number;contact:boolean;hip:Vec3;knee:Vec3;ankle:Vec3;target:Vec3;reachable:boolean;hipAngle:number;kneeAngle:number;}
export interface CastlePose {cycles:number;phase:number;body:{position:Vec3;rx:number;rz:number};feet:FootPose[];sway:{house:number;chimney:number};}

export function derivePose(cycles:number,decorativeMotion=true):CastlePose{
  if(!Number.isFinite(cycles))throw new Error('Gait cycles must be finite');
  const phase=cycles-Math.floor(cycles),angle=cycles*TAU;
  const body={position:[decorativeMotion?.02*Math.sin(angle):0,decorativeMotion?.055*(1-Math.cos(angle*2)):0,cycles*GAIT.stride] as Vec3,
    rx:decorativeMotion?.007*Math.sin(angle*2):0,rz:decorativeMotion?.012*Math.sin(angle):0};
  const feet=LEGS.map(leg=>{
    const q=cycles+leg.offset,step=Math.floor(q),p=q-step;
    const startZ=(step-leg.offset+GAIT.stance/2)*GAIT.stride+(leg.front?2.17:-.93);
    const u=clamp((p-GAIT.stance)/(1-GAIT.stance),0,1);
    const target:Vec3=[leg.side*(leg.front?2.72:3),GAIT.ankleHeight+GAIT.lift*Math.sin(Math.PI*u)**2,startZ+GAIT.stride*smooth(u)];
    const hip=add(rotateBody([leg.side*1.95,3.05,leg.front?1.55:-1.55],body.rx,body.rz),body.position);
    const solved=solveIK(hip,target,[leg.side,0,-.42]);
    return{id:leg.id,phase:p,step,contact:p<GAIT.stance&&solved.reachable,target,...solved};
  });
  return{cycles,phase,body,feet,sway:{house:decorativeMotion?.005*Math.sin(angle-.45):0,chimney:decorativeMotion?.004*Math.sin(angle-.85):0}};
}

export class SimulationClock {
  cycles=0;playing=false;speed=1;
  advance(seconds:number){if(!Number.isFinite(seconds)||seconds<0)throw new Error('Time delta must be finite and nonnegative');if(this.playing)this.cycles+=seconds*GAIT.cadence*this.speed;return this.cycles;}
  setSpeed(value:number){if(!Number.isFinite(value))throw new Error('Speed must be finite');this.speed=clamp(value,.25,1.5);}
  reset(){this.cycles=0;this.playing=false;this.speed=1;}
}
