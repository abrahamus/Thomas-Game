#!/usr/bin/env node
/* Render the game's actual Web Audio graph without a browser.
 * Optional development dependency: npm install --prefix /tmp/thomas-audio-render web-audio-engine
 * node scripts/render-audio-check.cjs --engine /tmp/thomas-audio-render/node_modules/web-audio-engine \
 *   --stage-dir /tmp/thomas-natural-upgrade --before /tmp/thomas-natural-upgrade/before.html --out /tmp/audio-checks
 * Without --stage-dir, reads the self-contained HTML (override with --html).
 * This checks DSP/scheduling, and is not a claim of live browser verification.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
    if (!args[i]?.startsWith('--') || !args[i + 1]) throw new Error(`Expected --option value: ${args[i]}`);
    options[args[i].slice(2)] = args[i + 1];
}
let Engine;
try { Engine = require(options.engine || 'web-audio-engine'); }
catch (_) { throw new Error('Install optional web-audio-engine outside the game, or supply --engine /absolute/path/to/web-audio-engine'); }
const root = path.join(__dirname, '..'), output = path.resolve(options.out || '/tmp/thomas-audio-checks');
fs.mkdirSync(output, { recursive: true });
const html = options['stage-dir'] ? null : fs.readFileSync(options.html || path.join(root, 'thomas_the_tank_engine_island_of_sodor_adventure.html'), 'utf8');
function inline(document, id) {
    const result = document.match(new RegExp(`<script\\b[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`));
    if (!result) throw new Error(`Missing script ${id}`);
    return result[1];
}
function section(id) {
    if (html) return inline(html, id);
    return fs.readFileSync(path.join(options['stage-dir'], id + (id.endsWith('-data') ? '.json' : '.js')), 'utf8');
}
const sources = { core: section('game-core'), audio: section('game-audio'), music: section('game-music') };
const assets = JSON.parse(section('running-audio-data'));
const narration = JSON.parse(section('narration-data'));
const musicAsset = JSON.parse(section('music-data'));
const rate = 22050, fps = 60, dt = 1 / fps;
const flush = () => new Promise(resolve => setImmediate(resolve));
const metrics = values => {
    let peak = 0, squares = 0, clipped = 0;
    for (const value of values) { peak = Math.max(peak, Math.abs(value)); squares += value * value; if (Math.abs(value) >= 1) clipped++; }
    const rms = Math.sqrt(squares / Math.max(1, values.length));
    return { peak, rms, rmsDb: rms ? 20 * Math.log10(rms) : null, clippedSamples: clipped, duration: values.length / rate };
};
const slice = (data, start, end) => data.channelData[0].slice(Math.floor(start * rate), Math.floor(end * rate));
async function save(name, data, context) {
    const wav = await context.encodeAudioData(data, { bitDepth: 16 });
    fs.writeFileSync(path.join(output, name + '.wav'), Buffer.from(wav));
}
async function render({ name, gear = 4, seconds = 13, brakeAt = 10, mixture = false, beforeSource = null, musicOnly = false, voiceOnly = false, whistleOnly = false, noRunning = false }) {
    const contexts = [];
    class AudioContext extends Engine.RenderingAudioContext {
        constructor() { super({ sampleRate: rate, numberOfChannels: 1, blockSize: 128 }); contexts.push(this); }
    }
    const box = vm.createContext({ window: { AudioContext }, Uint8Array, ThomasNarration: narration,
        atob: value => Buffer.from(value, 'base64').toString('binary') });
    vm.runInContext(`let randomSeed=12345;Math.random=()=>{randomSeed=(1664525*randomSeed+1013904223)>>>0;return randomSeed/4294967296;};`, box);
    vm.runInContext(sources.core, box);
    vm.runInContext(beforeSource || sources.audio, box);
    vm.runInContext(sources.music, box);
    const game = box.ThomasGameCore.createGame(null, () => .37), state = game.state;
    game.dispatch('start-freeplay'); state.isMuted = false; state.musicEnabled = mixture || musicOnly;
    let music;
    const audio = box.ThomasAudio.create({ getState: () => state, getGeneration: () => state.generation,
        runningAssets: beforeSource ? null : assets, onSpeaking: () => { if (music) music.update(); } });
    audio.unlock(); const context = contexts[0]; await context.resume();
    music = box.ThomasMusic.create({ getContext: () => context, getOutput: () => audio.masterBus,
        getState: () => state, getGeneration: () => state.generation, getAsset: () => musicAsset,
        isSpeaking: () => audio.speaking });
    for (let i = 0; i < gear; i++) game.dispatch('accelerate');
    if (beforeSource && !musicOnly && !voiceOnly) audio.effect('chug');
    let distanceForChug = 0, didBrake = false, didVoice = false, didWhistle = false;
    const events = [];
    for (let frame = 0; frame < Math.round(seconds * fps); frame++) {
        // RenderingAudioContext deliberately suspends after processTo; restore its
        // running state before invoking the unchanged browser player on the next frame.
        await context.resume();
        const time = frame * dt;
        if (!didBrake && time >= brakeAt) { for (let i = 0; i < gear; i++) game.dispatch('brake'); didBrake = true; events.push({ time, action: 'brake to stop' }); }
        if ((mixture || voiceOnly) && !didVoice && time >= 6) {
            const key = 'challenge.signal.approach';
            if (!narration[key]) throw new Error(`Missing voice ${key}`);
            audio.speak(key); didVoice = true; events.push({ time, action: 'Ana', text: narration[key].text });
        }
        if ((mixture || whistleOnly) && !didWhistle && time >= 6.5) { audio.effect('whistle'); didWhistle = true; events.push({ time, action: 'whistle' }); }
        const previous = state.distance; game.step(dt);
        if (beforeSource) {
            distanceForChug += state.distance - previous;
            if (distanceForChug >= 42) { distanceForChug %= 42; audio.effect('chug'); }
            audio.update(dt);
        } else audio.update(dt, { distance: state.distance, velocity: state.velocity, targetVelocity: state.targetVelocity,
            wheelTurns: state.distance * .35 / (2 * Math.PI * 24.975), isActive: !musicOnly && !voiceOnly && !whistleOnly && !noRunning });
        music.update();
        // Decode the actual embedded PCM and settle narration/music cancellation promises.
        await flush(); await flush();
        context.processTo((frame + 1) * dt);
    }
    const data = context.exportAsAudioData();
    await save(name, data, context);
    const clippedTimes = []; data.channelData[0].forEach((value, index) => { if (Math.abs(value) >= 1 && clippedTimes.length < 20) clippedTimes.push(index / rate); });
    const report = { file: name + '.wav', ...metrics(data.channelData[0]), clippedTimes, settled: metrics(slice(data, 6, Math.min(9, seconds))), events };
    audio.stop(); music.stop();
    return { data, report, context };
}
async function main() {
    const results = {}, audition = [];
    if (options.before) {
        results.before = await render({ name: 'before-full-speed', beforeSource: inline(fs.readFileSync(options.before, 'utf8'), 'game-audio') });
        audition.push({ label: 'Previous synthetic full-speed running sound', values: slice(results.before.data, 6, 9) });
    }
    for (let gear = 1; gear <= 4; gear++) {
        results['gear' + gear] = await render({ name: 'recorded-gear-' + gear, gear });
        audition.push({ label: `Recorded running: gear ${gear}`, values: slice(results['gear' + gear].data, 6, 9) });
    }
    results.loop = await render({ name: 'recorded-full-speed-loop', seconds: 33, brakeAt: Infinity });
    results.mix = await render({ name: 'full-speed-music-Ana-whistle', mixture: true, seconds: 14, brakeAt: 11 });
    results.existingMix = await render({ name: 'music-Ana-whistle-without-running', mixture: true, noRunning: true, seconds: 14, brakeAt: 11 });
    results.music = await render({ name: 'music-reference', musicOnly: true, seconds: 10, brakeAt: Infinity });
    results.voice = await render({ name: 'Ana-reference', voiceOnly: true, seconds: 10, brakeAt: Infinity });
    results.whistle = await render({ name: 'original-whistle-reference', whistleOnly: true, seconds: 10, brakeAt: Infinity });
    audition.push({ label: 'Recorded full-speed braking to a stop', values: slice(results.gear4.data, 9.5, 13) });
    audition.push({ label: 'Recorded full-speed running with supplied music, Ana, and whistle', values: slice(results.mix.data, 5.5, 11.5) });
    const silence = new Float32Array(Math.round(.35 * rate)), length = audition.reduce((n, clip) => n + clip.values.length + silence.length, 0);
    const combined = new Float32Array(length); let offset = 0;
    const order = audition.map(clip => {
        combined.set(clip.values, offset);
        const item = { start: offset / rate, end: (offset + clip.values.length) / rate, label: clip.label };
        offset += clip.values.length + silence.length; return item;
    });
    await save('listening-comparison', { sampleRate: rate, channelData: [combined], numberOfChannels: 1, length }, results.mix.context);
    // Source-level join check uses exact PCM, independently of the rendered program mix.
    const bytes = Buffer.from(assets.rolling.data, 'base64'), array = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const decoded = await results.loop.context.decodeAudioData(array), values = decoded.getChannelData(0);
    const join = Math.abs(values[0] - values[values.length - 1]);
    const report = { renderer: 'web-audio-engine actual ThomasGameCore/ThomasAudio/ThomasMusic modules; mono 22050 Hz PCM',
        limitations: 'Offline DSP, not a native browser or a claim of subjective listening.',
        sources: Object.fromEntries(Object.entries(assets).map(([key, asset]) => [key, { source: asset.source, license: asset.license, duration: asset.duration }])),
        rollingJoinJump: join, listeningOrder: order,
        scenarios: Object.fromEntries(Object.entries(results).map(([name, result]) => [name, result.report])) };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ output, rollingJoinJump: join, listeningOrder: order, scenarios: report.scenarios }, null, 2));
    if (Object.entries(results).some(([name, result]) => name !== 'before' && result.report.clippedSamples > 0)) {
        console.error('WARNING: a current mix contains clipped float samples; inspect report before shipping.');
        process.exitCode = 2;
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
