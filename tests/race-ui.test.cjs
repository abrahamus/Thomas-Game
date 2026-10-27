'use strict';
// Standalone adapter/input checks using a DOM simulation, without executing WebGL.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {setup,html,script}=require('./helpers/game-harness.cjs');
const KEY='thomas-first-adventure-progress-v1';
const node=(ui,id)=>ui.document.getElementById(id);
function start(ui,keyboard=false){
 keyboard?ui.key('Enter'):ui.click('#startRaceButton');
 assert.equal(ui.state().mode,'race');assert.equal(ui.state().screen,'play');
}
function go(ui){ui.frames(4.7,47);assert.equal(ui.state().phase,'racing');}
function performVisibleJob(ui,keyboard){
 const help=node(ui,'action-race-help'),dashboard=node(ui,'raceDashboard');
 if(!help.hidden && !help.disabled){keyboard?ui.key('Enter'):ui.click('#action-race-help');return true;}
 if(dashboard.dataset.taskType==='animals' && dashboard.dataset.servicePhase==='ready'){
  keyboard?ui.key(' '):ui.click('#action-whistle');return true;
 }
 return false;
}
function complete(ui,keyboard=false){
 for(let i=0;ui.state().phase!=='complete';i++){
  assert.ok(i<3000,'The delivery race finishes from its visible pictures and contextual jobs');
  performVisibleJob(ui,keyboard);
  ui.frames(.25,4);
 }
 return ui.state();
}
function reachJob(ui,type){
 for(let i=0;i<3000;i++){
  const dash=node(ui,'raceDashboard');
  if(dash.dataset.taskType===type && dash.dataset.servicePhase==='ready')return;
  performVisibleJob(ui,true);
  ui.frames(.25,4);
 }
 assert.fail(`Arrival at visible ${type}`);
}

function opacity(element){return Number(element.getAttribute('opacity') ?? element.style.opacity);}




for(const [rival,seed] of [['percy',17],['james',1000],['bertie',1500]])test(`named selection assigns ${rival}`,()=>{
 const ui=setup(undefined,{seed});ui.choose('opponent',rival);start(ui);assert.equal(ui.state().race.opponentId,rival);
 ui.click('[data-action="home"]');assert.equal(ui.state().screen,'race-start');assert.equal(ui.state().race,null);
});

