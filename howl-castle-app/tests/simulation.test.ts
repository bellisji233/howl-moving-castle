import assert from 'node:assert/strict';
import {test} from 'node:test';
import {derivePose,solveIK,SimulationClock,GAIT,LEGS,length,sub} from '../src/simulation/derivePose.ts';

test('all joints stay finite and preserve both bone lengths over 20 cycles',()=>{
  for(let sample=0;sample<4000;sample++)for(const foot of derivePose(sample/200).feet){
    assert.ok([...foot.hip,...foot.knee,...foot.ankle,foot.hipAngle,foot.kneeAngle].every(Number.isFinite));
    assert.ok(foot.reachable);
    assert.ok(Math.abs(length(sub(foot.knee,foot.hip))-GAIT.upper)<1e-10);
    assert.ok(Math.abs(length(sub(foot.ankle,foot.knee))-GAIT.lower)<1e-10);
  }
});
test('support feet are fixed in world space while the body moves',()=>{
  let comparisons=0,maxDrift=0;
  for(const leg of LEGS)for(let step=-2;step<10;step++){
    const reference=derivePose(step-leg.offset+.001).feet.find(f=>f.id===leg.id)!;
    for(let i=1;i<100;i++){
      const foot=derivePose(step-leg.offset+GAIT.stance*i/100).feet.find(f=>f.id===leg.id)!;
      assert.ok(foot.contact);maxDrift=Math.max(maxDrift,length(sub(foot.ankle,reference.ankle)));comparisons++;
    }
  }
  assert.ok(maxDrift<1e-10);assert.ok(comparisons>4000);
});
test('swing and contact boundaries are continuous and feet do not penetrate ground',()=>{
  for(const leg of LEGS)for(const boundary of [0,GAIT.stance,1]){
    const a=derivePose(2-leg.offset+boundary-1e-7).feet.find(f=>f.id===leg.id)!;
    const b=derivePose(2-leg.offset+boundary+1e-7).feet.find(f=>f.id===leg.id)!;
    assert.ok(length(sub(a.ankle,b.ankle))<1e-5);
  }
  for(let i=0;i<1000;i++)for(const foot of derivePose(i/1000).feet)assert.ok(foot.ankle[1]>=GAIT.ankleHeight-1e-12);
});
test('arbitrary seeking and reduced decorative motion are deterministic',()=>{
  const expected=derivePose(9.134);
  for(const t of [0,4,100,-2,9.134])derivePose(t);
  assert.deepEqual(derivePose(9.134),expected);
  const reduced=derivePose(.413,false);
  assert.equal(reduced.body.rx,0);assert.equal(reduced.body.rz,0);assert.equal(reduced.sway.house,0);
  assert.ok(reduced.feet.some(f=>!f.contact));
});
test('clock preserves time across frame sizes, pause, and speed changes',()=>{
  const a=new SimulationClock(),b=new SimulationClock();a.playing=b.playing=true;
  a.advance(10);for(let i=0;i<1000;i++)b.advance(.01);
  assert.ok(Math.abs(a.cycles-b.cycles)<1e-10);
  a.playing=false;const frozen=derivePose(a.cycles);a.advance(500);assert.deepEqual(derivePose(a.cycles),frozen);
  a.setSpeed(.25);assert.deepEqual(derivePose(a.cycles),frozen);a.playing=true;a.advance(2);
  assert.ok(Math.abs(a.cycles-(10*GAIT.cadence+.5*GAIT.cadence))<1e-10);
});
test('IK handles impossible and zero-distance targets without NaN',()=>{
  for(const target of [[0,0,0],[100,0,0],[0,-100,0]] as [number,number,number][]){
    const result=solveIK([0,0,0],target,[1,0,0]);assert.equal(result.reachable,false);
    assert.ok([...result.knee,...result.ankle].every(Number.isFinite));
  }
});
