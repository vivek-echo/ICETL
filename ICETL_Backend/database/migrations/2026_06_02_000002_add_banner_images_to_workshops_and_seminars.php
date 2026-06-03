<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('workshops') && !Schema::hasColumn('workshops', 'bannerImage')) {
            Schema::table('workshops', function (Blueprint $table) {
                $table->string('bannerImage')->nullable()->after('takeaways');
            });
        }

        if (Schema::hasTable('seminars') && !Schema::hasColumn('seminars', 'bannerImage')) {
            Schema::table('seminars', function (Blueprint $table) {
                $table->string('bannerImage')->nullable()->after('takeaways');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('workshops') && Schema::hasColumn('workshops', 'bannerImage')) {
            Schema::table('workshops', function (Blueprint $table) {
                $table->dropColumn('bannerImage');
            });
        }

        if (Schema::hasTable('seminars') && Schema::hasColumn('seminars', 'bannerImage')) {
            Schema::table('seminars', function (Blueprint $table) {
                $table->dropColumn('bannerImage');
            });
        }
    }
};
