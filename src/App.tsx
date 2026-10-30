import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronDown, Copy, Download, FolderOpen, HelpCircle, LayoutGrid, Plus, Search, Share2, ShieldCheck, Trash2, Upload, Wifi, WifiOff, X } from 'lucide-react';
import { Board } from './components/Board';
import { InstallHelp } from './components/InstallHelp';
import { Modal } from './components/Modal';
import { Updates } from './components/Updates';
import { Editor } from './editor/Editor';
import { duplicateExercise, errorMessage, newExercise, type Exercise } from './domain/model';
import { exampleExercise } from './domain/example';
import { openLibrary, type LibraryStore } from './storage/database';
import { bundleFile, checkFileSize, decodeBundle, downloadFile, shareFile } from './transfer/files';

const dateFormat = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });

export default function App() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState(false);
  const [status, setStatus] = useState('Sparar…');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'full' | 'half'>('all');
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingImport, setPendingImport] = useState<Exercise[] | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const store = useRef<LibraryStore | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const exerciseRevisions = useRef(new Map<string, number>());
  const dirty = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const demo = useMemo(exampleExercise, []);
  const active = exercises.find((exercise) => exercise.id === activeId);
  const onError = useCallback((message: string) => setError(message), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const database = await openLibrary();
        const saved = await database.all();
        if (!cancelled) { store.current = database; setExercises(saved); setStatus('Sparat på enheten'); }
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

  const saveExercise = useCallback((exercise: Exercise) => {
    const snapshot = { ...exercise, updatedAt: new Date().toISOString() };
    setExercises((current) => [...current.filter((item) => item.id !== snapshot.id), snapshot]);
    dirty.current.add(snapshot.id);
    const version = ++revision.current;
    exerciseRevisions.current.set(snapshot.id, version);
    if (!snapshot.name.trim()) { setStatus('Ange ett namn för att spara'); return; }
    if (!store.current) { setStatus('Inte sparat – exportera ditt arbete'); return; }
    setStatus('Sparar…');
    const database = store.current;
    queue.current = queue.current.then(async () => {
      try {
        await database.put(snapshot);
        if (exerciseRevisions.current.get(snapshot.id) === version) dirty.current.delete(snapshot.id);
        if (version === revision.current) {
          setStatus('Sparat på enheten');
        }
      } catch (problem) {
        setError(errorMessage(problem));
        if (version === revision.current) setStatus('Inte sparat – exportera ditt arbete');
      }
    });
  }, []);

  function create(exercise = newExercise()) {
    setExercises((current) => [...current, exercise]);
    setActiveId(exercise.id);
  }

  async function exportExercises(items: Exercise[], share: boolean) {
    try {
      const file = bundleFile(items);
      if (share) {
        const result = await shareFile(file);
        if (result === 'shared') setNotice('Övningsfilen har delats.');
        else if (result === 'downloaded') setNotice('Filen har skickats till webbläsaren för hämtning. Välj var den ska sparas.');
      } else {
        downloadFile(file);
        setNotice('Filen har skickats till webbläsaren för hämtning. Spara den som säkerhetskopia.');
      }
    } catch (problem) { setError(errorMessage(problem)); }
  }

  async function readImport(file: File | undefined) {
    if (!file) return;
    try {
      checkFileSize(file.size);
      const imported = decodeBundle(await file.text());
      setPendingImport(imported);
    } catch (problem) { setError(errorMessage(problem)); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  }

  async function confirmImport(mode: 'copy' | 'replace') {
    if (!pendingImport || !store.current) {
      setError('Import kräver fungerande lokal lagring. Dina befintliga övningar har inte ändrats.');
      return;
    }
    setImportBusy(true);
    try {
      await queue.current;
      const items = pendingImport.map((exercise) => mode === 'copy' ? duplicateExercise(exercise) : exercise);
      await store.current.putMany(items);
      const ids = new Set(items.map((item) => item.id));
      setExercises((current) => [...current.filter((item) => !ids.has(item.id)), ...items]);
      ids.forEach((id) => dirty.current.delete(id));
      setPendingImport(null);
      setNotice(`${items.length} ${items.length === 1 ? 'övning importerad' : 'övningar importerade'}.`);
    } catch (problem) { setError(errorMessage(problem)); }
    finally { setImportBusy(false); }
  }

  async function remove(exercise: Exercise) {
    if (!window.confirm(`Ta bort "${exercise.name}" från biblioteket? Detta kan inte ångras. Exportera först om du vill behålla en kopia.`)) return;
    try {
      await queue.current;
      if (store.current) await store.current.remove(exercise.id);
      else if (!dirty.current.has(exercise.id)) throw new Error('Kunde inte ta bort övningen: lagringen är otillgänglig.');
      setExercises((current) => current.filter((item) => item.id !== exercise.id));
      dirty.current.delete(exercise.id);
      setNotice('Övningen har tagits bort.');
    } catch (problem) { setError(errorMessage(problem)); }
  }

  const filtered = exercises.filter((exercise) =>
    (filter === 'all' || exercise.court === filter)
    && `${exercise.name} ${exercise.description}`.toLocaleLowerCase('sv-SE').includes(search.toLocaleLowerCase('sv-SE')),
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const collisions = pendingImport?.filter((item) => exercises.some((exercise) => exercise.id === item.id)).length ?? 0;

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" aria-label="Planverket, till biblioteket" onClick={() => setActiveId(null)}>
          <span className="brand-mark"><img src="./icon.svg" alt="" /></span>
          <span>planverket<span className="brand-subtitle">INNEBANDY</span></span>
        </button>
        <nav className="header-nav" aria-label="Huvudmeny">
          <button className="nav-link" onClick={() => setActiveId(null)}><BookOpen size={17} />Övningsbibliotek</button>
          <button className="nav-link help-link" onClick={() => setHelp(true)}><HelpCircle size={17} />Så fungerar det</button>
        </nav>
        <InstallHelp onError={onError} />
      </header>
      <main>
        <Updates busy={!!activeId || dirty.current.size > 0} onError={onError} />
        {error && <div className="message error-message" role="alert"><span>{error}</span><button aria-label="Stäng felmeddelande" className="icon-button" onClick={() => setError('')}><X size={18} /></button></div>}
        {notice && <div className="message notice-message" role="status"><Check size={18} /><span>{notice}</span><button aria-label="Stäng meddelande" className="icon-button" onClick={() => setNotice('')}><X size={18} /></button></div>}
        {active ? <Editor key={active.id} initial={active} saveStatus={status} onChange={saveExercise} onClose={() => setActiveId(null)} onExport={(exercise, share) => void exportExercises([exercise], share)} /> : <>
          {!exercises.length ? <section className="hero">
            <div className="hero-copy">
              <span className="hero-kicker"><span />FRÅN IDÉ TILL TRÄNING</span>
              <h1>Bra träningar<br />börjar med en <em>plan.</em></h1>
              <p>Rita upp dina innebandyövningar, visa hur spelet rör sig och ta med hela laget på idén.</p>
              <div className="hero-actions">
                <button className="button primary large" disabled={loading} onClick={() => create()}><Plus size={19} />Skapa en övning</button>
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
          </section> : <section className="returning-heading"><div><p className="eyebrow">REDO FÖR NÄSTA TRÄNING?</p><h1>Dina idéer. Ditt spel.</h1></div><button className="button primary" onClick={() => create()}><Plus size={18} />Skapa en övning</button></section>}
          <section className="library" aria-labelledby="library-title">
            <div className="section-heading library-heading">
              <div><p className="eyebrow">SAMLA DINA SPELIDÉER</p><h2 id="library-title">Ditt övningsbibliotek <span className="count-badge">{exercises.length}</span></h2></div>
              <div className="library-actions">
                <button className="button secondary" disabled={loading} onClick={() => fileInput.current?.click()}><Upload size={17} />Importera</button>
                <button className="button secondary backup-button" disabled={!exercises.length} onClick={() => void exportExercises(exercises, false)}><ArrowDownToLine size={17} />Säkerhetskopiera</button>
              </div>
            </div>
            <div className="library-filters">
              <label className="search-field"><Search size={18} /><input type="search" aria-label="Sök övningar" placeholder="Sök bland dina övningar…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <div className="filter-field"><LayoutGrid size={16} /><select aria-label="Filtrera planstorlek" value={filter} onChange={(event) => setFilter(event.target.value === 'full' ? 'full' : event.target.value === 'half' ? 'half' : 'all')}><option value="all">Alla planer</option><option value="full">Helplan</option><option value="half">Halvplan</option></select><ChevronDown size={15} /></div>
            </div>
            {loading ? <div className="empty-library"><p role="status">Läser ditt bibliotek…</p></div> : !filtered.length ? <div className="empty-library">
              <span className="empty-library-icon"><FolderOpen size={31} strokeWidth={1.5} /></span>
              <h3>{exercises.length ? 'Ingen övning matchar sökningen' : 'Plats för dina bästa övningar'}</h3>
              <p>{exercises.length ? 'Prova ett annat sökord eller välj en annan planstorlek.' : 'Börja med en tom plan eller prova exemplet.\nDina sparade övningar samlas här.'}</p>
              {!exercises.length && <button className="button secondary" onClick={() => create()}><Plus size={17} />Skapa din första övning</button>}
            </div> : <div className="exercise-grid">
              {filtered.map((exercise) => <article className="exercise-card" key={exercise.id}>
                <button className="exercise-preview" aria-label={`Öppna ${exercise.name}`} onClick={() => setActiveId(exercise.id)}>
                  <Board court={exercise.court} objects={exercise.steps[0].objects} />
                  <span className="court-tag">{exercise.court === 'full' ? 'Helplan' : 'Halvplan'}</span>
                </button>
                <div className="exercise-card-body"><div className="exercise-card-meta"><span>{exercise.steps.length} steg</span><span>{dateFormat.format(new Date(exercise.updatedAt))}</span></div>
                  <button className="exercise-name" onClick={() => setActiveId(exercise.id)}>{exercise.name || 'Namnlös övning'}</button>
                  <p>{exercise.description || 'En ny spelidé att ta med till träningen.'}</p>
                  {dirty.current.has(exercise.id) && <span className="unsaved-label">Inte sparat på enheten – öppna eller exportera</span>}
                  <div className="card-actions">
                    <button className="text-button" onClick={() => setActiveId(exercise.id)}>Öppna<ArrowRight size={15} /></button>
                    <div><button className="icon-button" aria-label={`Duplicera ${exercise.name}`} onClick={() => create(duplicateExercise(exercise))}><Copy size={16} /></button>
                      <button className="icon-button" aria-label={`Exportera ${exercise.name}`} onClick={() => void exportExercises([exercise], false)}><Download size={16} /></button>
                      <button className="icon-button" aria-label={`Dela ${exercise.name}`} onClick={() => void exportExercises([exercise], true)}><Share2 size={16} /></button>
                      <button className="icon-button danger" aria-label={`Ta bort ${exercise.name}`} onClick={() => void remove(exercise)}><Trash2 size={16} /></button></div>
                  </div>
                </div>
              </article>)}
              <button className="new-exercise-card" onClick={() => create()}><span><Plus size={27} /></span><strong>En ny spelidé?</strong><span>Skapa en övning</span></button>
            </div>}
          </section>
          <div className="storage-note"><ShieldCheck size={20} /><p><strong>Dina övningar, på din enhet.</strong> Inget konto och ingen molnlagring. Exportera en säkerhetskopia – rensad webbläsardata kan annars ta bort dina övningar.</p></div>
        </>}
        <input ref={fileInput} className="visually-hidden" type="file" accept=".json,application/json" aria-label="Importera övningsfil" onChange={(event) => void readImport(event.target.files?.[0])} />
      </main>
      <footer className="site-footer"><span>planverket <span className="footer-divider">/</span> Mer spel. Mindre förklaring.</span><button className="footer-help" onClick={() => setHelp(true)}><HelpCircle size={14} />Så fungerar det</button><span className="connection-state">{online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? 'Ansluten' : 'Offline'}<span>·</span>Lokalt på din enhet</span></footer>
      {help && <Modal title="Från tom plan till tydlig övning" onClose={() => setHelp(false)}>
        <ol className="help-steps">
          <li><strong>Rita din startposition.</strong><p>Skapa en övning. Välj ett verktyg och tryck på planen. Dra objekten dit du vill ha dem.</p></li>
          <li><strong>Bygg rörelsen steg för steg.</strong><p>Kopiera till nästa steg och flytta spelare och boll. Samma objekt följer med, så att appen kan animera deras rörelse. Pilar och text förklarar – de styr inte animationen.</p></li>
          <li><strong>Visa laget hur det går till.</strong><p>Tryck Spela upp. Pausa, byt hastighet eller gå ett steg i taget.</p></li>
          <li><strong>Spara och dela.</strong><p>Ändringar sparas automatiskt när lokal lagring fungerar. Dela eller exportera en JSON-fil. Mottagaren öppnar sin egen app och väljer Importera.</p></li>
        </ol>
        <div className="info-box">Offline fungerar efter att appen har laddats färdigt med internet. Fildelning till andra appar kan kräva nät. Säkerhetskopiera regelbundet. Tangentbord: välj objekt i listan, fokusera planen och använd piltangenterna (Skift för större steg) eller Delete.</div>
      </Modal>}
      {pendingImport && <Modal title="Importera övningar" onClose={() => { if (!importBusy) setPendingImport(null); }}>
        <p>Filen innehåller <strong>{pendingImport.length} {pendingImport.length === 1 ? 'övning' : 'övningar'}</strong>.</p>
        <ul className="import-list">{pendingImport.map((exercise) => <li key={exercise.id}>{exercise.name}</li>)}</ul>
        {collisions > 0 ? <p>{collisions} övningar har samma ID som övningar i ditt bibliotek. Välj nya kopior för att behålla båda, eller ersätt de befintliga.</p> : <p>Importera som nya kopior, eller behåll filens ursprungliga ID för framtida uppdateringar.</p>}
        <div className="modal-actions"><button className="button primary" disabled={importBusy} onClick={() => void confirmImport('copy')}>Importera som kopior</button><button className="button secondary" disabled={importBusy} onClick={() => void confirmImport('replace')}>{collisions ? 'Ersätt befintliga' : 'Behåll ursprungliga ID'}</button></div>
        <p className="hint">Hela filen kontrolleras innan något sparas. Maximal filstorlek: 10 MB.</p>
      </Modal>}
    </div>
  );
}
