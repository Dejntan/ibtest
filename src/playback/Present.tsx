import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward, Timer, X } from 'lucide-react';
import type { Exercise } from '../domain/model';
import { Board } from '../components/Board';
import { usePlayback } from './usePlayback';

export interface PresentItem { name: string; exercise?: Exercise; minutes?: number; note?: string }

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void>; unlock?: () => void };

/** Must be called directly from a click handler, since browsers require a user gesture for fullscreen. */
export function enterFullscreen(): void {
  const element = document.documentElement;
  if (document.fullscreenElement || !element.requestFullscreen) return;
  element.requestFullscreen({ navigationUI: 'hide' })
    .then(() => (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape'))
    .catch(() => undefined);
}

function exitFullscreen(): void {
  try { (screen.orientation as LockableOrientation | undefined)?.unlock?.(); } catch { /* not supported */ }
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const request = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (disposed) void lock.release();
      } catch { /* the screen may still turn off; playback still works */ }
    };
    void request();
    const visibility = () => { if (document.visibilityState === 'visible') void request(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; document.removeEventListener('visibilitychange', visibility); void lock?.release().catch(() => undefined); };
  }, []);
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function Present({ title, items, onClose }: { title: string; items: PresentItem[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const item = items[index];
  const minutes = item?.minutes;
  const [remaining, setRemaining] = useState((minutes ?? 0) * 60);
  const [timing, setTiming] = useState(false);
  const session = items.length > 1 || minutes !== undefined;
  useWakeLock();

  useEffect(() => { setRemaining((minutes ?? 0) * 60); setTiming(false); }, [index, minutes]);
  useEffect(() => {
    if (!timing) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [timing]);
  useEffect(() => {
    if (timing && remaining === 0) { setTiming(false); navigator.vibrate?.([200, 100, 200]); }
  }, [remaining, timing]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'PageDown') setIndex((value) => Math.min(items.length - 1, value + 1));
      if (event.key === 'PageUp') setIndex((value) => Math.max(0, value - 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  useEffect(() => () => exitFullscreen(), []);

  function close() { exitFullscreen(); onClose(); }

  return (
    <div className="present" role="dialog" aria-modal="true" aria-label={`Visningsläge: ${title}`}>
      <header className="present-header">
        <div className="present-title">
          {session && <span>{title} · övning {index + 1} av {items.length}</span>}
          <strong>{item?.name ?? title}</strong>
        </div>
        {session && item?.minutes !== undefined && <button className={`present-timer ${remaining === 0 ? 'time-up' : ''}`} aria-label={timing ? 'Pausa tid' : 'Starta tid'} onClick={() => setTiming(!timing)}>
          <Timer size={18} />{remaining === 0 ? 'Tiden är ute' : clock(remaining)}
        </button>}
        {items.length > 1 && <div className="present-exercise-nav">
          <button className="present-icon" aria-label="Föregående övning" disabled={index === 0} onClick={() => setIndex(index - 1)}><SkipBack size={20} /></button>
          <button className="present-icon" aria-label="Nästa övning" disabled={index === items.length - 1} onClick={() => setIndex(index + 1)}><SkipForward size={20} /></button>
        </div>}
        <button className="present-icon" aria-label="Stäng visningsläge" onClick={close}><X size={24} /></button>
      </header>
      {item?.exercise ? <PresentExercise key={`${index}-${item.exercise.id}`} exercise={item.exercise} note={item.note} />
        : <div className="present-missing"><p>{item ? 'Övningen finns inte längre i biblioteket.' : 'Passet innehåller inga övningar.'}</p></div>}
      <p className="rotate-hint">Vrid telefonen för en större plan.</p>
    </div>
  );
}

function PresentExercise({ exercise, note }: { exercise: Exercise; note?: string }) {
  const { playing, speed, setSpeed, loop, setLoop, total, frame, trails, seek, toggle, restart } = usePlayback(exercise.steps);
  const gesture = useRef<{ x: number; y: number; id: number } | null>(null);
  const last = exercise.steps.length - 1;

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLSelectElement) return;
      if (event.key === ' ') { event.preventDefault(); toggle(); }
      if (event.key === 'ArrowRight') seek(frame.index + 1);
      if (event.key === 'ArrowLeft') seek(frame.index - 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  function down(event: PointerEvent<HTMLDivElement>) { gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; }
  function up(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) seek(frame.index + (dx < 0 ? 1 : -1));
    else if (Math.hypot(dx, dy) < 12) toggle();
  }

  return <>
    <div className="present-board" onPointerDown={down} onPointerUp={up} onPointerCancel={() => { gesture.current = null; }} aria-label="Tryck för att spela eller pausa. Svep för att byta steg.">
      <Board court={exercise.court} objects={frame.objects} trails={exercise.showTrails ? trails : []} />
    </div>
    <div className="present-caption" aria-live="polite">
      <span className="step-badge">{frame.index + 1}</span>
      <p><strong>Steg {frame.index + 1} av {exercise.steps.length}.</strong> {exercise.steps[frame.index].description || exercise.description}{note ? ` · ${note}` : ''}</p>
    </div>
    <div className="present-controls">
      <button className="present-icon" aria-label="Börja om" onClick={restart}><RotateCcw size={22} /></button>
      <button className="present-icon" aria-label="Föregående steg" disabled={frame.index === 0} onClick={() => seek(frame.index - 1)}><ChevronLeft size={28} /></button>
      <button className="present-play" disabled={total === 0} onClick={toggle}>{playing ? <Pause size={26} /> : <Play size={26} />}{playing ? 'Pausa' : 'Spela'}</button>
      <button className="present-icon" aria-label="Nästa steg" disabled={frame.index === last} onClick={() => seek(frame.index + 1)}><ChevronRight size={28} /></button>
      <button className="present-icon" aria-label="Upprepa" aria-pressed={loop} onClick={() => setLoop(!loop)}><Repeat size={22} /></button>
      <select aria-label="Hastighet" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
        <option value=".25">0,25×</option><option value=".5">0,5×</option><option value="1">1×</option><option value="1.5">1,5×</option><option value="2">2×</option>
      </select>
    </div>
  </>;
}
