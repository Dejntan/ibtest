import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Circle, Copy, Flag, Goal, MousePointer2, Play, Plus, Redo2, Share2, Trash2, Triangle, Type, Undo2, Download } from 'lucide-react';
import { Board, boardPoint, kindLabels } from '../components/Board';
import { commit, initialHistory, redo, undo } from '../domain/history';
import { clamp, copyStep, courtWidth, moveObject, nearestObject, newObject, resizeCourt, type BoardObject, type Exercise, type ObjectKind, type Step } from '../domain/model';
import { Player } from '../playback/Player';

interface Props {
  initial: Exercise;
  saveStatus: string;
  onChange: (exercise: Exercise) => void;
  onClose: () => void;
  onExport: (exercise: Exercise, share: boolean) => void;
}
type Tool = 'select' | ObjectKind;
interface Drag {
  pointer: number;
  start: { x: number; y: number };
  original: BoardObject;
  endpoint?: string;
}
const tools = [
  { kind: 'select', label: 'Välj / flytta', icon: MousePointer2 },
  { kind: 'player', label: 'Spelare', icon: Circle },
  { kind: 'ball', label: 'Boll', icon: Circle },
  { kind: 'cone', label: 'Kon', icon: Triangle },
  { kind: 'goal', label: 'Mål', icon: Goal },
  { kind: 'arrow', label: 'Pil', icon: ArrowUpRight },
  { kind: 'text', label: 'Text', icon: Type },
] satisfies { kind: Tool; label: string; icon: typeof Circle }[];

