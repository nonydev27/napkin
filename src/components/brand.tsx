import Link from "next/link";

/**
 * Napkin logo mark: a lime square napkin with a folded bottom-left corner,
 * and a hand-drawn stroke on top resolving into two crisp UI lines —
 * "from napkin to real". Works at 16px favicon size and up.
 */
export function NapkinMark({ size = 31 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 32 32" width={size}>
      {/* Napkin tile with folded corner (bottom-left) */}
      <path
        d="M4 1h24a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H10L1 22V4a3 3 0 0 1 3-3Z"
        fill="var(--lime, #dbfa69)"
      />
      {/* Fold shadow */}
      <path
        d="M10 31 1 22h6a3 3 0 0 1 3 3v6Z"
        fill="var(--lime-dark, #c2e64a)"
      />
      {/* Hand-drawn stroke: a wavy sketch line on the top half */}
      <path
        d="M9 10.5c2.4-2.6 4.6 2.2 7-.4 2.3-2.5 4.4 1.9 6.8-.5"
        fill="none"
        stroke="#11120e"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      {/* "Real" UI lines: crisp horizontal bars below, dot on the right */}
      <rect
        fill="#11120e"
        height="2.4"
        rx="1.2"
        width="9"
        x="9"
        y="16"
      />
      <rect
        fill="#11120e"
        height="2.4"
        rx="1.2"
        width="6"
        x="9"
        y="21"
      />
      <circle cx="21.5" cy="17.2" fill="#11120e" r="1.5" />
      <circle cx="20" cy="22.2" fill="#11120e" r="1.2" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link aria-label="Napkin home" className="brand" href="/">
      <span className="brand-mark">
        <NapkinMark />
      </span>
      {!compact && <span>napkin</span>}
    </Link>
  );
}

export function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.08c-3.1.67-3.76-1.31-3.76-1.31-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.11.08 1.69 1.14 1.69 1.14.99 1.69 2.6 1.2 3.23.92.1-.72.39-1.2.71-1.48-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.14-3-.12-.28-.5-1.42.11-2.96 0 0 .93-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.12-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.71.78 1.14 1.78 1.14 3 0 4.29-2.61 5.24-5.1 5.51.4.35.76 1.03.76 2.08V22c0 .29.2.63.77.53A11.1 11.1 0 0 0 12 .9Z" />
    </svg>
  );
}
