-- CreateTable
CREATE TABLE "Employee" (
    "empNo" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "rankKind" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sectionManagerEmpNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_sectionManagerEmpNo_fkey" FOREIGN KEY ("sectionManagerEmpNo") REFERENCES "Employee" ("empNo") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleValue" (
    "ruleKey" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "value" TEXT NOT NULL,
    "changedByEmpNo" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("ruleKey", "effectiveFrom"),
    CONSTRAINT "RuleValue_changedByEmpNo_fkey" FOREIGN KEY ("changedByEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holiday" (
    "date" DATETIME NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "addedByEmpNo" TEXT NOT NULL,
    CONSTRAINT "Holiday_addedByEmpNo_fkey" FOREIGN KEY ("addedByEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Application" (
    "applicationNumber" TEXT NOT NULL PRIMARY KEY,
    "applicantEmpNo" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "tripStartDate" DATETIME NOT NULL,
    "tripEndDate" DATETIME NOT NULL,
    "destination" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "totalAmountYen" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" DATETIME,
    "firstApprovedAt" DATETIME,
    "finalApprovedAt" DATETIME,
    "accountingFinalizedAt" DATETIME,
    "paidAt" DATETIME,
    "withdrawnAt" DATETIME,
    "nextApproverEmpNo" TEXT,
    "lateReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "paymentCsvExportId" TEXT,
    CONSTRAINT "Application_applicantEmpNo_fkey" FOREIGN KEY ("applicantEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Application_nextApproverEmpNo_fkey" FOREIGN KEY ("nextApproverEmpNo") REFERENCES "Employee" ("empNo") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Application_paymentCsvExportId_fkey" FOREIGN KEY ("paymentCsvExportId") REFERENCES "PaymentCsvExport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationNumber" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "category" TEXT NOT NULL,
    "fromPlace" TEXT,
    "toPlace" TEXT,
    "transportMode" TEXT,
    "amountYen" INTEGER NOT NULL DEFAULT 0,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "taxiReasons" TEXT,
    "exceedsLodgingCapReason" TEXT,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseLine_applicationNumber_fkey" FOREIGN KEY ("applicationNumber") REFERENCES "Application" ("applicationNumber") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseLineId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSupportingDocument" BOOLEAN NOT NULL DEFAULT false,
    "supportingReason" TEXT,
    CONSTRAINT "Receipt_expenseLineId_fkey" FOREIGN KEY ("expenseLineId") REFERENCES "ExpenseLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationNumber" TEXT NOT NULL,
    "operatorEmpNo" TEXT NOT NULL,
    "actedAs" TEXT NOT NULL DEFAULT 'SELF',
    "operation" TEXT NOT NULL,
    "comment" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalHistory_applicationNumber_fkey" FOREIGN KEY ("applicationNumber") REFERENCES "Application" ("applicationNumber") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalHistory_operatorEmpNo_fkey" FOREIGN KEY ("operatorEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProxyApproverAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "principalEmpNo" TEXT NOT NULL,
    "proxyEmpNo" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "createdByEmpNo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProxyApproverAssignment_principalEmpNo_fkey" FOREIGN KEY ("principalEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProxyApproverAssignment_proxyEmpNo_fkey" FOREIGN KEY ("proxyEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProxyApproverAssignment_createdByEmpNo_fkey" FOREIGN KEY ("createdByEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientEmpNo" TEXT NOT NULL,
    "applicationNumber" TEXT,
    "channel" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "sentAt" DATETIME,
    "readAt" DATETIME,
    "deliveryStatus" TEXT,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_recipientEmpNo_fkey" FOREIGN KEY ("recipientEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Notification_applicationNumber_fkey" FOREIGN KEY ("applicationNumber") REFERENCES "Application" ("applicationNumber") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentCsvExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cutoffDate" DATETIME NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "includedApplicationNumbers" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "totalAmountYen" INTEGER NOT NULL,
    "layoutVersion" TEXT NOT NULL,
    "exportedByEmpNo" TEXT NOT NULL,
    "exportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileRelativePath" TEXT NOT NULL,
    CONSTRAINT "PaymentCsvExport_exportedByEmpNo_fkey" FOREIGN KEY ("exportedByEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HrImportResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importedByEmpNo" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorKind" TEXT NOT NULL DEFAULT 'NONE',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "errorRows" TEXT,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    CONSTRAINT "HrImportResult_importedByEmpNo_fkey" FOREIGN KEY ("importedByEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PiiAccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accessorEmpNo" TEXT NOT NULL,
    "applicationNumber" TEXT,
    "targetEmpNo" TEXT,
    "reasonCode" TEXT NOT NULL,
    "freeNote" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PiiAccessLog_accessorEmpNo_fkey" FOREIGN KEY ("accessorEmpNo") REFERENCES "Employee" ("empNo") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PiiAccessLog_applicationNumber_fkey" FOREIGN KEY ("applicationNumber") REFERENCES "Application" ("applicationNumber") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PiiAccessLog_targetEmpNo_fkey" FOREIGN KEY ("targetEmpNo") REFERENCES "Employee" ("empNo") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "RuleValue_ruleKey_effectiveFrom_idx" ON "RuleValue"("ruleKey", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Application_applicantEmpNo_status_idx" ON "Application"("applicantEmpNo", "status");

-- CreateIndex
CREATE INDEX "Application_nextApproverEmpNo_status_idx" ON "Application"("nextApproverEmpNo", "status");

-- CreateIndex
CREATE INDEX "Application_tripStartDate_tripEndDate_applicantEmpNo_idx" ON "Application"("tripStartDate", "tripEndDate", "applicantEmpNo");

-- CreateIndex
CREATE INDEX "ExpenseLine_applicationNumber_idx" ON "ExpenseLine"("applicationNumber");

-- CreateIndex
CREATE INDEX "Receipt_expenseLineId_idx" ON "Receipt"("expenseLineId");

-- CreateIndex
CREATE INDEX "ApprovalHistory_applicationNumber_occurredAt_idx" ON "ApprovalHistory"("applicationNumber", "occurredAt");

-- CreateIndex
CREATE INDEX "ProxyApproverAssignment_principalEmpNo_startsAt_endsAt_idx" ON "ProxyApproverAssignment"("principalEmpNo", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Notification_recipientEmpNo_readAt_idx" ON "Notification"("recipientEmpNo", "readAt");

-- CreateIndex
CREATE INDEX "PiiAccessLog_accessorEmpNo_occurredAt_idx" ON "PiiAccessLog"("accessorEmpNo", "occurredAt");
