import React, { useEffect, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
  time: number; // unix ms
}

interface FrameMetric {
  distKm: number;
  elapsedMs: number;
  paceMinPerKm: number; // smoothed
  elevationM: number;
}

export interface RunStoryProps {
  coordinates: [number, number][]; // [lon, lat] for map
  frameToTrackIndex: number[];
  frameMetrics: FrameMetric[];
  totalDistanceKm: number;
  totalDurationMs: number;
  runName: string;
  runDate: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_FRAMES = 450; // 15 s @ 30 fps
const INTRO_END = 30;    // 1 s intro hold
const OUTRO_START = 420; // 2 s outro hold
const PACE_WINDOW = 30;  // smooth pace over this many track points

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";
const STRAVA_ORANGE = "#FC4C02";

// ── GPX parser ────────────────────────────────────────────────────────────────

function parseGpx(xml: string): { points: TrackPoint[]; name: string } {
  const nameMatch = xml.match(/<name>([^<]+)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : "Run";

  const points: TrackPoint[] = [];
  const re = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    const inner = m[3];
    const eleM = inner.match(/<ele>([^<]+)<\/ele>/);
    const timeM = inner.match(/<time>([^<]+)<\/time>/);
    points.push({
      lat,
      lon,
      ele: eleM ? parseFloat(eleM[1]) : 0,
      time: timeM ? Date.parse(timeM[1]) : 0,
    });
  }
  return { points, name };
}

// ── Haversine-based cumulative distances ──────────────────────────────────────

function buildCumulativeDistances(pts: TrackPoint[]): number[] {
  const R = 6371; // Earth radius km
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const dLat = ((pts[i].lat - pts[i - 1].lat) * Math.PI) / 180;
    const dLon = ((pts[i].lon - pts[i - 1].lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((pts[i - 1].lat * Math.PI) / 180) *
        Math.cos((pts[i].lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    cum.push(cum[i - 1] + 2 * R * Math.asin(Math.sqrt(a)));
  }
  return cum;
}

// ── calculateMetadata ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const calculateRunStoryMetadata: CalculateMetadataFunction<any> = async () => {
  const url = staticFile("Afternoon_Run.gpx");
  const res = await fetch(url);
  const xml = await res.text();

  const { points, name: runName } = parseGpx(xml);
  const cum = buildCumulativeDistances(points);
  const totalDistanceKm = cum[cum.length - 1];
  const startTime = points[0].time;
  const endTime = points[points.length - 1].time;
  const totalDurationMs = endTime - startTime;

  const runDate = new Date(startTime).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // frame → track index
  const frameToTrackIndex: number[] = [];
  for (let f = 0; f < TOTAL_FRAMES; f++) {
    if (f <= INTRO_END) {
      frameToTrackIndex.push(0);
    } else if (f >= OUTRO_START) {
      frameToTrackIndex.push(points.length - 1);
    } else {
      const prog = (f - INTRO_END) / (OUTRO_START - INTRO_END);
      const target = startTime + prog * totalDurationMs;
      let lo = 0,
        hi = points.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].time < target) lo = mid + 1;
        else hi = mid;
      }
      frameToTrackIndex.push(lo);
    }
  }

  // per-frame metrics
  const frameMetrics: FrameMetric[] = frameToTrackIndex.map((idx) => {
    const distKm = cum[idx];
    const elapsedMs = points[idx].time - startTime;
    const elevationM = points[idx].ele;

    // smoothed pace over a window of real track points
    const winStart = Math.max(0, idx - PACE_WINDOW);
    const winEnd = idx;
    const winDist = cum[winEnd] - cum[winStart];
    const winTimeMs = points[winEnd].time - points[winStart].time;
    let paceMinPerKm = 0;
    if (winDist > 0.05 && winTimeMs > 0) {
      paceMinPerKm = winTimeMs / 1000 / 60 / winDist;
    }

    return { distKm, elapsedMs, paceMinPerKm, elevationM };
  });

