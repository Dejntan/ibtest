import { z } from 'zod';
import { distanceToCurve } from './geometry';

const id = z.string().min(1).max(100);
const coordinate = z.number().finite().min(0).max(1000);
export const teams = ['green', 'orange', 'blue', 'yellow', 'red', 'white'] as const;
export const lineStyles = ['run', 'pass', 'shot', 'dribble', 'line'] as const;
export const moveStyles = ['auto', 'run', 'dribble', 'pass', 'shot', 'none'] as const;
const bend = z.number().finite().min(-1).max(1).default(0);
export const objectSchema = z.object({
  id,
  kind: z.enum(['player', 'goalkeeper', 'ball', 'cone', 'goal', 'arrow', 'zone', 'text']),
  x: coordinate,
  y: z.number().finite().min(0).max(500),
  x2: coordinate,
  y2: z.number().finite().min(0).max(500),
  team: z.enum(teams),
  number: z.number().int().min(1).max(99),
  text: z.string().max(500),
  style: z.enum(lineStyles).default('run'),
  bend,
  shape: z.enum(['rect', 'ellipse']).default('rect'),
  moveStyle: z.enum(moveStyles).default('auto'),
  moveBend: bend,
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
  showTrails: z.boolean().default(true),
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
export const sessionItemSchema = z.object({
  id,
  exerciseId: id,
  minutes: z.number().int().min(1).max(180),
  note: z.string().max(500),
});
export const sessionSchema = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  date: z.union([z.literal(''), z.iso.date()]),
  notes: z.string().max(4000),
  items: z.array(sessionItemSchema).max(100),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).superRefine((session, ctx) => {
  if (new Set(session.items.map((item) => item.id)).size !== session.items.length) {
    ctx.addIssue({ code: 'custom', message: 'Passets rader måste ha unika ID.' });
  }
});
const unique = (items: { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;
export const bundleSchema = z.discriminatedUnion('version', [
  z.object({
    format: z.literal('planverket'),
    version: z.literal(1),
    exercises: z.array(exerciseSchema).min(1).max(500),
  }),
  z.object({
    format: z.literal('planverket'),
    version: z.literal(2),
    exercises: z.array(exerciseSchema).max(500),
    sessions: z.array(sessionSchema).max(200).default([]),
  }),
]).superRefine((bundle, ctx) => {
  if (!unique(bundle.exercises)) ctx.addIssue({ code: 'custom', message: 'Övnings-ID måste vara unika i filen.' });
  const sessions = 'sessions' in bundle ? bundle.sessions : [];
  if (!unique(sessions)) ctx.addIssue({ code: 'custom', message: 'Pass-ID måste vara unika i filen.' });
  if (!bundle.exercises.length && !sessions.length) ctx.addIssue({ code: 'custom', message: 'Filen är tom.' });
});

export type BoardObject = z.infer<typeof objectSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type TrainingSession = z.infer<typeof sessionSchema>;
export type SessionItem = z.infer<typeof sessionItemSchema>;
export type ObjectKind = BoardObject['kind'];
export type Team = BoardObject['team'];
export type LineStyle = BoardObject['style'];
export type MoveStyle = BoardObject['moveStyle'];

export const teamColors: Record<Team, { fill: string; text: string; label: string }> = {
  green: { fill: '#215b4b', text: '#ffffff', label: 'Grön' },
  orange: { fill: '#c7613f', text: '#ffffff', label: 'Orange' },
  blue: { fill: '#2f5fae', text: '#ffffff', label: 'Blå' },
  yellow: { fill: '#e5b830', text: '#2b2a1c', label: 'Gul' },
  red: { fill: '#b8322f', text: '#ffffff', label: 'Röd' },
  white: { fill: '#fbfaf4', text: '#203f34', label: 'Vit' },
};
export const lineStyleLabels: Record<LineStyle, string> = {
  run: 'Löpning (streckad)', pass: 'Passning (heldragen)', shot: 'Skott (dubbel)', dribble: 'Dribbling (vågig)', line: 'Linje utan pil',
};
export const moveStyleLabels: Record<Exclude<MoveStyle, 'auto'>, string> = {
  run: 'Löpning', dribble: 'Dribbling', pass: 'Passning', shot: 'Skott', none: 'Dold',
};
export const movingKinds: ObjectKind[] = ['player', 'goalkeeper', 'ball'];
export const isMoving = (kind: ObjectKind) => movingKinds.includes(kind);
export const isTwoPoint = (kind: ObjectKind) => kind === 'arrow' || kind === 'zone';

export const uid = () => crypto.randomUUID();
export const courtWidth = (court: Exercise['court']) => court === 'full' ? 1000 : 500;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function newExercise(): Exercise {
  const now = new Date().toISOString();
  return {
    id: uid(), name: 'Ny övning', description: '', court: 'full', showTrails: true,
    createdAt: now, updatedAt: now,
    steps: [{ id: uid(), description: '', duration: 3, objects: [] }],
  };
}

export function newSession(): TrainingSession {
  const now = new Date().toISOString();
  return { id: uid(), name: 'Nytt träningspass', date: '', notes: '', items: [], createdAt: now, updatedAt: now };
}

export const sessionMinutes = (session: TrainingSession) => session.items.reduce((sum, item) => sum + item.minutes, 0);

export function newObject(kind: ObjectKind, x: number, y: number, width: number, number = 1): BoardObject {
  const zone = kind === 'zone';
  return {
    id: uid(), kind, x, y,
    x2: clamp(x + (zone ? 120 : 100), 0, width), y2: zone ? clamp(y + 80, 0, 500) : y,
    team: zone ? 'blue' : 'green', number, text: kind === 'text' ? 'Text' : '',
    style: 'run', bend: 0, shape: 'rect', moveStyle: 'auto', moveBend: 0,
  };
}

export type ConeTemplate = 'row' | 'triangle' | 'square' | 'slalom';
export const coneTemplateLabels: Record<ConeTemplate, string> = { row: 'Konrad', triangle: 'Triangel', square: 'Fyrkant', slalom: 'Slalom' };
const coneOffsets: Record<ConeTemplate, [number, number][]> = {
  row: [-80, -40, 0, 40, 80].map((x) => [x, 0]),
  triangle: [[0, -45], [-50, 40], [50, 40]],
  square: [[-50, -50], [50, -50], [50, 50], [-50, 50]],
  slalom: [-100, -60, -20, 20, 60, 100].map((x, index) => [x, index % 2 ? 20 : -20]),
};
export function coneTemplate(template: ConeTemplate, x: number, y: number, width: number): BoardObject[] {
  const offsets = coneOffsets[template];
  const minX = Math.min(...offsets.map(([dx]) => dx));
  const maxX = Math.max(...offsets.map(([dx]) => dx));
  const minY = Math.min(...offsets.map(([, dy]) => dy));
  const maxY = Math.max(...offsets.map(([, dy]) => dy));
  const cx = clamp(x, 20 - minX, width - 20 - maxX);
  const cy = clamp(y, 20 - minY, 480 - maxY);
  return offsets.map(([dx, dy]) => newObject('cone', cx + dx, cy + dy, width));
}

export function copyStep(step: Step): Step {
  const copy = structuredClone(step);
  return { ...copy, id: uid(), objects: copy.objects.map((object) => ({ ...object, moveStyle: 'auto', moveBend: 0 })) };
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
  const pair = isTwoPoint(object.kind);
  const minX = pair ? Math.min(object.x, object.x2) : object.x;
  const maxX = pair ? Math.max(object.x, object.x2) : object.x;
  const minY = pair ? Math.min(object.y, object.y2) : object.y;
  const maxY = pair ? Math.max(object.y, object.y2) : object.y;
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
    let next: number;
    if (object.kind === 'arrow') {
      next = distanceToCurve(object, { x: object.x2, y: object.y2 }, object.bend, point);
    } else if (object.kind === 'zone') {
      const inside = point.x >= Math.min(object.x, object.x2) && point.x <= Math.max(object.x, object.x2)
        && point.y >= Math.min(object.y, object.y2) && point.y <= Math.max(object.y, object.y2);
      // Zones lie underneath other objects, so any other object within reach wins.
      next = inside ? tolerance * .99 : Infinity;
    } else next = Math.hypot(point.x - object.x, point.y - object.y);
    if (next <= distance) { distance = next; nearest = object; }
  }
  return nearest;
}

export function duplicateExercise(exercise: Exercise): Exercise {
  const now = new Date().toISOString();
  return { ...structuredClone(exercise), id: uid(), name: `${exercise.name.slice(0, 110)} (kopia)`, createdAt: now, updatedAt: now };
}

export function duplicateSession(session: TrainingSession, exerciseIds = new Map<string, string>()): TrainingSession {
  const now = new Date().toISOString();
  return {
    ...structuredClone(session), id: uid(), name: `${session.name.slice(0, 110)} (kopia)`, createdAt: now, updatedAt: now,
    items: session.items.map((item) => ({ ...item, id: uid(), exerciseId: exerciseIds.get(item.exerciseId) ?? item.exerciseId })),
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
