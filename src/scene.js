import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { axes, dimensions, pose, radians } from './model.js';
import { moduleOptics } from './optics.js';

const up = new T.Vector3(0, 0, 1);
const groundTone = new T.Color('#e5e9da');
const shadowTone = new T.Color('#86927e');

function panelTexture(s) {
  const m = s.module,
    o = moduleOptics(m);
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  const xScale = canvas.width / m.width,
    yScale = canvas.height / m.length;
  ctx.fillStyle = '#b6c5c0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const margin = m.bifacial ? o.margin : 0.009;
  const gx = m.bifacial ? o.gapX : 0.002,
    gy = m.bifacial ? o.gapY : 0.002;
  const w = (m.width - 2 * margin - (o.columns - 1) * gx) / o.columns;
  const h = (m.length - 2 * margin - (o.rows - 1) * gy) / o.rows;
  for (let y = 0; y < o.rows; y++)
    for (let x = 0; x < o.columns; x++) {
      ctx.fillStyle = (x + y) % 3 === 0 ? '#34565f' : '#30525b';
      ctx.fillRect(
        (margin + x * (w + gx)) * xScale,
        (margin + y * (h + gy)) * yScale,
        Math.max(0.5, w * xScale - 1),
        Math.max(0.5, h * yScale - 1),
      );
    }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  if (s.table.orientation === 'landscape') {
    texture.center.set(0.5, 0.5);
    texture.rotation = Math.PI / 2;
  }
  return texture;
}

