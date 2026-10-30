import { useId, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import type { BoardObject, Exercise, LineStyle } from '../domain/model';
import { courtWidth, teamColors } from '../domain/model';
import { curvePath, curvePoint, wavyPath, type Point } from '../domain/geometry';
import type { Trail } from '../playback/timeline';

export function boardPoint(event: PointerEvent<SVGSVGElement>): { x: number; y: number } {
  const matrix = event.currentTarget.getScreenCTM();
  if (!matrix) throw new Error('Ritytan är inte redo. Försök igen.');
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

export const kindLabels: Record<BoardObject['kind'], string> = {
  player: 'Spelare', goalkeeper: 'Målvakt', ball: 'Boll', cone: 'Kon', goal: 'Mål', arrow: 'Pil', zone: 'Zon', text: 'Text',
};

interface BoardProps {
  court: Exercise['court'];
  objects: BoardObject[];
  trails?: Trail[];
  /** Editing shows faint trails and the hidden trail of the selected object, so it can still be bent. */
  trailMode?: 'edit' | 'show';
  selected?: string | null;
  interactive?: boolean;
  onPointerDown?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: () => void;
  onKeyDown?: (event: KeyboardEvent<SVGSVGElement>) => void;
  onDoubleClick?: (event: MouseEvent<SVGSVGElement>) => void;
}

function Line({ from, to, bend, style, color, width, marker }: { from: Point; to: Point; bend: number; style: LineStyle; color: string; width: number; marker: string }) {
  const d = style === 'dribble' ? wavyPath(from, to, bend) : curvePath(from, to, bend);
  return <path d={d} fill="none" stroke={color} strokeWidth={style === 'shot' ? width * 2 : width} strokeLinecap="round" strokeLinejoin="round"
    strokeDasharray={style === 'run' ? '10 6' : undefined} markerEnd={style === 'line' ? undefined : `url(#${marker})`} data-line-style={style} />;
}

function Handle({ point, ...data }: { point: Point } & Record<`data-${string}`, string>) {
  return <circle {...data} className="board-handle" cx={point.x} cy={point.y} r="12" fill="#d9ed86" stroke="#284b42" strokeWidth="2" />;
}

export function Board({ court, objects, trails = [], trailMode = 'show', selected, interactive, ...events }: BoardProps) {
  const marker = useId().replace(/:/g, '');
  const width = courtWidth(court);
  const zones = objects.filter((object) => object.kind === 'zone');
  const others = objects.filter((object) => object.kind !== 'zone');
  const visibleTrails = trails.filter((trail) => trail.style !== 'none' || (trailMode === 'edit' && trail.id === selected));
  const selectedTrail = interactive ? trails.find((trail) => trail.id === selected) : undefined;
  const selectedObject = objects.find((object) => object.id === selected);

  function renderObject(object: BoardObject) {
    const active = selected === object.id;
    const team = teamColors[object.team];
    const end = { x: object.x2, y: object.y2 };
    return (
      <g key={object.id} data-object-id={object.id} data-kind={object.kind} className={interactive ? 'board-object' : undefined}>
        <title>{kindLabels[object.kind]}{object.kind === 'player' || object.kind === 'goalkeeper' ? ` ${object.number}, ${team.label.toLowerCase()}` : object.kind === 'text' ? `: ${object.text}` : ''}</title>
        {active && !['arrow', 'zone'].includes(object.kind) && (
          <circle className="selection-ring" cx={object.x} cy={object.y} r={object.kind === 'goal' ? 42 : 29} fill="#d7ec8b" fillOpacity=".45" stroke="#215b4b" strokeWidth="2" strokeDasharray="4 4" />
        )}
        {object.kind === 'player' && <>
          <circle className="player-disc" cx={object.x} cy={object.y + 3} r="20" fill="#000" opacity=".12" />
          <circle className="player-disc" cx={object.x} cy={object.y} r="20" fill={team.fill} stroke={object.team === 'white' ? '#30473d' : '#fffef9'} strokeWidth="3" />
          <text className="player-number" x={object.x} y={object.y + 1} dominantBaseline="middle" textAnchor="middle" fill={team.text} fontSize="18" fontWeight="700">{object.number}</text>
        </>}
        {object.kind === 'goalkeeper' && <g transform={`translate(${object.x} ${object.y})`}><g className="goalkeeper-figure">
          <rect x="-19" y="-16" width="38" height="38" rx="10" fill="#000" opacity=".12" />
          <rect x="-19" y="-19" width="38" height="38" rx="10" fill={team.fill} stroke={object.team === 'white' ? '#30473d' : '#fffef9'} strokeWidth="3" />
          <path d="M-12-19v6h24v-6" fill="none" stroke={team.text} strokeWidth="2" opacity=".7" />
          <text x="0" y="3" dominantBaseline="middle" textAnchor="middle" fill={team.text} fontSize="16" fontWeight="700">{object.number}</text>
        </g></g>}
        {object.kind === 'ball' && <>
          <circle cx={object.x} cy={object.y} r="11" fill="#fffef9" stroke="#364a40" strokeWidth="2" />
          <circle cx={object.x - 3} cy={object.y - 3} r="1.5" fill="#78877b" />
          <circle cx={object.x + 4} cy={object.y + 2} r="1.5" fill="#78877b" />
          <circle cx={object.x - 3} cy={object.y + 5} r="1.5" fill="#78877b" />
          <circle cx={object.x} cy={object.y} r="20" fill="transparent" />
        </>}
        {object.kind === 'cone' && <path d={`M${object.x} ${object.y - 17}l15 30h-30z`} fill="#e58d43" stroke="#fff9ed" strokeWidth="2" />}
        {object.kind === 'goal' && <g transform={`translate(${object.x} ${object.y})`}>
          <rect x="-18" y="-30" width="36" height="60" rx="2" fill="#fff8" stroke="#b9523c" strokeWidth="5" />
          <path d="M-12-20h24m-24 10h24m-24 10h24m-24 10h24m-24 10h24M-6-25v50M6-25v50" stroke="#968c7e" strokeWidth="1" />
        </g>}
        {object.kind === 'arrow' && <>
          <path d={curvePath(object, end, object.bend)} fill="none" stroke="transparent" strokeWidth="28" />
          <Line from={object} to={end} bend={object.bend} style={object.style} color={active ? '#58813d' : '#284b42'} width={active ? 4.5 : 3.5} marker={active ? `${marker}-active` : `${marker}-head`} />
        </>}
        {object.kind === 'zone' && (() => {
          const x = Math.min(object.x, object.x2);
          const y = Math.min(object.y, object.y2);
          const w = Math.max(4, Math.abs(object.x2 - object.x));
          const h = Math.max(4, Math.abs(object.y2 - object.y));
          const common = { fill: team.fill, fillOpacity: object.team === 'white' ? .45 : .18, stroke: object.team === 'white' ? '#30473d' : team.fill, strokeWidth: active ? 3 : 2, strokeDasharray: '8 5' };
          return object.shape === 'ellipse'
            ? <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />
            : <rect x={x} y={y} width={w} height={h} rx="8" {...common} />;
        })()}
        {object.kind === 'text' && <>
          <rect x={object.x - 5} y={object.y - 21} width={Math.min(280, Math.max(40, object.text.length * 11))} height="32" fill="#fffdf5" opacity=".85" rx="4" />
          <text x={object.x} y={object.y} fontSize="20" fill="#203f34" fontWeight="600">{object.text.slice(0, 80)}</text>
        </>}
      </g>
    );
  }

  return (
    <svg
      className={`board ${interactive ? 'board-interactive' : ''}`}
      viewBox={`-24 -24 ${width + 48} 548`}
      role="img"
      aria-label={`${court === 'full' ? 'Hel' : 'Halv'} innebandyplan${interactive ? '. Välj verktyg och tryck på planen. Flytta markerat objekt med piltangenterna.' : ''}`}
      tabIndex={interactive ? 0 : undefined}
      fontFamily='"Segoe UI", system-ui, -apple-system, sans-serif'
      {...events}
    >
      <defs>
        {[['head', '#284b42'], ['active', '#58813d']].map(([name, color]) => (
          <marker key={name} id={`${marker}-${name}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="15" markerHeight="15" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 0L10 5L0 10z" fill={color} />
          </marker>
        ))}
        <pattern id={`${marker}-wood`} width="80" height="500" patternUnits="userSpaceOnUse">
          <rect width="80" height="500" fill="#e9ddc7" />
          <path d="M0 0v500M40 0v500M0 130h40m0 220h40" stroke="#d7c6a9" strokeWidth="1" opacity=".38" />
        </pattern>
        <clipPath id={`${marker}-clip`}><rect width={width} height="500" rx="45" /></clipPath>
      </defs>
      <rect x="-7" y="-7" width={width + 14} height="514" rx="52" fill="#d0bea0" />
      <rect width={width} height="500" rx="45" fill={`url(#${marker}-wood)`} />
      <g clipPath={`url(#${marker}-clip)`} fill="none" stroke="#fffdf5" strokeWidth="3" opacity=".94" pointerEvents="none">
        <rect x="2" y="2" width="996" height="496" rx="44" />
        <path d="M500 0v500" />
        <circle cx="500" cy="250" r="72" />
        <circle cx="500" cy="250" r="4" fill="#fffdf5" />
        <path d="M90 35v430M910 35v430M90 155h95v190H90m820-190h-95v190h95" />
        <path d="M90 205h42v90H90m820-90h-42v90h42" />
        {[90, 910].flatMap((x) => [70, 430].map((y) => <path key={`${x}-${y}`} d={`M${x - 6} ${y}h12m-6-6v12`} />))}
      </g>
      <g pointerEvents="none" stroke="#9c6352" strokeWidth="4" fill="#f3e7d4">
        <path d="M90 225H65v50h25z" />
        {court === 'full' && <path d="M910 225h25v50h-25z" />}
      </g>
      {zones.map(renderObject)}
      <g className="trails" pointerEvents="none" opacity={trailMode === 'edit' ? .55 : .8}>
        {visibleTrails.map((trail) => <g key={trail.id} data-trail-id={trail.id} opacity={trail.style === 'none' ? .5 : 1}>
          <Line from={trail.from} to={trail.to} bend={trail.bend} style={trail.style === 'none' ? 'line' : trail.style} color="#284b42" width={3} marker={`${marker}-head`} />
        </g>)}
      </g>
      {others.map(renderObject)}
      {interactive && selectedObject && isPair(selectedObject) && <g className="handles">
        <Handle point={selectedObject} data-endpoint="start" />
        <Handle point={{ x: selectedObject.x2, y: selectedObject.y2 }} data-endpoint="end" />
        {selectedObject.kind === 'arrow' && <circle data-bend="arrow" className="board-handle bend-handle" {...circleAt(curvePoint(selectedObject, { x: selectedObject.x2, y: selectedObject.y2 }, selectedObject.bend, .5))} r="10" fill="#fffdf5" stroke="#284b42" strokeWidth="2" />}
      </g>}
      {selectedTrail && <circle data-bend="move" className="board-handle bend-handle" {...circleAt(curvePoint(selectedTrail.from, selectedTrail.to, selectedTrail.bend, .5))} r="11" fill="#fffdf5" stroke="#284b42" strokeWidth="2.5" />}
    </svg>
  );
}

const isPair = (object: BoardObject) => object.kind === 'arrow' || object.kind === 'zone';
const circleAt = (point: Point) => ({ cx: point.x, cy: point.y });
