'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { COUNTRIES } from '@/lib/countries';

// Autocomplete de país (2026-07-05): o campo "País" era texto livre em toda
// a app -- o utilizador tinha de escrever o nome exato, sem ajuda nem lista.
// Este componente permite escrever parte do nome (com ou sem acentos) e
// filtrar, ou abrir a lista completa através do botão. Devolve o evento no
// mesmo formato de um <input> normal (target.name/target.value), para
// encaixar nos handlers genéricos já existentes (handleChange,
// handleInputChange) sem precisar de um caminho especial.

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

interface CountryAutocompleteProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: { target: { name: string; value: string } }) => void;
  onBlur?: (e: { target: { name: string; value: string } }) => void;
  error?: string;
  required?: boolean;
  halfWidth?: boolean;
  disabled?: boolean;
}

export const CountryAutocomplete: React.FC<CountryAutocompleteProps> = ({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  required,
  halfWidth,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const normalizedQuery = normalize(value);
    const list = normalizedQuery
      ? COUNTRIES.filter(country => normalize(country).includes(normalizedQuery))
      : COUNTRIES;
    return list.slice(0, 50);
  }, [value]);

  const selectCountry = useCallback((country: string) => {
    onChange({ target: { name: id, value: country } });
    setIsOpen(false);
  }, [id, onChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ target: { name: id, value: e.target.value } });
    setIsOpen(true);
  }, [id, onChange]);

  const handleBlur = useCallback(() => {
    // Pequeno atraso para o clique numa opção da lista registar antes do
    // dropdown fechar (blur do input dispara antes do click do item).
    setTimeout(() => setIsOpen(false), 150);
    if (onBlur) onBlur({ target: { name: id, value } });
  }, [id, value, onBlur]);

  return (
    <div className={`${halfWidth ? 'w-full md:w-1/2' : 'w-full'} px-2 mb-3 relative`} ref={containerRef}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          id={id}
          name={id}
          autoComplete="off"
          className={`w-full p-2 pr-9 border rounded text-sm ${error ? 'border-red-500' : 'border-gray-300'} ${disabled ? 'bg-gray-100 opacity-50 cursor-not-allowed' : ''}`}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          placeholder="Digite ou escolha um país"
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          onClick={() => setIsOpen(prev => !prev)}
          disabled={disabled}
          aria-label="Mostrar lista de países"
        >
          <FiChevronDown size={16} />
        </button>
        {isOpen && matches.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg text-sm">
            {matches.map(country => (
              <li
                key={country}
                className="px-3 py-2 cursor-pointer hover:bg-blue-50"
                onMouseDown={() => selectCountry(country)}
              >
                {country}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
    </div>
  );
};
