import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import { downloadExcel } from '../utils/download';

interface GradeSummary {
  gradeName: string;
  studentCount: number;
  totalLateCount: number;
  totalAbsenceCount: number;
  totalReleaseCount: number;
  studentsNeedingAssignment: number;
  studentsBlocked: number;
}

export default function InstitutionSummaryPage() {
  const scopeParams = useScopeParams();
  const [grades, setGrades] = useState<GradeSummary[] | null>(null);
  const [totals, setTotals] = useState<GradeSummary | null>(null);

  useEffect(() => {
    api
      .get<{ grades: GradeSummary[]; totals: Omit<GradeSummary, 'gradeName'> }>('/reports/institution-summary', {
        params: scopeParams,
      })
      .then((res) => {
        setGrades(res.data.grades);
        setTotals({ gradeName: 'סה"כ', ...res.data.totals });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeParams.institutionId]);

  return (
    <div>
      <div className="page-header">
        <h1>דוח מנהלים - סיכום בית ספר</h1>
        <div className="action-buttons">
          <button className="btn btn-outline" onClick={() => window.print()}>
            הדפסה / PDF
          </button>
          <button
            className="btn btn-outline"
            onClick={() => downloadExcel('/reports/institution-summary', scopeParams, 'סיכום-בית-ספר.xlsx')}
          >
            הורדת אקסל
          </button>
        </div>
      </div>
      <p className="empty-note">ריכוז נתוני כלל השכבות, לשימוש בישיבות סוף מחצית.</p>
      {!grades || !totals ? (
        <p className="spinner-note">טוענת...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>שכבה</th>
              <th>מספר תלמידות</th>
              <th>סה"כ איחורים</th>
              <th>סה"כ חיסורים</th>
              <th>סה"כ שחרורים</th>
              <th>נדרשו להגיש עבודה</th>
              <th>ללא רשות כניסה</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.gradeName}>
                <td>{g.gradeName}</td>
                <td>{g.studentCount}</td>
                <td>{g.totalLateCount}</td>
                <td>{g.totalAbsenceCount}</td>
                <td>{g.totalReleaseCount}</td>
                <td>{g.studentsNeedingAssignment}</td>
                <td>{g.studentsBlocked}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 800 }}>
              <td>{totals.gradeName}</td>
              <td>{totals.studentCount}</td>
              <td>{totals.totalLateCount}</td>
              <td>{totals.totalAbsenceCount}</td>
              <td>{totals.totalReleaseCount}</td>
              <td>{totals.studentsNeedingAssignment}</td>
              <td>{totals.studentsBlocked}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
