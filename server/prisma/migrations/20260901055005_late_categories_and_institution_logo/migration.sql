-- AlterTable
ALTER TABLE "AttendanceEvent" ADD COLUMN "lateApproved" BOOLEAN;

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN "logoDataUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "totalLateCount" INTEGER NOT NULL DEFAULT 0,
    "totalLateApprovedCount" INTEGER NOT NULL DEFAULT 0,
    "totalLateUnapprovedCount" INTEGER NOT NULL DEFAULT 0,
    "totalAbsenceCount" INTEGER NOT NULL DEFAULT 0,
    "totalReleaseCount" INTEGER NOT NULL DEFAULT 0,
    "cycleLateCount" INTEGER NOT NULL DEFAULT 0,
    "needsAssignment" BOOLEAN NOT NULL DEFAULT false,
    "assignmentsRequired" INTEGER NOT NULL DEFAULT 0,
    "assignmentsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("assignmentsRequired", "assignmentsSubmitted", "blocked", "classId", "createdAt", "cycleLateCount", "fullName", "id", "nationalId", "needsAssignment", "totalAbsenceCount", "totalLateCount", "totalReleaseCount") SELECT "assignmentsRequired", "assignmentsSubmitted", "blocked", "classId", "createdAt", "cycleLateCount", "fullName", "id", "nationalId", "needsAssignment", "totalAbsenceCount", "totalLateCount", "totalReleaseCount" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
