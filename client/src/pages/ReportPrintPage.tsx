import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';

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
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>
          הדפסה
        </button>
      </div>
      <h1>
        דוח איחורים וחיסורים - כיתה {report.className} (שכבת {report.gradeName})
      </h1>
      <p className="stat-pill">הופק בתאריך {new Date(report.generatedAt).toLocaleString('he-IL')}</p>
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
