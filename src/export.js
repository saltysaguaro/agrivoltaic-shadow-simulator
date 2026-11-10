import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { clock, offsetLabel } from './model.js';

export async function exportGif({
  field,
  study,
  times,
  width,
  fps,
  signal,
  onFrame,
}) {
  const canvas = document.createElement('canvas');
  const height = Math.max(
    2,
    Math.min(
      1600,
      Math.round((width * field.canvas.height) / field.canvas.width),
    ),
  );
  canvas.width = width;
  canvas.height = height + 38;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const gif = GIFEncoder();
  for (const [i, minute] of times.entries()) {
    signal.throwIfAborted();
    onFrame(minute, i, times.length);
    ctx.drawImage(field.canvas, 0, 0, width, height);
    ctx.fillStyle = '#203d2c';
    ctx.fillRect(0, height, width, 38);
    ctx.fillStyle = '#fff';
    ctx.font = '600 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      study.date +
        '   ' +
        clock(minute) +
        '  ' +
        offsetLabel(study.site.utcOffset),
      12,
      height + 24,
    );
    ctx.textAlign = 'right';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      study.site.latitude.toFixed(2) +
        '°, ' +
        study.site.longitude.toFixed(2) +
        '°',
      width - 12,
      height + 24,
    );
    const pixels = ctx.getImageData(0, 0, width, canvas.height).data;
    const palette = quantize(pixels, 128, { format: 'rgb444' });
    gif.writeFrame(
      applyPalette(pixels, palette, 'rgb444'),
      width,
      canvas.height,
      { palette, delay: 1000 / fps, repeat: 0 },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  signal.throwIfAborted();
  gif.finish();
  return new Blob([gif.bytesView()], { type: 'image/gif' });
}
