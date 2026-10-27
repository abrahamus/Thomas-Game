#!/usr/bin/env python3
"""Prepare the two credited CC0 field recordings for offline train playback.

No synthetic audio is generated. Source MP3s stay alongside the edited WAVs.
The HTML embedding is handled by the main game build/integration step.
"""
import argparse
import base64
import hashlib
import json
import pathlib
import subprocess
import tempfile
import wave

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
RATE = 22050
SOURCES = {
    'rolling': {
        'sourceFile': 'running-wheels-source.mp3',
        'title': 'Train Wheels Clacking', 'creator': 'craigsmith',
        'source': 'https://freesound.org/people/craigsmith/sounds/480813/',
        'download': 'https://cdn.freesound.org/previews/480/480813_2524442-hq.mp3',
        'license': 'CC0 1.0', 'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
    'chuff': {
        'sourceFile': 'running-steam-source.mp3',
        'title': 'Single Steam Train Chuff', 'creator': 'birdOfTheNorth',
        'originalRecording': 'Steam Train by keithpeter (Freesound 125211), also CC0',
        'source': 'https://freesound.org/people/birdOfTheNorth/sounds/623817/',
        'download': 'https://cdn.freesound.org/previews/623/623817_12923717-hq.mp3',
        'license': 'CC0 1.0', 'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
}


def read_source(ffmpeg, source, destination):
    subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(source), '-ac', '1', '-ar', str(RATE),
                    '-af', 'highpass=f=45,lowpass=f=5800', str(destination)], check=True)
    with wave.open(str(destination)) as wav:
        return np.frombuffer(wav.readframes(wav.getnframes()), '<i2').astype(np.float64) / 32768


def prepare(kind, samples):
    if kind == 'rolling':
        # A steady 24-second section, joined with a 120 ms equal-gain crossfade.
        # Rotating the crossfade to the front makes the file wrap continuous.
        samples = samples[4 * RATE:28 * RATE].copy()
        length = round(.12 * RATE)
        blend = np.linspace(0, 1, length)
        samples = np.concatenate([samples[-length:] * (1 - blend) + samples[:length] * blend,
                                  samples[length:-length]])
        notes = '4–28 s steady rail section; 45 Hz high-pass/5800 Hz low-pass; 120 ms periodic crossfade; peak normalized.'
        peak = .68
    else:
        # Keep the recorded attack and body; the browser envelopes a shorter portion
        # at high wheel speeds instead of changing its pitch or overlapping tails.
        samples = samples[round(.055 * RATE):round(.395 * RATE)].copy()
        start, end = round(.006 * RATE), round(.022 * RATE)
        samples[:start] *= np.linspace(0, 1, start)
        samples[-end:] *= np.linspace(1, 0, end)
        notes = '0.055–0.395 s recorded steam attack/body; 45 Hz high-pass/5800 Hz low-pass; 6/22 ms fades; peak normalized.'
        peak = .72
    samples *= peak / np.max(np.abs(samples))
    return np.round(samples * 32767).astype('<i2'), notes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', default='/Applications/Downie 4.app/Contents/Resources/ffmpeg')
    parser.add_argument('--catalogue', type=pathlib.Path, required=True)
    args = parser.parse_args()
    catalogue, credits = {}, {}
    with tempfile.TemporaryDirectory(prefix='thomas-running-') as temp:
        for kind, source in SOURCES.items():
            source_path = ROOT / 'audio' / source['sourceFile']
            raw = read_source(args.ffmpeg, source_path, pathlib.Path(temp) / f'{kind}.wav')
            pcm, notes = prepare(kind, raw)
            output = ROOT / 'audio' / f'running-{kind}.wav'
            with wave.open(str(output), 'wb') as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(RATE)
                wav.writeframes(pcm.tobytes())
            asset = {**source, 'sampleRate': RATE, 'duration': len(pcm) / RATE,
                     'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
                     'editing': notes}
            if kind == 'rolling':
                asset.update(loopStart=0, loopEnd=asset['duration'])
            values = pcm.astype(float) / 32768
            asset['peak'] = float(np.max(np.abs(values)))
            asset['rms'] = float(np.sqrt(np.mean(values * values)))
            credits[kind] = {**asset, 'embeddedFile': output.name}
            catalogue[kind] = {**asset, 'data': base64.b64encode(output.read_bytes()).decode()}
    (ROOT / 'audio' / 'running-credits.json').write_text(json.dumps(credits, indent=2) + '\n')
    args.catalogue.write_text(json.dumps(catalogue, separators=(',', ':')) + '\n')
    print(json.dumps(credits, indent=2))


if __name__ == '__main__':
    main()
