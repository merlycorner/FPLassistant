import React from 'react';
import { FPLTeam } from '../types/fpl';

interface ClubJerseyProps {
  club?: FPLTeam;
  isGoalkeeper?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface KitDesign {
  primary: string;
  secondary: string;
  sleeves?: string;
  collar?: string;
  hasStripes?: boolean;
}

// 20 Premier League official club color kits
const CLUB_KITS: Record<string, KitDesign> = {
  ARS: { primary: '#EF0107', secondary: '#FFFFFF', sleeves: '#FFFFFF', collar: '#FFFFFF' },
  AVL: { primary: '#670E36', secondary: '#95BFE5', sleeves: '#95BFE5', collar: '#95BFE5' },
  BOU: { primary: '#DA291C', secondary: '#111111', hasStripes: true, sleeves: '#111111' },
  BRE: { primary: '#E30613', secondary: '#FFFFFF', hasStripes: true, sleeves: '#E30613' },
  BHA: { primary: '#0057B8', secondary: '#FFFFFF', hasStripes: true, sleeves: '#0057B8' },
  CHE: { primary: '#034694', secondary: '#FFFFFF', sleeves: '#034694', collar: '#FFFFFF' },
  CRY: { primary: '#1B458F', secondary: '#C4122E', hasStripes: true, sleeves: '#1B458F' },
  EVE: { primary: '#003399', secondary: '#FFFFFF', sleeves: '#003399', collar: '#FFFFFF' },
  FUL: { primary: '#FFFFFF', secondary: '#000000', sleeves: '#111111', collar: '#111111' },
  IPS: { primary: '#004488', secondary: '#FFFFFF', sleeves: '#004488', collar: '#FFFFFF' },
  LEI: { primary: '#003090', secondary: '#FDBE11', sleeves: '#003090', collar: '#FDBE11' },
  LIV: { primary: '#C8102E', secondary: '#FFFFFF', sleeves: '#C8102E', collar: '#F6EB61' },
  MCI: { primary: '#6CABDD', secondary: '#FFFFFF', sleeves: '#6CABDD', collar: '#001E35' },
  MUN: { primary: '#DA291C', secondary: '#000000', sleeves: '#DA291C', collar: '#FFFFFF' },
  NEW: { primary: '#241F20', secondary: '#FFFFFF', hasStripes: true, sleeves: '#241F20' },
  NFO: { primary: '#DD0000', secondary: '#FFFFFF', sleeves: '#DD0000', collar: '#FFFFFF' },
  SOU: { primary: '#D71920', secondary: '#FFFFFF', hasStripes: true, sleeves: '#D71920' },
  TOT: { primary: '#FFFFFF', secondary: '#132257', sleeves: '#FFFFFF', collar: '#132257' },
  WHU: { primary: '#7A263A', secondary: '#1BB1E7', sleeves: '#1BB1E7', collar: '#1BB1E7' },
  WOL: { primary: '#FDB913', secondary: '#231F20', sleeves: '#FDB913', collar: '#231F20' },
};

export const ClubJersey: React.FC<ClubJerseyProps> = ({
  club,
  isGoalkeeper = false,
  className = '',
  size = 'md',
}) => {
  const shortName = club?.short_name || 'PL';

  // Goalkeeper kit: bright neon green/teal
  const kit: KitDesign = isGoalkeeper
    ? { primary: '#10B981', secondary: '#047857', sleeves: '#059669', collar: '#064E3B' }
    : CLUB_KITS[shortName] || {
        primary: '#334155',
        secondary: '#FFFFFF',
        sleeves: '#334155',
        collar: '#FFFFFF',
      };

  const dimensions =
    size === 'sm' ? { width: 34, height: 38 } : size === 'lg' ? { width: 50, height: 56 } : { width: 44, height: 48 };

  const uniqueId = `jersey-${shortName}-${isGoalkeeper ? 'gk' : 'outfield'}`;

  return (
    <div className={`relative inline-block select-none ${className}`}>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="0 0 100 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-md"
      >
        <defs>
          {kit.hasStripes && (
            <pattern
              id={`stripes-${uniqueId}`}
              width="20"
              height="100"
              patternUnits="userSpaceOnUse"
            >
              <rect x="0" y="0" width="10" height="100" fill={kit.primary} />
              <rect x="10" y="0" width="10" height="100" fill={kit.secondary} />
            </pattern>
          )}
          {/* Subtle gradient for fabric depth */}
          <linearGradient id={`shade-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* LEFT SLEEVE */}
        <path
          d="M26 22 L4 44 L16 54 L30 36 Z"
          fill={kit.sleeves || kit.primary}
          stroke="#000000"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />

        {/* RIGHT SLEEVE */}
        <path
          d="M74 22 L96 44 L84 54 L70 36 Z"
          fill={kit.sleeves || kit.primary}
          stroke="#000000"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />

        {/* SLEEVE CUFFS */}
        <path d="M4 44 L16 54" stroke={kit.secondary} strokeWidth="3" />
        <path d="M96 44 L84 54" stroke={kit.secondary} strokeWidth="3" />

        {/* MAIN BODY / TORSO */}
        <path
          d="M26 22 L74 22 L72 98 L28 98 Z"
          fill={kit.hasStripes ? `url(#stripes-${uniqueId})` : kit.primary}
          stroke="#000000"
          strokeWidth="1.5"
          strokeOpacity="0.3"
        />

        {/* FABRIC SHADOW OVERLAY */}
        <path
          d="M26 22 L74 22 L72 98 L28 98 Z"
          fill={`url(#shade-${uniqueId})`}
          style={{ mixBlendMode: 'overlay' }}
        />

        {/* SHIRT BOTTOM HEM */}
        <path d="M28 98 L72 98" stroke={kit.secondary} strokeWidth="2.5" />

        {/* CREW COLLAR */}
        <path
          d="M38 22 C38 32 62 32 62 22 Z"
          fill={kit.collar || kit.secondary}
          stroke="#000000"
          strokeWidth="1"
          strokeOpacity="0.3"
        />

        {/* CLUB WORDMARK / BADGE CODE ON CHEST */}
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fill={
            kit.hasStripes
              ? '#FFFFFF'
              : kit.primary === '#FFFFFF'
              ? '#111111'
              : '#FFFFFF'
          }
          fontSize="17"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.5"
          stroke={kit.hasStripes || kit.primary === '#FFFFFF' ? '#000000' : 'none'}
          strokeWidth={kit.hasStripes ? '0.75' : '0'}
        >
          {shortName}
        </text>
      </svg>
    </div>
  );
};
