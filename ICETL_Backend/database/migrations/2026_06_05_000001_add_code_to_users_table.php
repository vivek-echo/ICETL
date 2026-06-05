<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'code')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('code', 32)->nullable()->after('id');
            });
        }

        DB::statement("
            UPDATE users
            SET code = CONCAT(CASE WHEN role = 3 THEN 'INS' ELSE 'LR' END, '_', YEAR(NOW()), '_', id)
            WHERE role IN (2, 3)
                AND (code IS NULL OR TRIM(code) = '')
        ");

        if (!$this->indexExists('users_code_unique')) {
            Schema::table('users', function (Blueprint $table) {
                $table->unique('code', 'users_code_unique');
            });
        }
    }

    public function down(): void
    {
        if ($this->indexExists('users_code_unique')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique('users_code_unique');
            });
        }

        if (Schema::hasColumn('users', 'code')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('code');
            });
        }
    }

    private function indexExists(string $indexName): bool
    {
        try {
            return DB::table('information_schema.statistics')
                ->where('table_schema', DB::getDatabaseName())
                ->where('table_name', 'users')
                ->where('index_name', $indexName)
                ->exists();
        } catch (Throwable) {
            return false;
        }
    }
};
