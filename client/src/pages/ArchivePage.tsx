import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import type { Semester } from '../types';

interface ArchivedClass {
  id: string;
  name: string;
  gradeName: string;
  archivedYearLabel: string | null;
  studentCount: number;
}

const TERM_LABELS: Record<number, string> = { 1: 'א׳', 2: 'ב׳' };

export default function ArchivePage() {
  const scopeParams = useScopeParams();
  const [classes, setClasses] = useState<ArchivedClass[] | null>(null);
  const [semesters, setSemesters] = useState<Semester[] | null>(null);

  useEffect(() => {
    api.get<ArchivedClass[]>('/archive/classes', { params: scopeParams }).then((res) => setClasses(res.data));
    api.get<Semester[]>('/archive/semesters', { params: scopeParams }).then((res) => setSemesters(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeParams.institutionId]);

  const classesByYear = new Map<string, ArchivedClass[]>();
  for (const c of classes ?? []) {
    const key = c.archivedYearLabel || 'ללא תווית שנה';
    if (!classesByYear.has(key)) classesByYear.set(key, []);
    classesByYear.get(key)!.push(c);
  }

  return (
    <div>
      <div className="page-header">
        <h1>ארכיון</h1>
      </div>

      <h2 style={{ fontSize: '1.1rem', color: 'var(--primary-dark)' }}>כיתות בוגרות</h2>
      {!classes ? (
        <p className="spinner-note">טוענת...</p>
      ) : classes.length === 0 ? (
        <p className="empty-note">עדיין אין כיתות בארכיון.</p>
      ) : (
        Array.from(classesByYear.entries()).map(([year, list]) => (
          <div key={year} className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem' }}>שנת {year}</h3>
            <div className="action-buttons">
              {list.map((c) => (
                <Link key={c.id} to={`/archive/classes/${c.id}`} className="class-tile">
                  <span className="class-name">
                    {c.gradeName} - {c.name}
                  </span>
                  <span className="class-count">{c.studentCount} תלמידות</span>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}

      <h2 style={{ fontSize: '1.1rem', color: 'var(--primary-dark)', marginTop: '2rem' }}>מחצית קודמות</h2>
      {!semesters ? (
        <p className="spinner-note">טוענת...</p>
      ) : semesters.length === 0 ? (
        <p className="empty-note">עדיין לא הסתיימה אף מחצית.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>שנה</th>
              <th>מחצית</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {semesters.map((s) => (
              <tr key={s.id}>
                <td>{s.yearLabel || '-'}</td>
                <td>{TERM_LABELS[s.term] ?? s.term}</td>
                <td>
                  <Link to={`/archive/semesters/${s.id}`} className="btn btn-outline btn-sm">
                    צפייה בנתונים
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
