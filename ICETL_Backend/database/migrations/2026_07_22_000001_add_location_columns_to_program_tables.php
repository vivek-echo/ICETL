<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLES = ['courses', 'workshops', 'seminars'];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            $hasStateCode = Schema::hasColumn($tableName, 'stateCode');
            $hasDistrictCode = Schema::hasColumn($tableName, 'districtCode');
            $hasBranchId = Schema::hasColumn($tableName, 'branchId');

            if (!$hasStateCode || !$hasDistrictCode || !$hasBranchId) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName, $hasStateCode, $hasDistrictCode, $hasBranchId): void {
                    $afterColumn = Schema::hasColumn($tableName, 'city') ? 'city' : 'id';

                    if (!$hasStateCode) {
                        $table->integer('stateCode')->nullable()->after($afterColumn);
                        $afterColumn = 'stateCode';
                    }

                    if (!$hasDistrictCode) {
                        $table->integer('districtCode')->nullable()->after($afterColumn);
                        $afterColumn = 'districtCode';
                    }

                    if (!$hasBranchId) {
                        $table->unsignedBigInteger('branchId')->nullable()->after($afterColumn);
                    }
                });
            }

            $locationIndex = "{$tableName}_program_location_index";
            if (!$this->hasIndex($tableName, $locationIndex)) {
                Schema::table($tableName, function (Blueprint $table) use ($locationIndex): void {
                    $table->index(['stateCode', 'districtCode'], $locationIndex);
                });
            }

            $branchIndex = "{$tableName}_program_branch_index";
            if (!$this->hasIndex($tableName, $branchIndex)) {
                Schema::table($tableName, function (Blueprint $table) use ($branchIndex): void {
                    $table->index('branchId', $branchIndex);
                });
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $tableName) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName): void {
                $locationIndex = "{$tableName}_program_location_index";
                if ($this->hasIndex($tableName, $locationIndex)) {
                    $table->dropIndex($locationIndex);
                }

                $branchIndex = "{$tableName}_program_branch_index";
                if ($this->hasIndex($tableName, $branchIndex)) {
                    $table->dropIndex($branchIndex);
                }
            });

            $columns = collect(['branchId', 'districtCode', 'stateCode'])
                ->filter(fn(string $column): bool => Schema::hasColumn($tableName, $column))
                ->values()
                ->all();

            if ($columns !== []) {
                Schema::table($tableName, function (Blueprint $table) use ($columns): void {
                    $table->dropColumn($columns);
                });
            }
        }
    }

    private function hasIndex(string $table, string $index): bool
    {
        return collect(DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$index]))->isNotEmpty();
    }
};
