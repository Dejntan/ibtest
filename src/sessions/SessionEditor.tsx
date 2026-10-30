import { useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Download, Expand, Plus, Printer, Share2, Trash2 } from 'lucide-react';
import { clamp, sessionMinutes, uid, type Exercise, type SessionItem, type TrainingSession } from '../domain/model';
import { Board } from '../components/Board';

interface Props {
  session: TrainingSession;
  exercises: Exercise[];
  saveStatus: string;
  onChange: (session: TrainingSession) => void;
  onClose: () => void;
  onPresent: (session: TrainingSession) => void;
  onPrint: (session: TrainingSession) => void;
  onExport: (session: TrainingSession, share: boolean) => void;
  onOpenExercise: (id: string) => void;
}

export function SessionEditor({ session, exercises, saveStatus, onChange, onClose, onPresent, onPrint, onExport, onOpenExercise }: Props) {
  const [adding, setAdding] = useState('');
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));
  const missing = session.items.filter((item) => !byId.has(item.exerciseId)).length;
  const update = (changes: Partial<TrainingSession>) => onChange({ ...session, ...changes });
  const updateItem = (id: string, changes: Partial<SessionItem>) => update({ items: session.items.map((item) => item.id === id ? { ...item, ...changes } : item) });
  const move = (index: number, offset: number) => {
    const items = [...session.items];
    const [item] = items.splice(index, 1);
    items.splice(index + offset, 0, item);
    update({ items });
  };
  let start = 0;

  return <section className="session-editor" aria-labelledby="session-title">
    <div className="editor-topbar">
      <button className="button quiet" onClick={onClose}><ArrowLeft size={18} />Bibliotek</button>
      <span className="save-state" role="status"><span className={saveStatus === 'Sparat på enheten' ? 'status-dot' : 'status-dot pending'} />{saveStatus}</span>
      <div className="editor-actions">
        <button className="icon-button" aria-label="Exportera passet" onClick={() => onExport(session, false)}><Download size={19} /></button>
        <button className="icon-button" aria-label="Skriv ut passet" onClick={() => onPrint(session)}><Printer size={19} /></button>
        <button className="button secondary" onClick={() => onExport(session, true)}><Share2 size={17} />Dela pass</button>
        <button className="button primary" disabled={!session.items.length} onClick={() => onPresent(session)}><Expand size={17} />Visa pass</button>
      </div>
    </div>
    <h1 id="session-title" className="visually-hidden">Träningspass: {session.name}</h1>
    <div className="session-layout">
      <div className="session-details panel">
        <label className="field"><span>Passets namn</span><input value={session.name} maxLength={120} onChange={(event) => update({ name: event.target.value })} /></label>
        <label className="field"><span>Datum</span><input type="date" value={session.date} onChange={(event) => update({ date: event.target.value })} /></label>
        <label className="field"><span>Anteckningar</span><textarea rows={5} maxLength={4000} placeholder="Tema, material, uppdelning av grupper…" value={session.notes} onChange={(event) => update({ notes: event.target.value })} /></label>
        <p className="session-total"><strong>{sessionMinutes(session)} min</strong> · {session.items.length} {session.items.length === 1 ? 'övning' : 'övningar'}</p>
        {missing > 0 && <p className="warning"><AlertTriangle size={16} />{missing} {missing === 1 ? 'övning saknas' : 'övningar saknas'} i biblioteket och hoppas över vid visning.</p>}
      </div>
      <div className="session-items panel">
        <div className="session-add">
          <label className="field"><span>Lägg till övning</span>
            <select aria-label="Lägg till övning" value={adding} onChange={(event) => setAdding(event.target.value)}>
              <option value="">{exercises.length ? 'Välj en övning…' : 'Skapa en övning först'}</option>
              {sorted.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
            </select>
          </label>
          <button className="button secondary" disabled={!adding || session.items.length >= 100} onClick={() => { update({ items: [...session.items, { id: uid(), exerciseId: adding, minutes: 10, note: '' }] }); setAdding(''); }}><Plus size={17} />Lägg till</button>
        </div>
        {!session.items.length ? <p className="hint">Lägg till övningar i den ordning ni ska köra dem. Ange minuter för varje övning så får du ett schema och en nedräkning när du visar passet.</p> :
          <ol className="session-list">{session.items.map((item, index) => {
            const exercise = byId.get(item.exerciseId);
            const from = start;
            start += item.minutes;
            return <li key={item.id} className={exercise ? '' : 'missing'}>
              <span className="session-time">{from}–{start} min</span>
              <button className="session-thumb" disabled={!exercise} aria-label={exercise ? `Öppna övningen ${exercise.name}` : 'Saknad övning'} onClick={() => exercise && onOpenExercise(exercise.id)}>
                {exercise ? <Board court={exercise.court} objects={exercise.steps[0].objects} /> : <AlertTriangle size={22} />}
              </button>
              <div className="session-item-body">
                <strong>{exercise?.name ?? 'Saknad övning'}</strong>
                <div className="session-item-fields">
                  <label className="field compact"><span>Minuter</span><input type="number" min={1} max={180} value={item.minutes} aria-label={`Minuter för ${exercise?.name ?? 'saknad övning'}`} onChange={(event) => updateItem(item.id, { minutes: clamp(Math.round(Number(event.target.value) || 1), 1, 180) })} /></label>
                  <label className="field compact grow"><span>Anteckning</span><input value={item.note} maxLength={500} placeholder="T.ex. 3 grupper, byte var 45 s" aria-label={`Anteckning för ${exercise?.name ?? 'saknad övning'}`} onChange={(event) => updateItem(item.id, { note: event.target.value })} /></label>
                </div>
              </div>
              <div className="session-item-actions">
                <button className="icon-button" aria-label={`Flytta upp ${exercise?.name ?? 'saknad övning'}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
                <button className="icon-button" aria-label={`Flytta ner ${exercise?.name ?? 'saknad övning'}`} disabled={index === session.items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
                <button className="icon-button danger" aria-label={`Ta bort ${exercise?.name ?? 'saknad övning'} från passet`} onClick={() => update({ items: session.items.filter((other) => other.id !== item.id) })}><Trash2 size={16} /></button>
              </div>
            </li>;
          })}</ol>}
      </div>
    </div>
  </section>;
}
