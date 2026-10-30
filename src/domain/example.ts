import { copyStep, newExercise, newObject } from './model';

export function exampleExercise() {
  const exercise = newExercise();
  exercise.name = 'Passa, löp, avsluta';
  exercise.description = 'Träna passning i rörelse och avslut. Spelare 1 passar till 2, löper mot mål och får tillbaka bollen inför avslutet.';
  const player1 = newObject('player', 340, 320, 1000, 1);
  const player2 = { ...newObject('player', 650, 155, 1000, 2), team: 'orange' as const };
  const ball = newObject('ball', 370, 310, 1000);
  const cone = newObject('cone', 700, 330, 1000);
  const arrow = { ...newObject('arrow', 390, 285, 1000), x2: 610, y2: 175 };
  exercise.steps[0] = { ...exercise.steps[0], description: 'Spelare 1 passar bollen till spelare 2.', objects: [arrow, cone, player1, player2, ball] };
  const second = copyStep(exercise.steps[0]);
  second.description = 'Spelare 1 löper mot mål. Spelare 2 spelar tillbaka bollen.';
  second.objects = second.objects.map((object) => {
    if (object.id === ball.id) return { ...object, x: 625, y: 170 };
    if (object.id === player1.id) return { ...object, x: 750, y: 280 };
    if (object.id === arrow.id) return { ...object, x: 665, y: 180, x2: 800, y2: 250 };
    return object;
  });
  const third = copyStep(second);
  third.description = 'Spelare 1 tar emot bollen och gör sig redo för avslut.';
  third.objects = third.objects.map((object) => {
    if (object.id === player1.id) return { ...object, x: 800, y: 250 };
    if (object.id === ball.id) return { ...object, x: 825, y: 250 };
    if (object.id === arrow.id) return { ...object, x: 840, y: 250, x2: 905, y2: 250 };
    return object;
  });
  const fourth = copyStep(third);
  fourth.description = 'Avslut! Byt sedan roller och börja om.';
  fourth.objects = fourth.objects.map((object) => object.id === ball.id ? { ...object, x: 925, y: 250 } : object);
  exercise.steps.push(second, third, fourth);
  return exercise;
}
