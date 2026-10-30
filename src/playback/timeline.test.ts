import { describe, expect, it } from 'vitest';
import { newExercise, newObject, copyStep, type Step } from '../domain/model';
import { frameAt, stepTime, totalDuration } from './timeline';

function steps(): Step[] {
  const first = newExercise().steps[0];
  first.duration = 2;
  first.objects = [newObject('player', 100, 100, 1000), newObject('ball', 120, 100, 1000), newObject('cone', 500, 300, 1000)];
  const next = copyStep(first);
  next.duration = 4;
  next.objects = next.objects.map((object) => ({ ...object, x: object.x + 200, y: object.y + 100 }));
  const last = copyStep(next);
  last.objects = last.objects.map((object) => ({ ...object, x: object.x + 100 }));
  return [first, next, last];
}

describe('timeline', () => {
  it('uses only transition durations, not a trailing hold', () => {
    expect(totalDuration(steps())).toBe(6);
    expect(stepTime(steps(), 2)).toBe(6);
    expect(totalDuration([steps()[0]])).toBe(0);
  });
  it('interpolates players and ball, but not static annotations', () => {
    const source = steps();
    const frame = frameAt(source, 1);
    expect(frame.index).toBe(0);
    expect(frame.objects[0]).toMatchObject({ x: 200, y: 150 });
    expect(frame.objects[1]).toMatchObject({ x: 220, y: 150 });
    expect(frame.objects[2]).toEqual(source[0].objects[2]);
    expect(source[0].objects[0].x).toBe(100);
  });
  it('selects the exact target at a boundary and clamps before/after playback', () => {
    const source = steps();
    expect(frameAt(source, 2).objects).toEqual(source[1].objects);
    expect(frameAt(source, 100).objects).toEqual(source[2].objects);
    expect(frameAt(source, -10).objects).toEqual(source[0].objects);
    expect(frameAt([source[0]], 10).objects).toEqual(source[0].objects);
  });
  it('does not animate when reduced motion is enabled', () => {
    const source = steps();
    expect(frameAt(source, 1, true).objects).toEqual(source[0].objects);
    expect(frameAt(source, 2, true).objects).toEqual(source[1].objects);
  });
  it('adds and removes unmatched objects only at step boundaries', () => {
    const source = steps();
    const removed = source[0].objects.shift()!;
    const added = newObject('player', 400, 400, 1000);
    source[0].objects.push(added);
    expect(frameAt(source, 1).objects).not.toContainEqual(removed);
    expect(frameAt(source, 1).objects.find((item) => item.id === added.id)).toEqual(added);
    expect(frameAt(source, 2).objects.some((item) => item.id === added.id)).toBe(false);
    expect(frameAt(source, 2).objects.some((item) => item.id === removed.id)).toBe(true);
  });
});
