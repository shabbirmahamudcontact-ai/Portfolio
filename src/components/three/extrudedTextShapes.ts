import * as THREE from 'three';

type Pt = [number, number];

function toVectors(pts: Pt[]): THREE.Vector2[] {
  return pts.map(([x, y]) => new THREE.Vector2(x, y));
}

function makeShape(outer: Pt[], holes: Pt[][] = []): THREE.Shape {
  let outerPts = toVectors(outer);
  if (THREE.ShapeUtils.isClockWise(outerPts)) {
    outerPts = outerPts.reverse();
  }
  const shape = new THREE.Shape(outerPts);
  for (const hole of holes) {
    let holePts = toVectors(hole);
    if (!THREE.ShapeUtils.isClockWise(holePts)) {
      holePts = holePts.reverse();
    }
    shape.holes.push(new THREE.Path(holePts));
  }
  return shape;
}

function makeRect(x: number, y: number, w: number, h: number): Pt[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

function makeCirclePts(cx: number, cy: number, rx: number, ry = rx, segs = 24): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/**
 * Creates a rounded rectangle THREE.Shape centered around (0, 0) for luxury 3D frames,
 * glass cards, smartphone chassis, and chamfered plinths.
 */
export function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w * 0.9, h * 0.9);
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  s.closePath();
  return s;
}

/**
 * Creates a hollow rounded-rectangle frame (rim/bezel) centered at (0, 0).
 */
export function createRoundedFrameShape(
  outerW: number,
  outerH: number,
  outerR: number,
  thickness: number
): THREE.Shape {
  const outer = createRoundedRectShape(outerW, outerH, outerR);
  const iw = (outerW - thickness * 2) / 2;
  const ih = (outerH - thickness * 2) / 2;
  const ir = Math.max(0.01, outerR - thickness * 0.6);

  const hole = new THREE.Path();
  hole.moveTo(-iw + ir, -ih);
  hole.lineTo(-iw, -ih + ir);
  hole.lineTo(-iw, ih - ir);
  hole.quadraticCurveTo(-iw, ih, -iw + ir, ih);
  hole.lineTo(iw - ir, ih);
  hole.quadraticCurveTo(iw, ih, iw, ih - ir);
  hole.lineTo(iw, -ih + ir);
  hole.quadraticCurveTo(iw, -ih, iw - ir, -ih);
  hole.closePath();
  // Ensure opposite winding (clockwise) for hole
  const holePts = hole.getPoints(32);
  const fixedHole = THREE.ShapeUtils.isClockWise(holePts) ? holePts : holePts.reverse();
  outer.holes.push(new THREE.Path(fixedHole));
  return outer;
}

interface GlyphSpec {
  width: number;
  build: () => THREE.Shape[];
}

