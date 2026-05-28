<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('orders')) {
            Schema::create('orders', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('userId');
                $table->string('orderReference', 80)->unique();
                $table->decimal('subtotalAmount', 10, 2)->default(0);
                $table->decimal('taxAmount', 10, 2)->default(0);
                $table->decimal('totalAmount', 10, 2)->default(0);
                $table->string('currency', 10)->default('INR');
                $table->string('status', 50)->default('pending');
                $table->string('razorpayOrderId')->nullable()->unique();
                $table->timestamp('expiresAt')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamps();

                $table->index('userId', 'orders_user_id_index');
                $table->index(['userId', 'status'], 'orders_user_status_index');
            });
        }

        if (!Schema::hasTable('payments')) {
            Schema::create('payments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('orderId');
                $table->unsignedBigInteger('userId');
                $table->string('paymentReference', 80)->unique();
                $table->string('razorpayPaymentId')->nullable();
                $table->string('razorpayOrderId')->nullable();
                $table->string('razorpaySignature')->nullable();
                $table->decimal('amount', 10, 2)->default(0);
                $table->decimal('taxAmount', 10, 2)->default(0);
                $table->decimal('totalAmount', 10, 2)->default(0);
                $table->string('currency', 10)->default('INR');
                $table->string('paymentMethod', 80)->nullable();
                $table->string('status', 50)->default('pending');
                $table->text('failureReason')->nullable();
                $table->timestamp('paidAt')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamps();

                $table->unique('razorpayPaymentId', 'payments_razorpay_payment_id_unique');
                $table->index('razorpayOrderId', 'payments_razorpay_order_id_index');
                $table->index('orderId', 'payments_order_id_index');
                $table->index('userId', 'payments_user_id_index');
                $table->index(['userId', 'status'], 'payments_user_status_index');
            });
        }

        if (!Schema::hasTable('order_items')) {
            Schema::create('order_items', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('orderId');
                $table->unsignedBigInteger('courseId');
                $table->decimal('price', 10, 2)->default(0);
                $table->decimal('taxAmount', 10, 2)->default(0);
                $table->decimal('totalAmount', 10, 2)->default(0);
                $table->boolean('deletedFlag')->default(false);
                $table->timestamps();

                $table->unique(['orderId', 'courseId'], 'order_items_order_course_unique');
                $table->index('courseId', 'order_items_course_id_index');
            });
        }

        if (!Schema::hasTable('enrollments')) {
            Schema::create('enrollments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('userId');
                $table->unsignedBigInteger('courseId');
                $table->unsignedBigInteger('orderId')->nullable();
                $table->unsignedBigInteger('paymentId')->nullable();
                $table->string('status', 50)->default('active');
                $table->unsignedTinyInteger('progressPercent')->default(0);
                $table->timestamp('lastWatchedAt')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamps();

                $table->unique(['userId', 'courseId', 'deletedFlag'], 'enrollments_user_course_deleted_unique');
                $table->index('orderId', 'enrollments_order_id_index');
                $table->index('paymentId', 'enrollments_payment_id_index');
            });
        }

        if (!Schema::hasTable('payment_logs')) {
            Schema::create('payment_logs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('userId')->nullable();
                $table->unsignedBigInteger('orderId')->nullable();
                $table->unsignedBigInteger('paymentId')->nullable();
                $table->string('eventType', 80);
                $table->string('gateway', 40)->default('razorpay');
                $table->string('status', 50)->nullable();
                $table->json('requestPayload')->nullable();
                $table->json('responsePayload')->nullable();
                $table->json('verificationResult')->nullable();
                $table->json('webhookPayload')->nullable();
                $table->longText('errorStack')->nullable();
                $table->string('ipAddress', 64)->nullable();
                $table->text('browserInfo')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamps();

                $table->index(['orderId', 'eventType'], 'payment_logs_order_event_index');
                $table->index('paymentId', 'payment_logs_payment_id_index');
                $table->index('userId', 'payment_logs_user_id_index');
            });
        }

        if (!Schema::hasTable('invoices')) {
            Schema::create('invoices', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('userId');
                $table->unsignedBigInteger('orderId');
                $table->unsignedBigInteger('paymentId');
                $table->string('invoiceNumber', 40)->unique();
                $table->date('invoiceDate');
                $table->string('customerName')->nullable();
                $table->string('customerEmail')->nullable();
                $table->string('customerPhone', 30)->nullable();
                $table->string('gstNumber', 30)->nullable();
                $table->decimal('subtotal', 10, 2)->default(0);
                $table->decimal('tax', 10, 2)->default(0);
                $table->decimal('grandTotal', 10, 2)->default(0);
                $table->string('currency', 10)->default('INR');
                $table->string('paymentReference')->nullable();
                $table->string('pdfPath')->nullable();
                $table->json('invoiceData')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamps();

                $table->unique('orderId', 'invoices_order_id_unique');
                $table->index('userId', 'invoices_user_id_index');
                $table->index('paymentId', 'invoices_payment_id_index');
            });
        }

        if (!Schema::hasTable('refund_requests')) {
            Schema::create('refund_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('userId');
                $table->unsignedBigInteger('orderId');
                $table->unsignedBigInteger('paymentId');
                $table->string('refundReference', 80)->unique();
                $table->string('razorpayRefundId')->nullable()->unique();
                $table->decimal('amount', 10, 2)->default(0);
                $table->string('currency', 10)->default('INR');
                $table->string('status', 50)->default('requested');
                $table->text('reason')->nullable();
                $table->json('gatewayResponse')->nullable();
                $table->timestamp('processedAt')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamps();

                $table->index(['userId', 'status'], 'refund_requests_user_status_index');
                $table->index('orderId', 'refund_requests_order_id_index');
                $table->index('paymentId', 'refund_requests_payment_id_index');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('refund_requests');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('payment_logs');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('orders');
    }
};
