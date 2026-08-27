import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

const PALETTE = ['#6C8EBF', '#82B366', '#D6A44A', '#B85C7A'];

async function main() {
  const institution = await prisma.institution.upsert({
    where: { id: 'demo-institution' },
    update: {},
    create: { id: 'demo-institution', name: 'תיכון דמו', currentYearLabel: 'תשפ״ו' },
  });

  const hasOpenSemester = await prisma.semester.findFirst({
    where: { institutionId: institution.id, endedAt: null },
  });
  if (!hasOpenSemester) {
    await prisma.semester.create({ data: { institutionId: institution.id, yearLabel: 'תשפ״ו', term: 1 } });
  }

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: await hashPassword('admin123'),
      fullName: 'מנהלת המערכת',
      role: 'SYSTEM_ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { username: 'secretary' },
    update: {},
    create: {
      username: 'secretary',
      passwordHash: await hashPassword('secretary123'),
      fullName: 'רות המזכירה',
      role: 'SECRETARY',
      institutionId: institution.id,
    },
  });

  await prisma.user.upsert({
    where: { username: 'principal' },
    update: {},
    create: {
      username: 'principal',
      passwordHash: await hashPassword('principal123'),
      fullName: 'מנהלת בית הספר',
      role: 'PRINCIPAL',
      email: 'principal@example.com',
      institutionId: institution.id,
    },
  });

  const gradeNames = ['ט', 'י', 'יא', 'יב'];
  const grades = [];
  for (let i = 0; i < gradeNames.length; i++) {
    const grade = await prisma.grade.upsert({
      where: { institutionId_name: { institutionId: institution.id, name: gradeNames[i] } },
      update: {},
      create: { name: gradeNames[i], color: PALETTE[i % PALETTE.length], order: i, institutionId: institution.id },
    });
    grades.push(grade);
  }

  const classesByGrade: Record<string, string[]> = {
    'ט': ['ט1', 'ט2', 'ט3'],
    'י': ['י1', 'י2'],
    'יא': ['יא1', 'יא2'],
    'יב': ['יב1'],
  };

  const demoNames = [
    'נועה כהן', 'שירה לוי', 'מיכל אברהם', 'תמר דוד', 'יעל פרץ',
    'רוני מזרחי', 'הדר בן דוד', 'ליאור אזולאי', 'אילנה שרון', 'דנה יוסף',
  ];

  for (const grade of grades) {
    for (const className of classesByGrade[grade.name] ?? []) {
      const classRoom = await prisma.classRoom.upsert({
        where: { gradeId_name_archived: { gradeId: grade.id, name: className, archived: false } },
        update: {},
        create: { name: className, gradeId: grade.id },
      });

      const existingStudents = await prisma.student.count({ where: { classId: classRoom.id } });
      if (existingStudents === 0) {
        for (let i = 0; i < 5; i++) {
          await prisma.student.create({
            data: {
              fullName: demoNames[(i * 3 + className.length) % demoNames.length] + ` (${className})`,
              nationalId: String(200000000 + Math.floor(Math.random() * 90000000)),
              classId: classRoom.id,
            },
          });
        }
      }
    }
  }

  console.log('Seed complete. Demo logins: admin/admin123, secretary/secretary123, principal/principal123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
