<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->unsignedInteger('duration')->default(1)->after('instructorIds');
            $table->integer('durationUnit')->default(1)->comment('1-> weeks ,2->months')->after('duration');
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['duration', 'durationUnit']);
        });
    }
};
