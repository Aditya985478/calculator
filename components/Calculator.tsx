import React, { useState, useRef, useCallback, useEffect } from 'react';
import { HistoryItem, AppView, CalculationResult } from '../types';
import { processReceipt } from '../services/geminiService';
import Icon from './Icon';
import Spinner from './Spinner';
import CameraCapture from './CameraCapture';

interface CalculatorProps {
  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'date'>) => void;
  setActiveView: (view: AppView) => void;
  toggleTheme: () => void;
  theme: 'dark' | 'light';
  customCategories: string[];
  setCustomCategories: (value: string[] | ((val: string[]) => string[])) => void;
}

// Local types for the editable scan result screen
interface EditableItem {
  description: string;
  amount: string; // Stored as string for input flexibility
}
interface EditableScanResult {
  total: number;
  category: string;
  items: EditableItem[];
}

const parseSanitizedAmount = (value: string | number): number => {
    if (typeof value === 'number') {
        return isNaN(value) || !isFinite(value) ? 0 : value;
    }
    if (typeof value !== 'string') {
        return 0;
    }
    // Remove anything that isn't a digit, a decimal point, or a minus sign.
    const cleanedString = value.replace(/[^0-9.-]+/g, "");
    const parsed = parseFloat(cleanedString);
    return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
};


const Button: React.FC<{
  onClick?: () => void;
  label?: string;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}> = ({ onClick, label, className = '', children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`aspect-square rounded-full flex items-center justify-center text-3xl sm:text-4xl font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark focus:ring-white transition-transform duration-100 active:scale-95 disabled:opacity-50 ${className}`}
  >
    {children || label}
  </button>
);

const validateAndSanitizeScanResult = (rawResult: any): CalculationResult => {
    if (!rawResult || typeof rawResult !== 'object') {
        throw new Error("Invalid response format from AI. Expected an object.");
    }

    const items = Array.isArray(rawResult.items) ? rawResult.items : [];
    const sanitizedItems: { description: string; amount: number }[] = [];

    // Explicitly iterate and validate each item from the AI response.
    for (const item of items) {
        // 1. Ensure the item is a valid object.
        if (!item || typeof item !== 'object') {
            continue; // Skip non-object entries in the items array.
        }

        // 2. Sanitize and validate the 'amount'.
        const rawAmount = item.amount;
        let amount: number;

        if (typeof rawAmount === 'number' && isFinite(rawAmount)) {
            amount = rawAmount;
        } else if (typeof rawAmount === 'string') {
            const cleanedString = rawAmount.replace(/[^0-9.-]+/g, "");
            const parsed = parseFloat(cleanedString);
            if (!isNaN(parsed) && isFinite(parsed)) {
                amount = parsed;
            } else {
                continue; // Skip item if amount is an unparseable string.
            }
        } else {
            continue; // Skip item if amount is missing or has an invalid type.
        }

        // 3. Sanitize the 'description'.
        const description = String(item.description || 'Unnamed Item').trim();
        
        // 4. Add the sanitized item to the list.
        sanitizedItems.push({
            description: description,
            amount: parseFloat(amount.toFixed(2)),
        });
    }
    
    // Always recalculate the total from the sanitized items for accuracy.
    const total = sanitizedItems.reduce((sum, item) => sum + item.amount, 0);

    return {
        items: sanitizedItems,
        total: parseFloat(total.toFixed(2)),
        category: String(rawResult.category || 'Uncategorized').trim(),
    };
};


