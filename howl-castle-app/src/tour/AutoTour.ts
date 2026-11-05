import type {PartId} from '../assets/parts';
import type {ViewId} from '../world/Scene';

export interface TourFrame {step:number;name:string;view:ViewId;part:PartId|null;isolate:boolean;xray:boolean;explode:number;}
const ease=(u:number)=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
export function tourFrame(seconds:number):TourFrame{
  const t=((seconds%36)+36)%36,step=Math.floor(t/6),local=t-step*6;
  const frames:TourFrame[]=[
    {step:0,name:'完整城堡',view:'hero',part:null,isolate:false,xray:false,explode:0},
    {step:1,name:'四足与接地',view:'left',part:'FL_LIMB',isolate:true,xray:false,explode:0},
    {step:2,name:'机械脸与入口',view:'front',part:'FACE',isolate:false,xray:false,explode:0},
    {step:3,name:'结构拆解',view:'hero',part:null,isolate:false,xray:false,explode:ease((local-1)/1.5)},
    {step:4,name:'推演的动力核心',view:'hero',part:'FIRE',isolate:false,xray:true,explode:1-ease(local/1.5)},
    {step:5,name:'回到完整城堡',view:'hero',part:null,isolate:false,xray:false,explode:0},
  ];
  return frames[step];
}
export class AutoTour {
  enabled=false;active=false;started=0;lastInput=0;step=-1;
  enable(now:number){this.enabled=true;this.begin(now);}
  begin(now:number){this.active=true;this.started=now;this.step=-1;}
  disable(){this.enabled=false;this.active=false;this.step=-1;}
  interrupt(now:number){this.lastInput=now;this.active=false;this.step=-1;}
  tick(now:number){if(this.enabled&&!this.active&&now-this.lastInput>=35000)this.begin(now);return this.active?tourFrame((now-this.started)/1000):null;}
}
