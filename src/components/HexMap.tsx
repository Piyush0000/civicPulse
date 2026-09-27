"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { Layer, PickingInfo } from "@deck.gl/core";

export type HexDatum = { h: string; v: number; hs?: boolean; em?: boolean; n?: number };
export type Ping = { id: string; lat: number; lng: number; color: string; born: number };
export type MapPoint = { lat: number; lng: number; color: string; label?: string; radius?: number };

const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/dark";
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// Sequential magnitude = one hue (cyan), dark -> bright on the dark basemap. Hotspots are outlined in
// rose and emerging cells in amber, so state never rides on the fill colour.
const RAMP: [number, number, number][] = [
  [10, 38, 56],
  [12, 86, 110],
  [14, 145, 178],
  [34, 211, 238],
  [165, 243, 252],
];
export function ramp(t: number, alpha = 200): [number, number, number, number] {
  const x = Math.max(0, Math.min(1, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const a = RAMP[i],
    b = RAMP[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, alpha];
}
export const RAMP_CSS = `linear-gradient(90deg, ${RAMP.map((c) => `rgb(${c.join(",")})`).join(", ")})`;

const hex2rgb = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export default function HexMap(props: {
  center: [number, number];
  zoom?: number;
  cells: HexDatum[];
  normalize?: "fixed100" | "quantile";
  extruded?: boolean;
  selected?: string | null;
  highlight?: Set<string> | null;
  outlines?: { cells: string[]; color: string }[];
  points?: MapPoint[];
  pings?: Ping[];
  onSelect?: (h: string | null) => void;
  onHover?: (d: HexDatum | null) => void;
  interactive?: boolean;
  opacity?: number;
  className?: string;
  autoRotate?: boolean;
  padLeftRatio?: number; // shift the visual centre right (e.g. hero map behind text)
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const overlay = useRef<MapboxOverlay | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [ready, setReady] = useState(false);

  // init once
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLE,
      center: [props.center[1], props.center[0]],
      zoom: props.zoom ?? 10.3,
      pitch: props.extruded ? 50 : 0,
      bearing: props.extruded ? -12 : 0,
      attributionControl: { compact: true },
      interactive: props.interactive !== false,
    });
    if (props.interactive !== false) m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    const ov = new MapboxOverlay({ interleaved: false, layers: [] });
    m.addControl(ov as unknown as maplibregl.IControl);
    if (props.padLeftRatio) m.setPadding({ left: Math.round(el.current.clientWidth * props.padLeftRatio), top: 0, right: 0, bottom: 0 });
    map.current = m;
    overlay.current = ov;
    m.on("load", () => setReady(true));
    return () => {
      m.remove();
      map.current = null;
      overlay.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-centre on region change
  useEffect(() => {
    map.current?.flyTo({ center: [props.center[1], props.center[0]], zoom: props.zoom ?? 10.3, duration: 1200 });
  }, [props.center, props.zoom]);

  useEffect(() => {
    map.current?.easeTo({ pitch: props.extruded ? 50 : 0, bearing: props.extruded ? -12 : 0, duration: 900 });
  }, [props.extruded]);

  // slow cinematic rotation (landing page)
  useEffect(() => {
    if (!props.autoRotate || !ready) return;
    let raf = 0;
    const tick = () => {
      const m = map.current;
      if (m) m.setBearing((m.getBearing() + 0.03) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.autoRotate, ready]);

  // animate pings
  const hasPings = (props.pings?.length ?? 0) > 0;
  useEffect(() => {
    if (!hasPings) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasPings]);

  // Stretch the observed range (p5..p99) so differences between areas are visible.
  const norm = useMemo(() => {
    const vals = props.cells.map((c) => c.v).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] ?? 1;
    const lo = props.normalize === "fixed100" ? q(0.05) : 0;
    const hi = q(0.99) || 1;
    return (v: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
  }, [props.cells, props.normalize]);

  useEffect(() => {
    if (!overlay.current) return;
    const layers: Layer[] = [];
    const op = props.opacity ?? 1;
    layers.push(
      new H3HexagonLayer<HexDatum>({
        id: "cells",
        data: props.cells,
        getHexagon: (d) => d.h,
        getFillColor: (d) => {
          const t = norm(d.v);
          const dim = props.highlight && !props.highlight.has(d.h);
          return ramp(t, dim ? 30 : Math.round((25 + 225 * Math.pow(t, 0.8)) * op));
        },
        extruded: !!props.extruded,
        // Non-linear height: the top of the distribution rises as towers, the rest stays low.
        getElevation: (d) => Math.pow(norm(d.v), 2.6) * 3200,
        elevationScale: 1,
        stroked: true,
        getLineColor: (d) => (d.h === props.selected ? [255, 255, 255, 255] : d.hs ? [255, 90, 120, 230] : d.em ? [253, 224, 71, 220] : [6, 10, 19, 90]),
        getLineWidth: (d) => (d.h === props.selected ? 3 : d.hs || d.em ? 2 : 0.5),
        lineWidthUnits: "pixels",
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 60],
        material: { ambient: 0.6, diffuse: 0.6, shininess: 40 },
        updateTriggers: {
          getFillColor: [norm, props.highlight, op],
          getLineColor: [props.selected],
          getLineWidth: [props.selected],
          getElevation: [norm],
        },
        transitions: { getElevation: 700, getFillColor: 500 },
        onClick: (info: PickingInfo<HexDatum>) => props.onSelect?.(info.object?.h ?? null),
        onHover: (info: PickingInfo<HexDatum>) => props.onHover?.(info.object ?? null),
      }),
    );
    for (const [i, o] of (props.outlines ?? []).entries()) {
      layers.push(
        new H3HexagonLayer<string>({
          id: `outline-${i}`,
          data: o.cells,
          getHexagon: (d) => d,
          filled: false,
          stroked: true,
          extruded: false,
          getLineColor: [...hex2rgb(o.color), 230],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
        }),
      );
    }
    if (props.points?.length) {
      layers.push(
        new ScatterplotLayer<MapPoint>({
          id: "points",
          data: props.points,
          getPosition: (d) => [d.lng, d.lat],
          getFillColor: (d) => [...hex2rgb(d.color), 230],
          getLineColor: [6, 10, 19, 255],
          stroked: true,
          lineWidthMinPixels: 1,
          getRadius: (d) => d.radius ?? 60,
          radiusMinPixels: 3,
          radiusMaxPixels: 8,
          pickable: true,
        }),
      );
    }
    if (props.pings?.length) {
      const live = props.pings.filter((p) => now - p.born < 6000);
      layers.push(
        new ScatterplotLayer<Ping>({
          id: "pings",
          data: live,
          getPosition: (d) => [d.lng, d.lat],
          getFillColor: (d) => [...hex2rgb(d.color), Math.max(0, 200 - ((now - d.born) % 2000) / 10)],
          getRadius: (d) => 80 + ((now - d.born) % 2000) * 0.9,
          radiusUnits: "meters",
          stroked: true,
          getLineColor: (d) => [...hex2rgb(d.color), 255],
          lineWidthMinPixels: 1.5,
          filled: true,
          updateTriggers: { getFillColor: [now], getRadius: [now] },
        }),
        new ScatterplotLayer<Ping>({
          id: "ping-core",
          data: live,
          getPosition: (d) => [d.lng, d.lat],
          getFillColor: [255, 255, 255, 255],
          getRadius: 5,
          radiusUnits: "pixels",
        }),
      );
    }
    overlay.current.setProps({ layers });
  }, [props.cells, props.extruded, props.selected, props.highlight, props.outlines, props.points, props.pings, norm, now, props.opacity, props]);

  return <div ref={el} className={props.className ?? "h-full w-full"} />;
}
