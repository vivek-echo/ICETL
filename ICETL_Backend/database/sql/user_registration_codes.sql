ALTER TABLE users
    ADD COLUMN IF NOT EXISTS code VARCHAR(32) NULL AFTER id;

SET SQL_SAFE_UPDATES = 0;

UPDATE users
SET code = CONCAT(
    CASE
        WHEN role = 3 THEN 'INS'
        ELSE 'LR'
    END,
    '_',
    YEAR(NOW()),
    '_',
    id
)
WHERE
    role IN (2, 3)
    AND (code IS NULL OR TRIM(code) = '');

CREATE UNIQUE INDEX IF NOT EXISTS users_code_unique ON users (code);

SET SQL_SAFE_UPDATES = 1;
