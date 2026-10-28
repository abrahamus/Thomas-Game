'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../scripts/race-model.js');
const R=global.ThomasRaceCore,{drive}=require('./helpers/race-driver.cjs');
const baseline=require('./fixtures/race-pacing-825.json');

test('every character reaches 1,000 cruise in 5.5 seconds and visibly covers more ground',()=>{
    for(const character of R.CHARACTERS){
        const r=R.createRace({playerId:character.id,opponentId:character.id==='thomas'?'percy':'thomas'});
        R.step(r,R.START_COUNTDOWN);
        R.step(r,5.5);
        assert.ok(Math.abs(r.player.velocity-1000)<1e-7,character.id);
        const before=R.sampleVehicleRoute(r,'player');
        R.step(r,1);
        const after=R.sampleVehicleRoute(r,'player');
        assert.ok(Math.abs(Math.hypot(after.x-before.x,after.z-before.z)-8)<1e-7,'world scale is unchanged: cruise visibly covers eight world units per second');
        r.player.boostRemaining=6;
        R.step(r,1.375);
        assert.ok(Math.abs(r.player.velocity-1250)<1e-7,'the existing 25% reward reaches 1,250');
    }
});

test('longer courses retain recorded race times, jobs and outcomes across all characters and themes',t=>{
    let min=Infinity,max=-Infinity,total=0;
    for(const reference of baseline.samples){
        const r=drive(R,reference.options),seconds=r.elapsed+R.START_COUNTDOWN,delta=seconds-reference.seconds;
        const label=Object.values(reference.options).join('/');
        assert.ok(Math.abs(delta)<=1.6,`${label}: duration changed by ${delta.toFixed(3)} seconds`);
        assert.equal(r.winner,reference.winner,label);
        assert.deepEqual(r.services.map(s=>s.type),reference.jobs,'the same seed still chooses the same eight jobs');
        assert.equal(r.player.serviceStates.filter(s=>s.completed).length,8);
        min=Math.min(min,delta);max=Math.max(max,delta);total+=delta;
    }
    t.diagnostic(JSON.stringify({comparisons:baseline.samples.length,minDelta:min,maxDelta:max,meanDelta:total/baseline.samples.length}));
});
