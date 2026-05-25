import React from "react";

export const IconSutet = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M4 22L12 2L20 22" />
    <path d="M6 16H18" />
    <path d="M8 10H16" />
    <circle cx="12" cy="2" r="2" fill="currentColor" />
  </svg>
);

export const IconBanjir = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M2 12C2 12 5 9 12 9C19 9 22 12 22 12" />
    <path d="M2 16C2 16 5 13 12 13C19 13 22 16 22 16" />
    <path d="M2 20C2 20 5 17 12 17C19 17 22 20 22 20" />
    <path d="M12 4V9" />
    <path d="M8 5V9" />
    <path d="M16 5V9" />
  </svg>
);

export const IconBegal = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M15 9L9 15" />
    <path d="M9 9L15 15" />
  </svg>
);

export const IconMacet = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="4" y="6" width="16" height="12" />
    <path d="M4 12H20" />
    <path d="M10 6V18" />
    <path d="M14 6V18" />
  </svg>
);

export const IconKrl = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="4" y="4" width="16" height="16" />
    <path d="M12 4V20" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconKuburan = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M12 4v16" />
    <path d="M8 8h8" />
    <path d="M6 20h12" />
  </svg>
);

export const IconSampah = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M5 6l1 14h12l1-14" />
  </svg>
);

export const getIconForCategory = (category: string) => {
  switch (category.toLowerCase()) {
    case "sutet":
      return IconSutet;
    case "banjir":
      return IconBanjir;
    case "begal":
      return IconBegal;
    case "macet":
      return IconMacet;
    case "krl":
      return IconKrl;
    case "kuburan":
      return IconKuburan;
    case "sampah":
      return IconSampah;
    default:
      return IconBegal;
  }
};

export const IconLogo = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <defs>
      <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF3B30" />
        <stop offset="50%" stopColor="#FF9500" />
        <stop offset="100%" stopColor="#FFCC00" />
      </linearGradient>
    </defs>
    <path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      fill="url(#logo-gradient)"
    />
    <path
      d="M12 13.5c1.1 0 2-.9 2-2 0-1.5-2-3.5-2-3.5s-2 2-2 3.5c0 1.1.9 2 2 2z"
      fill="#FFFFFF"
    />
  </svg>
);

