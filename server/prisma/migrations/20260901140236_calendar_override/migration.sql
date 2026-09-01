-- CreateTable
CREATE TABLE "CalendarOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "isStudyDay" BOOLEAN NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarOverride_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CalendarOverride_institutionId_idx" ON "CalendarOverride"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarOverride_institutionId_date_key" ON "CalendarOverride"("institutionId", "date");
