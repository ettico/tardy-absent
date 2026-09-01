export default function ExcelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#1D6F42" />
      <path
        d="M7.5 8l2.4 4-2.4 4h1.9l1.5-2.6 1.5 2.6h1.9l-2.4-4 2.4-4h-1.9l-1.5 2.6L9.4 8H7.5z"
        fill="white"
      />
    </svg>
  );
}
