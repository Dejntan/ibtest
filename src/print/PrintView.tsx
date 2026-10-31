import { ArrowLeft, Printer } from 'lucide-react';
import { Board } from '../components/Board';
import { levelLabels, sessionMinutes, type Exercise, type TrainingSession } from '../domain/model';
import { totalDuration, trailsFor } from '../playback/timeline';

export type PrintTarget = { kind: 'exercise'; exercise: Exercise } | { kind: 'session'; session: TrainingSession };

const dateFormat = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function ExerciseSheet({ exercise, heading }: { exercise: Exercise; heading?: string }) {
  const seconds = totalDuration(exercise.steps);
  return <section className="print-exercise">
    {heading && <p className="eyebrow">{heading}</p>}
    <h2>{exercise.name}</h2>
    <p className="print-meta">{exercise.level !== 'none' ? `${levelLabels[exercise.level]} · ` : ''}{exercise.court === 'full' ? 'Helplan' : 'Halvplan'} · {exercise.steps.length} steg{seconds ? ` · ${seconds.toLocaleString('sv-SE')} s animation` : ''}</p>
    {exercise.description && <p className="print-description">{exercise.description}</p>}
    <div className="print-steps">
      {exercise.steps.map((step, index) => <figure key={step.id} className="print-step">
        <Board court={exercise.court} objects={step.objects} trails={exercise.showTrails ? trailsFor(exercise.steps, index) : []} />
        <figcaption><strong>Steg {index + 1}</strong> {step.description}</figcaption>
      </figure>)}
    </div>
  </section>;
}

export function PrintView({ target, exercises, onClose }: { target: PrintTarget; exercises: Exercise[]; onClose: () => void }) {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  let start = 0;
  return <div className="print-view">
    <div className="print-toolbar no-print">
      <button className="button quiet" onClick={onClose}><ArrowLeft size={18} />Tillbaka</button>
      <p className="hint">Välj <strong>Spara som PDF</strong> som skrivare för att få en PDF-fil.</p>
      <button className="button primary" onClick={() => window.print()}><Printer size={17} />Skriv ut / spara PDF</button>
    </div>
    {target.kind === 'exercise' ? <ExerciseSheet exercise={target.exercise} /> : <>
      <section className="print-session">
        <p className="eyebrow">TRÄNINGSPASS</p>
        <h1>{target.session.name}</h1>
        <p className="print-meta">{target.session.date ? dateFormat.format(new Date(`${target.session.date}T12:00:00`)) : 'Inget datum'} · {target.session.items.length} {target.session.items.length === 1 ? 'övning' : 'övningar'} · {sessionMinutes(target.session)} min</p>
        {target.session.notes && <p className="print-description">{target.session.notes}</p>}
        <table className="print-schedule">
          <thead><tr><th>Tid</th><th>Övning</th><th>Min</th><th>Anteckning</th></tr></thead>
          <tbody>{target.session.items.map((item) => {
            const from = start;
            start += item.minutes;
            return <tr key={item.id}><td>{from}–{start}</td><td>{byId.get(item.exerciseId)?.name ?? 'Saknad övning'}</td><td>{item.minutes}</td><td>{item.note}</td></tr>;
          })}</tbody>
        </table>
      </section>
      {target.session.items.map((item, index) => {
        const exercise = byId.get(item.exerciseId);
        return exercise ? <ExerciseSheet key={item.id} exercise={exercise} heading={`ÖVNING ${index + 1} · ${item.minutes} MIN${item.note ? ` · ${item.note.toUpperCase()}` : ''}`} /> : null;
      })}
    </>}
  </div>;
}
