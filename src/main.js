import './style.css';
import { icon } from './icons.js';
import { Field } from './scene.js';
import { solarPosition } from './solar.js';
import {
  initial,
  dimensions,
  daylight,
  clock,
  degrees,
  setRack,
  fitHardware,
  opticsValid,
  frameTimes,
  offsetLabel,
} from './model.js';
import { renderControls } from './controls.js';
import { exportGif } from './export.js';
const $ = (s) => document.querySelector(s);
let study = structuredClone(initial),
  minute = 540,
  tab = 'system',
  field,
  timer = null,
  bounds,
  aborter,
  cameraPreset = '3d';
const open = new Set(['Racking', 'Array layout', 'Site & day']);
function cameraButtons(view) {
  document
    .querySelectorAll('[data-view]')
    .forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === view));
}
try {
  field = new Field($('#field'), cameraButtons);
  field.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    aborter?.abort();
    stop();
    $('#export').disabled = true;
    $('#render-error').hidden = false;
    $('#render-error').textContent =
      'Graphics context lost. Reload this page to restore the array view.';
  });
} catch {
  $('#render-error').hidden = false;
  $('#render-error').textContent =
    'This view needs WebGL 2. Enable hardware acceleration or open the simulator in a WebGL-capable browser.';
  $('#export').disabled = true;
}
function displayTime(t) {
  minute = t;
  const sun = solarPosition(study.date, t, study.site);
  field?.updateSun(sun);
  $('#scene-time').textContent = clock(t);
  $('#scene-date').textContent = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(study.date + 'T12:00:00Z'));
  $('#minute').value = t;
  $('#minute').setAttribute('aria-valuetext', clock(t));
  $('#marker').style.left =
    (100 * (t - bounds.start)) / Math.max(1, bounds.end - bounds.start) + '%';
  $('#elevation').textContent = degrees(Math.asin(sun.z)).toFixed(1) + '°';
  $('#azimuth').textContent =
    ((degrees(Math.atan2(sun.x, sun.y)) + 360) % 360).toFixed(1) + '°';
}
function updateTimeline() {
  bounds = daylight(study);
  $('#minute').min = bounds.start;
  $('#minute').max = bounds.end;
  $('#start').textContent = clock(bounds.start);
  $('#end').textContent = clock(bounds.end);
  $('#mid').textContent = clock((bounds.start + bounds.end) / 2);
  const path = [];
  for (let i = 0; i <= 100; i++) {
    const t = bounds.start + ((bounds.end - bounds.start) * i) / 100;
    const y =
      40 -
      38 *
        Math.max(
          0,
          degrees(Math.asin(solarPosition(study.date, t, study.site).z)) / 90,
        );
    path.push((i === 0 ? 'M' : 'L') + i * 10 + ' ' + y.toFixed(2));
  }
  $('#sunpath').innerHTML =
    '<path d="' +
    path.join(' ') +
    ' L1000 40H0Z" fill="#f5ebcd"/><path d="' +
    path.join(' ') +
    '" fill="none" stroke="#bd9147" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
  $('#day-length').textContent = bounds.dark
    ? 'Polar night · no direct shadows'
    : bounds.start === 0 && bounds.end === 1439
      ? 'Full local day'
      : 'Daylight · ' + clock(bounds.start) + '–' + clock(bounds.end);
  const { latitude, longitude, utcOffset } = study.site;
  $('#site-info').textContent =
    Math.abs(latitude).toFixed(2) +
    '° ' +
    (latitude < 0 ? 'S' : 'N') +
    '  ' +
    Math.abs(longitude).toFixed(2) +
    '° ' +
    (longitude < 0 ? 'W' : 'E') +
    '  ·  ' +
    offsetLabel(utcOffset);
}
function controls() {
  renderControls(study, tab, open, change);
}
function build(refit = false) {
  field?.build(study);
  if (refit) {
    field?.view(cameraPreset);
    cameraButtons(cameraPreset);
  }
  const d = dimensions(study);
  $('#modules').textContent = d.modules.toLocaleString();
  $('#capacity').innerHTML = Number(d.kw.toFixed(2)) + ' <em>kW</em>';
}
function change(path, value) {
  stop();
  const next = structuredClone(study),
    [group, key] = path.split('.');
  if (path === 'racking.type') setRack(next, value);
  else if (key)
    next[group][key] = path === 'module.bifacial' ? value === 'true' : value;
  else next[group] = value;
  if (!opticsValid(next)) {
    $('#notice').textContent =
      'The cell gaps and perimeter must fit inside the module.';
    controls();
    return;
  }
  if (path === 'date' && !/^\d{4}-\d\d-\d\d$/.test(value)) {
    controls();
    return;
  }
  if (
    group === 'site' &&
    key === 'utcOffset' &&
    !Number.isInteger(value * 60)
  ) {
    $('#notice').textContent = 'Enter a UTC offset in whole minutes.';
    controls();
    return;
  }
  const isSite = group === 'site' || path === 'date';
  const before = [next.racking.height, next.rowPair.pitch, next.row.tableGap];
  if (!isSite) fitHardware(next);
  const changes = ['axis height', 'row pitch', 'table gap'].filter(
    (_, i) =>
      before[i] !==
      [next.racking.height, next.rowPair.pitch, next.row.tableGap][i],
  );
  $('#notice').textContent = changes.length
    ? 'Adjusted ' + changes.join(', ') + ' for hardware clearance.'
    : '';
  study = next;
  if (isSite) updateTimeline();
  else build();
  controls();
  displayTime(Math.max(bounds.start, Math.min(minute, bounds.end)));
}
function switchTab(next) {
  tab = next;
  $('#system-tab').setAttribute('aria-pressed', tab === 'system');
  $('#site-tab').setAttribute('aria-pressed', tab === 'site');
  controls();
}
$('#system-tab').onclick = () => switchTab('system');
$('#site-tab').onclick = () => switchTab('site');
$('#edit-site').onclick = () => {
  open.add('Site & day');
  switchTab('site');
  $('#input-date').focus();
};
document.querySelectorAll('[data-view]').forEach(
  (b) =>
    (b.onclick = () => {
      cameraPreset = b.dataset.view;
      field?.view(cameraPreset);
      cameraButtons(cameraPreset);
    }),
);
$('#fit').onclick = () => {
  field?.view(cameraPreset);
  cameraButtons(cameraPreset);
};
function stop() {
  clearInterval(timer);
  timer = null;
  $('#play').innerHTML = icon('play') + '<span>Play day</span>';
}
$('#play').onclick = () => {
  if (timer !== null) {
    stop();
    return;
  }
  if (minute >= bounds.end) displayTime(bounds.start);
  let last = performance.now(),
    cursor = minute;
  $('#play').innerHTML = icon('pause') + '<span>Pause</span>';
  timer = setInterval(() => {
    const now = performance.now();
    cursor += (now - last) * 0.06 * Number($('#speed').value);
    last = now;
    displayTime(Math.min(bounds.end, Math.round(cursor)));
    if (cursor >= bounds.end) stop();
  }, 50);
};
$('#minute').oninput = (e) => {
  stop();
  displayTime(Number(e.target.value));
};
const dialog = $('#export-dialog');
function clearGifLink() {
  const link = $('#gif-link');
  if (link.hasAttribute('href')) URL.revokeObjectURL(link.href);
  link.removeAttribute('href');
  link.hidden = true;
}
dialog.addEventListener('close', clearGifLink);
function times() {
  return frameTimes(bounds.start, bounds.end, Number($('#interval').value));
}
function estimate() {
  const count = times().length;
  $('#estimate').textContent =
    count +
    ' frames · ' +
    (count / Number($('#fps').value)).toFixed(1) +
    ' seconds · looping GIF';
}
$('#export').onclick = () => {
  stop();
  $('#progress').textContent = '';
  $('#export-summary').textContent =
    study.date +
    ' · ' +
    clock(bounds.start) +
    '–' +
    clock(bounds.end) +
    ' ' +
    offsetLabel(study.site.utcOffset) +
    ' · current camera view';
  estimate();
  dialog.showModal();
};
$('#interval').onchange = $('#fps').onchange = estimate;
dialog.addEventListener('cancel', (e) => {
  if (aborter) {
    e.preventDefault();
    aborter.abort();
  }
});
$('#cancel').onclick = () => aborter?.abort();
$('#save').onclick = async () => {
  if (aborter || !field) return;
  clearGifLink();
  const saved = minute;
  aborter = new AbortController();
  const bar = $('progress');
  bar.hidden = false;
  bar.value = 0;
  $('#cancel').hidden = false;
  dialog
    .querySelectorAll('select,#save,#close')
    .forEach((el) => (el.disabled = true));
  try {
    const blob = await exportGif({
      field,
      study,
      times: times(),
      width: Number($('#width').value),
      fps: Number($('#fps').value),
      signal: aborter.signal,
      onFrame: (m, i, n) => {
        displayTime(m);
        bar.value = (i + 1) / n;
        $('#progress').textContent =
          'Rendering frame ' + (i + 1) + ' of ' + n + '…';
      },
    });
    const url = URL.createObjectURL(blob),
      a = $('#gif-link');
    a.href = url;
    a.download = 'agrivoltaic-shadows-' + study.date + '.gif';
    a.hidden = false;
    a.click();
    $('#progress').textContent = 'GIF exported.';
  } catch (e) {
    $('#progress').textContent =
      e.name === 'AbortError'
        ? 'Export canceled.'
        : 'Export failed. ' + e.message;
  } finally {
    aborter = null;
    $('#cancel').hidden = true;
    bar.hidden = true;
    dialog
      .querySelectorAll('select,#save,#close')
      .forEach((el) => (el.disabled = false));
    displayTime(saved);
  }
};
controls();
updateTimeline();
build(true);
displayTime(minute);
