import PdfIcon from './icons/PdfIcon';
import ExcelIcon from './icons/ExcelIcon';

export default function ReportActionBar({
  onPrint,
  onExcel,
  printLabel = 'הדפסה / שמירה כ-PDF',
  className,
}: {
  onPrint: () => void;
  onExcel?: () => void;
  printLabel?: string;
  className?: string;
}) {
  return (
    <div className={className ? `${className} report-actions-bar` : 'report-actions-bar'}>
      <div className="report-actions-title">הפקת דוחות תקופתיים</div>
      <div className="action-buttons">
        <button
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          onClick={onPrint}
        >
          <PdfIcon size={16} />
          {printLabel}
        </button>
        {onExcel && (
          <button
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
            onClick={onExcel}
          >
            <ExcelIcon size={16} />
            הורדת אקסל
          </button>
        )}
      </div>
    </div>
  );
}
