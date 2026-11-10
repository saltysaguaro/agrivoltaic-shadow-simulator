import test from 'node:test';
import assert from 'node:assert/strict';
import { indexFrame } from '../src/palette.js';

test('GIF preserves all 256 distinct source colors, including one-level edge shades', () => {
  const rgba = Uint8ClampedArray.from(
    Array.from({ length: 256 }, (_, level) => [level, 73, 105, 255]).flat(),
  );
  const { palette, indices } = indexFrame(rgba);
  assert.equal(palette.length, 256);
  for (let i = 0; i < 256; i++) {
    assert.deepEqual(palette[indices[i]], [i, 73, 105]);
  }
});
