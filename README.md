# Thomas’s Sodor Races

Open `index.html` locally in a browser with WebGL enabled. The original `thomas_the_tank_engine_island_of_sodor_adventure.html` entry also works. The game now contains **3D Race only**. Choose both racers in the **You** and **Computer** portrait panels: **Thomas, Percy, James, Bertie, Toby, Spencer, Emily, Diesel, Bulgy, Harold**, or **Random**. Each panel shows only the selected portrait and name. Activate it to open a scrollable dropdown; choosing a racer closes the list. The Race button stays outside the scrolling lists. The racers must be different; a named choice becomes unavailable in the other panel, with an explanation. Fresh installations start with Thomas versus Random. Choose racers returns to these panels with both preferences remembered; Rematch repeats the same resolved race. The two former 2D games, their screens, driving logic, and unused embedded narration/artwork have been removed. The filename and saved-progress key remain compatible.

Everything needed for play is embedded: Three.js, procedural artwork, original effects, the supplied music, and slow Ana narration. Playing needs no installation or internet access.

## Publish with GitHub Pages

`index.html` is the complete playable game for the website root. It is generated from the original standalone HTML by `scripts/build-race-game.py`; edit the original HTML or editable modules, then rebuild both entries. Do not edit `index.html` separately. The build consistency check also verifies that the two entries match. `.nojekyll` tells GitHub Pages to serve these files as a static website.

Before pushing changes:

```sh
python3 scripts/build-race-game.py
python3 scripts/build-race-game.py --check
```

Create an empty GitHub repository, then connect and push this local repository using GitHub Desktop or Git. Replace `YOUR-USERNAME` with the repository owner's username:

```sh
git remote add origin https://github.com/YOUR-USERNAME/Thomas-Game.git
git push -u origin main
```

In the GitHub repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select **main** and **/ (root)**, then save. GitHub provides the site address, usually `https://YOUR-USERNAME.github.io/Thomas-Game/`. Future pushes to `main` publish automatically. No server or online narration-generation step is needed for deployment.

