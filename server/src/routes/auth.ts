import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { comparePassword } from '../utils/password';
import { signToken, requireAuth } from '../middleware/auth';
import { Role } from '../types';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'יש להזין שם משתמש וסיסמה' });
  }
  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }

  const authUser = {
    id: user.id,
    username: user.username,
    role: user.role as Role,
    institutionId: user.institutionId,
    fullName: user.fullName,
  };
  const token = signToken(authUser);
  res.json({ token, user: authUser });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
