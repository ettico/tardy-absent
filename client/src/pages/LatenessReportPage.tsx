import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import { toHebrewDateString } from '../utils/hebrewDate';
import { downloadExcel } from '../utils/download';
import ReportActionBar from '../components/ReportActionBar';

interface LatenessStudent {
  fullName: string;
  nationalId: string;
  totalLateApprovedCount: number;
  totalLateUnapprovedCount: number;
  totalLateCount: number;
  totalPeriodsMissed: number;
}

interface MonthRow {
  label: string;
  approved: number;
  unapproved: number;
}

interface LatenessReportData {
  className: string;
  gradeName: string;
  generatedAt: string;
  students: LatenessStudent[];
  months: MonthRow[];
}

export default function LatenessReportPage() {
  const { classId } = useParams<{ classId: string }>();
  const scopeParams = useScopeParams();
  const [report, setReport] = useState<LatenessReportData | null>(null);

  useEffect(() => {
    if (!classId) return;
    api.get<LatenessReportData>(`/reports/class/${classId}/lateness`, { params: scopeParams }).then((res) => setReport(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  if (!report) return <p className="spinner-note">טוענת...</p>;

  return (
    <div>
      <ReportActionBar
        className="no-print"
        onPrint={() => window.print()}
        onExcel={() =>
          classId && downloadExcel(`/reports/class/${classId}/lateness`, scopeParams, `דוח-איחורים-${report.className}.xlsx`)
        }
      />
      <h1>
        דוח איחורים - כיתה {report.className} (שכבת {report.gradeName})
      </h1>
      <p className="stat-pill">הופק בתאריך {toHebrewDateString(report.generatedAt.slice(0, 10))}</p>

      <table className="data-table">
        <thead>
          <tr>
            <th>שם התלמידה</th>
            <th>ת.ז.</th>
            <th>איחורים עם אישור</th>
            <th>איחורים ללא אישור</th>
            <th>סה"כ איחורים</th>
            <th>סה"כ חיסורי שעות</th>
          </tr>
        </thead>
        <tbody>
          {report.students.map((s) => (
            <tr key={s.nationalId}>
              <td>{s.fullName}</td>
              <td>{s.nationalId}</td>
              <td>{s.totalLateApprovedCount}</td>
              <td>{s.totalLateUnapprovedCount}</td>
              <td>{s.totalLateCount}</td>
              <td>{s.totalPeriodsMissed}</td>
            </tr>
          ))}
          {report.students.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-note">
                אין תלמידות בכיתה זו.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 style={{ color: 'var(--primary-dark)', fontSize: '1.1rem', marginTop: '2rem' }}>פילוח חודשי (מחצית נוכחית)</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>חודש עברי</th>
            <th>איחורים עם אישור</th>
            <th>איחורים ללא אישור</th>
            <th>סה"כ</th>
          </tr>
        </thead>
        <tbody>
          {report.months.map((m) => (
            <tr key={m.label}>
              <td>{m.label}</td>
              <td>{m.approved}</td>
              <td>{m.unapproved}</td>
              <td>{m.approved + m.unapproved}</td>
            </tr>
          ))}
          {report.months.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-note">
                אין עדיין איחורים רשומים במחצית הנוכחית.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
