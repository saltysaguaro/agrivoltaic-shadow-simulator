import * as T from 'three';

// Representative mature plants. All geometry and planting distances are in metres.
export const crops = {
  tomato: { label: 'Tomato', height: 1.15, spacing: 0.6 },
  zucchini: { label: 'Zucchini', height: 0.62, spacing: 0.75 },
  potato: { label: 'Potato', height: 0.55, spacing: 0.3 },
  lettuce: { label: 'Lettuce', height: 0.22, spacing: 0.3 },
  corn: { label: 'Corn', height: 2.1, spacing: 0.3 },
};

// Return planting lines in PV-local coordinates. The available length is the
// overlap of the two neighboring rows, including their checkerboard offsets.
export function cropLines(settings, offsets, rowLength, stagger, postSize) {
  const crop = crops[settings?.species];
  if (!crop || offsets.length < 2) return [];
  const lines = [];
  const span = offsets.at(-1);
  const length = rowLength - stagger;
  function add(along, across, extent) {
    const count = Math.floor(extent / crop.spacing);
    if (count > 0) lines.push({ along, across, count });
  }
  for (let i = 1; i < offsets.length; i++) {
    const midpoint = (offsets[i - 1] + offsets[i]) / 2;
    if (settings.rotated) {
      // Turn the row pattern across the shared footprint, leaving a break at
      // each PV support line. This also fits very long or very narrow arrays.
      const along = (0.5 - midpoint / span) * length;
      for (let j = 1; j < offsets.length; j++) {
        const across = (offsets[j - 1] + offsets[j] - span) / 2;
        add(along, across, offsets[j] - offsets[j - 1] - postSize);
      }
    } else {
      add(0, midpoint - span / 2, length);
    }
  }
  return lines;
}

const goldenAngle = Math.PI * (3 - Math.sqrt(5));
const vec = (x, y, z) => new T.Vector3(x, y, z);
const polar = (origin, angle, radius, rise) =>
  vec(
    origin.x + Math.cos(angle) * radius,
    origin.y + Math.sin(angle) * radius,
    origin.z + rise,
  );

