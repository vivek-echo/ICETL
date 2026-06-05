ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS code VARCHAR(32) NULL AFTER id;

ALTER TABLE workshops
    ADD COLUMN IF NOT EXISTS code VARCHAR(32) NULL AFTER id;

ALTER TABLE seminars
    ADD COLUMN IF NOT EXISTS code VARCHAR(32) NULL AFTER id;

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS entityType VARCHAR(50) NULL AFTER invoiceNumber,
    ADD COLUMN IF NOT EXISTS entityId BIGINT UNSIGNED NULL AFTER entityType,
    ADD COLUMN IF NOT EXISTS entityCode VARCHAR(32) NULL AFTER entityId,
    ADD COLUMN IF NOT EXISTS entityTitle VARCHAR(255) NULL AFTER entityCode;

ALTER TABLE payment_logs
    ADD COLUMN IF NOT EXISTS entityType VARCHAR(50) NULL AFTER paymentId,
    ADD COLUMN IF NOT EXISTS entityId BIGINT UNSIGNED NULL AFTER entityType,
    ADD COLUMN IF NOT EXISTS entityCode VARCHAR(32) NULL AFTER entityId,
    ADD COLUMN IF NOT EXISTS entityTitle VARCHAR(255) NULL AFTER entityCode;

SET SQL_SAFE_UPDATES = 0;

UPDATE courses
SET code = CONCAT(
    CASE WHEN COALESCE(courseType, 1) = 2 THEN 'AC' ELSE 'MC' END,
    '_',
    YEAR(COALESCE(createdOn, NOW())),
    '_',
    id
)
WHERE code IS NULL OR TRIM(code) = '';

UPDATE workshops
SET code = CONCAT('WS_', YEAR(COALESCE(createdOn, NOW())), '_', id)
WHERE code IS NULL OR TRIM(code) = '';

UPDATE seminars
SET code = CONCAT('SM_', YEAR(COALESCE(createdOn, NOW())), '_', id)
WHERE code IS NULL OR TRIM(code) = '';

UPDATE invoices i
JOIN courses c ON c.id = i.courseId
SET
    i.entityType = CASE WHEN COALESCE(c.courseType, 1) = 2 THEN 'Academic Course' ELSE 'Main Course' END,
    i.entityId = c.id,
    i.entityCode = c.code,
    i.entityTitle = c.title
WHERE
    i.courseId IS NOT NULL
    AND (i.entityCode IS NULL OR TRIM(i.entityCode) = '');

UPDATE invoices i
JOIN (
    SELECT
        oi.orderId,
        MIN(c.id) AS courseId,
        MIN(c.code) AS courseCode,
        MIN(c.title) AS courseTitle,
        MIN(COALESCE(c.courseType, 1)) AS courseType,
        COUNT(DISTINCT oi.courseId) AS courseCount
    FROM order_items oi
    JOIN courses c ON c.id = oi.courseId
    WHERE oi.deletedFlag = 0
    GROUP BY oi.orderId
    HAVING courseCount = 1
) single_course ON single_course.orderId = i.orderId
SET
    i.entityType = CASE WHEN single_course.courseType = 2 THEN 'Academic Course' ELSE 'Main Course' END,
    i.entityId = single_course.courseId,
    i.entityCode = single_course.courseCode,
    i.entityTitle = single_course.courseTitle
WHERE
    i.orderId IS NOT NULL
    AND (i.entityCode IS NULL OR TRIM(i.entityCode) = '');

UPDATE payment_logs pl
JOIN courses c ON c.id = pl.courseId
SET
    pl.entityType = CASE WHEN COALESCE(c.courseType, 1) = 2 THEN 'Academic Course' ELSE 'Main Course' END,
    pl.entityId = c.id,
    pl.entityCode = c.code,
    pl.entityTitle = c.title
WHERE
    pl.courseId IS NOT NULL
    AND (pl.entityCode IS NULL OR TRIM(pl.entityCode) = '');

UPDATE payment_logs pl
JOIN (
    SELECT
        oi.orderId,
        MIN(c.id) AS courseId,
        MIN(c.code) AS courseCode,
        MIN(c.title) AS courseTitle,
        MIN(COALESCE(c.courseType, 1)) AS courseType,
        COUNT(DISTINCT oi.courseId) AS courseCount
    FROM order_items oi
    JOIN courses c ON c.id = oi.courseId
    WHERE oi.deletedFlag = 0
    GROUP BY oi.orderId
    HAVING courseCount = 1
) single_course ON single_course.orderId = pl.orderId
SET
    pl.entityType = CASE WHEN single_course.courseType = 2 THEN 'Academic Course' ELSE 'Main Course' END,
    pl.entityId = single_course.courseId,
    pl.entityCode = single_course.courseCode,
    pl.entityTitle = single_course.courseTitle
WHERE
    pl.orderId IS NOT NULL
    AND (pl.entityCode IS NULL OR TRIM(pl.entityCode) = '');

CREATE UNIQUE INDEX IF NOT EXISTS courses_code_unique ON courses (code);
CREATE UNIQUE INDEX IF NOT EXISTS workshops_code_unique ON workshops (code);
CREATE UNIQUE INDEX IF NOT EXISTS seminars_code_unique ON seminars (code);

CREATE INDEX IF NOT EXISTS invoices_entity_code_index ON invoices (entityCode);
CREATE INDEX IF NOT EXISTS payment_logs_entity_code_index ON payment_logs (entityCode);

SET SQL_SAFE_UPDATES = 1;
