import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from 'lucide-react';
import type { Exercise } from '../domain/model';
import { Board } from '../components/Board';
import { frameAt, stepTime, totalDuration } from './timeline';

export function Player({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const last = useRef<number | null>(null);
  const total = totalDuration(exercise.steps);
  const frame = frameAt(exercise.steps, elapsed, reduced);

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    if (!playing) { last.current = null; return; }
    let request: number;
    const tick = (now: number) => {
      const previous = last.current;
      if (previous !== null) setElapsed((time) => Math.min(total, time + Math.min(now - previous, 100) / 1000 * speed));
      last.current = now;
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(request); last.current = null; };
  }, [playing, speed, total]);

  useEffect(() => { if (elapsed >= total) setPlaying(false); }, [elapsed, total]);
  function seek(index: number) {
    setPlaying(false);
    setElapsed(stepTime(exercise.steps, index));
  }

  return (
    <div className="player-panel">
      <div className="section-heading">
        <div><p className="eyebrow">VISNINGSLÄGE</p><h2>{exercise.name}</h2></div>
        <button className="button secondary" onClick={onClose}><X size={17} />Till redigering</button>
      </div>
      <Board court={exercise.court} objects={frame.objects} />
      <div className="playback-bar">
        <button className="icon-button" aria-label="Börja om" onClick={() => { setElapsed(0); setPlaying(false); }}><RotateCcw size={20} /></button>
        <button className="icon-button" aria-label="Föregående steg" disabled={frame.index === 0} onClick={() => seek(frame.index - 1)}><ChevronLeft /></button>
        <button className="button primary play-button" disabled={total === 0} onClick={() => { if (elapsed >= total) setElapsed(0); setPlaying(!playing); }}>
          {playing ? <Pause size={20} /> : <Play size={20} />} {playing ? 'Pausa' : 'Spela'}
        </button>
        <button className="icon-button" aria-label="Nästa steg" disabled={frame.index === exercise.steps.length - 1} onClick={() => seek(frame.index + 1)}><ChevronRight /></button>
        <label className="speed-label">Hastighet<select aria-label="Hastighet" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
          <option value=".5">0,5×</option><option value="1">1×</option><option value="1.5">1,5×</option><option value="2">2×</option>
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
