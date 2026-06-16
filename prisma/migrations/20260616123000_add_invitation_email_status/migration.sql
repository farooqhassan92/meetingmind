ALTER TABLE "OrganizationInvitation"
ADD COLUMN "emailSentAt" TIMESTAMP(3),
ADD COLUMN "emailMessageId" TEXT,
ADD COLUMN "emailError" TEXT;
