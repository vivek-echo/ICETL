<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'dob')) {
                $table->date('dob')->nullable()->after('phone');
            }

            if (!Schema::hasColumn('users', 'gender')) {
                $table->string('gender', 20)->nullable()->after('dob');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'gender')) {
                $table->dropColumn('gender');
            }

            if (Schema::hasColumn('users', 'dob')) {
                $table->dropColumn('dob');
            }
        });
    }
};
