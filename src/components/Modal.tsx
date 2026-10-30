import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="modal" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="section-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Stäng dialog" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}
