import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Highlight } from "./Highlight";
import { NoiseBackground } from "./NoiseBackground";

// ── Original image dimensions (pixels) — from: sips -g pixelWidth -g pixelHeight ──
const IMG_W = 2418;
const IMG_H = 1680;

// ── Highlight targets ─────────────────────────────────────────────────────────
// OCR coordinates are in the original 2418×1680 image pixel space.
//
// ⚠️  "government shutdown" and "funding lapses" were NOT found in the
//     provided screenshot (Anthropic Project Glasswing article).
//     The values below are DEMO stand-ins:
//       phrase1 → "Project Glasswing:" in the article title
//       phrase2 → "AI models" in the body text
//
//     To target the real phrases:
//       1. Swap public/test-screenshot.png with the correct screenshot.
//       2. Run: tesseract test-screenshot.png stdout tsv
//       3. Find the rows matching "government" + "shutdown" and "funding" + "lapses".
//       4. Combine their bounding boxes and update PHRASE_1 / PHRASE_2 below.
const PHRASE_1 = { x: 541, y: 248, w: 697, h: 96 }; // "Project Glasswing:" title
const PHRASE_2 = { x: 1412, y: 1323, w: 121, h: 26 }; // "AI models" body text

const HIGHLIGHT_COLOR = "#FFD54F"; // warm amber — natural marker feel

// ── Layout ───────────────────────────────────────────────────────────────────
// 9×16 mobile — article column fills the width, both highlights stay in frame.
const COMP_W = 1080;
const COMP_H = 1920;

// Scale so the article content column (≈75 % of screenshot width) fills the comp.
// Centering on IMG_W/2 keeps the headline symmetric; PHRASE_2 (far right) was
// pulling the old ROI center rightward and clipping the title.
const SCALE = 0.75;

const IMG_LEFT  = Math.round(COMP_W / 2 - (IMG_W / 2) * SCALE); // -367 — symmetric crop
const IMG_TOP   = 180;                                             // article nav just above fold
const DISPLAY_W = Math.round(IMG_W * SCALE);
const DISPLAY_H = Math.round(IMG_H * SCALE);

/** Convert an OCR bounding box (image pixels) to composition pixels. */
const o2c = (x: number, y: number, w: number, h: number) => ({
  x: IMG_LEFT + x * SCALE,
  y: IMG_TOP + y * SCALE,
  w: w * SCALE,
  h: h * SCALE,
});

// ── Timing (frames @ 30 fps) ──────────────────────────────────────────────────
const BLUR_END = 30; // 1 s  — blur fades out
const HL1_START = 30; // 1 s  — highlight 1 starts immediately after blur clears
const HL1_END = 90; // 3 s  — highlight 1 fully drawn (2 s duration)
const HL2_START = 72; // 2.4 s — highlight 2 starts when 1 is ~70 % done
const HL2_END = 132; // 4.4 s — highlight 2 fully drawn (2 s duration)

// ── Main composition ──────────────────────────────────────────────────────────
export const ArticleHighlight: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // 1 — Blur: 20 px → 0 over the first second
  const blur = interpolate(frame, [0, BLUR_END], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 2 — Slow zoom: 1.0 → 1.07 over the whole clip (ease-in-out)
  const zoomScale = interpolate(frame, [0, durationInFrames], [1.0, 1.07], {
    easing: Easing.inOut(Easing.ease),
  });

  // 3 — 3-D rotation: −7.5° → +7.5° on both axes (15° total per axis)
  //     This creates a gentle perspective swing from left to right.
  const rotY = interpolate(frame, [0, durationInFrames], [-7.5, 7.5], {
    easing: Easing.inOut(Easing.ease),
  });
  const rotX = interpolate(frame, [0, durationInFrames], [-7.5, 7.5], {
    easing: Easing.inOut(Easing.ease),
  });

  // 4 — Highlight reveal progress (0 = not started, 1 = fully drawn)
  const h1 = interpolate(frame, [HL1_START, HL1_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const h2 = interpolate(frame, [HL2_START, HL2_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  const hl1 = o2c(PHRASE_1.x, PHRASE_1.y, PHRASE_1.w, PHRASE_1.h);
  const hl2 = o2c(PHRASE_2.x, PHRASE_2.y, PHRASE_2.w, PHRASE_2.h);

  return (
    // Blur applied to the entire composition (including background).
    // overflow:hidden clips the composition to 1920×1080.
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        overflow: "hidden",
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
      }}
    >
      {/* Layer 1 — white base + subtle noise texture */}
      <NoiseBackground />

      {/* Layer 2 — perspective container for the 3-D article */}
      <AbsoluteFill
        style={{ perspective: "1200px", perspectiveOrigin: "50% 50%" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoomScale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
            transformOrigin: "center center",
            transformStyle: "preserve-3d",
          }}
        >
          {/*
           * Layer 2a — rough.js highlights (SVG, behind the article image).
           * Because the image uses mix-blend-mode:multiply, white areas of the
           * image become transparent so the yellow bleeds through, while the
           * dark text remains dark — giving the "marker behind text" effect.
           */}
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              overflow: "visible",
            }}
          >
            <Highlight
              id="h1"
              x={hl1.x}
              y={hl1.y}
              width={hl1.w}
              height={hl1.h}
              progress={h1}
              color={HIGHLIGHT_COLOR}
              seed={42}
            />
            <Highlight
              id="h2"
              x={hl2.x}
              y={hl2.y}
              width={hl2.w}
              height={hl2.h}
              progress={h2}
              color={HIGHLIGHT_COLOR}
              seed={137}
            />
          </svg>

          {/*
           * Layer 2b — article image on top.
           * mix-blend-mode:multiply makes white areas optically transparent,
           * letting the yellow highlights beneath bleed through while preserving
           * all dark text and graphics.
           */}
          <div
            style={{
              position: "absolute",
              left: IMG_LEFT,
              top: IMG_TOP,
              width: DISPLAY_W,
              height: DISPLAY_H,
              mixBlendMode: "multiply",
              overflow: "hidden",
            }}
          >
            <img
              src={staticFile("test-screenshot.png")}
              style={{ width: "100%", height: "100%", display: "block" }}
              alt="article screenshot"
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
