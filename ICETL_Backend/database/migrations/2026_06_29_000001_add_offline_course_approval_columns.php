<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $hadApprovalStatus = Schema::hasColumn('courses', 'approvalStatus');
        $hadPublishedFlag = Schema::hasColumn('courses', 'publishedFlag');

        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'createdBy')) {
                $table->unsignedBigInteger('createdBy')->nullable()->after('meetingLink');
            }

            if (!Schema::hasColumn('courses', 'createdByRoleId')) {
                $table->unsignedInteger('createdByRoleId')->nullable()->after('createdBy');
            }

            if (!Schema::hasColumn('courses', 'approvalStatus')) {
                $table->string('approvalStatus', 20)->default('PENDING')->after('createdByRoleId');
            }

            if (!Schema::hasColumn('courses', 'approvedBy')) {
                $table->unsignedBigInteger('approvedBy')->nullable()->after('approvalStatus');
            }

            if (!Schema::hasColumn('courses', 'approvedOn')) {
                $table->timestamp('approvedOn')->nullable()->after('approvedBy');
            }

            if (!Schema::hasColumn('courses', 'rejectedBy')) {
                $table->unsignedBigInteger('rejectedBy')->nullable()->after('approvedOn');
            }

            if (!Schema::hasColumn('courses', 'rejectedOn')) {
                $table->timestamp('rejectedOn')->nullable()->after('rejectedBy');
            }

            if (!Schema::hasColumn('courses', 'rejectionReason')) {
                $table->text('rejectionReason')->nullable()->after('rejectedOn');
            }

            if (!Schema::hasColumn('courses', 'publishedFlag')) {
                $table->boolean('publishedFlag')->default(false)->after('rejectionReason');
            }

            if (!Schema::hasColumn('courses', 'publishedBy')) {
                $table->unsignedBigInteger('publishedBy')->nullable()->after('publishedFlag');
            }

            if (!Schema::hasColumn('courses', 'publishedOn')) {
                $table->timestamp('publishedOn')->nullable()->after('publishedBy');
            }
        });

        $backfillQuery = DB::table('courses')->where('courseType', 2);

        if ($hadApprovalStatus && $hadPublishedFlag) {
            $backfillQuery->where(function ($query): void {
                $query->whereNull('approvalStatus')
                    ->orWhere('approvalStatus', '')
                    ->orWhereNull('publishedFlag');
            });
        }

        $backfillQuery->update([
            'approvalStatus' => DB::raw("CASE WHEN COALESCE(status, 0) = 1 THEN 'APPROVED' ELSE 'PENDING' END"),
            'approvedOn' => DB::raw("CASE WHEN COALESCE(status, 0) = 1 THEN COALESCE(updatedOn, createdOn, NOW()) ELSE approvedOn END"),
            'publishedFlag' => DB::raw('COALESCE(status, 0)'),
            'publishedOn' => DB::raw('CASE WHEN COALESCE(status, 0) = 1 THEN COALESCE(updatedOn, createdOn, NOW()) ELSE publishedOn END'),
        ]);

        if (!$this->indexExists('courses_offline_approval_status_index')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->index(['courseType', 'approvalStatus'], 'courses_offline_approval_status_index');
            });
        }

        if (!$this->indexExists('courses_offline_published_flag_index')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->index(['courseType', 'publishedFlag'], 'courses_offline_published_flag_index');
            });
        }
    }

    public function down(): void
    {
        foreach (['courses_offline_published_flag_index', 'courses_offline_approval_status_index'] as $indexName) {
            if ($this->indexExists($indexName)) {
                Schema::table('courses', function (Blueprint $table) use ($indexName) {
                    $table->dropIndex($indexName);
                });
            }
        }

        Schema::table('courses', function (Blueprint $table) {
            $columns = array_filter(
                [
                    'publishedOn',
                    'publishedBy',
                    'publishedFlag',
                    'rejectionReason',
                    'rejectedOn',
                    'rejectedBy',
                    'approvedOn',
                    'approvedBy',
                    'approvalStatus',
                ],
                fn($column) => Schema::hasColumn('courses', $column)
            );

            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }

    private function indexExists(string $indexName): bool
    {
        try {
            return DB::table('information_schema.statistics')
                ->where('table_schema', DB::getDatabaseName())
                ->where('table_name', 'courses')
                ->where('index_name', $indexName)
                ->exists();
        } catch (Throwable) {
            return false;
        }
    }
};
