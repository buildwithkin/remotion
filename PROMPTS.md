# Remotion Composition Prompts

Paste any of these into Claude Code (inside this repo) to regenerate or extend a composition.
Each prompt is self-contained — it tells Claude exactly what to build and how.

---

## 1. ArticleHighlight

Animate a screenshot of any article with rough.js marker highlights, a blur intro, and a slow 3D rotation.

```
Build a Remotion composition called "ArticleHighlight" at 1080×1920, 30 fps, 5 s (150 frames).

ASSET
- Place a screenshot of the article at public/screenshot.png before running.
- Get its pixel dimensions with: sips -g pixelWidth -g pixelHeight public/screenshot.png

EFFECT STACK (all layers stacked in an AbsoluteFill)
1. White background + subtle SVG fractalNoise grain texture (NoiseBackground component).
2. A perspective container (perspective: 1200px). Inside it, the article div slowly zooms
   1.0→1.07 and rotates −7.5°→+7.5° on both X and Y axes over the full clip
   (Easing.inOut(Easing.ease) on both).
3. Behind the article image: two rough.js highlight boxes drawn as SVG <rect> with
   roughjs (fillStyle: "solid", roughness: 2.5, fill: "#FFD54F", stroke: "none").
   Each highlight animates its clipPath width from 0→100% over 60 frames, staggered
   ~40 frames apart. Phrase bounding boxes come from OCR coordinates (update PHRASE_1
   / PHRASE_2 constants at the top of the file with your actual coordinates).
4. The article <img> on top with mix-blend-mode: multiply — this makes white areas
   of the image optically transparent so the yellow highlights bleed through while
   all dark text stays dark (the "marker behind text" trick).
5. Opening beat: a 20px Gaussian blur on the whole comp fades to 0 over the first
   30 frames (1 s focus-pull intro).

TIMING (frames @ 30 fps)
- 0–30:   blur fades out
- 30–90:  highlight 1 draws
- 72–132: highlight 2 draws (overlapping)
- 0–150:  zoom + rotation runs continuously

RENDER
npx remotion render ArticleHighlight out/article.mp4
```

---

## 2. TravelMap

Animate a great-circle flight path between two cities on a Stadia watercolor map, with camera
following the route head, then zooming out to frame the destination state/region.

```
Build a Remotion composition called "TravelMap" at 1080×1920, 30 fps, 12 s (360 frames).
Uses maplibre-gl + @turf/turf. No API token needed for Stadia watercolor tiles
(use your own key from stadiamaps.com — free tier covers local rendering).

MAP SETUP — render-safety required
- interactive: false, fadeDuration: 0, attributionControl: false,
  canvasContextAttributes: { preserveDrawingBuffer: true }
- In remotion.config.ts: Config.setChromiumOpenGlRenderer("angle")
- useDelayRender() on mount → continueRender on map 'idle'
- Per-frame: delayRender → triggerRepaint → map.once('idle', continueRender)
- No map.remove() cleanup

ROUTE
- Define two city coordinates as [lon, lat] pairs: CITY_A and CITY_B.
- Build a great-circle line with turf.greatCircle(point(A), point(B), { npoints: 120 }).
- Animate it with turf.lineSliceAlong: each frame slices from 0 to
  (progress × totalLength) km. Progress goes 0→1 over frames 70→210.
- Draw a bright contrasting line (e.g. #e63322, width 8, opacity 0.92).
- A GeoJSON source/layer for city dot markers (circle, radius 14).

CAMERA BEATS (map.jumpTo per frame, no animate:true)
- Frames 0–70:   zoom in on CITY_A (zoom 3→5.5, easing inOut cubic)
- Frames 70–210: center follows route head (turf.along), zoom pulls back mid-flight
                 then zooms into CITY_B (zoom 5.5→4.0→6.5)
- Frames 210–270: pan from CITY_B to a wider regional centroid, zoom 6.5→5.8
- Frames 210–330: optionally outline a region (fetch GeoJSON boundary, draw as
                  animated dashed line using the same lineSliceAlong pattern)

STYLE
- Stadia watercolor: tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg
- Inline MapLibre StyleSpecification (no external JSON needed)
- Optional grain overlay: SVG feTurbulence with seed=frame, mixBlendMode:soft-light

RENDER
npx remotion render TravelMap out/travelmap.mp4 --gl=angle --concurrency=1
```

---

## 3. RunStory

Turn a GPX file into an animated Instagram Story: map + progressive route draw +
live run metrics overlay. No API token needed (CARTO dark map, free).

