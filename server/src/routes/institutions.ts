import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Only the global SYSTEM_ADMIN manages institutions.
router.use(requireAuth, requireRole('SYSTEM_ADMIN'));

router.get('/', async (_req, res) => {
  const institutions = await prisma.institution.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { users: true, grades: true } } },
  });
  res.json(institutions);
});

const createSchema = z.object({ name: z.string().min(2) });

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'יש להזין שם מוסד תקין' });
  }
  const institution = await prisma.institution.create({ data: { name: parsed.data.name } });
  res.status(201).json(institution);
});

export default router;
