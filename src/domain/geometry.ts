export interface Point { x: number; y: number }

export function controlPoint(a: Point, b: Point, bend: number): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { x: (a.x + b.x) / 2 - dy * bend * 2, y: (a.y + b.y) / 2 + dx * bend * 2 };
}

export function curvePoint(a: Point, b: Point, bend: number, t: number): Point {
  if (!bend) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const c = controlPoint(a, b, bend);
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** Bend is the perpendicular offset of the curve midpoint as a fraction of the chord length. */
export function bendFromPoint(a: Point, b: Point, point: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return 0;
  const offset = ((point.x - (a.x + b.x) / 2) * -dy + (point.y - (a.y + b.y) / 2) * dx) / length;
  const bend = Math.max(-1, Math.min(1, offset / length));
  return Math.abs(bend) < .03 ? 0 : Math.round(bend * 1000) / 1000;
}

const round = (value: number) => Math.round(value * 10) / 10;

export function curvePath(a: Point, b: Point, bend: number): string {
  if (!bend) return `M${round(a.x)} ${round(a.y)}L${round(b.x)} ${round(b.y)}`;
  const c = controlPoint(a, b, bend);
  return `M${round(a.x)} ${round(a.y)}Q${round(c.x)} ${round(c.y)} ${round(b.x)} ${round(b.y)}`;
}

export function wavyPath(a: Point, b: Point, bend: number, wavelength = 26, amplitude = 6): string {
  const samples = 48;
  const points: Point[] = [];
  let length = 0;
  let previous = a;
  for (let index = 0; index <= samples; index++) {
    const point = curvePoint(a, b, bend, index / samples);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    points.push(point);
    previous = point;
  }
  const waves = Math.max(1, Math.round(length / wavelength));
  return points.map((point, index) => {
    const t = index / samples;
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(samples, index + 1)];
    const tx = after.x - before.x;
    const ty = after.y - before.y;
    const norm = Math.hypot(tx, ty) || 1;
    const envelope = Math.min(1, t * 6, (1 - t) * 6);
    const offset = Math.sin(t * waves * Math.PI * 2) * amplitude * envelope;
    return `${index ? 'L' : 'M'}${round(point.x - ty / norm * offset)} ${round(point.y + tx / norm * offset)}`;
  }).join('');
}

export function distanceToCurve(a: Point, b: Point, bend: number, point: Point): number {
  let best = Infinity;
  let previous = a;
  for (let index = 1; index <= 16; index++) {
    const next = curvePoint(a, b, bend, index / 16);
    best = Math.min(best, distanceToSegment(previous, next, point));
    previous = next;
  }
  return best;
}

function distanceToSegment(a: Point, b: Point, point: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}
