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

test('GIF transparency reserves index zero even when quantizing opaque black and edge pixels', () => {
  const bytes = Uint8ClampedArray.from([
    29,
    30,
    31,
    0,
    0,
    0,
    0,
    127,
    0,
    0,
    0,
    255,
    0,
    0,
    0,
    128,
    ...Array.from({ length: 256 }, (_, level) => [level, 130, 43, 255]).flat(),
  ]);
  const { palette, indices } = indexFrame(bytes, true);
  assert.equal(palette.length, 256);
  assert.deepEqual([...indices.slice(0, 2)], [0, 0]);
  assert.ok(indices.slice(2).every((i) => i > 0));
  assert.equal(indices[2], indices[3]);
});

test('a fully transparent GIF frame has a valid color table', () => {
  const { palette, indices } = indexFrame(new Uint8ClampedArray(48), true);
  assert.equal(palette.length, 2);
  assert.ok(indices.every((i) => i === 0));
});
