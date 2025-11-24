import { InvoiceData } from '@/types/invoice-types';

let _clonedData: InvoiceData | null = null;

export function setClonedData(data: InvoiceData) {
  _clonedData = data;
}

export function consumeClonedData(): InvoiceData | null {
  const data = _clonedData;
  _clonedData = null; // garante uso único
  return data;
}
