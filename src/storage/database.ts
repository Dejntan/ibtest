import { exerciseSchema, type Exercise } from '../domain/model';

export interface LibraryStore {
  all(): Promise<Exercise[]>;
  put(exercise: Exercise): Promise<void>;
  putMany(exercises: Exercise[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export async function openLibrary(name = 'planverket'): Promise<LibraryStore> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('exercises', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Kunde inte öppna lokal lagring. Kontrollera webbläsarens lagringsinställningar.'));
    request.onblocked = () => reject(new Error('Lagringen är blockerad. Stäng andra flikar med appen och försök igen.'));
  });
  database.onversionchange = () => database.close();

  function write(action: (store: IDBObjectStore) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('exercises', 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error('Kunde inte spara. Lagringen kan vara full eller otillgänglig. Exportera en säkerhetskopia.'));
      transaction.onerror = () => reject(new Error('Kunde inte spara till lokal lagring. Exportera en säkerhetskopia.'));
      action(transaction.objectStore('exercises'));
    });
  }

  return {
    all: () => new Promise((resolve, reject) => {
      const transaction = database.transaction('exercises', 'readonly');
      const request = transaction.objectStore('exercises').getAll();
      transaction.onabort = () => reject(new Error('Läsning av lokala övningar avbröts.'));
      request.onerror = () => reject(new Error('Kunde inte läsa sparade övningar.'));
      transaction.oncomplete = () => {
        const parsed = exerciseSchema.array().safeParse(request.result);
        if (!parsed.success) {
          reject(new Error('Sparade övningar har ett ogiltigt format. Ingen data har skrivits över.'));
        } else resolve(parsed.data);
      };
    }),
    put: (exercise) => {
      const parsed = exerciseSchema.parse(exercise);
      return write((store) => { store.put(parsed); });
    },
    putMany: (exercises) => {
      const parsed = exerciseSchema.array().parse(exercises);
      return write((store) => { parsed.forEach((exercise) => store.put(exercise)); });
    },
    remove: (id) => write((store) => { store.delete(id); }),
  };
}
