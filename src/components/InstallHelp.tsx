import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { Modal } from './Modal';
import { errorMessage } from '../domain/model';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallHelp({ onError }: { onError: (message: string) => void }) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(() => matchMedia('(display-mode: standalone)').matches);
  useEffect(() => {
    const before = (value: Event) => { value.preventDefault(); setEvent(value as InstallEvent); };
    const done = () => { setEvent(null); setInstalled(true); };
    window.addEventListener('beforeinstallprompt', before);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', done); };
  }, []);

  async function install() {
    if (!event) { setShow(true); return; }
    try { await event.prompt(); await event.userChoice; setEvent(null); }
    catch (error) { onError(`Installationen kunde inte startas: ${errorMessage(error)}`); setShow(true); }
  }
  return <>
    <button className="button install-button secondary" onClick={() => void install()}><Smartphone size={17} /><span>{installed ? 'Apphjälp' : 'Installera app'}</span></button>
    {show && <Modal title="Din taktiktavla, i fickan." onClose={() => setShow(false)}>
      <div className="install-illustration"><Smartphone size={40} /><Download size={22} /></div>
      <p>Installera Planverket på hemskärmen – utan appbutik och utan konto.</p>
      <h3>iPhone / iPad</h3><p>Öppna appens webbadress i <strong>Safari</strong>. Tryck på <strong>Dela</strong>, välj <strong>Lägg till på hemskärmen</strong> och bekräfta.</p>
      <h3>Android</h3><p>Öppna i <strong>Chrome</strong>. Välj <strong>Installera app</strong> eller <strong>Lägg till på startskärmen</strong> i webbläsarens meny.</p>
      <div className="info-box">Besök appen med internet först så att den kan sparas för offlinebruk. Installation kräver en HTTPS-adress (eller localhost vid utveckling).</div>
      <h3>Det här sparas på din telefon</h3><p>Övningarna ligger bara i den här webbläsaren och på den här webbplatsadressen. De synkas inte till andra enheter. Rensas webbläsardata kan övningarna försvinna – exportera regelbundet en säkerhetskopia.</p>
    </Modal>}
  </>;
}
