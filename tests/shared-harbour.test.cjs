const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');global.THREE=T;require('../scripts/race-model.js');const R=ThomasRaceCore,V=require('../scripts/race-renderer.js');
const all=(root,name)=>{const result=[];root.traverse(o=>{if(o.name===name)result.push(o)});return result;};
function fixture(playerId,opponentId,courseId='country',firstSeed=1){
 let r;for(let seed=firstSeed;seed<100;seed++){r=R.createRace({playerId,opponentId,courseId,seed,deliveryTheme:'cargo'});if(r.services.some(s=>s.type==='drawbridge'))break;}
 r.phase='racing';r.countdown=0;const spec=r.services.find(s=>s.type==='drawbridge');r.player.distance=r.rival.distance=spec.at;
 const b=V.makeScene(R,courseId,opponentId,'cargo',r);V.updateScene(b,r);return{r,b,spec};
}
test('the raised bridge and its boat wait for a player action while the rival proceeds independently',()=>{
 for(const pair of [['thomas','percy'],['bertie','bulgy'],['harold','thomas']]){
  const {r,b,spec}=fixture(...pair);
  for(const v of [r.player,r.rival])v.serviceStates.forEach(s=>s.completed=s.index<spec.index);
  R.step(r,.02);V.updateScene(b,r);
  const slot=b.objects.services.find(s=>s.spec.id===spec.id).slots[0],boat=slot.boat.position.clone(),angle=slot.bridgeLeaf.rotation.x;
  const p=new T.Box3().setFromObject(slot.bridgeLeaf).getCenter(new T.Vector3()).project(b.camera);
  assert.deepEqual(V.pickScene(b,r,(p.x+1)*700,(1-p.y)*400,1400,800),{kind:'service',id:'drawbridge'});
  R.step(r,10);V.updateScene(b,r);
  assert.deepEqual(slot.boat.position.toArray(),boat.toArray());assert.equal(slot.bridgeLeaf.rotation.x,angle);
  assert.equal(r.player.service.phase,'ready');assert.equal(r.rival.serviceStates[spec.index].completed,true);
  assert.equal(R.serviceAction(r,'drawbridge'),true);R.step(r,6.01);V.updateScene(b,r);
  assert.ok(slot.boat.position.distanceTo(boat)>20);assert.ok(Math.abs(slot.bridgeLeaf.rotation.x)<1e-8);
  V.disposeScene(b);
 }
});
test('one continuous level river passes beneath two drawbridges, including Harold’s corridor',()=>{
 for(const [player,opponent]of [['harold','bertie'],['thomas','harold'],['bertie','bulgy'],['thomas','percy']]){
  const{r,b,spec}=fixture(player,opponent),bundle=b.objects.services.find(s=>s.spec.id===spec.id);
  assert.equal(all(bundle.group,'lowering-drawbridge-leaf').length,2,'both corridors share the river crossing');
  const waters=all(b.world,'shared-harbour-river');assert.equal(waters.length,1,'one connected river replaces independent water rectangles');
  const water=waters[0];water.geometry.computeBoundingBox();assert.ok(water.geometry.boundingBox.max.x-water.geometry.boundingBox.min.x>150,'river continues beyond both routes');
  for(const slot of bundle.slots){const deck=slot.bridgeLeaf,point=deck.parent.localToWorld(new T.Vector3(0,-.4,4.5));const ray=new T.Raycaster(point,new T.Vector3(0,-1,0));assert.ok(ray.intersectObject(water).length,'water under each bridge');}
  V.disposeScene(b);
 }
});

