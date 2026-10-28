const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');global.THREE=T;require('../scripts/race-model.js');
const R=ThomasRaceCore,V=require('../scripts/race-renderer.js');
const ground=R.CHARACTERS.filter(c=>c.vehicleType!=='air');
function fixture(character,who,courseId='country'){
 const other=character.id==='thomas'?'james':'thomas',r=R.createRace({playerId:who==='player'?character.id:other,opponentId:who==='rival'?character.id:other,courseId,deliveryTheme:'cargo',seed:24});
 r.phase='racing';r.countdown=0;r.elapsed=30;const b=V.makeScene(R,courseId,r.opponentId,'cargo',r);V.updateScene(b,r);return {r,b};
}
function atJob(r,b,who,type){
 const v=r[who],s=v.serviceStates.find(x=>x.type===type);r.player.distance=r.rival.distance=s.at;v.velocity=0;v.service=s;s.phase='ready';s.duration=5;s.selectedContainer='container-1';v.carried.container=type==='cargo-unload'?'container-1':null;v.carried.cargo=!!v.carried.container;
 V.updateScene(b,r);return {s,slot:b.objects.services.find(x=>x.spec.id===s.id).slots.find(x=>x.who===who)};
}
function progress(s,t){s.phase='working';s.progress=t;s.remaining=5*(1-t);}
function near(a,b,message){assert.ok(a.distanceTo(b)<1e-6,message);}
function meshBounds(part,inverse){part.geometry.computeBoundingBox();return part.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(part.matrixWorld));}
test('all ground characters lift vertically, transfer a level supported container and set it down before release',()=>{
 for(const [index,c]of ground.entries())for(const who of ['player','rival']){
  const {r,b}=fixture(c,who,Object.keys(R.COURSES)[index%3]);
  for(const type of ['cargo-load','cargo-unload']){
   const {s,slot}=atJob(r,b,who,type),from=type==='cargo-load'?slot.cargoYard:slot.cargoBerth,to=type==='cargo-load'?slot.cargoBerth:slot.cargoYard;
   let previousHook,previousLoad;
   for(let i=0;i<=100;i++){
    const t=i/100;progress(s,t);V.updateScene(b,r);const load=slot.container,hook=slot.crane.hook.getWorldPosition(new T.Vector3()),top=slot.spreader.localToWorld(new T.Vector3(0,.85,0));
    near(hook,top,'hoist always supports the four-corner frame');assert.deepEqual(slot.crane.boom.scale.toArray(),[1,1,1]);
    if(previousHook)assert.ok(hook.distanceTo(previousHook)<.5,'hook motion is continuous');previousHook=hook;
    if(previousLoad)assert.ok(load.position.distanceTo(previousLoad)<.5,'container motion is continuous');previousLoad=load.position.clone();
    assert.ok(Math.abs(load.quaternion.x)+Math.abs(load.quaternion.z)<1e-6,'container stays level');
    if(t<=.24)near(load.position,from,'locks engage while the container still rests on its support');
    if(t<=.4){assert.ok(Math.abs(load.position.x-from.x)<1e-6);assert.ok(Math.abs(load.position.z-from.z)<1e-6);}
    if(t>=.4&&t<=.68)assert.ok(Math.abs(load.position.y-Math.max(from.y,to.y)-3)<1e-6,'horizontal transfer stays at safe height');
    if(t>=.68){assert.ok(Math.abs(load.position.x-to.x)<1e-6);assert.ok(Math.abs(load.position.z-to.z)<1e-6);}
    if(t>=.82)near(load.position,to,'release starts only after touchdown');
    if(t>=.24&&t<=.82){for(const pin of slot.containerLocks)assert.ok(Math.abs(pin.rotation.y-Math.PI/2)<1e-6);assert.ok(Math.abs(slot.spreader.position.y-load.position.y-1.48)<1e-6);}
    // The whole-engine bounding box includes the empty space behind a tall
    // funnel. Check the actual visible body parts instead of that empty volume.
    const inverse=slot.group.matrixWorld.clone().invert(),loadBounds=new T.Box3(),collisions=[];
    load.traverse(part=>{if(part.isMesh)loadBounds.union(meshBounds(part,inverse));});
    b[who].traverse(part=>{if(!part.isMesh)return;for(let p=part;p;p=p.parent)if(!p.visible)return;if(loadBounds.intersectsBox(meshBounds(part,inverse)))collisions.push(part.name);});
    assert.deepEqual(collisions,[],`${c.id}/${who}/${type}/${t}: load strikes engine or bus`);
   }
   const pose=slot.spreader.getWorldPosition(new T.Vector3()),vertices=Array.from(slot.crane.cable.geometry.attributes.position.array);V.updateScene(b,r,{paused:true,time:9999});near(slot.spreader.getWorldPosition(new T.Vector3()),pose);assert.deepEqual(Array.from(slot.crane.cable.geometry.attributes.position.array),vertices);
  }V.disposeScene(b);
 }
});
test('container ownership switches without a jump and completed cranes stay at their station',()=>{
 for(const c of ground)for(const who of ['player','rival']){
  const {r,b}=fixture(c,who);
  for(const type of ['cargo-load','cargo-unload']){
   const {s,slot}=atJob(r,b,who,type),v=r[who],wagon=b[who+'Coach'].userData.container;
   if(type==='cargo-unload'){const before=wagon.getWorldPosition(new T.Vector3());progress(s,0);V.updateScene(b,r);assert.equal(wagon.visible,false);near(slot.container.getWorldPosition(new T.Vector3()),before);}
   progress(s,1);V.updateScene(b,r);const end=slot.container.getWorldPosition(new T.Vector3()),rotation=slot.container.getWorldQuaternion(new T.Quaternion());
   s.phase='complete';s.completed=true;v.service=null;v.carried.container=type==='cargo-load'?'container-1':null;v.carried.cargo=!!v.carried.container;V.updateScene(b,r);
   if(type==='cargo-load'){assert.equal(slot.container.visible,false);assert.equal(wagon.visible,true);near(wagon.getWorldPosition(new T.Vector3()),end);assert.ok(wagon.getWorldQuaternion(new T.Quaternion()).angleTo(rotation)<1e-6);}
   else{assert.equal(wagon.visible,false);assert.equal(slot.container.visible,true);near(slot.container.getWorldPosition(new T.Vector3()),end);}
   const parked=slot.spreader.getWorldPosition(new T.Vector3());v.distance+=5000;V.updateScene(b,r);near(slot.spreader.getWorldPosition(new T.Vector3()),parked,'completed hoist does not follow the departing vehicle');
   if(type==='cargo-unload')near(slot.container.getWorldPosition(new T.Vector3()),end,'delivered container stays on the platform');
  }V.disposeScene(b);
 }
});
test('container targets and the moving lifting frame stay visible at phone and desktop sizes',()=>{
 for(const c of ground){const {r,b}=fixture(c,'player');
  for(const type of ['cargo-load','cargo-unload']){
   const {s,slot}=atJob(r,b,'player',type);
   for(const [w,h]of [[320,420],[375,640],[844,390],[1366,768],[1920,900]]){
    b.camera.aspect=w/h;s.phase='ready';V.updateScene(b,r);const target=type==='cargo-load'?slot.container:b.playerCoach.userData.container,rect=V.projectTarget(b,target,w,h);
    assert.deepEqual(V.pickScene(b,r,rect.x+rect.width/2,rect.y+rect.height/2,w,h),{kind:'service',id:'container-1'});
    for(const t of [0,.18,.3,.5,.75,.86,1]){progress(s,t);V.updateScene(b,r);
     for(const object of [slot.container,slot.spreader]){const bounds=new T.Box3().setFromObject(object);for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=new T.Vector3(x,y,z).project(b.camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,`${c.id}/${type}/${w}/${t}/${object.name}: clipped`);}}
    }
   }
  }V.disposeScene(b);
 }
});