// Sculpted architectural vector glyphs covering full uppercase & lowercase Latin alphabet
const GLYPHS: Record<string, GlyphSpec> = {
  // ---- UPPERCASE ----
  A: {
    width: 0.68,
    build: () => [
      makeShape(
        [
          [0.0, 0.0],
          [0.27, 1.0],
          [0.41, 1.0],
          [0.68, 0.0],
          [0.52, 0.0],
          [0.45, 0.26],
          [0.23, 0.26],
          [0.16, 0.0],
        ],
        [
          [
            [0.27, 0.4],
            [0.41, 0.4],
            [0.34, 0.74],
          ],
        ]
      ),
    ],
  },
  B: {
    width: 0.62,
    build: () => [
      makeShape(makeRect(0.0, 0.0, 0.54, 1.0), [
        makeRect(0.16, 0.56, 0.24, 0.28),
        makeRect(0.16, 0.14, 0.26, 0.28),
      ]),
    ],
  },
  C: {
    width: 0.6,
    build: () => [
      makeShape([
        [0.56, 0.85],
        [0.56, 1.0],
        [0.0, 1.0],
        [0.0, 0.0],
        [0.56, 0.0],
        [0.56, 0.15],
        [0.16, 0.15],
        [0.16, 0.85],
      ]),
    ],
  },
  D: {
    width: 0.62,
    build: () => [
      makeShape(
        [
          [0.0, 0.0],
          [0.0, 1.0],
          [0.44, 1.0],
          [0.6, 0.8],
          [0.6, 0.2],
          [0.44, 0.0],
        ],
        [makeRect(0.16, 0.15, 0.26, 0.7)]
      ),
    ],
  },
  E: {
    width: 0.56,
    build: () => [
      makeShape([
        [0.0, 0.0],
        [0.0, 1.0],
        [0.54, 1.0],
        [0.54, 0.85],
        [0.16, 0.85],
        [0.16, 0.57],
        [0.48, 0.57],
        [0.48, 0.43],
        [0.16, 0.43],
        [0.16, 0.15],
        [0.54, 0.15],
        [0.54, 0.0],
      ]),
    ],
  },
  F: {
    width: 0.54,
    build: () => [
      makeShape([
        [0.0, 0.0],
        [0.0, 1.0],
        [0.52, 1.0],
        [0.52, 0.85],
        [0.16, 0.85],
        [0.16, 0.57],
        [0.46, 0.57],
        [0.46, 0.43],
        [0.16, 0.43],
        [0.16, 0.0],
      ]),
    ],
  },
  G: {
    width: 0.64,
    build: () => [
      makeShape([
        [0.58, 0.85],
        [0.58, 1.0],
        [0.0, 1.0],
        [0.0, 0.0],
        [0.6, 0.0],
        [0.6, 0.48],
        [0.32, 0.48],
        [0.32, 0.34],
        [0.44, 0.34],
        [0.44, 0.15],
        [0.16, 0.15],
        [0.16, 0.85],
      ]),
    ],
  },
  H: {
    width: 0.6,
    build: () => [
      makeShape([
        [0.0, 0.0],
        [0.0, 1.0],
        [0.16, 1.0],
        [0.16, 0.58],
        [0.44, 0.58],
        [0.44, 1.0],
        [0.6, 1.0],
        [0.6, 0.0],
        [0.44, 0.0],
        [0.44, 0.43],
        [0.16, 0.43],
        [0.16, 0.0],
      ]),
    ],
  },
  I: {
    width: 0.24,
    build: () => [makeShape(makeRect(0.04, 0.0, 0.16, 1.0))],
  },
  J: {
    width: 0.52,
    build: () => [
      makeShape([
        [0.34, 1.0],
        [0.5, 1.0],
        [0.5, 0.0],
        [0.0, 0.0],
        [0.0, 0.32],
        [0.15, 0.32],
        [0.15, 0.15],
        [0.34, 0.15],
      ]),
    ],
  },
  K: {
    width: 0.6,
    build: () => [
      makeShape([
        [0.0, 0.0],
        [0.0, 1.0],
        [0.16, 1.0],
        [0.16, 0.56],
        [0.42, 1.0],
        [0.6, 1.0],
        [0.3, 0.5],
        [0.6, 0.0],
        [0.42, 0.0],
        [0.16, 0.42],
        [0.16, 0.0],
      ]),
    ],
  },
  L: {
    width: 0.52,
    build: () => [
      makeShape([
        [0.0, 0.0],
        [0.0, 1.0],
        [0.16, 1.0],
        [0.16, 0.15],
        [0.5, 0.15],
        [0.5, 0.0],
      ]),
    ],
  },
  M: {
    width: 0.78,
    build: () => [
      makeShape([
        [0.0, 0.0],
        [0.0, 1.0],
        [0.19, 1.0],
        [0.39, 0.44],
        [0.59, 1.0],
        [0.78, 1.0],
        [0.78, 0.0],
        [0.62, 0.0],
        [0.62, 0.71],
        [0.44, 0.24],
        [0.34, 0.24],
        [0.16, 0.71],
        [0.16, 0.0],
      ]),
    ],
  },
  N: {
    width: 0.62,
    build: () => [
      makeShape([
        [0.0, 0.0],
        [0.0, 1.0],
        [0.16, 1.0],
        [0.46, 0.3],
        [0.46, 1.0],
        [0.62, 1.0],
        [0.62, 0.0],
        [0.46, 0.0],
        [0.16, 0.7],
        [0.16, 0.0],
      ]),
    ],
  },
  O: {
    width: 0.64,
    build: () => [
      makeShape(makeCirclePts(0.32, 0.5, 0.32, 0.5, 28), [makeCirclePts(0.32, 0.5, 0.16, 0.34, 24)]),
    ],
  },
  P: {
    width: 0.56,
    build: () => [
      makeShape(
        [
          [0.0, 0.0],
          [0.0, 1.0],
          [0.54, 1.0],
          [0.54, 0.46],
          [0.16, 0.46],
          [0.16, 0.0],
        ],
        [makeRect(0.16, 0.61, 0.23, 0.24)]
      ),
    ],
  },
  Q: {
    width: 0.66,
    build: () => [
      makeShape(makeCirclePts(0.32, 0.5, 0.32, 0.5, 28), [makeCirclePts(0.32, 0.5, 0.16, 0.34, 24)]),
      makeShape([
        [0.38, 0.18],
        [0.54, 0.18],
        [0.66, -0.08],
        [0.5, -0.08],
      ]),
    ],
  },
  R: {
    width: 0.6,
    build: () => [
      makeShape(
        [
          [0.0, 0.0],
          [0.0, 1.0],
          [0.56, 1.0],
          [0.56, 0.5],
          [0.36, 0.5],
          [0.6, 0.0],
          [0.42, 0.0],
          [0.2, 0.48],
          [0.16, 0.48],
          [0.16, 0.0],
        ],
        [makeRect(0.16, 0.64, 0.24, 0.22)]
      ),
    ],
  },
  S: {
    width: 0.58,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.54, 0.78);
      s.bezierCurveTo(0.5, 0.94, 0.39, 1.02, 0.26, 1.02);
      s.bezierCurveTo(0.11, 1.02, 0.02, 0.9, 0.02, 0.74);
      s.bezierCurveTo(0.02, 0.56, 0.12, 0.48, 0.29, 0.44);
      s.bezierCurveTo(0.41, 0.41, 0.44, 0.37, 0.44, 0.28);
      s.bezierCurveTo(0.44, 0.18, 0.38, 0.14, 0.28, 0.14);
      s.bezierCurveTo(0.18, 0.14, 0.12, 0.2, 0.1, 0.3);
      s.lineTo(-0.02, 0.25);
      s.bezierCurveTo(0.01, 0.07, 0.13, -0.02, 0.29, -0.02);
      s.bezierCurveTo(0.47, -0.02, 0.58, 0.1, 0.58, 0.29);
      s.bezierCurveTo(0.58, 0.47, 0.47, 0.55, 0.31, 0.59);
      s.bezierCurveTo(0.2, 0.62, 0.16, 0.66, 0.16, 0.74);
      s.bezierCurveTo(0.16, 0.83, 0.21, 0.88, 0.29, 0.88);
      s.bezierCurveTo(0.37, 0.88, 0.42, 0.83, 0.44, 0.74);
      s.closePath();
      return [s];
    },
  },
  T: {
    width: 0.6,
    build: () => [
      makeShape([
        [0.0, 0.85],
        [0.0, 1.0],
        [0.6, 1.0],
        [0.6, 0.85],
        [0.38, 0.85],
        [0.38, 0.0],
        [0.22, 0.0],
        [0.22, 0.85],
      ]),
    ],
  },
  U: {
    width: 0.6,
    build: () => [
      makeShape([
        [0.0, 1.0],
        [0.16, 1.0],
        [0.16, 0.15],
        [0.44, 0.15],
        [0.44, 1.0],
        [0.6, 1.0],
        [0.6, 0.0],
        [0.0, 0.0],
      ]),
    ],
  },
  V: {
    width: 0.64,
    build: () => [
      makeShape([
        [0.0, 1.0],
        [0.17, 1.0],
        [0.32, 0.28],
        [0.47, 1.0],
        [0.64, 1.0],
        [0.4, 0.0],
        [0.24, 0.0],
      ]),
    ],
  },
  W: {
    width: 0.84,
    build: () => [
      makeShape([
        [0.0, 1.0],
        [0.16, 1.0],
        [0.26, 0.3],
        [0.36, 0.78],
        [0.48, 0.78],
        [0.58, 0.3],
        [0.68, 1.0],
        [0.84, 1.0],
        [0.66, 0.0],
        [0.5, 0.0],
        [0.42, 0.45],
        [0.34, 0.0],
        [0.18, 0.0],
      ]),
    ],
  },
  X: {
    width: 0.62,
    build: () => [
      makeShape([
        [0.0, 1.0],
        [0.18, 1.0],
        [0.31, 0.65],
        [0.44, 1.0],
        [0.62, 1.0],
        [0.41, 0.5],
        [0.62, 0.0],
        [0.44, 0.0],
        [0.31, 0.35],
        [0.18, 0.0],
        [0.0, 0.0],
        [0.21, 0.5],
      ]),
    ],
  },
  Y: {
    width: 0.72,
    build: () => [
      makeShape([
        [0.0, 1.0],
        [0.18, 1.0],
        [0.36, 0.58],
        [0.54, 1.0],
        [0.72, 1.0],
        [0.44, 0.44],
        [0.44, 0.0],
        [0.28, 0.0],
        [0.28, 0.44],
      ]),
    ],
  },
  Z: {
    width: 0.58,
    build: () => [
      makeShape([
        [0.0, 0.85],
        [0.0, 1.0],
        [0.58, 1.0],
        [0.58, 0.84],
        [0.2, 0.15],
        [0.58, 0.15],
        [0.58, 0.0],
        [0.0, 0.0],
        [0.0, 0.16],
        [0.38, 0.85],
      ]),
    ],
  },

  // ---- LOWERCASE (Sculpted editorial curves for Shabbir Mahamud & any custom name) ----
  a: {
    width: 0.56,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.06, 0.56);
      s.bezierCurveTo(0.1, 0.68, 0.2, 0.72, 0.31, 0.72);
      s.bezierCurveTo(0.46, 0.72, 0.54, 0.62, 0.54, 0.45);
      s.lineTo(0.54, 0.0);
      s.lineTo(0.41, 0.0);
      s.lineTo(0.41, 0.09);
      s.bezierCurveTo(0.36, 0.02, 0.29, -0.01, 0.21, -0.01);
      s.bezierCurveTo(0.09, -0.01, 0.01, 0.08, 0.01, 0.2);
      s.bezierCurveTo(0.01, 0.34, 0.12, 0.41, 0.31, 0.42);
      s.lineTo(0.4, 0.43);
      s.lineTo(0.4, 0.47);
      s.bezierCurveTo(0.4, 0.56, 0.35, 0.6, 0.28, 0.6);
      s.bezierCurveTo(0.21, 0.6, 0.16, 0.56, 0.15, 0.5);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.4, 0.32);
      hole.lineTo(0.29, 0.31);
      hole.bezierCurveTo(0.19, 0.3, 0.14, 0.26, 0.14, 0.2);
      hole.bezierCurveTo(0.14, 0.14, 0.19, 0.1, 0.26, 0.1);
      hole.bezierCurveTo(0.35, 0.1, 0.4, 0.16, 0.4, 0.25);
      hole.closePath();
      s.holes.push(hole);
      return [s];
    },
  },
  b: {
    width: 0.58,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.0, 0.0);
      s.lineTo(0.0, 1.0);
      s.lineTo(0.14, 1.0);
      s.lineTo(0.14, 0.61);
      s.bezierCurveTo(0.19, 0.68, 0.26, 0.72, 0.35, 0.72);
      s.bezierCurveTo(0.49, 0.72, 0.57, 0.57, 0.57, 0.36);
      s.bezierCurveTo(0.57, 0.14, 0.48, -0.01, 0.34, -0.01);
      s.bezierCurveTo(0.25, -0.01, 0.18, 0.03, 0.14, 0.1);
      s.lineTo(0.14, 0.0);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.14, 0.36);
      hole.bezierCurveTo(0.14, 0.5, 0.2, 0.59, 0.3, 0.59);
      hole.bezierCurveTo(0.39, 0.59, 0.43, 0.5, 0.43, 0.36);
      hole.bezierCurveTo(0.43, 0.21, 0.39, 0.12, 0.3, 0.12);
      hole.bezierCurveTo(0.2, 0.12, 0.14, 0.21, 0.14, 0.36);
      hole.closePath();
      s.holes.push(hole);
      return [s];
    },
  },
  c: {
    width: 0.52,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.51, 0.54);
      s.bezierCurveTo(0.47, 0.66, 0.39, 0.72, 0.28, 0.72);
      s.bezierCurveTo(0.11, 0.72, 0.0, 0.57, 0.0, 0.36);
      s.bezierCurveTo(0.0, 0.14, 0.11, -0.01, 0.28, -0.01);
      s.bezierCurveTo(0.4, -0.01, 0.48, 0.06, 0.51, 0.18);
      s.lineTo(0.39, 0.22);
      s.bezierCurveTo(0.37, 0.15, 0.33, 0.12, 0.28, 0.12);
      s.bezierCurveTo(0.19, 0.12, 0.14, 0.21, 0.14, 0.36);
      s.bezierCurveTo(0.14, 0.5, 0.19, 0.59, 0.28, 0.59);
      s.bezierCurveTo(0.34, 0.59, 0.37, 0.56, 0.39, 0.49);
      s.closePath();
      return [s];
    },
  },
  d: {
    width: 0.58,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.43, 1.0);
      s.lineTo(0.57, 1.0);
      s.lineTo(0.57, 0.0);
      s.lineTo(0.43, 0.0);
      s.lineTo(0.43, 0.1);
      s.bezierCurveTo(0.39, 0.03, 0.32, -0.01, 0.23, -0.01);
      s.bezierCurveTo(0.09, -0.01, 0.0, 0.14, 0.0, 0.36);
      s.bezierCurveTo(0.0, 0.57, 0.09, 0.72, 0.23, 0.72);
      s.bezierCurveTo(0.32, 0.72, 0.39, 0.68, 0.43, 0.61);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.43, 0.36);
      hole.bezierCurveTo(0.43, 0.21, 0.37, 0.12, 0.28, 0.12);
      hole.bezierCurveTo(0.19, 0.12, 0.14, 0.21, 0.14, 0.36);
      hole.bezierCurveTo(0.14, 0.5, 0.19, 0.59, 0.28, 0.59);
      hole.bezierCurveTo(0.37, 0.59, 0.43, 0.5, 0.43, 0.36);
      hole.closePath();
      s.holes.push(hole);
      return [s];
    },
  },
  e: {
    width: 0.58,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.56, 0.34);
      s.bezierCurveTo(0.56, 0.58, 0.44, 0.72, 0.28, 0.72);
      s.bezierCurveTo(0.11, 0.72, 0.0, 0.56, 0.0, 0.36);
      s.bezierCurveTo(0.0, 0.14, 0.12, 0.0, 0.29, 0.0);
      s.bezierCurveTo(0.43, 0.0, 0.52, 0.07, 0.55, 0.17);
      s.lineTo(0.43, 0.21);
      s.bezierCurveTo(0.4, 0.14, 0.35, 0.12, 0.29, 0.12);
      s.bezierCurveTo(0.19, 0.12, 0.14, 0.21, 0.14, 0.31);
      s.lineTo(0.56, 0.31);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.14, 0.42);
      hole.bezierCurveTo(0.15, 0.53, 0.21, 0.6, 0.29, 0.6);
      hole.bezierCurveTo(0.37, 0.6, 0.42, 0.53, 0.43, 0.42);
      hole.closePath();
      s.holes.push(hole);
      return [s];
    },
  },
  f: {
    width: 0.36,
    build: () => [
      makeShape([
        [0.09, 0.0],
        [0.09, 0.58],
        [0.0, 0.58],
        [0.0, 0.7],
        [0.09, 0.7],
        [0.09, 0.88],
        [0.18, 1.0],
        [0.36, 1.0],
        [0.36, 0.88],
        [0.23, 0.88],
        [0.23, 0.7],
        [0.35, 0.7],
        [0.35, 0.58],
        [0.23, 0.58],
        [0.23, 0.0],
      ]),
    ],
  },
  g: {
    width: 0.58,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.43, 0.7);
      s.lineTo(0.57, 0.7);
      s.lineTo(0.57, -0.02);
      s.bezierCurveTo(0.57, -0.2, 0.45, -0.28, 0.28, -0.28);
      s.bezierCurveTo(0.15, -0.28, 0.06, -0.22, 0.03, -0.12);
      s.lineTo(0.16, -0.09);
      s.bezierCurveTo(0.18, -0.15, 0.22, -0.17, 0.29, -0.17);
      s.bezierCurveTo(0.38, -0.17, 0.43, -0.12, 0.43, -0.01);
      s.lineTo(0.43, 0.08);
      s.bezierCurveTo(0.39, 0.02, 0.32, -0.01, 0.23, -0.01);
      s.bezierCurveTo(0.09, -0.01, 0.0, 0.14, 0.0, 0.36);
      s.bezierCurveTo(0.0, 0.57, 0.09, 0.72, 0.23, 0.72);
      s.bezierCurveTo(0.32, 0.72, 0.39, 0.68, 0.43, 0.61);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.43, 0.36);
      hole.bezierCurveTo(0.43, 0.21, 0.37, 0.12, 0.28, 0.12);
      hole.bezierCurveTo(0.19, 0.12, 0.14, 0.21, 0.14, 0.36);
      hole.bezierCurveTo(0.14, 0.5, 0.19, 0.59, 0.28, 0.59);
      hole.bezierCurveTo(0.37, 0.59, 0.43, 0.5, 0.43, 0.36);
      hole.closePath();
      s.holes.push(hole);
      return [s];
    },
  },
  h: {
    width: 0.58,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.0, 0.0);
      s.lineTo(0.14, 0.0);
      s.lineTo(0.14, 0.42);
      s.bezierCurveTo(0.14, 0.54, 0.21, 0.59, 0.29, 0.59);
      s.bezierCurveTo(0.38, 0.59, 0.43, 0.53, 0.43, 0.41);
      s.lineTo(0.43, 0.0);
      s.lineTo(0.57, 0.0);
      s.lineTo(0.57, 0.44);
      s.bezierCurveTo(0.57, 0.63, 0.46, 0.72, 0.33, 0.72);
      s.bezierCurveTo(0.24, 0.72, 0.18, 0.68, 0.14, 0.61);
      s.lineTo(0.14, 1.0);
      s.lineTo(0.0, 1.0);
      s.closePath();
      return [s];
    },
  },
  i: {
    width: 0.22,
    build: () => [
      makeShape(makeRect(0.04, 0.0, 0.14, 0.7)),
      makeShape(makeCirclePts(0.11, 0.91, 0.085, 0.085, 18)),
    ],
  },
  j: {
    width: 0.26,
    build: () => [
      makeShape([
        [0.09, -0.14],
        [0.0, -0.14],
        [0.0, -0.26],
        [0.14, -0.26],
        [0.23, -0.16],
        [0.23, 0.7],
        [0.09, 0.7],
      ]),
      makeShape(makeCirclePts(0.16, 0.91, 0.085, 0.085, 18)),
    ],
  },
  k: {
    width: 0.52,
    build: () => [
      makeShape([
        [0.0, 0.0],
        [0.0, 1.0],
        [0.14, 1.0],
        [0.14, 0.39],
        [0.36, 0.7],
        [0.52, 0.7],
        [0.28, 0.36],
        [0.54, 0.0],
        [0.37, 0.0],
        [0.14, 0.3],
        [0.14, 0.0],
      ]),
    ],
  },
  l: {
    width: 0.22,
    build: () => [makeShape(makeRect(0.04, 0.0, 0.14, 1.0))],
  },
  m: {
    width: 0.88,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.0, 0.0);
      s.lineTo(0.14, 0.0);
      s.lineTo(0.14, 0.43);
      s.bezierCurveTo(0.14, 0.54, 0.2, 0.59, 0.27, 0.59);
      s.bezierCurveTo(0.34, 0.59, 0.37, 0.54, 0.37, 0.42);
      s.lineTo(0.37, 0.0);
      s.lineTo(0.51, 0.0);
      s.lineTo(0.51, 0.43);
      s.bezierCurveTo(0.51, 0.54, 0.57, 0.59, 0.64, 0.59);
      s.bezierCurveTo(0.71, 0.59, 0.74, 0.54, 0.74, 0.42);
      s.lineTo(0.74, 0.0);
      s.lineTo(0.88, 0.0);
      s.lineTo(0.88, 0.45);
      s.bezierCurveTo(0.88, 0.63, 0.79, 0.72, 0.68, 0.72);
      s.bezierCurveTo(0.59, 0.72, 0.52, 0.67, 0.49, 0.6);
      s.bezierCurveTo(0.45, 0.68, 0.38, 0.72, 0.31, 0.72);
      s.bezierCurveTo(0.22, 0.72, 0.17, 0.68, 0.14, 0.61);
      s.lineTo(0.14, 0.7);
      s.lineTo(0.0, 0.7);
      s.closePath();
      return [s];
    },
  },
  n: {
    width: 0.58,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.0, 0.0);
      s.lineTo(0.14, 0.0);
      s.lineTo(0.14, 0.42);
      s.bezierCurveTo(0.14, 0.54, 0.21, 0.59, 0.29, 0.59);
      s.bezierCurveTo(0.38, 0.59, 0.43, 0.53, 0.43, 0.41);
      s.lineTo(0.43, 0.0);
      s.lineTo(0.57, 0.0);
      s.lineTo(0.57, 0.44);
      s.bezierCurveTo(0.57, 0.63, 0.46, 0.72, 0.33, 0.72);
      s.bezierCurveTo(0.24, 0.72, 0.18, 0.68, 0.14, 0.61);
      s.lineTo(0.14, 0.7);
      s.lineTo(0.0, 0.7);
      s.closePath();
      return [s];
    },
  },
  o: {
    width: 0.58,
    build: () => [
      makeShape(makeCirclePts(0.29, 0.355, 0.29, 0.365, 24), [
        makeCirclePts(0.29, 0.355, 0.15, 0.23, 20),
      ]),
    ],
  },
  p: {
    width: 0.58,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.0, -0.26);
      s.lineTo(0.0, 0.7);
      s.lineTo(0.14, 0.7);
      s.lineTo(0.14, 0.61);
      s.bezierCurveTo(0.19, 0.68, 0.26, 0.72, 0.35, 0.72);
      s.bezierCurveTo(0.49, 0.72, 0.57, 0.57, 0.57, 0.36);
      s.bezierCurveTo(0.57, 0.14, 0.48, -0.01, 0.34, -0.01);
      s.bezierCurveTo(0.25, -0.01, 0.18, 0.03, 0.14, 0.1);
      s.lineTo(0.14, -0.26);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.14, 0.36);
      hole.bezierCurveTo(0.14, 0.5, 0.2, 0.59, 0.3, 0.59);
      hole.bezierCurveTo(0.39, 0.59, 0.43, 0.5, 0.43, 0.36);
      hole.bezierCurveTo(0.43, 0.21, 0.39, 0.12, 0.3, 0.12);
      hole.bezierCurveTo(0.2, 0.12, 0.14, 0.21, 0.14, 0.36);
      hole.closePath();
      s.holes.push(hole);
      return [s];
    },
  },
  q: {
    width: 0.58,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.43, 0.7);
      s.lineTo(0.57, 0.7);
      s.lineTo(0.57, -0.26);
      s.lineTo(0.43, -0.26);
      s.lineTo(0.43, 0.1);
      s.bezierCurveTo(0.39, 0.03, 0.32, -0.01, 0.23, -0.01);
      s.bezierCurveTo(0.09, -0.01, 0.0, 0.14, 0.0, 0.36);
      s.bezierCurveTo(0.0, 0.57, 0.09, 0.72, 0.23, 0.72);
      s.bezierCurveTo(0.32, 0.72, 0.39, 0.68, 0.43, 0.61);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.43, 0.36);
      hole.bezierCurveTo(0.43, 0.21, 0.37, 0.12, 0.28, 0.12);
      hole.bezierCurveTo(0.19, 0.12, 0.14, 0.21, 0.14, 0.36);
      hole.bezierCurveTo(0.14, 0.5, 0.19, 0.59, 0.28, 0.59);
      hole.bezierCurveTo(0.37, 0.59, 0.43, 0.5, 0.43, 0.36);
      hole.closePath();
      s.holes.push(hole);
      return [s];
    },
  },
  r: {
    width: 0.38,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.0, 0.0);
      s.lineTo(0.14, 0.0);
      s.lineTo(0.14, 0.4);
      s.bezierCurveTo(0.14, 0.53, 0.21, 0.58, 0.31, 0.58);
      s.lineTo(0.37, 0.58);
      s.lineTo(0.37, 0.71);
      s.bezierCurveTo(0.24, 0.72, 0.18, 0.67, 0.14, 0.59);
      s.lineTo(0.14, 0.7);
      s.lineTo(0.0, 0.7);
      s.closePath();
      return [s];
    },
  },
  s: {
    width: 0.5,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.46, 0.56);
      s.bezierCurveTo(0.42, 0.67, 0.34, 0.72, 0.23, 0.72);
      s.bezierCurveTo(0.09, 0.72, 0.01, 0.63, 0.01, 0.51);
      s.bezierCurveTo(0.01, 0.39, 0.09, 0.33, 0.23, 0.3);
      s.bezierCurveTo(0.33, 0.28, 0.36, 0.25, 0.36, 0.19);
      s.bezierCurveTo(0.36, 0.13, 0.31, 0.1, 0.24, 0.1);
      s.bezierCurveTo(0.16, 0.1, 0.11, 0.14, 0.09, 0.21);
      s.lineTo(0.0, 0.16);
      s.bezierCurveTo(0.03, 0.04, 0.12, -0.01, 0.25, -0.01);
      s.bezierCurveTo(0.4, -0.01, 0.49, 0.08, 0.49, 0.21);
      s.bezierCurveTo(0.49, 0.34, 0.4, 0.4, 0.25, 0.43);
      s.bezierCurveTo(0.16, 0.45, 0.13, 0.48, 0.13, 0.53);
      s.bezierCurveTo(0.13, 0.58, 0.17, 0.61, 0.24, 0.61);
      s.bezierCurveTo(0.31, 0.61, 0.35, 0.58, 0.37, 0.52);
      s.closePath();
      return [s];
    },
  },
  t: {
    width: 0.36,
    build: () => [
      makeShape([
        [0.09, 0.15],
        [0.09, 0.58],
        [0.0, 0.58],
        [0.0, 0.7],
        [0.09, 0.7],
        [0.09, 0.92],
        [0.23, 0.92],
        [0.23, 0.7],
        [0.35, 0.7],
        [0.35, 0.58],
        [0.23, 0.58],
        [0.23, 0.14],
        [0.35, 0.14],
        [0.35, 0.01],
        [0.19, 0.01],
      ]),
    ],
  },
  u: {
    width: 0.58,
    build: () => {
      const s = new THREE.Shape();
      s.moveTo(0.0, 0.7);
      s.lineTo(0.14, 0.7);
      s.lineTo(0.14, 0.28);
      s.bezierCurveTo(0.14, 0.16, 0.2, 0.11, 0.28, 0.11);
      s.bezierCurveTo(0.38, 0.11, 0.43, 0.17, 0.43, 0.29);
      s.lineTo(0.43, 0.7);
      s.lineTo(0.57, 0.7);
      s.lineTo(0.57, 0.0);
      s.lineTo(0.43, 0.0);
      s.lineTo(0.43, 0.09);
      s.bezierCurveTo(0.39, 0.02, 0.32, -0.01, 0.24, -0.01);
      s.bezierCurveTo(0.1, -0.01, 0.0, 0.08, 0.0, 0.26);
      s.closePath();
      return [s];
    },
  },
  v: {
    width: 0.52,
    build: () => [
      makeShape([
        [0.0, 0.7],
        [0.15, 0.7],
        [0.26, 0.19],
        [0.37, 0.7],
        [0.52, 0.7],
        [0.33, 0.0],
        [0.19, 0.0],
      ]),
    ],
  },
  w: {
    width: 0.76,
    build: () => [
      makeShape([
        [0.0, 0.7],
        [0.14, 0.7],
        [0.23, 0.22],
        [0.32, 0.62],
        [0.44, 0.62],
        [0.53, 0.22],
        [0.62, 0.7],
        [0.76, 0.7],
        [0.6, 0.0],
        [0.46, 0.0],
        [0.38, 0.38],
        [0.3, 0.0],
        [0.16, 0.0],
      ]),
    ],
  },
  x: {
    width: 0.52,
    build: () => [
      makeShape([
        [0.0, 0.7],
        [0.16, 0.7],
        [0.26, 0.45],
        [0.36, 0.7],
        [0.52, 0.7],
        [0.34, 0.35],
        [0.52, 0.0],
        [0.36, 0.0],
        [0.26, 0.25],
        [0.16, 0.0],
        [0.0, 0.0],
        [0.18, 0.35],
      ]),
    ],
  },
  y: {
    width: 0.56,
    build: () => [
      makeShape([
        [0.0, 0.72],
        [0.15, 0.72],
        [0.29, 0.25],
        [0.42, 0.72],
        [0.56, 0.72],
        [0.31, -0.22],
        [0.15, -0.22],
        [0.22, 0.04],
      ]),
    ],
  },
  z: {
    width: 0.48,
    build: () => [
      makeShape([
        [0.0, 0.57],
        [0.0, 0.7],
        [0.48, 0.7],
        [0.48, 0.56],
        [0.16, 0.13],
        [0.48, 0.13],
        [0.48, 0.0],
        [0.0, 0.0],
        [0.0, 0.14],
        [0.32, 0.57],
      ]),
    ],
  },
};