test('the river stays exposed across both corridors and joins the harbour at one level',()=>{
 for(const course of Object.keys(R.COURSES))for(const pair of [['harold','bertie'],['thomas','harold']])for(const seed of [1,4,9,10,12,85]){
  const{r,b,spec}=fixture(...pair,course,seed),water=all(b.world,'shared-harbour-river')[0],ground=[...all(b.world,'continuous-ground'),...all(b.world,'exposed-hillside-earth'),...all(b.world,'railway-verge')];
  const level=water.localToWorld(new T.Vector3(0,water.geometry.attributes.position.getY(0),18.5)).y;
  if(course==='harbour')assert.ok(Math.abs(level+1.25)<1e-6,'river and sea share their water level');
  for(let x=-150;x<=150;x+=2.5){const z=18.5+Math.sin((x+7.5)/35)*2*Math.max(0,Math.min(1,(Math.abs(x+7.5)-22)/25));
   const p=water.localToWorld(new T.Vector3(x,water.geometry.attributes.position.getY(0)+30,z)),ray=new T.Raycaster(p,new T.Vector3(0,-1,0));
   const waterHit=ray.intersectObject(water)[0],groundHit=ray.intersectObjects(ground)[0];assert.ok(waterHit,'river has no breaks');assert.ok(!groundHit||groundHit.point.y<waterHit.point.y-.1,`${course}/${pair}/${seed}/${x}: ground hides river`);
  }
  for(const [w,h]of [[320,420],[375,420],[1400,800],[1920,900]]){b.camera.aspect=w/h;V.updateScene(b,r);const f=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(b.camera.projectionMatrix,b.camera.matrixWorldInverse));for(const x of [-320,305]){const p=water.localToWorld(new T.Vector3(x,0,18.5));assert.ok(!f.containsPoint(p)||-p.clone().applyMatrix4(b.camera.matrixWorldInverse).z>=b.scene.fog.far,'no visible cut-off river ends');}}
  V.disposeScene(b);
 }
});
function boundsIn(object,frame){const bounds=new T.Box3(),inverse=frame.matrixWorld.clone().invert();object.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position,transform=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld);for(let i=0;i<pos.count;i++)bounds.expandByPoint(new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(transform));});return bounds;}
test('boats clear both independently lowering bridges and continue along their river lanes after the wait',()=>{
 for(const pair of [['harold','bertie'],['thomas','harold'],['bertie','bulgy'],['thomas','percy']])for(const seed of [1,9]){
  const{r,b,spec}=fixture(...pair,'country',seed),bundle=b.objects.services.find(s=>s.spec.id===spec.id),frame=bundle.slots[0].group;
  for(const a of [0,.25,.5,.67,.85,1])for(const c of [0,.25,.5,.67,.85,1]){
   for(const [i,t]of [a,c].entries()){const who=i?'rival':'player',s=r[who].serviceStates.find(s=>s.id===spec.id);r[who].service=s;s.phase=t===1?'complete':'working';s.completed=t===1;s.completedAt=r.elapsed;s.duration=6;s.progress=t;s.remaining=6*(1-t);}
   V.updateScene(b,r);const boats=bundle.slots.map(slot=>boundsIn(slot.boat,frame));assert.equal(boats[0].intersectsBox(boats[1]),false,'opposite boats have separate lanes');
   for(const [i,boat]of boats.entries())for(const slot of bundle.slots){
    if(!boat.intersectsBox(boundsIn(slot.bridgeLeaf,frame)))continue;
    const surfaces=[];slot.bridgeLeaf.traverse(o=>{if(o.isMesh)surfaces.push(o);});
    const baseY=bundle.slots[i].boat.getWorldPosition(new T.Vector3()).y-.5;
    bundle.slots[i].boat.traverse(o=>{if(!o.isMesh)return;const positions=o.geometry.attributes.position;
     for(let k=0;k<positions.count;k++){const p=new T.Vector3().fromBufferAttribute(positions,k).applyMatrix4(o.matrixWorld);if(p.y<=baseY)continue;
      const ray=new T.Raycaster(new T.Vector3(p.x,baseY,p.z),new T.Vector3(0,1,0),0,p.y-baseY);
      assert.equal(ray.intersectObjects(surfaces).length,0,`${pair}/${seed}/${a}/${c}: bridge hits a boat or mast`);
     }
    });
   }
  }
  const first=bundle.slots.map(s=>s.boat.position.clone());r.elapsed+=8;V.updateScene(b,r);assert.ok(bundle.slots[0].boat.position.x>first[0].x);assert.ok(bundle.slots[1].boat.position.x<first[1].x);
  const snapshot=bundle.slots.map(s=>s.boat.position.toArray());V.updateScene(b,r,{paused:true,time:10000});assert.deepEqual(bundle.slots.map(s=>s.boat.position.toArray()),snapshot,'pause freezes boats');V.disposeScene(b);
 }
});
