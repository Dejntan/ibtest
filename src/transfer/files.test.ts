import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkFileSize, decodeBundle, encodeBundle, MAX_FILE_BYTES, shareFile } from './files';
import { exampleExercise } from '../domain/example';
import { newExercise, newObject, newSession, uid } from '../domain/model';

afterEach(() => vi.unstubAllGlobals());

describe('portable exercise files', () => {
  it('round-trips an exercise and the entire library without losing steps or IDs', () => {
    const library = [exampleExercise(), newExercise()];
    expect(decodeBundle(encodeBundle(library))).toEqual({ exercises: library, sessions: [] });
  });
  it('round-trips training sessions together with their exercises', () => {
    const exercise = exampleExercise();
    const session = { ...newSession(), name: 'Tisdag', date: '2026-03-10', items: [{ id: uid(), exerciseId: exercise.id, minutes: 15, note: 'Två grupper' }] };
    const text = encodeBundle([exercise], [session]);
    expect(JSON.parse(text).version).toBe(2);
    expect(decodeBundle(text)).toEqual({ exercises: [exercise], sessions: [session] });
  });
  it('still imports version 1 files from earlier app versions and fills in new fields', () => {
    const newFields = ['showTrails', 'style', 'bend', 'shape', 'moveStyle', 'moveBend'];
    const exercise: unknown = JSON.parse(JSON.stringify(exampleExercise()), (key, value: unknown) => newFields.includes(key) ? undefined : value);
    const imported = decodeBundle(JSON.stringify({ format: 'planverket', version: 1, exercises: [exercise] }));
    expect(imported.sessions).toEqual([]);
    expect(imported.exercises[0].showTrails).toBe(true);
    expect(imported.exercises[0].steps[0].objects[0]).toMatchObject({ style: 'run', moveStyle: 'auto', moveBend: 0, bend: 0, shape: 'rect' });
  });
  it('rejects empty files and sessions with duplicate IDs', () => {
    expect(() => decodeBundle(JSON.stringify({ format: 'planverket', version: 2, exercises: [], sessions: [] }))).toThrow();
    const session = newSession();
    expect(() => encodeBundle([], [session, session])).toThrow();
  });
  it('rejects invalid JSON and unsupported formats/versions explicitly', () => {
    expect(() => decodeBundle('{')).toThrow('inte giltig JSON');
    expect(() => decodeBundle(JSON.stringify({ format: 'other', version: 1, exercises: [] }))).toThrow('ogiltigt innehåll');
    expect(() => decodeBundle(JSON.stringify({ format: 'planverket', version: 99, exercises: [newExercise()] }))).toThrow('filversion');
  });
  it.each([
    ['empty steps', (e: ReturnType<typeof newExercise>) => { e.steps = []; }],
    ['negative duration', (e: ReturnType<typeof newExercise>) => { e.steps[0].duration = -1; }],
    ['excessive duration', (e: ReturnType<typeof newExercise>) => { e.steps[0].duration = 61; }],
    ['duplicate steps', (e: ReturnType<typeof newExercise>) => { e.steps.push(e.steps[0]); }],
    ['duplicate objects', (e: ReturnType<typeof newExercise>) => { const object = exampleExercise().steps[0].objects[0]; e.steps[0].objects = [object, object]; }],
    ['invalid date', (e: ReturnType<typeof newExercise>) => { e.updatedAt = 'invalid'; }],
    ['half-court bounds', (e: ReturnType<typeof newExercise>) => { e.court = 'half'; e.steps[0].objects = exampleExercise().steps[0].objects; }],
    ['empty name', (e: ReturnType<typeof newExercise>) => { e.name = ' '; }],
  ])('rejects %s', (_label, mutate) => {
    const exercise = newExercise();
    mutate(exercise);
    expect(() => decodeBundle(JSON.stringify({ format: 'planverket', version: 1, exercises: [exercise] }))).toThrow();
  });
  it('rejects a partial invalid batch instead of silently importing the valid entries', () => {
    expect(() => decodeBundle(JSON.stringify({ format: 'planverket', version: 1, exercises: [newExercise(), {}] }))).toThrow();
  });
  it('rejects duplicate exercise IDs and objects changing kind between steps', () => {
    const exercise = exampleExercise();
    expect(() => encodeBundle([exercise, exercise])).toThrow();
    exercise.steps[1].objects[0].kind = 'ball';
    expect(() => encodeBundle([exercise])).toThrow();
  });
  it('rejects non-finite numeric values before exporting', () => {
    const exercise = exampleExercise();
    exercise.steps[0].objects[0].x = Infinity;
    expect(() => encodeBundle([exercise])).toThrow();
  });
  it('accepts the exact file limit and rejects an additional byte', () => {
    expect(() => checkFileSize(MAX_FILE_BYTES)).not.toThrow();
    expect(() => checkFileSize(MAX_FILE_BYTES + 1)).toThrow('10 MB');
    expect(() => decodeBundle(' '.repeat(MAX_FILE_BYTES + 1))).toThrow('10 MB');
  });
  it('does not export a file too large to import again', () => {
    const exercise = newExercise();
    exercise.steps = Array.from({ length: 100 }, (_, index) => ({
      id: `step-${index}`, description: '', duration: 3,
      objects: Array.from({ length: 200 }, (_, objectIndex) => ({
        ...newObject('text', 100, 100, 1000), id: `object-${objectIndex}`, text: 'å'.repeat(500),
      })),
    }));
    expect(() => encodeBundle([exercise])).toThrow('10 MB');
  });
  it('reports cancelled native sharing without claiming success', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: () => Promise.reject(new DOMException('Cancelled', 'AbortError')),
    });
    expect(await shareFile(new File(['{}'], 'ovning.json'))).toBe('cancelled');
  });
  it('reports native sharing failure and success separately', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.reject(new Error('Unavailable')) });
    await expect(shareFile(new File(['{}'], 'ovning.json'))).rejects.toThrow('Exportera fil');
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.resolve() });
    expect(await shareFile(new File(['{}'], 'ovning.json'))).toBe('shared');
  });
});
