import React, { useMemo } from "react";
import rough from "roughjs";

interface HighlightProps {
  /** Unique id used to scope the SVG clipPath */
  id: string;
  /** Composition-space coordinates */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0 = nothing drawn, 1 = fully drawn (left → right) */
  progress: number;
  color?: string;
  seed?: number;
}

interface RoughPath {
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
}

function buildRoughPaths(
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  seed: number
): RoughPath[] {
  if (typeof document === "undefined") return [];

  const svgEl = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  ) as SVGSVGElement;

  const rc = rough.svg(svgEl);

  // Pad vertically so the marker naturally covers ascenders/descenders
  const vPad = Math.max(h * 0.38, 5);
  const g = rc.rectangle(x - 6, y - vPad, w + 12, h + 2 * vPad, {
    fill: color,
    fillStyle: "solid",
    roughness: 2.1,
    seed,
    stroke: "none",
    strokeWidth: 0,
  });

  const paths: RoughPath[] = [];
  g.childNodes.forEach((child) => {
    const el = child as Element;
    if (el.tagName === "path") {
      paths.push({
        d: el.getAttribute("d") ?? "",
        fill: el.getAttribute("fill") ?? "none",
        stroke: el.getAttribute("stroke") ?? "none",
        strokeWidth: el.getAttribute("stroke-width") ?? "1",
      });
    }
  });
  return paths;
}

export const Highlight: React.FC<HighlightProps> = ({
  id,
  x,
  y,
  width,
  height,
  progress,
  color = "#FFD54F",
  seed = 42,
}) => {
  // Paths are stable (same seed → same shape every frame). Only the clip changes.
  const paths = useMemo(
    () => buildRoughPaths(x, y, width, height, color, seed),
    [x, y, width, height, color, seed]
  );

  const clipId = `hl-clip-${id}`;
  // Reveal rect expands left → right
  const revealW = (width + 28) * progress;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={x - 20}
            y={y - height * 1.5}
            width={revealW}
            height={height * 4}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} opacity={0.72}>
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
          />
        ))}
      </g>
    </g>
  );
};
