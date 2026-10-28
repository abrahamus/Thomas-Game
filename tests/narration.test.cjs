const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(process.env.THOMAS_HTML_SOURCE || path.join(__dirname, '..', 'thomas_the_tank_engine_island_of_sodor_adventure.html'), 'utf8');
function inline(id) {
    const match = html.match(new RegExp(`<script\\b[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`));
    assert.ok(match, `inline ${id} exists`);
    return match[1];
}
const box = vm.createContext({});
vm.runInContext(inline('race-core'), box);
vm.runInContext(inline('game-core'), box);
const model = box.ThomasGameCore.NARRATION;
const ui = JSON.parse(inline('ui-narration-data'));
const clips = JSON.parse(inline('narration-data'));
const hardwareWords = /\b(?:press|tap|space|enter|arrows?|buttons?|keys?|left|right)\b/i;

test('every spoken phrase describes the action without naming keys or buttons', () => {
    assert.ok(Object.keys(clips).length>=70 && Object.keys(clips).every(key=>/^(race|ui|sticker)\./.test(key)), 'Only race, shared controls, and saved album recordings remain');
    for (const [key, clip] of Object.entries(clips)) {
        assert.ok(clip.text.trim(), key);
        assert.doesNotMatch(clip.text, hardwareWords, key);
    }
    for (const [key, text] of Object.entries({ ...model, ...ui })) {
        assert.doesNotMatch(text, hardwareWords, key);
        assert.equal(clips[key]?.text, text, `${key}: embedded narration and browser fallback use the same words`);
    }
});

test('all picture-button narration has a matching slow Ana recording', () => {
    const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
    for (const match of markup.matchAll(/\bdata-narration=["']([^"']+)["']/g)) {
        const key = match[1];
        assert.ok(clips[key]?.data, `${key}: picture has embedded speech`);
    }
    for (const [key, clip] of Object.entries(clips)) {
        assert.equal(clip.voice, 'en-US-AnaNeural', key);
        assert.equal(clip.language, 'en-US', key);
        assert.equal(clip.rate, '-25%', key);
        const bytes = Buffer.from(clip.data, 'base64');
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', key);
        assert.equal(bytes.toString('ascii', 8, 12), 'WAVE', key);
    }
});

test('screen reader labels and live status also avoid spoken key instructions', () => {
    const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
    for (const match of markup.matchAll(/\baria-(?:label|description)=["']([^"']*)["']/g)) {
        assert.doesNotMatch(match[1], hardwareWords, match[0]);
    }
    const runtime = inline('game-runtime');
    for (const old of ['↓ Stop · Space Peep!', 'Enter scrubs.', 'Press Enter to try again.', 'One tap changes one gear.']) {
        assert.ok(!runtime.includes(old), `obsolete live text removed: ${old}`);
    }
    for (const shortcut of ['Space', 'Enter']) {
        assert.ok(markup.includes(`aria-keyshortcuts="${shortcut}"`), `${shortcut} shortcut remains available separately`);
    }
});