export function Editor({ initial, saveStatus, onChange, onClose, onExport }: Props) {
  const [history, setHistory] = useState(() => initialHistory(initial));
  const exercise = history.present;
  const [stepId, setStepId] = useState(exercise.steps[0].id);
  const stepIndex = Math.max(0, exercise.steps.findIndex((step) => step.id === stepId));
  const step = exercise.steps[stepIndex];
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [preview, setPreview] = useState<BoardObject | null>(null);
  const [playing, setPlaying] = useState(false);
  const drag = useRef<Drag | null>(null);
  const previewRef = useRef<BoardObject | null>(null);
  const width = courtWidth(exercise.court);
  const object = step.objects.find((item) => item.id === selected);
  const objects = preview ? step.objects.map((item) => item.id === preview.id ? preview : item) : step.objects;

  useEffect(() => { onChange(exercise); }, [exercise, onChange]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (saveStatus !== 'Sparat på enheten') { event.preventDefault(); }
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [saveStatus]);

  function edit(next: Exercise) { setHistory((state) => commit(state, next)); }
  function editStep(patch: Partial<Step>) {
    edit({ ...exercise, steps: exercise.steps.map((item) => item.id === step.id ? { ...item, ...patch } : item) });
  }
  function editObject(patch: Partial<BoardObject>) {
    if (!object) return;
    editStep({ objects: step.objects.map((item) => item.id === object.id ? { ...item, ...patch } : item) });
  }
  function removeObject() {
    if (!object) return;
    editStep({ objects: step.objects.filter((item) => item.id !== object.id) });
    setSelected(null);
  }
  function selectStep(id: string) { setStepId(id); setSelected(null); }
  function addStep() {
    const next = copyStep(step);
    edit({ ...exercise, steps: [...exercise.steps.slice(0, stepIndex + 1), next, ...exercise.steps.slice(stepIndex + 1)] });
    selectStep(next.id);
  }
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || drag.current) return;
    const point = boardPoint(event);
    const element = event.target instanceof Element ? event.target.closest('[data-object-id]') : null;
    const matrix = event.currentTarget.getScreenCTM();
    const tolerance = matrix ? 22 / Math.hypot(matrix.a, matrix.b) : 22;
    const id = element?.getAttribute('data-object-id') ?? nearestObject(step.objects, point, tolerance)?.id;
    if (tool !== 'select') {
      if (step.objects.length >= 200) return;
      const number = Math.min(99, 1 + step.objects.filter((item) => item.kind === 'player').length);
      const item = newObject(tool, clamp(point.x, 22, width - 22), clamp(point.y, 22, 478), width, number);
      editStep({ objects: [...step.objects, item] });
      setSelected(item.id);
      setTool('select');
      return;
    }
    setSelected(id || null);
    const original = step.objects.find((item) => item.id === id);
    if (!original) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    let endpoint = event.target instanceof Element ? event.target.getAttribute('data-endpoint') ?? undefined : undefined;
    if (!endpoint && selected === id && original.kind === 'arrow') {
      const start = Math.hypot(point.x - original.x, point.y - original.y);
      const end = Math.hypot(point.x - original.x2, point.y - original.y2);
      if (Math.min(start, end) <= tolerance) endpoint = start <= end ? 'start' : 'end';
    }
    drag.current = { pointer: event.pointerId, start: point, original, endpoint };
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const point = boardPoint(event);
    let next: BoardObject;
    if (current.endpoint) {
      next = {
        ...current.original,
        ...(current.endpoint === 'start'
          ? { x: clamp(point.x, 0, width), y: clamp(point.y, 0, 500) }
          : { x2: clamp(point.x, 0, width), y2: clamp(point.y, 0, 500) }),
      };
    } else {
      next = moveObject(current.original, point.x - current.start.x, point.y - current.start.y, width);
    }
    previewRef.current = next;
    setPreview(next);
  }
  function cancelDrag() { drag.current = null; previewRef.current = null; setPreview(null); }
  function pointerUp(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    const next = previewRef.current;
    if (next) editStep({ objects: step.objects.map((item) => item.id === next.id ? next : item) });
    cancelDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (!object) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeObject(); return; }
    const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = delta[event.key];
    if (direction) {
      event.preventDefault();
      const amount = event.shiftKey ? 20 : 5;
      editObject(moveObject(object, direction[0] * amount, direction[1] * amount, width));
    }
  }
  const undoAction = () => { setHistory(undo); setSelected(null); };
  const redoAction = () => { setHistory(redo); setSelected(null); };

  if (playing) return <Player exercise={exercise} onClose={() => setPlaying(false)} />;

  return (
    <div className="editor">
      <div className="editor-topbar">
        <button className="button quiet" onClick={onClose}><ArrowLeft size={18} />Bibliotek</button>
        <span className="save-state" role="status"><span className={saveStatus === 'Sparat på enheten' ? 'status-dot' : 'status-dot pending'} />{saveStatus}</span>
        <div className="editor-actions">
          <button className="icon-button" aria-label="Exportera fil" onClick={() => onExport(exercise, false)}><Download size={19} /></button>
          <button className="button secondary" onClick={() => onExport(exercise, true)}><Share2 size={17} />Dela</button>
          <button className="button primary" onClick={() => setPlaying(true)}><Play size={17} />Spela upp</button>
        </div>
      </div>
      <div className="editor-title">
        <p className="eyebrow">DIN TAKTIKTAVLA</p>
        <input className="name-input" aria-label="Övningens namn" maxLength={120} value={exercise.name} onChange={(event) => edit({ ...exercise, name: event.target.value })} onBlur={() => { if (!exercise.name.trim()) edit({ ...exercise, name: 'Namnlös övning' }); }} />
        <input className="description-input" aria-label="Övningens beskrivning" placeholder="Vad vill du att laget ska träna på?" maxLength={4000} value={exercise.description} onChange={(event) => edit({ ...exercise, description: event.target.value })} />
      </div>
      <div className="workspace">
        <div className="canvas-column">
          <div className="canvas-header">
            <div className="segmented" aria-label="Planstorlek">
              <button className={exercise.court === 'full' ? 'active' : ''} onClick={() => edit(resizeCourt(exercise, 'full'))}>Helplan</button>
              <button className={exercise.court === 'half' ? 'active' : ''} onClick={() => edit(resizeCourt(exercise, 'half'))}>Halvplan</button>
            </div>
            <div className="history-buttons">
              <button className="icon-button" aria-label="Ångra" disabled={!history.past.length} onClick={undoAction}><Undo2 size={19} /></button>
              <button className="icon-button" aria-label="Gör om" disabled={!history.future.length} onClick={redoAction}><Redo2 size={19} /></button>
            </div>
          </div>
          <div className="canvas-surface">
            <Board court={exercise.court} objects={objects} selected={selected} interactive onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onKeyDown={keyboard} />
          </div>
          <div className="drawing-toolbar" role="toolbar" aria-label="Ritverktyg">
            {tools.map(({ kind, label, icon: Icon }) => (
              <button key={kind} aria-label={label} aria-pressed={tool === kind} disabled={kind !== 'select' && step.objects.length >= 200} className={`tool-button ${tool === kind ? 'active' : ''} ${kind === 'ball' ? 'ball-tool' : ''}`} onClick={() => setTool(kind)}>
                <Icon size={20} /><span>{kind === 'select' ? 'Flytta' : label}</span>
              </button>
            ))}
          </div>
          <p className="canvas-hint">{step.objects.length >= 200 ? 'Steget har nått gränsen på 200 objekt. Ta bort ett objekt för att lägga till fler.' : tool === 'select' ? 'Dra objekt för att flytta dem. Markera en pil för att dra dess ändpunkter.' : `Tryck på planen för att placera: ${kindLabels[tool].toLowerCase()}.`}</p>
        </div>
        <aside className="inspector">
          <div className="inspector-heading"><Flag size={17} /><h3>Steg {stepIndex + 1}</h3><span>{exercise.steps.length} totalt</span></div>
          <label>Vad händer i steget?<textarea value={step.description} maxLength={2000} placeholder="T.ex. spelare 1 passar till spelare 2 och löper mot mål." onChange={(event) => editStep({ description: event.target.value })} /></label>
          <label>Tid till nästa steg
            <div className="input-suffix"><input aria-label="Steglängd i sekunder" type="number" min=".5" max="60" step=".5" value={step.duration} onChange={(event) => { const n = event.target.valueAsNumber; if (Number.isFinite(n)) editStep({ duration: clamp(n, .5, 60) }); }} /><span>sekunder</span></div>
          </label>
          <p className="hint">Kopiera steget och flytta spelare och boll. Rörelsen mellan stegen blir animationen. Pilar är bara förklaringar.</p>
          <div className="inspector-divider" />
          <label>Markerat objekt
            <select aria-label="Markerat objekt" value={object?.id ?? ''} onChange={(event) => setSelected(event.target.value || null)}>
              <option value="">Välj på planen eller i listan</option>
              {step.objects.map((item, index) => <option key={item.id} value={item.id}>{kindLabels[item.kind]} {item.kind === 'player' ? `${item.number} · ${item.team === 'green' ? 'grön' : 'orange'}` : index + 1}</option>)}
            </select>
          </label>
          {object ? <div className="object-properties">
            {object.kind === 'player' && <div className="property-row">
              <label>Nummer<input aria-label="Spelarnummer" type="number" min="1" max="99" value={object.number} onChange={(event) => { const n = event.target.valueAsNumber; if (Number.isFinite(n)) editObject({ number: clamp(Math.round(n), 1, 99) }); }} /></label>
              <label>Lag<select aria-label="Lag" value={object.team} onChange={(event) => editObject({ team: event.target.value === 'orange' ? 'orange' : 'green' })}><option value="green">Grönt</option><option value="orange">Orange</option></select></label>
            </div>}
            {object.kind === 'text' && <label>Text<input aria-label="Text på planen" maxLength={80} value={object.text} onChange={(event) => editObject({ text: event.target.value })} /></label>}
            <div className="property-row">
              <label>X<input aria-label="Position X" type="number" min="0" max={width} value={Math.round(object.x)} onChange={(event) => { const x = event.target.valueAsNumber; if (Number.isFinite(x)) editObject(moveObject(object, clamp(x, 0, width) - object.x, 0, width)); }} /></label>
              <label>Y<input aria-label="Position Y" type="number" min="0" max="500" value={Math.round(object.y)} onChange={(event) => { const y = event.target.valueAsNumber; if (Number.isFinite(y)) editObject(moveObject(object, 0, clamp(y, 0, 500) - object.y, width)); }} /></label>
            </div>
            {object.kind === 'arrow' && <div className="property-row">
              <label>Slut X<input aria-label="Pilens slut X" type="number" min="0" max={width} value={Math.round(object.x2)} onChange={(event) => { const x = event.target.valueAsNumber; if (Number.isFinite(x)) editObject({ x2: clamp(x, 0, width) }); }} /></label>
              <label>Slut Y<input aria-label="Pilens slut Y" type="number" min="0" max="500" value={Math.round(object.y2)} onChange={(event) => { const y = event.target.valueAsNumber; if (Number.isFinite(y)) editObject({ y2: clamp(y, 0, 500) }); }} /></label>
            </div>}
            <button className="button danger quiet" onClick={removeObject}><Trash2 size={16} />Ta bort objekt</button>
          </div> : <div className="empty-selection"><MousePointer2 size={24} /><p>Välj ett objekt för att ändra dess egenskaper.</p></div>}
        </aside>
      </div>
      <section className="steps-section" aria-label="Övningens steg">
        <div className="section-heading compact"><div><h3>Övningens steg</h3><p>En position i taget. Ett tydligt flöde.</p></div>
          <button className="button secondary" disabled={exercise.steps.length >= 100} onClick={addStep}><Copy size={16} />Kopiera till nästa steg</button>
        </div>
        <div className="steps-strip">
          {exercise.steps.map((item, index) => <button key={item.id} className={`step-card ${index === stepIndex ? 'selected' : ''}`} onClick={() => selectStep(item.id)} aria-label={`Visa steg ${index + 1}`} aria-pressed={index === stepIndex}>
            <div className="step-card-top"><span>STEG {String(index + 1).padStart(2, '0')}</span><span>{index < exercise.steps.length - 1 ? `${item.duration} s` : 'Slut'}</span></div>
            <Board court={exercise.court} objects={item.objects} />
            <p>{item.description || (index === 0 ? 'Startposition' : 'Nästa position')}</p>
          </button>)}
          <button className="add-step-card" aria-label="Lägg till steg" disabled={exercise.steps.length >= 100} onClick={addStep}><Plus size={24} /><span>Nytt steg</span></button>
        </div>
        <div className="steps-footer">
          <span>{exercise.steps.length === 100 ? 'Maximalt 100 steg per övning.' : 'Tips: fler steg gör det enkelt att visa riktningsändringar.'}</span>
          <button className="button quiet danger" disabled={exercise.steps.length === 1} onClick={() => {
            if (!window.confirm(`Ta bort steg ${stepIndex + 1}? Du kan ångra ändringen.`)) return;
            edit({ ...exercise, steps: exercise.steps.filter((item) => item.id !== step.id) });
            selectStep(exercise.steps[Math.max(0, stepIndex - 1)].id);
          }}><Trash2 size={15} />Ta bort steg</button>
        </div>
      </section>
    </div>
  );
}
