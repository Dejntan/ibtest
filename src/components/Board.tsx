import { useId, type KeyboardEvent, type PointerEvent } from 'react';
import type { BoardObject, Exercise } from '../domain/model';
import { courtWidth } from '../domain/model';

export function boardPoint(event: PointerEvent<SVGSVGElement>): { x: number; y: number } {
  const matrix = event.currentTarget.getScreenCTM();
  if (!matrix) throw new Error('Ritytan är inte redo. Försök igen.');
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

export const kindLabels: Record<BoardObject['kind'], string> = {
  player: 'Spelare', ball: 'Boll', cone: 'Kon', goal: 'Mål', arrow: 'Pil', text: 'Text',
};

interface BoardProps {
  court: Exercise['court'];
  objects: BoardObject[];
  selected?: string | null;
  interactive?: boolean;
  onPointerDown?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: () => void;
  onKeyDown?: (event: KeyboardEvent<SVGSVGElement>) => void;
}

export function Board({ court, objects, selected, interactive, ...events }: BoardProps) {
  const marker = useId().replace(/:/g, '');
  const width = courtWidth(court);
  return (
    <svg
      className={`board ${interactive ? 'board-interactive' : ''}`}
      viewBox={`-24 -24 ${width + 48} 548`}
      role="img"
      aria-label={`${court === 'full' ? 'Hel' : 'Halv'} innebandyplan${interactive ? '. Välj verktyg och tryck på planen. Flytta markerat objekt med piltangenterna.' : ''}`}
      tabIndex={interactive ? 0 : undefined}
      {...events}
    >
      <defs>
        <marker id={marker} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L6,3 L0,6" fill="none" stroke="#284b42" strokeWidth="1.5" />
        </marker>
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
      {objects.map((object) => {
        const active = selected === object.id;
        const color = object.team === 'green' ? '#215b4b' : '#c7613f';
        return (
          <g key={object.id} data-object-id={object.id} className={interactive ? 'board-object' : undefined}>
            <title>{kindLabels[object.kind]}{object.kind === 'player' ? ` ${object.number}, ${object.team === 'green' ? 'grönt' : 'orange'} lag` : object.kind === 'text' ? `: ${object.text}` : ''}</title>
            {active && object.kind !== 'arrow' && (
              <circle className="selection-ring" cx={object.x} cy={object.y} r={object.kind === 'goal' ? 42 : 29} fill="#d7ec8b" fillOpacity=".45" stroke="#215b4b" strokeWidth="2" strokeDasharray="4 4" />
            )}
            {object.kind === 'player' && <>
              <circle className="player-disc" cx={object.x} cy={object.y + 3} r="20" fill="#000" opacity=".12" />
              <circle className="player-disc" cx={object.x} cy={object.y} r="20" fill={color} stroke="#fffef9" strokeWidth="3" />
              <text className="player-number" x={object.x} y={object.y + 1} dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="18" fontWeight="700">{object.number}</text>
            </>}
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
              <line x1={object.x} y1={object.y} x2={object.x2} y2={object.y2} stroke="transparent" strokeWidth="28" />
              <line x1={object.x} y1={object.y} x2={object.x2} y2={object.y2} stroke={active ? '#58813d' : '#284b42'} strokeWidth={active ? 5 : 3.5} markerEnd={`url(#${marker})`} strokeDasharray="10 6" />
              {active && <>
                <circle data-endpoint="start" cx={object.x} cy={object.y} r="12" fill="#d9ed86" stroke="#284b42" strokeWidth="2" />
                <circle data-endpoint="end" cx={object.x2} cy={object.y2} r="12" fill="#d9ed86" stroke="#284b42" strokeWidth="2" />
              </>}
            </>}
            {object.kind === 'text' && <>
              <rect x={object.x - 5} y={object.y - 21} width={Math.min(280, Math.max(40, object.text.length * 11))} height="32" fill="#fffdf5" opacity=".85" rx="4" />
              <text x={object.x} y={object.y} fontSize="20" fill="#203f34" fontWeight="600">{object.text.slice(0, 80)}</text>
            </>}
          </g>
        );
      })}
    </svg>
  );
}
