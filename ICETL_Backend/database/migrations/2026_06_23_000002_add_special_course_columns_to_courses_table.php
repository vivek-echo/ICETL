<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'isSpecial')) {
                $table->boolean('isSpecial')->default(false)->after('courseType');
            }

            if (!Schema::hasColumn('courses', 'parentCourseId')) {
                $table->unsignedBigInteger('parentCourseId')->nullable()->after('isSpecial');
            }
        });

        if (!$this->indexExists('courses_parent_course_id_index')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->index('parentCourseId', 'courses_parent_course_id_index');
            });
        }

        if (!$this->indexExists('courses_academic_special_category_index')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->index(
                    ['courseType', 'categoryId', 'isSpecial'],
                    'courses_academic_special_category_index'
                );
            });
        }
    }

    public function down(): void
    {
        if ($this->indexExists('courses_academic_special_category_index')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->dropIndex('courses_academic_special_category_index');
            });
        }

        if ($this->indexExists('courses_parent_course_id_index')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->dropIndex('courses_parent_course_id_index');
            });
        }

        Schema::table('courses', function (Blueprint $table) {
            $columns = array_filter(
                [
                    'parentCourseId',
                    'isSpecial',
                ],
                fn($column) => Schema::hasColumn('courses', $column)
            );

            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }

    private function indexExists(string $indexName): bool
    {
        try {
            return DB::table('information_schema.statistics')
                ->where('table_schema', DB::getDatabaseName())
                ->where('table_name', 'courses')
                ->where('index_name', $indexName)
                ->exists();
        } catch (Throwable) {
            return false;
        }
    }
};
