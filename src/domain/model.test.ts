import { describe, expect, it } from 'vitest';
import { coneTemplate, copyStep, duplicateSession, exerciseSchema, moveObject, nearestObject, newExercise, newObject, newSession, resizeCourt, duplicateExercise, sessionMinutes, sessionSchema } from './model';
import { bendFromPoint, curvePoint } from './geometry';
import { exerciseTemplates } from './templates';
import { starterExercises } from './starter';
import { trailsFor } from '../playback/timeline';
import { commit, initialHistory, redo, undo } from './history';
import { exampleExercise } from './example';

describe('exercise model', () => {
  it('creates valid exercises and a valid animated example', () => {
    expect(exerciseSchema.parse(newExercise()).steps).toHaveLength(1);
    expect(exerciseSchema.parse(exampleExercise()).steps).toHaveLength(4);
  });
  it('copies a step without sharing mutable objects and retains animation IDs', () => {
    const source = exampleExercise().steps[0];
    const next = copyStep(source);
    expect(next.id).not.toBe(source.id);
    expect(next.objects[0].id).toBe(source.objects[0].id);
    next.objects[0].x = 0;
    expect(source.objects[0].x).not.toBe(0);
  });
  it('maps all positions and arrow endpoints on full/half changes reversibly', () => {
    const exercise = exampleExercise();
    const half = resizeCourt(exercise, 'half');
    expect(half.steps[0].objects[0].x).toBe(exercise.steps[0].objects[0].x / 2);
    expect(half.steps[0].objects[0].x2).toBe(exercise.steps[0].objects[0].x2 / 2);
    expect(exerciseSchema.safeParse(half).success).toBe(true);
    expect(resizeCourt(half, 'full')).toEqual(exercise);
  });
  it('clamps a dragged arrow as a unit without changing its length', () => {
    const arrow = { ...newObject('arrow', 300, 200, 500), x2: 450, y2: 300 };
    const moved = moveObject(arrow, 300, 400, 500);
    expect(moved.x2).toBe(500);
    expect(moved.y2).toBe(500);
    expect(moved.x2 - moved.x).toBe(150);
    expect(moved.y2 - moved.y).toBe(100);
  });
  it('clamps individual positions at both court edges', () => {
    const player = newObject('player', 200, 100, 1000);
    expect(moveObject(player, -500, -500, 1000)).toMatchObject({ x: 0, y: 0 });
    expect(moveObject(player, 2000, 1000, 1000)).toMatchObject({ x: 1000, y: 500 });
  });
  it('duplicates the exercise without changing object continuity', () => {
    const original = exampleExercise();
    const copied = duplicateExercise(original);
    expect(copied.id).not.toBe(original.id);
    expect(copied.name).toContain('(kopia)');
    expect(copied.steps).toEqual(original.steps);
    expect(copied.steps).not.toBe(original.steps);
  });
  it('finds nearby small objects and arrow segments without selecting distant objects', () => {
    const player = newObject('player', 100, 100, 1000);
    const ball = newObject('ball', 130, 100, 1000);
    const arrow = { ...newObject('arrow', 300, 300, 1000), x2: 500, y2: 300 };
    expect(nearestObject([player, ball], { x: 90, y: 120 }, 70)).toBe(player);
    expect(nearestObject([player, ball], { x: 125, y: 120 }, 70)).toBe(ball);
    expect(nearestObject([arrow], { x: 400, y: 310 }, 20)).toBe(arrow);
    expect(nearestObject([arrow], { x: 100, y: 100 }, 20)).toBeUndefined();
    expect(nearestObject([{ ...arrow, x2: 300 }], { x: 310, y: 300 }, 20)?.id).toBe(arrow.id);
  });
  it('moves zones as a unit and selects a player standing inside a zone', () => {
    const zone = { ...newObject('zone', 100, 100, 1000), x2: 300, y2: 250 };
    expect(moveObject(zone, 50, 20, 1000)).toMatchObject({ x: 150, y: 120, x2: 350, y2: 270 });
    const player = newObject('player', 200, 180, 1000);
    expect(nearestObject([zone, player], { x: 205, y: 180 }, 30)).toBe(player);
    expect(nearestObject([zone, player], { x: 120, y: 120 }, 30)).toBe(zone);
  });
  it('selects a bent arrow along its curve instead of along the straight chord', () => {
    const arrow = { ...newObject('arrow', 100, 300, 1000), x2: 300, y2: 300, bend: 0.5 };
    const apex = curvePoint({ x: 100, y: 300 }, { x: 300, y: 300 }, 0.5, 0.5);
    expect(nearestObject([arrow], apex, 10)).toBe(arrow);
    expect(nearestObject([arrow], { x: 200, y: 300 }, 10)).toBeUndefined();
  });
  it('resets the movement path when copying a step', () => {
    const step = exampleExercise().steps[0];
    step.objects[2] = { ...step.objects[2], moveStyle: 'shot', moveBend: 0.4 };
    expect(copyStep(step).objects[2]).toMatchObject({ moveStyle: 'auto', moveBend: 0 });
  });
  it('places cone templates inside the court', () => {
    for (const template of ['row', 'triangle', 'square', 'slalom'] as const) {
      const cones = coneTemplate(template, 10, 490, 500);
      expect(cones.length).toBeGreaterThanOrEqual(3);
      expect(new Set(cones.map((cone) => cone.id)).size).toBe(cones.length);
      cones.forEach((cone) => expect(cone).toMatchObject({ kind: 'cone' }));
      cones.forEach((cone) => { expect(cone.x).toBeGreaterThanOrEqual(0); expect(cone.x).toBeLessThanOrEqual(500); expect(cone.y).toBeLessThanOrEqual(500); });
    }
  });
  it('builds valid exercise templates with continuous objects', () => {
    for (const template of exerciseTemplates) {
      const exercise = exerciseSchema.parse(template.build());
      expect(exercise.steps.length).toBeGreaterThan(1);
      expect(template.build().id).not.toBe(exercise.id);
    }
  });
  it('bundles five green and five blue valid starter exercises with stable IDs', () => {
    const starters = starterExercises();
    expect(starters).toHaveLength(10);
    expect(starters.filter((item) => item.level === 'green')).toHaveLength(5);
    expect(starters.filter((item) => item.level === 'blue')).toHaveLength(5);
    expect(new Set(starters.map((item) => item.name)).size).toBe(10);
    expect(starterExercises().map((item) => item.id)).toEqual(starters.map((item) => item.id));
    for (const starter of starters) {
      const exercise = exerciseSchema.parse(starter);
      expect(exercise.steps.length).toBeGreaterThan(2);
      for (const step of exercise.steps) {
        expect(step.description).not.toBe('');
        for (const object of step.objects) {
          expect(object.x).toBeGreaterThanOrEqual(20); expect(object.x).toBeLessThanOrEqual(980);
          expect(object.y).toBeGreaterThanOrEqual(20); expect(object.y).toBeLessThanOrEqual(480);
        }
      }
      const styles = exercise.steps.flatMap((_, index) => trailsFor(exercise.steps, index).map((trail) => trail.style));
      expect(styles.some((style) => style === 'pass' || style === 'shot')).toBe(true);
    }
  });
  it('defaults the level of older exercises to none', () => {
    const { level: _level, ...legacy } = newExercise();
    expect(exerciseSchema.parse(legacy).level).toBe('none');
  });
  it('duplicates a session and remaps exercise references', () => {
    const session = { ...newSession(), items: [{ id: 'a', exerciseId: 'old', minutes: 10, note: '' }, { id: 'b', exerciseId: 'other', minutes: 5, note: '' }] };
    const copy = duplicateSession(session, new Map([['old', 'new']]));
    expect(sessionSchema.parse(copy).id).not.toBe(session.id);
    expect(copy.items.map((item) => item.exerciseId)).toEqual(['new', 'other']);
    expect(copy.items[0].id).not.toBe('a');
    expect(sessionMinutes(copy)).toBe(15);
  });
});

