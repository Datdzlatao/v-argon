import React from 'react';

interface VArgonLogoProps {
  className?: string;
  variant?: 'color' | 'white' | 'dark';
}

export function VArgonLogo({ className = 'w-5 h-5', variant = 'white' }: VArgonLogoProps) {
  const vFill =
    variant === 'white' ? '#FFFFFF' : variant === 'dark' ? '#22C55E' : '#15803D';
  const seedFill =
    variant === 'white' ? '#FFFFFF' : variant === 'dark' ? '#4ADE80' : '#22C55E';

  const vPath =
    variant === 'white'
      ? 'M 28.00 56.80 C 58.00 46.20 83.20 67.20 92.80 108.40 C 100.80 142.80 115.60 172.00 128.00 172.00 C 140.40 172.00 155.20 142.80 163.20 108.40 C 172.80 67.20 198.00 46.20 228.00 56.80 L 144.00 202.28 C 138.60 211.63 133.60 220.00 128.00 220.00 C 122.40 220.00 117.40 211.63 112.00 202.28 Z'
      : 'M 26.00 56.00 C 58.00 44.00 84.00 66.00 94.00 108.00 C 102.00 142.00 116.00 170.00 128.00 170.00 C 140.00 170.00 154.00 142.00 162.00 108.00 C 172.00 66.00 198.00 44.00 230.00 56.00 L 145.00 203.22 C 139.00 213.61 134.00 222.00 128.00 222.00 C 122.00 222.00 117.00 213.61 111.00 203.22 Z';

  const seedPath =
    variant === 'white'
      ? 'M 128.00 32.00 C 141.80 56.00 149.40 80.20 149.40 98.80 A 21.40 21.40 0 1 1 106.60 98.80 C 106.60 80.20 114.20 56.00 128.00 32.00 Z'
      : 'M 128.00 30.00 C 143.00 55.00 151.00 80.00 151.00 99.00 A 23.00 23.00 0 1 1 105.00 99.00 C 105.00 80.00 113.00 55.00 128.00 30.00 Z';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      className={className}
      aria-hidden="true"
    >
      <path fill={vFill} d={vPath} />
      <path fill={seedFill} d={seedPath} />
    </svg>
  );
}
