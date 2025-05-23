import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, onClose, duration = 3500 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-gray-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-4 animate-fade-in">
        <span>{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:opacity-80 focus:outline-none"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast; 