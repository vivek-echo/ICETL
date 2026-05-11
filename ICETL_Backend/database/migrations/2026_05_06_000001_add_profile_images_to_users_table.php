<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'profileImg')) {
                $table->string('profileImg')->nullable()->after('gender');
            }

            if (!Schema::hasColumn('users', 'thumbnailImg')) {
                $table->string('thumbnailImg')->nullable()->after('profileImg');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'thumbnailImg')) {
                $table->dropColumn('thumbnailImg');
            }

            if (Schema::hasColumn('users', 'profileImg')) {
                $table->dropColumn('profileImg');
            }
        });
    }
};
