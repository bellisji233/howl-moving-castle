import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AutoTour,tourFrame} from '../src/tour/AutoTour.ts';
test('tour covers exterior, leg, face, explode, core, return in order',()=>{
  assert.deepEqual([0,6,12,18,24,30].map(t=>tourFrame(t).step),[0,1,2,3,4,5]);
  assert.equal(tourFrame(6).isolate,true);assert.equal(tourFrame(12).part,'FACE');assert.equal(tourFrame(25).xray,true);
});
test('explosion opens and closes continuously and remains within range',()=>{
  for(let t=0;t<72;t+=.01){const e=tourFrame(t).explode;assert.ok(e>=0&&e<=1);}
  assert.ok(Math.abs(tourFrame(24-1e-6).explode-tourFrame(24+1e-6).explode)<1e-6);
  assert.equal(tourFrame(30).explode,0);assert.equal(tourFrame(36).explode,0);
});
test('input takes control immediately and idle resumes only after 35 seconds',()=>{
  const t=new AutoTour();t.enable(100);assert.ok(t.tick(5100));t.interrupt(6000);
  assert.equal(t.active,false);assert.equal(t.tick(40999),null);assert.ok(t.tick(41000));
  t.disable();assert.equal(t.tick(999999),null);
});
