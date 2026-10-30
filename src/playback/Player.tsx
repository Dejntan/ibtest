import { ChevronLeft, ChevronRight, Expand, Pause, Play, RotateCcw, X } from 'lucide-react';
import type { Exercise } from '../domain/model';
import { Board } from '../components/Board';
import { usePlayback } from './usePlayback';

export function Player({ exercise, onClose, onPresent }: { exercise: Exercise; onClose: () => void; onPresent: () => void }) {
  const { elapsed, setElapsed, playing, setPlaying, speed, setSpeed, reduced, total, frame, trails, seek, toggle, restart } = usePlayback(exercise.steps);

  return (
    <div className="player-panel">
      <div className="section-heading">
        <div><p className="eyebrow">UPPSPELNING</p><h2>{exercise.name}</h2></div>
        <div className="player-heading-actions">
          <button className="button secondary" onClick={onPresent}><Expand size={17} />Helskärm</button>
          <button className="button secondary" onClick={onClose}><X size={17} />Till redigering</button>
        </div>
      </div>
      <Board court={exercise.court} objects={frame.objects} trails={exercise.showTrails ? trails : []} />
      <div className="playback-bar">
        <button className="icon-button" aria-label="Börja om" onClick={restart}><RotateCcw size={20} /></button>
        <button className="icon-button" aria-label="Föregående steg" disabled={frame.index === 0} onClick={() => seek(frame.index - 1)}><ChevronLeft /></button>
        <button className="button primary play-button" disabled={total === 0} onClick={toggle}>
          {playing ? <Pause size={20} /> : <Play size={20} />} {playing ? 'Pausa' : 'Spela'}
        </button>
        <button className="icon-button" aria-label="Nästa steg" disabled={frame.index === exercise.steps.length - 1} onClick={() => seek(frame.index + 1)}><ChevronRight /></button>
        <label className="speed-label">Hastighet<select aria-label="Hastighet" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
          <option value=".25">0,25×</option><option value=".5">0,5×</option><option value="1">1×</option><option value="1.5">1,5×</option><option value="2">2×</option>
        </select></label>
      </div>
      <label className="timeline-label">Tidslinje · {elapsed.toFixed(1)} / {total.toFixed(1)} s
        <input aria-label="Tidslinje" type="range" min="0" max={total || 1} step=".01" value={elapsed} disabled={total === 0} onChange={(event) => { setPlaying(false); setElapsed(Number(event.target.value)); }} />
      </label>
      <div className="playback-caption" aria-live="polite">
        <span className="step-badge">{frame.index + 1}</span>
        <div><strong>Steg {frame.index + 1} av {exercise.steps.length}</strong><p>{exercise.steps[frame.index].description || 'Ingen stegbeskrivning.'}</p></div>
      </div>
      {total === 0 && <p className="hint">Lägg till ett andra steg för att animera övningen.</p>}
      {reduced && <p className="hint">Reducerad rörelse är aktiverad. Uppspelningen visar stegen utan förflyttningsanimation.</p>}
      {exercise.description && <p className="exercise-description">{exercise.description}</p>}
    </div>
  );
}
