#!/usr/bin/env python3
"""Render the game's original, gentle railway instrumental. No external audio."""
import argparse, base64, json, math, wave
from pathlib import Path
import numpy as np

RATE = 22050
BPM = 102
BEAT = 60 / BPM
BARS = 32
# Original phrases, in F major: no Thomas theme melody or recording is sampled.
PHRASES = [
 [(72,1),(69,.5),(67,.5),(65,1),(67,1)],
 [(69,1),(72,1),(74,.5),(72,.5),(69,1)],
 [(70,1),(67,1),(65,.5),(67,.5),(69,1)],
 [(67,1.5),(64,.5),(62,1),(60,1)],
 [(65,.5),(67,.5),(69,1),(72,1),(69,1)],
 [(67,1),(69,.5),(72,.5),(74,1),(72,1)],
 [(70,1),(69,1),(67,1),(64,1)],
 [(65,2),(None,1),(60,.5),(64,.5)],
]
CHORDS = [(53,57,60),(50,53,57),(46,50,53),(48,52,55),
          (53,57,60),(57,60,64),(46,50,53),(48,52,55)]


def voice(note, seconds, kind, phase):
    t = np.arange(max(1,round(seconds*RATE)), dtype=np.float64) / RATE
    f = 440 * 2 ** ((note-69)/12)
    if kind == 'flute':
        # Breath-like rounded fundamentals; mild vibrato arrives after the attack.
        vibrato = np.maximum(0,1-np.exp(-t*6)) * .0035 * np.sin(2*np.pi*4.7*t)
        cycles = 2*np.pi*f*np.cumsum(1+vibrato)/RATE
        sample = .9*np.sin(cycles)+.15*np.sin(2*cycles+.13)+.04*np.sin(3*cycles+.31)
        envelope = np.minimum(1,t/.05) * np.minimum(1,np.maximum(0,(seconds-t)/.12))
        sample *= envelope*(.93+.025*np.sin(2*np.pi*2.8*t))
    elif kind == 'pizz':
        sample = np.zeros_like(t)
        for harmonic in range(1,11):
            sample += np.sin(2*np.pi*f*harmonic*t+phase*harmonic)/(harmonic**1.3)*np.exp(-(5+harmonic*2.4)*t)
        sample *= np.minimum(1,t/.004)*np.minimum(1,np.maximum(0,(seconds-t)/.04))
    elif kind == 'piano':
        sample = sum(np.sin(2*np.pi*f*h*t+phase*h)/(h**1.7)*np.exp(-(1.8+h*.8)*t) for h in range(1,8))
        sample *= np.minimum(1,t/.007)*np.minimum(1,np.maximum(0,(seconds-t)/.08))
    elif kind == 'bell':
        sample = sum(np.sin(2*np.pi*f*h*t+phase)/(h**1.7)*np.exp(-(2+h)*t) for h in [1,2.76,5.4])
        sample *= np.minimum(1,t/.004)*np.minimum(1,np.maximum(0,(seconds-t)/.08))
    else:
        sample = np.sin(2*np.pi*f*t)+.15*np.sin(2*np.pi*f*2*t)+.045*np.sin(2*np.pi*f*3*t)
        sample *= np.minimum(1,t/.025)*np.minimum(1,np.maximum(0,(seconds-t)/.09))*np.exp(-t*1.8)
    return sample


def render():
    length = round(BARS*4*BEAT*RATE)
    mix = np.zeros(length, dtype=np.float64)
    def add(note, at, beats, kind, gain, variation=0):
        if note is None:return
        sample=voice(note,max(.15,beats*BEAT),kind,variation*.19)*gain
        start=round(at*BEAT*RATE)%length
        indices=(np.arange(len(sample))+start)%length
        np.add.at(mix,indices,sample)
    for bar in range(BARS):
        section=bar//8
        chord=CHORDS[bar%8]
        phrase=PHRASES[bar%8]
        # The second and third phrases change register and orchestration; the
        # last returns gently to the opening so the loop has a clear shape.
        transpose=0 if section in (0,3) else -12 if section==1 else 0
        melody_time=bar*4
        for n,duration in phrase:
            add(None if n is None else n+transpose,melody_time,duration*.87,'flute',.21 if section!=2 else .17,bar)
            if section==2 and n is not None:add(n,melody_time,duration*1.06,'piano',.075,bar)
            melody_time+=duration
        for beat in range(4):
            bass=chord[0]-12 if beat%2==0 else chord[2]-12
            add(bass,bar*4+beat,.58,'bass',.14,bar)
            for index,n in enumerate(chord):
                add(n+12,bar*4+beat+.5+index*.024,.45,'pizz',.055,bar+index)
        if section==1:
            for n in chord:add(n+12,bar*4,2.7,'piano',.032,bar)
        if bar%4==3:
            add(phrase[0][0]+12,bar*4+3.5,1.3,'bell',.035,bar)
    # A small room tail wraps across the loop boundary, avoiding a hard join.
    dry=mix.copy()
    for seconds,gain in [(0.043,.06),(.079,.035),(.131,.02)]:
        mix+=np.roll(dry,round(seconds*RATE))*gain
    mix=(mix+np.roll(mix,1)+np.roll(mix,2))/3
    mix=np.tanh(mix*.9)
    mix*=.64/max(.01,float(np.max(np.abs(mix))))
    return np.round(mix*32767).astype('<i2')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--wav',type=Path,default=Path('audio/sodor-railway-day.wav'))
    parser.add_argument('--json',type=Path,default=Path('/private/tmp/thomas-tunnel-music/music-data.json'))
    args=parser.parse_args()
    samples=render();args.wav.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(args.wav),'wb') as out:
        out.setnchannels(1);out.setsampwidth(2);out.setframerate(RATE);out.writeframes(samples.tobytes())
    asset={'title':'Sodor Railway Day — original game instrumental','composer':'Original composition for this game',
        'description':'Gentle flute, pizzicato strings, warm piano and bass; no official Thomas melody or recording.',
        'sampleRate':RATE,'duration':len(samples)/RATE,'loopStart':0,'loopEnd':len(samples)/RATE,
        'data':base64.b64encode(args.wav.read_bytes()).decode()}
    args.json.write_text(json.dumps(asset,ensure_ascii=False,separators=(',',':')))
    print(f'Rendered {asset["duration"]:.2f}s original mono loop; peak {np.max(np.abs(samples.astype(np.int32)))/32767:.3f}; loop join {abs(int(samples[-1])-int(samples[0]))/32767:.5f}')

if __name__=='__main__':main()
