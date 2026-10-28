const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');global.THREE=T;require('../scripts/race-model.js');const R=ThomasRaceCore,V=require('../scripts/race-renderer.js');
function all(root,name){const found=[];root.traverse(o=>{if(o.name===name)found.push(o)});return found;}
function fixture(playerId,opponentId,courseId='country'){
 const r=R.createRace({playerId,opponentId,courseId,seed:24,deliveryTheme:'cargo'});r.phase='racing';r.countdown=0;
 return {r,b:V.makeScene(R,courseId,opponentId,r.deliveryTheme,r)};
}
test('Harold has two cloud passages paired with the other racer’s two complete road tunnels',()=>{
 for(const bus of ['bertie','bulgy'])for(const who of ['player','rival'])for(const course of Object.keys(R.COURSES)){
  const{r,b}=fixture(who==='player'?'harold':bus,who==='rival'?'harold':bus,course);
  const tunnels=all(b.world,'railway-tunnel');assert.equal(tunnels.length,2,'bus keeps both tunnels when racing Harold');
  const clouds=all(b.world,'flight-cloud-section');assert.equal(clouds.length,2,'two cloud banks replace the tunnel hoops');
  assert.equal(all(b.world,'flight-checkpoint-ring').length,0,'other terrain also uses natural scenery instead of misleading hoops');
  assert.deepEqual(clouds.map(o=>o.userData.sectionId).sort(),tunnels.map(o=>o.userData.section.id).sort());
  for(const cloud of clouds){assert.equal(cloud.userData.corridor,who);cloud.traverse(o=>{if(o.isMesh)assert.equal(o.castShadow,false)});}
  V.disposeScene(b);
 }
});
test('each crossing uses one continuous transport mode across both routes, including Harold’s',()=>{
 for(const [playerId,opponentId,mode]of [['bertie','harold','road'],['harold','bulgy','road'],['bertie','bulgy','road'],['thomas','harold','road'],['harold','thomas','road'],['bertie','thomas','road'],['thomas','bulgy','road'],['thomas','percy','road']]){
  const{r,b}=fixture(playerId,opponentId);V.updateScene(b,r);const bundle=b.objects.services.find(o=>o.spec.type==='level-crossing'),corridors=all(bundle.group,'crossing-corridor');
  assert.equal(corridors.length,1,`${playerId}/${opponentId}: one connected crossing`);const corridor=corridors[0];assert.equal(corridor.userData.mode,mode);
  const geometry=all(corridor,mode==='rail'?'crossing-running-rail':'crossing-road');assert.ok(geometry.length>0);corridor.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(corridor);for(const slot of bundle.slots){const p=slot.group.getWorldPosition(new T.Vector3());assert.ok(p.x>bounds.min.x+40&&p.x<bounds.max.x-40,'surface continues well beyond both routes');}
  for(const slot of bundle.slots){assert.equal(!!slot.crossingTrain,false);assert.equal(!!slot.car,!slot.air);assert.equal(!!slot.crossingAircraft,!!slot.air);assert.equal(!!slot.groundCart,false);}
  r.player.distance=r.rival.distance=bundle.spec.at;
  geometry[0].geometry.computeBoundingBox();const ends=geometry[0].geometry.boundingBox;
  for(const [w,h]of [[320,420],[375,420],[1400,800],[1920,900]]){
   b.camera.aspect=w/h;V.updateScene(b,r);const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(b.camera.projectionMatrix,b.camera.matrixWorldInverse));
   for(const x of [ends.min.x,ends.max.x]){const endpoint=new T.Vector3(x,ends.min.y,(ends.min.z+ends.max.z)/2).applyMatrix4(geometry[0].matrixWorld);assert.ok(!frustum.containsPoint(endpoint)||-endpoint.clone().applyMatrix4(b.camera.matrixWorldInverse).z>=b.scene.fog.far,`${playerId}/${opponentId}/${w}: crossing ends outside the view or fully beyond the distance fog`);}
  }
  V.disposeScene(b);
 }
});

test('actual cloud meshes hide Harold during passage and reveal him on approach and exit',()=>{
 for(const who of ['player','rival']){
  const{r,b}=fixture(who==='player'?'harold':'bertie',who==='rival'?'harold':'bertie');
  const clouds=all(b.world,'flight-cloud-section'),solids=[];clouds.forEach(c=>c.traverse(o=>{if(o.isMesh)solids.push(o)}));
  for(const section of R.getTravelSections(r,who).filter(s=>s.type==='tunnel'))for(const [w,h]of [[320,420],[375,420],[1400,800],[1920,900]])for(const stage of ['approach','inside','exit']){
   const distance=stage==='approach'?section.start-2500:stage==='exit'?section.end+2500:(section.start+section.end)/2;r.player.distance=r.rival.distance=distance;b.camera.aspect=w/h;V.updateScene(b,r);
   const point=b[who].localToWorld(new T.Vector3(0,1.7,0)),direction=point.clone().sub(b.camera.position),length=direction.length();
   const hits=new T.Raycaster(b.camera.position.clone(),direction.normalize(),0,length-.05).intersectObjects(solids,false);
   assert.equal(hits.length>0,stage==='inside',`${who}/${section.id}/${w}/${stage}: natural cloud occlusion`);
  }V.disposeScene(b);
 }
});
test('crossing mode and instructions agree for every ordered character pairing',()=>{
 for(const player of R.CHARACTERS)for(const rival of R.CHARACTERS){if(player.id===rival.id)continue;
  const r=R.createRace({playerId:player.id,opponentId:rival.id,seed:24});r.phase='racing';r.countdown=0;const expected='road';assert.equal(R.getCrossingMode(r),expected);
  const s=r.player.serviceStates.find(s=>s.type==='level-crossing');r.player.distance=s.at;r.player.service=s;s.phase='ready';
  const key=R.getView(r).taskKey;if(player.vehicleType==='road')assert.equal(key,'race.service.road-junction');
  if(player.vehicleType==='air')assert.match(R.NARRATION[key],/control tower.*aircraft/);
 }
});
