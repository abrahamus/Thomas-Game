const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');global.THREE=T;require('../scripts/race-model.js');
const R=global.ThomasRaceCore,V=require('../scripts/race-renderer.js');
function named(root,name){return root.getObjectByName(name);}
function fixture(id,seed=24,theme='cargo'){
 const race=R.createRace({playerId:id,opponentId:id==='thomas'?'james':'thomas',seed,deliveryTheme:theme});race.phase='racing';race.countdown=0;
 const scene=V.makeScene(R,race.courseId,race.opponentId,theme,race);return {race,scene};
}
function atJob(race,type){const s=race.player.serviceStates.find(s=>s.type===type);race.player.distance=s.at;race.rival.distance=s.at-850;race.player.velocity=0;race.player.service=s;s.phase='ready';if(type==='cargo-unload')race.player.carried.container='container-1';if(type==='passenger-unload'){race.player.carried.passengers=3;race.player.serviceStates[0].groups.fill(true);}return s;}
test('ten distinct models have the promised silhouettes and both roles use their selected vehicles',()=>{
 const features={toby:'wooden-tram-body',spencer:'streamlined-silver-nose',emily:'brass-dome',diesel:'diesel-vent-grille',bulgy:'double-decker-upper-floor'};
 for(const c of R.CHARACTERS){const {race,scene}=fixture(c.id);V.updateScene(scene,race);assert.equal(scene.player.userData.kind,c.id);assert.equal(scene.rival.userData.kind,race.opponentId);if(features[c.id])assert.ok(named(scene.player,features[c.id]));assert.equal(!!scene.player.userData.tender,!!c.tenderOffset);
  if(c.id==='emily')assert.ok(scene.player.userData.wheels.some(w=>w.userData.radius>.8));
  const paths=[];scene.world.traverse(o=>{if(o.name==='road-path')paths.push(o);});assert.equal(paths.some(p=>p.userData.corridor==='player'),c.vehicleType==='road');
  V.disposeScene(scene);
 }
});
test('new player models expose all wash patches and every service target at narrow and wide widths',()=>{
 for(const c of R.CHARACTERS)for(const seed of [1,24,40]){
  const {race,scene}=fixture(c.id,seed);
  for(const spec of race.services){atJob(race,spec.type);if(spec.type==='wash')race.player.mudPatches.fill(true);
   for(const [w,h]of [[320,420],[375,420],[1400,800],[1920,900]]){
    scene.camera.aspect=w/h;V.updateScene(scene,race);
    const slot=scene.objects.services.find(b=>b.spec.id===spec.id).slots[0];
    const targets=spec.type==='wash'?scene.player.userData.mudPatches.map((object,id)=>({object,id,kind:'mud'})):
     spec.type==='cargo-unload'?[{object:scene.playerCoach.userData.container,id:'container-1',kind:'service'}]:slot.targets.map(t=>({...t,kind:'service'}));
    for(const target of targets){
     const rect=V.projectTarget(scene,target.object,w,h),x=rect.x+rect.width/2,y=rect.y+rect.height/2;
     assert.ok(x>=0&&x<=w&&y>=0&&y<=h,`${c.id}/${spec.type}/${w}/${target.id}: outside frame`);
     assert.deepEqual(V.pickScene(scene,race,x,y,w,h),{kind:target.kind,id:target.id},`${c.id}/${spec.type}/${w}/${target.id}`);
     if(spec.type==='wash'){
      const point=target.object.getWorldPosition(new T.Vector3()),direction=point.clone().sub(scene.camera.position),length=direction.length(),blockers=[];
      scene.player.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(p===target.object||!p.visible)return;blockers.push(o);});
      const hits=new T.Raycaster(scene.camera.position.clone(),direction.normalize(),0,length-.12).intersectObjects(blockers,false);
      assert.equal(hits.length,0,`${c.id}/wash/${target.id}: hidden by ${hits[0]?.object.name}`);
     }
    }
   }
  }
  V.disposeScene(scene);
 }
});

