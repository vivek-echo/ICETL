ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS isSpecial TINYINT(1) NOT NULL DEFAULT 0 AFTER courseType,
    ADD COLUMN IF NOT EXISTS parentCourseId BIGINT UNSIGNED NULL AFTER isSpecial;

CREATE INDEX IF NOT EXISTS courses_parent_course_id_index
    ON courses (parentCourseId);

CREATE INDEX IF NOT EXISTS courses_academic_special_category_index
    ON courses (courseType, categoryId, isSpecial);
