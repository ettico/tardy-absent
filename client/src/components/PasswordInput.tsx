import { useState } from 'react';

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
  placeholder?: string;
}

export default function PasswordInput({ id, value, onChange, required, minLength, autoFocus, placeholder }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input-wrap">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        autoFocus={autoFocus}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'הסתרת סיסמה' : 'הצגת סיסמה'}
        tabIndex={-1}
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
