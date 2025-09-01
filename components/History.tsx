import React, { useState } from 'react';
import { HistoryItem, AppView } from '../types';
import Icon from './Icon';

interface HistoryProps {
  history: HistoryItem[];
  setHistory: (value: HistoryItem[] | ((val: HistoryItem[]) => HistoryItem[])) => void;
  setActiveView: (view: AppView) => void;
  customCategories: string[];
  setCustomCategories: (value: string[] | ((val: string[]) => string[])) => void;
}

const formatHistoryDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

  const timeString = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (date >= startOfToday) {
    return `Today, ${timeString}`;
  } else if (date >= startOfYesterday) {
    return `Yesterday, ${timeString}`;
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};


const History: React.FC<HistoryProps> = ({ history, setHistory, setActiveView, customCategories, setCustomCategories }) => {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const clearHistory = () => {
      if(window.confirm("Are you sure you want to clear all calculation history? This action cannot be undone.")) {
          setHistory([]);
      }
  };

  const exportToCSV = () => {
    if (history.length === 0) return;

    const headers = ['ID', 'Date', 'Type', 'Total', 'Description', 'Calculation', 'Category'];
    
    const escapeCSV = (field: any): string => {
        if (field === null || field === undefined) {
            return '';
        }
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvRows = [headers.join(',')];

    // Using a reversed copy of history to export from oldest to newest
    const reversedHistory = [...history].reverse();

    reversedHistory.forEach(item => {
        const row = [
            escapeCSV(item.id),
            escapeCSV(item.date),
            escapeCSV(item.type),
            escapeCSV(item.total),
            escapeCSV(item.description || ''),
            escapeCSV(item.calculation || ''),
            escapeCSV(item.category || ''),
        ];
        csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'calculation-history.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRenameCategory = (oldName: string) => {
    const newName = newCategoryName.trim();
    if (!newName || newName === oldName) {
        setCategoryToEdit(null);
        setNewCategoryName('');
        return;
    }

    if (customCategories.some(c => c.toLowerCase() === newName.toLowerCase())) {
        alert(`Category "${newName}" already exists.`);
        return;
    }

    // Update custom categories list
    setCustomCategories(prev =>
        prev.map(c => c === oldName ? newName : c).sort()
    );

    // Update history items
    setHistory(prev =>
        prev.map(item =>
            item.category === oldName ? { ...item, category: newName } : item
        )
    );
    
    setCategoryToEdit(null);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (categoryToDelete: string) => {
      if (window.confirm(`Are you sure you want to delete the category "${categoryToDelete}"? This will not change existing history entries, but will remove it from future suggestions.`)) {
          setCustomCategories(prev => prev.filter(c => c !== categoryToDelete));
      }
  };

  const handleAddCategory = (e: React.FormEvent) => {
      e.preventDefault();
      const newCat = newCategoryInput.trim();
      if (!newCat) return;

      if (customCategories.some(c => c.toLowerCase() === newCat.toLowerCase())) {
          alert(`Category "${newCat}" already exists.`);
          return;
      }

      setCustomCategories(prev => [...prev, newCat].sort());
      setNewCategoryInput('');
  };

  return (
    <>
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 h-full flex flex-col text-text-primary-light dark:text-text-primary-dark">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold">History</h2>
            <button onClick={() => setIsCategoryModalOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-surface-dark transition-colors" aria-label="Manage Categories">
                <Icon icon="settings" className="w-6 h-6 text-text-secondary-light dark:text-text-secondary-dark"/>
            </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {history.length > 0 && (
            <>
              <button onClick={exportToCSV} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-surface-dark transition-colors" aria-label="Export to CSV">
                <Icon icon="download" className="w-6 h-6 text-text-secondary-light dark:text-text-secondary-dark"/>
              </button>
              <button onClick={clearHistory} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-surface-dark transition-colors" aria-label="Clear History">
                <Icon icon="trash" className="w-6 h-6 text-red-500"/>
              </button>
            </>
          )}
          <button onClick={() => setActiveView(AppView.Calculator)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-surface-dark transition-colors" aria-label="Close History">
            <Icon icon="close" className="w-7 h-7"/>
          </button>
        </div>
      </div>
      
      {history.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-text-secondary-light dark:text-text-secondary-dark">
          <Icon icon="history" className="w-16 h-16 opacity-50" />
          <h3 className="mt-4 text-xl font-semibold">No History Yet</h3>
          <p className="mt-1">Your calculations and expenses will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto flex-grow pr-2">
          {history.map((item) => (
            <div key={item.id} className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg flex items-start gap-4">
               <div className="w-14 h-14 flex-shrink-0 rounded-md flex items-center justify-center bg-background-light dark:bg-background-dark">
                {item.type === 'scan' ? (
                  item.imageDataUrl ? (
                    <img src={item.imageDataUrl} alt="Receipt thumbnail" className="w-full h-full object-cover rounded-md" />
                  ) : (
                    <Icon icon="scanner" className="w-7 h-7 text-text-secondary-light dark:text-text-secondary-dark" />
                  )
                ) : item.type === 'manual' ? (
                  <Icon icon="calculator" className="w-7 h-7 text-text-secondary-light dark:text-text-secondary-dark" />
                ) : ( // expense
                  <Icon icon="tag" className="w-7 h-7 text-text-secondary-light dark:text-text-secondary-dark" />
                )}
              </div>
              <div className="flex-grow overflow-hidden">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-grow break-words">
                    {item.description ? (
                      <p className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">{item.description}</p>
                    ) : item.calculation ? (
                      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark truncate">{item.calculation} =</p>
                    ) : <div className="h-5"></div>}
                    <p className="font-bold text-2xl tracking-tight">{item.total.toFixed(2)}</p>
                    {(item.type === 'scan' || item.type === 'expense') && item.category && (
                      <p className="text-sm bg-gray-200 dark:bg-gray-700 inline-block px-2 py-0.5 rounded-full mt-1">{item.category}</p>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark flex-shrink-0 pt-1">{formatHistoryDate(item.date)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {isCategoryModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" role="dialog" aria-modal="true" onClick={() => setIsCategoryModalOpen(false)}>
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 w-full max-w-md mx-4 text-left shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Manage Categories</h3>
            <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-key-dark-dark">
              <Icon icon="close" className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-2 mb-4 border-b border-border-light dark:border-border-dark pb-4">
            {customCategories.length > 0 ? customCategories.map(cat => (
              <div key={cat} className="flex items-center justify-between p-2 rounded-lg hover:bg-background-light dark:hover:bg-background-dark group">
                {categoryToEdit === cat ? (
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onBlur={() => handleRenameCategory(cat)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(cat); if (e.key === 'Escape') setCategoryToEdit(null); }}
                    autoFocus
                    className="flex-grow bg-transparent text-text-primary-light dark:text-text-primary-dark focus:outline-none ring-1 ring-key-orange rounded px-1"
                  />
                ) : (
                  <span className="text-text-primary-light dark:text-text-primary-dark">{cat}</span>
                )}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setCategoryToEdit(cat); setNewCategoryName(cat); }} className="p-1 text-text-secondary-light dark:text-text-secondary-dark hover:text-key-orange-dark" aria-label={`Edit category ${cat}`}>
                    <Icon icon="edit" className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDeleteCategory(cat)} className="p-1 text-text-secondary-light dark:text-text-secondary-dark hover:text-red-500" aria-label={`Delete category ${cat}`}>
                    <Icon icon="trash" className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )) : <p className="text-text-secondary-light dark:text-text-secondary-dark text-center py-4">No custom categories yet.</p>}
          </div>

          <form onSubmit={handleAddCategory} className="flex gap-2 pt-2">
            <input
              type="text"
              value={newCategoryInput}
              onChange={e => setNewCategoryInput(e.target.value)}
              placeholder="Add new category..."
              className="flex-grow bg-key-dark-light dark:bg-key-dark-dark text-text-on-dark-light dark:text-on-dark-dark px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-key-orange"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-key-orange-dark text-text-on-orange-dark font-semibold transition-transform duration-100 active:scale-95"
            >
              Add
            </button>
          </form>
        </div>
      </div>
    )}
    </>
  );
};

export default History;