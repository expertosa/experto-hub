export function ExpertoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <path
        d="M44 42c3-9-5-16-14-13-11 3-15 16-8 25 9 11 28 8 34-5 8-16-3-34-20-38-21-5-38 15-35 34 3 23 28 38 49 29"
        fill="none"
        stroke="#1B6EF3"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <circle cx="62" cy="20" r="6" fill="#22C55E" />
    </svg>
  );
}