describe('curve geometry', () => {
  it('converts a dragged handle to a bend and back to the same point', () => {
    const a = { x: 100, y: 100 };
    const b = { x: 300, y: 100 };
    const bend = bendFromPoint(a, b, { x: 200, y: 160 });
    const middle = curvePoint(a, b, bend, 0.5);
    expect(middle.x).toBeCloseTo(200);
    expect(middle.y).toBeCloseTo(160);
    expect(bendFromPoint(a, b, { x: 200, y: 102 })).toBe(0);
    expect(curvePoint(a, b, 0, 0.25)).toEqual({ x: 150, y: 100 });
  });
});

describe('undo and redo', () => {
  it('restores previous data and can redo it', () => {
    const first = initialHistory({ x: 0 });
    const edited = commit(first, { x: 100 });
    expect(undo(edited).present.x).toBe(0);
    expect(redo(undo(edited))).toEqual(edited);
    expect(undo(first)).toBe(first);
    expect(redo(first)).toBe(first);
  });
  it('clears redo on a new edit and ignores no-ops', () => {
    const first = initialHistory(0);
    expect(commit(first, 0)).toBe(first);
    expect(commit(undo(commit(first, 1)), 2).future).toEqual([]);
  });
  it('retains the most recent 80 undo operations', () => {
    let history = initialHistory(0);
    for (let index = 1; index <= 100; index++) history = commit(history, index);
    expect(history.past).toHaveLength(80);
    expect(history.past[0]).toBe(20);
  });
});
