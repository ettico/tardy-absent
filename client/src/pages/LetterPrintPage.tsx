import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useScopeParams } from '../hooks/useScope';
import { todayHebrewDateString } from '../utils/hebrewDate';
import type { Student } from '../types';

export default function LetterPrintPage() {
  const { id } = useParams<{ id: string }>();
  const scopeParams = useScopeParams();
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<Student>(`/students/${id}`, { params: scopeParams }).then((res) => setStudent(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!student) return <p className="spinner-note">טוענת...</p>;

  const today = todayHebrewDateString();
  const assignmentsOwed = student.assignmentsRequired - student.assignmentsSubmitted;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', lineHeight: 1.8 }}>
      <div className="no-print" style={{ marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>
          הדפסה
        </button>
      </div>
      <p style={{ textAlign: 'left' }}>{today}</p>
      <h2>לכבוד הורי התלמידה {student.fullName}</h2>
      <p>שלום רב,</p>
      <p>
        הננו לעדכן כי בתכם, {student.fullName} (ת.ז. {student.nationalId}), צברה איחורים חוזרים לשיעורים, ובהתאם
        למדיניות בית הספר, לא ניתנה לה כניסה לכיתה בשעת האיחור עד להסדרת העניין מול הנהלת בית הספר.
      </p>
      <p>
        סך האיחורים שנרשמו לבתכם במחצית הנוכחית: <b>{student.totalLateCount}</b>
        <br />
        סך החיסורים שנרשמו לבתכם במחצית הנוכחית: <b>{student.totalAbsenceCount}</b>
        <br />
        עבודות שהתלמידה נדרשה להגיש ועדיין לא הגישה: <b>{assignmentsOwed}</b>
      </p>
      <p>נבקשכם לשוחח עם בתכם בנושא ולפנות אלינו בהקדם לצורך הסדרת העניין.</p>
      <p>בכבוד רב,
        <br />
        הנהלת בית הספר
      </p>
    </div>
  );
}
