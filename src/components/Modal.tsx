import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  contentLabel: string;
  className?: string;
  overlayClassName?: string;
  ariaHideApp?: boolean;
}

export default function Modal({ isOpen, onRequestClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={onRequestClose}
      />
      <div className="relative z-50">
        {children}
      </div>
    </div>
  );
} 