<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'courseType')) {
                $table->unsignedTinyInteger('courseType')->default(1)->comment('1->online, 2->offline');
            }

            if (!Schema::hasColumn('courses', 'venue')) {
                $table->string('venue', 150)->nullable();
            }

            if (!Schema::hasColumn('courses', 'city')) {
                $table->string('city', 100)->nullable();
            }

            if (!Schema::hasColumn('courses', 'startDate')) {
                $table->date('startDate')->nullable();
            }

            if (!Schema::hasColumn('courses', 'endDate')) {
                $table->date('endDate')->nullable();
            }

            if (!Schema::hasColumn('courses', 'startTime')) {
                $table->time('startTime')->nullable();
            }

            if (!Schema::hasColumn('courses', 'endTime')) {
                $table->time('endTime')->nullable();
            }

            if (!Schema::hasColumn('courses', 'youtubeLiveUrl')) {
                $table->string('youtubeLiveUrl', 255)->nullable();
            }

            if (!Schema::hasColumn('courses', 'meetingLink')) {
                $table->string('meetingLink', 255)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $columns = array_filter(
                [
                    'courseType',
                    'venue',
                    'city',
                    'startDate',
                    'endDate',
                    'startTime',
                    'endTime',
                    'youtubeLiveUrl',
                    'meetingLink',
                ],
                fn($column) => Schema::hasColumn('courses', $column)
            );

            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};
