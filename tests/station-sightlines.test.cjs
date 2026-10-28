'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');global.THREE=T;
require('../scripts/race-model.js');const R=ThomasRaceCore,V=require('../scripts/race-renderer.js');

test('foreground hills cannot hide the shuffled water and fuel stops on the mountain course',()=>{
 for(const [playerId,opponentId] of [['thomas','percy'],['bertie','harold'],['harold','thomas']])for(const seed of [5,12]){
  const r=R.createRace({courseId:'mountain',playerId,opponentId,seed,deliveryTheme:'cargo'});
  r.phase='racing';r.countdown=0;
  const b=V.makeScene(R,r.courseId,opponentId,r.deliveryTheme,r),blockers=[];
  b.world.traverse(o=>{if(o.isMesh&&/^(distant-rolling-hill|distant-mountain|hillside-rock|exposed-hillside-earth|continuous-ground)$/.test(o.name))blockers.push(o);});
  const s=r.player.serviceStates[1];r.player.service=s;r.player.velocity=0;
  assert.ok(['water','coal'].includes(s.type));
  for(const [w,h]of [[320,560],[393,640],[844,390],[1366,768],[1920,1080]])for(const approach of [-1500,0])for(const progress of [0,.5,1]){
   b.camera.aspect=w/h;r.player.distance=s.at+approach;r.rival.distance=s.at-850;
   s.phase=progress?'working':'ready';s.duration=4;s.remaining=4*(1-progress);s.progress=progress;s.activeUnit=0;
   V.updateScene(b,r);
   const slot=b.objects.services.find(x=>x.spec.id===s.id).slots[0];
   const targets=[['player',b.player.localToWorld(new T.Vector3(0,2,0))],...slot.targets.map(t=>[t.id,new T.Box3().setFromObject(t.object).getCenter(new T.Vector3())])];
   for(const [id,point]of targets){
    const direction=point.clone().sub(b.camera.position),length=direction.length();
    const hits=new T.Raycaster(b.camera.position.clone(),direction.normalize(),0,length-.05).intersectObjects(blockers,false);
    assert.equal(hits.length,0,`${playerId}/${s.type}/${w}x${h}/${approach}/${progress}/${id}: blocked by ${hits[0]?.object.name}`);
   }
  }
  assert.ok(blockers.some(o=>o.name==='distant-mountain'),'Mountains remain part of the course');
  V.disposeScene(b);
 }
});
