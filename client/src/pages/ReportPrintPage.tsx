import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import { toHebrewDateString } from '../utils/hebrewDate';
import { downloadExcel } from '../utils/download';
import ReportActionBar from '../components/ReportActionBar';

interface ReportStudent {
  fullName: string;
  nationalId: string;
  totalLateCount: number;
  totalAbsenceCount: number;
  totalReleaseCount: number;
  needsAssignment: boolean;
  blocked: boolean;
}

interface ReportData {
  className: string;
  gradeName: string;
  generatedAt: string;
  students: ReportStudent[];
}

export default function ReportPrintPage() {
  const { classId } = useParams<{ classId: string }>();
  const scopeParams = useScopeParams();
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    if (!classId) return;
    api.get<ReportData>(`/reports/class/${classId}`, { params: scopeParams }).then((res) => setReport(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  if (!report) return <p className="spinner-note">טוענת...</p>;

  return (
    <div>
      <ReportActionBar
        className="no-print"
        onPrint={() => window.print()}
        onExcel={() => classId && downloadExcel(`/reports/class/${classId}`, scopeParams, `דוח-כיתה-${report.className}.xlsx`)}
      />
      <h1>
        דוח איחורים וחיסורים - כיתה {report.className} (שכבת {report.gradeName})
      </h1>
      <p className="stat-pill">
        הופק בתאריך {toHebrewDateString(report.generatedAt.slice(0, 10))}
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>שם התלמידה</th>
            <th>ת.ז.</th>
            <th>סה"כ איחורים</th>
            <th>סה"כ חיסורים</th>
            <th>סה"כ שחרורים</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {report.students.map((s) => (
            <tr key={s.nationalId}>
              <td>{s.fullName}</td>
              <td>{s.nationalId}</td>
              <td>{s.totalLateCount}</td>
              <td>{s.totalAbsenceCount}</td>
              <td>{s.totalReleaseCount}</td>
              <td>
                {s.blocked ? 'אין רשות כניסה' : s.needsAssignment ? 'נדרשת להגיש עבודה' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
