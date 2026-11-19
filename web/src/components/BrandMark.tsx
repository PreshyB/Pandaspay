/**
 * The PayTight mark: the letter P built from a pylon stem and one open
 * suspension-cable arc. Draws in `currentColor` so it follows its parent.
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
      <path d="M32 16 Q94 16 94 46 Q94 76 32 76" stroke="currentColor" strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
}
