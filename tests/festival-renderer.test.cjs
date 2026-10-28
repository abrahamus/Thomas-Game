'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');global.THREE=T;require('../scripts/race-model.js');
const R=global.ThomasRaceCore,V=require('../scripts/race-renderer.js');
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
function fixture(playerId,opponentId,courseId='country',winner='tie'){
 const r=R.createRace({playerId,opponentId,courseId,deliveryTheme:'passengers'});r.phase='complete';r.elapsed=300;r.countdown=0;r.winner=winner;r.finishMotion={rivalVelocity:R.CRUISE_SPEED,rivalTarget:R.CRUISE_SPEED};
 for(const who of ['player','rival']){const v=r[who];v.distance=R.COURSES[courseId].length;v.serviceStates.forEach(s=>{s.completed=true;s.phase='complete';s.groups.fill(true)});v.finishTime=300;v.finishEvent={time:300,speed:R.CRUISE_SPEED,wheelTurns:0};}
 return R.createFinishPresentation(r);
}
function bounds(root){const b=new T.Box3();root.traverse(o=>{if(!o.geometry||!visible(o))return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)b.expandByPoint(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));});return b;}
function inView(b,object,w,h,label){const box=bounds(object);assert.ok(!box.isEmpty(),label);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new T.Vector3(x,y,z).project(b.camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,`${label}: outside view ${p.x},${p.y}`);}}
for(const c of R.CHARACTERS)for(const role of ['player','rival'])test(`${c.id}/${role}: visible face, coach, award and finish clearance at desktop and portrait/landscape phone sizes`,()=>{
 const p=fixture(role==='player'?c.id:c.id==='thomas'?'harold':'thomas',role==='rival'?c.id:c.id==='thomas'?'harold':'thomas'),r=p.race,b=V.makeScene(R,r.courseId,r.opponentId,r.deliveryTheme,r);
 let last=0;for(const age of [0,.5,2,4.5,6.5,9,12]){
  R.stepFinishPresentation(p,age-last);last=age;
  for(const [w,h] of [[310,330],[516,145],[320,420],[375,420],[1366,768],[1920,900]]){
   b.camera.aspect=w/h;V.updateScene(b,r,{festival:p});
   for(const who of ['player','rival']){
    inView(b,b[who],w,h,`${c.id}/${role}/${who}/${age}/${w}`);
    if(R.getCharacter(r,who).vehicleType!=='air')inView(b,b[who+'Coach'],w,h,`${c.id}/${who}/coach/${age}/${w}`);
    const award=b.festival.awards[who];assert.ok(Math.abs(award.position.z-(R.finishRunout(r,who)*R.WORLD_SCALE+1))<1e-8,'award stands stay anchored');if(award.visible)inView(b,award,w,h,`${c.id}/${who}/award/${age}/${w}`);
    const face=b[who].getObjectByName('face').getWorldPosition(new T.Vector3()),ray=face.clone().sub(b.camera.position),blockers=[];
    b.festival.group.traverse(o=>{if(o.isMesh&&visible(o))blockers.push(o)});
    const hits=new T.Raycaster(b.camera.position.clone(),ray.clone().normalize(),0,ray.length()-.2).intersectObjects(blockers,false);
    assert.equal(hits.length,0,`${c.id}/${who}/${age}/${w}: face behind ${hits[0]?.object.name}`);
   }
   if(R.getCharacter(r,role).vehicleType==='air'){const gantry=b.world.getObjectByName('finish-gantry');assert.equal(bounds(b[role]).intersectsBox(bounds(gantry)),false,'Harold clears the real banner and posts');}
   if(age>=9){for(const who of ['player','rival']){const v=r[who],rear=v.distance-R.getCoachOffset(r,who)-R.getCharacter(r,who).coachRear;assert.ok(rear>R.COURSES[r.courseId].length+100);}}
  }
 }V.disposeScene(b);
});
test('distinct course settings, finite confetti, early computer award and frozen motion use presentation time',()=>{
 for(const [course,name]of [['country','festival-station'],['harbour','decorated-festival-boat'],['mountain','snowy-stall-roof']]){
  const p=fixture('bertie','harold',course,'rival'),r=p.race,b=V.makeScene(R,course,r.opponentId,r.deliveryTheme,r);assert.ok(b.festival.group.getObjectByName(name));
  V.updateScene(b,r);assert.equal(b.festival.awards.rival.visible,true);assert.equal(b.festival.awards.player.visible,false);assert.equal(b.festival.awards.rival.userData.trophy.visible,true);
  R.stepFinishPresentation(p,6);V.updateScene(b,r,{festival:p});assert.equal(b.festival.awards.player.userData.rosette.visible,true);
  const arm=b.festival.marshal.userData.waveArm.rotation.z;V.updateScene(b,r,{festival:p,paused:true});assert.equal(b.festival.marshal.userData.waveArm.rotation.z,arm);
  R.stepFinishPresentation(p,10);V.updateScene(b,r,{festival:p});assert.ok(b.festival.confetti.every(m=>!m.visible));assert.notEqual(b.festival.marshal.userData.waveArm.rotation.z,arm);
  V.disposeScene(b);
 }
});
