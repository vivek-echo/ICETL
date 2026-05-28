<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'duration')) {
                $table->unsignedInteger('duration')->default(1)->after('instructorIds');
            }

            if (!Schema::hasColumn('courses', 'durationUnit')) {
                $table->integer('durationUnit')->default(1)->comment('1-> weeks ,2->months')->after('duration');
            }
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $columns = array_filter(
                ['duration', 'durationUnit'],
                fn($column) => Schema::hasColumn('courses', $column)
            );

            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};