for(const keyboard of [true,false])test(`complete muted ${keyboard?'keyboard-only':'click-only'} round from visible pictures and award once`,()=>{
 const ui=setup();start(ui,keyboard);ui.click('[data-action="mute"]');
 const result=complete(ui,keyboard);
 assert.equal(result.race.winner,'player');
 const duration=result.race.elapsed+ui.evaluate('ThomasRaceCore.START_COUNTDOWN');
 assert.ok(duration>=300 && duration<=380,`Continuous delivery duration: ${duration}s`);
 assert.equal(result.race.player.serviceStates.filter(s=>s.completed).length,8);
 assert.equal(result.race.player.carried.passengers,0);assert.equal(result.race.player.carried.container,null);
 assert.equal(result.stars,3);assert.ok(result.stickers.includes('race-finisher'));
 for(let i=0;i<8;i++)assert.equal(opacity(node(ui,`raceCompletedJob${i}`)),1);
 ui.frames(5);ui.evaluate('game.step(20);render()');assert.equal(ui.state().stars,3);
 assert.equal(node(ui,'rewardReplay').dataset.action,'next-race');assert.equal(node(ui,'rewardAlternative').dataset.action,'home');
});
test('Next race draws a fresh friend, course, jobs and delivery; Home shows the racer panels',()=>{
 const ui=setup();start(ui);const original=ui.state().race;complete(ui);
 ui.click('#rewardReplay');assert.equal(ui.state().screen,'race-start');start(ui);const race=ui.state().race;
 for(const key of ['seed','courseId','opponentId','deliveryTheme'])assert.notEqual(race[key],original[key],key);
 assert.equal(ui.state().stars,3);complete(ui);
 assert.equal(ui.state().phase,'complete');assert.equal(ui.state().stars,6);
 ui.click('#rewardAlternative');assert.equal(ui.state().screen,'race-start');assert.equal(node(ui,'raceStartOverlay').hidden,false);
});
test('saved pairing varies new races without erasing legacy rewards; invalid storage remains playable',()=>{
 const saved=JSON.stringify({version:1,stars:12,stickers:['apple-delivery','driving-challenges'],lastRace:{courseId:'country',opponentId:'percy'}});
 const ui=setup(saved);start(ui);assert.notEqual(ui.state().race.courseId,'country');assert.notEqual(ui.state().race.opponentId,'percy');
 assert.equal(ui.state().stars,12);assert.deepEqual(ui.state().stickers,['apple-delivery','driving-challenges']);
 const restored=setup(ui.storage.getItem(KEY));start(restored,'surprise');assert.notEqual(restored.state().race.courseId,ui.state().race.courseId);
 for(const options of [{unavailableStorage:true},{saved:'broken'}]){const fallback=setup(options.saved,options);start(fallback);complete(fallback);assert.equal(fallback.state().stars,3);}
});
test('pause, focus loss and hidden pages freeze boosts and both racers until explicit resume',()=>{
 const ui=setup();start(ui);go(ui);ui.frames(3);ui.evaluate('state.race.player.boostRemaining=6');
 ui.key('Escape');const stopped=ui.state().race;ui.frames(10);assert.deepEqual(ui.state().race,stopped);
 ui.click('#pauseOverlay [data-action="resume"]');ui.frames(.2,5);assert.ok(ui.state().distance>stopped.player.distance);
 ui.windowListeners.get('blur')();const blurred=ui.state().race;ui.frames(10);assert.deepEqual(ui.state().race,blurred);
 ui.windowListeners.get('focus')();assert.equal(ui.state().paused,true);ui.click('#pauseOverlay [data-action="resume"]');
 ui.document.hidden=true;ui.document.emit('visibilitychange');const hidden=ui.state().race;ui.frames(5);assert.deepEqual(ui.state().race,hidden);
 ui.document.hidden=false;ui.document.emit('visibilitychange');assert.equal(ui.state().paused,true);
});
test('a long frame stops at the next interactive job without completing it or replaying rewards',()=>{
 const ui=setup();start(ui);go(ui);
 ui.evaluate('globalThis.recentEffects=[];globalThis.originalEffect=audio.effect.bind(audio);audio.effect=(...args)=>{recentEffects.push(args);return originalEffect(...args);};');
 const spoken=ui.spoken.length;ui.frames(120,1/120);
 assert.equal(ui.state().phase,'racing');assert.ok(ui.state().race.player.service);assert.equal(ui.state().velocity,0);assert.equal(ui.state().stars,0);
 const sounds=ui.evaluate('recentEffects.filter(e=>e[0]==="chime")');
 assert.equal(sounds.length,0,'Automatic arrivals do not replay a backlog');
 assert.ok(ui.spoken.slice(spoken).every(text=>!text.includes('More mail')));
});
test('Home removes the race view and shows one Race picture',()=>{
 const ui=setup();start(ui);go(ui);const generation=ui.state().generation;
 ui.click('[data-action="home"]');assert.equal(ui.state().race,null);assert.ok(ui.state().generation>generation);
 for(const id of ['action-race-help','raceOrder','raceDashboard'])assert.equal(node(ui,id).hidden,true);
 assert.equal(node(ui,'raceStartOverlay').hidden,false);assert.equal(ui.evaluate('ui.raceView'),null);
});
test('WebGL unavailable stays on the start screen with an honest error and working controls',()=>{
 const ui=setup(undefined,{raceUnavailable:true});ui.click('#startRaceButton');
 assert.equal(ui.state().screen,'race-start');assert.equal(node(ui,'raceUnavailable').hidden,false);
 assert.match(html,/The race cannot start in this browser/);
 ui.click('[data-action="mute"]');assert.equal(ui.state().isMuted,true);
});