  const coordinates: [number, number][] = points.map((p) => [p.lon, p.lat]);

  return {
    durationInFrames: TOTAL_FRAMES,
    fps: 30,
    width: 1080,
    height: 1920,
    props: {
      coordinates,
      frameToTrackIndex,
      frameMetrics,
      totalDistanceKm,
      totalDurationMs,
      runName,
      runDate,
    },
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0)
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function fmtPace(minPerKm: number): string {
  if (minPerKm <= 0 || minPerKm > 30) return "--:--";
  const m = Math.floor(minPerKm);
  const s = Math.floor((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Metric card ───────────────────────────────────────────────────────────────

const MetricCard: React.FC<{
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}> = ({ label, value, unit, accent = false }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
    }}
  >
    <span
      style={{
        fontSize: 38,
        fontWeight: 700,
        color: "#aaa",
        letterSpacing: 3,
        textTransform: "uppercase",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontSize: 110,
        fontWeight: 800,
        lineHeight: 1,
        color: accent ? STRAVA_ORANGE : "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textShadow: "0 2px 24px rgba(0,0,0,0.7)",
        letterSpacing: -2,
      }}
    >
      {value}
    </span>
    <span
      style={{
        fontSize: 36,
        fontWeight: 600,
        color: "#999",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {unit}
    </span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const RunStory: React.FC<RunStoryProps> = ({
  coordinates,
  frameToTrackIndex,
  frameMetrics,
  totalDistanceKm,
  totalDurationMs,
  runName,
  runDate,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapReadyRef = useRef(false);
  const loadHandleRef = useRef<number | null>(null);
  const coordsRef = useRef(coordinates);
  coordsRef.current = coordinates;

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    loadHandleRef.current = delayRender("map-init");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: coordinates[0],
      zoom: 14,
      interactive: false,
      fadeDuration: 0,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;

    map.on("load", () => {
      map.resize();

      // Fit to full route bounds with padding
      const lons = coordinates.map((c) => c[0]);
      const lats = coordinates.map((c) => c[1]);
      const bbox: [number, number, number, number] = [
        Math.min(...lons),
        Math.min(...lats),
        Math.max(...lons),
        Math.max(...lats),
      ];
      map.fitBounds(bbox, {
        padding: { top: 300, bottom: 700, left: 80, right: 80 },
        animate: false,
      });

      // Ghost route — full path, faint
      map.addSource("ghost", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates },
          properties: {},
        },
      });
      map.addLayer({
        id: "ghost-line",
        type: "line",
        source: "ghost",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 4, "line-opacity": 0.18 },
      });

      // Drawn route — animates per frame
      map.addSource("drawn", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "drawn-line",
        type: "line",
        source: "drawn",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": STRAVA_ORANGE,
          "line-width": 7,
          "line-opacity": 1,
        },
      });

      // Position marker
      map.addSource("marker", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "marker-halo",
        type: "circle",
        source: "marker",
        paint: {
          "circle-radius": 20,
          "circle-color": STRAVA_ORANGE,
          "circle-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "marker-dot",
        type: "circle",
        source: "marker",
        paint: {
          "circle-radius": 11,
          "circle-color": STRAVA_ORANGE,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
        },
      });

      mapReadyRef.current = true;
      continueRender(loadHandleRef.current!);
    });
    // No map.remove() — Remotion renders each frame fresh in the same page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Per-frame update ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const handle = delayRender("frame-update");
    const coords = coordsRef.current;
    const idx = frameToTrackIndex[frame] ?? 0;