GitHub Free supports Pages for public repositories; private repositories require an eligible paid plan. See [GitHub's Pages setup guide](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site). Use Git or GitHub Desktop to push the game: the self-contained HTML is larger than [GitHub's browser file-upload limit](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

Saved stars and racer choices belong to the browser and site address. Existing local-file saves do not automatically transfer to the published website.

## Playing

| Control | Action |
| --- | --- |
| Arrow keys / Tab | Navigate character portraits and menu pictures; unavailable choices are skipped |
| Enter / large job picture | Perform the next part of the current job |
| Direct selection | Select passengers, containers, sleepers/potholes, rocks, coal scoops/fuel-pump controls, and the crossing control |
| Pointer over dirt | Wash without holding a click |
| Space / whistle, horn or radio picture | Signal; clear animals or a landing area once stopped |
| Escape / Pause | Pause or explicitly resume |
| ♫ | Toggle music independently of narration and effects |
| Repeat | Hear the current task again |

Your chosen character drives or flies, slows down, and stops automatically. Harold automatically approaches helipads, lands for cabin and ground-service jobs, and hovers for winch work. Repeated or premature actions cannot skip work. Jobs allow unlimited attempts; taking longer lets the independent rival get ahead. Losing focus or hiding the page pauses both racers, work animations, and boosts until explicit resume. Held keys do not repeatedly activate controls. Startup is silent until the first interaction; Tab and native button activation remain available.

On phones, the game fits the visible browser viewport and respects the notch and home-indicator safe areas. A compact header keeps all five game controls and the album accessible with 44px touch targets. The job reminder and race progress occupy a short row above the canvas rather than covering the vehicles. Portrait phones have 64px action buttons below the scene; short landscape screens place them in a narrow right-hand column. Keyboard labels are hidden in the compact layout, but keyboard controls still work. The scene resizes when the viewport changes, including while paused. Desktop layouts retain the larger dashboard. Racer dropdowns scroll within their panel, with the Race button kept visible; the selectors sit side by side in phone landscape.

The two panels sit side by side on wide screens and stack on phones. Each shows only its selected portrait and name. Activate the portrait or dropdown arrow to open a scrollable list; choosing a character closes it and updates the portrait. Only one list opens at a time, and the Race button stays outside the scrolling area. Tab and arrow keys navigate, Enter chooses, and Escape closes without changing the selection. The selected item in the list has a green border and checkmark. Random resolves only when Race is activated, samples valid distinct pairs, and avoids the previous character in each random role where possible. Named choices remain fixed. The countdown reveals both resolved racers. Home, Choose racers, and unavailable-WebGL recovery preserve the preferences. After the finish festival, Rematch repeats the same resolved characters, course, delivery theme and seed, even when Random originally chose a racer. Choose racers reopens the collapsed selectors. There is no duplicate Home button on the result panel.

## What changes each race

| Part | Selection |
| --- | --- |
| First / last jobs | Always loading / unloading, with a linked passenger or cargo delivery |
| Animals and washing | Always present; their positions among the six middle jobs are shuffled |
| Four rotating jobs | At least two of repairs, rocks, coal, crossing; the other two are sampled without duplicates from the remaining new jobs plus water, branch, harbour drawbridge |
| Middle-job order | All six middle jobs are shuffled using the race seed |
| Delivery | Passenger and cargo themes alternate for new races; the first theme follows the seed |
| Course | Random choice of countryside, harbour, or mountain, excluding the previous new-race course |
| Racers | Each role uses its named choice or Random; Random avoids that role’s previous character |
| Rival reactions | A seeded pace and small per-action variation, independent of the player’s position |
| Terrain and stopping locations | Fixed: two tunnels, bends, climb, descent, and a weather section; snow on mountain, wet ground elsewhere |
| Choose racers | Returns to selection. Race draws a new seed and course and alternates delivery; named racers stay fixed |
| Rematch | Repeats the same resolved characters, course, delivery theme, job order, rival reactions and seed |

Eight stops lie on suitable flat stretches at 12,000, 26,000, 52,000, 66,600, 94,700, 118,600, 143,000, and 160,600 model units. The finish is at 175,500.

## Railway jobs and rewards

| Job | Action and visible result |
| --- | --- |
| Passengers | Three groups board or alight, one second per group |
| Cargo | Select a container and operate the crane; loading/unloading takes five seconds |
| Animals | Whistle; sheep clear the route, then the gate swings fully aside before departure (two seconds total) |
| Washing | Clear seven patches directly or with 600 ms assisted sweeps |
| Water | Four-second refill with visible water levels; non-steam vehicles fill a depot tank |
| Branch | Five-second crane lift |
| Harbour drawbridge | Boat passes for four seconds, then bridge lowers for two |
| Repairs | Three sleepers, each replaced over 1.5 seconds |
| Rocks | Two boulders, each lifted clear over two seconds |
| Coal | Three one-second scoops fill the steam engine’s bunker or tender; Diesel and buses fill a depot bin |
| Road crossing | Traffic clears for three seconds, barriers lower for two, then the railway signal turns green |

Every complete job and fully cleared restricted terrain section earns **six seconds of 25% extra speed**. Eight jobs and five terrain sections yield thirteen rewards, each awarded once. Boost duration accumulates without multiplying speed. Braking, stops, and restrictions preserve unused time. The lightning-bolt badge shows a small clock for a queued boost and blue forward chevrons for an active boost; exhaust also brightens during the burst. Both racers use the same physics, restrictions, work durations, and rewards.

The cream-and-navy dashboard shows one large job picture on the left: the current or next unfinished job, then a finish flag after all eight jobs. Terrain, weather and tunnels do not replace this reminder; their spoken guidance continues. The small status picture indicates travelling, helping, waiting or sounding the vehicle’s signal. Enlarged parallel tracks show both racers’ distance progress in the centre, with the lightning-bolt boost badge to their right. The racing dashboard has no completion grid or carried-load picture; the finish festival retains its eight completed job pictures. There are no mail pickups.

## Competitive rivals

The earlier 3.5–4.5 second reaction delays made the computer too easy to beat. The revised rival draws a pace between **0.75 and 1.65 seconds** per race, with up to 0.15 seconds of variation per action. Assisted washing adds 0.4 seconds of reaction time plus its normal 0.6-second work animation. The rival never examines the player’s lead, changes speed to catch up, or forces an outcome.

The earlier calibration covered **90 ordered character pairings × three courses × 25 seeds × three interaction profiles: 20,250 complete simulations**, including Harold in either role. Ordinary reactions are 0.75–1.5 seconds with 10–20 seconds of pointer washing. The computer won **3,654 of 6,750 ordinary races (54.1%)**; the player won 3,096, with no ties. Ordinary races took **5:32.7–5:59.9**, including the countdown. Fast play won 6,750/6,750; slow washing won 189/6,750. Player wins ranged from 9 to 15 out of 25 in each pairing/course. These deterministic profiles are calibration, not measured child play; actual outcomes depend on how quickly the player completes jobs. Character choice does not alter cruising speed, job action durations or AI reactions. Cargo races with Harold now include equal five-second checks before and after each affected intermediate job for both racers; these handling pauses add 30–50 seconds to the earlier timing range, depending on the job selection. Longer trains retain their full-train terrain clearance. Harold follows flight sections with equivalent restricted travel time, then earns a boost only after his tail clears the section.

The lakeside and obstacle update was checked against **4,050 simulations**: Harold in either role against all nine other characters, across three courses, 25 seeds and three interaction profiles. The computer won **738/1,350 ordinary races (54.7%)**; fast play won 1,350/1,350. Every pairing remained within the competitive range. With equal cargo-handling pauses and the gentler branch sequence included, ordinary races in this sample took **5:35.1–6:43.5**. Branch jobs in races involving Harold now take twelve seconds for both racers, seven seconds longer than the previous lift. Ground-only races retain their timing. These are deterministic interaction profiles, not measured child play.

## Characters and road equivalents

| Character | Distinctive model |
| --- | --- |
| Thomas | Blue tank engine, red running board and number 1 |
| Percy | Compact green tank engine and number 6 |
| James | Red engine with a separate coal tender |
| Bertie | Red single-decker bus with rubber tyres |
| Toby | Brown wooden tram body, broad roof, side skirts and cowcatchers |
| Spencer | Silver streamlined nose and body, matching tender |
| Emily | Dark green body, brass detailing, large driving wheels and tender |
| Diesel | Black rectangular body, ventilation grilles and diesel exhaust |
| Bulgy | Tall red double-decker bus with two rows of windows |
| Harold | White helicopter, cockpit, red markings, landing skids, spinning main and tail rotors |

All ten can play either role. Each role has its own railway, road or flight corridor; Bertie versus Bulgy uses two parallel roads. Road trailers carry the same passenger and cargo loads. James, Spencer and Emily have independently moving tenders and coaches. Vehicle metadata, portraits, power type and train dimensions come from one shared catalogue in the race model.

| Railway job | Bus equivalent |
| --- | --- |
| Replace three sleepers | Workers fill three potholes, 1.5 seconds each |
| Fill the coal bunker | Refuel at a roadside pump, three one-second fills |
| Refill the steam-engine water tank | Fill a depot water store over four seconds |
| Clear road traffic and lower barriers for the train | Wait for a train at the shared railway, or for cars at a road junction when racing a train; five seconds total |
| Loading and unloading | Roadside depot loading/unloading with road trailers |
| Animals, rocks, branches, washing | The same work on the road |
| Tunnels, hills, weather, harbour drawbridge | Road versions with the same restrictions and completion rewards |

Each crossing uses one continuous transport mode across both routes. Bus/bus and bus/Harold races share a long double-track railway: crossing trains clear in three seconds before the bus barriers rise over two seconds. Any race containing a racing train shares a long road: trains use level-crossing barriers, buses wait at traffic lights, and Harold radios the ground crew while hovering. The two traffic streams use separate lanes and head outward, so one racer can finish its job independently without traffic crossing an opponent that has already departed. Road repairs contain potholes. Buses refuel with a hose and fuel pump; their separate water job supplies a depot store. Diesel keeps railway jobs and delivers coal and water to depot stores rather than consuming them. Steam engines whistle; Diesel and the buses use a horn and motor sound. Road vehicles have no railway clatter or funnel steam. Task pictures, instructions, dashboard portraits and results follow the selected character.

## Flying with Harold

Harold follows a flight route alongside the railway or road. He takes off smoothly, tilts forward in flight, and descends toward each helipad. He flies through two cloud banks alongside the other racer’s two complete railway or road tunnels. Hills, wind and snow provide the other flight scenery; the floating hoops have been removed. Harold has no coaches or solid tunnels, and shared crossing roads or railways continue underneath his flight corridor. His shadow follows the ground, his rotors keep turning while hovering, and his sling load sways gently. Races including Harold use a slightly wider fixed camera to keep the rotor and cargo visible at phone sizes.

| Shared job | Harold’s version |
| --- | --- |
| Passengers | Land; three groups board or leave the cabin, one second each |
| Cargo | Choose the small load, then winch it into the sling or lower it onto the marked spot, five seconds |
| Repairs | Land while the crew moves three supply handcarts, 1.5 seconds each |
| Rocks | Land while a ground crane lifts two heavy rocks clear, two seconds each |
| Branch | Workers attach a sling; Harold gently lifts, carries and lowers a small branch, then returns. Twelve seconds for both racers when Harold is racing |
| Coal | Land at an aviation fuel pump; three one-second fills |
| Water | Deliver water to the ground crew over four seconds |
| Washing | Land on an open wash pad; clear seven mud patches directly or with assisted sweeps |
| Animals | Radio the farmer and hover while sheep clear the landing area, two seconds |
| Crossing | Radio the ground crew and hover while the same railway or road traffic passes below, five seconds |
| Harbour drawbridge | Hover at a marked harbour holding point while a boat passes, six seconds |
| Tunnel sections | Fly through cloud banks; the other racer uses complete tunnels at the same course positions |
| Hill / weather sections | Climb, descend, or fly carefully through wind and snow |

Harold approaches and leaves intermediate helipads using his actual race speed and normal braking/acceleration, with no compressed-distance flight animation. At cargo stops he holds still for three seconds while lowering the load vertically, then moves gently onto the helipad over two seconds. The grounded cargo stays fixed during the job. Afterward he returns above it over two seconds, gently lowers an empty hook for one second, then lifts the secured cargo over two seconds before flying on. The rope extends continuously; the cargo stays on the ground until the hook reaches it. The other racer receives the same five-second check before and after the job, keeping these pauses fair. Actions cannot skip these stages, pause freezes them, and the completion boost is awarded only after the cargo is secured. Heavy rock clearance and repairs keep Harold landed. The light-branch job uses a slow model-timed flight: approach, attach, rise vertically, carry, lower, detach, and return. While attached, the branch stays directly beneath Harold; the cable never steers it independently. Workers attach and release the visible supporting sling only while the branch is on the ground. Hover-only stops for sheep, crossing traffic and harbour boats keep the cargo attached. Final unloading keeps its original winch animation. Passengers travel in the cabin; Harold never tows a coach. Fuel, passenger/cargo state, rewards and completion timing stay in the race model. Both roles use the same controls and job action counts, eight-job sequence, independent seeded AI and boost rules. Flying cannot bypass a required stop. Flight sections extend beyond each ground obstacle so that the short aircraft does not gain an advantage from avoiding train-tail clearance.

Harold has an original synthesized rotor rhythm and a clear half-second, two-tone radio call, with no wheel clatter, steam chuffs or funnel smoke. A nearby computer-controlled Harold can also be heard. Pause, mute, home and restart stop the sound cleanly. All aviation instructions and Harold’s name have slow Ana recordings embedded for offline playback.

## Lakeside flooding, ice and flight weather

Both routes cross one shared lakeside area. A gentle dip lets level, translucent water partially submerge pavement and wooden sleepers while leaving the rail heads visible. The lake has an irregular shoreline, a visible bed, reeds and ripples; road wheels make small splashes. The road and railway remain continuous beneath the water. Banks leave the route clear rather than cutting through it.

The mountain course uses a frozen lake beside raised routes, with thin irregular ice patches, visible tyre traces, and uneven snow along the verges. Vehicles do not drive through a thick slab of ice. Rain or windblown snow, cloud banks, moving windsocks and gentle banking explain Harold’s matching speed restriction above the lake. Weather and service animations use the race clock, so pause freezes them. Terrain caps and once-only completion boosts still apply equally, including full vehicle clearance.

## Complete tunnels and crossings

Both tunnel sections have **complete hollow masonry walls, curved roofs, and two open stone portals**, separately fitted to each railway or road, including either bus racing Harold. Harold’s equivalent sections use opaque, shadow-free cloud puffs that naturally hide and reveal him during passage. Opaque mesh geometry progressively hides the engine, coaches, and loads during entry and reveals them at the exit. There are no cutaway walls, whole-train visibility toggles, or artificial material darkening. Tunnel structures do not cast large shadows onto trains outside their portals; soft train/ground shadows remain.

Terrain caps stay at 65% uphill, 60% downhill, 50% in tunnels and road crossings, 55% in snow, and 40% in wet ground until the last vehicle clears. Road barriers hinge across the road, clear the railway, and remain lowered until the rear coach passes. The harbour drawbridge remains a separate job. Its river now forms one continuous, level channel beneath two independently operated bridges. Harold waits above a harbour access-road bridge on that same river. Separate boat lanes run outward, clear each bridge before it lowers, and keep moving away afterward. Banks, terrain, trees and fences leave the channel clear; on the harbour course its water matches the sea level. The original engine designs and stable camera remain.

Sheep gates span the route while closed. Sheep move clear during the first 1.2 seconds; the gate swings away from the waiting vehicle over the remaining 0.8 seconds and stays parallel to the verge. Grounded posts and fixed hinges remain outside the train or bus clearance. The complete engine, tender, and coach pass without touching the gate.

The railway has two solid raised steel rails above the wooden sleepers, with broad feet, narrow webs, and bright running heads. Matching rails continue over the harbour drawbridge and across the road crossing. Engines and coaches sit at the rail-head height; Each tender follows its own position on bends and hills to keep its wheels on the rails.

## Sodor Finish-Line Festival

The player’s finish starts a nine-second, skippable celebration. The first 4.5 seconds welcome the arrival with a waving chequered flag, cheering spectators and a breaking ribbon. Vehicles keep moving from their measured crossing speed, then brake smoothly beyond the line with room for their tenders and coaches. Harold clears the banner in flight and lands on a marked pad beyond it. The camera widens gently.

At 4.5 seconds the winner receives a gold trophy, a first-place flag and one finite burst of character-colour confetti. Second place receives a silver rosette and applause; a tie gives both racers matching gold awards. At seven seconds, eight completed job pictures light up as passengers or dockworkers thank the player. Flags and spectators continue their gentle movement behind the compact result panel. Each course has its own setting: a country station party, a harbour quay with decorated boats on the continuous waterway, or a snowy festival with snowmen and a refreshment stall. Crowds and awards stand outside the routes.

Skip celebration is available immediately. With the scene focused, Enter skips and Space sounds the selected character’s whistle, horn or radio; holding either key cannot repeat it. The signal picture remains usable, and Tab reaches visible buttons. Escape/pause, focus loss and hidden tabs freeze presentation time. Home and Rematch cancel old scene activity and audio. Music and the new short original melody/applause duck during speech. Nine new slow Ana phrases are embedded for offline use.

A computer that finishes first gets its flag and trophy immediately while the player keeps racing. A computer still behind follows its existing seeded route and challenges during the festival and behind the result panel. It is never teleported or given catch-up speed. Choosing to skip reveals the buttons without jumping the vehicles to their stopping positions. Trophies and rosettes are cosmetic: the existing three completion stars and saved stickers are awarded once, independently of the festival.

The model captures a once-only `finishEvent` for each racer, with crossing time and speed before velocities reset. `createFinishPresentation`, `stepFinishPresentation` and `skipFinishPresentation` own a separate race copy and pause-aware elapsed time. The copy preserves working-job references and continues the rival’s original AI; the completed official race, result, rewards and finish times remain unchanged. `finishArrival` samples a continuous braking curve, and independent route sampling preserves tender/coach spacing. Finish decorations and confetti use the same presentation clock, with no wall-clock animation timers.

## Audio and saved progress

Ana uses `en-US-AnaNeural` at −25% rate, with mono 22,050 Hz PCM WAV clips embedded for offline play. Race, control, and sticker labels use the same text in recordings and browser-speech fallback. Obsolete 2D instructions are no longer embedded. The unavailable-renderer message and empty album instruction now refer only to races.

The supplied Thomas Theme recording remains a repeating 31-second loop. Music has its own channel, fades under narration, pauses/resumes at its current position, and respects master mute. Source metadata is in `audio/thomas-theme.json`. Running audio uses the CC0 [Train Wheels Clacking by craigsmith](https://freesound.org/people/craigsmith/sounds/480813/) and [Single Steam Train Chuff by birdOfTheNorth](https://freesound.org/people/birdOfTheNorth/sounds/623817/). Credits and sample edits are in `audio/running-credits.json`. Chuffs follow wheel rotation; the original whistle, pops, and reward chimes are retained. Buses and Diesel use a quiet, locally generated engine rumble instead of the continuous pitched tone that sounded like a stuck horn. Space plays a clear two-blast horn call, with its signal level raised about 10 dB above the previous quiet horn, ending automatically after about half a second; holding Space does not repeat it. Bertie and Bulgy use the original engine volume. Narration lowers running sounds while instructions play. The engine follows actual movement and stops at service stops, on pause, or when muted. All of these sounds work offline.

The storage key `thomas-first-adventure-progress-v1` preserves stars, race stickers, and older earned stickers and exploration albums. Selection preferences (including Random) are stored separately from the last resolved player, rival, course and delivery theme. Missing or invalid preferences use Thomas versus Random without erasing rewards. Invalid or unavailable storage falls back to session progress. Unfinished races are not saved. Finishing awards three stars once, whether the player wins or loses. Winners are recorded by role (`player`, `rival`, or `tie`), so Thomas can also be the computer. The winner sticker is awarded only for a player win.

## Editing and verification

Editable modules:

- `scripts/race-model.js`: shared character catalogue, jobs, physics, seeded selection, rivals, rewards. `createRace` requires distinct resolved IDs; `playerId` defaults to Thomas for older callers. Reusing resolved IDs, course, theme and seed reproduces the race.
- `scripts/race-renderer.js`: Three.js world, animation, and picking.
- `scripts/game-shell.js`: race-only navigation and compatible saved progress.
- `scripts/game-runtime.js`: pictures, input, narration, and audio coordination.

The HTML retains the control markup, styles, picture library, audio engines and assets. The narration build embeds 95 current race/selection/festival keys with slow Ana recordings, alongside shared UI and album clips. Rebuild and verify with:

```sh
python3 scripts/build-race-game.py
python3 scripts/build-race-game.py --check
node --test tests/*.test.cjs
```

The non-balance regression suite passes **299 checks**, including audio, gameplay, interfaces, festival presentation and shared-course geometry. Festival checks cover every character in both roles with wins, second place and ties; four viewport sizes; visible faces and awards; smooth braking, full clearance and Harold’s landing; independent continued rival jobs; immediate/late Skip, repeated input, pause/focus/mute, exact Random rematches, and once-only rewards. Sixty comparisons against the pre-festival model matched finish times, winners, distances, AI profiles, job states and boost balances exactly. Other checks cover stationary cargo handling, ordinary approach/departure speed, vertical sling motion, early/repeated input, pause, equal time for both racers, and exact rematches. The full **20,250-round** matrix was rerun after the festival change and passed: the computer won **3,654/6,750 ordinary races (54.1%)**, with 3,096 player wins and no ties. Duration checks include the equal cargo-handling and gentle branch-lift allowances; the nine-second celebration occurs after the official finish and is excluded from race times. Tests cover all jobs and loads, invalid/repeated input, once-only rewards, stacked boosts, terrain and crossing clearance, safe braking, reproducible seeded simulations, all named/Random combinations, independent rivals, 60/120 Hz equivalence, keyboard/direct controls, both portrait selectors, saved preferences and albums, pause/focus loss, narration, music, and offline asset consistency. The expanded 20,250-round balance test requires an overall ordinary win rate between 45% and 55%, with competitive results across each pairing.

Harold’s tests cover both roles, landed/airborne poses, rotors, ground shadows, cabin/sling loads, radio and fuel jobs, once-only rewards, and complete keyboard/direct-selection races. The full balance matrix now covers 90 ordered pairings across three courses, 25 seeds and three interaction profiles.

Actual-mesh ray checks verify that complete tunnels hide trains inside and leave them visible before and after passage at 320px, 375px, laptop, and wide sizes. Other geometry checks cover reachable targets, loads, wheel/rail contact, gates, barriers, road-job variants and crane alignment. Current previews and renderer notes are in `artwork/race/README.md`.

**Live WebGL verification remains outstanding.** Browser policy blocked local-file inspection and prohibits alternate browser/server workarounds. DOM simulations and CPU geometry previews do not establish live lighting, shadows, motion, input, frame rate, or browser audio quality.

The mobile layout correction removes the old 540px landscape stage minimum and viewport-minus-80px phone minimum. A CSS constraint check reproduced the landscape overflow at 696×294 and 844×320 before the fix and passes afterward. Expanded mesh and picking checks include 310×330 portrait and 516×145 landscape canvas sizes for every character, service targets, Harold and finish awards. These checks do not render CSS or emulate iOS browser chrome: a live iPhone portrait/landscape pass, including open dropdowns and expanded/collapsed browser bars, remains outstanding.

To regenerate race narration (online build step only), install `edge-tts`, then run:

```sh
python3 scripts/build-race-narration.py
python3 scripts/build-race-game.py
```

Optional `--tts-module-dir` and `--ffmpeg` arguments support a separate build environment. The general `scripts/build-narration.py` also reads the race model and shared UI catalogue. Finished playback remains offline.
