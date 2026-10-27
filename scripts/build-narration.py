#!/usr/bin/env python3
"""Bake slow, child-friendly narration into the offline game.

This build step uses the online Edge speech service through edge-tts. Gameplay
uses only the finished embedded WAV clips and makes no network requests. Install
edge-tts in the build environment, or pass --tts-module-dir for a local install.
The voice is an original synthetic narrator, not a recording of a Thomas actor.
Use --embed to replace narration-data after all clips have been validated.
"""
import argparse
import asyncio
import base64
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "thomas_the_tank_engine_island_of_sodor_adventure.html"
VOICE = "en-US-AnaNeural"
COMMON = {}

COMMON.update({
    "ui.sticker.driver": "Really useful driver. Well done!",
    "ui.sticker.apple-delivery": "Apple delivery. Well done!",
    "ui.sticker.race-finisher": "You finished a race. Well done!",
    "ui.sticker.race-winner": "You won a race. Well done!",
    "ui.sticker.meet-friends": "You met Percy and James.",
    "ui.sticker.wash-visit": "You met James and Toby.",
    "ui.sticker.fallen-tree": "You went around the fallen tree.",
    "ui.sticker.closed-bridge": "You found an open track.",
    "ui.sticker.find-james": "You found James.",
    "ui.sticker.find-toby": "You found Toby."
})


def load_catalogue(core_path, html_path, ui_catalogue=None):
    if core_path:
        source = Path(core_path).read_text()
    else:
        html = html_path.read_text()
        match = re.search(r'<script\b[^>]*id=[\"\']race-core[\"\'][^>]*>([\s\S]*?)</script>', html)
        if not match:
            raise SystemExit("Cannot find the inline race-core script.")
        source = match.group(1)
    evaluator = (
        "const fs=require('node:fs'),vm=require('node:vm');"
        "const box=vm.createContext({});vm.runInContext(fs.readFileSync(0,'utf8'),box);"
        "process.stdout.write(JSON.stringify({narration:box.ThomasRaceCore.NARRATION}));"
    )
    result = subprocess.run(["node", "-e", evaluator], input=source, text=True, capture_output=True, check=True)
    catalogue = json.loads(result.stdout)["narration"]
    if not isinstance(catalogue, dict) or not catalogue:
        raise SystemExit("The model must export a non-empty ThomasRaceCore.NARRATION catalogue.")
    if ui_catalogue:
        ui = json.loads(Path(ui_catalogue).read_text())
    else:
        # A normal rebuild must retain the game's spoken picture-button labels too.
        current_html = html_path.read_text()
        ui_match = re.search(r'<script\b[^>]*id=[\"\']ui-narration-data[\"\'][^>]*>([\s\S]*?)</script>', current_html)
        ui = json.loads(ui_match.group(1)) if ui_match else {}
    merged = {**COMMON, **catalogue, **ui}
    if not all(isinstance(key, str) and isinstance(text, str) and text.strip() for key, text in merged.items()):
        raise SystemExit("Every narration key must contain a non-empty spoken phrase.")
    return merged


def verify_wav(path):
    with wave.open(str(path), "rb") as audio:
        if audio.getnchannels() != 1 or audio.getframerate() != 22050 or audio.getsampwidth() != 2:
            raise ValueError(f"Unexpected audio format: {path}")
        duration = audio.getnframes() / audio.getframerate()
        pcm = audio.readframes(audio.getnframes())
        if not pcm or not any(pcm) or not 0.2 < duration < 45:
            raise ValueError(f"Empty or implausibly long narration: {path}")
    return round(duration, 3)


def convert_clip(source, destination, ffmpeg=None):
    """Decode build-time speech without depending on one host's codec support."""
    converter = Path("/usr/bin/afconvert")
    if converter.exists():
        result = subprocess.run([str(converter), str(source), str(destination), "-f", "WAVE", "-d", "LEI16@22050", "-c", "1", "--no-filler"], capture_output=True)
        if result.returncode == 0:
            return
    alternative = str(ffmpeg) if ffmpeg else shutil.which("ffmpeg")
    if not alternative:
        raise RuntimeError("Speech decoding failed. Supply --ffmpeg, or install ffmpeg. Existing embedded narration remains unchanged.")
    subprocess.run([alternative, "-nostdin", "-v", "error", "-y", "-i", str(source), "-ac", "1", "-ar", "22050", "-c:a", "pcm_s16le", str(destination)], check=True, capture_output=True)


