import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import GroupedBarChart from '../components/charts/GroupedBarChart';
import StackedShareBar from '../components/charts/StackedShareBar';
import type { Grade, Student } from '../types';

const LATE_COLOR = '#d6a44a';
const ABSENCE_COLOR = '#c0525f';
const RELEASE_COLOR = '#0f8f82';

interface ClassTotals {
  className: string;
  gradeName: string;
  late: number;
  absence: number;
  release: number;
}

interface MonthTotals {
  label: string;
  late: number;
  absence: number;
}

interface StudentSearchResult {
  id: string;
  fullName: string;
  className: string;
  gradeName: string;
}

export default function ManagementControlPage() {
  const scopeParams = useScopeParams();
  const [classTotals, setClassTotals] = useState<ClassTotals[] | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [monthData, setMonthData] = useState<{ className: string; months: MonthTotals[] } | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    api.get<ClassTotals[]>('/reports/by-class-totals', { params: scopeParams }).then((res) => setClassTotals(res.data));
    api.get<Grade[]>('/grades', { params: scopeParams }).then((res) => {
      setGrades(res.data);
      const firstClass = res.data.flatMap((g) => g.classes)[0];
      if (firstClass) setSelectedClassId(firstClass.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeParams.institutionId]);

  useEffect(() => {
    if (!selectedClassId) return;
    api
      .get<{ className: string; months: MonthTotals[] }>(`/reports/class/${selectedClassId}/by-month`, { params: scopeParams })
      .then((res) => setMonthData(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId]);

  useEffect(() => {
    if (studentQuery.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      api
        .get<{ students: StudentSearchResult[] }>('/search', { params: { q: studentQuery, ...scopeParams } })
        .then((res) => setStudentResults(res.data.students));
    }, 250);
    return () => clearTimeout(timeout);
  }, [studentQuery, scopeParams]);

  const classCategories = useMemo(() => (classTotals ?? []).map((c) => `${c.className}`), [classTotals]);
  const peakMonth = useMemo(() => {
    if (!monthData || monthData.months.length === 0) return null;
    return monthData.months.reduce((max, m) => ((m.late + m.absence > max.late + max.absence ? m : max)), monthData.months[0]);
  }, [monthData]);

  const allClasses = grades.flatMap((g) => g.classes.map((c) => ({ ...c, gradeName: g.name })));

  return (
    <div>
      <div className="page-header">
        <h1>בקרת מנהלים</h1>
        <Link to="/reports/institution-summary" className="btn btn-outline">
          צפייה בדוח המפורט (טבלה, הדפסה, אקסל)
        </Link>
      </div>

      <div className="dashboard-card">
        <h2>תמונת מצב לפי כיתות - איפה יש הכי הרבה איחורים וחיסורים</h2>
        <GroupedBarChart
          categories={classCategories}
          series={[
            { key: 'late', label: 'איחורים', color: LATE_COLOR, values: (classTotals ?? []).map((c) => c.late) },
            { key: 'absence', label: 'חיסורים', color: ABSENCE_COLOR, values: (classTotals ?? []).map((c) => c.absence) },
            { key: 'release', label: 'שחרורים', color: RELEASE_COLOR, values: (classTotals ?? []).map((c) => c.release) },
          ]}
        />
      </div>

      <div className="dashboard-card">
        <h2>מגמה חודשית לכיתה</h2>
        <div className="form-field" style={{ maxWidth: 260 }}>
          <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
            {allClasses.map((c) => (
              <option key={c.id} value={c.id}>
                כיתה {c.name} (שכבת {c.gradeName})
              </option>
            ))}
          </select>
        </div>
        {peakMonth && (
          <p className="stat-pill" style={{ marginBottom: '0.75rem' }}>
            החודש עם הכי הרבה אירועים: {peakMonth.label} ({peakMonth.late + peakMonth.absence})
          </p>
        )}
        <GroupedBarChart
          categories={(monthData?.months ?? []).map((m) => m.label)}
          series={[
            { key: 'late', label: 'איחורים', color: LATE_COLOR, values: (monthData?.months ?? []).map((m) => m.late) },
            { key: 'absence', label: 'חיסורים', color: ABSENCE_COLOR, values: (monthData?.months ?? []).map((m) => m.absence) },
          ]}
          emptyLabel="אין עדיין אירועים רשומים במחצית הנוכחית לכיתה זו."
        />
      </div>

      <div className="dashboard-card">
        <h2>פירוט לתלמידה</h2>
        <div className="form-field" style={{ maxWidth: 320, position: 'relative' }}>
          <input
            type="search"
            placeholder="חיפוש תלמידה..."
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
          />
          {studentResults.length > 0 && (
            <div className="global-search-dropdown" style={{ width: '100%' }}>
              {studentResults.map((s) => (
                <button
                  key={s.id}
                  className="search-result-item"
                  onClick={() => {
                    setStudentQuery(`${s.fullName} (${s.className})`);
                    setStudentResults([]);
                    api.get<Student>(`/students/${s.id}`, { params: scopeParams }).then((res) => setSelectedStudent(res.data));
                  }}
                >
                  {s.fullName} <span className="stat-pill">{s.className}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedStudent ? (
          <StackedShareBar
            segments={[
              { key: 'late', label: 'איחורים', color: LATE_COLOR, value: selectedStudent.totalLateCount },
              { key: 'absence', label: 'חיסורים', color: ABSENCE_COLOR, value: selectedStudent.totalAbsenceCount },
              { key: 'release', label: 'שחרורים', color: RELEASE_COLOR, value: selectedStudent.totalReleaseCount },
            ]}
          />
        ) : (
          <p className="empty-note">חפשי תלמידה כדי לראות את פירוט האיחורים, החיסורים והשחרורים שלה.</p>
        )}
      </div>
    </div>
  );
}
