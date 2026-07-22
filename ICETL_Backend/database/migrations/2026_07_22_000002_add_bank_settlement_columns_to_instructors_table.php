<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('instructors')) {
            return;
        }

        $columns = [
            'bankAccountHolderName' => !Schema::hasColumn('instructors', 'bankAccountHolderName'),
            'bankName' => !Schema::hasColumn('instructors', 'bankName'),
            'bankAccountNumber' => !Schema::hasColumn('instructors', 'bankAccountNumber'),
            'bankIfscCode' => !Schema::hasColumn('instructors', 'bankIfscCode'),
            'bankAccountType' => !Schema::hasColumn('instructors', 'bankAccountType'),
            'bankBranchName' => !Schema::hasColumn('instructors', 'bankBranchName'),
            'bankVerificationStatus' => !Schema::hasColumn('instructors', 'bankVerificationStatus'),
        ];

        if (!in_array(true, $columns, true)) {
            return;
        }

        Schema::table('instructors', function (Blueprint $table) use ($columns): void {
            $afterColumn = Schema::hasColumn('instructors', 'portfolioUrl') ? 'portfolioUrl' : 'id';

            if ($columns['bankAccountHolderName']) {
                $table->string('bankAccountHolderName', 150)->nullable()->after($afterColumn);
                $afterColumn = 'bankAccountHolderName';
            }

            if ($columns['bankName']) {
                $table->string('bankName', 150)->nullable()->after($afterColumn);
                $afterColumn = 'bankName';
            }

            if ($columns['bankAccountNumber']) {
                $table->string('bankAccountNumber', 30)->nullable()->after($afterColumn);
                $afterColumn = 'bankAccountNumber';
            }

            if ($columns['bankIfscCode']) {
                $table->string('bankIfscCode', 11)->nullable()->after($afterColumn);
                $afterColumn = 'bankIfscCode';
            }

            if ($columns['bankAccountType']) {
                $table->string('bankAccountType', 20)->nullable()->after($afterColumn);
                $afterColumn = 'bankAccountType';
            }

            if ($columns['bankBranchName']) {
                $table->string('bankBranchName', 150)->nullable()->after($afterColumn);
                $afterColumn = 'bankBranchName';
            }

            if ($columns['bankVerificationStatus']) {
                $table->string('bankVerificationStatus', 30)->default('Not Submitted')->after($afterColumn);
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('instructors')) {
            return;
        }

        $columns = collect([
            'bankVerificationStatus',
            'bankBranchName',
            'bankAccountType',
            'bankIfscCode',
            'bankAccountNumber',
            'bankName',
            'bankAccountHolderName',
        ])->filter(fn(string $column): bool => Schema::hasColumn('instructors', $column))
            ->values()
            ->all();

        if ($columns === []) {
            return;
        }

        Schema::table('instructors', function (Blueprint $table) use ($columns): void {
            $table->dropColumn($columns);
        });
    }
};
