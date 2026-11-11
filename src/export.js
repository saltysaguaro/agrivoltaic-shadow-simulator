import { GIFEncoder } from 'gifenc';
import { clock, offsetLabel } from './model.js';
import { indexFrame } from './palette.js';

export async function exportGif({
  field,
  study,
  times,
  width,
  fps,
  transparent = false,
  signal,
  onFrame,
}) {
  const height = Math.max(
    1,
    Math.round((width * field.canvas.height) / field.canvas.width),
  );
  const captionScale = Math.max(1, width / 800);
  const footer = Math.round(38 * captionScale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height + footer;
  const ctx = canvas.getContext('2d', {
    willReadFrequently: true,
    alpha: transparent,
  });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const gif = GIFEncoder({ auto: false });
  const frames = [];
  try {
    field.startCapture(width, height, transparent);
    gif.writeHeader();
    for (const [i, minute] of times.entries()) {
      signal.throwIfAborted();
      onFrame(minute, i, times.length);
      if (transparent) ctx.clearRect(0, 0, width, canvas.height);
      ctx.drawImage(field.canvas, 0, 0, width, height);
      ctx.save();
      ctx.translate(0, height);
      ctx.scale(captionScale, captionScale);
      ctx.fillStyle = '#203d2c';
      if (!transparent)
        ctx.fillRect(0, 0, width / captionScale, footer / captionScale);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#203d2c';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      const caption = (text, x, y) => {
        if (transparent) ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      };
      ctx.font = '600 15px sans-serif';
      caption(
        study.date +
          '   ' +
          clock(minute) +
          '  ' +
          offsetLabel(study.site.utcOffset),
        12,
        24,
      );
      ctx.textAlign = 'right';
      ctx.font = '12px sans-serif';
      caption(
        study.site.latitude.toFixed(2) +
          '°, ' +
          study.site.longitude.toFixed(2) +
          '°',
        width / captionScale - 12,
        24,
      );
      ctx.restore();
      const { palette, indices } = indexFrame(
        ctx.getImageData(0, 0, width, canvas.height).data,
        transparent,
      );
      gif.writeFrame(indices, width, canvas.height, {
        palette,
        transparent,
        transparentIndex: 0,
        first: i === 0,
        delay: 1000 / fps,
        repeat: 0,
      });
      if (i === times.length - 1) gif.finish();
      // Release the encoder's frame data without repeatedly copying the entire animation.
      frames.push(new Blob([gif.bytesView()]));
      gif.reset();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    return new Blob(frames, { type: 'image/gif' });
  } finally {
    field.endCapture();
  }
}