export class Field {
  constructor(host, onView) {
    this.host = host;
    this.onView = onView;
    this.scene = new T.Scene();
    this.scene.background = groundTone;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute(
      'aria-label',
      'Interactive three-dimensional photovoltaic array and its ground shadows',
    );
    host.prepend(this.canvas);
    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.01, 20000);
    this.camera.up.copy(up);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.minZoom = 0.15;
    this.controls.maxZoom = 30;
    this.controls.addEventListener('change', () => this.draw());
    this.controls.addEventListener('start', () => onView('orbit'));
    this.scene.add(new T.HemisphereLight(0xffffff, 0xb8bbae, 2.0));
    this.light = new T.DirectionalLight(0xfffae8, 1.35);
    this.scene.add(this.light);
    this.grid = new T.GridHelper(2000, 1000, 0xa9b39e, 0xbec7b3);
    this.grid.rotation.x = Math.PI / 2;
    this.grid.position.z = -0.012;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.43;
    this.scene.add(this.grid);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
  }

  build(s) {
    this.s = s;
    if (this.hardware) {
      this.scene.remove(this.hardware);
      const geometries = new Set(),
        materials = new Set();
      this.hardware.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) materials.add(o.material);
        if (o.isInstancedMesh) o.dispose();
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    }
    this.hardware = new T.Group();
    this.scene.add(this.hardware);
    this.projected = new T.Group();
    this.projected.matrixAutoUpdate = false;
    this.hardware.add(this.projected);
    const d = dimensions(s),
      r = s.racking;
    const { u, v } = axes(s);
    const offsets = Array.from(
      { length: s.array.rows },
      (_, i) =>
        i * s.rowPair.pitch + Math.floor(i / s.array.groupSize) * s.array.aisle,
    );
    const stagger =
      r.type === 'pergola' &&
      r.pergolaLayout === 'checkerboard' &&
      s.array.rows > 1
        ? (d.along + s.module.gap) / 2
        : 0;
    this.centers = [];
    const posts = [];
    for (const [row, offset] of offsets.entries()) {
      const across = offset - offsets.at(-1) / 2;
      const shift = ((row % 2) - 0.5) * stagger;
      const pos = (along, z) =>
        u
          .clone()
          .multiplyScalar(along + shift)
          .addScaledVector(v, across)
          .setZ(z);
      const columns = [];
      for (let t = 0; t < s.row.tables; t++) {
        const x =
          -d.rowLength / 2 + d.length / 2 + t * (d.length + s.row.tableGap);
        this.centers.push(pos(x, r.height));
        if (r.type === 'vertical') {
          for (let i = 0; i < s.table.wide; i++)
            columns.push(
              x - d.length / 2 + d.along / 2 + i * (d.along + s.module.gap),
            );
        } else {
          for (const k of r.type === 'dual-axis' ? [0] : [-0.32, 0.32])
            posts.push(pos(x + k * d.length, r.height / 2));
        }
      }
      if (columns.length) {
        const z = (r.height + d.width / 2) / 2;
        posts.push(pos(columns[0] - d.along / 2 - r.postSize / 2, z));
        for (let i = 1; i < columns.length; i++)
          posts.push(pos((columns[i - 1] + columns[i]) / 2, z));
        posts.push(pos(columns.at(-1) + d.along / 2 + r.postSize / 2, z));
      }
    }
    const boxes = [];
    for (let i = 0; i < s.table.wide; i++)
      for (let j = 0; j < s.table.high; j++) {
        boxes.push(
          new T.BoxGeometry(d.along, d.cross, s.module.thickness).translate(
            -d.length / 2 + d.along / 2 + i * (d.along + s.module.gap),
            -d.width / 2 + d.cross / 2 + j * (d.cross + s.module.gap),
            0,
          ),
        );
      }
    const panel = mergeGeometries(boxes);
    boxes.forEach((b) => b.dispose());
    const steel = new T.MeshStandardMaterial({
      color: 0x899890,
      roughness: 0.7,
      metalness: 0.2,
    });
    const transmission = moduleOptics(s.module).broadband;
    const batch = (geo, mat, count, trans = 0) => {
      const solid = new T.InstancedMesh(geo, mat, count);
      const shade = new T.InstancedMesh(
        geo,
        new T.MeshBasicMaterial({
          color: shadowTone.clone().lerp(groundTone, trans),
          side: T.DoubleSide,
          depthWrite: false,
          blending: T.CustomBlending,
          blendEquation: T.MinEquation,
          blendSrc: T.OneFactor,
          blendDst: T.OneFactor,
          transparent: true,
        }),
        count,
      );
      shade.instanceMatrix = solid.instanceMatrix;
      solid.frustumCulled = shade.frustumCulled = false;
      shade.renderOrder = 1;
      this.hardware.add(solid);
      this.projected.add(shade);
      return solid;
    };
    this.panels = batch(
      panel,
      new T.MeshStandardMaterial({
        map: panelTexture(s),
        metalness: 0.14,
        roughness: 0.65,
      }),
      this.centers.length,
      transmission,
    );
    this.tubes =
      r.type === 'vertical'
        ? null
        : batch(
            new T.BoxGeometry(d.length, 0.1, 0.1).translate(0, 0, -0.08),
            steel,
            this.centers.length,
          );
    const uprights = batch(
      new T.BoxGeometry(r.postSize, r.postSize, posts[0].z * 2),
      steel,
      posts.length,
    );
    posts.forEach((p, i) =>
      uprights.setMatrixAt(i, new T.Matrix4().makeTranslation(p.x, p.y, p.z)),
    );
    uprights.instanceMatrix.needsUpdate = true;
    const oldRadius = this.radius;
    this.radius = Math.max(
      3,
      Math.hypot(d.rowLength + stagger, offsets.at(-1) + d.width, r.height) / 2,
    );
    if (oldRadius && oldRadius !== this.radius) {
      const ratio = this.radius / oldRadius;
      this.camera.position.sub(this.controls.target).multiplyScalar(ratio);
      this.controls.target.multiplyScalar(ratio);
      this.camera.position.add(this.controls.target);
      this.controls.update();
    }
    this.lastPose = null;
    this.resize();
  }

  updateSun(sun) {
    const p = pose(this.s, sun);
    if (
      !this.lastPose ||
      this.lastPose.tilt !== p.tilt ||
      this.lastPose.yaw !== p.yaw
    ) {
      const { u, v } = axes(this.s),
        az = radians(p.yaw),
        tilt = radians(p.tilt);
      const along = u
        .clone()
        .multiplyScalar(Math.cos(az))
        .addScaledVector(v, Math.sin(az));
      const across = v
        .clone()
        .multiplyScalar(Math.cos(az))
        .addScaledVector(u, -Math.sin(az))
        .multiplyScalar(Math.cos(tilt))
        .addScaledVector(up, Math.sin(tilt));
      const matrix = new T.Matrix4().makeBasis(
        along,
        across,
        new T.Vector3().crossVectors(along, across),
      );
      this.centers.forEach((pos, i) => {
        matrix.setPosition(pos);
        this.panels.setMatrixAt(i, matrix);
        this.tubes?.setMatrixAt(i, matrix);
      });
      this.panels.instanceMatrix.needsUpdate = true;
      if (this.tubes) this.tubes.instanceMatrix.needsUpdate = true;
      this.lastPose = p;
    }
    this.projected.visible = sun.z > 0;
    if (sun.z > 0) {
      this.projected.matrix.set(
        1,
        0,
        -sun.x / sun.z,
        0,
        0,
        1,
        -sun.y / sun.z,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
      );
      this.projected.matrixWorldNeedsUpdate = true;
    }
    this.light.position.copy(sun).multiplyScalar(100);
    this.light.intensity = sun.z > 0 ? 1.35 : 0;
    this.draw();
  }

  view(mode) {
    if (!this.s) return;
    const { u } = axes(this.s);
    const direction =
      mode === 'plan'
        ? new T.Vector3(0, -0.0001, 1)
        : mode === 'profile'
          ? u.clone().addScaledVector(up, 0.11)
          : new T.Vector3(0.84, -1.14, 0.92);
    this.camera.zoom = 1;
    this.controls.target.set(0, 0, this.s.racking.height * 0.35);
    this.camera.position
      .copy(this.controls.target)
      .addScaledVector(direction.normalize(), this.radius * 4 + 25);
    this.controls.update();
    this.resize();
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h,
      half = ((this.radius || 10) * 1.02) / Math.min(1, aspect);
    Object.assign(this.camera, {
      left: -half * aspect,
      right: half * aspect,
      top: half,
      bottom: -half,
    });
    this.camera.updateProjectionMatrix();
    this.draw();
  }
  draw() {
    this.renderer.render(this.scene, this.camera);
    const north = new T.Vector3(0, 1, 0).applyQuaternion(
      this.camera.quaternion.clone().invert(),
    );
    this.host.style.setProperty(
      '--north',
      Math.atan2(north.x, north.y) + 'rad',
    );
  }
}
