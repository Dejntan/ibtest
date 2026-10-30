import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Circle, Copy, Download, Flag, Goal, Image, MousePointer2, Play, Plus, Printer, Redo2, Share2, Shield, Square, Trash2, Triangle, Type, Undo2 } from 'lucide-react';
import { Board, boardPoint, kindLabels } from '../components/Board';
import { ImageExport } from '../components/ImageExport';
import { commit, initialHistory, redo, undo } from '../domain/history';
import { bendFromPoint } from '../domain/geometry';
import {
  clamp, coneTemplate, coneTemplateLabels, copyStep, courtWidth, isTwoPoint, lineStyleLabels, lineStyles, moveObject, moveStyleLabels, nearestObject, newObject,
  resizeCourt, teamColors, teams, type BoardObject, type ConeTemplate, type Exercise, type LineStyle, type MoveStyle, type ObjectKind, type Step, type Team,
} from '../domain/model';
import { Player } from '../playback/Player';
import { trailStyle, trailsFor, type Trail } from '../playback/timeline';

interface Props {
  initial: Exercise;
  saveStatus: string;
  onChange: (exercise: Exercise) => void;
  onClose: () => void;
  onExport: (exercise: Exercise, share: boolean) => void;
  onPresent: (exercise: Exercise) => void;
  onPrint: (exercise: Exercise) => void;
}
type Tool = 'select' | ObjectKind | `cones-${ConeTemplate}`;
interface Drag {
  pointer: number;
  start: { x: number; y: number };
  original: BoardObject;
  mode: 'move' | 'start' | 'end' | 'bend-arrow' | 'bend-move';
}
const tools = [
  { kind: 'select', label: 'Välj / flytta', short: 'Flytta', icon: MousePointer2 },
  { kind: 'player', label: 'Spelare', short: 'Spelare', icon: Circle },
  { kind: 'goalkeeper', label: 'Målvakt', short: 'Målvakt', icon: Shield },
  { kind: 'ball', label: 'Boll', short: 'Boll', icon: Circle },
  { kind: 'cone', label: 'Kon', short: 'Kon', icon: Triangle },
  { kind: 'goal', label: 'Mål', short: 'Mål', icon: Goal },
  { kind: 'zone', label: 'Zon', short: 'Zon', icon: Square },
  { kind: 'arrow', label: 'Pil', short: 'Pil', icon: ArrowUpRight },
  { kind: 'text', label: 'Text', short: 'Text', icon: Type },
] satisfies { kind: Tool; label: string; short: string; icon: typeof Circle }[];
const coneTemplates = Object.keys(coneTemplateLabels) as ConeTemplate[];
export const trailLabels: Record<Trail['style'], string> = { run: 'löpning', dribble: 'dribbling', pass: 'passning', shot: 'skott', line: 'linje', none: 'dold' };
const toolLabel = (tool: Tool) => tool.startsWith('cones-') ? coneTemplateLabels[tool.slice(6) as ConeTemplate].toLowerCase() : kindLabels[tool as ObjectKind].toLowerCase();
const numbered = (kind: ObjectKind) => kind === 'player' || kind === 'goalkeeper';

