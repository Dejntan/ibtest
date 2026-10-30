import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number;
  min: number;
  max: number;
  integer?: boolean;
  onValue: (value: number) => void;
};

const parse = (text: string) => {
  const normalized = text.trim().replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) return NaN;
  return Number(normalized);
};

const format = (value: number) => String(value).replace('.', ',');

// Keeps a free-text draft while typing so intermediate values like "0" or "0," are allowed; clamps on blur.
export function NumberInput({ value, min, max, integer = false, onValue, onFocus, onBlur, onKeyDown, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const normalize = (n: number) => Math.min(max, Math.max(min, integer ? Math.round(n) : n));
  return <input
    {...rest}
    type="text"
    inputMode={integer ? 'numeric' : 'decimal'}
    autoComplete="off"
    value={draft ?? format(value)}
    onFocus={(event) => { setDraft(format(value)); onFocus?.(event); }}
    onChange={(event) => {
      setDraft(event.target.value);
      const parsed = parse(event.target.value);
      if (Number.isFinite(parsed) && parsed >= min && parsed <= max && (!integer || Number.isInteger(parsed)) && parsed !== value) onValue(parsed);
    }}
    onBlur={(event) => {
      const parsed = parse(event.target.value);
      if (Number.isFinite(parsed) && normalize(parsed) !== value) onValue(normalize(parsed));
      setDraft(null);
      onBlur?.(event);
    }}
    onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.blur();
      onKeyDown?.(event);
    }}
  />;
}