```
Build a Remotion composition called "RunStory" at 1080×1920, 30 fps.
Set the duration from the GPX data via calculateMetadata (target ~15 s = 450 frames).
Uses maplibre-gl. No API token needed — use CARTO dark-matter-nolabels style.

SETUP
- Copy your GPX file to public/Afternoon_Run.gpx (Strava export or any standard GPX).
- Install nothing extra — parse the GPX with an inline regex parser (no dependency).
- In remotion.config.ts: Config.setChromiumOpenGlRenderer("angle")

DATA STEP — parse once in calculateMetadata, not per frame
Export a calculateMetadata function that:
1. Fetches the GPX via fetch(staticFile('Afternoon_Run.gpx'))
2. Parses <trkpt lat lon> + <ele> + <time> into TrackPoint[] with a regex loop
3. Builds cumulativeDistances[] using the Haversine formula (no turf needed here)
4. For each of the 450 frames, maps to a track index via binary search on timestamps
5. Pre-computes frameMetrics[450]: { distKm, elapsedMs, paceMinPerKm, elevationM }
   — pace smoothed over a 30-point window to kill GPS jitter
6. Returns durationInFrames=450, fps=30, width=1080, height=1920, and all the above as props

MAP — render-safety required
- Style: "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json"
- interactive: false, fadeDuration: 0, attributionControl: false,
  canvasContextAttributes: { preserveDrawingBuffer: true }
- useDelayRender on mount → continueRender on map 'load' (after adding all sources/layers)
- Per-frame: delayRender → setData on both sources → triggerRepaint → map.once('idle', continueRender)
- No map.remove()

On load:
- Fit the map to route bounds using Math.min/max on coordinates (no turf needed),
  map.fitBounds with padding { top:300, bottom:700, left:80, right:80 }, animate:false
- Add 3 sources: 'ghost' (full route, always visible), 'drawn' (animated slice), 'marker' (point)
- Ghost: white line, width 4, opacity 0.18
- Drawn: Strava orange (#FC4C02), width 7, opacity 1, round caps
- Marker: two circle layers — outer halo (radius 20, orange, opacity 0.35) +
  inner dot (radius 11, orange, white stroke 3px)

Per frame: coordinates.slice(0, trackIndex + 1) for the drawn route, coordinates[trackIndex] for marker.

METRICS OVERLAY — React JSX AbsoluteFill above the map
- A dark gradient scrim at the bottom (linear-gradient transparent→rgba(0,0,0,0.88),
  height 700px) so metrics are always legible
- 2×2 grid of metric cards at bottom: Distance / Time / Pace / Elevation
- Each card: label ~38px uppercase 700-weight, value ~110px 800-weight, unit ~36px 600-weight
- Distance value in Strava orange, rest in white
- Text shadow on values: 0 2px 24px rgba(0,0,0,0.7)
- Grid positioned at bottom: 340px from bottom edge (Instagram safe area)

BEATS
- Frames 0–30: intro card — run name (from <name> in GPX) + formatted date,
  fade in at frame 0→15, hold, fade out 28→38. Background rgba(0,0,0,0.52).
- Frames 30–420: route draws, metrics update every frame from frameMetrics[]
- Frames 420–450: outro banner fades in at top — "Final Stats", totalDistanceKm, totalDurationMs

TYPE SAFETY
CalculateMetadataFunction requires T extends Record<string,unknown>.
Cast: export const calculateMetadata: CalculateMetadataFunction<any> = async () => { ... }
In Root.tsx: component={RunStory as React.FC<any>} and calculateMetadata={... as CalculateMetadataFunction<any>}

RENDER
npx remotion render RunStory out/run.mp4 --gl=angle --concurrency=1
```

---

## Notes for all compositions

**Stack:** Remotion 4.x, React 18, TypeScript, pnpm

**Install deps:**
```bash
pnpm install
```

**Preview in Studio:**
```bash
pnpm start
```

**Render all:**
```bash
npx remotion render ArticleHighlight out/article.mp4
npx remotion render TravelMap out/travelmap.mp4 --gl=angle --concurrency=1
npx remotion render RunStory out/run.mp4 --gl=angle --concurrency=1
```

**Required assets (not in repo — provide your own):**
- `public/screenshot.png` — article screenshot for ArticleHighlight
- `public/Afternoon_Run.gpx` — Strava/Garmin GPX export for RunStory
- `public/world-110m.json` — TopoJSON world data for TravelMap (download from
  `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json` and convert,
  or grab from the Natural Earth TopoJSON repo)