export interface ExtrudedLetterMesh {
  geometry: THREE.ExtrudeGeometry;
  xOffset: number;
  yOffset: number;
  scale: number;
}

function splitLinesForDisplay(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    // Pair into two balanced visual lines (e.g. ["Shabbir", "Mahamud"])
    if (words.length === 2) return words;
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }
  return [text];
}

export function buildExtrudedWordGeometries(
  rawText: string,
  letterSpacing = 0.08,
  depth = 0.24
): { letters: ExtrudedLetterMesh[]; totalWidth: number; lineCount: number } {
  const clean = (rawText || 'Shabbir Mahamud').trim() || 'Shabbir Mahamud';
  const lines = splitLinesForDisplay(clean);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.044,
    curveSegments: 20,
  };

  const letters: ExtrudedLetterMesh[] = [];
  let maxLineWidth = 0;

  lines.forEach((lineText, lineIndex) => {
    const lineScale = lines.length > 1 ? (lineIndex === 0 ? 0.96 : 0.78) : 1.0;
    const lineY =
      lines.length > 1
        ? lineIndex === 0
          ? 0.24
          : -0.78
        : -0.35;

    const chars = Array.from(lineText);
    const shapesPerChar: Array<{ shapes: THREE.Shape[]; width: number }> = [];

    for (const ch of chars) {
      if (ch === ' ') {
        shapesPerChar.push({ shapes: [], width: 0.3 });
        continue;
      }
      const spec = GLYPHS[ch] || GLYPHS[ch.toUpperCase()] || GLYPHS[ch.toLowerCase()];
      if (spec) {
        shapesPerChar.push({ shapes: spec.build(), width: spec.width });
      } else {
        shapesPerChar.push({
          shapes: [makeShape(makeRect(0.05, 0.0, 0.36, 0.9), [makeRect(0.16, 0.16, 0.14, 0.58)])],
          width: 0.46,
        });
      }
    }

    const lineWidthRaw =
      shapesPerChar.reduce((sum, item) => sum + item.width, 0) +
      Math.max(0, shapesPerChar.length - 1) * letterSpacing;
    const scaledLineWidth = lineWidthRaw * lineScale;
    if (scaledLineWidth > maxLineWidth) maxLineWidth = scaledLineWidth;

    let cursor = -lineWidthRaw / 2;
    for (const item of shapesPerChar) {
      for (const shape of item.shapes) {
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.computeVertexNormals();
        letters.push({
          geometry: geo,
          xOffset: cursor * lineScale,
          yOffset: lineY,
          scale: lineScale,
        });
      }
      cursor += item.width + letterSpacing;
    }
  });

  return { letters, totalWidth: maxLineWidth, lineCount: lines.length };
}
