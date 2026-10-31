import { copyStep, newExercise, newObject, type BoardObject, type Exercise, type ObjectKind, type Team } from './model';
import { exampleExercise } from './example';

interface Actor { key: string; kind: ObjectKind; x: number; y: number; team?: Team; number?: number; text?: string }
interface Frame { description: string; duration?: number; moves: Record<string, [number, number]>; bends?: Record<string, number> }

export function build(name: string, description: string, start: string, actors: Actor[], frames: Frame[]): Exercise {
  const exercise = newExercise();
  exercise.name = name;
  exercise.description = description;
  const ids = new Map<string, string>();
  const objects: BoardObject[] = actors.map((actor) => {
    const object = { ...newObject(actor.kind, actor.x, actor.y, 1000, actor.number ?? 1), team: actor.team ?? 'green', text: actor.text ?? '' };
    ids.set(actor.key, object.id);
    return object;
  });
  exercise.steps[0] = { ...exercise.steps[0], description: start, duration: frames[0]?.duration ?? 2, objects };
  frames.forEach((frame, index) => {
    const previous = exercise.steps[exercise.steps.length - 1];
    const next = copyStep(previous);
    next.description = frame.description;
    next.duration = frames[index + 1]?.duration ?? 2;
    next.objects = next.objects.map((object) => {
      const move = Object.entries(frame.moves).find(([key]) => ids.get(key) === object.id)?.[1];
      return move ? { ...object, x: move[0], y: move[1] } : object;
    });
    previous.objects = previous.objects.map((object) => {
      const bend = Object.entries(frame.bends ?? {}).find(([key]) => ids.get(key) === object.id)?.[1];
      return bend ? { ...object, moveBend: bend } : object;
    });
    exercise.steps.push(next);
  });
  return exercise;
}

export interface ExerciseTemplate { id: string; name: string; description: string; build: () => Exercise }

