import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import type { Semester } from '../types';

interface SemesterStudentStats {
  fullName: string;
  nationalId: string;
  className: string;
  gradeName: string;
  late: number;
  absence: number;
  release: number;
}

const TERM_LABELS: Record<number, string> = { 1: 'א׳', 2: 'ב׳' };

export default function ArchiveSemesterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const scopeParams = useScopeParams();
  const [semester, setSemester] = useState<Semester | null>(null);
  const [students, setStudents] = useState<SemesterStudentStats[] | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<{ semester: Semester; students: SemesterStudentStats[] }>(`/archive/semesters/${id}`, { params: scopeParams })
      .then((res) => {
        setSemester(res.data.semester);
        setStudents(res.data.students);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!semester || !students) return <p className="spinner-note">טוענת...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>
          מחצית {TERM_LABELS[semester.term] ?? semester.term}, שנת {semester.yearLabel || '-'}
        </h1>
      </div>
      <p className="empty-note">
        נתונים מחושבים מתוך האירועים שנרשמו במחצית זו. שם הכיתה/שכבה המוצג הוא המצב הנוכחי של התלמידה, ולא בהכרח
        הכיתה שבה למדה באותה עת.
      </p>
      {students.length === 0 ? (
        <p className="empty-note">לא נרשמו אירועים במחצית זו.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>שם התלמידה</th>
              <th>שכבה</th>
              <th>כיתה</th>
              <th>איחורים</th>
              <th>חיסורים</th>
              <th>שחרורים</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.nationalId}>
                <td>{s.fullName}</td>
                <td>{s.gradeName}</td>
                <td>{s.className}</td>
                <td>{s.late}</td>
                <td>{s.absence}</td>
                <td>{s.release}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
