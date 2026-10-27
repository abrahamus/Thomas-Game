const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(process.env.THOMAS_HTML_SOURCE || path.join(__dirname, '..', 'thomas_the_tank_engine_island_of_sodor_adventure.html'), 'utf8');
const inline = html.match(/<script\b[^>]*id=["']game-music["'][^>]*>([\s\S]*?)<\/script>/);
const source = process.env.THOMAS_MUSIC_SOURCE ? fs.readFileSync(process.env.THOMAS_MUSIC_SOURCE, 'utf8') : (assert.ok(inline, 'offline music player is embedded'), inline[1]);

class Param {
    constructor(value = 1) { this.value = value; this.operations = []; }
    cancelAndHoldAtTime(time) { this.operations.push(['hold', time]); }
    cancelScheduledValues(time) { this.operations.push(['cancel', time]); }
    setValueAtTime(value, time) { this.value = value; this.operations.push(['set', value, time]); }
    linearRampToValueAtTime(value, time) { this.value = value; this.operations.push(['ramp', value, time]); }
}
class Node {
    constructor(kind) { this.kind = kind; this.gain = new Param(); this.connections = []; this.stopped = 0; this.disconnected = false; }
    connect(target) { this.connections.push(target); }
    disconnect() { this.disconnected = true; }
    start(time, offset) { this.started = true; this.startTime = time; this.offset = offset; }
    stop() { this.stopped++; }
}
class Context {
    constructor() { this.state = 'running'; this.currentTime = 10; this.nodes = []; this.decoding = []; }
    createGain() { const node = new Node('gain'); this.nodes.push(node); return node; }
    createBufferSource() { const node = new Node('source'); this.nodes.push(node); return node; }
    decodeAudioData(bytes) { return new Promise((resolve, reject) => this.decoding.push({ bytes, resolve, reject })); }
    resolve(index = 0, duration = 64) { this.decoding[index].resolve({ duration }); }
    reject(index = 0) { this.decoding[index].reject(new Error('Corrupt WAV')); }
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function setup() {
    const state = { screen: 'play', mode: 'race', generation: 1, paused: false, isMuted: false, musicEnabled: true };
    const audio = { context: null, output: new Node('master'), effects: new Node('effects'), speaking: false };
    const asset = { data: Buffer.from('offline WAV data').toString('base64'), duration: 64 };
    const box = vm.createContext({ atob: data => Buffer.from(data, 'base64').toString('binary'), Uint8Array });
    vm.runInContext(source, box, { filename: 'game-music.js' });
    const music = box.ThomasMusic.create({ getContext: () => audio.context, getOutput: () => audio.output,
        getState: () => state, getGeneration: () => state.generation, getAsset: () => asset,
        isSpeaking: () => audio.speaking });
    const unlock = () => { audio.context = new Context(); return audio.context; };
    return { music, state, audio, asset, unlock };
}
async function start(fixture) {
    fixture.music.update(); await flush(); fixture.audio.context.resolve(); await flush();
    assert.equal(fixture.music.playing, true);
    return fixture.audio.context.nodes.find(node => node.kind === 'source');
}

function readPcm(asset) {
    const bytes = Buffer.from(asset.data, 'base64');
    let samples = null, sampleRate = null;
    for (let offset = 12; offset + 8 <= bytes.length;) {
        const kind = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4);
        if (kind === 'fmt ') {
            assert.equal(bytes.readUInt16LE(offset + 8), 1, 'loudness fixture uses PCM');
            assert.equal(bytes.readUInt16LE(offset + 10), 1, 'loudness fixture uses mono audio');
            assert.equal(bytes.readUInt16LE(offset + 22), 16, 'loudness fixture uses 16-bit samples');
            sampleRate = bytes.readUInt32LE(offset + 12);
        }
        if (kind === 'data') samples = bytes.subarray(offset + 8, offset + 8 + length);
        offset += 8 + length + (length % 2);
    }
    assert.ok(samples && sampleRate, 'embedded recording has readable audio samples');
    return { samples, duration: samples.length / 2 / sampleRate };
}
function rmsDb(pcm, gain, activeOnly = false) {
    let sum = 0, count = 0;
    for (let offset = 0; offset < pcm.samples.length; offset += 2) {
        const sample = pcm.samples.readInt16LE(offset) / 32768;
        if (activeOnly && Math.abs(sample) <= 0.005) continue;
        sum += sample * sample; count++;
    }
    assert.ok(count > 0, 'recording contains audible samples');
    return 20 * Math.log10(Math.sqrt(sum / count) * gain);
}

test('the supplied music remains audible and ducks beneath real Ana speech on the running player route',
    { skip: !!process.env.THOMAS_MUSIC_SOURCE }, async t => {
        const musicAsset = JSON.parse(html.match(/<script\b[^>]*id=["']music-data["'][^>]*>([\s\S]*?)<\/script>/)[1]);
        const narration = JSON.parse(html.match(/<script\b[^>]*id=["']narration-data["'][^>]*>([\s\S]*?)<\/script>/)[1]);
        const voiceAsset = narration['race.service.water'];
        const musicPcm = readPcm(musicAsset), voicePcm = readPcm(voiceAsset);
        const audioSource = html.match(/<script\b[^>]*id=["']game-audio["'][^>]*>([\s\S]*?)<\/script>/)[1];
        class AudioContext extends Context {
            constructor() { super(); this.sampleRate = 22050; this.destination = new Node('destination'); }
            createBuffer(channels, frames) { return { getChannelData: () => new Float32Array(frames) }; }
        }
        const box = vm.createContext({ AudioContext, atob: data => Buffer.from(data, 'base64').toString('binary'),
            Uint8Array, ThomasNarration: { 'race.service.water': voiceAsset } });
        vm.runInContext(audioSource, box, { filename: 'game-audio.js' });
        vm.runInContext(source, box, { filename: 'game-music.js' });
        const state = { screen: 'play', mode: 'race', musicEnabled: true, generation: 1 };
        let music;
        const audio = box.ThomasAudio.create({ getState: () => state, getGeneration: () => state.generation,
            onSpeaking: () => { if (music) music.update(); } });
        const context = audio.unlock();
        music = box.ThomasMusic.create({ getContext: () => context, getOutput: () => audio.masterBus,
            getState: () => state, getGeneration: () => state.generation, getAsset: () => musicAsset,
            isSpeaking: () => audio.speaking });
        music.update(); await flush(); context.resolve(0, musicPcm.duration); await flush();
        const musicNode = context.nodes.find(node => node.kind === 'source');
        assert.ok(musicNode && music.playing, 'the actual music player starts its embedded recording');
        const musicBus = musicNode.connections[0];
        assert.deepEqual(musicBus.connections, [audio.masterBus]);
        assert.deepEqual(audio.masterBus.connections, [context.destination]);
        const normalDb = rmsDb(musicPcm, musicBus.gain.value * audio.masterBus.gain.value);
        const speaking = audio.speak('race.service.water'); await flush();
        context.resolve(1, voicePcm.duration); await speaking;
        const narrationNode = context.nodes.filter(node => node.kind === 'source').at(-1);
        const narrationBus = narrationNode.connections[0];
        assert.deepEqual(narrationBus.connections, [audio.masterBus]);
        const duckedDb = rmsDb(musicPcm, musicBus.gain.value * audio.masterBus.gain.value);
        const voiceDb = rmsDb(voicePcm, narrationBus.gain.value * audio.masterBus.gain.value, true);
        t.diagnostic(`Music: ${normalDb.toFixed(2)} dBFS normally, ${duckedDb.toFixed(2)} during speech; active Ana: ${voiceDb.toFixed(2)} dBFS.`);
        assert.ok(normalDb >= -26 && normalDb <= -20, `background music should be audible: ${normalDb.toFixed(2)} dBFS`);
        assert.ok(duckedDb >= -39 && duckedDb <= -31, `ducked music should remain audible: ${duckedDb.toFixed(2)} dBFS`);
        assert.ok(voiceDb - duckedDb >= 10 && voiceDb - duckedDb <= 18,
            `speech should lead the music clearly without suppressing it completely: ${(voiceDb - duckedDb).toFixed(2)} dB`);
        audio.stop(); music.stop();
    });

test('music never creates or resumes a context before the user unlocks existing game audio', async () => {
    const fixture = setup();
    for (let i = 0; i < 5; i++) fixture.music.update();
    await flush(); assert.equal(fixture.music.pending, false); assert.equal(fixture.music.playing, false);
    const context = fixture.unlock(); context.state = 'suspended'; fixture.music.update(); await flush();
    assert.equal(context.nodes.length, 0); assert.equal(context.decoding.length, 0);
    context.state = 'running'; const node = await start(fixture);
    assert.equal(node.loop, true); assert.equal(node.offset, 0); assert.equal(node.loopEnd, 64);
});

test('only a dedicated music bus connects to the existing master and narration ducks no effects', async () => {
    const fixture = setup(), context = fixture.unlock(); const node = await start(fixture);
    const bus = context.nodes.find(item => item.kind === 'gain');
    assert.deepEqual(bus.connections, [fixture.audio.output]); assert.deepEqual(node.connections, [bus]);
    assert.equal(bus.gain.value, 0.72);
    fixture.audio.speaking = true; fixture.music.update(); assert.equal(bus.gain.value, 0.16);
    assert.deepEqual(bus.gain.operations.at(-1), ['ramp', 0.16, context.currentTime + 0.18]);
    fixture.audio.speaking = false; fixture.music.update(); assert.equal(bus.gain.value, 0.72);
    assert.equal(fixture.audio.effects.gain.value, 1); assert.deepEqual(fixture.audio.effects.gain.operations, []);
});

test('many frame updates share one decode and one looping source', async () => {
    const fixture = setup(), context = fixture.unlock();
    for (let i = 0; i < 120; i++) fixture.music.update(); await flush();
    assert.equal(context.decoding.length, 1); assert.equal(fixture.music.pending, true);
    context.resolve(); await flush();
    for (let i = 0; i < 120; i++) fixture.music.update();
    assert.equal(context.nodes.filter(node => node.kind === 'source').length, 1);
    assert.equal(fixture.music.pending, false); assert.equal(fixture.music.playing, true);
});

test('pause stops immediately and explicit resume continues the same loop position', async () => {
    const fixture = setup(), context = fixture.unlock(), first = await start(fixture);
    context.currentTime += 12.5; fixture.state.paused = true; fixture.music.update();
    assert.equal(first.stopped, 1); assert.equal(first.disconnected, true); assert.equal(fixture.music.position, 12.5);
    context.currentTime += 90; fixture.music.update(); assert.equal(fixture.music.position, 12.5);
    assert.equal(fixture.music.playing, false);
    fixture.state.paused = false; fixture.music.update(); await flush();
    const second = context.nodes.filter(node => node.kind === 'source').at(-1);
    assert.equal(second.offset, 12.5); assert.equal(context.decoding.length, 1);
    assert.equal(first.stopped, 1); assert.equal(fixture.music.playing, true);
});

test('a loop resumes correctly after more than one full duration and respects loop boundaries', async () => {
    const fixture = setup(); fixture.asset.loopStart = 4; fixture.asset.loopEnd = 60;
    const context = fixture.unlock(), first = await start(fixture);
    assert.equal(first.loopStart, 4); assert.equal(first.loopEnd, 60);
    context.currentTime += 128; fixture.state.paused = true; fixture.music.update();
    assert.equal(fixture.music.position, 16);
    fixture.state.paused = false; fixture.music.update(); await flush();
    assert.equal(context.nodes.filter(node => node.kind === 'source').at(-1).offset, 16);
});

test('master mute, music-only mute, disabled music and focus loss stop and preserve position', async () => {
    for (const [key, blocked, resumed] of [['isMuted', true, false], ['musicMuted', true, false], ['musicEnabled', false, true],
        ['focused', false, true], ['hidden', true, false]]) {
        const fixture = setup(), context = fixture.unlock(), node = await start(fixture);
        context.currentTime += 3; fixture.state[key] = blocked; fixture.music.update();
        assert.equal(node.stopped, 1, key); assert.equal(fixture.music.position, 3, key);
        context.currentTime += 5; fixture.music.update(); assert.equal(fixture.music.playing, false, key);
        fixture.state[key] = resumed; fixture.music.update(); await flush();
        assert.equal(context.nodes.filter(item => item.kind === 'source').at(-1).offset, 3, key);
    }
});

test('the start screen and new race generations reset the song without overlapping sources', async () => {
    for (const reason of ['home', 'generation']) {
        const fixture = setup(), context = fixture.unlock(), old = await start(fixture);
        context.currentTime += 12;
        if (reason === 'home') fixture.state.screen = 'race-start';
        if (reason === 'generation') fixture.state.generation++;
        if (reason === 'mode') fixture.state.screen = 'race-start';
        fixture.music.update(); await flush();
        assert.equal(old.stopped, 1, reason);
        if (reason === 'home') { assert.equal(fixture.music.playing, false); fixture.state.screen = 'play'; fixture.music.update(); await flush(); }
        const next = context.nodes.filter(item => item.kind === 'source').at(-1);
        assert.equal(next.offset, 0, reason); assert.notEqual(next, old, reason);
    }
});

test('delayed decode cannot start music after pause, mute, home, generation change, focus loss or explicit cancellation', async () => {
    for (const reason of ['pause', 'mute', 'home', 'generation', 'mode', 'hidden', 'stop', 'disabled']) {
        const fixture = setup(), context = fixture.unlock(); fixture.music.update(); await flush();
        if (reason === 'pause') fixture.state.paused = true;
        if (reason === 'mute') fixture.state.isMuted = true;
        if (reason === 'home') fixture.state.screen = 'race-start';
        if (reason === 'generation') fixture.state.generation++;
        if (reason === 'mode') fixture.state.screen = 'race-start';
        if (reason === 'hidden') fixture.state.hidden = true;
        if (reason === 'stop') fixture.music.stop();
        if (reason === 'disabled') fixture.music.setEnabled(false);
        context.resolve(); await flush();
        assert.equal(fixture.music.playing, false, reason);
        assert.equal(context.nodes.filter(node => node.kind === 'source').length, 0, reason);
    }
});

test('resume during a delayed decode uses its cached result and creates only the newest request', async () => {
    const fixture = setup(), context = fixture.unlock(); fixture.music.update(); await flush();
    fixture.state.paused = true; fixture.music.update(); fixture.state.paused = false;
    fixture.music.update(); await flush(); assert.equal(context.decoding.length, 1);
    context.resolve(); await flush();
    assert.equal(context.nodes.filter(node => node.kind === 'source').length, 1);
    assert.equal(fixture.music.playing, true); assert.equal(fixture.music.pending, false);
});

test('corrupt embedded audio stays silent without repeated decode attempts or breaking gameplay', async () => {
    const fixture = setup(), context = fixture.unlock(); fixture.music.update(); await flush(); context.reject(); await flush();
    assert.equal(fixture.music.playing, false); assert.equal(fixture.music.pending, false);
    for (let i = 0; i < 10; i++) { fixture.music.update(); await flush(); }
    assert.equal(context.decoding.length, 1); assert.equal(context.nodes.filter(node => node.kind === 'source').length, 0);
    fixture.asset.data = ''; fixture.music.update(); await flush(); assert.equal(fixture.music.pending, false);
    assert.doesNotMatch(source, /fetch\(|https?:|setInterval|setTimeout|new AudioContext|\.resume\(/);
});

test('music-only enable control leaves narration and original effects untouched', async () => {
    const fixture = setup(), context = fixture.unlock(), old = await start(fixture);
    context.currentTime += 8; fixture.music.setEnabled(false);
    assert.equal(fixture.music.enabled, false); assert.equal(old.stopped, 1);
    assert.equal(fixture.audio.speaking, false); assert.equal(fixture.audio.effects.gain.value, 1);
    fixture.music.setEnabled(true); await flush();
    assert.equal(fixture.music.enabled, true); assert.equal(fixture.music.playing, true);
    assert.equal(context.nodes.filter(node => node.kind === 'source').at(-1).offset, 8);
});

test('a replacement context cannot revive an older pending decode', async () => {
    const fixture = setup(), firstContext = fixture.unlock(); fixture.music.update(); await flush();
    const secondContext = fixture.unlock(); fixture.music.update(); await flush();
    assert.equal(secondContext.decoding.length, 1);
    firstContext.resolve(); await flush();
    assert.equal(firstContext.nodes.filter(node => node.kind === 'source').length, 0);
    assert.equal(fixture.music.pending, true);
    secondContext.resolve(); await flush(); assert.equal(fixture.music.playing, true);
    assert.equal(secondContext.nodes.filter(node => node.kind === 'source').length, 1);
});

test('offline music catalogue embeds the supplied Thomas Theme recording as a valid WAV loop', { skip: !!process.env.THOMAS_MUSIC_SOURCE }, () => {
    const block = html.match(/<script\b[^>]*id=["']music-data["'][^>]*>([\s\S]*?)<\/script>/);
    assert.ok(block, 'the offline music catalogue is embedded in the standalone game');
    assert.doesNotMatch(html, /Sodor Railway Day|sodor-railway-day|original game instrumental/, 'the rejected substitute is no longer embedded');
    const asset = JSON.parse(block[1]);
    assert.ok(asset && asset.data, 'the supplied recording is bundled rather than awaiting an upload');
    assert.equal(asset.sourceFile, 'Thomas Theme.mp4');
    assert.equal(asset.title, 'Thomas Theme');
    assert.match(asset.sourceSha256, /^[a-f0-9]{64}$/, 'source provenance identifies the supplied file');
    assert.doesNotMatch(html, /<iframe\b|<audio\b[^>]*src=["']https?:/i, 'offline playback does not load a remote player');
    const bytes = Buffer.from(asset.data, 'base64');
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
    let format = null, pcm = null;
    for (let offset = 12; offset + 8 <= bytes.length;) {
        const kind = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4);
        assert.ok(offset + 8 + length <= bytes.length, 'WAV chunk fits inside the embedded file');
        if (kind === 'fmt ') format = bytes.subarray(offset + 8, offset + 8 + length);
        if (kind === 'data') pcm = bytes.subarray(offset + 8, offset + 8 + length);
        offset += 8 + length + (length % 2);
    }
    assert.ok(format && pcm && pcm.length > 0);
    assert.equal(format.readUInt16LE(0), 1); assert.equal(format.readUInt16LE(2), 1);
    assert.equal(format.readUInt32LE(4), 22050); assert.equal(format.readUInt16LE(14), 16);
    const duration = pcm.length / 2 / 22050;
    assert.ok(duration >= 20 && duration <= 180, 'a full musical loop rather than a short repeating sound effect');
    assert.ok(Math.abs(asset.duration - duration) < 0.001);
    assert.ok(asset.loopStart >= 0 && asset.loopEnd > asset.loopStart && asset.loopEnd <= duration);
    assert.ok(typeof asset.title === 'string' && asset.title.length > 0);
    let peak = 0;
    for (let offset = 0; offset < pcm.length; offset += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(offset)) / 32768);
    assert.ok(peak > 0.05 && peak <= 0.72, 'music contains sound with headroom for original effects and voice');
});