async def build_clips(args, catalogue):
    try:
        import edge_tts
    except ImportError as error:
        raise SystemExit("Install edge-tts, or supply --tts-module-dir. Existing game audio remains unchanged.") from error
    language = "-".join(args.voice.split("-")[:2])
    args.clips.mkdir(parents=True, exist_ok=True)
    assets, generated = {}, {}
    with tempfile.TemporaryDirectory(prefix="thomas-speech-") as directory:
        temporary = Path(directory)
        for key, text in catalogue.items():
            if text not in generated:
                # Voice, pace, and words form the cache key; old Daniel clips cannot leak into a rebuild.
                digest = hashlib.sha256(f"{args.voice}:{args.rate}:22050:{text}".encode()).hexdigest()[:16]
                wav_path = args.clips / f"{digest}.wav"
                cached = False
                if wav_path.exists():
                    try:
                        verify_wav(wav_path)
                        cached = True
                    except (ValueError, wave.Error):
                        wav_path.unlink()
                if not cached:
                    mp3_path = temporary / "phrase.mp3"
                    try:
                        await edge_tts.Communicate(text, args.voice, rate=args.rate).save(str(mp3_path))
                    except Exception as error:
                        raise RuntimeError(f"Could not generate {key}. Existing embedded audio is unchanged: {error}") from error
                    convert_clip(mp3_path, wav_path, args.ffmpeg)
                duration = verify_wav(wav_path)
                generated[text] = {"text": text, "data": base64.b64encode(wav_path.read_bytes()).decode(),
                    "duration": duration, "voice": args.voice, "language": language, "rate": args.rate}
            assets[key] = generated[text]
    return assets, generated


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, default=GAME)
    parser.add_argument("--core", type=Path, help="Read a standalone model instead of the HTML's game-core.")
    parser.add_argument("--ui-catalogue", type=Path, help="Additional spoken labels and menu instructions as a JSON object.")
    parser.add_argument("--output", type=Path, default=Path("/private/tmp/thomas-narration.json"))
    parser.add_argument("--clips", type=Path, default=Path("/private/tmp/thomas-narration-clips"))
    parser.add_argument("--voice", default=VOICE, help="Online neural narrator voice (default: %(default)s).")
    parser.add_argument("--rate", default="-25%", help="Voice pace, for example --rate=-25%%.")
    parser.add_argument("--tts-module-dir", type=Path, help="Optional directory containing an installed edge_tts module.")
    parser.add_argument("--ffmpeg", type=Path, help="Optional ffmpeg executable when the host speech decoder is unavailable.")
    parser.add_argument("--embed", action="store_true", help="Replace the HTML's existing narration-data script.")
    args = parser.parse_args()
    if args.tts_module_dir:
        sys.path.insert(0, str(args.tts_module_dir.resolve()))
    if not Path("/usr/bin/afconvert").exists() and not args.ffmpeg and not shutil.which("ffmpeg"):
        raise SystemExit("Narration baking requires afconvert or ffmpeg. Existing embedded clips remain usable.")
    catalogue = load_catalogue(args.core, args.html, args.ui_catalogue)
    assets, generated = asyncio.run(build_clips(args, catalogue))
    encoded = json.dumps(assets, ensure_ascii=False, separators=(",", ":"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(encoded)
    if args.embed:
        html = args.html.read_text()
        pattern = r'(<script\b[^>]*id=[\"\']narration-data[\"\'][^>]*>)[\s\S]*?(</script>)'
        replacement, count = re.subn(pattern, lambda match: match.group(1) + encoded.replace("</", "<\\/") + match.group(2), html)
        if count != 1:
            raise SystemExit("Cannot find exactly one narration-data script; JSON was saved but HTML was not modified.")
        args.html.write_text(replacement)
    print(f"Built {len(assets)} narration keys from {len(generated)} {args.voice} clips at {args.rate} ({sum(item['duration'] for item in generated.values()):.1f}s); saved {args.output}.")


if __name__ == "__main__":
    main()
