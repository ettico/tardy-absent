import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import { downloadExcel } from '../utils/download';
import ReportActionBar from '../components/ReportActionBar';

interface AtRiskStudent {
  fullName: string;
  nationalId: string;
  gradeName: string;
  className: string;
  totalLateCount: number;
  assignmentsRequired: number;
  assignmentsSubmitted: number;
  assignmentsOwed: number;
  status: string;
}

export default function AtRiskReportPage() {
  const scopeParams = useScopeParams();
  const [students, setStudents] = useState<AtRiskStudent[] | null>(null);

  useEffect(() => {
    api.get<{ students: AtRiskStudent[] }>('/reports/at-risk', { params: scopeParams }).then((res) => setStudents(res.data.students));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeParams.institutionId]);

  return (
    <div>
      <div className="page-header">
        <h1>איתור תלמידות בחריגה</h1>
      </div>
      <ReportActionBar
        onPrint={() => window.print()}
        onExcel={() => downloadExcel('/reports/at-risk', scopeParams, 'תלמידות-בחריגה.xlsx')}
      />
      <p className="empty-note">
        תלמידות שהגיעו למחזור של 8 איחורים לפחות פעם אחת במהלך המחצית הנוכחית, כולל מי שהופנתה להנהלה.
      </p>
      {!students ? (
        <p className="spinner-note">טוענת...</p>
      ) : students.length === 0 ? (
        <p className="empty-note">אין כרגע תלמידות בחריגה.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>שם התלמידה</th>
              <th>שכבה</th>
              <th>כיתה</th>
              <th>סה"כ איחורים</th>
              <th>פעמים נדרשה עבודה</th>
              <th>עבודות ממתינות</th>
              <th>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.nationalId}>
                <td>{s.fullName}</td>
                <td>{s.gradeName}</td>
                <td>{s.className}</td>
                <td>{s.totalLateCount}</td>
                <td>{s.assignmentsRequired}</td>
                <td>{s.assignmentsOwed}</td>
                <td>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
