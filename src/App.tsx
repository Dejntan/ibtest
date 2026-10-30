import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Copy, Download, Expand, FolderOpen, HelpCircle, LayoutGrid, LayoutTemplate, Plus, Printer, Search, Share2, ShieldCheck, Trash2, Upload, Wifi, WifiOff, X } from 'lucide-react';
import { Board } from './components/Board';
import { InstallHelp } from './components/InstallHelp';
import { Modal } from './components/Modal';
import { Updates } from './components/Updates';
import { Editor } from './editor/Editor';
import { duplicateExercise, duplicateSession, errorMessage, newExercise, newSession, sessionMinutes, type Exercise, type TrainingSession } from './domain/model';
import { exampleExercise } from './domain/example';
import { exerciseTemplates } from './domain/templates';
import { enterFullscreen, Present, type PresentItem } from './playback/Present';
import { PrintView, type PrintTarget } from './print/PrintView';
import { SessionEditor } from './sessions/SessionEditor';
import { openLibrary, type LibraryStore } from './storage/database';
import { bundleFile, checkFileSize, decodeBundle, downloadFile, shareFile, type Library } from './transfer/files';

const dateFormat = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });
const sessionDateFormat = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function App() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [tab, setTab] = useState<'exercises' | 'sessions'>('exercises');
  const [present, setPresent] = useState<{ title: string; items: PresentItem[] } | null>(null);
  const [print, setPrint] = useState<PrintTarget | null>(null);
  const [templates, setTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState(false);
  const [status, setStatus] = useState('Sparar…');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'full' | 'half'>('all');
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingImport, setPendingImport] = useState<Library | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const store = useRef<LibraryStore | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const itemRevisions = useRef(new Map<string, number>());
  const dirty = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const demo = useMemo(exampleExercise, []);
  const active = exercises.find((exercise) => exercise.id === activeId);
  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const onError = useCallback((message: string) => setError(message), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const database = await openLibrary();
        const [saved, savedSessions] = await Promise.all([database.all(), database.sessions()]);
        if (!cancelled) { store.current = database; setExercises(saved); setSessions(savedSessions); setStatus('Sparat på enheten'); }
      } catch (problem) {
        if (!cancelled) { setError(errorMessage(problem)); setStatus('Lagring otillgänglig – exportera ditt arbete'); }
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    const connection = () => setOnline(navigator.onLine);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    return () => { cancelled = true; window.removeEventListener('online', connection); window.removeEventListener('offline', connection); };
  }, []);

  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (dirty.current.size) event.preventDefault(); };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, []);

  /** Saves in order, so a slow write can never overwrite a newer version of the same item. */
  const persist = useCallback((id: string, name: string, write: (database: LibraryStore) => Promise<void>) => {
    dirty.current.add(id);
    const version = ++revision.current;
    itemRevisions.current.set(id, version);
    if (!name.trim()) { setStatus('Ange ett namn för att spara'); return; }
    if (!store.current) { setStatus('Inte sparat – exportera ditt arbete'); return; }
    setStatus('Sparar…');
    const database = store.current;
    queue.current = queue.current.then(async () => {
      try {
        await write(database);
        if (itemRevisions.current.get(id) === version) dirty.current.delete(id);
        if (version === revision.current) setStatus('Sparat på enheten');
      } catch (problem) {
        setError(errorMessage(problem));
        if (version === revision.current) setStatus('Inte sparat – exportera ditt arbete');
      }
    });
  }, []);

  const saveExercise = useCallback((exercise: Exercise) => {
    const snapshot = { ...exercise, updatedAt: new Date().toISOString() };
    setExercises((current) => [...current.filter((item) => item.id !== snapshot.id), snapshot]);
    persist(snapshot.id, snapshot.name, (database) => database.put(snapshot));
  }, [persist]);

  const saveSession = useCallback((session: TrainingSession) => {
    const snapshot = { ...session, updatedAt: new Date().toISOString() };
    setSessions((current) => [...current.filter((item) => item.id !== snapshot.id), snapshot]);
    persist(snapshot.id, snapshot.name, (database) => database.putSession(snapshot));
  }, [persist]);

  function create(exercise = newExercise()) {
    setExercises((current) => [...current, exercise]);
    setActiveId(exercise.id);
    setTemplates(false);
  }

  function createSession() {
    const session = newSession();
    saveSession(session);
    setActiveSessionId(session.id);
  }

  async function exportLibrary(items: Exercise[], sessionItems: TrainingSession[], share: boolean) {
    try {
      const file = bundleFile(items, sessionItems);
      if (share) {
        const result = await shareFile(file, sessionItems.length === 1 ? sessionItems[0].name : items.length === 1 ? items[0].name : 'Innebandyövningar');
        if (result === 'shared') setNotice('Filen har delats.');
        else if (result === 'downloaded') setNotice('Filen har skickats till webbläsaren för hämtning. Välj var den ska sparas.');
      } else {
        downloadFile(file);
        setNotice('Filen har skickats till webbläsaren för hämtning. Spara den som säkerhetskopia.');
      }
    } catch (problem) { setError(errorMessage(problem)); }
  }

  function exportSession(session: TrainingSession, share: boolean) {
    const ids = new Set(session.items.map((item) => item.exerciseId));
    void exportLibrary(exercises.filter((exercise) => ids.has(exercise.id)), [session], share);
  }

  function presentExercise(exercise: Exercise) {
    enterFullscreen();
    setPresent({ title: exercise.name, items: [{ name: exercise.name, exercise }] });
  }

  function presentSession(session: TrainingSession) {
    if (!session.items.length) return;
    enterFullscreen();
    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    setPresent({
      title: session.name,
      items: session.items.map((item) => ({ name: byId.get(item.exerciseId)?.name ?? 'Saknad övning', exercise: byId.get(item.exerciseId), minutes: item.minutes, note: item.note })),
    });
  }

  async function readImport(file: File | undefined) {
    if (!file) return;
    try {
      checkFileSize(file.size);
      setPendingImport(decodeBundle(await file.text()));
    } catch (problem) { setError(errorMessage(problem)); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  }

  async function confirmImport(mode: 'copy' | 'replace') {
    if (!pendingImport || !store.current) {
      setError('Import kräver fungerande lokal lagring. Ditt bibliotek har inte ändrats.');
      return;
    }
    setImportBusy(true);
    try {
      await queue.current;
      let items = pendingImport.exercises;
      let sessionItems = pendingImport.sessions;
      if (mode === 'copy') {
        const ids = new Map<string, string>();
        items = items.map((exercise) => { const copy = duplicateExercise(exercise); ids.set(exercise.id, copy.id); return copy; });
        sessionItems = sessionItems.map((session) => duplicateSession(session, ids));
      }
      await store.current.putMany(items, sessionItems);
      const ids = new Set([...items, ...sessionItems].map((item) => item.id));
      setExercises((current) => [...current.filter((item) => !ids.has(item.id)), ...items]);
      setSessions((current) => [...current.filter((item) => !ids.has(item.id)), ...sessionItems]);
      ids.forEach((id) => dirty.current.delete(id));
      setPendingImport(null);
      if (sessionItems.length && !items.length) setTab('sessions');
      setNotice(`Importerat: ${[items.length ? plural(items.length, 'övning', 'övningar') : '', sessionItems.length ? plural(sessionItems.length, 'träningspass', 'träningspass') : ''].filter(Boolean).join(' och ')}.`);
    } catch (problem) { setError(errorMessage(problem)); }
    finally { setImportBusy(false); }
  }

  async function remove(exercise: Exercise) {
    const usedIn = sessions.filter((session) => session.items.some((item) => item.exerciseId === exercise.id));
    const warning = usedIn.length ? ` Den används i ${plural(usedIn.length, 'träningspass', 'träningspass')} (${usedIn.map((session) => session.name).join(', ')}) och markeras där som saknad.` : '';
    if (!window.confirm(`Ta bort "${exercise.name}" från biblioteket? Detta kan inte ångras.${warning} Exportera först om du vill behålla en kopia.`)) return;
    try {
      await queue.current;
      if (store.current) await store.current.remove(exercise.id);
      else if (!dirty.current.has(exercise.id)) throw new Error('Kunde inte ta bort övningen: lagringen är otillgänglig.');
      setExercises((current) => current.filter((item) => item.id !== exercise.id));
      dirty.current.delete(exercise.id);
      setNotice('Övningen har tagits bort.');
    } catch (problem) { setError(errorMessage(problem)); }
  }

  async function removeSession(session: TrainingSession) {
    if (!window.confirm(`Ta bort passet "${session.name}"? Övningarna finns kvar i biblioteket.`)) return;
    try {
      await queue.current;
      if (store.current) await store.current.removeSession(session.id);
      else if (!dirty.current.has(session.id)) throw new Error('Kunde inte ta bort passet: lagringen är otillgänglig.');
      setSessions((current) => current.filter((item) => item.id !== session.id));
      dirty.current.delete(session.id);
      if (activeSessionId === session.id) setActiveSessionId(null);
      setNotice('Träningspasset har tagits bort.');
    } catch (problem) { setError(errorMessage(problem)); }
  }

  function toLibrary(target: 'exercises' | 'sessions' = 'exercises') {
    setActiveId(null);
    setActiveSessionId(null);
    setTab(target);
  }

  const filtered = exercises.filter((exercise) =>
    (filter === 'all' || exercise.court === filter)
    && `${exercise.name} ${exercise.description}`.toLocaleLowerCase('sv-SE').includes(search.toLocaleLowerCase('sv-SE')),
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sortedSessions = [...sessions].sort((a, b) => (b.date || b.updatedAt).localeCompare(a.date || a.updatedAt));
  const collisions = pendingImport ? pendingImport.exercises.filter((item) => exercises.some((exercise) => exercise.id === item.id)).length
    + pendingImport.sessions.filter((item) => sessions.some((session) => session.id === item.id)).length : 0;

  if (print) return <PrintView target={print} exercises={exercises} onClose={() => setPrint(null)} />;

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" aria-label="Planverket, till biblioteket" onClick={() => toLibrary(tab)}>
          <span className="brand-mark"><img src="./icon.svg" alt="" /></span>
          <span>planverket<span className="brand-subtitle">INNEBANDY</span></span>
        </button>
        <nav className="header-nav" aria-label="Huvudmeny">
          <button className="nav-link" onClick={() => toLibrary('exercises')}><BookOpen size={17} />Övningsbibliotek</button>
          <button className="nav-link" onClick={() => toLibrary('sessions')}><CalendarDays size={17} />Träningspass</button>
          <button className="nav-link help-link" onClick={() => setHelp(true)}><HelpCircle size={17} />Så fungerar det</button>
        </nav>
        <InstallHelp onError={onError} />
      </header>
      <main>
        <Updates busy={!!activeId || !!activeSessionId || !!present || dirty.current.size > 0} onError={onError} />
        {error && <div className="message error-message" role="alert"><span>{error}</span><button aria-label="Stäng felmeddelande" className="icon-button" onClick={() => setError('')}><X size={18} /></button></div>}
        {notice && <div className="message notice-message" role="status"><Check size={18} /><span>{notice}</span><button aria-label="Stäng meddelande" className="icon-button" onClick={() => setNotice('')}><X size={18} /></button></div>}
        {active ? <Editor key={active.id} initial={active} saveStatus={status} onChange={saveExercise} onClose={() => setActiveId(null)}
          onExport={(exercise, share) => void exportLibrary([exercise], [], share)} onPresent={presentExercise} onPrint={(exercise) => setPrint({ kind: 'exercise', exercise })} />
          : activeSession ? <SessionEditor key={activeSession.id} session={activeSession} exercises={exercises} saveStatus={status} onChange={saveSession} onClose={() => toLibrary('sessions')}
            onPresent={presentSession} onPrint={(session) => setPrint({ kind: 'session', session })} onExport={exportSession} onOpenExercise={setActiveId} /> : <>
          {!exercises.length && !sessions.length ? <section className="hero">
            <div className="hero-copy">
              <span className="hero-kicker"><span />FRÅN IDÉ TILL TRÄNING</span>
              <h1>Bra träningar<br />börjar med en <em>plan.</em></h1>
              <p>Rita upp dina innebandyövningar, visa hur spelet rör sig och ta med hela laget på idén.</p>
              <div className="hero-actions">
                <button className="button primary large" disabled={loading} onClick={() => create()}><Plus size={19} />Skapa en övning</button>
                <button className="button secondary" disabled={loading} onClick={() => setTemplates(true)}><LayoutTemplate size={17} />Ny från mall</button>
                <button className="button quiet" disabled={loading} onClick={() => create(exampleExercise())}>Prova ett exempel<ArrowRight size={17} /></button>
              </div>
              <div className="hero-perks"><span><Check size={15} />Utan konto</span><span><Check size={15} />Offline efter första besöket</span><span><Check size={15} />Dela med laget</span></div>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="visual-caption"><span className="live-dot" />EN IDÉ. ETT SPELMÖNSTER.</div>
              <div className="hero-board"><Board court="full" objects={demo.steps[0].objects} /></div>
              <div className="visual-note"><span className="note-icon"><ArrowRight size={19} /></span><div><strong>Passa. Löp. Avsluta.</strong><span>Gör nästa träning lite tydligare.</span></div><span className="visual-steps">01 / 04</span></div>
              <span className="visual-decoration">DIN NÄSTA BRA ÖVNING BÖRJAR HÄR ↗</span>
            </div>
          </section> : <section className="returning-heading"><div><p className="eyebrow">REDO FÖR NÄSTA TRÄNING?</p><h1>Dina idéer. Ditt spel.</h1></div>
            <div className="heading-actions">
              <button className="button secondary" onClick={() => setTemplates(true)}><LayoutTemplate size={17} />Ny från mall</button>
              <button className="button primary" onClick={() => create()}><Plus size={18} />Skapa en övning</button>
            </div></section>}
          <section className="library" aria-labelledby="library-title">
            <div className="tabs" role="tablist" aria-label="Bibliotek">
              <button role="tab" id="tab-exercises" aria-selected={tab === 'exercises'} aria-controls="library-panel" className={tab === 'exercises' ? 'tab active' : 'tab'} onClick={() => setTab('exercises')}><BookOpen size={16} />Övningar <span className="count-badge">{exercises.length}</span></button>
              <button role="tab" id="tab-sessions" aria-selected={tab === 'sessions'} aria-controls="library-panel" className={tab === 'sessions' ? 'tab active' : 'tab'} onClick={() => setTab('sessions')}><CalendarDays size={16} />Träningspass <span className="count-badge">{sessions.length}</span></button>
            </div>
            <div id="library-panel" role="tabpanel" aria-labelledby={tab === 'exercises' ? 'tab-exercises' : 'tab-sessions'}>
              <div className="section-heading library-heading">
                {tab === 'exercises'
                  ? <div><p className="eyebrow">SAMLA DINA SPELIDÉER</p><h2 id="library-title">Ditt övningsbibliotek <span className="count-badge">{exercises.length}</span></h2></div>
                  : <div><p className="eyebrow">PLANERA TRÄNINGEN</p><h2 id="library-title">Dina träningspass <span className="count-badge">{sessions.length}</span></h2></div>}
                <div className="library-actions">
                  <button className="button secondary" disabled={loading} onClick={() => fileInput.current?.click()}><Upload size={17} />Importera</button>
                  <button className="button secondary backup-button" disabled={!exercises.length && !sessions.length} onClick={() => void exportLibrary(exercises, sessions, false)}><ArrowDownToLine size={17} />Säkerhetskopiera</button>
                </div>
              </div>
              {tab === 'exercises' ? <>
                <div className="library-filters">
                  <label className="search-field"><Search size={18} /><input type="search" aria-label="Sök övningar" placeholder="Sök bland dina övningar…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                  <div className="filter-field"><LayoutGrid size={16} /><select aria-label="Filtrera planstorlek" value={filter} onChange={(event) => setFilter(event.target.value === 'full' ? 'full' : event.target.value === 'half' ? 'half' : 'all')}><option value="all">Alla planer</option><option value="full">Helplan</option><option value="half">Halvplan</option></select><ChevronDown size={15} /></div>
                </div>
                {loading ? <div className="empty-library"><p role="status">Läser ditt bibliotek…</p></div> : !filtered.length ? <div className="empty-library">
                  <span className="empty-library-icon"><FolderOpen size={31} strokeWidth={1.5} /></span>
                  <h3>{exercises.length ? 'Ingen övning matchar sökningen' : 'Plats för dina bästa övningar'}</h3>
                  <p>{exercises.length ? 'Prova ett annat sökord eller välj en annan planstorlek.' : 'Börja med en tom plan, en mall eller exemplet.\nDina sparade övningar samlas här.'}</p>
                  {!exercises.length && <button className="button secondary" onClick={() => create()}><Plus size={17} />Skapa din första övning</button>}
                </div> : <div className="exercise-grid">
                  {filtered.map((exercise) => <article className="exercise-card" key={exercise.id}>
                    <button className="exercise-preview" aria-label={`Öppna ${exercise.name}`} onClick={() => setActiveId(exercise.id)}>
                      <Board court={exercise.court} objects={exercise.steps[0].objects} />
                      <span className="court-tag">{exercise.court === 'full' ? 'Helplan' : 'Halvplan'}</span>
                    </button>
                    <div className="exercise-card-body"><div className="exercise-card-meta"><span>{exercise.steps.length} steg</span><span>{dateFormat.format(new Date(exercise.updatedAt))}</span></div>
                      <button className="exercise-name" onClick={() => setActiveId(exercise.id)}>{exercise.name}</button>
                      <p>{exercise.description || 'En ny spelidé att ta med till träningen.'}</p>
                      {dirty.current.has(exercise.id) && <span className="unsaved-label">Inte sparat på enheten – öppna eller exportera</span>}
                      <div className="card-actions">
                        <button className="text-button" onClick={() => setActiveId(exercise.id)}>Öppna<ArrowRight size={15} /></button>
                        <div><button className="icon-button" aria-label={`Visa ${exercise.name}`} onClick={() => presentExercise(exercise)}><Expand size={16} /></button>
                          <button className="icon-button" aria-label={`Duplicera ${exercise.name}`} onClick={() => create(duplicateExercise(exercise))}><Copy size={16} /></button>
                          <button className="icon-button" aria-label={`Exportera ${exercise.name}`} onClick={() => void exportLibrary([exercise], [], false)}><Download size={16} /></button>
                          <button className="icon-button" aria-label={`Dela ${exercise.name}`} onClick={() => void exportLibrary([exercise], [], true)}><Share2 size={16} /></button>
                          <button className="icon-button danger" aria-label={`Ta bort ${exercise.name}`} onClick={() => void remove(exercise)}><Trash2 size={16} /></button></div>
                      </div>
                    </div>
                  </article>)}
                  <button className="new-exercise-card" onClick={() => create()}><span><Plus size={27} /></span><strong>En ny spelidé?</strong><span>Skapa en övning</span></button>
                </div>}
              </> : loading ? <div className="empty-library"><p role="status">Läser dina träningspass…</p></div> : <div className="session-grid">
                {sortedSessions.map((session) => <article className="session-card" key={session.id}>
                  <button className="session-card-main" aria-label={`Öppna passet ${session.name}`} onClick={() => setActiveSessionId(session.id)}>
                    <span className="session-date">{session.date ? sessionDateFormat.format(new Date(`${session.date}T12:00:00`)) : 'Inget datum'}</span>
                    <strong>{session.name}</strong>
                    <span className="session-summary">{plural(session.items.length, 'övning', 'övningar')} · {sessionMinutes(session)} min</span>
                    {dirty.current.has(session.id) && <span className="unsaved-label">Inte sparat på enheten</span>}
                  </button>
                  <div className="card-actions">
                    <button className="text-button" onClick={() => setActiveSessionId(session.id)}>Öppna<ArrowRight size={15} /></button>
                    <div><button className="icon-button" aria-label={`Visa passet ${session.name}`} disabled={!session.items.length} onClick={() => presentSession(session)}><Expand size={16} /></button>
                      <button className="icon-button" aria-label={`Skriv ut passet ${session.name}`} onClick={() => setPrint({ kind: 'session', session })}><Printer size={16} /></button>
                      <button className="icon-button" aria-label={`Dela passet ${session.name}`} onClick={() => exportSession(session, true)}><Share2 size={16} /></button>
                      <button className="icon-button danger" aria-label={`Ta bort passet ${session.name}`} onClick={() => void removeSession(session)}><Trash2 size={16} /></button></div>
                  </div>
                </article>)}
                <button className="new-exercise-card" onClick={createSession}><span><CalendarDays size={27} /></span><strong>Planera en träning</strong><span>Nytt träningspass</span></button>
              </div>}
            </div>
          </section>
          <div className="storage-note"><ShieldCheck size={20} /><p><strong>Dina övningar, på din enhet.</strong> Inget konto och ingen molnlagring. Exportera en säkerhetskopia – rensad webbläsardata kan annars ta bort dina övningar och pass.</p></div>
        </>}
        <input ref={fileInput} className="visually-hidden" type="file" accept=".json,application/json" aria-label="Importera övningsfil" onChange={(event) => void readImport(event.target.files?.[0])} />
      </main>
      <footer className="site-footer"><span>planverket <span className="footer-divider">/</span> Mer spel. Mindre förklaring.</span><button className="footer-help" onClick={() => setHelp(true)}><HelpCircle size={14} />Så fungerar det</button><span className="connection-state">{online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? 'Ansluten' : 'Offline'}<span>·</span>Lokalt på din enhet</span></footer>
      {help && <Modal title="Från tom plan till tydlig övning" onClose={() => setHelp(false)}>
        <ol className="help-steps">
          <li><strong>Rita din startposition.</strong><p>Skapa en övning eller börja från en mall. Välj ett verktyg och tryck på planen. Dra objekten dit du vill ha dem. Konmallar ställer ut flera koner på en gång.</p></li>
          <li><strong>Bygg rörelsen steg för steg.</strong><p>Kopiera till nästa steg och flytta spelare och boll. Samma objekt följer med, så att appen kan animera deras rörelse. Dra i den lilla punkten mitt på ett rörelsespår för att böja vägen. Pilar och text förklarar – de styr inte animationen.</p></li>
          <li><strong>Visa laget hur det går till.</strong><p>Tryck Spela upp, eller Helskärm för visningsläget med stora knappar. Tryck på planen för att pausa och svep för att byta steg.</p></li>
          <li><strong>Planera hela träningen.</strong><p>Under Träningspass sätter du ihop övningar med minuter och anteckningar. Visa passet med nedräkning, eller skriv ut det.</p></li>
          <li><strong>Spara och dela.</strong><p>Ändringar sparas automatiskt när lokal lagring fungerar. Dela en fil som mottagaren importerar i sin app, en bild för chatten eller en utskrift/PDF.</p></li>
        </ol>
        <div className="info-box">Offline fungerar efter att appen har laddats färdigt med internet. Fildelning till andra appar kan kräva nät. Säkerhetskopiera regelbundet. Tangentbord: välj objekt i listan, fokusera planen och använd piltangenterna (Skift för större steg) eller Delete.</div>
      </Modal>}
      {templates && <Modal title="Ny övning från mall" onClose={() => setTemplates(false)}>
        <p>Välj en färdig övning att utgå från. Den sparas som en ny övning som du kan ändra fritt.</p>
        <div className="template-grid">
          {exerciseTemplates.map((template) => {
            const preview = template.build();
            return <button key={template.id} className="template-card" onClick={() => create(template.build())}>
              <Board court={preview.court} objects={preview.steps[0].objects} />
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </button>;
          })}
        </div>
      </Modal>}
      {pendingImport && <Modal title="Importera" onClose={() => { if (!importBusy) setPendingImport(null); }}>
        <p>Filen innehåller <strong>{[pendingImport.exercises.length ? plural(pendingImport.exercises.length, 'övning', 'övningar') : '', pendingImport.sessions.length ? plural(pendingImport.sessions.length, 'träningspass', 'träningspass') : ''].filter(Boolean).join(' och ')}</strong>.</p>
        <ul className="import-list">
          {pendingImport.sessions.map((session) => <li key={session.id}><CalendarDays size={14} /> {session.name}</li>)}
          {pendingImport.exercises.map((exercise) => <li key={exercise.id}>{exercise.name}</li>)}
        </ul>
        {collisions > 0 ? <p>{collisions} {collisions === 1 ? 'objekt har' : 'objekt har'} samma ID som i ditt bibliotek. Välj nya kopior för att behålla båda, eller ersätt de befintliga.</p> : <p>Importera som nya kopior, eller behåll filens ursprungliga ID för framtida uppdateringar.</p>}
        <div className="modal-actions"><button className="button primary" disabled={importBusy} onClick={() => void confirmImport('copy')}>Importera som kopior</button><button className="button secondary" disabled={importBusy} onClick={() => void confirmImport('replace')}>{collisions ? 'Ersätt befintliga' : 'Behåll ursprungliga ID'}</button></div>
        <p className="hint">Hela filen kontrolleras innan något sparas. Maximal filstorlek: 10 MB.</p>
      </Modal>}
      {present && <Present title={present.title} items={present.items} onClose={() => setPresent(null)} />}
    </div>
  );
}