// Folded leaf surfaces, tapered stems and fruit share a single vertex-colored
// mesh per species. The same geometry can be instanced throughout the array.
export function plantGeometry(species, coarse = false, distant = false) {
  const positions = [],
    colors = [],
    indices = [];
  const tints = new Map();
  function vertex(p, hex, shade = 1) {
    if (!tints.has(hex)) tints.set(hex, new T.Color(hex));
    const c = tints.get(hex);
    colors.push(c.r * shade, c.g * shade, c.b * shade);
    positions.push(p.x, p.y, p.z);
    return positions.length / 3 - 1;
  }
  function quad(a, b, c, d) {
    indices.push(a, b, d, b, c, d);
  }
  function stem(from, to, radius, color, taper = 0.55) {
    const axis = to.clone().sub(from).normalize();
    const x = vec(1, 0, 0).cross(axis);
    if (x.lengthSq() < 0.01) x.copy(vec(0, 1, 0)).cross(axis);
    x.normalize();
    const y = axis.clone().cross(x);
    const base = positions.length / 3;
    const sides = coarse ? 3 : 5;
    for (let i = 0; i < sides; i++) {
      const a = (2 * Math.PI * i) / sides;
      const radial = x
        .clone()
        .multiplyScalar(radius * Math.cos(a))
        .addScaledVector(y, radius * Math.sin(a));
      vertex(from.clone().add(radial), color);
      vertex(to.clone().addScaledVector(radial, taper), color);
      const k = base + i * 2,
        next = base + ((i + 1) % sides) * 2;
      quad(k, next, next + 1, k + 1);
    }
  }
  function fruit(center, rx, ry, rz, color, angle = 0) {
    const sides = coarse ? 5 : 10,
      rings = coarse ? 3 : 6;
    const base = positions.length / 3;
    for (let j = 0; j <= rings; j++) {
      const t = (Math.PI * j) / rings;
      for (let i = 0; i < sides; i++) {
        const a = (i * 2 * Math.PI) / sides;
        const x = Math.sin(t) * Math.cos(a) * rx,
          y = Math.sin(t) * Math.sin(a) * ry;
        vertex(
          vec(
            center.x + x * Math.cos(angle) - y * Math.sin(angle),
            center.y + x * Math.sin(angle) + y * Math.cos(angle),
            center.z - Math.cos(t) * rz,
          ),
          color,
          0.78 + (0.22 * j) / rings,
        );
        if (j === rings) continue;
        const k = base + j * sides + i,
          next = base + j * sides + ((i + 1) % sides);
        quad(k, next, next + sides, k + sides);
      }
    }
  }
  function leaf(
    base,
    angle,
    reach,
    width,
    rise,
    arch,
    color,
    shape = 'smooth',
  ) {
    const steps = coarse ? 3 : shape === 'frill' || shape === 'lobed' ? 12 : 7;
    const start = positions.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const belly = Math.sin(Math.PI * t);
      const center = polar(base, angle, reach * t, rise * t + arch * belly);
      let w = width * Math.pow(belly, shape === 'frill' ? 0.55 : 0.8);
      if (shape === 'lobed') w *= 0.7 + 0.3 * Math.cos(t * Math.PI * 8);
      if (shape === 'serrated' && i % 2) w *= 0.78;
      for (const side of [-1, 0, 1]) {
        const edge = polar(center, angle + Math.PI / 2, side * w, 0);
        if (side) {
          edge.z +=
            shape === 'frill'
              ? w * (0.55 + 0.25 * Math.sin(28 * t + side))
              : -w * (0.2 + 0.08 * side);
        }
        vertex(edge, color, (0.78 + 0.22 * t) * (side === 0 ? 1.16 : 0.93));
      }
      if (i > 0) {
        const k = start + 3 * (i - 1);
        quad(k, k + 3, k + 4, k + 1);
        quad(k + 1, k + 4, k + 5, k + 2);
      }
    }
  }
  function flower(center, size, petal, middle) {
    for (let i = 0; i < 5; i++)
      leaf(
        center,
        i * Math.PI * 0.4,
        size,
        size * 0.33,
        size * 0.28,
        size * 0.15,
        petal,
      );
    fruit(center, size * 0.22, size * 0.22, size * 0.25, middle);
  }
  const root = vec(0, 0, 0);
  const h = crops[species].height;
  if (distant) {
    // At field scale a folded canopy silhouette keeps very large arrays interactive.
    const radius = {
      tomato: 0.32,
      potato: 0.23,
      zucchini: 0.43,
      lettuce: 0.15,
      corn: 0.4,
    }[species];
    const green = species === 'lettuce' ? '#81a653' : '#567f42';
    const peak = vertex(vec(0, 0, h), green, 1.16);
    const base = vertex(root, green, 0.65);
    for (let i = 0; i < 5; i++) {
      const a = i * goldenAngle;
      const left = vertex(polar(root, a - 0.4, radius * 0.7, h * 0.55), green);
      const tip = vertex(polar(root, a, radius, h * 0.36), green);
      const right = vertex(polar(root, a + 0.4, radius * 0.7, h * 0.55), green);
      quad(peak, left, tip, right);
      indices.push(left, base, right);
    }
  } else if (species === 'lettuce') {
    const n = coarse ? 6 : 30;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      leaf(
        vec(0, 0, 0.018 + 0.07 * t),
        i * goldenAngle,
        0.15 - 0.12 * t,
        0.065 - 0.043 * t,
        0.05 + 0.075 * t,
        0.012 + 0.024 * t,
        t < 0.35 ? '#528043' : t < 0.72 ? '#78a74c' : '#a2bd59',
        'frill',
      );
    }
  } else if (species === 'corn') {
    stem(root, vec(0.015, 0, h * 0.92), 0.021, '#799148', 0.35);
    const n = coarse ? 5 : 12;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      leaf(
        vec(t * 0.015, 0, 0.17 + 1.65 * t),
        i * Math.PI + 0.48 * Math.sin(i * 2),
        0.26 + 0.24 * Math.sin(Math.PI * t),
        0.035 + 0.018 * Math.sin(Math.PI * t),
        0.32 * t - 0.1,
        0.14 + 0.05 * t,
        i % 3 ? '#4b813b' : '#719a46',
      );
    }
    if (!coarse) {
      const ear = vec(0.056, 0, 1.02);
      fruit(ear, 0.043, 0.041, 0.14, '#93a750');
      leaf(ear, 0, 0.062, 0.03, 0.18, 0.035, '#769647');
      fruit(vec(0.062, 0, 1.16), 0.015, 0.014, 0.035, '#997249');
    }
    for (let i = 0; i < (coarse ? 3 : 9); i++) {
      const base = vec(0.015, 0, h * 0.91);
      stem(
        base,
        polar(
          base,
          i * goldenAngle,
          (0.11 * (i % 3)) / 2,
          0.18 - 0.025 * (i % 3),
        ),
        0.008,
        '#b49c61',
        0.18,
      );
    }
  } else if (species === 'zucchini') {
    const n = coarse ? 5 : 14;
    for (let i = 0; i < n; i++) {
      const a = i * goldenAngle,
        t = (i % 5) / 4;
      const tip = polar(root, a, 0.24 - 0.14 * t, 0.28 + 0.24 * t);
      stem(root, tip, 0.014, '#80955c');
      leaf(
        tip,
        a,
        0.25 - 0.07 * t,
        0.14 - 0.04 * t,
        -0.07 + 0.09 * t,
        0.07,
        i % 3 ? '#477642' : '#67915b',
        'lobed',
      );
    }
    if (!coarse) {
      for (const a of [0.4, 2.7, 4.6]) {
        fruit(polar(root, a, 0.16, 0.072), 0.13, 0.034, 0.039, '#345e36', a);
        flower(polar(root, a, 0.27, 0.105), 0.045, '#edac35', '#d98d26');
      }
    }
  } else {
    const tomato = species === 'tomato';
    const n = coarse ? 5 : tomato ? 17 : 14;
    stem(root, vec(0, 0, h * 0.95), tomato ? 0.014 : 0.01, '#75834c');
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        a = i * goldenAngle;
      const joint = vec(0, 0, h * (0.11 + 0.79 * t));
      const reach =
        (tomato ? 0.29 : 0.21) * (0.52 + 0.48 * Math.sin(Math.PI * t));
      const end = polar(joint, a, reach, h * 0.11);
      stem(joint, end, tomato ? 0.007 : 0.005, '#778952', 0.22);
      const green = tomato
        ? i % 3
          ? '#497740'
          : '#598443'
        : i % 3
          ? '#4d783e'
          : '#648d4c';
      const size = tomato ? 0.1 : 0.081;
      for (let j = 1; j <= (coarse ? 1 : 3); j++) {
        const at = joint.clone().lerp(end, j / 4);
        for (const side of [-1, 1])
          leaf(
            at,
            a + side * 0.95,
            size,
            size * (tomato ? 0.29 : 0.36),
            -size * 0.22,
            size * 0.2,
            green,
            tomato ? 'serrated' : 'smooth',
          );
      }
      leaf(end, a, size, size * 0.35, -size * 0.2, size * 0.22, green);
      if (!coarse && tomato && i % 4 === 1) {
        for (let j = 0; j < 3; j++) {
          const at = joint.clone().lerp(end, 0.48 + 0.24 * j);
          const center = polar(at, a + 1.4, 0.028 * (j % 2), -0.065);
          stem(at, center, 0.004, '#63773e');
          fruit(
            center,
            0.038,
            0.038,
            0.033,
            ['#b74732', '#ca5139', '#99974e'][j],
          );
        }
      } else if (!coarse && !tomato && i > n - 4) {
        flower(end, 0.019, '#d7cce2', '#e4b94a');
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