for(const theme of ['passengers','cargo'])for(const keyboard of [true,false])test(`${theme} loading and delivery with ${keyboard?'keyboard':'picture clicks'}`,()=>{
 const saved=JSON.stringify({version:1,stars:9,stickers:['apple-delivery'],lastRace:{courseId:'country',opponentId:'percy',deliveryTheme:theme==='passengers'?'cargo':'passengers'}});
 const ui=setup(saved);start(ui,keyboard);assert.equal(ui.state().race.deliveryTheme,theme);
 const type=theme==='passengers'?'passenger-load':'cargo-load';reachJob(ui,type);
 assert.equal(node(ui,'raceTaskPreview').hidden,false);
 assert.equal(node(ui,'action-race-help').getAttribute('aria-keyshortcuts'),'Enter');
 const before=ui.state().race.player.service;performVisibleJob(ui,keyboard);
 if(theme==='passengers'){
  assert.equal(ui.state().race.player.service.unitsDone,0);assert.equal(ui.state().race.player.service.phase,'working');
  ui.key('Enter',{repeat:true});assert.equal(ui.state().race.player.service.unitsDone,0);
  ui.frames(1.1,22);assert.equal(ui.state().race.player.carried.passengers,1);
 }else{
  assert.equal(ui.state().race.player.service.selectedContainer,'container-1');assert.equal(ui.state().race.player.carried.container,null);
  performVisibleJob(ui,keyboard);assert.equal(ui.state().race.player.service.phase,'working');
  ui.frames(5.1,51);assert.equal(ui.state().race.player.carried.container,'container-1');
 }
 complete(ui,keyboard);assert.equal(ui.state().stars,12);
 const states=ui.state().race.player.serviceStates;
 assert.ok(states[0].completedAt<states.at(-1).startedAt,'Loading precedes delivery');
 assert.equal(ui.state().race.player.carried.passengers,0);assert.equal(ui.state().race.player.carried.container,null);
});
test('Enter uses one contextual action, native button access activates once, and working jobs reject repeats',()=>{
 const ui=setup(JSON.stringify({version:1,stars:0,stickers:[],lastRace:{courseId:"country",opponentId:"percy",deliveryTheme:"passengers"}}));start(ui);reachJob(ui,'cargo-load');
 const help=node(ui,'action-race-help');help.focus();ui.key('Enter');
 assert.equal(ui.state().race.player.service.phase,'ready');assert.equal(ui.state().race.player.service.selectedContainer,'container-1');
 assert.equal(node(ui,'raceHelpPicture').getAttribute('href'),'#race-crane','Selected container changes the picture to its crane action');
 ui.key('Enter',{repeat:true});assert.equal(ui.state().race.player.service.phase,'ready');
 ui.key('Enter');assert.equal(ui.state().race.player.service.phase,'working');
 const remaining=ui.state().race.player.service.remaining;ui.key('Enter');assert.equal(ui.state().race.player.service.remaining,remaining);
});
test('animals wait for the whistle and jobs keep the race clock and independent rival moving',()=>{
 const ui=setup();start(ui);reachJob(ui,'animals');const before=ui.state().race;
 assert.equal(node(ui,'action-race-help').hidden,true);assert.equal(node(ui,'action-whistle').classList.contains('hint'),true);
 ui.key('Enter');ui.frames(2);assert.equal(ui.state().race.player.service.phase,'ready');
 assert.ok(ui.state().race.elapsed>before.elapsed);assert.equal(ui.state().distance,before.player.distance);
 assert.ok(ui.state().race.rival.distance>before.rival.distance || ui.state().race.rival.service,'Rival still moves or works');
 ui.key(' ');assert.equal(ui.state().race.player.service.phase,'working');
 ui.frames(1);assert.equal(ui.state().velocity,0);ui.frames(1.2);assert.equal(ui.state().race.player.service,null);
});
test('trackpad pointer cleans actual renderer targets without holding a click, with pause and mode guards',()=>{
 const ui=setup();start(ui);reachJob(ui,'wash');
 ui.evaluate('ui.raceView.pick=()=>({kind:"mud",id:0})');
 const canvas=node(ui,'raceCanvas');ui.document.emit('pointermove',{target:canvas,clientX:40,clientY:40,buttons:0});
 assert.equal(ui.state().race.player.mudPatches[0],false);assert.equal(ui.state().race.player.mudPatches.filter(Boolean).length,6);
 ui.evaluate('ui.raceView.pick=()=>({kind:"mud",id:1})');ui.key('Escape');const race=ui.state().race;
 ui.document.emit('pointermove',{target:canvas,clientX:40,clientY:40,buttons:0});ui.frames(4);assert.deepEqual(ui.state().race,race);
 ui.click('#pauseOverlay [data-action="resume"]');
 ui.document.emit('click',{target:canvas,clientX:40,clientY:40});assert.equal(ui.state().race.player.mudPatches[1],false);
 ui.click('[data-action="home"]');
 ui.document.emit('pointermove',{target:canvas,clientX:40,clientY:40,buttons:0});assert.equal(ui.state().race,null);assert.equal(ui.state().stars,0);
});
test('direct objects and contextual controls share passenger/container actions',()=>{
 const ui=setup(JSON.stringify({version:1,stars:0,stickers:[],lastRace:{courseId:"country",opponentId:"percy",deliveryTheme:"passengers"}}));start(ui);reachJob(ui,'cargo-load');
 ui.evaluate('ui.raceView.pick=()=>({kind:"service",id:"container-1"})');
 const canvas=node(ui,'raceCanvas');ui.document.emit('click',{target:canvas,clientX:20,clientY:20});
 assert.equal(ui.state().race.player.service.selectedContainer,'container-1');
 ui.document.emit('click',{target:canvas,clientX:20,clientY:20});assert.equal(ui.state().race.player.service.phase,'working');
});
test('pause freezes active service animation, wash sweep, rival and clock until explicit resume',()=>{
 const ui=setup();start(ui);reachJob(ui,'wash');ui.key('Enter');ui.frames(.2,20);ui.key('Escape');
 const paused=ui.state().race;ui.frames(7);assert.deepEqual(ui.state().race,paused);
 assert.equal(node(ui,'action-race-help').disabled,true);ui.click('#pauseOverlay [data-action="resume"]');
 ui.frames(.5,20);assert.equal(ui.state().race.player.mudPatches.filter(Boolean).length,6);
});

