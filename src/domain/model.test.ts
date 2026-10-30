import { describe, expect, it } from 'vitest';
import { copyStep, exerciseSchema, moveObject, nearestObject, newExercise, newObject, resizeCourt, duplicateExercise } from './model';
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
