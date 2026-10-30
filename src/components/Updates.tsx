import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, WifiOff } from 'lucide-react';

export function Updates({ busy, onError }: { busy: boolean; onError: (message: string) => void }) {
  const { offlineReady: [offlineReady, setOfflineReady], needRefresh: [refresh, setRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError: () => onError('Offlinefunktionen kunde inte aktiveras. Anslut till internet och ladda om när ditt arbete är sparat.'),
  });
  useEffect(() => {
    if (!offlineReady || refresh) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 5000);
    return () => window.clearTimeout(timer);
  }, [offlineReady, refresh, setOfflineReady]);
  if (!offlineReady && !refresh) return null;
  return <div className="update-banner" role="status">
    {refresh ? <RefreshCw size={17} /> : <WifiOff size={17} />}
    <span>{refresh ? (busy ? 'En ny version finns. Spara och gå till biblioteket för att uppdatera.' : 'En ny version av appen finns.') : 'Redo för offline. Appen kan nu öppnas utan internet.'}</span>
    {refresh && !busy && <button className="button secondary" onClick={() => { void updateServiceWorker(true).catch(() => onError('Kunde inte uppdatera appen. Försök igen när arbetet är sparat.')); }}>Uppdatera</button>}
    <button className="text-button" onClick={() => { setOfflineReady(false); setRefresh(false); }}>Stäng</button>
  </div>;
}
