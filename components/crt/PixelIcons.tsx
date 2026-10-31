interface IconProps {
  readonly className?: string;
  readonly title?: string;
}

const svgProps = {
  shapeRendering: "crispEdges" as const,
  fill: "currentColor",
  "aria-hidden": true,
};

/** Antenna plus five rising bars, like an old handset. `bars` is 0-5. */
export function SignalIcon({ bars, className }: IconProps & { readonly bars: number }) {
  return (
    <svg viewBox="0 0 26 16" width="1.65em" height="1em" className={className} {...svgProps}>
      <rect x="0" y="0" width="7" height="2" />
      <rect x="1" y="2" width="2" height="2" />
      <rect x="4" y="2" width="2" height="2" />
      <rect x="3" y="2" width="1" height="14" />
      <rect x="2" y="4" width="3" height="1" />
      {[0, 1, 2, 3, 4].map((index) => (
        <rect key={index} x={8 + index * 3.6} y={13 - index * 3} width="2.4" height={3 + index * 3} opacity={index < bars ? 1 : 0.18} />
      ))}
    </svg>
  );
}

export function EnvelopeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 18 13" width="1.4em" height="1em" className={className} {...svgProps}>
      <path d="M0 0h18v13H0z M2 2v9h14V2z" fillRule="evenodd" />
      <path d="M2 2h2v1h1v1h1v1h1v1h1v1h2V6h1V5h1V4h1V3h1V2h2v2h-1v1h-1v1h-1v1h-1v1h-1v1H7V8H6V7H5V6H4V5H3V4H2z" />
    </svg>
  );
}

/** Three-segment battery. `level` is 0-3. */
export function BatteryIcon({ level, className }: IconProps & { readonly level: number }) {
  return (
    <svg viewBox="0 0 24 12" width="2em" height="1em" className={className} {...svgProps}>
      <path d="M2 0h20v12H2z M4 2v8h16V2z" fillRule="evenodd" />
      <rect x="0" y="3" width="2" height="6" />
      {[0, 1, 2].map((index) => (
        <rect key={index} x={15 - index * 5} y="3.5" width="3.5" height="5" opacity={index < level ? 1 : 0.15} />
      ))}
    </svg>
  );
}
