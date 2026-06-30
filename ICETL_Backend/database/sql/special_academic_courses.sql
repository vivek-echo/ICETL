ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS isSpecial TINYINT(1) NOT NULL DEFAULT 0 AFTER courseType,
    ADD COLUMN IF NOT EXISTS parentCourseId BIGINT UNSIGNED NULL AFTER isSpecial;

CREATE INDEX IF NOT EXISTS courses_parent_course_id_index
    ON courses (parentCourseId);

CREATE INDEX IF NOT EXISTS courses_academic_special_category_index
    ON courses (courseType, categoryId, isSpecial);

    ALTER TABLE courses ADD createdBy BIGINT UNSIGNED NULL AFTER meetingLink;
ALTER TABLE courses ADD createdByRoleId INT UNSIGNED NULL AFTER createdBy;

ALTER TABLE courses ADD approvalStatus VARCHAR(20) NOT NULL DEFAULT 'PENDING' AFTER createdByRoleId;
ALTER TABLE courses ADD approvedBy BIGINT UNSIGNED NULL AFTER approvalStatus;
ALTER TABLE courses ADD approvedOn TIMESTAMP NULL AFTER approvedBy;

ALTER TABLE courses ADD rejectedBy BIGINT UNSIGNED NULL AFTER approvedOn;
ALTER TABLE courses ADD rejectedOn TIMESTAMP NULL AFTER rejectedBy;
ALTER TABLE courses ADD rejectionReason TEXT NULL AFTER rejectedOn;

ALTER TABLE courses ADD publishedFlag TINYINT(1) NOT NULL DEFAULT 0 AFTER rejectionReason;
ALTER TABLE courses ADD publishedBy BIGINT UNSIGNED NULL AFTER publishedFlag;
ALTER TABLE courses ADD publishedOn TIMESTAMP NULL AFTER publishedBy;

UPDATE courses
SET
  approvalStatus = CASE
    WHEN COALESCE(status, 0) = 1 THEN 'APPROVED'
    ELSE 'PENDING'
  END,
  approvedOn = CASE
    WHEN COALESCE(status, 0) = 1 THEN COALESCE(updatedOn, createdOn, NOW())
    ELSE approvedOn
  END,
  publishedFlag = COALESCE(status, 0),
  publishedOn = CASE
    WHEN COALESCE(status, 0) = 1 THEN COALESCE(updatedOn, createdOn, NOW())
    ELSE publishedOn
  END
WHERE courseType = 2;

CREATE INDEX courses_offline_approval_status_index
ON courses (courseType, approvalStatus);

CREATE INDEX courses_offline_published_flag_index
ON courses (courseType, publishedFlag);
