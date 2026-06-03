ALTER TABLE payment_logs
    ADD COLUMN IF NOT EXISTS courseId BIGINT UNSIGNED NULL AFTER paymentId,
    ADD COLUMN IF NOT EXISTS totalFee DECIMAL(10,2) NULL AFTER courseId,
    ADD COLUMN IF NOT EXISTS amountPaid DECIMAL(10,2) NULL AFTER totalFee,
    ADD COLUMN IF NOT EXISTS amountBalance DECIMAL(10,2) NULL AFTER amountPaid,
    ADD COLUMN IF NOT EXISTS paymentMode VARCHAR(40) NULL AFTER amountBalance,
    ADD COLUMN IF NOT EXISTS paymentBy VARCHAR(40) NULL AFTER paymentMode,
    ADD COLUMN IF NOT EXISTS paymentStatus VARCHAR(50) NULL AFTER paymentBy,
    ADD COLUMN IF NOT EXISTS invoiceNumber VARCHAR(60) NULL AFTER paymentStatus,
    ADD COLUMN IF NOT EXISTS referenceNo VARCHAR(80) NULL AFTER invoiceNumber,
    ADD COLUMN IF NOT EXISTS transactionNo VARCHAR(100) NULL AFTER referenceNo,
    ADD COLUMN IF NOT EXISTS createdBy BIGINT UNSIGNED NULL AFTER transactionNo;

CREATE TABLE IF NOT EXISTS offline_course_installments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    paymentLogId BIGINT UNSIGNED NOT NULL,
    userId BIGINT UNSIGNED NOT NULL,
    courseId BIGINT UNSIGNED NOT NULL,
    installmentNo INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    expectedDate DATE NULL,
    paidDate DATE NULL,
    status ENUM('PAID','PENDING') DEFAULT 'PENDING',
    deletedFlag TINYINT(1) DEFAULT 0,
    createdOn DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedOn DATETIME NULL,
    INDEX offline_course_installments_payment_log_id_index (paymentLogId),
    INDEX offline_course_installments_user_course_index (userId, courseId),
    INDEX offline_course_installments_status_date_index (status, expectedDate)
);
