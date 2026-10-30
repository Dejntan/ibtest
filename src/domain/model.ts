import { z } from 'zod';

const id = z.string().min(1).max(100);
const coordinate = z.number().finite().min(0).max(1000);
export const objectSchema = z.object({
  id,
  kind: z.enum(['player', 'ball', 'cone', 'goal', 'arrow', 'text']),
  x: coordinate,
  y: z.number().finite().min(0).max(500),
  x2: coordinate,
  y2: z.number().finite().min(0).max(500),
  team: z.enum(['green', 'orange']),
  number: z.number().int().min(1).max(99),
  text: z.string().max(500),
});
export const stepSchema = z.object({
  id,
  description: z.string().max(2000),
  duration: z.number().finite().min(0.5).max(60),
  objects: z.array(objectSchema).max(200),
}).superRefine((step, ctx) => {
  if (new Set(step.objects.map((object) => object.id)).size !== step.objects.length) {
    ctx.addIssue({ code: 'custom', message: 'Objekt-ID måste vara unika i ett steg.' });
  }
});
export const exerciseSchema = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  description: z.string().max(4000),
  court: z.enum(['full', 'half']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  steps: z.array(stepSchema).min(1).max(100),
}).superRefine((exercise, ctx) => {
  if (new Set(exercise.steps.map((step) => step.id)).size !== exercise.steps.length) {
    ctx.addIssue({ code: 'custom', message: 'Steg-ID måste vara unika.' });
  }
  const kinds = new Map<string, string>();
  const width = exercise.court === 'full' ? 1000 : 500;
  for (const step of exercise.steps) {
    for (const object of step.objects) {
      if (object.x > width || object.x2 > width) {
        ctx.addIssue({ code: 'custom', message: 'Objekt ligger utanför planen.' });
      }
      if (kinds.has(object.id) && kinds.get(object.id) !== object.kind) {
        ctx.addIssue({ code: 'custom', message: 'Samma objekt måste ha samma typ mellan stegen.' });
      }
      kinds.set(object.id, object.kind);
    }
  }
});
export const bundleSchema = z.object({
  format: z.literal('planverket'),
  version: z.literal(1),
  exercises: z.array(exerciseSchema).min(1).max(500),
}).superRefine((bundle, ctx) => {
  if (new Set(bundle.exercises.map((exercise) => exercise.id)).size !== bundle.exercises.length) {
    ctx.addIssue({ code: 'custom', message: 'Övnings-ID måste vara unika i filen.' });
  }
});

export type BoardObject = z.infer<typeof objectSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type Bundle = z.infer<typeof bundleSchema>;
export type ObjectKind = BoardObject['kind'];

export const uid = () => crypto.randomUUID();
export const courtWidth = (court: Exercise['court']) => court === 'full' ? 1000 : 500;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function newExercise(): Exercise {
  const now = new Date().toISOString();
  return {
    id: uid(), name: 'Ny övning', description: '', court: 'full',
    createdAt: now, updatedAt: now,
    steps: [{ id: uid(), description: '', duration: 3, objects: [] }],
  };
}

export function newObject(kind: ObjectKind, x: number, y: number, width: number, number = 1): BoardObject {
  return {
    id: uid(), kind, x, y, x2: clamp(x + 100, 0, width), y2: y,
    team: 'green', number, text: kind === 'text' ? 'Text' : '',
  };
}

export function copyStep(step: Step): Step {
  return { ...structuredClone(step), id: uid() };
}

export function resizeCourt(exercise: Exercise, court: Exercise['court']): Exercise {
  const ratio = courtWidth(court) / courtWidth(exercise.court);
  return {
    ...exercise, court,
    steps: exercise.steps.map((step) => ({
      ...step, objects: step.objects.map((object) => ({
        ...object, x: object.x * ratio, x2: object.x2 * ratio,
      })),
    })),
  };
}

export function moveObject(object: BoardObject, dx: number, dy: number, width: number): BoardObject {
  const arrow = object.kind === 'arrow';
  const minX = arrow ? Math.min(object.x, object.x2) : object.x;
  const maxX = arrow ? Math.max(object.x, object.x2) : object.x;
  const minY = arrow ? Math.min(object.y, object.y2) : object.y;
  const maxY = arrow ? Math.max(object.y, object.y2) : object.y;
  const x = clamp(dx, -minX, width - maxX);
  const y = clamp(dy, -minY, 500 - maxY);
  return {
    ...object, x: object.x + x, y: object.y + y,
    x2: clamp(object.x2 + x, 0, width), y2: clamp(object.y2 + y, 0, 500),
  };
}

export function nearestObject(objects: BoardObject[], point: { x: number; y: number }, tolerance: number): BoardObject | undefined {
  let nearest: BoardObject | undefined;
  let distance = tolerance;
  for (const object of objects) {
    let x = object.x;
    let y = object.y;
    if (object.kind === 'arrow') {
      const dx = object.x2 - x;
      const dy = object.y2 - y;
      const length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : clamp(((point.x - x) * dx + (point.y - y) * dy) / length, 0, 1);
      x += dx * t;
      y += dy * t;
    }
    const next = Math.hypot(point.x - x, point.y - y);
    if (next <= distance) { distance = next; nearest = object; }
  }
  return nearest;
}

export function duplicateExercise(exercise: Exercise): Exercise {
  const now = new Date().toISOString();
  return { ...structuredClone(exercise), id: uid(), name: `${exercise.name.slice(0, 110)} (kopia)`, createdAt: now, updatedAt: now };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
