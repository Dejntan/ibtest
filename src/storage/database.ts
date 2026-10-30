import { exerciseSchema, sessionSchema, type Exercise, type TrainingSession } from '../domain/model';

export interface LibraryStore {
  all(): Promise<Exercise[]>;
  put(exercise: Exercise): Promise<void>;
  putMany(exercises: Exercise[], sessions?: TrainingSession[]): Promise<void>;
  remove(id: string): Promise<void>;
  sessions(): Promise<TrainingSession[]>;
  putSession(session: TrainingSession): Promise<void>;
  removeSession(id: string): Promise<void>;
}

type StoreName = 'exercises' | 'sessions';

export async function openLibrary(name = 'planverket'): Promise<LibraryStore> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onupgradeneeded = () => {
      const names = request.result.objectStoreNames;
      if (!names.contains('exercises')) request.result.createObjectStore('exercises', { keyPath: 'id' });
      if (!names.contains('sessions')) request.result.createObjectStore('sessions', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Kunde inte öppna lokal lagring. Kontrollera webbläsarens lagringsinställningar.'));
    request.onblocked = () => reject(new Error('Lagringen är blockerad. Stäng andra flikar med appen och försök igen.'));
  });
  database.onversionchange = () => database.close();

  function write(names: StoreName[], action: (transaction: IDBTransaction) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(names, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error('Kunde inte spara. Lagringen kan vara full eller otillgänglig. Exportera en säkerhetskopia.'));
      transaction.onerror = () => reject(new Error('Kunde inte spara till lokal lagring. Exportera en säkerhetskopia.'));
      action(transaction);
    });
  }

  function read<T>(storeName: StoreName, parse: (data: unknown) => { success: true; data: T } | { success: false }, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).getAll();
      transaction.onabort = () => reject(new Error(`Läsning av lokala ${label} avbröts.`));
      request.onerror = () => reject(new Error(`Kunde inte läsa sparade ${label}.`));
      transaction.oncomplete = () => {
        const parsed = parse(request.result);
        if (!parsed.success) reject(new Error(`Sparade ${label} har ett ogiltigt format. Ingen data har skrivits över.`));
        else resolve(parsed.data);
      };
    });
  }

  return {
    all: () => read('exercises', (data) => exerciseSchema.array().safeParse(data), 'övningar'),
    put: (exercise) => {
      const parsed = exerciseSchema.parse(exercise);
      return write(['exercises'], (transaction) => { transaction.objectStore('exercises').put(parsed); });
    },
    putMany: (exercises, sessions = []) => {
      const parsed = exerciseSchema.array().parse(exercises);
      const parsedSessions = sessionSchema.array().parse(sessions);
      return write(['exercises', 'sessions'], (transaction) => {
        parsed.forEach((exercise) => transaction.objectStore('exercises').put(exercise));
        parsedSessions.forEach((session) => transaction.objectStore('sessions').put(session));
      });
    },
    remove: (id) => write(['exercises'], (transaction) => { transaction.objectStore('exercises').delete(id); }),
    sessions: () => read('sessions', (data) => sessionSchema.array().safeParse(data), 'träningspass'),
    putSession: (session) => {
      const parsed = sessionSchema.parse(session);
      return write(['sessions'], (transaction) => { transaction.objectStore('sessions').put(parsed); });
    },
    removeSession: (id) => write(['sessions'], (transaction) => { transaction.objectStore('sessions').delete(id); }),
  };
}
