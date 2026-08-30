import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole } from '../middleware/auth';
import { hashPassword } from '../utils/password';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Only the global SYSTEM_ADMIN registers secretaries / principals.
router.use(requireAuth, requireRole('SYSTEM_ADMIN'));

router.get('/', asyncHandler(async (req, res) => {
  const institutionId = req.query.institutionId as string | undefined;
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['SECRETARY', 'PRINCIPAL'] },
      ...(institutionId ? { institutionId } : {}),
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      email: true,
      institutionId: true,
      institution: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
}));

const createSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.enum(['SECRETARY', 'PRINCIPAL']),
  email: z.string().email().optional().or(z.literal('')),
  institutionId: z.string().min(1),
});

router.post('/', asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'פרטים חסרים או לא תקינים', details: parsed.error.flatten() });
  }
  const { username, password, fullName, role, email, institutionId } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return res.status(409).json({ error: 'שם המשתמש כבר קיים במערכת' });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { username, passwordHash, fullName, role, email: email || null, institutionId },
  });
  res.status(201).json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role });
}));

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['SECRETARY', 'PRINCIPAL']).optional(),
  institutionId: z.string().min(1).optional(),
  password: z.string().min(6).optional().or(z.literal('')),
});

router.patch('/:id', asyncHandler(async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'פרטים לא תקינים', details: parsed.error.flatten() });
  }
  const { password, email, ...rest } = parsed.data;

  const data: Record<string, unknown> = { ...rest };
  if (email !== undefined) data.email = email || null;
  if (password) data.passwordHash = await hashPassword(password);

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, email: user.email });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

export default router;
