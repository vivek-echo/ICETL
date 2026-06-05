ALTER TABLE payment_logs
    ADD COLUMN IF NOT EXISTS courseId BIGINT UNSIGNED NULL AFTER paymentId,
    ADD COLUMN IF NOT EXISTS enrollmentId BIGINT UNSIGNED NULL AFTER courseId,
    ADD COLUMN IF NOT EXISTS installmentId BIGINT UNSIGNED NULL AFTER enrollmentId,
    ADD COLUMN IF NOT EXISTS totalFee DECIMAL(10,2) NULL AFTER installmentId,
    ADD COLUMN IF NOT EXISTS amountPaid DECIMAL(10,2) NULL AFTER totalFee,
    ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) NULL AFTER amountPaid,
    ADD COLUMN IF NOT EXISTS amountBalance DECIMAL(10,2) NULL AFTER amount,
    ADD COLUMN IF NOT EXISTS paymentMode VARCHAR(40) NULL AFTER amountBalance,
    ADD COLUMN IF NOT EXISTS paymentBy VARCHAR(40) NULL AFTER paymentMode,
    ADD COLUMN IF NOT EXISTS paymentType VARCHAR(40) NULL AFTER paymentBy,
    ADD COLUMN IF NOT EXISTS paymentStatus VARCHAR(50) NULL AFTER paymentType,
    ADD COLUMN IF NOT EXISTS invoiceNumber VARCHAR(60) NULL AFTER paymentStatus,
    ADD COLUMN IF NOT EXISTS referenceNo VARCHAR(80) NULL AFTER invoiceNumber,
    ADD COLUMN IF NOT EXISTS transactionNo VARCHAR(100) NULL AFTER referenceNo,
    ADD COLUMN IF NOT EXISTS createdBy BIGINT UNSIGNED NULL AFTER transactionNo,
    ADD COLUMN IF NOT EXISTS paymentFor VARCHAR(80) NULL AFTER createdBy,
    ADD COLUMN IF NOT EXISTS remarks TEXT NULL AFTER paymentFor;

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS enrollmentId BIGINT UNSIGNED NULL AFTER paymentId,
    ADD COLUMN IF NOT EXISTS courseId BIGINT UNSIGNED NULL AFTER enrollmentId,
    ADD COLUMN IF NOT EXISTS installmentId BIGINT UNSIGNED NULL AFTER courseId,
    ADD COLUMN IF NOT EXISTS invoiceType VARCHAR(80) NULL AFTER installmentId,
    ADD COLUMN IF NOT EXISTS invoiceAmount DECIMAL(10,2) NULL AFTER invoiceType,
    ADD COLUMN IF NOT EXISTS paymentType VARCHAR(40) NULL AFTER invoiceAmount,
    ADD COLUMN IF NOT EXISTS transactionNo VARCHAR(100) NULL AFTER paymentType,
    ADD COLUMN IF NOT EXISTS paymentDate DATE NULL AFTER transactionNo,
    ADD COLUMN IF NOT EXISTS invoiceStatus VARCHAR(40) NULL AFTER paymentDate,
    ADD COLUMN IF NOT EXISTS createdBy BIGINT UNSIGNED NULL AFTER invoiceStatus;

CREATE TABLE IF NOT EXISTS offline_course_installments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    paymentLogId BIGINT UNSIGNED NOT NULL,
    userId BIGINT UNSIGNED NOT NULL,
    courseId BIGINT UNSIGNED NOT NULL,
    enrollmentId BIGINT UNSIGNED NULL,
    installmentNo INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    paidAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
    balanceAmount DECIMAL(10,2) NULL,
    paymentStatus VARCHAR(40) NULL,
    expectedDate DATE NULL,
    paidDate DATE NULL,
    paymentDate DATE NULL,
    paymentBy VARCHAR(40) NULL,
    paymentType VARCHAR(40) NULL,
    transactionNo VARCHAR(100) NULL,
    invoiceId BIGINT UNSIGNED NULL,
    remarks TEXT NULL,
    status ENUM('PAID','PENDING','PARTIALLY_PAID','OVERDUE') DEFAULT 'PENDING',
    deletedFlag TINYINT(1) DEFAULT 0,
    createdOn DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedOn DATETIME NULL,
    INDEX offline_course_installments_payment_log_id_index (paymentLogId),
    INDEX offline_course_installments_enrollment_id_index (enrollmentId),
    INDEX offline_course_installments_user_course_index (userId, courseId),
    INDEX offline_course_installments_status_date_index (status, expectedDate)
);

ALTER TABLE offline_course_installments
    ADD COLUMN IF NOT EXISTS paymentBy VARCHAR(40) NULL AFTER paidDate,
    ADD COLUMN IF NOT EXISTS paymentType VARCHAR(40) NULL AFTER paymentBy,
    ADD COLUMN IF NOT EXISTS transactionNo VARCHAR(100) NULL AFTER paymentType,
    ADD COLUMN IF NOT EXISTS enrollmentId BIGINT UNSIGNED NULL AFTER courseId,
    ADD COLUMN IF NOT EXISTS paidAmount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER amount,
    ADD COLUMN IF NOT EXISTS balanceAmount DECIMAL(10,2) NULL AFTER paidAmount,
    ADD COLUMN IF NOT EXISTS paymentStatus VARCHAR(40) NULL AFTER balanceAmount,
    ADD COLUMN IF NOT EXISTS paymentDate DATE NULL AFTER paidDate,
    ADD COLUMN IF NOT EXISTS invoiceId BIGINT UNSIGNED NULL AFTER transactionNo,
    ADD COLUMN IF NOT EXISTS remarks TEXT NULL AFTER invoiceId;

ALTER TABLE offline_course_installments
    MODIFY COLUMN status ENUM('PAID','PENDING','PARTIALLY_PAID','OVERDUE') DEFAULT 'PENDING';

UPDATE offline_course_installments oci
JOIN payment_logs pl ON pl.id = oci.paymentLogId AND pl.deletedFlag = 0
JOIN invoices inv ON inv.orderId = pl.orderId AND inv.deletedFlag = 0
SET oci.invoiceId = inv.id,
    oci.paidAmount = oci.amount,
    oci.balanceAmount = 0,
    oci.paymentStatus = 'PAID',
    oci.status = 'PAID',
    oci.paymentDate = COALESCE(oci.paymentDate, oci.paidDate, DATE(pl.created_at)),
    oci.paidDate = COALESCE(oci.paidDate, oci.paymentDate, DATE(pl.created_at)),
    oci.updatedOn = NOW()
WHERE oci.deletedFlag = 0
  AND oci.expectedDate IS NULL
  AND (
      oci.status = 'PAID'
      OR oci.paymentStatus = 'PAID'
      OR oci.paymentBy IS NOT NULL
      OR oci.paymentType IS NOT NULL
      OR oci.transactionNo IS NOT NULL
      OR oci.paymentDate IS NOT NULL
      OR oci.paidDate IS NOT NULL
  );
