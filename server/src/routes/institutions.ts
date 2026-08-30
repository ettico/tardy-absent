import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, resolveInstitutionId } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(requireAuth);

// Any authenticated role can look up the institution they're currently
// scoped to (a secretary/principal's own institution, or the one a system
// admin has selected) - used to show its name and current school year.
router.get('/current', requireRole('SYSTEM_ADMIN', 'SECRETARY', 'PRINCIPAL'), asyncHandler(async (req, res) => {
  const institutionId = resolveInstitutionId(req);
  if (!institutionId) return res.status(400).json({ error: 'לא נבחר מוסד' });
  const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
  if (!institution) return res.status(404).json({ error: 'מוסד לא נמצא' });
  res.json(institution);
}));

// Everything else here manages institutions themselves - global SYSTEM_ADMIN only.
router.use(requireRole('SYSTEM_ADMIN'));

router.get('/', asyncHandler(async (_req, res) => {
  const institutions = await prisma.institution.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { users: true, grades: true } } },
  });
  res.json(institutions);
}));

const createSchema = z.object({ name: z.string().min(2), initialYearLabel: z.string().optional() });

router.post('/', asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'יש להזין שם מוסד תקין' });
  }
  const institution = await prisma.institution.create({
    data: { name: parsed.data.name, currentYearLabel: parsed.data.initialYearLabel || null },
  });
  await prisma.semester.create({
    data: { institutionId: institution.id, yearLabel: parsed.data.initialYearLabel || '', term: 1 },
  });
  res.status(201).json(institution);
}));

export default router;
