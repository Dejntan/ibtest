import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openLibrary } from './database';
import { exampleExercise } from '../domain/example';
import { newExercise, newSession, uid } from '../domain/model';

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
  it('stores training sessions separately and imports exercises and sessions together', async () => {
    const name = crypto.randomUUID();
    const database = await openLibrary(name);
    expect(await database.sessions()).toEqual([]);
    const exercise = newExercise();
    const session = { ...newSession(), items: [{ id: uid(), exerciseId: exercise.id, minutes: 12, note: '' }] };
    await database.putMany([exercise], [session]);
    const reopened = await openLibrary(name);
    expect(await reopened.all()).toEqual([exercise]);
    expect(await reopened.sessions()).toEqual([session]);
    session.name = 'Matchförberedelse';
    await reopened.putSession(session);
    expect((await database.sessions())[0].name).toBe('Matchförberedelse');
    await reopened.removeSession(session.id);
    expect(await database.sessions()).toEqual([]);
    expect(await database.all()).toHaveLength(1);
  });
  it('writes nothing when a session in the batch is invalid', async () => {
    const database = await openLibrary(crypto.randomUUID());
    expect(() => database.putMany([newExercise()], [{ ...newSession(), name: '' }])).toThrow();
    expect(await database.all()).toEqual([]);
  });
});
