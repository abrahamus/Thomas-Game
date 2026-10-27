#!/usr/bin/env python3
"""Build the race's slow Ana recordings without editing the playable HTML.

The race model owns its spoken catalogue. This helper adds the race-only album
instruction and renderer-unavailable message, then reuses the established speech
builder. Only this build step needs the online Edge speech service; finished WAV
recordings are embedded for offline play by the game assembly step.
"""
import argparse
import asyncio
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRA = {
    "race.unavailable": "The race cannot start in this browser. Please try another browser.",
    "ui.album.empty": "Finish a race to earn your first sticker.",
}

HARDWARE_WORDS = re.compile(r"\b(?:press|tap|space|enter|arrows?|buttons?|keys?|left|right)\b", re.I)


def speech_builder():
    spec = importlib.util.spec_from_file_location("thomas_speech_builder", ROOT / "scripts/build-narration.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_catalogue(model):
    evaluator = ("const fs=require('node:fs'),vm=require('node:vm'),box={};"
                 "vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),box);"
                 "process.stdout.write(JSON.stringify(box.ThomasRaceCore.NARRATION));")
    result = subprocess.run(["node", "-e", evaluator, str(model.resolve())], capture_output=True, text=True, check=True)
    catalogue = {**json.loads(result.stdout), **EXTRA}
    if not catalogue or not all(isinstance(text, str) and text.strip() for text in catalogue.values()):
        raise ValueError("Every race narration key must have a spoken phrase.")
    for key, text in catalogue.items():
        if HARDWARE_WORDS.search(text):
            raise ValueError(f"{key} contains hardware instructions instead of an action: {text}")
    return catalogue


def seed_valid_cache(builder, args, catalogue):
    """Reuse identical Ana recordings, with voice/rate/content in their cache key."""
    if not args.cache or not args.cache.is_dir():
        return
    args.clips.mkdir(parents=True, exist_ok=True)
    for text in set(catalogue.values()):
        digest = hashlib.sha256(f"{args.voice}:{args.rate}:22050:{text}".encode()).hexdigest()[:16]
        source, destination = args.cache / f"{digest}.wav", args.clips / f"{digest}.wav"
        if source.is_file() and not destination.exists():
            builder.verify_wav(source)
            shutil.copyfile(source, destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=ROOT / "scripts/race-model.js")
    parser.add_argument("--output", type=Path, default=ROOT / "audio/race-narration.json")
    parser.add_argument("--clips", type=Path, default=ROOT / "audio/race-narration-clips")
    parser.add_argument("--cache", type=Path, help="An existing voice/rate/content-addressed narration WAV cache.")
    parser.add_argument("--voice", default="en-US-AnaNeural")
    parser.add_argument("--rate", default="-25%")
    parser.add_argument("--tts-module-dir", type=Path)
    parser.add_argument("--ffmpeg", type=Path)
    args = parser.parse_args()
    if args.tts_module_dir:
        sys.path.insert(0, str(args.tts_module_dir.resolve()))
    builder = speech_builder()
    catalogue = load_catalogue(args.model)
    seed_valid_cache(builder, args, catalogue)
    assets, unique = asyncio.run(builder.build_clips(args, catalogue))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(assets, ensure_ascii=False, separators=(",", ":")))
    print(f"Built {len(assets)} race/menu keys from {len(unique)} slow Ana clips; saved {args.output}.")


if __name__ == "__main__":
    main()
