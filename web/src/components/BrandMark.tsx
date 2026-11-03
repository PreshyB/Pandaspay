/**
 * The BuyBridge mark: the letter B built from a pylon stem and two open
 * suspension-cable arcs. Draws in `currentColor` so it follows its parent.
 */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={Math.round(size * (100 / 120))}
      height={size}
      viewBox="0 0 100 120"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="16" y="10" width="16" height="100" rx="8" fill="currentColor" />
      <path d="M32 16 Q86 16 86 38 Q86 60 32 60" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
      <path d="M32 64 Q92 64 92 90 Q92 116 32 116" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
}
