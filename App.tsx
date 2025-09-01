import React, { useEffect, useCallback } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import Calculator from './components/Calculator';
import History from './components/History';
import { AppView, HistoryItem } from './types';

function App() {
  const [theme, setTheme] = useLocalStorage<'dark' | 'light'>('theme', 'dark');
  const [activeView, setActiveView] = useLocalStorage<AppView>('activeView', AppView.Calculator);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('calculationHistory', []);
  const [customCategories, setCustomCategories] = useLocalStorage<string[]>('customCategories', [
    'Food & Drink',
    'Groceries',
    'Shopping',
    'Transport',
    'Utilities',
    'Health',
    'Entertainment',
    'Home',
    'Personal Care',
    'Uncategorized'
  ]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-background-dark', 'dark');
      document.body.classList.remove('bg-background-light');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-background-dark', 'dark');
      document.body.classList.add('bg-background-light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };
  
  const addHistoryItem = useCallback((item: Omit<HistoryItem, 'id' | 'date'>) => {
    const newItem: HistoryItem = {
        ...item,
        id: new Date().toISOString() + Math.random(),
        date: new Date().toISOString(),
    };
    setHistory(prevHistory => [newItem, ...prevHistory].slice(0, 50)); // Keep last 50 items
  }, [setHistory]);

  const appState = {
      theme,
      toggleTheme,
      activeView,
      setActiveView,
      history,
      setHistory,
      addHistoryItem,
      customCategories,
      setCustomCategories
  };

  return (
    <div className={`h-screen font-sans bg-background-light dark:bg-background-dark transition-colors duration-300 overflow-hidden`}>
      <main className="h-full">
        {activeView === AppView.Calculator && <Calculator {...appState} />}
        {activeView === AppView.History && <History {...appState} />}
      </main>
    </div>
  );
}

export default App;