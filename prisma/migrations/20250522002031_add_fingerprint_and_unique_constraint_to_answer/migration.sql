/*
  Warnings:

  - Made the column `fingerprint` on table `Answer` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Answer" ALTER COLUMN "fingerprint" SET NOT NULL;
