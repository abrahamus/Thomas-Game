'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/game-harness.cjs');
const node=(ui,id)=>ui.document.getElementById(id);
function arrive(ui,winner='player'){
 ui.evaluate(`{const r=state.race;r.phase='racing';r.countdown=0;r.elapsed=300;for(const who of ['player','rival']){const v=r[who];v.distance=ThomasRaceCore.COURSES[r.courseId].length-('${winner}'==='tie'||'${winner}'===who?1:100);v.velocity=825;v.service=null;v.serviceStates.forEach(s=>{s.completed=true;s.phase='complete'});v.terrainStates.forEach(s=>s.completed=true);}}`);
 ui.frames(.3,30);assert.equal(ui.state().phase,'complete');
}
function start(){const ui=setup();ui.click('#startRaceButton');return ui;}
function elapsed(ui){return ui.evaluate('ui.festival.elapsed');}
test('nine-second welcome exposes Skip immediately, lights eight jobs, then reveals results',()=>{
 const ui=start();assert.equal(node(ui,'sceneHud').hidden,false);arrive(ui);assert.equal(node(ui,'rewardOverlay').hidden,true);assert.equal(node(ui,'skipCelebration').hidden,false);assert.equal(ui.document.activeElement.id,'gameStage');
 assert.equal(node(ui,'sceneHud').hidden,true,'The race reminder releases its mobile layout space during celebration');
 assert.equal(node(ui,'playSurface').classList.contains('has-race-controls'),true,'Skip and the signal retain their control space');
 const saved=ui.state().race;ui.evaluate('(function freeze(o){Object.values(o).forEach(v=>{if(v&&typeof v==="object"&&!Object.isFrozen(v))freeze(v)});Object.freeze(o)})(state.race)');ui.frames(4.6-elapsed(ui),46);assert.equal(ui.evaluate('ui.festival.stage'),'award');assert.equal(node(ui,'rewardOverlay').hidden,true);
 ui.frames(3,30);assert.equal(node(ui,'festivalJobs').hidden,false);assert.equal(node(ui,'festivalJobs').children.length,8);
 ui.frames(1.5,15);assert.equal(node(ui,'rewardOverlay').hidden,false);assert.equal(node(ui,'skipCelebration').hidden,true);assert.equal(ui.document.activeElement.id,'rewardReplay');assert.equal(ui.state().stars,3);
 assert.equal(node(ui,'playSurface').classList.contains('has-race-controls'),false,'The hidden side controls do not reserve an empty column behind results');
 assert.deepEqual(ui.state().race,saved);ui.frames(20,20);assert.deepEqual(ui.state().race,saved);assert.equal(ui.state().stars,3);
});
test('immediate and late Skip, held Enter, and repeated dispatch cannot duplicate rewards',()=>{
 for(const delay of [0,8]){const ui=start();arrive(ui);ui.frames(delay,20);ui.key('Enter');assert.equal(node(ui,'rewardOverlay').hidden,false);assert.equal(ui.state().stars,3);
  ui.key('Enter',{repeat:true});assert.equal(ui.state().phase,'complete');assert.equal(ui.evaluate("dispatchAction('skip-celebration')"),false);assert.equal(ui.state().stars,3);
 }
});
test('Random rematches keep resolved characters, course, theme, seed and jobs; Choose racers keeps preferences',()=>{
 const ui=setup();ui.choose('player','random');ui.choose('opponent','random');ui.click('#startRaceButton');const first=ui.state().race;
 arrive(ui);ui.click('#skipCelebration');ui.click('#rewardReplay');const again=ui.state().race;
 for(const key of ['playerId','opponentId','courseId','deliveryTheme','seed','services','profile'])assert.deepEqual(again[key],first[key],key);
 assert.equal(ui.state().screen,'play');assert.equal(ui.state().phase,'countdown');assert.equal(ui.state().stars,3);
 assert.equal(ui.evaluate("game.dispatch('rematch')"),false);assert.deepEqual(ui.state().selections,{playerId:'random',opponentId:'random'});
 arrive(ui);ui.click('#skipCelebration');ui.click('#rewardAlternative');assert.equal(ui.state().screen,'race-start');assert.equal(ui.state().stars,6);assert.equal(ui.evaluate('ui.festival'),null);
 for(const role of ['player','opponent'])assert.equal(node(ui,role+'PickerButton').getAttribute('aria-expanded'),'false');
});
test('pause, focus loss, hidden tabs, Home and mute stop the appropriate festival activity',()=>{
 const ui=start();arrive(ui);ui.frames(1,10);
 for(const reason of ['pause','blur','hidden']){
  if(reason==='pause')ui.key('Escape');if(reason==='blur')ui.windowListeners.get('blur')();if(reason==='hidden'){ui.document.hidden=true;ui.document.emit('visibilitychange');}
  const time=elapsed(ui),copy=ui.evaluate('JSON.stringify(ui.festival)');ui.frames(10,20);assert.equal(elapsed(ui),time);assert.equal(ui.evaluate('JSON.stringify(ui.festival)'),copy);
  ui.windowListeners.get('focus')();ui.document.hidden=false;ui.document.emit('visibilitychange');ui.click('#pauseOverlay [data-action="resume"]');ui.frames(.5,10);assert.ok(elapsed(ui)>time);
 }
 ui.click('[data-action="mute"]');assert.equal(ui.state().isMuted,true);ui.frames(2,20);assert.ok(elapsed(ui)>2);
 ui.click('[data-action="home"]');assert.equal(ui.evaluate('ui.festival'),null);ui.frames(20,10);assert.equal(ui.state().screen,'race-start');assert.equal(ui.state().stars,3);
});
for(const [id,sound]of [['thomas','whistle'],['bertie','horn'],['bulgy','horn'],['harold','radio']])test(`${id}: Space and the signal picture work during celebration, held keys do not`,()=>{
 const ui=setup();ui.choose('player',id);ui.click('#startRaceButton');arrive(ui);
 ui.evaluate('globalThis.effects=[];audio.effect=(...args)=>effects.push(args)');ui.key(' ');ui.key(' ',{repeat:true});ui.click('#action-whistle');assert.deepEqual(JSON.parse(ui.evaluate('JSON.stringify(effects.map(e=>e[0]))')),[sound,sound]);
 assert.equal(ui.state().phase,'complete');assert.equal(node(ui,'rewardOverlay').hidden,true);
});
for(const winner of ['player','rival','tie'])test(`${winner}: appropriate visual award and three completion stars`,()=>{
 const ui=start();arrive(ui,winner);ui.click('#skipCelebration');assert.equal(node(ui,'festivalResultAwardPicture').getAttribute('href'),winner==='rival'?'#festival-rosette':'#festival-trophy');
 assert.equal(node(ui,'raceResultPortrait').getAttribute('href'),'#portrait-'+ui.state().race.playerId);assert.equal(ui.state().stars,3);assert.equal(ui.state().stickers.includes('race-winner'),winner==='player');
});
