# Detailed 2D railway world integration

`world-art.svg` is a `<defs xmlns="http://www.w3.org/2000/svg">` wrapper. Insert its inner content in the scene's existing defs. 85 definitions, approximately 42 KB, all vector and offline. Unique `world-` IDs; no raster assets, filters or CSS animations. Keep canonical Thomas engine/body/face symbols.

## Shared geometry and style

- Navy `#172c43` outlines, rounded joins and warm clean fills; mild shape highlights, no photographic textures or separate lighting.
- Scene baseline rail contact is y=520. All object anchors below are **local SVG coordinates** at native scale. Put an object's y at `railYAtObject - anchorY * scale` and its x at `checkpointX - anchorX * scale`. Do not rotate landscapes/sky.
- Use the existing approved 0.35 screen pixels per model unit. Clip background tiles to scene bounds. Translate props by `railProfileY - 520` and rotate the train/coach bodies by the **local rail tangent only**. A climb raises the route by 40 px; a descent lowers it by 40 px. Use the full 3,600-model-unit encounter section with smooth cosine joins, keeping the grade below 3°. Retain the new flat level after each slope instead of adding a return hump. Front, middle and back rail sampling, constant-depth ballast, water-pipe local coordinates, and tunnel rail masks must share the same profile. Free Drive's 30,000-unit cycle climbs from 8,000 to 11,600, remains high, descends from 17,500 to 21,100, then remains low through the seamless loop join.

## Continuous layers

All `world-{distant,middle,near}-{farmland,woodland,harbour,hills}` have viewBox `0 0 1200 620`. `country` aliases also exist. They can be used at native 1200×620 size and translated without rescaling, with ± neighbouring tiles.

- `world-sky`: fixed sky, sun and clouds. No moving facial decoration.
- Distant layer: use 15% movement. Same first hill colour and same y=285 endpoints, y=440 lower fill; second silhouette and common fill are identical at tile boundaries.
- Middle layer: use 45% movement. Same continuous grass path and y=397 endpoints / lower y=500. Harbour is a **bounded inlet** inside its tile, retaining grass at edges. Houses, farm, quay and lighthouse are part of this layer.
- `world-ground`: fixed/common y=455..620 ground strip; draw this before near details and then railway ballast/track.
- Near layer: use 100% movement. Transparent trees, fences, bushes, railings and sparse foreground tufts. Themes share the same fixed grass strip beneath. Tile repeat deliberately changes individual landmark choices rather than crossfading a whole panorama.

## Fixtures and anchors

Recommended render at native size unless scene constraints require proportional resizing. Names end `-back`/`-front` because the renderer controls occlusion. Front station platform edge still sits on the **far side of the running rail**, so draw it before the train; avoid masking train wheels with a full platform strip.

