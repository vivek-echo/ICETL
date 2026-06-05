<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
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

                if (!Schema::hasColumn('payment_logs', 'enrollmentId')) {
                    $table->unsignedBigInteger('enrollmentId')->nullable()->after('courseId');
                }

                if (!Schema::hasColumn('payment_logs', 'installmentId')) {
                    $table->unsignedBigInteger('installmentId')->nullable()->after('enrollmentId');
                }

                if (!Schema::hasColumn('payment_logs', 'totalFee')) {
                    $table->decimal('totalFee', 10, 2)->nullable()->after('installmentId');
                }

                if (!Schema::hasColumn('payment_logs', 'amountPaid')) {
                    $table->decimal('amountPaid', 10, 2)->nullable()->after('totalFee');
                }

                if (!Schema::hasColumn('payment_logs', 'amount')) {
                    $table->decimal('amount', 10, 2)->nullable()->after('amountPaid');
                }

                if (!Schema::hasColumn('payment_logs', 'amountBalance')) {
                    $table->decimal('amountBalance', 10, 2)->nullable()->after('amount');
                }

                if (!Schema::hasColumn('payment_logs', 'paymentMode')) {
                    $table->string('paymentMode', 40)->nullable()->after('amountBalance');
                }

                if (!Schema::hasColumn('payment_logs', 'paymentBy')) {
                    $table->string('paymentBy', 40)->nullable()->after('paymentMode');
                }

                if (!Schema::hasColumn('payment_logs', 'paymentType')) {
                    $table->string('paymentType', 40)->nullable()->after('paymentBy');
                }

                if (!Schema::hasColumn('payment_logs', 'paymentStatus')) {
                    $table->string('paymentStatus', 50)->nullable()->after('paymentType');
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

                if (!Schema::hasColumn('payment_logs', 'paymentFor')) {
                    $table->string('paymentFor', 80)->nullable()->after('createdBy');
                }

                if (!Schema::hasColumn('payment_logs', 'remarks')) {
                    $table->text('remarks')->nullable()->after('paymentFor');
                }
            });
        }

        if (Schema::hasTable('invoices')) {
            Schema::table('invoices', function (Blueprint $table) {
                if (!Schema::hasColumn('invoices', 'enrollmentId')) {
                    $table->unsignedBigInteger('enrollmentId')->nullable()->after('paymentId');
                }

                if (!Schema::hasColumn('invoices', 'courseId')) {
                    $table->unsignedBigInteger('courseId')->nullable()->after('enrollmentId');
                }

                if (!Schema::hasColumn('invoices', 'installmentId')) {
                    $table->unsignedBigInteger('installmentId')->nullable()->after('courseId');
                }

                if (!Schema::hasColumn('invoices', 'invoiceType')) {
                    $table->string('invoiceType', 80)->nullable()->after('installmentId');
                }

                if (!Schema::hasColumn('invoices', 'invoiceAmount')) {
                    $table->decimal('invoiceAmount', 10, 2)->nullable()->after('invoiceType');
                }

                if (!Schema::hasColumn('invoices', 'paymentType')) {
                    $table->string('paymentType', 40)->nullable()->after('invoiceAmount');
                }

                if (!Schema::hasColumn('invoices', 'transactionNo')) {
                    $table->string('transactionNo', 100)->nullable()->after('paymentType');
                }

                if (!Schema::hasColumn('invoices', 'paymentDate')) {
                    $table->date('paymentDate')->nullable()->after('transactionNo');
                }

                if (!Schema::hasColumn('invoices', 'invoiceStatus')) {
                    $table->string('invoiceStatus', 40)->nullable()->after('paymentDate');
                }

                if (!Schema::hasColumn('invoices', 'createdBy')) {
                    $table->unsignedBigInteger('createdBy')->nullable()->after('invoiceStatus');
                }
            });
        }

        if (!Schema::hasTable('offline_course_installments')) {
            Schema::create('offline_course_installments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('paymentLogId');
                $table->unsignedBigInteger('userId');
                $table->unsignedBigInteger('courseId');
                $table->unsignedBigInteger('enrollmentId')->nullable();
                $table->integer('installmentNo');
                $table->decimal('amount', 10, 2);
                $table->decimal('paidAmount', 10, 2)->default(0);
                $table->decimal('balanceAmount', 10, 2)->nullable();
                $table->string('paymentStatus', 40)->nullable();
                $table->date('expectedDate')->nullable();
                $table->date('paidDate')->nullable();
                $table->date('paymentDate')->nullable();
                $table->string('paymentBy', 40)->nullable();
                $table->string('paymentType', 40)->nullable();
                $table->string('transactionNo', 100)->nullable();
                $table->unsignedBigInteger('invoiceId')->nullable();
                $table->text('remarks')->nullable();
                $table->enum('status', ['PAID', 'PENDING', 'PARTIALLY_PAID', 'OVERDUE'])->default('PENDING');
                $table->boolean('deletedFlag')->default(false);
                $table->timestamp('createdOn')->nullable();
                $table->timestamp('updatedOn')->nullable();

                $table->index('paymentLogId', 'offline_course_installments_payment_log_id_index');
                $table->index('enrollmentId', 'offline_course_installments_enrollment_id_index');
                $table->index(['userId', 'courseId'], 'offline_course_installments_user_course_index');
                $table->index(['status', 'expectedDate'], 'offline_course_installments_status_date_index');
            });
        }

        if (Schema::hasTable('offline_course_installments')) {
            Schema::table('offline_course_installments', function (Blueprint $table) {
                if (!Schema::hasColumn('offline_course_installments', 'paymentBy')) {
                    $table->string('paymentBy', 40)->nullable()->after('paidDate');
                }

                if (!Schema::hasColumn('offline_course_installments', 'paymentType')) {
                    $table->string('paymentType', 40)->nullable()->after('paymentBy');
                }

                if (!Schema::hasColumn('offline_course_installments', 'transactionNo')) {
                    $table->string('transactionNo', 100)->nullable()->after('paymentType');
                }

                if (!Schema::hasColumn('offline_course_installments', 'enrollmentId')) {
                    $table->unsignedBigInteger('enrollmentId')->nullable()->after('courseId');
                }

                if (!Schema::hasColumn('offline_course_installments', 'paidAmount')) {
                    $table->decimal('paidAmount', 10, 2)->default(0)->after('amount');
                }

                if (!Schema::hasColumn('offline_course_installments', 'balanceAmount')) {
                    $table->decimal('balanceAmount', 10, 2)->nullable()->after('paidAmount');
                }

                if (!Schema::hasColumn('offline_course_installments', 'paymentStatus')) {
                    $table->string('paymentStatus', 40)->nullable()->after('balanceAmount');
                }

                if (!Schema::hasColumn('offline_course_installments', 'paymentDate')) {
                    $table->date('paymentDate')->nullable()->after('paidDate');
                }

                if (!Schema::hasColumn('offline_course_installments', 'invoiceId')) {
                    $table->unsignedBigInteger('invoiceId')->nullable()->after('transactionNo');
                }

                if (!Schema::hasColumn('offline_course_installments', 'remarks')) {
                    $table->text('remarks')->nullable()->after('invoiceId');
                }
            });

            if (DB::getDriverName() === 'mysql') {
                DB::statement("ALTER TABLE offline_course_installments MODIFY COLUMN status ENUM('PAID','PENDING','PARTIALLY_PAID','OVERDUE') DEFAULT 'PENDING'");
            }
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