test('a directly selected passenger group boards once and cannot be selected again',()=>{
 const saved=JSON.stringify({version:1,stars:0,stickers:[],lastRace:{courseId:'country',opponentId:'percy',deliveryTheme:'cargo'}});
 const ui=setup(saved);start(ui);reachJob(ui,'passenger-load');
 ui.evaluate('ui.raceView.pick=()=>({kind:"service",id:2})');const canvas=node(ui,'raceCanvas');
 ui.document.emit('click',{target:canvas,clientX:20,clientY:20});assert.equal(ui.state().race.player.service.activeUnit,2);
 ui.frames(1.1,22);assert.equal(ui.state().race.player.carried.passengers,1);assert.equal(ui.state().race.player.service.groups[2],true);
 ui.document.emit('click',{target:canvas,clientX:20,clientY:20});assert.equal(ui.state().race.player.service.phase,'ready');assert.equal(ui.state().race.player.carried.passengers,1);
});
test('invalid optional delivery history preserves existing stars and stickers',()=>{
 const ui=setup(JSON.stringify({version:1,stars:21,stickers:['apple-delivery','race-finisher'],lastRace:{courseId:'country',opponentId:'percy',deliveryTheme:'broken'}}));
 assert.equal(ui.state().stars,21);start(ui);assert.ok(['passengers','cargo'].includes(ui.state().race.deliveryTheme));
 const saved=JSON.parse(ui.storage.getItem(KEY));assert.equal(saved.lastRace.deliveryTheme,ui.state().race.deliveryTheme);assert.equal(saved.stars,21);
});

test('service and automatic terrain share one reminder, with no next-next task panel',()=>{
 const ui=setup();start(ui);go(ui);
 const view=ui.evaluate('ThomasRaceCore.getView(state.race)');
 assert.equal(node(ui,'raceDashboard').dataset.taskType,view.nextTask.type);
 assert.equal(node(ui,'raceTaskPreview').hidden,false);
 const loading=ui.state().race.deliveryTheme==='passengers'?'passenger-load':'cargo-load';reachJob(ui,loading);
 assert.equal(node(ui,'raceTaskPreview').hidden,false);
 assert.equal(node(ui,'raceJobProgress').hidden,false);
 assert.equal(node(ui,'raceHelpPicture').getAttribute('href'),loading==='passenger-load'?'#race-board':'#race-container');
 ui.evaluate(`{
  const r=state.race,s=ThomasRaceCore.COURSES[r.courseId].sections.find(s=>s.type==='hill');
  for(const v of [r.player,r.rival]){v.service=null;v.distance=s.start+1000;v.velocity=ThomasRaceCore.SPEEDS[4]*s.cap;
   for(const job of v.serviceStates)if(job.at<v.distance)job.completed=true;
   for(const item of v.terrainStates)if(ThomasRaceCore.COURSES[r.courseId].sections.find(s=>s.id===item.id).end<v.distance)item.completed=true;
  }render();
 }`);
 const terrain=ui.evaluate('ThomasRaceCore.getView(state.race)');
 assert.equal(terrain.nextTask.kind,'terrain');assert.equal(node(ui,'raceTaskPreview').dataset.taskType,'hill');
 assert.equal(node(ui,'raceTaskPicture').getAttribute('href'),'#challenge-hill');assert.equal(node(ui,'action-race-help').hidden,true);
});

