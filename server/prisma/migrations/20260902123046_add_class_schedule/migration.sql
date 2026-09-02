-- AlterTable
ALTER TABLE "AttendanceEvent" ADD COLUMN "periodsMissed" INTEGER;

-- CreateTable
CREATE TABLE "SchedulePeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    CONSTRAINT "SchedulePeriod_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassDaySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "periodsCount" INTEGER NOT NULL,
    CONSTRAINT "ClassDaySchedule_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "totalPeriodsMissed" INTEGER NOT NULL DEFAULT 0,
    "cycleLateCount" INTEGER NOT NULL DEFAULT 0,
    "needsAssignment" BOOLEAN NOT NULL DEFAULT false,
    "assignmentsRequired" INTEGER NOT NULL DEFAULT 0,
    "assignmentsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("assignmentsRequired", "assignmentsSubmitted", "blocked", "classId", "createdAt", "cycleLateCount", "fullName", "id", "nationalId", "needsAssignment", "totalAbsenceCount", "totalLateApprovedCount", "totalLateCount", "totalLateUnapprovedCount", "totalReleaseCount") SELECT "assignmentsRequired", "assignmentsSubmitted", "blocked", "classId", "createdAt", "cycleLateCount", "fullName", "id", "nationalId", "needsAssignment", "totalAbsenceCount", "totalLateApprovedCount", "totalLateCount", "totalLateUnapprovedCount", "totalReleaseCount" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SchedulePeriod_institutionId_idx" ON "SchedulePeriod"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePeriod_institutionId_periodNumber_key" ON "SchedulePeriod"("institutionId", "periodNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClassDaySchedule_classId_weekday_key" ON "ClassDaySchedule"("classId", "weekday");
