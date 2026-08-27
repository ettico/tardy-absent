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
import LetterPrintPage from './pages/LetterPrintPage';

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
