import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import institutionRoutes from './routes/institutions';
import userRoutes from './routes/users';
import gradeRoutes from './routes/grades';
import classRoutes from './routes/classes';
import studentRoutes from './routes/students';
import reportRoutes from './routes/reports';
import searchRoutes from './routes/search';
import semesterRoutes from './routes/semesters';
import archiveRoutes from './routes/archive';
import calendarRoutes from './routes/calendar';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/calendar', calendarRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'שגיאת שרת פנימית' });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
