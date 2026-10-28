const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');global.THREE=T;require('../scripts/race-model.js');const R=ThomasRaceCore,V=require('../scripts/race-renderer.js');
function all(root,name){const out=[];root.traverse(o=>{if(o.name===name)out.push(o)});return out;}
function fixture(who='player',theme='cargo',seed=24){const r=R.createRace({playerId:who==='player'?'harold':'thomas',opponentId:who==='rival'?'harold':'bertie',seed,deliveryTheme:theme});r.phase='racing';r.countdown=0;return{r,b:V.makeScene(R,r.courseId,r.opponentId,theme,r)}}
test('Harold flies with rotors and skids, no wheels or coaches, and a shadow on the ground',()=>{
 for(const who of ['player','rival']){const{r,b}=fixture(who);r[who].distance=3000;r[who].velocity=R.CRUISE_SPEED;r.elapsed=10;V.updateScene(b,r);const h=b[who];
  assert.equal(h.userData.kind,'harold');assert.ok(h.getObjectByName('main-rotor'));assert.ok(h.getObjectByName('tail-rotor'));assert.ok(h.getObjectByName('landing-skid'));
  assert.equal(h.userData.wheels.length,0);assert.equal(b[who+'Coach'].userData.kind,'flight-payload');assert.equal(b[who+'Coupler'].visible,false);
  assert.equal(all(b.world,'railway-path').some(o=>o.userData.corridor===who),false);assert.equal(all(b.world,'road-path').some(o=>o.userData.corridor===who),false);assert.equal(all(b.world,'railway-tunnel').some(o=>o.userData.corridor===who),false);
  assert.ok(h.position.y>=7);assert.ok(b[who+'Shadow'].position.y<.1);const angle=h.userData.rotor.rotation.y;r.elapsed+=.1;V.updateScene(b,r);assert.notEqual(h.userData.rotor.rotation.y,angle);
  const still=h.userData.rotor.rotation.y;V.updateScene(b,r,{paused:true,time:1000});assert.equal(h.userData.rotor.rotation.y,still);V.disposeScene(b);
 }
});
test('Harold gets helipads, a winch and aviation equipment instead of railway barriers or trailers',()=>{
 for(const seed of [1,24,40]){const{r,b}=fixture('player','cargo',seed);V.updateScene(b,r);
  for(const bundle of b.objects.services){const slot=bundle.slots[0];assert.equal(slot.air,true);assert.equal(!!slot.group.getObjectByName('helipad'),bundle.spec.type!=='level-crossing');
   assert.equal(all(slot.group,'delivery-yard-crane').length,0);assert.equal(all(slot.group,'hinged-crossing-arm').length,0);assert.equal(all(slot.group,'coal-scoop').length,0);
   if(bundle.spec.type==='coal')assert.ok(slot.group.getObjectByName('aviation-fuel-pump'));
  }V.disposeScene(b);
 }
});
test('Harold carries passengers inside, cargo under his belly, and sets the sling load down for other work',()=>{
 for(const theme of ['passengers','cargo']){const{r,b}=fixture('player',theme);r.player.distance=18000;r.player.velocity=R.CRUISE_SPEED;r.player.carried.passengers=3;r.player.carried.container='container-1';r.player.serviceStates[0].groups.fill(true);V.updateScene(b,r);
  const payload=b.playerCoach,container=payload.userData.container;
  if(theme==='passengers'){assert.ok(payload.userData.occupants.every(o=>o.visible));assert.ok(payload.userData.occupants.every(o=>o.getWorldPosition(new T.Vector3()).distanceTo(b.player.position)<4));}
  else{assert.ok(container.visible);assert.ok(payload.userData.sling.visible);assert.ok(container.getWorldPosition(new T.Vector3()).y<b.player.position.y-1);assert.ok(container.scale.x<.6);}
  const wash=r.player.serviceStates.find(s=>s.type==='wash');r.player.distance=wash.at;r.player.service=wash;wash.phase='ready';r.player.velocity=0;V.updateScene(b,r);
  assert.ok(b.player.position.y<.1);if(theme==='cargo'){assert.ok(container.visible);assert.equal(payload.userData.sling.visible,false);assert.ok(Math.abs(container.getWorldPosition(new T.Vector3()).y)<.1);}
  V.disposeScene(b);
 }
});
test('flight bodies, rotors and cargo remain framed at phone, laptop and wide sizes',()=>{
 for(const who of ['player','rival']){const{r,b}=fixture(who);r[who].carried.container='container-1';
  for(const distance of [0,3000,12000,18000,26000,35500,36300,44000,52000,82000,104000,128000,160600,175500].map(R.courseDistance))for(const[w,h]of [[310,330],[516,145],[320,420],[375,420],[1400,800],[1920,900]]){
   r.player.distance=r.rival.distance=distance;b.camera.aspect=w/h;V.updateScene(b,r);
   for(const obj of [b[who],b[who+'Coach']])obj.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;o.geometry.computeBoundingBox();const box=o.geometry.boundingBox;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
     const point=new T.Vector3(x,y,z).applyMatrix4(o.matrixWorld).project(b.camera);assert.ok(Math.abs(point.x)<=1&&Math.abs(point.y)<=1,`${who}/${distance}/${w}: ${o.name} outside camera ${point.x},${point.y}`);
    }
   });
  }V.disposeScene(b);
 }
});
