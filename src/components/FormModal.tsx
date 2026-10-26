import { FormEvent } from 'react';
import { X } from 'lucide-react';

type Field =
  | { name: string; label: string; type?: 'text' | 'email' | 'number' | 'datetime-local'; required?: boolean; placeholder?: string; defaultValue?: string | number; options?: undefined; step?: string; min?: string }
  | { name: string; label: string; type: 'select'; required?: boolean; defaultValue?: string; options: string[]; placeholder?: undefined; step?: undefined; min?: undefined };

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  fields: Field[];
  submitLabel: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
};

export function FormModal({ open, title, subtitle, fields, submitLabel, onClose, onSubmit }: Props) {
  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const field of fields) {
      const raw = data.get(field.name);
      values[field.name] = raw === null ? '' : String(raw);
    }
    await onSubmit(values);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        {subtitle && <span className="section-kicker">{subtitle}</span>}
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          {fields.map((field) => (
            <label key={field.name}>
              <span>{field.label}</span>
              {field.type === 'select' ? (
                <select name={field.name} defaultValue={field.defaultValue} required={field.required}>
                  {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type ?? 'text'}
                  required={field.required}
                  placeholder={field.placeholder}
                  defaultValue={field.defaultValue}
                  step={field.step}
                  min={field.min}
                />
              )}
            </label>
          ))}
          <button className="primary-button full-width" type="submit">{submitLabel}</button>
        </form>
      </div>
    </div>
  );
}
