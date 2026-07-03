'use client';

import { FaCheck, FaMobileAlt, FaWallet } from 'react-icons/fa';
import { SiVisa, SiMastercard } from 'react-icons/si';

export interface PaymentMethodOption {
  id: string;
  name: string;
  description: string;
}

// Visual de cada método, partilhado entre o checkout de documentos
// (PaymentForm.tsx) e a página de assinatura (/pages/subscription) para não
// haver duas versões a divergir. Cartão usa os ícones reais da Visa/
// Mastercard (react-icons/si -- uso padrão em checkouts para indicar redes
// aceites). Não há ícone de marca disponível para M-Pesa nem e-Mola nesta
// biblioteca (nem temos assets licenciados delas), por isso usamos um ícone
// genérico com a cor aproximada de cada marca (M-Pesa vermelho, e-Mola verde
// #00A651 da Movitel) em vez de reproduzir um logótipo que não é o correto.
const METHOD_VISUALS: Record<string, { renderIcon: () => React.ReactNode }> = {
  mpesa: { renderIcon: () => <FaMobileAlt className="text-xl text-red-500" /> },
  emola: { renderIcon: () => <FaWallet className="text-xl" style={{ color: '#00A651' }} /> },
  credit_card: {
    renderIcon: () => (
      <div className="flex items-center gap-1">
        <SiVisa className="text-lg" color="#1A1F71" />
        <SiMastercard className="text-lg" color="#EB001B" />
      </div>
    )
  }
};

const DEFAULT_VISUAL = METHOD_VISUALS.credit_card;

export const PaymentMethodPicker: React.FC<{
  methods: PaymentMethodOption[];
  selectedMethod: string | null;
  onSelect: (methodId: string) => void;
}> = ({ methods, selectedMethod, onSelect }) => {
  return (
    <div className="space-y-3">
      {methods.map((method) => {
        const visual = METHOD_VISUALS[method.id] ?? DEFAULT_VISUAL;
        const isSelected = selectedMethod === method.id;

        return (
          <button
            key={method.id}
            type="button"
            onClick={() => onSelect(method.id)}
            className={`w-full flex items-center gap-4 text-left rounded-2xl p-4 transition-all duration-200 ${
              isSelected
                ? 'bg-blue-50 border-2 border-blue-400 shadow-md shadow-blue-100'
                : 'bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-white shadow-md shadow-black/5 flex items-center justify-center flex-shrink-0">
              {visual.renderIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-800">{method.name}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-snug">{method.description}</div>
            </div>
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                isSelected ? 'bg-blue-500 text-white' : 'bg-transparent border-2 border-gray-200'
              }`}
            >
              {isSelected && <FaCheck className="text-[11px]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
};
