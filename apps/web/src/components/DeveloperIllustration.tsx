import React from 'react';
import { cn } from '@/lib/utils';

export interface DeveloperIllustrationProps extends React.SVGProps<SVGSVGElement> {}

export function DeveloperIllustration({ className, ...props }: DeveloperIllustrationProps) {
  return (
    <svg
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-full h-auto select-none', className)}
      {...props}
    >
      {/* Soft circular background backdrop */}
      <circle cx="250" cy="270" r="175" className="fill-muted/60" />

      {/* Decorative code brackets */}
      <text
        x="215"
        y="95"
        className="fill-muted-foreground/25 font-mono text-2xl font-semibold select-none"
      >
        &#123;
      </text>
      <text
        x="270"
        y="95"
        className="fill-muted-foreground/25 font-mono text-2xl font-semibold select-none"
      >
        &#125;
      </text>

      {/* Left Floating Code Window */}
      <g className="filter drop-shadow-sm">
        <rect
          x="35"
          y="105"
          width="155"
          height="115"
          rx="8"
          className="fill-card stroke-border"
          strokeWidth="1.5"
        />
        {/* Window controls */}
        <circle cx="50" cy="118" r="3" className="fill-red-400/80" />
        <circle cx="59" cy="118" r="3" className="fill-amber-400/80" />
        <circle cx="68" cy="118" r="3" className="fill-emerald-400/80" />
        <line x1="35" y1="128" x2="190" y2="128" className="stroke-border" strokeWidth="1" />
        {/* Code lines */}
        <line x1="50" y1="142" x2="88" y2="142" className="stroke-primary/70" strokeWidth="3" strokeLinecap="round" />
        <line x1="62" y1="154" x2="145" y2="154" className="stroke-muted-foreground/40" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="74" y1="166" x2="165" y2="166" className="stroke-emerald-500/80" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="74" y1="178" x2="135" y2="178" className="stroke-blue-500/80" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="62" y1="190" x2="115" y2="190" className="stroke-purple-500/80" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="50" y1="202" x2="78" y2="202" className="stroke-primary/70" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Right Floating Terminal Window */}
      <g className="filter drop-shadow-sm">
        <rect
          x="310"
          y="115"
          width="155"
          height="105"
          rx="8"
          className="fill-card stroke-border"
          strokeWidth="1.5"
        />
        {/* Window controls */}
        <circle cx="325" cy="128" r="3" className="fill-red-400/80" />
        <circle cx="334" cy="128" r="3" className="fill-amber-400/80" />
        <circle cx="343" cy="128" r="3" className="fill-emerald-400/80" />
        <line x1="310" y1="138" x2="465" y2="138" className="stroke-border" strokeWidth="1" />
        {/* Terminal prompt and lines */}
        <path
          d="M 325 152 L 331 156 L 325 160"
          fill="none"
          className="stroke-emerald-500"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="337" y1="156" x2="390" y2="156" className="stroke-foreground/80" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="325" y1="170" x2="415" y2="170" className="stroke-muted-foreground/50" strokeWidth="2" strokeLinecap="round" />
        <line x1="325" y1="182" x2="375" y2="182" className="stroke-muted-foreground/50" strokeWidth="2" strokeLinecap="round" />
        <line x1="325" y1="196" x2="333" y2="196" className="stroke-emerald-500" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Desk and Furniture */}
      {/* Desk legs */}
      <path
        d="M 95 350 L 75 450 M 405 350 L 425 450"
        className="stroke-border"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Chair base */}
      <line
        x1="250"
        y1="390"
        x2="250"
        y2="435"
        className="stroke-muted-foreground/40"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M 205 445 L 250 435 L 295 445"
        className="stroke-muted-foreground/40"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="205" cy="446" r="3" className="fill-muted-foreground/50" />
      <circle cx="295" cy="446" r="3" className="fill-muted-foreground/50" />
      <circle cx="250" cy="436" r="3" className="fill-muted-foreground/50" />

      {/* Chair seat and backrest */}
      <rect
        x="222"
        y="235"
        width="56"
        height="100"
        rx="10"
        className="fill-muted-foreground/20"
      />
      <rect
        x="205"
        y="355"
        width="90"
        height="12"
        rx="6"
        className="fill-muted-foreground/30"
      />

      {/* Developer Character */}
      {/* Torso */}
      <path
        d="M 226 355 C 226 295 274 295 274 355 Z"
        className="fill-primary/80"
      />

      {/* Head */}
      <circle cx="250" cy="235" r="20" className="fill-primary/90" />

      {/* Hair */}
      <path
        d="M 233 234 C 233 216 267 216 267 234 C 263 225 237 225 233 234 Z"
        className="fill-foreground"
      />

      {/* Headphones */}
      <path
        d="M 230 235 C 230 210 270 210 270 235"
        fill="none"
        className="stroke-muted-foreground"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="227"
        y="228"
        width="5"
        height="14"
        rx="2.5"
        className="fill-muted-foreground"
      />
      <rect
        x="268"
        y="228"
        width="5"
        height="14"
        rx="2.5"
        className="fill-muted-foreground"
      />

      {/* Arms reaching to keyboard */}
      <path
        d="M 230 300 Q 215 325 235 340"
        fill="none"
        className="stroke-primary/80"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M 270 300 Q 285 325 265 340"
        fill="none"
        className="stroke-primary/80"
        strokeWidth="11"
        strokeLinecap="round"
      />

      {/* Desk Surface */}
      <rect
        x="60"
        y="340"
        width="380"
        height="12"
        rx="6"
        className="fill-border"
      />

      {/* Laptop */}
      <g>
        {/* Screen */}
        <rect
          x="222"
          y="275"
          width="56"
          height="58"
          rx="4"
          className="fill-card stroke-border"
          strokeWidth="1.5"
        />
        <rect
          x="226"
          y="279"
          width="48"
          height="48"
          rx="2"
          className="fill-background"
        />
        {/* Code lines on screen */}
        <line x1="230" y1="287" x2="250" y2="287" className="stroke-emerald-500" strokeWidth="2" strokeLinecap="round" />
        <line x1="234" y1="293" x2="264" y2="293" className="stroke-blue-500" strokeWidth="2" strokeLinecap="round" />
        <line x1="234" y1="299" x2="258" y2="299" className="stroke-purple-500" strokeWidth="2" strokeLinecap="round" />
        <line x1="230" y1="305" x2="246" y2="305" className="stroke-amber-500" strokeWidth="2" strokeLinecap="round" />
        <line x1="230" y1="311" x2="260" y2="311" className="stroke-muted-foreground/40" strokeWidth="2" strokeLinecap="round" />
        <line x1="234" y1="317" x2="252" y2="317" className="stroke-emerald-500" strokeWidth="2" strokeLinecap="round" />
        {/* Base */}
        <path
          d="M 215 340 L 285 340 L 280 335 L 220 335 Z"
          className="fill-muted stroke-border"
          strokeWidth="1"
        />
      </g>

      {/* Coffee Mug on Desk */}
      <g>
        <rect
          x="135"
          y="318"
          width="18"
          height="22"
          rx="3"
          className="fill-card stroke-border"
          strokeWidth="1.5"
        />
        <path
          d="M 135 323 C 127 323 127 333 135 333"
          fill="none"
          className="stroke-border"
          strokeWidth="1.5"
        />
        {/* Steam */}
        <path
          d="M 141 312 Q 144 306 141 300 M 147 314 Q 150 308 147 302"
          fill="none"
          className="stroke-muted-foreground/30"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>

      {/* Potted Plant on Desk */}
      <g>
        <path
          d="M 350 326 L 366 326 L 363 340 L 353 340 Z"
          className="fill-card stroke-border"
          strokeWidth="1.5"
        />
        <path
          d="M 358 326 Q 352 316 350 310 Q 358 316 358 326"
          className="fill-emerald-500/80"
        />
        <path
          d="M 358 326 Q 364 316 366 310 Q 358 316 358 326"
          className="fill-emerald-600/80"
        />
        <path
          d="M 358 326 Q 358 312 358 306 Q 360 316 358 326"
          className="fill-emerald-400/80"
        />
      </g>
    </svg>
  );
}