const Calculator: React.FC<CalculatorProps> = ({ addHistoryItem, setActiveView, toggleTheme, theme, customCategories, setCustomCategories }) => {
  const [displayValue, setDisplayValue] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(true);
  const [calculationString, setCalculationString] = useState('');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isCameraViewOpen, setIsCameraViewOpen] = useState<boolean>(false);

  const [scanResult, setScanResult] = useState<CalculationResult | null>(null);
  const [editableResult, setEditableResult] = useState<EditableScanResult | null>(null);

  const [isScanDetailsVisible, setIsScanDetailsVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isScientific, setIsScientific] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');

  const triggerHaptic = (pattern: number | number[] = 10) => {
    if (window.navigator && 'vibrate' in window.navigator) {
      try {
        window.navigator.vibrate(pattern);
      } catch (e) {
        console.warn("Haptic feedback failed.", e);
      }
    }
  };

  const handleCalculationError = () => {
    setDisplayValue('Error');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(true);
    setCalculationString('');
  };

  const clearAll = useCallback(() => {
    setDisplayValue('0');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(true);
    setCalculationString('');
  }, []);

  const clearEntry = () => {
    if (displayValue === 'Error') {
        clearAll();
        return;
    }
    setDisplayValue('0');
  };

  const toggleSign = () => {
    if (displayValue === 'Error') return;
    const currentValue = parseFloat(displayValue);
    if (currentValue !== 0) {
      setDisplayValue(String(currentValue * -1));
    }
  };

  const backspace = () => {
    if (displayValue === 'Error' || waitingForOperand) return;
    if (displayValue.length > 1) {
      setDisplayValue(displayValue.slice(0, -1));
    } else {
      setDisplayValue('0');
    }
  };

  const inputDigit = (digit: string) => {
    if (displayValue === 'Error') {
      setDisplayValue(digit);
      setWaitingForOperand(false);
      return;
    }
    if (waitingForOperand) {
      setDisplayValue(digit);
      setWaitingForOperand(false);
    } else {
      if (displayValue.length >= 15) return;
      setDisplayValue(displayValue === '0' ? digit : displayValue + digit);
    }
  };

  const inputDecimal = () => {
    if (displayValue === 'Error') return;
    if (waitingForOperand) {
        setDisplayValue('0.');
        setWaitingForOperand(false);
    } else if (!displayValue.includes('.')) {
      setDisplayValue(displayValue + '.');
    }
  };

  const inputPercent = () => {
    if (displayValue === 'Error') return;
    const currentValue = parseFloat(displayValue);
    const result = currentValue / 100;
    setDisplayValue(String(result));
  };
  
  const performOperation = (nextOperator: string) => {
    if (displayValue === 'Error') return;
    const inputValue = parseFloat(displayValue);
    
    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const result = calculate(previousValue, inputValue, operator);
      if (!isFinite(result)) {
        handleCalculationError();
        return;
      }
      setPreviousValue(result);
      setDisplayValue(String(result));
    }
    
    setWaitingForOperand(true);
    setOperator(nextOperator);
    setCalculationString(`${inputValue} ${nextOperator}`);
  };

  const performUnaryOperation = (operation: string) => {
    if (displayValue === 'Error') return;
    const currentValue = parseFloat(displayValue);
    let result = 0;
    
    // Using DEG for trig functions, converting to radians for Math lib
    switch (operation) {
        case 'sq': result = Math.pow(currentValue, 2); break;
        case 'sqrt': result = Math.sqrt(currentValue); break;
        case 'sin': result = Math.sin(currentValue * Math.PI / 180); break;
        case 'cos': result = Math.cos(currentValue * Math.PI / 180); break;
        case 'tan': result = Math.tan(currentValue * Math.PI / 180); break;
        case 'log': result = Math.log10(currentValue); break;
        case 'ln': result = Math.log(currentValue); break;
        default: return;
    }

    if (!isFinite(result)) {
        handleCalculationError();
        return;
    }

    setDisplayValue(String(result));
    setWaitingForOperand(true);
  };

  const inputConstant = (constant: 'pi' | 'e') => {
    if (displayValue === 'Error') {
        clearAll();
    }
    const value = constant === 'pi' ? Math.PI : Math.E;
    setDisplayValue(String(value));
    setWaitingForOperand(false);
  };

  const calculate = (prev: number, current: number, op: string) => {
    switch (op) {
      case '+': return prev + current;
      case '-': return prev - current;
      case '×': return prev * current;
      case '÷': return prev / current; // Let it return Infinity or -Infinity
      case 'x^y': return Math.pow(prev, current);
      default: return current;
    }
  };

  const handleEquals = () => {
    if (operator && previousValue !== null) {
      const inputValue = parseFloat(displayValue);
      const result = calculate(previousValue, inputValue, operator);

      if (!isFinite(result)) {
        handleCalculationError();
        return;
      }
      
      const fullCalculation = `${previousValue} ${operator} ${inputValue}`;
      addHistoryItem({ type: 'manual', total: result, calculation: fullCalculation });

      setDisplayValue(String(result));
      setPreviousValue(null);
      setOperator(null);
      setWaitingForOperand(true);
      setCalculationString(`${fullCalculation} =`);
    }
  };
  
  const handleKeyPress = useCallback((key: string) => {
      if (isScannerOpen || isScanDetailsVisible || isCameraViewOpen) {
        if (key === 'Escape') {
            setIsScannerOpen(false);
            setIsCameraViewOpen(false);
            if(isScanDetailsVisible) handleDiscardScan();
        }
        return;
      }

      if (/\d/.test(key)) {
        inputDigitWithHaptic(key);
      } else if (key === '.') {
        inputDecimalWithHaptic();
      } else if (key === '+') {
        performOperationWithHaptic('+');
      } else if (key === '-') {
        performOperationWithHaptic('-');
      } else if (key === '*') {
        performOperationWithHaptic('×');
      } else if (key === '/') {
        performOperationWithHaptic('÷');
      } else if (key === '%') {
        inputPercentWithHaptic();
      } else if (key === '^') {
        performOperationWithHaptic('x^y');
      } else if (key === 'Enter' || key === '=') {
        handleEqualsWithHaptic();
      } else if (key === 'Backspace') {
        backspaceWithHaptic();
      } else if (key.toLowerCase() === 'c' || key === 'Escape') {
        clearAllWithHaptic();
      }
  }, [isScannerOpen, isScanDetailsVisible, isCameraViewOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore key presses with modifier keys to avoid interfering with browser shortcuts
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      // Map physical keys to calculator actions, including Numpad support.
      const keyMap: { [key: string]: string } = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
        'Numpad0': '0', 'Numpad1': '1', 'Numpad2': '2', 'Numpad3': '3', 'Numpad4': '4', 'Numpad5': '5', 'Numpad6': '6', 'Numpad7': '7', 'Numpad8': '8', 'Numpad9': '9',
        '+': '+', 'NumpadAdd': '+',
        '-': '-', 'NumpadSubtract': '-',
        '*': '*', 'NumpadMultiply': '*',
        '/': '/', 'NumpadDivide': '/',
        '%': '%',
        '.': '.', 'NumpadDecimal': '.',
        '=': '=', 'Enter': '=',
        '^': '^',
        'Backspace': 'Backspace',
        'c': 'c', 'C': 'c', // Normalize to lowercase 'c'
        'Escape': 'Escape',
      };

      const mappedKey = keyMap[event.key];

      if (mappedKey) {
        event.preventDefault();
        handleKeyPress(mappedKey);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyPress]);

  // --- Haptic-wrapped functions ---
  const clearAllWithHaptic = () => { triggerHaptic([10, 30, 10]); clearAll(); };
  const clearEntryWithHaptic = () => { triggerHaptic([10, 30, 10]); clearEntry(); };
  const toggleSignWithHaptic = () => { triggerHaptic([10, 30, 10]); toggleSign(); };
  const inputPercentWithHaptic = () => { triggerHaptic([10, 30, 10]); inputPercent(); };
  const backspaceWithHaptic = () => { triggerHaptic([10, 30, 10]); backspace(); };
  const performUnaryOperationWithHaptic = (op: string) => { triggerHaptic(15); performUnaryOperation(op); };
  const inputConstantWithHaptic = (c: 'pi'|'e') => { triggerHaptic(10); inputConstant(c); };
  const inputDigitWithHaptic = (digit: string) => { triggerHaptic(10); inputDigit(digit); };
  const inputDecimalWithHaptic = () => { triggerHaptic(10); inputDecimal(); };
  const performOperationWithHaptic = (op: string) => { triggerHaptic(15); performOperation(op); };
  const handleEqualsWithHaptic = () => { triggerHaptic(30); handleEquals(); };
  
  const processImage = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    const readFileAsDataURL = (imageFile: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(new Error("Could not read image file."));
        reader.readAsDataURL(imageFile);
      });
    };

    try {
      const dataUrl = await readFileAsDataURL(file);
      setImageDataUrl(dataUrl);
      
      const rawResult = await processReceipt(file);
      const sanitizedResult = validateAndSanitizeScanResult(rawResult);

      if (sanitizedResult.items.length === 0 || sanitizedResult.total <= 0) {
        throw new Error("Could not detect any valid line items or amounts on the receipt.");
      }

      setScanResult(sanitizedResult);
      setEditableResult({
        ...sanitizedResult,
        items: sanitizedResult.items.map(item => ({
            description: item.description,
            amount: String(item.amount.toFixed(2))
        }))
      });
      setIsScanDetailsVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      setImageDataUrl(null);
    } finally {
      setIsLoading(false);
      setIsScannerOpen(false);
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImage(file);
    }
    event.target.value = '';
  };
  
    const handleConfirmScan = () => {
        if (editableResult && editableResult.items.length > 0) {
            const total = editableResult.total;
            const calculationExpression = editableResult.items
                .map(item => parseSanitizedAmount(item.amount))
                .join(' + ');

            setDisplayValue(String(total));
            setCalculationString(`${calculationExpression} =`);
            setPreviousValue(null);
            setOperator(null);
            setWaitingForOperand(true);
            
            const finalCategory = editableResult.category.trim();
            if (finalCategory && !customCategories.find(c => c.toLowerCase() === finalCategory.toLowerCase())) {
                setCustomCategories(prev => [...prev, finalCategory].sort());
            }

            addHistoryItem({
                type: 'scan',
                total: total,
                category: finalCategory,
                imageDataUrl: imageDataUrl ?? undefined,
                calculation: calculationExpression,
            });
        }
        setIsScanDetailsVisible(false);
        setScanResult(null);
        setEditableResult(null);
        setImageDataUrl(null);
    };

    const handleDiscardScan = () => {
        setIsScanDetailsVisible(false);
        setScanResult(null);
        setEditableResult(null);
        setImageDataUrl(null);
        clearAll();
    };

    const handleEditableResultUpdate = (updatedResult: EditableScanResult) => {
        const newTotal = updatedResult.items.reduce((sum, item) => {
            const amount = parseSanitizedAmount(item.amount);
            return sum + amount;
        }, 0);

        setEditableResult({
            ...updatedResult,
            total: parseFloat(newTotal.toFixed(2))
        });
    };

    const handleItemChange = (index: number, field: 'description' | 'amount', value: string) => {
        if (!editableResult) return;
        const newItems = [...editableResult.items];
        newItems[index] = { ...newItems[index], [field]: value };
        handleEditableResultUpdate({ ...editableResult, items: newItems });
    };

    const handleAddItem = () => {
        if (!editableResult) return;
        const newItems = [...editableResult.items, { description: '', amount: '0.00' }];
        handleEditableResultUpdate({ ...editableResult, items: newItems });
    };

    const handleRemoveItem = (index: number) => {
        if (!editableResult) return;
        const newItems = editableResult.items.filter((_, i) => i !== index);
        handleEditableResultUpdate({ ...editableResult, items: newItems });
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editableResult) return;
        setEditableResult({ ...editableResult, category: e.target.value });
    };
    
    const handleCategoryInputBlur = () => {
        if (!editableResult) return;
        const newCategory = editableResult.category.trim();
        // Check if it's a non-empty string and not already in the list (case-insensitive)
        if (newCategory && !customCategories.some(c => c.toLowerCase() === newCategory.toLowerCase())) {
            setCustomCategories(prev => [...prev, newCategory].sort());
        }
    };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount);
    if (!expenseAmount || isNaN(amount) || amount <= 0) {
        alert('Please enter a valid, positive amount.');
        return;
    }
    if (!expenseCategory.trim()) {
        alert('Please select or enter a category.');
        return;
    }

    addHistoryItem({
        type: 'expense',
        total: amount,
        description: expenseDescription.trim() || undefined,
        category: expenseCategory.trim(),
    });

    const newCat = expenseCategory.trim();
    if (newCat && !customCategories.some(c => c.toLowerCase() === newCat.toLowerCase())) {
        setCustomCategories(prev => [...prev, newCat].sort());
    }

    setIsAddModalOpen(false);
    setExpenseAmount('');
    setExpenseDescription('');
    setExpenseCategory('');
  }

  const formattedValue = () => {
    if (!isFinite(parseFloat(displayValue))) return "Error";
    const [integer, decimal] = displayValue.split('.');
    const formattedInteger = parseFloat(integer).toLocaleString('en-US', { maximumFractionDigits: 0 });
    return decimal ? `${formattedInteger}.${decimal}` : formattedInteger;
  };

  const getDisplayStyle = (text: string): React.CSSProperties => {
    const digitCount = text.replace(/,/g, '').length;
    // Refined parameters for smoother and earlier scaling to improve readability.
    const baseSizeRem = 5.5;
    const minSizeRem = 2.5;
    const shrinkThreshold = 6;
    const shrinkFactor = 0.4;

    const reduction = Math.max(0, digitCount - shrinkThreshold) * shrinkFactor;
    
    const finalSize = Math.max(minSizeRem, baseSizeRem - reduction);

    return { fontSize: `${finalSize}rem` };
  };

  const standardButtons = [
    {
      id: 'clear',
      type: 'light',
      onClick: () => {
        const isAC = !operator && waitingForOperand;
        if (isAC) {
          clearAllWithHaptic();
        } else {
          clearEntryWithHaptic();
        }
      },
      dynamicLabel: () => !operator && waitingForOperand ? 'AC' : 'C'
    },
    { id: 'backspace', type: 'light', onClick: backspaceWithHaptic, icon: 'backspace' },
    { id: 'percent', label: '%', type: 'light', onClick: inputPercentWithHaptic },
    { id: 'divide', label: '÷', type: 'orange', onClick: () => performOperationWithHaptic('÷') },
    { id: '7', label: '7', type: 'dark', onClick: () => inputDigitWithHaptic('7') },
    { id: '8', label: '8', type: 'dark', onClick: () => inputDigitWithHaptic('8') },
    { id: '9', label: '9', type: 'dark', onClick: () => inputDigitWithHaptic('9') },
    { id: 'multiply', label: '×', type: 'orange', onClick: () => performOperationWithHaptic('×') },
    { id: '4', label: '4', type: 'dark', onClick: () => inputDigitWithHaptic('4') },
    { id: '5', label: '5', type: 'dark', onClick: () => inputDigitWithHaptic('5') },
    { id: '6', label: '6', type: 'dark', onClick: () => inputDigitWithHaptic('6') },
    { id: 'subtract', label: '-', type: 'orange', onClick: () => performOperationWithHaptic('-') },
    { id: '1', label: '1', type: 'dark', onClick: () => inputDigitWithHaptic('1') },
    { id: '2', label: '2', type: 'dark', onClick: () => inputDigitWithHaptic('2') },
    { id: '3', label: '3', type: 'dark', onClick: () => inputDigitWithHaptic('3') },
    { id: 'add', label: '+', type: 'orange', onClick: () => performOperationWithHaptic('+') },
    { id: 'toggleSign', label: '+/-', type: 'light', onClick: toggleSignWithHaptic },
    { id: '0', label: '0', type: 'dark', onClick: () => inputDigitWithHaptic('0') },
    { id: 'decimal', label: '.', type: 'dark', onClick: inputDecimalWithHaptic },
    { id: 'equals', label: '=', type: 'orange', onClick: handleEqualsWithHaptic },
  ] as const;

  const scientificButtons = [
    { id: 'sq', label: 'x²', type: 'dark', onClick: () => performUnaryOperationWithHaptic('sq') },
    { id: 'pow', label: 'xʸ', type: 'dark', onClick: () => performOperationWithHaptic('x^y') },
    { id: 'sin', label: 'sin', type: 'dark', onClick: () => performUnaryOperationWithHaptic('sin') },
    { id: 'cos', label: 'cos', type: 'dark', onClick: () => performUnaryOperationWithHaptic('cos') },
    { id: 'log', label: 'log', type: 'dark', onClick: () => performUnaryOperationWithHaptic('log') },
    { id: 'ln', label: 'ln', type: 'dark', onClick: () => performUnaryOperationWithHaptic('ln') },
    { id: 'sqrt', label: '√', type: 'dark', onClick: () => performUnaryOperationWithHaptic('sqrt') },
    { id: 'pi', label: 'π', type: 'dark', onClick: () => inputConstantWithHaptic('pi') },
    { id: 'e', label: 'e', type: 'dark', onClick: () => inputConstantWithHaptic('e') },
    { id: 'tan', label: 'tan', type: 'dark', onClick: () => performUnaryOperationWithHaptic('tan') },
  ] as const;

  const buttonClassMap = {
    light: 'bg-key-light-light dark:bg-key-light-dark text-text-on-light-light dark:text-text-on-light-dark hover:bg-key-light-hover-light dark:hover:bg-key-light-hover-dark',
    dark: 'bg-key-dark-light dark:bg-key-dark-dark text-text-on-dark-light dark:text-text-on-dark-dark hover:bg-key-dark-hover-light dark:hover:bg-key-dark-hover-dark',
    orange: 'bg-key-orange-light dark:bg-key-orange-dark text-text-on-orange-light dark:text-text-on-orange-dark hover:bg-key-orange-hover-light dark:hover:bg-key-orange-hover-dark text-4xl sm:text-5xl',
  };

  return (
    <div className={`w-full ${isScientific ? 'max-w-xl' : 'max-w-sm'} mx-auto h-full flex flex-col p-2 sm:p-4 bg-background-light dark:bg-background-dark transition-all duration-300`}>
      <div className="flex justify-between items-center p-2">
        <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-full text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-key-dark">
              <Icon icon={theme === 'dark' ? 'sun' : 'moon'} className="w-7 h-7" />
            </button>
            <button onClick={() => setIsScientific(s => !s)} className={`p-2 rounded-full hover:bg-gray-200 dark:hover:bg-key-dark ${isScientific ? 'text-key-orange-dark' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}>
                <Icon icon="beaker" className="w-7 h-7" />
            </button>
            <button onClick={() => setIsAddModalOpen(true)} className="p-2 rounded-full text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-key-dark" aria-label="Add manual expense">
                <Icon icon="edit" className="w-7 h-7" />
            </button>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => { setIsScannerOpen(true); setError(null); }} className="p-2 rounded-full text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-key-dark">
            <Icon icon="camera" className="w-7 h-7" />
          </button>
          <button onClick={() => setActiveView(AppView.History)} className="p-2 rounded-full text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-key-dark">
            <Icon icon="history" className="w-7 h-7" />
          </button>
        </div>
      </div>
      
      <div className="flex-grow flex flex-col justify-end text-text-display-light dark:text-text-display-dark mb-4 px-2">
        <div className="h-10 text-right text-2xl font-light text-text-display-secondary-light dark:text-text-display-secondary-dark mb-2 truncate">
          {calculationString || ' '}
        </div>
        <div 
          style={getDisplayStyle(formattedValue())}
          className="w-full text-right font-bold tracking-tight break-all transition-all duration-200 leading-none"
        >
          {formattedValue()}
        </div>
      </div>
      
       {isScanDetailsVisible && editableResult && (
        <div className="mb-4 p-4 rounded-lg bg-surface-light dark:bg-surface-dark flex flex-col gap-3 transition-all duration-300 ease-in-out">
            <div className="flex justify-between items-center text-left">
                <div className="flex items-baseline gap-3">
                    <h3 className="font-bold text-lg text-text-primary-light dark:text-text-primary-dark">Scan Total:</h3>
                    <p className="font-mono text-2xl font-bold text-text-primary-light dark:text-text-primary-dark tracking-tight">
                        {editableResult.total.toFixed(2)}
                    </p>
                </div>
                 <div className="flex items-center">
                    <input
                        list="category-suggestions"
                        type="text"
                        value={editableResult.category}
                        onChange={handleCategoryChange}
                        onBlur={handleCategoryInputBlur}
                        placeholder="Category"
                        className="text-sm bg-key-dark-light dark:bg-key-dark-dark text-text-on-dark-light dark:text-on-dark-dark px-3 py-1 rounded-full w-40 text-left focus:outline-none focus:ring-2 focus:ring-key-orange transition-all"
                    />
                    <datalist id="category-suggestions">
                        {customCategories.map(cat => <option key={cat} value={cat} />)}
                    </datalist>
                </div>
            </div>

            <div className="space-y-2 pr-2 text-sm pt-3 border-t border-border-light dark:border-border-dark mt-2 max-h-40 overflow-y-auto">
                {editableResult.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-text-primary-light dark:text-text-primary-dark pt-1">
                        <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            placeholder="Item description"
                            className="flex-grow bg-transparent border-b border-border-light dark:border-border-dark focus:outline-none focus:border-key-orange py-1"
                        />
                        <input
                            type="text"
                            inputMode="decimal"
                            value={item.amount}
                            onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                            placeholder="0.00"
                            className="w-24 bg-transparent border-b border-border-light dark:border-border-dark text-right font-mono focus:outline-none focus:border-key-orange py-1"
                        />
                        <button onClick={() => handleRemoveItem(index)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-key-dark-dark" aria-label="Remove item">
                            <Icon icon="trash" className="w-4 h-4 text-red-500" />
                        </button>
                    </div>
                ))}
            </div>

            <button
                onClick={handleAddItem}
                className="w-full text-sm py-1.5 mt-2 rounded-lg border-2 border-dashed border-key-orange-light dark:border-key-orange-dark text-key-orange-light dark:text-key-orange-dark hover:bg-key-orange hover:text-text-on-orange transition-colors"
            >
                + Add Item
            </button>

            <div className="grid grid-cols-2 gap-3 mt-2">
                <button onClick={handleDiscardScan} className="w-full py-2 rounded-lg bg-key-light-light dark:bg-key-light-dark text-text-on-light font-semibold">Discard</button>
                <button onClick={handleConfirmScan} className="w-full py-2 rounded-lg bg-key-orange text-text-on-orange font-semibold">Confirm Total</button>
            </div>
        </div>
      )}

      <div className={`flex gap-4 sm:gap-5 transition-opacity duration-300 ${isScanDetailsVisible ? 'opacity-25 pointer-events-none' : ''}`}>
        {isScientific && (
             <div className="grid grid-cols-2 gap-4 sm:gap-5">
                {scientificButtons.map(btn => (
                    <Button
                        key={btn.id}
                        onClick={btn.onClick}
                        className={buttonClassMap[btn.type]}
                        label={btn.label}
                    />
                ))}
             </div>
        )}
        <div className={`grid grid-cols-4 gap-4 sm:gap-5 ${isScientific ? 'w-2/3' : 'w-full'}`}>
            {standardButtons.map(btn => {
              const content = 'dynamicLabel' in btn ? (btn as any).dynamicLabel() : 'label' in btn ? btn.label : null;
              return (
                <Button
                  key={btn.id}
                  onClick={btn.onClick}
                  className={buttonClassMap[btn.type]}
                >
                  {'icon' in btn ? <Icon icon={btn.icon} className="w-8 h-8 mx-auto" /> : content}
                </Button>
              )
            })}
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <div id="container-ddf6db119bda9bc8128968b958248a5b"></div>
      </div>

      {