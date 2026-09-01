export default function PdfIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 2h8l4 4v16H6z" fill="#C0392B" />
      <path d="M14 2v4h4z" fill="#7B241C" />
      <text x="12" y="17" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="white" fontFamily="Arial, sans-serif">
        PDF
      </text>
    </svg>
  );
}
