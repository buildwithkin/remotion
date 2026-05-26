import React, { useEffect, useRef } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  continueRender,
  delayRender,
} from "remotion";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";

// ── Stops ──────────────────────────────────────────────────────────────────────
const LA: [number, number] = [-118.2437, 34.0522];
const NY: [number, number] = [-74.006, 40.7128];
const NY_STATE: [number, number] = [-75.4, 43.0]; // centroid for state-level view

// ── Beat timing (frames @ 30 fps) ─────────────────────────────────────────────
const T = {
  laZoomEnd: 70,    // pull-in on LA done
  laNyEnd: 210,     // 7 s — red line arrives at NYC; zoom-out + outline both start here
  nyZoomOut: 270,   // camera settled over NY State (60 frames after arrival)
  outlineEnd: 330,  // NY outline fully drawn (120 frames after arrival)
} as const;

// ── LA→NY great-circle route ───────────────────────────────────────────────────
const laNyLine = turf.greatCircle(turf.point(LA), turf.point(NY), { npoints: 120 });
const laNyLen = turf.length(laNyLine, { units: "kilometers" });

// ── Helpers ────────────────────────────────────────────────────────────────────
type GeoLine = GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>;

function sliceRoute(line: GeoLine, totalLen: number, progress: number) {
  const dist = Math.max(0.001, Math.min(progress, 0.9999) * totalLen);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return turf.lineSliceAlong(line as any, 0, dist, { units: "kilometers" });
}

function pointOnRoute(line: GeoLine, totalLen: number, progress: number): [number, number] {
  const dist = Math.max(0.001, Math.min(progress, 0.9999) * totalLen);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return turf.along(line as any, dist, { units: "kilometers" }).geometry.coordinates as [number, number];
}


// ── MapLibre style ─────────────────────────────────────────────────────────────
// Set STADIA_KEY=your_key in a .env file (never commit that file).
const STADIA_KEY = process.env.STADIA_KEY ?? "";

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    watercolor: {
      type: "raster",
      tiles: [`https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${STADIA_KEY}`],
      tileSize: 256,
      attribution: "© Stamen Design © Stadia Maps © OpenStreetMap",
    },
  },
  layers: [
    { id: "watercolor", type: "raster", source: "watercolor", minzoom: 0, maxzoom: 16 },
  ],
};

