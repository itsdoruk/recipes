import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export default function Skeleton({ width = '100%', height = 16, className = '', style = {} }: SkeletonProps) {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 animate-pulse rounded ${className}`}
      style={{ width, height, ...style }}
      aria-busy="true"
      aria-label="Loading..."
    />
  );
} 