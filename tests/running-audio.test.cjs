const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.THOMAS_HTML_SOURCE || path.join(root, 'thomas_the_tank_engine_island_of_sodor_adventure.html'), 'utf8');
const inline = id => html.match(new RegExp(`<script\\b[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`))?.[1];
const source = process.env.THOMAS_AUDIO_SOURCE ? fs.readFileSync(process.env.THOMAS_AUDIO_SOURCE, 'utf8') : inline('game-audio');
const assets = process.env.THOMAS_RUNNING_AUDIO_SOURCE ? JSON.parse(fs.readFileSync(process.env.THOMAS_RUNNING_AUDIO_SOURCE, 'utf8')) : JSON.parse(inline('running-audio-data') || 'null');
const WHEEL_DISTANCE = 2 * Math.PI * 24.975 / .35;

function wav(data) {
    const bytes = Buffer.from(data, 'base64');
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
    let format, pcm;
    for (let i = 12; i + 8 <= bytes.length;) {
        const size = bytes.readUInt32LE(i + 4), end = i + 8 + size;
        assert.ok(end <= bytes.length);
        const chunk = bytes.toString('ascii', i, i + 4);
        if (chunk === 'fmt ') format = bytes.subarray(i + 8, end);
        if (chunk === 'data') pcm = bytes.subarray(i + 8, end);
        i = end + size % 2;
    }
    assert.ok(format && pcm);
    assert.equal(format.readUInt16LE(0), 1);
    assert.equal(format.readUInt16LE(2), 1);
    assert.equal(format.readUInt32LE(4), 22050);
    assert.equal(format.readUInt16LE(14), 16);
    const samples = Float32Array.from({ length: pcm.length / 2 }, (_, i) => pcm.readInt16LE(i * 2) / 32768);
    return { duration: samples.length / 22050, sampleRate: 22050, getChannelData: () => samples };
}
class Param {
    constructor(value = 0) { this.value = value; this.operations = []; }
    setValueAtTime(value, at) { this.value = value; this.operations.push(['set', value, at]); }
    linearRampToValueAtTime(value, at) { this.value = value; this.operations.push(['linear', value, at]); }
    exponentialRampToValueAtTime(value, at) { this.value = value; this.operations.push(['exp', value, at]); }
    cancelAndHoldAtTime(at) { this.operations.push(['hold', at]); }
    cancelScheduledValues(at) { this.operations.push(['cancel', at]); }
}
class AudioNode {
    constructor(kind, context) {
        this.kind = kind; this.context = context; this.connections = []; this.gain = new Param();
        this.frequency = new Param(); this.playbackRate = new Param(1); this.Q = new Param();
        this.started = false; this.ended = false; this.stopped = 0;
    }
    connect(target) { this.connections.push(target); }
    disconnect() { this.disconnected = true; }
    start(at = 0, offset = 0, duration) { this.started = true; this.startTime = at; this.offset = offset; this.duration = duration; }
    stop(at = this.context.currentTime) { this.stopped++; this.stopTime = at; }
    finish() { if (this.ended) return; this.ended = true; if (this.onended) this.onended(); }
}
class Context {
    constructor() { this.currentTime = 0; this.sampleRate = 22050; this.state = 'suspended'; this.nodes = []; this.gains = []; this.destination = {}; this.decoding = []; }
    node(kind) { const node = new AudioNode(kind, this); this.nodes.push(node); return node; }
    createGain() { const node = this.node('gain'); this.gains.push(node); return node; }
    createBufferSource() { return this.node('source'); }
    createOscillator() { return this.node('oscillator'); }
    createBiquadFilter() { return this.node('filter'); }
    createBuffer(channels, frames, rate) { const samples=Array.from({length:channels},()=>new Float32Array(frames));return { duration: frames / rate, sampleRate:rate, getChannelData: i => samples[i] }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    decodeAudioData(bytes) { return new Promise((resolve, reject) => this.decoding.push({ bytes, resolve, reject })); }
    resolve(index) { const pending = this.decoding[index]; pending.resolve(wav(Buffer.from(pending.bytes).toString('base64'))); }
    tick(dt) { this.currentTime += dt; for (const node of this.nodes) if (node.started && !node.ended && !node.loop && (node.stopTime ?? Infinity) <= this.currentTime) node.finish(); }
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function setup(options = {}) {
    const state = { paused: false, isMuted: false, generation: 1 };
    const box = vm.createContext({ window: { AudioContext: Context }, atob: data => Buffer.from(data, 'base64').toString('binary'),
        Uint8Array, ThomasNarration: { voice: { text: 'Slow down.', data: assets.chuff.data } } });
    vm.runInContext(source, box);
    const audio = box.ThomasAudio.create({ getState: () => state, getGeneration: () => state.generation,
        runningAssets: options.noAssets ? null : assets });
    const motion = (distance, velocity = 1000, targetVelocity = velocity, isActive = true) => ({ distance, velocity, targetVelocity, wheelTurns: distance / WHEEL_DISTANCE, isActive });
    audio.unlock();
    return { audio, state, motion, context: audio.context };
}
async function ready(scene, velocity = 1000) {
    scene.audio.update(1 / 60, scene.motion(0, velocity));
    assert.equal(scene.context.decoding.length, 2);
    scene.context.resolve(0); scene.context.resolve(1); await flush();
}
const loops = context => context.nodes.filter(n => n.started && n.loop && !n.disconnected);
const shots = context => context.nodes.filter(n => n.started && !n.loop && n.kind === 'source');


test('embedded running assets are real credited mono PCM with a continuous rolling join and faded steam', () => {
    assert.ok(assets?.rolling && assets?.chuff);
    for (const [name, asset] of Object.entries(assets)) {
        const buffer = wav(asset.data), samples = buffer.getChannelData();
        let sum = 0, peak = 0;
        for (const value of samples) { sum += value * value; peak = Math.max(peak, Math.abs(value)); }
        assert.ok(Math.abs(buffer.duration - asset.duration) < 1 / 22050);
        assert.ok(peak > .5 && peak <= .73, name);
        assert.ok(Math.abs(Math.sqrt(sum / samples.length) - asset.rms) < .0001);
        assert.equal(asset.license, 'CC0 1.0'); assert.match(asset.source, /^https:\/\/freesound\.org\/people\//);
        assert.equal(asset.sourceSha256.length, 64);
    }
    const roll = wav(assets.rolling.data).getChannelData(), chuff = wav(assets.chuff.data).getChannelData();
    assert.ok(Math.abs(roll[0] - roll.at(-1)) < .025, 'loop joins without a discontinuous jump');
    assert.equal(chuff[0], 0); assert.equal(chuff.at(-1), 0);
    assert.ok(assets.rolling.duration > 10 && assets.rolling.duration < 30);
    assert.ok(assets.chuff.duration > .1 && assets.chuff.duration < .5);
});

test('no running sound without motion, assets, active gameplay, or actual velocity; old chug cannot revive it', async () => {
    for (const options of [{}, { noAssets: true }]) {
        const scene = setup(options); scene.audio.update();
        scene.audio.update(10, { speed: 4, place: 'farm' });
        scene.audio.update(1, scene.motion(0, 0));
        scene.audio.update(1, scene.motion(100, 1000, 1000, false));
        assert.equal(scene.context.decoding.length, 0);
        assert.equal(scene.audio.effect('chug'), false);
        assert.equal(scene.context.nodes.filter(n => n.kind === 'oscillator').length, 0);
        if (options.noAssets) { scene.audio.update(.1, scene.motion(100, 1000)); assert.equal(scene.context.decoding.length, 0); }
    }
});

test('one continuous rolling source follows actual velocity rather than selected gear', async () => {
    const scene = setup(); await ready(scene, 250);
    assert.equal(loops(scene.context).length, 1);
    const loop = loops(scene.context)[0], gain = loop.connections[0];
    const lowLevel = gain.gain.value, lowRate = loop.playbackRate.value;
    scene.audio.update(.016, scene.motion(10, 250, 1000));
    assert.equal(gain.gain.value, lowLevel);
    assert.equal(loop.playbackRate.value, lowRate);
    assert.equal(shots(scene.context).length, 0, 'selecting a high gear does not invent wheel turns or exhaust beats');
    scene.audio.update(.016, scene.motion(20, 1000, 1000));
    assert.ok(gain.gain.value > lowLevel * 2); assert.ok(loop.playbackRate.value > lowRate);
    for (let i = 1; i <= 100; i++) { scene.context.tick(.016); scene.audio.update(.016, scene.motion(20 + i * 13.2)); }
    assert.equal(loops(scene.context).length, 1);
    scene.audio.update(.016, scene.motion(1350, 0, 0));
    assert.equal(loops(scene.context).length, 0); assert.ok(loop.stopped > 0);
});

test('four exhaust beats follow each wheel revolution at both refresh rates and all gears', async () => {
    for (const fps of [60, 120]) for (const velocity of [250, 500, 750, 1000]) {
        const scene = setup(); await ready(scene, velocity);
        const duration = 10;
        for (let frame = 1; frame <= fps * duration; frame++) {
            scene.context.tick(1 / fps);
            scene.audio.update(1 / fps, scene.motion(velocity * frame / fps, velocity));
        }
        const expected = Math.floor(velocity * duration / WHEEL_DISTANCE * 4 + 1e-8);
        assert.equal(shots(scene.context).length, expected, `${fps} Hz at ${velocity}: wheel-exact beats`);
        assert.ok(expected / duration >= 1.8 && expected / duration <= 9);
        assert.ok(shots(scene.context).every(n => n.duration <= .28 && n.duration < 1 / (velocity / WHEEL_DISTANCE * 4)));
        assert.ok(shots(scene.context).filter(n => !n.ended && !n.disconnected).length <= 2);
    }
});

test('slow frames and rewinds synchronize phase without a burst of missed chuffs', async () => {
    const scene = setup(); await ready(scene);
    scene.audio.update(10, scene.motion(8250));
    assert.equal(shots(scene.context).length, 0);
    scene.audio.update(1 / 60, scene.motion(8263.75));
    assert.ok(shots(scene.context).length <= 1);
    const before = shots(scene.context).length;
    scene.audio.update(.01, scene.motion(0));
    assert.equal(shots(scene.context).length, before);
    scene.audio.update(.01, scene.motion(100000));
    assert.equal(shots(scene.context).length, before, 'a huge wheel-phase jump does not create catch-up audio');
});

test('short high-speed chuffs stay unpitched, strengthen with acceleration, and soften under braking', async () => {
    const levels = [];
    for (const target of [0, 500, 1000]) {
        const scene = setup(); await ready(scene, 500);
        scene.audio.update(.02, scene.motion(WHEEL_DISTANCE / 4 + 1, 500, target));
        const shot = shots(scene.context)[0]; assert.ok(shot);
        assert.equal(shot.playbackRate.value, 1, 'steam pitch is not raised at speed');
        levels.push(Math.max(...shot.connections[0].gain.operations.filter(op => op[0] !== 'hold').map(op => op[1])));
    }
    assert.ok(levels[0] < levels[1] && levels[1] < levels[2]);
});

test('narration ducks only the running bus, preserving original effects and master levels', async () => {
    const scene = setup(); await ready(scene);
    const [master, narration, effects, running] = scene.context.gains;
    assert.equal(master.gain.value, 1); assert.equal(narration.gain.value, .72); assert.equal(effects.gain.value, 1);
    const effectEvents = effects.gain.operations.length;
    const result = scene.audio.speak('voice'); await flush(); assert.equal(await result, true);
    assert.equal(running.gain.value, .30); assert.equal(effects.gain.operations.length, effectEvents);
    assert.ok(running.gain.operations.some(op => op[0] === 'linear' && op[1] === .30));
    const narrator = shots(scene.context).at(-1); narrator.finish();
    assert.equal(running.gain.value, 1); assert.equal(effects.gain.value, 1);
});

test('pause, mute, stopped train, inactive mode, and activity changes cancel loops and exhaust', async () => {
    for (const reason of ['pause', 'mute', 'stop', 'stationary', 'inactive', 'generation']) {
        const scene = setup(); await ready(scene);
        scene.audio.update(.02, scene.motion(WHEEL_DISTANCE / 4 + 1));
        const active = scene.context.nodes.filter(n => n.started && n.kind === 'source');
        if (reason === 'pause') scene.state.paused = true;
        if (reason === 'mute') scene.audio.setMuted(true);
        if (reason === 'stop') scene.audio.stop();
        if (reason === 'generation') scene.state.generation++;
        if (!['mute', 'stop'].includes(reason)) scene.audio.update(.02, scene.motion(200, reason === 'stationary' ? 0 : 1000, 1000, reason !== 'inactive' && reason !== 'generation'));
        assert.ok(active.every(n => n.stopped > 0 && n.disconnected), reason);
        assert.equal(loops(scene.context).length, 0, reason);
    }
});

test('delayed running decodes cannot restart a cancelled, paused, muted, inactive, or replaced activity', async () => {
    for (const reason of ['pause', 'mute', 'stop', 'inactive', 'stationary', 'generation']) {
        const scene = setup(); scene.audio.update(.02, scene.motion(0));
        assert.equal(scene.context.decoding.length, 2);
        if (reason === 'pause') { scene.state.paused = true; scene.audio.update(); }
        if (reason === 'mute') scene.audio.setMuted(true);
        if (reason === 'stop') scene.audio.stop();
        if (reason === 'generation') scene.state.generation++;
        if (reason === 'stationary') scene.audio.update(.01, scene.motion(0, 0));
        if (reason === 'inactive') scene.audio.update(.01, scene.motion(0, 1000, 1000, false));
        scene.context.resolve(0); scene.context.resolve(1); await flush();
        assert.equal(loops(scene.context).length, 0, reason);
        assert.equal(shots(scene.context).length, 0, reason);
    }
});

test('repeated frames share two decodes; resume reuses decoded buffers without reviving old sources', async () => {
    const scene = setup(); scene.audio.update(.01, scene.motion(0));
    for (let i = 1; i <= 100; i++) scene.audio.update(.01, scene.motion(i));
    assert.equal(scene.context.decoding.length, 2);
    scene.context.resolve(0); scene.context.resolve(1); await flush();
    const original = loops(scene.context)[0];
    scene.state.paused = true; scene.audio.update(.01, scene.motion(200));
    assert.ok(original.disconnected);
    scene.state.paused = false; scene.audio.update(.01, scene.motion(200));
    assert.equal(scene.context.decoding.length, 2);
    assert.equal(loops(scene.context).length, 1);
    assert.notEqual(loops(scene.context)[0], original);
});

test('corrupt running sample stays silent and cannot block whistle or narration fallback', async () => {
    const scene = setup(); scene.audio.update(.01, scene.motion(0));
    scene.context.decoding[0].reject(new Error('broken WAV'));
    scene.context.resolve(1); await flush();
    assert.equal(loops(scene.context).length, 0);
    for (let i = 0; i < 100; i++) scene.audio.update(.016, scene.motion(i * 13.2));
    assert.equal(scene.context.decoding.length, 2, 'damaged embedded samples do not retry decoding every frame');
    assert.equal(scene.audio.effect('whistle'), true);
    assert.ok(scene.context.nodes.some(n => n.kind === 'oscillator' && n.started));
});

test('road and diesel engines use a motor and horn without steam chuffs',async()=>{
 for(const vehicleType of ['road','rail']){
  const scene=setup();const move=d=>({...scene.motion(d),vehiclePower:'diesel',vehicleType});
  scene.audio.update(.016,move(0));
  if(vehicleType==='rail'){scene.context.resolve(0);scene.context.resolve(1);await flush();}
  else assert.equal(scene.context.decoding.length,0,'buses do not request railway clatter');
  for(let i=1;i<=120;i++){scene.context.tick(.016);scene.audio.update(.016,move(i*13.2));}
  assert.equal(shots(scene.context).length,0,'no steam exhaust beats');
  const motor=scene.context.nodes.find(n=>n.kind==='source'&&n.loop&&n.buffer?.duration===2&&n.started&&!n.disconnected);assert.ok(motor);
  assert.equal(scene.audio.effect('horn'),true);
  scene.state.paused=true;scene.audio.update(.016,move(1600));assert.ok(motor.stopped>0);
 }
});
test('Harold has an offline rotor rhythm while hovering, no railway audio, and a radio signal',()=>{
 const scene=setup(),motion={...scene.motion(12000,0),vehiclePower:'rotor',vehicleType:'air',rotorActive:true,rotorLevel:.12};
 scene.audio.update(.016,motion);assert.equal(scene.context.decoding.length,0);assert.equal(loops(scene.context).length,1);
 const rotor=loops(scene.context)[0];assert.equal(scene.audio.effect('radio'),true);
 scene.state.paused=true;scene.audio.update(.016,motion);assert.ok(rotor.stopped>0);
 scene.state.paused=false;scene.audio.update(.016,motion);assert.equal(loops(scene.context).length,1);assert.notEqual(loops(scene.context)[0],rotor);
 scene.state.isMuted=true;scene.audio.update(.016,motion);assert.equal(loops(scene.context).length,0);
});

test('Harold radio is a sustained two-tone call that stands out above the rotor and respects pause/mute',()=>{
 const scene=setup(),motion={...scene.motion(12000,0),vehiclePower:'rotor',vehicleType:'air',rotorActive:true,rotorLevel:.12};scene.audio.update(.016,motion);
 const before=scene.context.nodes.length;assert.equal(scene.audio.effect('radio'),true);
 const tones=scene.context.nodes.slice(before).filter(n=>n.kind==='oscillator');
 assert.ok(tones.length>=2,'radio needs a distinct two-tone call rather than a brief UI pop');
 const duration=Math.max(...tones.map(n=>n.stopTime))-Math.min(...tones.map(n=>n.startTime));assert.ok(duration>=.5&&duration<=.8,'radio remains audible for at least half a second');
 for(const tone of tones){const gain=tone.connections[0],peak=Math.max(...gain.gain.operations.filter(o=>['set','linear','exp'].includes(o[0])).map(o=>o[1]));assert.ok(peak>=.28&&peak<=.4,'radio has a clear but bounded level');assert.ok(tone.stopTime>tone.startTime+.2);}
 scene.state.paused=true;scene.audio.update(.016,motion);assert.ok(tones.every(n=>n.disconnected),'pause stops the call');const count=scene.context.nodes.length;assert.equal(scene.audio.effect('radio'),false);assert.equal(scene.context.nodes.length,count);
 scene.state.paused=false;scene.state.isMuted=true;assert.equal(scene.audio.effect('radio'),false);assert.equal(scene.context.nodes.length,count);
});

test('after a bus honk ends, driving leaves no continuous pitched oscillator that sounds like a stuck horn',()=>{
 const scene=setup(),motion=d=>({...scene.motion(d),vehiclePower:'diesel',vehicleType:'road'});
 scene.audio.update(.016,motion(0));const before=scene.context.nodes.length;
 scene.audio.effect('horn');const horn=scene.context.nodes.slice(before).filter(n=>n.kind==='oscillator');assert.equal(horn.length,4);
 for(let frame=1;frame<=120;frame++){scene.context.tick(1/60);scene.audio.update(1/60,motion(frame*1000/60));}
 assert.ok(horn.every(n=>n.ended&&n.disconnected),'both horn blasts stop automatically');
 const pitched=scene.context.nodes.filter(n=>n.kind==='oscillator'&&n.started&&!n.ended&&!n.disconnected);
 assert.equal(pitched.length,0,'driving should use a textured engine rumble, not a continuous beep');
 scene.audio.update(.016,{...motion(1650),velocity:0});assert.equal(loops(scene.context).length,0,'engine stops when the bus stops');
});

test('diesel rumble is quiet, non-tonal, speed-linked, and stops on mute, pause and leaving the race',()=>{
 for(const stop of ['mute','pause','inactive']){
  const scene=setup(),move=velocity=>({...scene.motion(1200,velocity),vehiclePower:'diesel',vehicleType:'road'});
  scene.audio.update(.016,move(200));const motor=loops(scene.context)[0];assert.ok(motor);
  const lowRate=motor.playbackRate.value,lowGain=motor.connections[0].gain.value,samples=motor.buffer.getChannelData(0);
  const rms=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length),mean=samples.reduce((sum,x)=>sum+x,0)/samples.length;
  assert.ok(rms>.05&&rms<.3);assert.ok(Math.abs(mean)<1e-6);assert.ok(samples.every(x=>Number.isFinite(x)&&Math.abs(x)<=.851));
  for(const frequency of [120,220,293]){
   const lag=Math.round(motor.buffer.sampleRate/frequency);let cross=0,power=0;
   for(let i=0;i<samples.length;i++){cross+=samples[i]*samples[(i+lag)%samples.length];power+=samples[i]*samples[i];}
   assert.ok(Math.abs(cross/power)<.2,`engine must not repeat a pure ${frequency} Hz beep`);
  }
  for(let i=0;i<60;i++)scene.audio.update(1/60,move(1000));assert.equal(loops(scene.context).length,1);
  assert.ok(motor.playbackRate.value>lowRate);assert.ok(motor.connections[0].gain.value>lowGain);assert.ok(motor.connections[0].gain.value<=.06);
  scene.audio.effect('horn');
  if(stop==='mute')scene.state.isMuted=true;if(stop==='pause')scene.state.paused=true;
  if(stop==='inactive')scene.audio.stop();else scene.audio.update(.016,move(1000));
  assert.equal(loops(scene.context).length,0);assert.ok(scene.context.nodes.filter(n=>n.kind==='oscillator').every(n=>n.disconnected));
  scene.state.isMuted=scene.state.paused=false;scene.audio.update(.016,move(1000));assert.equal(loops(scene.context).length,1);assert.notEqual(loops(scene.context)[0],motor);
  assert.equal(loops(scene.context)[0].buffer,motor.buffer,'resume reuses the offline rumble');
 }
});

test('the short bus horn has a clear bounded level above the engine and always falls silent',()=>{
 const scene=setup(),motion={...scene.motion(12000,1000),vehiclePower:'diesel',vehicleType:'road'};scene.audio.update(.016,motion);
 const motor=loops(scene.context)[0],before=scene.context.nodes.length;assert.equal(scene.audio.effect('horn'),true);
 const tones=scene.context.nodes.slice(before).filter(n=>n.kind==='oscillator');assert.equal(tones.length,4);
 for(const tone of tones){
  const gain=tone.connections[0].gain,peak=Math.max(...gain.operations.filter(op=>['set','linear','exp'].includes(op[0])).map(op=>op[1]));
  assert.ok(peak>=.18&&peak<=.23,`horn gain ${peak} must be clearly audible without being excessive`);
  assert.ok(peak>=motor.connections[0].gain.value*3,'horn stands above the engine');
  assert.ok(gain.operations.some(op=>op[0]==='linear'&&op[1]===0&&op[2]<tone.stopTime),'each blast fades out before stopping');
  assert.ok(tone.stopTime<=.6);
 }
 scene.context.tick(.6);assert.ok(tones.every(tone=>tone.ended&&tone.disconnected));
});
