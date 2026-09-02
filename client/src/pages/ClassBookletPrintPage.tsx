import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import { downloadExcel } from '../utils/download';
import ReportActionBar from '../components/ReportActionBar';

interface BookletEvent {
  type: 'LATE' | 'ABSENCE' | 'RELEASE';
  typeLabel: string;
  hebrewDate: string;
  time: string | null;
  periodsMissed: number | null;
}

interface BookletStudent {
  fullName: string;
  nationalId: string;
  totalLateCount: number;
  totalAbsenceCount: number;
  totalReleaseCount: number;
  totalPeriodsMissed: number;
  status: string;
  events: BookletEvent[];
}

interface BookletData {
  className: string;
  gradeName: string;
  students: BookletStudent[];
}

export default function ClassBookletPrintPage() {
  const { classId } = useParams<{ classId: string }>();
  const scopeParams = useScopeParams();
  const [data, setData] = useState<BookletData | null>(null);

  useEffect(() => {
    if (!classId) return;
    api.get<BookletData>(`/reports/class/${classId}/booklet`, { params: scopeParams }).then((res) => setData(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  if (!data) return <p className="spinner-note">טוענת...</p>;

  return (
    <div>
      <ReportActionBar
        className="no-print"
        onPrint={() => window.print()}
        onExcel={() =>
          classId && downloadExcel(`/reports/class/${classId}/booklet`, scopeParams, `חוברת-כיתה-${data.className}.xlsx`)
        }
      />
      <h1>
        חוברת איחורים וחיסורים - כיתה {data.className} (שכבת {data.gradeName})
      </h1>

      {data.students.map((s) => (
        <div key={s.nationalId} className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', breakInside: 'avoid' }}>
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem' }}>
            {s.fullName} <span className="stat-pill">ת.ז. {s.nationalId}</span>
          </h2>
          <p className="stat-pill" style={{ marginBottom: '0.6rem' }}>
            איחורים: {s.totalLateCount} | חיסורים: {s.totalAbsenceCount} | שחרורים: {s.totalReleaseCount} | חיסורי
            שעות: {s.totalPeriodsMissed}
            {s.status && ` | ${s.status}`}
          </p>
          {s.events.length === 0 ? (
            <p className="empty-note">אין אירועים רשומים.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>תאריך עברי</th>
                  <th>שעה</th>
                  <th>סוג</th>
                  <th>חיסורי שעות</th>
                </tr>
              </thead>
              <tbody>
                {s.events.map((e, i) => (
                  <tr key={i}>
                    <td>{e.hebrewDate}</td>
                    <td>{e.time ?? '-'}</td>
                    <td>{e.typeLabel}</td>
                    <td>{e.periodsMissed ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