// ── Component ──────────────────────────────────────────────────────────────────
export const TravelMap: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapReadyRef = useRef(false);
  const loadHandleRef = useRef<number | null>(null);

  // NY State outline (set once on load)
  const nyOutlineRef = useRef<GeoJSON.Feature<GeoJSON.LineString> | null>(null);
  const nyOutlineLenRef = useRef<number>(0);

  // ── Map init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    loadHandleRef.current = delayRender("map-init");

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: LA,
      zoom: 4,
      interactive: false,
      fadeDuration: 0,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });

    mapRef.current = map;

    map.on("load", async () => {
      map.resize();

      // US country highlight
      map.addSource("countries", {
        type: "geojson",
        data: "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson",
      });
      map.addLayer({
        id: "country-fill",
        type: "fill",
        source: "countries",
        filter: ["match", ["get", "iso_a2"], ["US"], true, false],
        paint: { "fill-color": "#8b6914", "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: "country-line",
        type: "line",
        source: "countries",
        filter: ["match", ["get", "iso_a2"], ["US"], true, false],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#3a2e1f", "line-width": 2 },
      });

      // LA→NY route (updated per frame)
      map.addSource("route", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#e63322", "line-width": 8, "line-opacity": 0.92 },
      });

      // City markers — LA + NY only
      map.addSource("cities", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            { type: "Feature", geometry: { type: "Point", coordinates: LA }, properties: { name: "Los Angeles" } },
            { type: "Feature", geometry: { type: "Point", coordinates: NY }, properties: { name: "New York" } },
          ],
        },
      });
      map.addLayer({
        id: "city-dots",
        type: "circle",
        source: "cities",
        paint: {
          "circle-radius": 14,
          "circle-color": "#8b4513",
          "circle-stroke-color": "#3a2e1f",
          "circle-stroke-width": 3,
        },
      });
      map.addLayer({
        id: "city-labels",
        type: "symbol",
        source: "cities",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 44,
          "text-offset": [0, 1.6],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#3a2e1f",
          "text-halo-color": "#f5f0e8",
          "text-halo-width": 4,
        },
      });

      // ── NY State: fetch, build scribble, add layers ───────────────────────
      try {
        const resp = await fetch(
          "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"
        );
        const statesGeo = await resp.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nyFeature = statesGeo.features.find((f: any) => f.properties.name === "New York");

        if (nyFeature) {
          // Extract the largest single polygon (handles MultiPolygon)
          const geom = nyFeature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
          let ring: number[][];
          if (geom.type === "Polygon") {
            ring = geom.coordinates[0];
          } else {
            ring = geom.coordinates.reduce(
              (best: number[][][], poly: number[][][]) =>
                poly[0].length > best[0].length ? poly : best,
              geom.coordinates[0]
            )[0];
          }
          const nyPolygon = turf.polygon([ring]);

          // Build a closed LineString from the polygon ring and store its length
          const closedRing = [...ring, ring[0]] as [number, number][];
          const outlineLine = turf.lineString(closedRing);
          nyOutlineRef.current = outlineLine;
          nyOutlineLenRef.current = turf.length(outlineLine, { units: "kilometers" });

          // NY State outline layer (animated thick red line, updated per frame)
          map.addSource("ny-outline", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "ny-outline-line",
            type: "line",
            source: "ny-outline",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#e63322",
              "line-width": 12,
              "line-opacity": 0.92,
              "line-dasharray": [0.1, 1.8],
            },
          });
        }
      } catch (e) {
        console.error("NY state fetch failed", e);
      }

      mapReadyRef.current = true;
      continueRender(loadHandleRef.current!);
    });

    // No map.remove() — Remotion render lifecycle requirement
  }, []);

  // ── Per-frame update ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const handle = delayRender("frame");

    // ── Route progress ────────────────────────────────────────────────────────
    const laNyProg = interpolate(frame, [T.laZoomEnd, T.laNyEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });

    (map.getSource("route") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: laNyProg > 0
        ? [sliceRoute(laNyLine, laNyLen, laNyProg) as GeoJSON.Feature]
        : [],
    });

    // ── NY outline draw progress (starts immediately when line arrives) ──────
    const outlineProg = interpolate(frame, [T.laNyEnd, T.outlineEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });

    const outlineLine = nyOutlineRef.current;
    const outlineLen = nyOutlineLenRef.current;
    if (outlineLine && outlineLen > 0 && outlineProg > 0) {
      (map.getSource("ny-outline") as maplibregl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [sliceRoute(outlineLine, outlineLen, outlineProg) as GeoJSON.Feature],
      });
    }

    // ── Camera — direct zoom control (no altitude/pitch distortion) ──────────
    // zoom 5.8 → at 1080 px wide, NY State (8° lon) occupies ~316 px ≈ 29 % of screen.
    if (frame < T.laZoomEnd) {
      // Beat 1: pull into LA
      const zoom = interpolate(frame, [0, T.laZoomEnd], [3, 5.5], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
      map.jumpTo({ center: LA, zoom, bearing: 0, pitch: 0 });

    } else if (frame < T.laNyEnd) {
      // Beat 2: center follows route head; zoom pulls back mid-flight then zooms into NYC
      const head = pointOnRoute(laNyLine, laNyLen, Math.min(laNyProg, 0.999));
      const zoom = interpolate(laNyProg, [0, 0.4, 1], [5.5, 4.0, 6.5], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      map.jumpTo({ center: head, zoom, bearing: 0, pitch: 0 });

    } else {
      // Beats 3+4: pan from NYC to NY State centroid, zoom out to show whole state
      const panT = interpolate(frame, [T.laNyEnd, T.nyZoomOut], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
      const lng = interpolate(panT, [0, 1], [NY[0], NY_STATE[0]]);
      const lat = interpolate(panT, [0, 1], [NY[1], NY_STATE[1]]);
      const zoom = interpolate(panT, [0, 1], [6.5, 5.8], {
        easing: Easing.inOut(Easing.cubic),
      });
      map.jumpTo({ center: [lng, lat], zoom, bearing: 0, pitch: 0 });
    }

    map.triggerRepaint();
    map.once("idle", () => continueRender(handle));
  }, [frame]);

  return (
    <AbsoluteFill>
      <div ref={containerRef} style={{ position: "absolute", top: 0, left: 0, width, height }} />

      {/* Paper grain */}
      <AbsoluteFill style={{ mixBlendMode: "soft-light", opacity: 0.12, pointerEvents: "none" }}>
        <svg width="100%" height="100%">
          <defs>
            <filter id="grain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="4" seed={frame} />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