test('Race has no postal controls and arrows do not change speed or queue actions',()=>{
 const ui=setup();start(ui);go(ui);
 for(const id of ['action-race-left','action-race-right','raceUpcomingPreview','raceMailCollected'])assert.equal(node(ui,id),null);
 const before=ui.state().race.player;ui.key('ArrowLeft');ui.key('ArrowRight');assert.deepEqual(ui.state().race.player,before);
 assert.equal(node(ui,'raceJourneyProgress').getAttribute('aria-valuemax'),'8');
 assert.equal(node(ui,'raceCourseTicks').children.length,8);
 assert.equal(node(ui,'action-accelerate'),null);
 assert.match(script('race-core'),/boost-earned/);
});
test('each new job is usable through the canvas and its contextual keyboard control',()=>{
 for(const type of ['repairs','rocks','coal','level-crossing']){
  const ui=setup();start(ui);ui.evaluate(`{
    let r;for(let seed=1;seed<100;seed++){r=ThomasRaceCore.createRace({seed});if(r.services.some(s=>s.type==='${type}'))break;}
    state.race=r;r.phase='racing';r.countdown=0;state.phase='racing';
    const s=r.player.serviceStates.find(s=>s.type==='${type}');for(const q of r.player.serviceStates)if(q.at<s.at)q.completed=true;
    r.player.distance=s.at-.01;r.player.velocity=0;game.step(.1);render();
  }`);
  const id={repairs:'sleeper-1',rocks:'rock-1',coal:'coal-1','level-crossing':'crossing'}[type];
  ui.evaluate(`ui.raceView.pick=()=>({kind:'service',id:'${id}'})`);
  ui.document.emit('click',{target:node(ui,'raceCanvas'),clientX:20,clientY:20});
  assert.equal(ui.state().race.player.service.phase,'working');
  for(let i=0;i<100&&ui.state().race.player.service;i++){ui.frames(.2,20);if(!node(ui,'action-race-help').disabled)ui.key('Enter');}
  assert.equal(ui.state().race.player.service,null,type);
  assert.ok(ui.state().race.player.boostRemaining>0);
  assert.equal(node(ui,'raceSteamBadge').getAttribute('data-state'),'queued');
 }
});

test('every static railway picture reference resolves to a retained SVG symbol',()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const match of html.matchAll(/<use\b[^>]*href="#([^"]+)"/g))assert.ok(ids.has(match[1]),match[1]);
});

test('Space sounds one horn call for either bus and held-key repeats never retrigger it',()=>{
 for(const id of ['bertie','bulgy']){
  const ui=setup();ui.choose('player',id);ui.choose('opponent','thomas');start(ui);go(ui);
  ui.evaluate('globalThis.signalCalls=[];audio.effect=(name)=>{signalCalls.push(name);return true;};');
  ui.key(' ');for(let i=0;i<50;i++)ui.key(' ',{repeat:true});ui.frames(2);
  assert.equal(ui.evaluate('signalCalls.filter(n=>n==="horn").length'),1);
  ui.document.emit('keyup',{key:' ',target:ui.document.activeElement});ui.key(' ');assert.equal(ui.evaluate('signalCalls.filter(n=>n==="horn").length'),2);
  ui.key('Escape');ui.key(' ');assert.equal(ui.evaluate('signalCalls.filter(n=>n==="horn").length'),2,'paused Space cannot sound the horn');
 }
});
