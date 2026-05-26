import React from "react";

const INK = "#3a2e1f";
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

interface SectionStyle {
  opacity: number;
  transform: string;
}

function sectionStyle(progress: number, delay: number, dur: number, lift = 60): SectionStyle {
  const p = easeOut((progress - delay) / dur);
  return { opacity: p, transform: `translateY(${(1 - p) * lift}px)` };
}

export const EiffelTower: React.FC<{ progress: number }> = ({ progress }) => (
  <svg
    viewBox="0 0 280 580"
    width={280}
    height={580}
    style={{ overflow: "visible", display: "block" }}
  >
    <defs>
      <filter id="et-drop" x="-40%" y="-20%" width="180%" height="160%">
        <feDropShadow dx="3" dy="5" stdDeviation="6" floodColor={INK} floodOpacity="0.38" />
      </filter>
    </defs>

    {/* ── Layer 0 · Base arches ──────────────────────────────────── */}
    <g style={sectionStyle(progress, 0, 0.32, 70) as React.CSSProperties}>
      {/* Left arch leg */}
      <path
        d="M 0,580 C 28,490 65,415 80,342
           L 112,342 C 96,418 72,494 62,580 Z"
        fill="#c8a87c"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
        filter="url(#et-drop)"
      />
      {/* Right arch leg */}
      <path
        d="M 280,580 C 252,490 215,415 200,342
           L 168,342 C 184,418 208,494 218,580 Z"
        fill="#c8a87c"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
        filter="url(#et-drop)"
      />
      {/* Paper fold highlight strips */}
      <path
        d="M 62,580 C 72,494 96,418 112,342 L 117,342 C 100,418 77,494 67,580 Z"
        fill="rgba(255,240,210,0.35)"
      />
      <path
        d="M 218,580 C 208,494 184,418 168,342 L 163,342 C 179,418 203,494 213,580 Z"
        fill="rgba(255,240,210,0.35)"
      />
    </g>

    {/* ── Layer 1 · First platform ───────────────────────────────── */}
    <g style={sectionStyle(progress, 0.22, 0.26, 55) as React.CSSProperties}>
      <rect
        x="66" y="325" width="148" height="22" rx="3"
        fill="#d4b48a" stroke={INK} strokeWidth="1.5"
        filter="url(#et-drop)"
      />
      {/* Edge highlight */}
      <rect x="68" y="326" width="144" height="5" rx="2" fill="rgba(255,240,210,0.4)" />
    </g>

    {/* ── Layer 2 · Lower middle section ────────────────────────── */}
    <g style={sectionStyle(progress, 0.36, 0.26, 48) as React.CSSProperties}>
      <path
        d="M 74,325 L 99,218 L 181,218 L 206,325 Z"
        fill="#d9bb92" stroke={INK} strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#et-drop)"
      />
      {/* Horizontal brace */}
      <line x1="87" y1="275" x2="193" y2="275" stroke="#9a7040" strokeWidth="1.5" opacity="0.65" />
      {/* X diagonals */}
      <line x1="87" y1="320" x2="140" y2="240" stroke="#9a7040" strokeWidth="1" opacity="0.45" />
      <line x1="193" y1="320" x2="140" y2="240" stroke="#9a7040" strokeWidth="1" opacity="0.45" />
    </g>

    {/* ── Layer 3 · Second platform ─────────────────────────────── */}
    <g style={sectionStyle(progress, 0.52, 0.24, 42) as React.CSSProperties}>
      <rect
        x="89" y="203" width="102" height="20" rx="3"
        fill="#dfc29a" stroke={INK} strokeWidth="1.5"
        filter="url(#et-drop)"
      />
      <rect x="91" y="204" width="98" height="5" rx="2" fill="rgba(255,240,210,0.38)" />
    </g>

    {/* ── Layer 4 · Upper middle ────────────────────────────────── */}
    <g style={sectionStyle(progress, 0.63, 0.24, 36) as React.CSSProperties}>
      <path
        d="M 95,203 L 112,118 L 168,118 L 185,203 Z"
        fill="#e4c9a4" stroke={INK} strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#et-drop)"
      />
      <line x1="104" y1="163" x2="176" y2="163" stroke="#9a7040" strokeWidth="1.2" opacity="0.55" />
    </g>

    {/* ── Layer 5 · Top cap ─────────────────────────────────────── */}
    <g style={sectionStyle(progress, 0.76, 0.20, 30) as React.CSSProperties}>
      {/* Third-floor collar */}
      <rect
        x="106" y="110" width="68" height="12" rx="2"
        fill="#ead0ae" stroke={INK} strokeWidth="1"
        filter="url(#et-drop)"
      />
      {/* Tapered top body */}
      <path
        d="M 111,118 L 124,88 L 156,88 L 169,118 Z"
        fill="#ead0ae" stroke={INK} strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#et-drop)"
      />
      <rect x="108" y="111" width="64" height="4" rx="1" fill="rgba(255,240,210,0.42)" />
    </g>

    {/* ── Layer 6 · Antenna ─────────────────────────────────────── */}
    <g style={sectionStyle(progress, 0.88, 0.12, 22) as React.CSSProperties}>
      <line x1="140" y1="88" x2="140" y2="26" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="140" cy="22" r="5" fill={INK} />
    </g>
  </svg>
);