export const exerciseTemplates: ExerciseTemplate[] = [
  {
    id: 'two-on-one', name: '2 mot 1', description: 'Överlägen anfallare: driv, dra på dig försvararen och spela fri medspelaren.',
    build: () => build('2 mot 1', 'Bollhållaren driver mot backen, drar på sig försvararen och passar till den fria medspelaren som avslutar.', 'Spelare 1 har bollen. Spelare 2 löper parallellt.', [
      { key: 'p1', kind: 'player', x: 600, y: 170, number: 1 },
      { key: 'ball', kind: 'ball', x: 618, y: 176 },
      { key: 'p2', kind: 'player', x: 600, y: 330, number: 2 },
      { key: 'd', kind: 'player', x: 780, y: 250, number: 3, team: 'orange' },
      { key: 'gk', kind: 'goalkeeper', x: 895, y: 250, number: 1, team: 'orange' },
      { key: 'c1', kind: 'cone', x: 560, y: 170 },
      { key: 'c2', kind: 'cone', x: 560, y: 330 },
    ], [
      { description: 'Spelare 1 driver mot försvararen och drar på sig hen.', duration: 2, moves: { p1: [740, 190], ball: [758, 196], d: [790, 220], p2: [720, 345] }, bends: { p2: .12 } },
      { description: 'Spelare 1 passar till den fria spelare 2.', duration: 1.2, moves: { ball: [775, 326], p2: [760, 338], gk: [890, 270] } },
      { description: 'Spelare 2 avslutar direkt.', duration: 1, moves: { ball: [915, 258] } },
    ]),
  },
  {
    id: 'passing-square', name: 'Passningsfyrkant', description: 'Passa och följ efter passningen till nästa kon.',
    build: () => build('Passningsfyrkant', 'Fyra spelare vid varsin kon. Passa till nästa hörn och följ efter din passning. Byt riktning efter en stund.', 'Spelare 1 startar med bollen.', [
      { key: 'c1', kind: 'cone', x: 400, y: 150 }, { key: 'c2', kind: 'cone', x: 600, y: 150 },
      { key: 'c3', kind: 'cone', x: 600, y: 350 }, { key: 'c4', kind: 'cone', x: 400, y: 350 },
      { key: 'p1', kind: 'player', x: 380, y: 150, number: 1 }, { key: 'p2', kind: 'player', x: 620, y: 150, number: 2 },
      { key: 'p3', kind: 'player', x: 620, y: 350, number: 3 }, { key: 'p4', kind: 'player', x: 380, y: 350, number: 4 },
      { key: 'ball', kind: 'ball', x: 398, y: 160 },
    ], [
      { description: 'Spelare 1 passar till 2 och följer efter.', duration: 1.5, moves: { ball: [602, 160], p1: [640, 100] }, bends: { p1: -.12 } },
      { description: 'Spelare 2 passar till 3 och följer efter.', duration: 1.5, moves: { ball: [610, 332], p2: [670, 370] }, bends: { p2: -.12 } },
      { description: 'Spelare 3 passar till 4 och följer efter. Fortsätt runt fyrkanten.', duration: 1.5, moves: { ball: [398, 340], p3: [360, 400] }, bends: { p3: -.12 } },
    ]),
  },
  {
    id: 'pass-shot', name: 'Skott efter passning', description: 'Löp in i passningen och avsluta direkt.',
    build: () => build('Skott efter passning', 'Passaren spelar in i löpningen. Mottagaren avslutar direkt, passaren följer upp för retur.', 'Spelare 1 har bollen. Spelare 2 startar löpningen.', [
      { key: 'p1', kind: 'player', x: 550, y: 350, number: 1 },
      { key: 'ball', kind: 'ball', x: 568, y: 344 },
      { key: 'p2', kind: 'player', x: 690, y: 150, number: 2 },
      { key: 'gk', kind: 'goalkeeper', x: 895, y: 250, number: 1, team: 'orange' },
      { key: 'c1', kind: 'cone', x: 690, y: 115 },
    ], [
      { description: 'Spelare 1 passar framför spelare 2 som löper mot mål.', duration: 1.5, moves: { ball: [760, 216], p2: [745, 205] }, bends: { p2: .2 } },
      { description: 'Spelare 2 skjuter direkt. Spelare 1 följer upp för retur.', duration: 1, moves: { ball: [915, 245], p1: [800, 330], gk: [895, 240] }, bends: { p1: -.15 } },
    ]),
  },
  {
    id: 'build-up', name: 'Uppspel från back', description: 'Målvakten startar, backen driver och spelar upp till forwarden.',
    build: () => build('Uppspel från back', 'Målvakten spelar ut till en back som driver förbi pressen och passar till en forward i rörelse.', 'Målvakten har bollen. Motståndaren pressar.', [
      { key: 'gk', kind: 'goalkeeper', x: 110, y: 250, number: 1 },
      { key: 'ball', kind: 'ball', x: 128, y: 256 },
      { key: 'b1', kind: 'player', x: 230, y: 140, number: 2 },
      { key: 'b2', kind: 'player', x: 230, y: 360, number: 3 },
      { key: 'f', kind: 'player', x: 420, y: 120, number: 4 },
      { key: 'o', kind: 'player', x: 330, y: 250, number: 5, team: 'orange' },
    ], [
      { description: 'Målvakten passar ut till back 3.', duration: 1.5, moves: { ball: [247, 352], o: [300, 320] } },
      { description: 'Backen driver förbi pressen.', duration: 1.5, moves: { b2: [330, 405], ball: [348, 400], o: [315, 375] }, bends: { b2: .1 } },
      { description: 'Backen spelar upp till forwarden som möter.', duration: 1.5, moves: { ball: [486, 210], f: [470, 200] }, bends: { f: .2 } },
      { description: 'Forwarden driver mot mål.', duration: 2, moves: { f: [650, 230], ball: [668, 236] } },
    ]),
  },
  { id: 'example', name: 'Passa, löp, avsluta', description: 'Väggspel och avslut.', build: exampleExercise },
];
