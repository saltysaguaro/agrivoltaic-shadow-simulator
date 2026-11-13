import test from 'node:test';
import assert from 'node:assert/strict';
import { crops, cropLines, plantGeometry } from '../src/crops.js';

test('three crop rows divide each actual aisle into quarters and fit the shared staggered length', () => {
  const lines = cropLines({ species: 'lettuce' }, [0, 6, 15, 21], 11, 1, 0.12);
  assert.deepEqual(
    lines.map(({ along, across }) => [along, across]),
    [
      [0, -9], [0, -7.5], [0, -6],
      [0, -2.25], [0, 0], [0, 2.25],
      [0, 6], [0, 7.5], [0, 9],
    ],
  );
  assert.ok(lines.every((line) => line.count === 33));
  assert.deepEqual(cropLines({ species: 'corn' }, [0], 10, 0, 0.12), []);
});

test('perpendicular crop rows span the corridors and break at each support line', () => {
  const lines = cropLines(
    { species: 'tomato', rotated: true },
    [0, 6, 15],
    31,
    1,
    0.12,
  );
  assert.deepEqual(
    lines.map(({ along, across, count }) => [
      Number(along.toFixed(8)),
      across,
      count,
    ]),
    [
      [12, -4.5, 9], [12, 3, 14],
      [9, -4.5, 9], [9, 3, 14],
      [6, -4.5, 9], [6, 3, 14],
      [-1.5, -4.5, 9], [-1.5, 3, 14],
      [-6, -4.5, 9], [-6, 3, 14],
      [-10.5, -4.5, 9], [-10.5, 3, 14],
    ],
  );
});

test('each mature plant has a finite metre-scale canopy rooted at ground level', () => {
  for (const [species, { height }] of Object.entries(crops)) {
    const geometry = plantGeometry(species);
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    assert.ok(min.z >= -0.01 && min.z < 0.03, species);
    assert.ok(Math.abs(max.z - height) < height * 0.16, species);
    assert.ok(max.x > 0 && min.x < 0, species);
    geometry.dispose();
  }
});
