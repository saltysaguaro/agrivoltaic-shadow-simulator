import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import {
  initial,
  axes,
  pose,
  daylight,
  frameTimes,
  dimensions,
  setRack,
  fitHardware,
  opticsValid,
  radians,
} from '../src/model.js';
import { solarPosition } from '../src/solar.js';
import { moduleOptics } from '../src/optics.js';

const design = () => structuredClone(initial);
const at = (s, m) => solarPosition(s.date, m, s.site);
test('summer sun crosses from east to west over Tucson and peaks south of zenith', () => {
  const s = design();
  assert.ok(at(s, 540).x > 0 && at(s, 960).x < 0);
  const noon = at(s, 745);
  assert.ok(noon.z > 0.98 && noon.y < 0);
  const { start, end } = daylight(s);
  assert.ok(start > 310 && start < 330 && end > 1160 && end < 1180);
  assert.ok(
    at(s, start - 1).z <= 0 &&
      at(s, start).z > 0 &&
      at(s, end).z > 0 &&
      at(s, end + 1).z <= 0,
  );
});
test('local offsets allow fractional hours and shift the same solar instant', () => {
  const s = design(),
    initialSun = at(s, 720);
  s.site.utcOffset += 0.5;
  assert.ok(initialSun.distanceTo(at(s, 750)) < 0.001);
});
test('polar days and nights stay within the selected civil date', () => {
  const s = design();
  s.site.latitude = 89;
  assert.deepEqual(daylight(s), { start: 0, end: 1439, dark: false });
  s.date = '2026-12-21';
  assert.deepEqual(daylight(s), { start: 0, end: 1439, dark: true });
});
test('single-axis tracking reverses with the sun and backtracking flattens a low-angle pose', () => {
  const s = design();
  setRack(s, 'single-axis');
  s.racking.backtracking = false;
  const low = new Vector3(1, 0, 0.05).normalize();
  assert.equal(pose(s, low).tilt, 60);
  assert.equal(pose(s, new Vector3(-1, 0, 0.05).normalize()).tilt, -60);
  s.racking.backtracking = true;
  assert.ok(pose(s, low).tilt > 0 && pose(s, low).tilt < 15);
  assert.deepEqual(pose(s, new Vector3(0, 0, -1)), { tilt: 0, yaw: 0 });
});
test('dual-axis module normals face the sun for arbitrary layout azimuth', () => {
  const s = design();
  setRack(s, 'dual-axis');
  s.array.azimuth = 237;
  const sun = new Vector3(0.5, -0.4, 0.75).normalize();
  const { tilt, yaw } = pose(s, sun),
    { u, v } = axes(s);
  const normal = u
    .multiplyScalar(Math.sin(radians(yaw)))
    .addScaledVector(v, -Math.cos(radians(yaw)))
    .multiplyScalar(Math.sin(radians(tilt)))
    .setZ(Math.cos(radians(tilt)));
  assert.ok(sun.distanceTo(normal) < 1e-10);
});
test('fixed, vertical and pergola hardware have the specified inclination', () => {
  const s = design();
  const sun = at(s, 720);
  assert.equal(pose(s, sun).tilt, 25);
  setRack(s, 'vertical');
  assert.equal(pose(s, sun).tilt, 90);
  assert.equal(s.module.bifacial, true);
  setRack(s, 'pergola');
  s.racking.pergolaTilt = 16;
  assert.equal(pose(s, sun).tilt, 16);
});
test('table dimensions, grouped module count and tracker clearance', () => {
  const s = design();
  assert.equal(dimensions(s).modules, 72);
  assert.equal(dimensions(s).kw, 39.6);
  s.table.orientation = 'landscape';
  assert.equal(dimensions(s).along, s.module.length);
  setRack(s, 'dual-axis');
  fitHardware(s);
  const d = dimensions(s);
  assert.ok(s.rowPair.pitch > Math.hypot(d.length, d.width));
  assert.ok(d.length + s.row.tableGap > Math.hypot(d.length, d.width));
});
test('opaque and transmitting hardware use valid fitted cell dimensions', () => {
  const s = design();
  assert.equal(moduleOptics(s.module).broadband, 0);
  setRack(s, 'vertical');
  assert.ok(moduleOptics(s.module).broadband > 0);
  s.module.cellGapX = 0.2;
  s.module.cellColumns = 24;
  assert.equal(opticsValid(s), false);
});
test('GIF includes both daylight endpoints once, even for a short or uneven interval', () => {
  assert.deepEqual(frameTimes(322, 350, 10), [322, 332, 342, 350]);
  assert.deepEqual(frameTimes(322, 342, 10), [322, 332, 342]);
  assert.deepEqual(frameTimes(322, 322, 10), [322]);
});
