import { build, exerciseTemplates } from './templates';
import type { Exercise, Level } from './model';

interface Starter { id: string; level: Exclude<Level, 'none'>; create: () => Exercise }

const starters: Starter[] = [
  {
    id: 'starter-green-pass-pairs', level: 'green',
    create: () => build('Passningar i par', 'Två och två, 6–8 meter isär. Passa på forehand och backhand och ta emot med ett mjukt blad. Byt sida efter en stund.', 'Spelare 1 har bollen och tittar upp mot sin kompis.', [
      { key: 'p1', kind: 'player', x: 400, y: 250, number: 1 },
      { key: 'ball', kind: 'ball', x: 418, y: 254 },
      { key: 'p2', kind: 'player', x: 600, y: 250, number: 2 },
    ], [
      { description: 'Spelare 1 passar. Spelare 2 tar emot och dämpar bollen.', duration: 1.2, moves: { ball: [582, 254] } },
      { description: 'Spelare 2 passar tillbaka på backhand.', duration: 1.2, moves: { ball: [418, 246] } },
      { description: 'Spelare 1 tar emot. Fortsätt fram och tillbaka.', duration: 1.2, moves: { ball: [582, 246] } },
    ]),
  },
  {
    id: 'starter-green-slalom', level: 'green',
    create: () => build('Dribbling mellan koner', 'Dribbla slalom mellan konerna med bollen nära bladet och avsluta med skott. Titta upp mellan konerna.', 'Spelaren startar med bollen framför konerna.', [
      { key: 'p1', kind: 'player', x: 250, y: 250, number: 1 },
      { key: 'ball', kind: 'ball', x: 268, y: 256 },
      { key: 'c1', kind: 'cone', x: 350, y: 250 }, { key: 'c2', kind: 'cone', x: 450, y: 250 },
      { key: 'c3', kind: 'cone', x: 550, y: 250 }, { key: 'c4', kind: 'cone', x: 650, y: 250 },
      { key: 'gk', kind: 'goalkeeper', x: 895, y: 250, number: 1, team: 'orange' },
    ], [
      { description: 'Dribbla till vänster om första konen.', duration: 1, moves: { p1: [400, 195], ball: [418, 201] } },
      { description: 'Byt sida mellan konerna.', duration: 1, moves: { p1: [500, 305], ball: [518, 299] } },
      { description: 'Fortsätt slalom.', duration: 1, moves: { p1: [600, 195], ball: [618, 201] } },
      { description: 'Sista konen – ta sikte på mål.', duration: 1.2, moves: { p1: [720, 285], ball: [738, 280] } },
      { description: 'Avsluta med skott.', duration: 1, moves: { ball: [912, 262] } },
    ]),
  },
  {
    id: 'starter-green-drive-shoot', level: 'green',
    create: () => build('Driv och skjut', 'Spelarna står i led. Driv runt konen i hög fart och skjut mot mål. Nästa spelare startar när skottet går.', 'Spelare 1 har bollen. Spelare 2 väntar på tur.', [
      { key: 'p1', kind: 'player', x: 480, y: 130, number: 1 },
      { key: 'ball', kind: 'ball', x: 498, y: 136 },
      { key: 'p2', kind: 'player', x: 430, y: 130, number: 2 },
      { key: 'c1', kind: 'cone', x: 700, y: 160 },
      { key: 'gk', kind: 'goalkeeper', x: 895, y: 250, number: 1, team: 'orange' },
    ], [
      { description: 'Driv runt konen i full fart.', duration: 1.8, moves: { p1: [740, 220], ball: [758, 226] }, bends: { p1: .18 } },
      { description: 'Skjut. Spelare 2 gör sig redo.', duration: 1, moves: { ball: [912, 262], p2: [480, 130], gk: [895, 258] } },
    ]),
  },
  {
    id: 'starter-green-pass-follow', level: 'green',
    create: () => build('Passa och byt led', 'Två led mittemot varandra. Passa till första spelaren i andra ledet och spring efter din passning. Ställ dig sist i det ledet.', 'Spelare 1 har bollen.', [
      { key: 'p1', kind: 'player', x: 350, y: 250, number: 1 },
      { key: 'ball', kind: 'ball', x: 368, y: 254 },
      { key: 'p2', kind: 'player', x: 305, y: 250, number: 2 },
      { key: 'p3', kind: 'player', x: 650, y: 250, number: 3 },
      { key: 'p4', kind: 'player', x: 695, y: 250, number: 4 },
      { key: 'c1', kind: 'cone', x: 350, y: 300 }, { key: 'c2', kind: 'cone', x: 650, y: 300 },
    ], [
      { description: 'Spelare 1 passar till 3 och springer efter till andra ledet.', duration: 1.6, moves: { ball: [632, 254], p1: [740, 250], p2: [350, 250] }, bends: { p1: .25 } },
      { description: 'Spelare 3 passar till 2 och springer efter.', duration: 1.6, moves: { ball: [368, 246], p3: [260, 250], p4: [650, 250] }, bends: { p3: .25 } },
      { description: 'Spelare 2 passar till 4. Fortsätt så.', duration: 1.6, moves: { ball: [632, 246], p2: [785, 250] }, bends: { p2: .25 } },
    ]),
  },
  {
    id: 'starter-green-1v1', level: 'green',
    create: () => build('1 mot 1 mot mål', 'Anfallaren försöker ta sig förbi och avsluta. Försvararen håller kroppen mellan anfallaren och mål och försöker vinna bollen.', 'Anfallaren har bollen. Försvararen väntar vid mål.', [
      { key: 'a', kind: 'player', x: 550, y: 180, number: 1 },
      { key: 'ball', kind: 'ball', x: 568, y: 186 },
      { key: 'd', kind: 'player', x: 720, y: 250, number: 2, team: 'orange' },
      { key: 'gk', kind: 'goalkeeper', x: 895, y: 250, number: 1, team: 'orange' },
    ], [
      { description: 'Anfallaren driver. Försvararen kliver fram och stänger vägen mot mål.', duration: 1.5, moves: { a: [670, 175], ball: [688, 181], d: [740, 215] } },
      { description: 'Anfallaren finterar och drar in mot mitten.', duration: 1.3, moves: { a: [770, 290], ball: [788, 286], d: [748, 228] }, bends: { a: .25 } },
      { description: 'Avslut innan försvararen hinner tillbaka.', duration: 1, moves: { ball: [912, 258], gk: [893, 262], d: [790, 260] } },
    ]),
  },
  {
    id: 'starter-blue-give-go', level: 'blue',
    create: () => build('Väggspel och avslut', 'Passa till väggen, spring förbi försvararen och få tillbaka bollen i löpningen. Avsluta direkt.', 'Spelare 1 har bollen. Spelare 2 är vägg.', [
      { key: 'p1', kind: 'player', x: 520, y: 350, number: 1 },
      { key: 'ball', kind: 'ball', x: 538, y: 344 },
      { key: 'p2', kind: 'player', x: 680, y: 250, number: 2 },
      { key: 'd', kind: 'player', x: 650, y: 305, number: 3, team: 'orange' },
      { key: 'gk', kind: 'goalkeeper', x: 895, y: 250, number: 1, team: 'orange' },
    ], [
      { description: 'Spelare 1 passar till väggen och startar löpningen.', duration: 1.2, moves: { ball: [662, 254], p1: [600, 375] } },
      { description: 'Väggen spelar direkt tillbaka i löpningen förbi försvararen.', duration: 1.3, moves: { ball: [742, 330], p1: [760, 335] }, bends: { p1: .15 } },
      { description: 'Spelare 1 avslutar direkt.', duration: 1, moves: { ball: [913, 244], gk: [893, 268] } },
    ]),
  },
  {
    id: 'starter-blue-2v1', level: 'blue',
    create: () => exerciseTemplates.find((template) => template.id === 'two-on-one')!.build(),
  },
  {
    id: 'starter-blue-triangle', level: 'blue',
    create: () => build('Passningstriangel', 'Tre koner i en triangel. Passa och följ efter din passning till nästa kon. Byt håll efter en stund och spela med en touch.', 'Spelare 1 har bollen. Spelare 4 väntar bakom.', [
      { key: 'c1', kind: 'cone', x: 400, y: 150 }, { key: 'c2', kind: 'cone', x: 600, y: 150 }, { key: 'c3', kind: 'cone', x: 500, y: 350 },
      { key: 'p1', kind: 'player', x: 380, y: 150, number: 1 },
      { key: 'ball', kind: 'ball', x: 398, y: 156 },
      { key: 'p4', kind: 'player', x: 340, y: 150, number: 4 },
      { key: 'p2', kind: 'player', x: 620, y: 150, number: 2 },
      { key: 'p3', kind: 'player', x: 500, y: 375, number: 3 },
    ], [
      { description: 'Spelare 1 passar till 2 och följer efter. Spelare 4 kliver fram.', duration: 1.4, moves: { ball: [602, 156], p1: [575, 100], p4: [380, 150] }, bends: { p1: -.15 } },
      { description: 'Spelare 2 passar till 3 och följer efter.', duration: 1.4, moves: { ball: [512, 360], p2: [560, 400], p1: [620, 150] }, bends: { p2: -.15 } },
      { description: 'Spelare 3 passar till 4 och följer efter. Fortsätt runt.', duration: 1.4, moves: { ball: [398, 156], p3: [340, 210], p2: [500, 375] }, bends: { p3: -.15 } },
    ]),
  },
  {
    id: 'starter-blue-wing-cross', level: 'blue',
    create: () => build('Inspel från kant och avslut', 'Kanten driver längs sargen och spelar in snett bakåt till den som kommer i fart mot mål. Kanten följer upp för retur.', 'Kanten har bollen. Centern startar sin löpning.', [
      { key: 'w', kind: 'player', x: 550, y: 80, number: 1 },
      { key: 'ball', kind: 'ball', x: 568, y: 86 },
      { key: 'c', kind: 'player', x: 550, y: 300, number: 2 },
      { key: 'gk', kind: 'goalkeeper', x: 895, y: 250, number: 1, team: 'orange' },
    ], [
      { description: 'Kanten driver längs sargen. Centern löper mot mål.', duration: 1.8, moves: { w: [780, 90], ball: [798, 96], c: [720, 290] }, bends: { c: .1 } },
      { description: 'Inspel snett bakåt till centern.', duration: 1, moves: { ball: [778, 268], c: [760, 262], gk: [893, 225] } },
      { description: 'Centern avslutar direkt. Kanten går mot mål för retur.', duration: 1, moves: { ball: [913, 258], w: [840, 150] } },
    ]),
  },
  {
    id: 'starter-blue-3v2', level: 'blue',
    create: () => build('Kontring 3 mot 2', 'Tre anfallare mot två backar. Mitten driver, kanterna håller bredd. Spela bollen till den som blir fri och avsluta snabbt.', 'Mittspelaren har bollen. Kanterna håller bredd.', [
      { key: 'a1', kind: 'player', x: 450, y: 250, number: 1 },
      { key: 'ball', kind: 'ball', x: 468, y: 256 },
      { key: 'a2', kind: 'player', x: 430, y: 110, number: 2 },
      { key: 'a3', kind: 'player', x: 430, y: 390, number: 3 },
      { key: 'd1', kind: 'player', x: 690, y: 180, number: 4, team: 'orange' },
      { key: 'd2', kind: 'player', x: 690, y: 320, number: 5, team: 'orange' },
      { key: 'gk', kind: 'goalkeeper', x: 895, y: 250, number: 1, team: 'orange' },
    ], [
      { description: 'Mitten driver mot backarna. Kanterna löper med i bredd.', duration: 1.8, moves: { a1: [600, 250], ball: [618, 256], a2: [620, 100], a3: [620, 400], d1: [720, 205], d2: [720, 295] } },
      { description: 'Mitten passar till höger kant när backen kliver mot bollen.', duration: 1.3, moves: { ball: [722, 384], a3: [740, 390], a1: [650, 245], a2: [740, 130], d2: [745, 340] } },
      { description: 'Kanten spelar tvärs till den fria spelaren vid bortre stolpen.', duration: 1.2, moves: { ball: [822, 176], a2: [840, 170], d1: [780, 215], gk: [893, 225] } },
      { description: 'Avslut direkt.', duration: 1, moves: { ball: [915, 238] } },
    ]),
  },
];

/** Bundled starter exercises with fixed IDs so seeding never duplicates them. */
export function starterExercises(now = Date.now()): Exercise[] {
  return starters.map((starter, index) => {
    const exercise = starter.create();
    const stamp = new Date(now - index * 1000).toISOString();
    return { ...exercise, id: starter.id, level: starter.level, createdAt: stamp, updatedAt: stamp };
  });
}
