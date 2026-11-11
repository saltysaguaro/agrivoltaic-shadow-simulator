import { Vector3 } from 'three';
import { solarPosition } from './solar.js';
import { moduleOptics } from './optics.js';

export const racks = {
  fixed: 'Fixed tilt',
  'single-axis': 'Single-axis tracker',
  'dual-axis': 'Dual-axis tracker',
  pergola: 'Raised pergola',
  vertical: 'Vertical bifacial',
};
export const initial = {
  module: {
    length: 2.278,
    width: 1.134,
    thickness: 0.035,
    power: 550,
    gap: 0.02,
    bifacial: false,
    cellColumns: 6,
    cellRows: 12,
    cellGapX: 0.002,
    cellGapY: 0.002,
    cellMargin: 0.01,
    gapTransmission: 0.9,
    gapParTransmission: 0.9,
  },
  racking: {
    type: 'fixed',
    tilt: 25,
    pergolaTilt: 0,
    limit: 60,
    backtracking: true,
    postSize: 0.12,
    height: 2.8,
    pergolaLayout: 'aligned',
  },
  table: { orientation: 'portrait', high: 1, wide: 6 },
  row: { tables: 3, tableGap: 0.3 },
  rowPair: { pitch: 6 },
  array: { rows: 4, azimuth: 180, groupSize: 4, aisle: 3 },
  crops: { species: 'none', rotated: false },
  site: { latitude: 32.22, longitude: -110.97, utcOffset: -7 },
  date: '2026-06-21',
};
export const radians = (angle) => (angle * Math.PI) / 180;
export const degrees = (angle) => (angle * 180) / Math.PI;
export function dimensions(s) {
  const portrait = s.table.orientation === 'portrait';
  const along = portrait ? s.module.width : s.module.length;
  const cross = portrait ? s.module.length : s.module.width;
  const span = (count, size, gap) => count * size + (count - 1) * gap;
  const width = span(s.table.high, cross, s.module.gap);
  const length = span(s.table.wide, along, s.module.gap);
  const rowLength = span(s.row.tables, length, s.row.tableGap);
  const modules = s.table.high * s.table.wide * s.row.tables * s.array.rows;
  return {
    along,
    cross,
    width,
    length,
    rowLength,
    modules,
    kw: (modules * s.module.power) / 1000,
  };
}
export function axes(s) {
  const a = radians(s.array.azimuth);
  return {
    u: new Vector3(-Math.cos(a), Math.sin(a), 0),
    v: new Vector3(-Math.sin(a), -Math.cos(a), 0),
  };
}
export function pose(s, sun) {
  const r = s.racking;
  if (r.type === 'vertical') return { tilt: 90, yaw: 0 };
  if (r.type === 'pergola') return { tilt: r.pergolaTilt, yaw: 0 };
  if (r.type === 'fixed') return { tilt: r.tilt, yaw: 0 };
  if (sun.z <= 0) return { tilt: 0, yaw: 0 };
  const { u, v } = axes(s);
  if (r.type === 'dual-axis')
    return {
      tilt: Math.min(r.limit, degrees(Math.acos(Math.min(1, sun.z)))),
      yaw: degrees(Math.atan2(sun.dot(u), -sun.dot(v))),
    };
  let tilt = degrees(Math.atan2(-sun.dot(v), sun.z));
  if (r.backtracking) {
    const spacing =
      (s.rowPair.pitch / dimensions(s).width) * Math.cos(radians(tilt));
    if (spacing < 1)
      tilt -= Math.sign(tilt) * degrees(Math.acos(Math.max(0, spacing)));
  }
  return { tilt: Math.max(-r.limit, Math.min(r.limit, tilt)), yaw: 0 };
}
export function setRack(s, type) {
  s.racking.type = type;
  s.racking.limit = type === 'dual-axis' ? 85 : 60;
  s.racking.tilt = 25;
  s.racking.pergolaTilt = 0;
  s.racking.pergolaLayout = 'aligned';
  s.racking.backtracking = true;
  if (type === 'vertical') s.module.bifacial = true;
  s.array.azimuth = ['vertical', 'single-axis', 'dual-axis'].includes(type)
    ? 90
    : s.site.latitude < 0
      ? 0
      : 180;
}
export function fitHardware(s) {
  const d = dimensions(s),
    r = s.racking;
  const tracking = r.type.endsWith('-axis');
  const tilt = tracking ? r.limit : pose(s, new Vector3(0, 0, 1)).tilt;
  const diagonal = Math.hypot(d.width, d.length);
  const up = (n) => Math.ceil(n * 100) / 100;
  r.height = Math.max(
    r.height,
    up(0.25 + 0.5 * (d.width * Math.sin(radians(tilt)) + s.module.thickness)),
  );
  const minPitch =
    r.type === 'dual-axis'
      ? diagonal
      : tracking
        ? d.width
        : d.width * Math.cos(radians(tilt)) +
          s.module.thickness * Math.sin(radians(tilt));
  s.rowPair.pitch = Math.max(s.rowPair.pitch, up(minPitch + 0.05));
  if (r.type === 'dual-axis')
    s.row.tableGap = Math.max(s.row.tableGap, up(diagonal + 0.05 - d.length));
}
export function opticsValid(s) {
  const o = moduleOptics(s.module);
  return !s.module.bifacial || (o.cellLength > 0 && o.cellWidth > 0);
}
export function daylight(s) {
  let first = null,
    last = null;
  for (let m = 0; m < 1440; m++) {
    if (solarPosition(s.date, m, s.site).z > 0) {
      first ??= m;
      last = m;
    }
  }
  return first === null
    ? { start: 0, end: 1439, dark: true }
    : { start: first, end: last, dark: false };
}
export function frameTimes(start, end, step) {
  const times = [];
  for (let t = start; t < end; t += step) times.push(t);
  times.push(end);
  return times;
}
export function clock(minute) {
  const m = Math.round(minute);
  return [Math.floor(m / 60), m % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
export function offsetLabel(n) {
  return 'UTC' + (n < 0 ? '−' : '+') + clock(Math.abs(n) * 60);
}
