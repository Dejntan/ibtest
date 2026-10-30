import { bundleSchema, type Exercise, type TrainingSession } from '../domain/model';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface Library { exercises: Exercise[]; sessions: TrainingSession[] }

export function checkFileSize(bytes: number): void {
  if (bytes > MAX_FILE_BYTES) throw new Error('Filen är för stor. Maximal filstorlek är 10 MB. Exportera färre övningar åt gången eller minska antalet steg och objekt.');
}

export function encodeBundle(exercises: Exercise[], sessions: TrainingSession[] = []): string {
  const parsed = bundleSchema.safeParse({ format: 'planverket', version: 2, exercises, sessions });
  if (!parsed.success) throw new Error('Kunde inte exportera. Kontrollera att övningar och pass har namn och giltigt innehåll. Högst 500 övningar och 200 pass kan exporteras i samma fil.');
  const text = JSON.stringify(parsed.data);
  checkFileSize(new TextEncoder().encode(text).byteLength);
  return text;
}

export function decodeBundle(text: string): Library {
  checkFileSize(new TextEncoder().encode(text).byteLength);
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new Error('Filen är inte giltig JSON. Välj en övningsfil exporterad från Planverket.'); }
  const result = bundleSchema.safeParse(data);
  if (!result.success) throw new Error('Filen har ett ogiltigt innehåll eller en filversion som inte stöds. Inga övningar har importerats.');
  return { exercises: result.data.exercises, sessions: result.data.version === 2 ? result.data.sessions : [] };
}

export const safeFileName = (name: string, fallback: string) => name.replace(/[^a-zA-Z0-9åäöÅÄÖ_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || fallback;

export function bundleFile(exercises: Exercise[], sessions: TrainingSession[] = []): File {
  const name = sessions.length === 1 ? safeFileName(sessions[0].name, 'traningspass')
    : !sessions.length && exercises.length === 1 ? safeFileName(exercises[0].name, 'ovning')
      : 'planverket-sakerhetskopia';
  return new File([encodeBundle(exercises, sessions)], `${name}.json`, { type: 'application/json' });
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function shareFile(file: File, title = 'Innebandyövning'): Promise<'shared' | 'cancelled' | 'downloaded'> {
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw new Error('Kunde inte dela filen. Använd Exportera fil i stället.');
    }
  }
  downloadFile(file);
  return 'downloaded';
}
