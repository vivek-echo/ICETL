<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('instructor_payouts')) {
            Schema::create('instructor_payouts', function (Blueprint $table): void {
                $table->id();
                $table->string('payoutReference', 80)->unique();
                $table->unsignedBigInteger('instructorUserId')->index();
                $table->unsignedBigInteger('adminUserId')->nullable()->index();
                $table->unsignedBigInteger('orderId')->nullable()->index();
                $table->unsignedBigInteger('paymentId')->nullable()->index();
                $table->unsignedBigInteger('invoiceId')->nullable()->index();
                $table->string('invoiceNumber', 60)->nullable();
                $table->decimal('totalSalesAmount', 12, 2)->default(0);
                $table->decimal('commissionPercent', 5, 2)->default(40);
                $table->decimal('payoutAmount', 12, 2)->default(0);
                $table->string('currency', 10)->default('INR');
                $table->string('status', 40)->default('initiated');
                $table->longText('bankSnapshot')->nullable();
                $table->text('remarks')->nullable();
                $table->timestamp('initiatedAt')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('instructor_payout_items')) {
            Schema::create('instructor_payout_items', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('payoutId')->index();
                $table->unsignedBigInteger('instructorUserId')->index();
                $table->unsignedBigInteger('orderItemId')->index();
                $table->unsignedBigInteger('orderId')->index();
                $table->unsignedBigInteger('paymentId')->nullable()->index();
                $table->unsignedBigInteger('courseId')->index();
                $table->string('courseCode', 32)->nullable();
                $table->string('courseTitle', 255)->nullable();
                $table->unsignedBigInteger('learnerUserId')->nullable()->index();
                $table->decimal('saleAmount', 12, 2)->default(0);
                $table->decimal('taxAmount', 12, 2)->default(0);
                $table->decimal('saleTotalAmount', 12, 2)->default(0);
                $table->decimal('commissionPercent', 5, 2)->default(40);
                $table->decimal('payoutAmount', 12, 2)->default(0);
                $table->string('currency', 10)->default('INR');
                $table->boolean('deletedFlag')->default(false);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('instructor_payout_items');
        Schema::dropIfExists('instructor_payouts');
    }
};
