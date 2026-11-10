import { dimensions, racks, offsetLabel } from './model.js';
import { moduleOptics } from './optics.js';

export function renderControls(s, tab, open, commit) {
  const host = document.querySelector('#fields');
  host.replaceChildren();
  let grid;
  function section(name, subtitle = '') {
    const box = document.createElement('details');
    box.open = open.has(name);
    const summary = document.createElement('summary');
    summary.append(name);
    const value = document.createElement('small');
    value.textContent = subtitle;
    summary.append(value);
    box.append(summary);
    grid = document.createElement('div');
    grid.className = 'form-grid';
    box.append(grid);
    host.append(box);
    box.addEventListener('toggle', () => {
      if (box.isConnected) {
        if (box.open) open.add(name);
        else open.delete(name);
      }
    });
  }
  function field(path, title, spec = {}) {
    const [section, key] = path.split('.');
    const value = key ? s[section][key] : s[section];
    const label = document.createElement('label');
    label.textContent = title;
    if (spec.wide) label.classList.add('wide');
    const el = document.createElement(spec.options ? 'select' : 'input');
    el.id = 'input-' + path.replace('.', '-');
    if (spec.options) {
      for (const [id, title] of Object.entries(spec.options))
        el.add(new Option(title, id));
    } else {
      el.type = spec.type || 'number';
      if (el.type === 'checkbox') {
        label.className = 'wide check';
        el.checked = value;
        label.prepend(el);
      }
      if (el.type === 'number') {
        el.min = spec.min;
        el.max = spec.max;
        el.step = spec.integer ? 1 : 'any';
      }
      el.required = el.type !== 'checkbox';
    }
    if (el.type !== 'checkbox') {
      el.value = value;
      label.append(el);
    }
    if (spec.disabled) el.disabled = true;
    grid.append(label);
    el.addEventListener('change', () => {
      if (!el.reportValidity()) {
        el.value = value;
        return;
      }
      const next =
        el.type === 'checkbox'
          ? el.checked
          : el.type === 'number'
            ? Number(el.value)
            : el.value;
      commit(path, next);
      document.getElementById(el.id)?.focus({ preventScroll: true });
    });
  }
  const num = (path, title, min, max, integer = false) =>
    field(path, title, { min, max, integer });
  const select = (path, title, options, wide = true) =>
    field(path, title, { options, wide });
  const hint = (text) => {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = text;
    grid.append(p);
  };
  if (tab === 'site') {
    section('Site & day', offsetLabel(s.site.utcOffset));
    field('date', 'Simulation date', { type: 'date', wide: true });
    num('site.latitude', 'Latitude (° N)', -90, 90);
    num('site.longitude', 'Longitude (° E)', -180, 180);
    num('site.utcOffset', 'UTC offset (hours)', -12, 14);
    hint(
      'Enter the local UTC offset in effect on the selected date, including daylight saving time.',
    );
    return;
  }
  const r = s.racking,
    d = dimensions(s);
  section('Racking', racks[r.type]);
  select('racking.type', 'Mounting system', racks);
  num('racking.height', 'Axis height (m)', 0.2, 25);
  if (r.type === 'fixed') num('racking.tilt', 'Module tilt (°)', 0, 85);
  if (r.type === 'pergola') {
    num('racking.pergolaTilt', 'Pergola tilt (°)', 0, 85);
    select('racking.pergolaLayout', 'Row alignment', {
      aligned: 'Aligned',
      checkerboard: 'Checkerboard',
    });
  }
  if (r.type.endsWith('-axis'))
    num('racking.limit', 'Rotation limit (°)', 0, 85);
  num('racking.postSize', 'Post width (m)', 0.02, 0.5);
  field('array.azimuth', 'Facing azimuth (°)', {
    min: 0,
    max: 359.9,
    disabled: ['vertical', 'single-axis'].includes(r.type),
  });
  if (r.type === 'single-axis')
    field('racking.backtracking', 'Flat-terrain backtracking', {
      type: 'checkbox',
    });
  if (['single-axis', 'vertical'].includes(r.type))
    hint('Rows run north–south, with east–west facing modules.');
  section('PV module', s.module.power + ' W');
  select('module.bifacial', 'Construction', {
    false: 'Monofacial',
    true: 'Bifacial',
  });
  num('module.length', 'Length (m)', 0.1, 5);
  num('module.width', 'Width (m)', 0.1, 3);
  num('module.thickness', 'Thickness (m)', 0.005, 0.2);
  num('module.power', 'Rated power (W)', 1, 1500);
  num('module.gap', 'Module gap (m)', 0, 10);
  if (s.module.bifacial) {
    num('module.cellColumns', 'Cell columns', 1, 24, true);
    num('module.cellRows', 'Cell rows', 1, 48, true);
    num('module.cellGapX', 'Cell gap X (m)', 0, 0.2);
    num('module.cellGapY', 'Cell gap Y (m)', 0, 0.2);
    num('module.cellMargin', 'Perimeter (m)', 0, 0.2);
    num('module.gapTransmission', 'Broadband transmittance', 0, 1);
    num('module.gapParTransmission', 'PAR transmittance', 0, 1);
    const o = moduleOptics(s.module);
    hint(
      'Area-averaged transmission: ' +
        (100 * o.broadband).toFixed(2) +
        '% broadband · ' +
        (100 * o.par).toFixed(2) +
        '% PAR. Shadow tone uses broadband transmission.',
    );
  }
  section('Table & row', s.row.tables + ' tables / row');
  select('table.orientation', 'Module orientation', {
    portrait: 'Portrait',
    landscape: 'Landscape',
  });
  num('table.high', 'Modules across', 1, 5, true);
  num('table.wide', 'Modules along', 1, 20, true);
  num('row.tables', 'Tables per row', 1, 20, true);
  num('row.tableGap', 'Table gap (m)', 0.05, 30);
  hint(
    'Table width ' +
      d.width.toFixed(2) +
      ' m · row length ' +
      d.rowLength.toFixed(2) +
      ' m.',
  );
  section('Array layout', s.array.rows + ' rows');
  num('array.rows', 'Number of rows', 1, 24, true);
  num('rowPair.pitch', 'Row pitch (m)', 0.5, 120);
  num('array.groupSize', 'Rows per group', 1, 24, true);
  num('array.aisle', 'Extra aisle (m)', 0, 20);
}
