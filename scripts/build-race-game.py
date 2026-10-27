#!/usr/bin/env python3
"""Refresh the standalone game and GitHub Pages entry; playing remains offline."""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "thomas_the_tank_engine_island_of_sodor_adventure.html"
INDEX = ROOT / "index.html"


def embed(html, script_id, source):
    safe = re.sub(r"</script", r"<\/script", source, flags=re.I)
    pattern = r'(<script\b[^>]*\bid=["\']' + re.escape(script_id) + r'["\'][^>]*>)[\s\S]*?(</script>)'
    result, count = re.subn(pattern, lambda match: match[1] + safe + match[2], html)
    if count != 1:
        raise ValueError(f"Expected one existing {script_id} script; game was not changed.")
    return result


def catalogue(html, script_id):
    pattern = r'<script\b[^>]*\bid=["\']' + script_id + r'["\'][^>]*>([\s\S]*?)</script>'
    return json.loads(re.search(pattern, html)[1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, default=GAME)
    parser.add_argument("--check", action="store_true", help="Check embedded sources and the Pages entry without writing.")
    args = parser.parse_args()
    original = args.html.read_text()
    updated = original
    for script_id, path in [("race-core", "scripts/race-model.js"),
                            ("game-core", "scripts/game-shell.js"),
                            ("game-runtime", "scripts/game-runtime.js"),
                            ("three-vendor", "vendor/three-r170.js"),
                            ("race-view", "scripts/race-renderer.js")]:
        updated = embed(updated, script_id, (ROOT / path).read_text())
    clips = json.loads((ROOT / "audio/race-narration.json").read_text())
    narration = catalogue(updated, "narration-data")
    # Only race guidance, shared controls, and saved sticker labels remain.
    shared = {"ui.home", "ui.pause", "ui.paused", "ui.resume", "ui.repeat",
              "ui.sound-on", "ui.sound-off", "ui.music-on", "ui.music-off",
              "ui.album", "ui.album.open", "ui.album.empty", "ui.close-album", "ui.whistle"}
    keep = lambda key: key in clips or key in shared or key.startswith("ui.sticker.")
    narration = {key: value for key, value in narration.items() if keep(key)}
    narration.update(clips)
    labels = {key: value for key, value in catalogue(updated, "ui-narration-data").items() if keep(key)}
    labels.update({key: clip["text"] for key, clip in clips.items()})
    for script_id, entries in [("narration-data", narration), ("ui-narration-data", labels)]:
        updated = embed(updated, script_id, json.dumps(entries, ensure_ascii=False, separators=(",", ":")))
    if args.check:
        if updated != original:
            raise SystemExit("Embedded race assets differ from their editable sources.")
        if args.html.resolve() == GAME.resolve():
            if not INDEX.exists() or INDEX.read_text() != updated:
                raise SystemExit("index.html is missing or outdated. Run python3 scripts/build-race-game.py.")
        print("Embedded race modules and narration match their sources; the selected build is current.")
        return
    targets = [args.html]
    if args.html.resolve() == GAME.resolve():
        targets.append(INDEX)
    for target in targets:
        temporary = target.with_name("." + target.name + ".race-build")
        temporary.write_text(updated)
        temporary.replace(target)
    print("Updated game build: " + ", ".join(str(target) for target in targets))


if __name__ == "__main__":
    main()
