/*
  Warnings:

  - A unique constraint covering the columns `[surveyId,fingerprint]` on the table `Answer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "fingerprint" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Answer_surveyId_fingerprint_key" ON "Answer"("surveyId", "fingerprint");
