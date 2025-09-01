
import React from 'react';

interface SpinnerProps {
    message: string;
}

const Spinner: React.FC<SpinnerProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="w-12 h-12 border-4 border-primary-light dark:border-primary-dark border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-lg font-medium text-text-primary-light dark:text-text-primary-dark">{message}</p>
      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">This may take a few moments...</p>
    </div>
  );
};

export default Spinner;
