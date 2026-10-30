import type { Exercise } from '../domain/model';

const MAX_AREA = 16_000_000;

export async function svgImage(svg: SVGSVGElement, scale = 2): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const [, , width, height] = (svg.getAttribute('viewBox') ?? '0 0 1048 548').split(/\s+/).map(Number);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width * scale));
  clone.setAttribute('height', String(height * scale));
  clone.querySelectorAll('title').forEach((title) => title.remove());
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Kunde inte skapa bilden av planen.'));
      image.src = url;
    });
    return image;
  } finally { URL.revokeObjectURL(url); }
}

function wrap(context: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > width && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
  }
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, '')} …`; }
  return lines;
}

export interface ImagePanel { svg: SVGSVGElement; label: string; description: string }

/** Draws one or more boards with captions onto a single PNG that is easy to share in chat apps. */
export async function renderPanels(exercise: Exercise, panels: ImagePanel[]): Promise<Blob> {
  const images = await Promise.all(panels.map((panel) => svgImage(panel.svg)));
  const columns = panels.length === 1 ? 1 : 2;
  const margin = 48;
  const gap = 36;
  const cellWidth = columns === 1 ? 1400 : 760;
  const width = margin * 2 + cellWidth * columns + gap * (columns - 1);
  const ratio = images[0].height / images[0].width;
  const boardHeight = cellWidth * ratio;
  const captionHeight = columns === 1 ? 150 : 130;
  const headerHeight = exercise.description ? 170 : 110;
  const rows = Math.ceil(panels.length / columns);
  const height = headerHeight + rows * (boardHeight + captionHeight) + (rows - 1) * gap + margin + 40;
  const scale = Math.min(1, Math.sqrt(MAX_AREA / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Bildexport stöds inte i den här webbläsaren.');
  context.scale(scale, scale);
  context.fillStyle = '#f5f4ef';
  context.fillRect(0, 0, width, height);
  const font = '"Segoe UI", system-ui, -apple-system, sans-serif';
  context.fillStyle = '#153e35';
  context.font = `700 44px ${font}`;
  context.fillText(exercise.name, margin, margin + 40);
  context.font = `400 24px ${font}`;
  context.fillStyle = '#5f6f62';
  wrap(context, exercise.description, width - margin * 2, 2).forEach((line, index) => context.fillText(line, margin, margin + 84 + index * 32));
  panels.forEach((panel, index) => {
    const x = margin + (index % columns) * (cellWidth + gap);
    const y = headerHeight + Math.floor(index / columns) * (boardHeight + captionHeight + gap);
    context.drawImage(images[index], x, y, cellWidth, boardHeight);
    context.fillStyle = '#153e35';
    context.font = `700 26px ${font}`;
    context.fillText(panel.label, x, y + boardHeight + 40);
    context.fillStyle = '#4d5d51';
    context.font = `400 23px ${font}`;
    wrap(context, panel.description, cellWidth, 3).forEach((line, lineIndex) => context.fillText(line, x, y + boardHeight + 76 + lineIndex * 30));
  });
  context.fillStyle = '#8a957f';
  context.font = `600 18px ${font}`;
  context.fillText('planverket · innebandy', margin, height - 30);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Kunde inte skapa PNG-bilden.')), 'image/png'));
}
