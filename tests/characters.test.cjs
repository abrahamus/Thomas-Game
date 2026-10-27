const test=require('node:test'),assert=require('node:assert/strict');
require('../scripts/race-model.js');require('../scripts/game-shell.js');
const R=global.ThomasRaceCore,G=global.ThomasGameCore;
const ids=['thomas','percy','james','bertie','toby','spencer','emily','diesel','bulgy','harold'];
test('all named and random choices resolve to two different supported racers',()=>{
 for(const playerId of [...ids,'random'])for(const opponentId of [...ids,'random']){
  if(playerId===opponentId&&playerId!=='random'){
   assert.throws(()=>R.chooseRace({playerId,opponentId}),/different/);continue;
  }
  for(const value of [0,.25,.5,.999999]){
   const options=R.chooseRace({playerId,opponentId,random:()=>value,lastRace:{playerId:'percy',opponentId:'james',courseId:'country',deliveryTheme:'cargo'}});
   assert.ok(ids.includes(options.playerId)&&ids.includes(options.opponentId));
   assert.notEqual(options.playerId,options.opponentId);
   if(playerId!=='random')assert.equal(options.playerId,playerId);else assert.notEqual(options.playerId,'percy');
   if(opponentId!=='random')assert.equal(options.opponentId,opponentId);else assert.notEqual(options.opponentId,'james');
   const race=R.createRace(options);assert.equal(race.playerId,options.playerId);
  }
 }
 assert.throws(()=>R.createRace({playerId:'toby',opponentId:'toby'}),/different/);
 assert.throws(()=>R.createRace({playerId:'cranky'}),/Unknown/);
});
test('selectors persist independently of resolved racers and reject clashes without changing choices',()=>{
 let saved;const storage={getItem:()=>saved,setItem:(_,v)=>{saved=v}};const game=G.createGame(storage,()=>.45);
 assert.deepEqual(game.state.selections,{playerId:'thomas',opponentId:'random'});
 assert.equal(game.dispatch('select-player','bulgy'),true);assert.equal(game.dispatch('select-opponent','bulgy'),false);
 assert.equal(game.dispatch('select-opponent','thomas'),true);assert.equal(game.dispatch('start-race'),true);
 assert.equal(game.state.race.playerId,'bulgy');assert.equal(game.state.race.opponentId,'thomas');
 assert.equal(game.dispatch('select-player','james'),false);assert.equal(game.dispatch('start-race'),false);
 game.state.race.phase=game.state.phase='complete';game.dispatch('next-race');assert.equal(game.state.screen,'race-start');
 assert.deepEqual(G.createGame(storage).state.selections,{playerId:'bulgy',opponentId:'thomas'});
 game.dispatch('select-player','random');game.dispatch('select-opponent','random');game.dispatch('start-race');
 assert.notEqual(game.state.race.playerId,game.state.race.opponentId);
 assert.deepEqual(game.state.selections,{playerId:'random',opponentId:'random'});
});
test('missing, invalid and duplicate saved choices preserve earned progress and use fresh defaults',()=>{
 for(const selections of [undefined,null,{}, {playerId:'cranky',opponentId:'percy'},{playerId:'diesel',opponentId:'diesel'},{playerId:'random',opponentId:42}]){
  const saved=JSON.stringify({version:1,stars:12,stickers:['race-finisher','apple-delivery'],completedMissions:['find-toby'],selections});
  const game=G.createGame({getItem:()=>saved,setItem(){}});
  assert.deepEqual(game.state.selections,{playerId:'thomas',opponentId:'random'});
  assert.equal(game.state.stars,12);assert.deepEqual(game.state.stickers,['race-finisher','apple-delivery']);assert.deepEqual(game.state.completedMissions,['find-toby']);
  assert.equal(game.dispatch('start-race'),true);assert.notEqual(game.state.race.playerId,game.state.race.opponentId);
 }
});
test('every resolved pairing reproduces jobs, independent AI and movement for the same seed',()=>{
 for(const playerId of ids)for(const opponentId of ids)if(playerId!==opponentId){
  const options={playerId,opponentId,seed:18793,courseId:'mountain',deliveryTheme:'cargo'},a=R.createRace(options),b=R.createRace(options);
  for(let i=0;i<200;i++){R.step(a,.1);R.step(b,.1);}
  assert.deepEqual(a,b);
 }
});
