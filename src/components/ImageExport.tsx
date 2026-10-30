import { useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import type { Exercise } from '../domain/model';
import { errorMessage } from '../domain/model';
import { trailsFor } from '../playback/timeline';
import { downloadFile, safeFileName, shareFile } from '../transfer/files';
import { renderPanels } from '../transfer/image';
import { Board } from './Board';
import { Modal } from './Modal';

export function ImageExport({ exercise, stepIndex, onClose }: { exercise: Exercise; stepIndex: number; onClose: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function create(all: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const boards = [...(stage.current?.querySelectorAll<SVGSVGElement>('svg.board') ?? [])];
      const indexes = all ? exercise.steps.map((_, index) => index) : [stepIndex];
      const blob = await renderPanels(exercise, indexes.map((index) => ({
        svg: boards[index],
        label: `Steg ${index + 1}${index < exercise.steps.length - 1 ? ` · ${exercise.steps[index].duration} s` : ''}`,
        description: exercise.steps[index].description,
      })));
      const name = `${safeFileName(exercise.name, 'ovning')}-${all ? 'alla-steg' : `steg-${stepIndex + 1}`}.png`;
      setFile(new File([blob], name, { type: 'image/png' }));
      setPreview(URL.createObjectURL(blob));
    } catch (problem) { setMessage(errorMessage(problem)); }
    finally { setBusy(false); }
  }

  async function share() {
    if (!file) return;
    try {
      const result = await shareFile(file, exercise.name);
      if (result === 'shared') setMessage('Bilden har delats.');
      if (result === 'downloaded') setMessage('Bilden har skickats till webbläsaren för hämtning.');
    } catch (problem) { setMessage(errorMessage(problem)); }
  }

  return <Modal title="Spara som bild" onClose={onClose}>
    <p>Skapa en PNG-bild att skicka till laget, till exempel i en chatt.{exercise.showTrails ? ' Rörelsespåren visas i bilden.' : ''}</p>
    <div className="modal-actions">
      <button className="button primary" disabled={busy} onClick={() => void create(false)}>Bild av steg {stepIndex + 1}</button>
      <button className="button secondary" disabled={busy} onClick={() => void create(true)}>Alla {exercise.steps.length} steg i en bild</button>
    </div>
    {busy && <p role="status">Skapar bild…</p>}
    {file && preview && <div className="image-result">
      <img src={preview} alt={`Förhandsvisning av ${file.name}`} />
      <div className="modal-actions">
        <button className="button primary" onClick={() => void share()}><Share2 size={17} />Dela bild</button>
        <button className="button secondary" onClick={() => { downloadFile(file); setMessage('Bilden har skickats till webbläsaren för hämtning.'); }}><Download size={17} />Spara bild</button>
      </div>
    </div>}
    {message && <p role="status" className="hint">{message}</p>}
    <div ref={stage} className="export-stage" aria-hidden="true">
      {exercise.steps.map((step, index) => <Board key={step.id} court={exercise.court} objects={step.objects} trails={exercise.showTrails ? trailsFor(exercise.steps, index) : []} />)}
    </div>
  </Modal>;
}
