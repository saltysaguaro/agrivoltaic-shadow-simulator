// Keep native RGB values for fine cell lines, shadow edges and antialiased type.
// Each palette addition targets the remaining color with the largest weighted error.
export function indexFrame(bytes, transparent = false) {
  const pixels = new Uint32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 4,
  );
  const histogram = new Map();
  // GIF has binary alpha. Ignore invisible RGB and group retained edge pixels by RGB.
  const alphaMask = new Uint32Array(Uint8Array.of(0, 0, 0, 255).buffer)[0];
  const keyAt = transparent
    ? (i) => (bytes[i * 4 + 3] < 128 ? 0 : (pixels[i] | alphaMask) >>> 0)
    : (i) => pixels[i];
  for (let i = 0; i < pixels.length; i++) {
    const color = keyAt(i);
    if (!transparent || color !== 0)
      histogram.set(color, (histogram.get(color) || 0) + 1);
  }
  const limit = transparent ? 255 : 256;

  const colors = [];
  let mostFrequent = 0;
  for (const [key, count] of histogram) {
    const [r, g, b] = bytesOf(key);
    colors.push({ key, r, g, b, count, index: colors.length, error: Infinity });
    if (count > colors[mostFrequent].count) mostFrequent = colors.length - 1;
  }

  let palette;
  if (colors.length <= limit) {
    palette = colors.map(({ r, g, b }) => [r, g, b]);
  } else {
    palette = [];
    let next = colors[mostFrequent];
    while (palette.length < limit) {
      const { r, g, b } = next;
      const index = palette.length;
      palette.push([r, g, b]);
      let worst = -1;
      for (const color of colors) {
        const error =
          (r - color.r) ** 2 + (g - color.g) ** 2 + (b - color.b) ** 2;
        if (error < color.error) {
          color.error = error;
          color.index = index;
        }
        const score = color.error * color.count;
        if (score > worst) {
          worst = score;
          next = color;
        }
      }
    }
  }
  if (transparent) {
    palette.unshift([0, 0, 0]);
    histogram.set(0, 0);
    if (palette.length === 1) palette.push([0, 0, 0]);
  }
  for (const color of colors)
    histogram.set(color.key, color.index + Number(transparent));
  const indices = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) indices[i] = histogram.get(keyAt(i));
  return { palette, indices };
}

// Canvas ImageData is always in RGBA byte order, regardless of host endianness.
function bytesOf(color) {
  return new Uint8Array(Uint32Array.of(color).buffer);
}
