<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        $hasStateCode = Schema::hasColumn('users', 'stateCode');
        $hasDistrictCode = Schema::hasColumn('users', 'districtCode');
        $hasBranchId = Schema::hasColumn('users', 'branchId');

        if (!$hasStateCode || !$hasDistrictCode || !$hasBranchId) {
            Schema::table('users', function (Blueprint $table) use ($hasStateCode, $hasDistrictCode, $hasBranchId): void {
                if (!$hasStateCode) {
                    $table->integer('stateCode')->nullable()->after('profileStage');
                }

                if (!$hasDistrictCode) {
                    $table->integer('districtCode')->nullable()->after('stateCode');
                }

                if (!$hasBranchId) {
                    $table->unsignedBigInteger('branchId')->nullable()->after('districtCode');
                }
            });
        }

        if (!$this->hasIndex('users', 'users_employee_location_index')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->index(['role', 'deletedFlag', 'stateCode', 'districtCode'], 'users_employee_location_index');
            });
        }

        if (!$this->hasIndex('users', 'users_employee_branch_index')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->index('branchId', 'users_employee_branch_index');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table): void {
            if ($this->hasIndex('users', 'users_employee_location_index')) {
                $table->dropIndex('users_employee_location_index');
            }

            if ($this->hasIndex('users', 'users_employee_branch_index')) {
                $table->dropIndex('users_employee_branch_index');
            }
        });

        $columns = collect(['branchId', 'districtCode', 'stateCode'])
            ->filter(fn(string $column): bool => Schema::hasColumn('users', $column))
            ->values()
            ->all();

        if ($columns !== []) {
            Schema::table('users', function (Blueprint $table) use ($columns): void {
                $table->dropColumn($columns);
            });
        }
    }

    private function hasIndex(string $table, string $index): bool
    {
        return collect(DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$index]))->isNotEmpty();
    }
};
