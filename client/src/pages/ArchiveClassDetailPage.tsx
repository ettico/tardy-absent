import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';

interface ArchivedStudent {
  fullName: string;
  nationalId: string;
  totalLateCount: number;
  totalAbsenceCount: number;
  totalReleaseCount: number;
}

interface ArchivedClassDetail {
  name: string;
  gradeName: string;
  archivedYearLabel: string | null;
  students: ArchivedStudent[];
}

export default function ArchiveClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const scopeParams = useScopeParams();
  const [data, setData] = useState<ArchivedClassDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<ArchivedClassDetail>(`/archive/classes/${id}`, { params: scopeParams }).then((res) => setData(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <p className="spinner-note">טוענת...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>
          כיתה בוגרת: {data.gradeName} - {data.name}
        </h1>
        <span className="stat-pill">שנת {data.archivedYearLabel || '-'}</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>שם התלמידה</th>
            <th>ת.ז.</th>
            <th>סה"כ איחורים</th>
            <th>סה"כ חיסורים</th>
            <th>סה"כ שחרורים</th>
          </tr>
        </thead>
        <tbody>
          {data.students.map((s) => (
            <tr key={s.nationalId}>
              <td>{s.fullName}</td>
              <td>{s.nationalId}</td>
              <td>{s.totalLateCount}</td>
              <td>{s.totalAbsenceCount}</td>
              <td>{s.totalReleaseCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
