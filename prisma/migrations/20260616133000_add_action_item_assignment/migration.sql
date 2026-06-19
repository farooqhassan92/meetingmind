ALTER TABLE "ActionItem"
ADD COLUMN "assignedUserId" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "ActionItem_assignedUserId_idx" ON "ActionItem"("assignedUserId");
CREATE INDEX "ActionItem_completed_idx" ON "ActionItem"("completed");

ALTER TABLE "ActionItem"
ADD CONSTRAINT "ActionItem_assignedUserId_fkey"
FOREIGN KEY ("assignedUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
