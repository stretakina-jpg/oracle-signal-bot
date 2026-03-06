import React from 'react';

const PrismaIcon: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="prismaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(270, 80%, 65%)" />
        <stop offset="50%" stopColor="hsl(320, 80%, 55%)" />
        <stop offset="100%" stopColor="hsl(195, 100%, 50%)" />
      </linearGradient>
    </defs>
    <polygon
      points="50,8 92,75 8,75"
      fill="none"
      stroke="url(#prismaGrad)"
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <polygon
      points="50,25 75,65 25,65"
      fill="url(#prismaGrad)"
      opacity="0.3"
    />
    <circle cx="50" cy="50" r="5" fill="url(#prismaGrad)" />
  </svg>
);

export default PrismaIcon;
