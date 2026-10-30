import type { BoardObject, Step } from '../domain/model';
import { clamp } from '../domain/model';

export function totalDuration(steps: Step[]): number {
  return steps.slice(0, -1).reduce((sum, step) => sum + step.duration, 0);
}

export function stepTime(steps: Step[], index: number): number {
  return steps.slice(0, index).reduce((sum, step) => sum + step.duration, 0);
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
        if (!next || (object.kind !== 'player' && object.kind !== 'ball')) return object;
        return { ...object, x: object.x + (next.x - object.x) * t, y: object.y + (next.y - object.y) * t };
      }),
    };
  }
  return { index: steps.length - 1, objects: steps[steps.length - 1].objects };
}
