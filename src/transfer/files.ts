import { bundleSchema, type Exercise } from '../domain/model';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function checkFileSize(bytes: number): void {
  if (bytes > MAX_FILE_BYTES) throw new Error('Filen är för stor. Maximal filstorlek är 10 MB. Exportera färre övningar åt gången eller minska antalet steg och objekt.');
}

export function encodeBundle(exercises: Exercise[]): string {
  const parsed = bundleSchema.safeParse({ format: 'planverket', version: 1, exercises });
  if (!parsed.success) throw new Error('Kunde inte exportera. Kontrollera att övningarna har namn och giltiga steg. Högst 500 övningar kan exporteras i samma fil.');
  const text = JSON.stringify(parsed.data);
  checkFileSize(new TextEncoder().encode(text).byteLength);
  return text;
}

export function decodeBundle(text: string): Exercise[] {
  checkFileSize(new TextEncoder().encode(text).byteLength);
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new Error('Filen är inte giltig JSON. Välj en övningsfil exporterad från Planverket.'); }
  const result = bundleSchema.safeParse(data);
  if (!result.success) throw new Error('Filen har ett ogiltigt innehåll eller en filversion som inte stöds. Inga övningar har importerats.');
  return result.data.exercises;
}

export function bundleFile(exercises: Exercise[]): File {
  const name = exercises.length === 1
    ? exercises[0].name.replace(/[^a-zA-Z0-9åäöÅÄÖ_-]+/g, '-').slice(0, 80)
    : 'planverket-sakerhetskopia';
  return new File([encodeBundle(exercises)], `${name || 'ovning'}.json`, { type: 'application/json' });
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

export async function shareFile(file: File): Promise<'shared' | 'cancelled' | 'downloaded'> {
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Innebandyövning' }); return 'shared'; }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw new Error('Kunde inte dela filen. Använd Exportera fil i stället.');
    }
  }
  downloadFile(file);
  return 'downloaded';
}