    // Slice drawn route up to current track index
    const sliced = idx > 0 ? coords.slice(0, idx + 1) : [coords[0], coords[0]];
    (map.getSource("drawn") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: sliced },
      properties: {},
    });

    // Move position marker
    (map.getSource("marker") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features:
        idx > 0
          ? [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: coords[idx] },
                properties: {},
              },
            ]
          : [],
    });

    map.triggerRepaint();
    map.once("idle", () => continueRender(handle));
  }, [frame, frameToTrackIndex]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metrics = frameMetrics[frame] ?? frameMetrics[0];
  const { distKm, elapsedMs, paceMinPerKm, elevationM } = metrics;

  // Intro: fade in 0→20, hold, fade out at 25→35
  const introOpacity = interpolate(
    frame,
    [0, 15, 28, 38],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Metrics panel: fade in at 30, fade out at 440
  const metricsOpacity = interpolate(
    frame,
    [28, 45, 430, 445],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Outro final-totals overlay: fade in at 425
  const outroOpacity = interpolate(
    frame,
    [420, 435],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Outro scale pulse: subtle size grow on metrics in outro
  const outroScale = interpolate(frame, [420, 435], [1, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const metricsScale = frame >= 420 ? outroScale : 1;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Map canvas */}
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, width, height }}
      />

      {/* ── Intro card ───────────────────────────────────────────────────── */}
      <AbsoluteFill
        style={{
          opacity: introOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.52)",
          pointerEvents: "none",
          gap: 20,
        }}
      >
        <span
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: STRAVA_ORANGE,
            letterSpacing: 6,
            textTransform: "uppercase",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {runDate}
        </span>
        <span
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.1,
            maxWidth: 900,
            fontFamily: "system-ui, -apple-system, sans-serif",
            textShadow: "0 4px 32px rgba(0,0,0,0.8)",
          }}
        >
          {runName}
        </span>
      </AbsoluteFill>

      {/* ── Metrics overlay ───────────────────────────────────────────────── */}
      <AbsoluteFill
        style={{
          opacity: metricsOpacity,
          pointerEvents: "none",
          transform: `scale(${metricsScale})`,
          transformOrigin: "50% 100%",
        }}
      >
        {/* Gradient scrim so metrics read over any map colour */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 700,
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.88) 70%, rgba(0,0,0,0.95) 100%)",
          }}
        />

        {/* Metric grid — 2×2, bottom safe area (320 px inset) */}
        <div
          style={{
            position: "absolute",
            bottom: 340,
            left: 0,
            right: 0,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            rowGap: 48,
            columnGap: 0,
            padding: "0 60px",
          }}
        >
          <MetricCard
            label="Distance"
            value={distKm.toFixed(2)}
            unit="km"
            accent
          />
          <MetricCard
            label="Time"
            value={fmtTime(elapsedMs)}
            unit="elapsed"
          />
          <MetricCard
            label="Pace"
            value={fmtPace(paceMinPerKm)}
            unit="min / km"
          />
          <MetricCard
            label="Elevation"
            value={Math.round(elevationM).toString()}
            unit="m asl"
          />
        </div>

        {/* Thin orange accent line above metrics */}
        <div
          style={{
            position: "absolute",
            bottom: 1060,
            left: 60,
            right: 60,
            height: 3,
            background: `linear-gradient(to right, transparent, ${STRAVA_ORANGE}, transparent)`,
            opacity: 0.7,
          }}
        />
      </AbsoluteFill>

      {/* ── Outro — final totals banner ───────────────────────────────────── */}
      <AbsoluteFill
        style={{
          opacity: outroOpacity,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 280,
          gap: 12,
        }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.65)",
            borderRadius: 32,
            padding: "28px 64px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 38,
              fontWeight: 700,
              color: STRAVA_ORANGE,
              letterSpacing: 5,
              textTransform: "uppercase",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Final Stats
          </span>
          <span
            style={{
              fontSize: 86,
              fontWeight: 800,
              color: "#fff",
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: -1,
            }}
          >
            {totalDistanceKm.toFixed(2)} km
          </span>
          <span
            style={{
              fontSize: 52,
              fontWeight: 600,
              color: "#ccc",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {fmtTime(totalDurationMs)}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
