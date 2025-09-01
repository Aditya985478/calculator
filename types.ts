export interface CalculationResult {
  total: number;
  category: string;
  items: { description: string; amount: number }[];
}

export interface HistoryItem {
  id: string;
  date: string;
  total: number;
  type: 'scan' | 'manual' | 'expense';
  
  // For manual calculations from the calculator keypad, or the sum of items for scans
  calculation?: string;

  // For manual expense entries
  description?: string;

  // For scans or manual expenses
  category?: string;
  imageDataUrl?: string;
}


export enum AppView {
  Calculator,
  History,
}