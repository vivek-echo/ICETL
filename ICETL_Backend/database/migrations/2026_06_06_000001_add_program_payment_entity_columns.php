<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addEntityColumns('order_items', 'courseId');
        $this->addEntityColumns('invoices', 'invoiceNumber');
        $this->addEntityColumns('payment_logs', 'paymentId');
    }

    public function down(): void
    {
        foreach (['order_items', 'invoices', 'payment_logs'] as $tableName) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                foreach (['entityTitle', 'entityCode', 'entityId', 'entityType'] as $column) {
                    if (Schema::hasColumn($tableName, $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }

    private function addEntityColumns(string $tableName, string $afterColumn): void
    {
        if (!Schema::hasTable($tableName)) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table) use ($tableName, $afterColumn) {
            if (!Schema::hasColumn($tableName, 'entityType')) {
                $table->string('entityType', 50)->nullable()->after($afterColumn);
            }

            if (!Schema::hasColumn($tableName, 'entityId')) {
                $table->unsignedBigInteger('entityId')->nullable()->after('entityType');
            }

            if (!Schema::hasColumn($tableName, 'entityCode')) {
                $table->string('entityCode', 60)->nullable()->after('entityId');
            }

            if (!Schema::hasColumn($tableName, 'entityTitle')) {
                $table->string('entityTitle', 255)->nullable()->after('entityCode');
            }
        });
    }
};
