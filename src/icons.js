const paths = {
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4',
  sliders: 'M3 6h8m5 0h5m-18 6h3m5 0h10M3 18h11m5 0h2M11 3v6m-5 0v6m8 0v6',
  panels: 'm6 5-4 12h17l4-12zm-2 6h17M12 5 8 17m10-12-4 12m-3 0-1 4m-4 0h9',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  cube: 'm12 2 9 5v10l-9 5-9-5V7zm0 10 9-5m-9 5L3 7m9 5v10',
  fit: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0zm-4-10v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2',
  play: 'm7 4 12 8-12 8z',
  pause: 'M8 4v16m8-16v16',
  edit: 'm4 16-1 5 5-1L20 8l-4-4zm9-9 4 4',
  close: 'm5 5 14 14M19 5 5 19',
};
export const icon = (name) =>
  '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' +
  paths[name] +
  '"/></svg>';
document.querySelectorAll('[data-icon]').forEach((el) => {
  el.outerHTML = icon(el.dataset.icon);
});
