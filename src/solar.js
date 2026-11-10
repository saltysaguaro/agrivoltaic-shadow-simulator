import { Vector3 } from 'three';
const r = Math.PI / 180;
// NOAA fractional-year approximation; geometric sun, no atmospheric refraction.
export function solarPosition(date, minute, site) {
  const day =
    Math.floor(
      (Date.parse(date + 'T12:00:00Z') -
        Date.UTC(Number(date.slice(0, 4)), 0, 1)) /
        86400000,
    ) + 1;
  const year = Number(date.slice(0, 4)),
    days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  const g = ((2 * Math.PI) / days) * (day - 1 + (minute / 60 - 12) / 24);
  const eq =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const dec =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const h = (minute + eq + 4 * site.longitude - 60 * site.utcOffset) / 4 - 180,
    lat = site.latitude * r;
  return new Vector3(
    -Math.cos(dec) * Math.sin(h * r),
    Math.cos(lat) * Math.sin(dec) -
      Math.sin(lat) * Math.cos(dec) * Math.cos(h * r),
    Math.sin(lat) * Math.sin(dec) +
      Math.cos(lat) * Math.cos(dec) * Math.cos(h * r),
  ).normalize();
}
