

let audioCtx = null;
let noiseBuffer = null;
function ensureAudioContext() {
    if (!ui.audioUnlocked || state.isMuted || state.paused) return null;
    try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioClass) return null;
        if (!audioCtx) {
            audioCtx = new AudioClass();
            noiseBuffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 1.5), audioCtx.sampleRate);
            const samples = noiseBuffer.getChannelData(0);
            for (let i=0; i<samples.length; i++) samples[i] = Math.random()*2-1;
        }
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        return audioCtx;
    } catch (_) { return null; }
}
        // Classic Thomas Two-Tone High-Pitched "Peep! Peep!" Steam Whistle
        function playPeepPeepWhistle() {
            const ctx = ensureAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            const playSinglePeep = (startTime, duration) => {
                // A realistic steam whistle plays a rich chord. We use 4 detuned oscillators for that thick, brassy sound.
                const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Classic major chord)
                const masterGain = ctx.createGain();
                
                // Breath-like volume envelope
                masterGain.gain.setValueAtTime(0, startTime);
                masterGain.gain.linearRampToValueAtTime(0.35, startTime + 0.05); 
                masterGain.gain.setValueAtTime(0.35, startTime + duration - 0.1);
                masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                
                freqs.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    osc.type = i % 2 === 0 ? 'sine' : 'triangle';
                    
                    // Portamento: Pitch bend up at the very start to simulate steam pressure overblowing
                    osc.frequency.setValueAtTime(freq * 0.92, startTime);
                    osc.frequency.exponentialRampToValueAtTime(freq + (Math.random() * 6 - 3), startTime + 0.08);
                    
                    // LFO for natural air waver / vibrato
                    const lfo = ctx.createOscillator();
                    lfo.type = 'sine';
                    lfo.frequency.value = 5.5 + Math.random(); // ~5.5 Hz vibrato
                    const lfoGain = ctx.createGain();
                    lfoGain.gain.value = freq * 0.012; // Vibrato depth
                    
                    lfo.connect(lfoGain);
                    lfoGain.connect(osc.frequency);
                    lfo.start(startTime);
                    lfo.stop(startTime + duration);

                    osc.connect(masterGain);
                    osc.start(startTime);
                    osc.stop(startTime + duration);
                });
                
                // Rushing steam hiss layer
                if (noiseBuffer) {
                    const noise = ctx.createBufferSource();
                    noise.buffer = noiseBuffer;
                    
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(1400, startTime);
                    filter.frequency.linearRampToValueAtTime(2800, startTime + duration);
                    filter.Q.value = 0.6;

                    const noiseGain = ctx.createGain();
                    noiseGain.gain.setValueAtTime(0, startTime);
                    noiseGain.gain.linearRampToValueAtTime(0.18, startTime + 0.06);
                    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    noise.connect(filter);
                    filter.connect(noiseGain);
                    noiseGain.connect(masterGain);

                    noise.start(startTime);
                    noise.stop(startTime + duration);
                }

                masterGain.connect(ctx.destination);
            };

            // Two distinct, majestic blasts (first slightly shorter, second held out longer)
            playSinglePeep(now, 0.35);
            playSinglePeep(now + 0.42, 0.55);
        }

        // Rhythmic "Chugga" Steam Puff Sound synced to wheel rotation
        let chugBeat = 0;
        function playChugSound() {
            const ctx = ensureAudioContext();
            if (!ctx || !noiseBuffer) return;

            const now = ctx.currentTime;
            const isAccent = (chugBeat % 4 === 0);
            chugBeat++;
            
            // 1. Expanding Steam Hiss (White noise with sweeping lowpass filter)
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;

            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            // Accented chugs open the steam valve wider (higher frequency)
            noiseFilter.frequency.setValueAtTime(isAccent ? 3500 : 1800, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(400, now + 0.18);
            noiseFilter.Q.value = 0.8;

            const noiseGain = ctx.createGain();
            const peakVol = isAccent ? 0.35 : 0.18;
            noiseGain.gain.setValueAtTime(0, now);
            noiseGain.gain.linearRampToValueAtTime(peakVol, now + 0.02);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(now);
            noise.stop(now + 0.25);

            // 2. Metallic Cylinder/Piston Thump (Low frequency pitch-drop)
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(isAccent ? 140 : 100, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now);
            oscGain.gain.linearRampToValueAtTime(isAccent ? 0.5 : 0.25, now + 0.01);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(oscGain);
            oscGain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        }

        // Happy Star / Completion Chime
        function playStarChime(fanfare = false) {
            const ctx = ensureAudioContext();
            if (!ctx) return;

            const notes = fanfare ? [523.25, 659.25, 783.99, 1046.50] : [659.25, 880.0];
            notes.forEach((freq, idx) => {
                const start = ctx.currentTime + idx * 0.1;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, start);

                gain.gain.setValueAtTime(0.001, start);
                gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 0.36);
            });
        }

        // Bubble Pop / UI Tap Sound
        function playPopSound(baseFreq = 500) {
            const ctx = ensureAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.9, now + 0.09);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.1);
        }

        // Cow "Moo" / Sheep "Baa" / Boat Horn Synthesizer
        function playCharacterSound(type) {
            const ctx = ensureAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            if (type === 'cow') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(145, now);
                osc.frequency.linearRampToValueAtTime(185, now + 0.25);
                osc.frequency.linearRampToValueAtTime(130, now + 0.65);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.72);
            } else if (type === 'sheep') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.setValueAtTime(350, now + 0.08);
                osc.frequency.setValueAtTime(310, now + 0.16);
                osc.frequency.setValueAtTime(340, now + 0.24);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.45);
            } else if (type === 'docks') {
                // Deep foghorn / boat horn at Brendam Docks
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(110, now);
                gain.gain.setValueAtTime(0.16, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.62);
            }
        }



