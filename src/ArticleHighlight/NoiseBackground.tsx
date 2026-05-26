import React from "react";
import { AbsoluteFill } from "remotion";

const W = 1920;
const H = 1080;

/**
 * White base with two subtle layers:
 *  1. Grayscale fractal-noise grain at very low opacity
 *  2. Radial gradient — very slightly darker toward the edges (vignette)
 */
export const NoiseBackground: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#ffffff", pointerEvents: "none" }}>
    <svg
      style={{ position: "absolute", inset: 0 }}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Grayscale fractal noise */}
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.72 0.72"
            numOctaves="4"
            stitchTiles="stitch"
            result="noiseOut"
          />
          <feColorMatrix type="saturate" values="0" in="noiseOut" />
        </filter>
        {/* Radial vignette — lighter center, faintly darker rim */}
        <radialGradient id="vignette" cx="50%" cy="50%" r="68%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.055)" />
        </radialGradient>
      </defs>

      {/* Noise grain overlay */}
      <rect x="0" y="0" width={W} height={H} filter="url(#grain)" opacity="0.065" />

      {/* Radial darkening at edges */}
      <rect x="0" y="0" width={W} height={H} fill="url(#vignette)" />
    </svg>
  </AbsoluteFill>
);