function boundsIn(object,frame){
 const bounds=new T.Box3(),inverse=frame.matrixWorld.clone().invert();
 object.traverse(o=>{if(!o.geometry)return;for(let p=o;p;p=p.parent)if(!p.visible)return;
  const pos=o.geometry.attributes.position,matrix=inverse.clone().multiply(o.matrixWorld);
  for(let i=0;i<pos.count;i++)bounds.expandByPoint(new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix));
 });return bounds;
}
function all(root,name){const out=[];root.traverse(o=>{if(o.name===name)out.push(o);});return out;}
test('all nine racers in both roles keep wheels on their surfaces and drawbars attached through curves and slopes',()=>{
 for(const c of R.CHARACTERS.filter(c=>c.vehicleType!=='air'))for(const who of ['player','rival']){
  const args={playerId:who==='player'?c.id:c.id==='thomas'?'percy':'thomas',opponentId:who==='rival'?c.id:c.id==='thomas'?'percy':'thomas',seed:24};
  const race=R.createRace(args),scene=V.makeScene(R,race.courseId,race.opponentId,race.deliveryTheme,race),surface=all(scene.world,c.vehicleType==='road'?'bertie-road':'running-rail');
  for(const distance of [3000,55000,82000,105000,126400,128600,131000,164000]){
   race.player.distance=race.rival.distance=distance;V.updateScene(scene,race);
   const engine=scene[who],coach=scene[who+'Coach'],coupler=scene[who+'Coupler'];
   for(const vehicle of [engine,coach])for(const wheel of vehicle.userData.wheels){
    const gaps=[-.06,0,.06].map(offset=>{
     const point=wheel.parent.localToWorld(new T.Vector3(wheel.position.x+offset,0,wheel.position.z));
     const hit=new T.Raycaster(point.clone().add(new T.Vector3(0,1,0)),new T.Vector3(0,-1,0),0,2).intersectObjects(surface,false)[0];
     return hit?Math.abs(hit.point.y-point.y):Infinity;
    });assert.ok(Math.min(...gaps)<.025,`${c.id}/${who}/${distance}: unsupported wheel`);
   }
   const front=coach.localToWorld(new T.Vector3(0,.82,2.61)),rear=engine.userData.tender?engine.userData.tender.localToWorld(new T.Vector3(0,.82,-1.52)):engine.localToWorld(new T.Vector3(0,.82,c.rearCoupler));
   assert.ok(rear.distanceTo(front)>.1&&rear.distanceTo(front)<3.5,`${c.id}/${who}/${distance}: coupling gap ${rear.distanceTo(front)}`);
   assert.ok(coupler.position.distanceTo(rear.clone().add(front).multiplyScalar(.5))<1e-8);
   for(const aspect of [320/420,375/420,1400/800,1920/900]){
    scene.camera.aspect=aspect;V.updateScene(scene,race);
    for(const object of [engine,coach]){const box=boundsIn(object,new T.Object3D());for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
     const p=new T.Vector3(x,y,z).project(scene.camera);assert.ok(Math.abs(p.x)<=1&&Math.abs(p.y)<=1,`${c.id}/${who}/${aspect}: cropped vehicle`);
    }}
   }
  }V.disposeScene(scene);
 }
});
test('all character bodies, tenders and loads fit the tunnels and pass open sheep gates',()=>{
 for(const c of R.CHARACTERS.filter(c=>c.vehicleType!=='air'))for(const theme of ['passengers','cargo']){
  const {race,scene}=fixture(c.id,24,theme);const state=atJob(race,'animals');state.phase='complete';state.completed=true;race.player.service=null;
  race.player.carried.passengers=3;race.player.carried.container='container-1';race.player.serviceStates[0].groups.fill(true);
  for(const distance of [state.at,state.at+800,state.at+1800,state.at+2600]){
   race.player.distance=distance;V.updateScene(scene,race);const slot=scene.objects.services.find(s=>s.spec.id===state.id).slots[0],gate=boundsIn(slot.gate,slot.group);
   for(const obj of [scene.player,scene.playerCoach])assert.equal(gate.intersectsBox(boundsIn(obj,slot.group)),false,`${c.id}/${theme}: gate collision`);
  }
  for(const tunnel of all(scene.world,'railway-tunnel').filter(t=>t.userData.corridor==='player')){
   const section=tunnel.userData.section;race.player.distance=(section.start+section.end)/2;
   V.updateScene(scene,race);
   for(const obj of [scene.player,scene.playerCoach]){
    const body=boundsIn(obj,tunnel),side=Math.max(Math.abs(body.min.x),Math.abs(body.max.x));
    assert.ok(side<2.8&&body.max.y<3+Math.sqrt(9-side*side)-.15,`${c.id}/${theme}: tunnel clearance`);
   }
   const solids=[];tunnel.traverse(o=>{if(o.isMesh)solids.push(o);});
   for(const aspect of [320/420,375/420,1400/800,1920/900])for(const stage of ['approach','inside','exit']){
    race.player.distance=stage==='approach'?section.start-2500:stage==='exit'?section.end+2500:(section.start+section.end)/2;scene.camera.aspect=aspect;V.updateScene(scene,race);
    const point=scene.player.localToWorld(new T.Vector3(0,c.id==='bulgy'?3.7:2.5,0)),direction=point.clone().sub(scene.camera.position),length=direction.length();
    const hits=new T.Raycaster(scene.camera.position.clone(),direction.normalize(),0,length-.1).intersectObjects(solids,false);assert.equal(hits.length>0,stage==='inside',`${c.id}/${aspect}/${stage}`);
   }
  }V.disposeScene(scene);
 }
});
test('both buses and either mixed corridor keep independent crossing traffic clear of racers and barriers',()=>{
 for(const [playerId,opponentId]of [['bertie','bulgy'],['bulgy','bertie'],['bulgy','thomas'],['thomas','bulgy'],['bertie','harold'],['harold','bertie'],['thomas','harold'],['harold','thomas']]){
  const race=R.createRace({playerId,opponentId,seed:24}),scene=V.makeScene(R,race.courseId,opponentId,race.deliveryTheme,race);
  for(const who of ['player','rival']){const s=race[who].serviceStates.find(s=>s.type==='level-crossing');race[who].distance=s.at;race[who].service=s;s.phase='ready';}
  V.updateScene(scene,race);const slots=scene.objects.services.find(s=>s.spec.type==='level-crossing').slots,frame=slots[0].group;
  for(const a of [0,.15,.3,.45,.59,.6,.8,1])for(const b of [0,.15,.3,.45,.59,.6,.8,1]){
   for(const [who,progress]of [['player',a],['rival',b]]){const s=race[who].service;s.phase=progress===1?'complete':'working';s.duration=5;s.remaining=5*(1-progress);}
   V.updateScene(scene,race);
   const traffic=slots.map(slot=>slot.crossingTrain||slot.car).filter(o=>o.visible);
   if(traffic.length===2)assert.equal(boundsIn(traffic[0],frame).intersectsBox(boundsIn(traffic[1],frame)),false,`${playerId}/${opponentId}/${a}/${b}: traffic collision`);
   for(const slot of slots){for(const vehicle of [scene[slot.who],scene[slot.who+'Coach']]){
    for(const arm of slot.barriers)assert.equal(boundsIn(arm,frame).intersectsBox(boundsIn(vehicle,frame)),false,`${playerId}/${opponentId}: barrier hits waiting vehicle`);
   }}
   for(const travel of [0,600,1250,2000]){
    for(const [who,progress]of [['player',a],['rival',b]])if(progress===1)race[who].distance=race[who].service.at+travel;
    V.updateScene(scene,race);
    for(const t of traffic)for(const vehicle of [scene.player,scene.rival,scene.playerCoach,scene.rivalCoach])assert.equal(boundsIn(t,frame).intersectsBox(boundsIn(vehicle,frame)),false,`${playerId}/${opponentId}/${a}/${b}/${travel}: traffic hits racer`);
   }
   for(const who of ['player','rival'])race[who].distance=race[who].service.at;
  }V.disposeScene(scene);
 }
});
