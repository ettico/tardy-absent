import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { InstitutionProvider } from './context/InstitutionContext';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import LoginPage from './pages/LoginPage';
import GradesPage from './pages/GradesPage';
import ClassPage from './pages/ClassPage';
import StudentPage from './pages/StudentPage';
import UsersAdminPage from './pages/UsersAdminPage';
import ReportPrintPage from './pages/ReportPrintPage';
import ClassBookletPrintPage from './pages/ClassBookletPrintPage';
import LetterPrintPage from './pages/LetterPrintPage';
import AtRiskReportPage from './pages/AtRiskReportPage';
import InstitutionSummaryPage from './pages/InstitutionSummaryPage';
import SchoolYearPage from './pages/SchoolYearPage';
import ArchivePage from './pages/ArchivePage';
import ArchiveClassDetailPage from './pages/ArchiveClassDetailPage';
import ArchiveSemesterDetailPage from './pages/ArchiveSemesterDetailPage';
import ManagementControlPage from './pages/ManagementControlPage';

export default function App() {
  return (
    <AuthProvider>
      <InstitutionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/reports/class/:classId/print"
            element={
              <RequireAuth>
                <ReportPrintPage />
              </RequireAuth>
            }
          />
          <Route
            path="/reports/class/:classId/booklet"
            element={
              <RequireAuth>
                <ClassBookletPrintPage />
              </RequireAuth>
            }
          />
          <Route
            path="/students/:id/letter"
            element={
              <RequireAuth>
                <LetterPrintPage />
              </RequireAuth>
            }
          />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<GradesPage />} />
            <Route path="/classes/:id" element={<ClassPage />} />
            <Route path="/students/:id" element={<StudentPage />} />
            <Route
              path="/reports/at-risk"
              element={
                <RequireAuth roles={['SYSTEM_ADMIN', 'PRINCIPAL']}>
                  <AtRiskReportPage />
                </RequireAuth>
              }
            />
            <Route
              path="/reports/institution-summary"
              element={
                <RequireAuth roles={['SYSTEM_ADMIN', 'PRINCIPAL']}>
                  <InstitutionSummaryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/management-control"
              element={
                <RequireAuth roles={['SYSTEM_ADMIN', 'PRINCIPAL']}>
                  <ManagementControlPage />
                </RequireAuth>
              }
            />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/archive/classes/:id" element={<ArchiveClassDetailPage />} />
            <Route path="/archive/semesters/:id" element={<ArchiveSemesterDetailPage />} />
            <Route
              path="/school-year"
              element={
                <RequireAuth roles={['SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL']}>
                  <SchoolYearPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAuth roles={['SYSTEM_ADMIN']}>
                  <UsersAdminPage />
                </RequireAuth>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </InstitutionProvider>
    </AuthProvider>
  );
}
