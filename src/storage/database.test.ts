import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openLibrary } from './database';
import { exampleExercise } from '../domain/example';
import { newExercise } from '../domain/model';

describe('local IndexedDB library', () => {
  it('saves, overwrites, reloads and removes exercises', async () => {
    const name = crypto.randomUUID();
    const database = await openLibrary(name);
    expect(await database.all()).toEqual([]);
    const exercise = exampleExercise();
    await database.put(exercise);
    exercise.name = 'Ändrat namn';
    await database.put(exercise);
    const reopened = await openLibrary(name);
    expect(await reopened.all()).toEqual([exercise]);
    await reopened.remove(exercise.id);
    expect(await database.all()).toEqual([]);
  });
  it('validates the entire batch before performing writes', async () => {
    const database = await openLibrary(crypto.randomUUID());
    const valid = newExercise();
    const invalid = newExercise();
    invalid.steps = [];
    expect(() => database.putMany([valid, invalid])).toThrow();
    expect(await database.all()).toEqual([]);
    await database.putMany([valid, newExercise()]);
    expect(await database.all()).toHaveLength(2);
  });
});