export function Editor({ initial, saveStatus, onChange, onClose, onExport, onPresent, onPrint }: Props) {
  const [history, setHistory] = useState(() => initialHistory(initial));
  const exercise = history.present;
  const [stepId, setStepId] = useState(exercise.steps[0].id);
  const stepIndex = Math.max(0, exercise.steps.findIndex((step) => step.id === stepId));
  const step = exercise.steps[stepIndex];
  const nextStep = exercise.steps[stepIndex + 1];
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [preview, setPreview] = useState<BoardObject | null>(null);
  const [playing, setPlaying] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const drag = useRef<Drag | null>(null);
  const previewRef = useRef<BoardObject | null>(null);
  const width = courtWidth(exercise.court);
  const object = step.objects.find((item) => item.id === selected);
  const objects = preview ? step.objects.map((item) => item.id === preview.id ? preview : item) : step.objects;
  const trails = trailsFor(exercise.steps.map((item) => item.id === step.id ? { ...item, objects } : item), stepIndex);
  const trail = object && trails.find((item) => item.id === object.id);
  const full = step.objects.length >= 200;

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
  function place(point: { x: number; y: number }) {
    const x = clamp(point.x, 22, width - 22);
    const y = clamp(point.y, 22, 478);
    if (tool.startsWith('cones-')) {
      const cones = coneTemplate(tool.slice(6) as ConeTemplate, x, y, width);
      if (step.objects.length + cones.length > 200) return;
      editStep({ objects: [...step.objects, ...cones] });
      setSelected(null);
    } else {
      const kind = tool as ObjectKind;
      if (full) return;
      const number = kind === 'goalkeeper' ? 1 : Math.min(99, 1 + step.objects.filter((item) => item.kind === 'player').length);
      const item = newObject(kind, x, y, width, number);
      editStep({ objects: [...step.objects, item] });
      setSelected(item.id);
    }
    setTool('select');
  }
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || drag.current) return;
    const point = boardPoint(event);
    const target = event.target instanceof Element ? event.target : null;
    if (tool !== 'select') { place(point); return; }
    const matrix = event.currentTarget.getScreenCTM();
    const tolerance = matrix ? 22 / Math.hypot(matrix.a, matrix.b) : 22;
    const handle = target?.getAttribute('data-bend') ?? target?.getAttribute('data-endpoint');
    let mode: Drag['mode'] = 'move';
    let original: BoardObject | undefined;
    if (handle && object) {
      original = object;
      mode = handle === 'arrow' ? 'bend-arrow' : handle === 'move' ? 'bend-move' : handle === 'start' ? 'start' : 'end';
    } else {
      const id = target?.closest('[data-object-id]')?.getAttribute('data-object-id') ?? nearestObject(step.objects, point, tolerance)?.id;
      setSelected(id || null);
      original = step.objects.find((item) => item.id === id);
      if (original && selected === original.id && isTwoPoint(original.kind)) {
        const start = Math.hypot(point.x - original.x, point.y - original.y);
        const end = Math.hypot(point.x - original.x2, point.y - original.y2);
        if (Math.min(start, end) <= tolerance) mode = start <= end ? 'start' : 'end';
      }
    }
    if (!original) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, start: point, original, mode };
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const point = boardPoint(event);
    const { original, mode } = current;
    const bounded = { x: clamp(point.x, 0, width), y: clamp(point.y, 0, 500) };
    let next: BoardObject;
    if (mode === 'start') next = { ...original, ...bounded };
    else if (mode === 'end') next = { ...original, x2: bounded.x, y2: bounded.y };
    else if (mode === 'bend-arrow') next = { ...original, bend: bendFromPoint(original, { x: original.x2, y: original.y2 }, point) };
    else if (mode === 'bend-move') {
      const target = nextStep?.objects.find((item) => item.id === original.id);
      if (!target) return;
      next = { ...original, moveBend: bendFromPoint(original, target, point) };
    } else next = moveObject(original, point.x - current.start.x, point.y - current.start.y, width);
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
  function doubleClick(event: MouseEvent<SVGSVGElement>) {
    const handle = event.target instanceof Element ? event.target.getAttribute('data-bend') : null;
    if (handle === 'arrow') editObject({ bend: 0 });
    if (handle === 'move') editObject({ moveBend: 0 });
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
  const autoStyle = object && nextStep ? trailStyle({ ...object, moveStyle: 'auto' }, step, nextStep) : 'none';
  const number = (value: number, apply: (value: number) => void) => { if (Number.isFinite(value)) apply(value); };

  if (playing) return <Player exercise={exercise} onClose={() => setPlaying(false)} onPresent={() => onPresent(exercise)} />;

  return (
    <div className="editor">
      <div className="editor-topbar">
        <button className="button quiet" onClick={onClose}><ArrowLeft size={18} />Bibliotek</button>
        <span className="save-state" role="status"><span className={saveStatus === 'Sparat på enheten' ? 'status-dot' : 'status-dot pending'} />{saveStatus}</span>
        <div className="editor-actions">
          <button className="icon-button" aria-label="Exportera fil" onClick={() => onExport(exercise, false)}><Download size={19} /></button>
          <button className="icon-button" aria-label="Spara bild" onClick={() => setImageOpen(true)}><Image size={19} /></button>
          <button className="icon-button" aria-label="Skriv ut" onClick={() => onPrint(exercise)}><Printer size={19} /></button>
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
            <Board court={exercise.court} objects={objects} trails={trails} trailMode="edit" selected={selected} interactive onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onKeyDown={keyboard} onDoubleClick={doubleClick} />
          </div>
          <div className="drawing-toolbar" role="toolbar" aria-label="Ritverktyg">
            {tools.map(({ kind, label, short, icon: Icon }) => (
              <button key={kind} aria-label={label} aria-pressed={tool === kind} disabled={kind !== 'select' && full} className={`tool-button ${tool === kind ? 'active' : ''} ${kind === 'ball' ? 'ball-tool' : ''}`} onClick={() => setTool(kind)}>
                <Icon size={20} /><span>{short}</span>
              </button>
            ))}
          </div>
          <div className="template-toolbar" role="toolbar" aria-label="Konmallar">
            <span>Konmallar</span>
            {coneTemplates.map((template) => {
              const kind = `cones-${template}` as const;
              return <button key={template} aria-label={`Konmall ${coneTemplateLabels[template]}`} aria-pressed={tool === kind} disabled={step.objects.length + coneTemplate(template, 500, 250, width).length > 200} className={`chip-button ${tool === kind ? 'active' : ''}`} onClick={() => setTool(kind)}>{coneTemplateLabels[template]}</button>;
            })}
          </div>
          <p className="canvas-hint">{full ? 'Steget har nått gränsen på 200 objekt. Ta bort ett objekt för att lägga till fler.' : tool === 'select' ? 'Dra objekt för att flytta dem. Markera en spelare eller boll och dra i spårets runda handtag för att böja rörelsen.' : `Tryck på planen för att placera: ${toolLabel(tool)}.`}</p>
        </div>
        <aside className="inspector">
          <div className="inspector-heading"><Flag size={17} /><h3>Steg {stepIndex + 1}</h3><span>{exercise.steps.length} totalt</span></div>
          <label>Vad händer i steget?<textarea value={step.description} maxLength={2000} placeholder="T.ex. spelare 1 passar till spelare 2 och löper mot mål." onChange={(event) => editStep({ description: event.target.value })} /></label>
          <label>Tid till nästa steg
            <div className="input-suffix"><input aria-label="Steglängd i sekunder" type="number" min=".5" max="60" step=".5" value={step.duration} onChange={(event) => number(event.target.valueAsNumber, (n) => editStep({ duration: clamp(n, .5, 60) }))} /><span>sekunder</span></div>
          </label>
          <label className="check-label"><input type="checkbox" checked={exercise.showTrails} onChange={(event) => edit({ ...exercise, showTrails: event.target.checked })} />Visa rörelsespår i uppspelning, bild och utskrift</label>
          <p className="hint">Kopiera steget och flytta spelare och boll. Rörelsen mellan stegen blir animationen och visas som spår. Pilar är bara förklaringar.</p>
          <div className="inspector-divider" />
          <label>Markerat objekt
            <select aria-label="Markerat objekt" value={object?.id ?? ''} onChange={(event) => setSelected(event.target.value || null)}>
              <option value="">Välj på planen eller i listan</option>
              {step.objects.map((item, index) => <option key={item.id} value={item.id}>{kindLabels[item.kind]} {numbered(item.kind) ? `${item.number} · ${teamColors[item.team].label.toLowerCase()}` : index + 1}</option>)}
            </select>
          </label>
          {object ? <div className="object-properties">
            {(numbered(object.kind) || object.kind === 'zone') && <div className="property-row">
              {numbered(object.kind) && <label>Nummer<input aria-label="Spelarnummer" type="number" min="1" max="99" value={object.number} onChange={(event) => number(event.target.valueAsNumber, (n) => editObject({ number: clamp(Math.round(n), 1, 99) }))} /></label>}
              {object.kind === 'zone' && <label>Form<select aria-label="Zonens form" value={object.shape} onChange={(event) => editObject({ shape: event.target.value === 'ellipse' ? 'ellipse' : 'rect' })}><option value="rect">Rektangel</option><option value="ellipse">Ellips</option></select></label>}
              <label>{object.kind === 'zone' ? 'Färg' : 'Lag'}<select aria-label={object.kind === 'zone' ? 'Färg' : 'Lag'} value={object.team} onChange={(event) => editObject({ team: event.target.value as Team })}>
                {teams.map((team) => <option key={team} value={team}>{teamColors[team].label}</option>)}
              </select></label>
            </div>}
            {object.kind === 'arrow' && <label>Linjetyp<select aria-label="Linjetyp" value={object.style} onChange={(event) => editObject({ style: event.target.value as LineStyle })}>
              {lineStyles.map((style) => <option key={style} value={style}>{lineStyleLabels[style]}</option>)}
            </select></label>}
            {object.kind === 'text' && <label>Text<input aria-label="Text på planen" maxLength={80} value={object.text} onChange={(event) => editObject({ text: event.target.value })} /></label>}
            <div className="property-row">
              <label>X<input aria-label="Position X" type="number" min="0" max={width} value={Math.round(object.x)} onChange={(event) => number(event.target.valueAsNumber, (x) => editObject(moveObject(object, clamp(x, 0, width) - object.x, 0, width)))} /></label>
              <label>Y<input aria-label="Position Y" type="number" min="0" max="500" value={Math.round(object.y)} onChange={(event) => number(event.target.valueAsNumber, (y) => editObject(moveObject(object, 0, clamp(y, 0, 500) - object.y, width)))} /></label>
            </div>
            {isTwoPoint(object.kind) && <div className="property-row">
              <label>Slut X<input aria-label={object.kind === 'arrow' ? 'Pilens slut X' : 'Zonens hörn X'} type="number" min="0" max={width} value={Math.round(object.x2)} onChange={(event) => number(event.target.valueAsNumber, (x) => editObject({ x2: clamp(x, 0, width) }))} /></label>
              <label>Slut Y<input aria-label={object.kind === 'arrow' ? 'Pilens slut Y' : 'Zonens hörn Y'} type="number" min="0" max="500" value={Math.round(object.y2)} onChange={(event) => number(event.target.valueAsNumber, (y) => editObject({ y2: clamp(y, 0, 500) }))} /></label>
            </div>}
            {object.kind === 'arrow' && object.bend !== 0 && <button className="button secondary" onClick={() => editObject({ bend: 0 })}>Räta ut pilen</button>}
            {trail && <div className="movement-box">
              <label>Rörelse till nästa steg<select aria-label="Rörelsetyp" value={object.moveStyle} onChange={(event) => editObject({ moveStyle: event.target.value as MoveStyle })}>
                <option value="auto">Automatisk ({trailLabels[autoStyle]})</option>
                {(Object.keys(moveStyleLabels) as Exclude<MoveStyle, 'auto'>[]).map((style) => <option key={style} value={style}>{moveStyleLabels[style]}</option>)}
              </select></label>
              <p className="hint">Dra i det runda handtaget mitt på spåret för att böja rörelsen. Dubbelklicka på handtaget för att räta ut den.</p>
              {object.moveBend !== 0 && <button className="button secondary" onClick={() => editObject({ moveBend: 0 })}>Räta ut rörelsen</button>}
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
            <Board court={exercise.court} objects={item.objects} trails={trailsFor(exercise.steps, index)} />
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
      {imageOpen && <ImageExport exercise={exercise} stepIndex={stepIndex} onClose={() => setImageOpen(false)} />}
    </div>
  );
}
