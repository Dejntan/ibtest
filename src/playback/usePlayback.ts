import { useEffect, useRef, useState } from 'react';
import type { Step } from '../domain/model';
import { frameAt, stepTime, totalDuration, trailsFor } from './timeline';

export function usePlayback(steps: Step[]) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const last = useRef<number | null>(null);
  const total = totalDuration(steps);
  const frame = frameAt(steps, elapsed, reduced);
  const trails = trailsFor(steps, frame.index);

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

  useEffect(() => {
    if (!playing || elapsed < total) return;
    if (!loop || total === 0) { setPlaying(false); return; }
    const timer = setTimeout(() => setElapsed(0), 900);
    return () => clearTimeout(timer);
  }, [elapsed, total, loop, playing]);

  function seek(index: number) {
    setPlaying(false);
    setElapsed(stepTime(steps, Math.max(0, Math.min(steps.length - 1, index))));
  }
  function toggle() {
    if (total === 0) return;
    if (elapsed >= total) setElapsed(0);
    setPlaying(!playing);
  }
  function restart() { setElapsed(0); setPlaying(false); }
  function reset() { setElapsed(0); setPlaying(false); }

  return { elapsed, setElapsed, playing, setPlaying, speed, setSpeed, loop, setLoop, reduced, total, frame, trails, seek, toggle, restart, reset };
}
