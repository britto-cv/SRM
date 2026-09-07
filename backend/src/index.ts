import express, { Request, Response } from 'express';
import cors from 'cors';
import type { NormalizedStudentData } from '@srm/shared';
import connectionRoutes from './routes/connectionRoutes';
import { sessionManager } from './services/PlaywrightSessionManager';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Mount Playwright session connection routes
app.use('/api', connectionRoutes);

// Dummy endpoint to verify shared types usage
app.get('/api/dummy-data', (req: Request, res: Response) => {
  const dummyData: NormalizedStudentData = {
    profile: {
      name: 'Test Student',
      studentId: 'RAXXXXXXXXXXXXX',
      program: 'B.Tech',
      department: 'Computer Science',
    },
    currentSemester: {
      id: 'ODD-2026',
      name: 'Odd Semester 2026',
    },
    subjects: [],
    attendance: []
  };
  res.json(dummyData);
});

const server = app.listen(port, () => {
  console.log(`[SRM] Node process started (PID: ${process.pid})`);
  console.log(`[SRM] Backend service listening at http://localhost:${port}`);
});

// Defensive Cleanup on Process Shutdown
const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down securely...`);
  await sessionManager.cleanup();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
