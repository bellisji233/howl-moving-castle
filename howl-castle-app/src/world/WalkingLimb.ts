import * as T from 'three';
import {GAIT,type FootPose,type Vec3} from '../simulation/derivePose';
import type {Materials} from './materials';
import {ball,rod,ring,bolts,pipe,mergePart} from './geometry';

const Y=new T.Vector3(0,1,0);
export class WalkingLimb {
  upper=new T.Group();lower=new T.Group();foot=new T.Group();
  hip=new T.Group();knee=new T.Group();ankle=new T.Group();
  constructor(readonly group:T.Group,m:Materials,side:number){
    group.add(this.upper,this.lower,this.foot,this.hip,this.knee,this.ankle);
    for(const segment of [this.upper,this.lower]){
      for(const x of [-.105,.105])rod(segment,m.brass,[x,0,0],[x,1,0],.065);
      rod(segment,m.ink,[0,0,0],[0,1,0],.035);
      rod(segment,m.ironDark,[0,.1,.14],[0,.56,.14],.12);
      rod(segment,m.steel,[0,.54,.14],[0,.94,.14],.055);
      for(const y of [.12,.52])ring(segment,m.brass,[0,y,.14],.12,.018,[Math.PI/2,0,0]);
      mergePart(segment);
      segment.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=(o.material===m.brass);});
    }
    for(const [g,rad] of [[this.hip,.32],[this.knee,.24],[this.ankle,.19]] as [T.Group,number][]){
      rod(g,m.copper,[-.16,0,0],[.16,0,0],rad);
      ring(g,m.brass,[side*.17,0,0],rad*.83,.035,[0,Math.PI/2,0]);
      bolts(g,m.brass,[side*.19,0,0],rad*.65,8,'x',.024);
      rod(g,m.brass,[-side*.19,0,0],[side*.22,0,0],rad*.28);
      mergePart(g);g.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=false;});
    }
    ball(this.foot,m.ironDark,[0,-.18,.13],[.28,.16,.42]);
    for(let j=-1;j<=1;j++){
      const z=.95-Math.abs(j)*.14;
      pipe(this.foot,m.copper,[[0,-.15,0],[j*.24,-.26,.47],[j*.32,-.35,z]],.085);
      rod(this.foot,m.ink,[j*.32,-.35,z],[j*.32,-.385,z+.18],.075,.008);
      ring(this.foot,m.brass,[j*.17,-.22,.34],.09,.018,[Math.PI/2,0,0]);
    }
    pipe(this.foot,m.copper,[[0,-.2,0],[side*.17,-.32,-.32],[side*.2,-.37,-.48]],.07);
    mergePart(this.foot);this.foot.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=(o.material===m.copper);});
  }
  apply(pose:FootPose,worldBodyZ:number){
    const point=(p:Vec3)=>new T.Vector3(p[0],p[1],p[2]-worldBodyZ);
    const hip=point(pose.hip),knee=point(pose.knee),ankle=point(pose.ankle);
    this.hip.position.copy(hip);this.knee.position.copy(knee);this.ankle.position.copy(ankle);
    this.upper.position.copy(hip);this.upper.quaternion.setFromUnitVectors(Y,knee.clone().sub(hip).normalize());this.upper.scale.set(1,GAIT.upper,1);
    this.lower.position.copy(knee);this.lower.quaternion.setFromUnitVectors(Y,ankle.clone().sub(knee).normalize());this.lower.scale.set(1,GAIT.lower,1);
    this.foot.position.copy(ankle);
    this.hip.rotation.x=pose.hipAngle*Math.PI/180;this.knee.rotation.x=pose.kneeAngle*Math.PI/180;
    this.group.userData.pose={phase:pose.phase,contact:pose.contact,hipAngle:pose.hipAngle,kneeAngle:pose.kneeAngle,ankle:pose.ankle};
  }
}
