import type { BoardObject, LineStyle, Step } from '../domain/model';
import { clamp, isMoving } from '../domain/model';
import { curvePoint, type Point } from '../domain/geometry';

export interface Trail {
  id: string;
  from: Point;
  to: Point;
  bend: number;
  style: LineStyle | 'none';
}

export function totalDuration(steps: Step[]): number {
  return steps.slice(0, -1).reduce((sum, step) => sum + step.duration, 0);
}

export function stepTime(steps: Step[], index: number): number {
  return steps.slice(0, index).reduce((sum, step) => sum + step.duration, 0);
}

const NEAR_BALL = 45;
const NEAR_GOAL = 45;
const isCarrier = (object: BoardObject) => object.kind === 'player' || object.kind === 'goalkeeper';
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Resolves the automatic line type: a ball moving with a player is dribbled, a ball alone is passed or shot. */
export function trailStyle(object: BoardObject, from: Step, to: Step): Trail['style'] {
  if (object.moveStyle !== 'auto') return object.moveStyle;
  const next = to.objects.find((item) => item.id === object.id);
  if (!next) return 'none';
  const ballFrom = from.objects.filter((item) => item.kind === 'ball');
  const nextById = new Map(to.objects.map((item) => [item.id, item]));
  const carries = (player: BoardObject) => ballFrom.some((ball) => {
    const ballNext = nextById.get(ball.id);
    return ballNext && distance(ball, player) <= NEAR_BALL && distance(ballNext, nextById.get(player.id) ?? player) <= NEAR_BALL;
  });
  if (isCarrier(object)) return carries(object) ? 'dribble' : 'run';
  if (object.kind !== 'ball') return 'none';
  const carried = from.objects.some((player) => isCarrier(player) && nextById.has(player.id)
    && distance(player, object) <= NEAR_BALL && distance(nextById.get(player.id)!, next) <= NEAR_BALL);
  if (carried) return 'none';
  const goals: Point[] = [{ x: 77, y: 250 }, { x: 922, y: 250 }, ...to.objects.filter((item) => item.kind === 'goal')];
  return goals.some((goal) => distance(goal, next) <= NEAR_GOAL) ? 'shot' : 'pass';
}

export function trailsFor(steps: Step[], index: number): Trail[] {
  const from = steps[index];
  const to = steps[index + 1];
  if (!from || !to) return [];
  const next = new Map(to.objects.map((object) => [object.id, object]));
  return from.objects.flatMap((object) => {
    const target = next.get(object.id);
    if (!target || !isMoving(object.kind) || distance(object, target) < 2) return [];
    return [{ id: object.id, from: { x: object.x, y: object.y }, to: { x: target.x, y: target.y }, bend: object.moveBend, style: trailStyle(object, from, to) }];
  });
}

export function frameAt(steps: Step[], elapsed: number, reducedMotion = false): { index: number; objects: BoardObject[] } {
  let time = Math.max(0, elapsed);
  for (let index = 0; index < steps.length - 1; index++) {
    const from = steps[index];
    if (time >= from.duration) { time -= from.duration; continue; }
    if (reducedMotion) return { index, objects: from.objects };
    const target = new Map(steps[index + 1].objects.map((object) => [object.id, object]));
    const t = clamp(time / from.duration, 0, 1);
    return {
      index,
      objects: from.objects.map((object) => {
        const next = target.get(object.id);
        if (!next || !isMoving(object.kind)) return object;
        return { ...object, ...curvePoint(object, next, object.moveBend, t) };
      }),
    };
  }
  return { index: steps.length - 1, objects: steps[steps.length - 1].objects };
}
