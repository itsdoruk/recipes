import React from 'react';
import Image from 'next/image';

interface MiniRecipeCardProps {
  image_url: string;
  label: string;
  onClick?: () => void;
  selected?: boolean;
}

export default function MiniRecipeCard({ image_url, label, onClick, selected = false }: MiniRecipeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-48 h-48 flex flex-col rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-black/90 hover:opacity-90 transition-all shadow-md focus:outline-none ${selected ? 'border-2 border-blue-400 dark:border-blue-400' : ''}`}
      style={{ color: 'var(--foreground)' }}
    >
      <div className="relative w-full h-2/3">
        <Image
          src={image_url}
          alt={label}
          fill
          className="object-cover"
        />
      </div>
      <div className="flex-1 flex items-center justify-center px-2">
        <span className="text-lg font-medium truncate w-full text-left">{label}</span>
      </div>
    </button>
  );
} 