| Symbols | Native size | Anchor and layer notes |
|---|---:|---|
| `world-signal-body`, `world-signal-red`, `world-signal-green` | 90×230 | foot y=223, pole x=44; local baseline y=223. Draw behind train. Switch red/green symbol; same physical shape. |
| `world-stop-board` | 95×185 | foot x=47,y=178. Two white stop bars, no text needed. |
| `world-platform-marker` | 95×185 | foot x=47,y=178; train picture. |
| `world-station-back`, `world-station-front` | 680×270 | platform lip y=234, lower edge y=267. Use rail reference y=250; put stop marker at the platform's right end. Building x31..474, shelter x480..651. Both platform layers before train; passengers on the platform. |
| `world-passenger` | 45×85 | feet y=84, face centre22,28. A root group can contain different coloured/scaled passengers. Translate walking passengers towards coach door over service progress. |
| `world-bridge-water`, `world-bridge-back`, `world-bridge-front` | 760×260 | running rail reference y=42; entrance x=0, exit760. Water first, rear deck/pillars then running rail/train, front shallow parapet last. Top of side parapet y34, structure ends253. Rear rails remain runtime-owned. |
| `world-crossing` | 500×270 | railway baseline y=250. Road occupies x179..413 crossing y143..266. Gate is a separate layer; field fence is behind train. |
| `world-farm-gate` | 210×105 | hinge x=14,y=56; feet y102. Open by scaling horizontally about hinge rather than swinging entire world. |
| `world-cow` | 160×110 | footline y105; face left. Flip to face desired exit direction. |
| `world-sheep` | 135×100 | footline y94; face left. Use same species for a selected crossing. |
| `world-fallen-tree` | 390×170 | rail reference y142, blocked midpoint x195. Trunk from43,132 to328,53; crane group lifts/removes full tree symbol progressively. |
| `world-crane-base`, `world-crane-arm` | 480×360 | wheels contact y346; boom origin202,190, tip397,51; hook tip397,228. Put base behind train/tree at appropriate worksite distance. Arm/hook separately transformable. Tree pickup can be beneath hook, then lift tree. |
| `world-water-tower`, `world-water-column`, `world-water-stream` | 420×330 | ground/rail reference y310. Static column hinge x284,y142; curved outlet tip366,153. Stream falls x366,y151 to363,227. All three symbols use exactly same coordinates. Align outlet over Thomas by moving the whole column group; show stream only during filling. |
| `world-wash-back`, `world-wash-front` | 460×300 | floor/rail reference y274; clear opening x80..383,y128..274. Brushes at84..110 and353..379. Scale fixture to about600px scene width so Thomas fits between brushes. Back goes behind train, posts/brushes in front; no centre-fill in front symbol so Thomas stays visible for dirt cleaning. |
| `world-mud-puddle` | 330×70 | surface centre y45; place on/just below running track; low brown fill, no instructional coloured track. |
| `world-sign-{bridge,hill,downhill,tunnel}` | 140×215 | foot x67,y208. Actual picture of railway shape plus tortoise/hare, matching cards. |
| `world-tunnel-back`, `world-tunnel-front` | 1210×420 | floor y400; entrance mouth x80, exit mouth x1130. Place at checkpoint x−80, scene y120. Portals use a 160×260 symbol at y150: the outer frame is 240 px tall and the opening is 205 px tall. Mountain shoulders at y115 cover the arch crowns at y160; both frames fit inside the fixture. The front silhouette outlines only the ridge, avoiding artificial vertical seams above the arches. The physical hidden interval is 1050 scene pixels / 3000 model units. Clip train and steam in world space between the mouths. Keep the slow-speed rule until at+5100, when the rear coach clears; both portal frames and hillside sit in front. |
| `world-drawbridge-back`, `world-drawbridge-deck` | 940×350 | **closed running rail reference y43**. Movable span x326..579. Hinge576,57. Deck angle +35° raises left end; 0° lowers to closed. Piers x278..328 and571..623, water y145..350 (raised visually to fit the scene below the rail). Keep deck rotation on span only; rail over movable span must follow deck until bridge is closed. |
| `world-boat` | 230×145 | hull bottom128, waterline around132. Draw above water, behind bridge piers; translate left/right as waiting progress advances. |
| `world-repairs-back` | 570×260 | rail reference y238; material pile x154..314, rail stacks x340..515. Work tools. |
| `world-work-barrier` | 190×155 | feet y150; position on track only at repair obstruction. Remove after worker animation finishes. |
| `world-worker` | 75×140 | feet y138; face36,34. Workers move off track visibly when complete. |

## Matching coach and reusable pictures

`world-coach-body` has viewBox `0 0 190 135`, body only. Its original compatible origin is (75,392) for Clarabel and (273,392) for Annie. Keep wheel centres local `(42,108)` and `(142,108)`, radius20, so contact=`392+108+20=520`. Body can retain accessible names but visible coach text is optional. Replace old brown stroke/orange metallic gradient with this body for consistency.

`world-coach-wheel`: viewBox `0 0 40 40`, radius20 outline included. Put its centre at each local wheel centre and rotate about that centre using wheel travelled-distance angle.

`world-card-{signal,station,crossing,tree,wash,water,bridge,hill,downhill,tunnel,drawbridge,repairs}`: viewBox `0 0 120 100`. They reuse identical fixture artwork for challenge rule/next preview. `world-tortoise-picture` and `world-hare-picture` share that viewBox, useful for the regulator/speedometer.

## Isolated reference verification

`artwork/world-reference.svg` and `.png` show the unified farm/station/Thomas/coaches/rail composition. This is an isolated SVG artwork rendering by Sharp, not a running-game/browser screenshot. `/private/tmp/thomas-world/fixture-grid.svg/.png` inspect physical fixture silhouettes. Reference image visually inspected: shared outline thickness/palette, clear engine/coach/rail contact, station on far side, no photo/raster layers. Main runtime still needs motion/layering tests.
