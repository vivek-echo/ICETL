<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('payment_logs')) {
            Schema::table('payment_logs', function (Blueprint $table) {
                if (!Schema::hasColumn('payment_logs', 'courseId')) {
                    $table->unsignedBigInteger('courseId')->nullable()->after('paymentId');
                }

                if (!Schema::hasColumn('payment_logs', 'totalFee')) {
                    $table->decimal('totalFee', 10, 2)->nullable()->after('courseId');
                }

                if (!Schema::hasColumn('payment_logs', 'amountPaid')) {
                    $table->decimal('amountPaid', 10, 2)->nullable()->after('totalFee');
                }

                if (!Schema::hasColumn('payment_logs', 'amountBalance')) {
                    $table->decimal('amountBalance', 10, 2)->nullable()->after('amountPaid');
                }

                if (!Schema::hasColumn('payment_logs', 'paymentMode')) {
                    $table->string('paymentMode', 40)->nullable()->after('amountBalance');
                }

                if (!Schema::hasColumn('payment_logs', 'paymentBy')) {
                    $table->string('paymentBy', 40)->nullable()->after('paymentMode');
                }

                if (!Schema::hasColumn('payment_logs', 'paymentStatus')) {
                    $table->string('paymentStatus', 50)->nullable()->after('paymentBy');
                }

                if (!Schema::hasColumn('payment_logs', 'invoiceNumber')) {
                    $table->string('invoiceNumber', 60)->nullable()->after('paymentStatus');
                }

                if (!Schema::hasColumn('payment_logs', 'referenceNo')) {
                    $table->string('referenceNo', 80)->nullable()->after('invoiceNumber');
                }

                if (!Schema::hasColumn('payment_logs', 'transactionNo')) {
                    $table->string('transactionNo', 100)->nullable()->after('referenceNo');
                }

                if (!Schema::hasColumn('payment_logs', 'createdBy')) {
                    $table->unsignedBigInteger('createdBy')->nullable()->after('transactionNo');
                }
            });
        }

        if (!Schema::hasTable('offline_course_installments')) {
            Schema::create('offline_course_installments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('paymentLogId');
                $table->unsignedBigInteger('userId');
                $table->unsignedBigInteger('courseId');
                $table->integer('installmentNo');
                $table->decimal('amount', 10, 2);
                $table->date('expectedDate')->nullable();
                $table->date('paidDate')->nullable();
                $table->enum('status', ['PAID', 'PENDING'])->default('PENDING');
                $table->boolean('deletedFlag')->default(false);
                $table->timestamp('createdOn')->nullable();
                $table->timestamp('updatedOn')->nullable();

                $table->index('paymentLogId', 'offline_course_installments_payment_log_id_index');
                $table->index(['userId', 'courseId'], 'offline_course_installments_user_course_index');
                $table->index(['status', 'expectedDate'], 'offline_course_installments_status_date_index');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_course_installments');

        if (Schema::hasTable('payment_logs')) {
            Schema::table('payment_logs', function (Blueprint $table) {
                $columns = [
                    'courseId',
                    'totalFee',
                    'amountPaid',
                    'amountBalance',
                    'paymentMode',
                    'paymentBy',
                    'paymentStatus',
                    'invoiceNumber',
                    'referenceNo',
                    'transactionNo',
                    'createdBy',
                ];

                foreach ($columns as $column) {
                    if (Schema::hasColumn('payment_logs', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
