<?php

namespace App\Http\Controllers;

use App\Services\EntityCodeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Razorpay\Api\Api;
use Razorpay\Api\Errors\SignatureVerificationError;
use Throwable;

class PaymentController extends Controller
{
    private const CURRENCY = 'INR';
    private const TAX_PERCENT = 0;

    public function cartCheckoutInit(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'courseIds' => 'required|array|min:1|max:25',
            'courseIds.*' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $userId = (int) $request->user()->id;
        $courseIds = array_values(array_unique(array_map('intval', $request->input('courseIds', []))));

        try {
            $courses = DB::table('courses')
                ->select('id', 'title', 'price')
                ->whereIn('id', $courseIds)
                ->where('status', 1)
                ->where('deletedFlag', 0)
                ->orderBy('id')
                ->get();

            if ($courses->count() !== count($courseIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Some courses are invalid or unavailable.',
                ], 422);
            }

            $alreadyPurchased = DB::table('enrollments')
                ->where('userId', $userId)
                ->whereIn('courseId', $courseIds)
                ->where('deletedFlag', 0)
                ->exists();

            if ($alreadyPurchased) {
                return response()->json([
                    'success' => false,
                    'message' => 'One or more selected courses are already in your learning library.',
                ], 409);
            }

            $subtotal = round((float) $courses->sum(fn ($course) => (float) $course->price), 2);
            $taxAmount = round($subtotal * self::TAX_PERCENT / 100, 2);
            $totalAmount = round($subtotal + $taxAmount, 2);

            if ($totalAmount <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Checkout amount must be greater than zero.',
                ], 422);
            }

            $api = $this->razorpay();
            $order = null;
            $razorpayOrder = null;

            DB::beginTransaction();

            DB::table('orders')
                ->where('userId', $userId)
                ->where('status', 'pending')
                ->where('deletedFlag', 0)
                ->update(['status' => 'cancelled', 'updated_at' => now()]);

            $orderId = DB::table('orders')->insertGetId([
                'userId' => $userId,
                'orderReference' => $this->reference('ORD'),
                'subtotalAmount' => $subtotal,
                'taxAmount' => $taxAmount,
                'totalAmount' => $totalAmount,
                'currency' => self::CURRENCY,
                'status' => 'pending',
                'expiresAt' => now()->addMinutes(30),
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $orderItems = $courses->map(fn ($course) => [
                'orderId' => $orderId,
                'courseId' => (int) $course->id,
                'price' => (float) $course->price,
                'taxAmount' => 0,
                'totalAmount' => (float) $course->price,
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ])->all();

            DB::table('order_items')->insert($orderItems);

            $razorpayOrder = $api->order->create([
                'receipt' => 'order_' . $orderId,
                'amount' => (int) round($totalAmount * 100),
                'currency' => self::CURRENCY,
                'notes' => [
                    'local_order_id' => (string) $orderId,
                    'user_id' => (string) $userId,
                ],
            ]);

            DB::table('orders')->where('id', $orderId)->update([
                'razorpayOrderId' => $razorpayOrder['id'],
                'updated_at' => now(),
            ]);

            $order = DB::table('orders')->where('id', $orderId)->first();

            $this->logPaymentEvent($request, 'checkout.order_created', [
                'userId' => $userId,
                'orderId' => $orderId,
                'status' => 'pending',
                'requestPayload' => ['courseIds' => $courseIds],
                'responsePayload' => ['razorpayOrderId' => $razorpayOrder['id'], 'amount' => $totalAmount],
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Checkout initialized successfully.',
                'orderId' => (int) $order->id,
                'orderReference' => $order->orderReference,
                'razorpayOrderId' => $razorpayOrder['id'],
                'razorpayKey' => config('services.razorpay.key', env('RAZORPAY_KEY')),
                'currency' => self::CURRENCY,
                'subtotalAmount' => $subtotal,
                'taxAmount' => $taxAmount,
                'totalAmount' => $totalAmount,
                'amountInPaise' => (int) round($totalAmount * 100),
                'courses' => $courses,
            ]);
        } catch (Throwable $e) {
            DB::rollBack();
            Log::error('Checkout initialization failed', ['error' => $e->getMessage()]);
            $this->logPaymentEvent($request, 'checkout.failed', [
                'userId' => $userId,
                'status' => 'failed',
                'requestPayload' => ['courseIds' => $courseIds],
                'errorStack' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to initialize checkout. Please try again.',
            ], 500);
        }
    }

    public function programCheckoutInit(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'entityType' => 'required|string|in:workshop,seminar',
            'entityId' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $userId = (int) $request->user()->id;
        $entityType = $this->normalizeProgramEntityType($request->input('entityType'));
        $entityId = (int) $request->input('entityId');
        $entityLabel = $this->programEntityLabel($entityType);
        $entityTable = $this->programEntityTable($entityType);

        $requiredTables = ['orders', 'payments', 'order_items', 'payment_logs', 'invoices', $entityTable];
        $missingTables = array_values(array_filter(
            $requiredTables,
            fn (string $table): bool => !Schema::hasTable($table)
        ));

        if (!empty($missingTables)) {
            return response()->json([
                'success' => false,
                'message' => 'Payment tables are missing: ' . implode(', ', $missingTables),
            ], 500);
        }

        try {
            $program = $this->getProgramForCheckout($entityType, $entityId);

            if (!$program) {
                return response()->json([
                    'success' => false,
                    'message' => "{$entityLabel} is invalid, inactive, or no longer available for purchase.",
                ], 422);
            }

            if ($this->hasSuccessfulProgramPurchase($userId, $entityLabel, $entityId)) {
                return response()->json([
                    'success' => false,
                    'message' => "You have already purchased this {$entityLabel}.",
                ], 409);
            }

            $subtotal = round((float) $program->price, 2);
            $taxAmount = round($subtotal * self::TAX_PERCENT / 100, 2);
            $totalAmount = round($subtotal + $taxAmount, 2);

            if ($totalAmount <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => "{$entityLabel} checkout amount must be greater than zero.",
                ], 422);
            }

            $api = $this->razorpay();
            $razorpayOrder = null;
            $programPayload = $this->programResponsePayload($program, $entityType, $entityLabel);

            DB::beginTransaction();

            DB::table('orders')
                ->where('userId', $userId)
                ->where('status', 'pending')
                ->where('deletedFlag', 0)
                ->update(['status' => 'cancelled', 'updated_at' => now()]);

            $orderId = DB::table('orders')->insertGetId([
                'userId' => $userId,
                'orderReference' => $this->reference('ORD'),
                'subtotalAmount' => $subtotal,
                'taxAmount' => $taxAmount,
                'totalAmount' => $totalAmount,
                'currency' => self::CURRENCY,
                'status' => 'pending',
                'expiresAt' => now()->addMinutes(30),
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('order_items')->insert($this->filterExistingColumns('order_items', [
                'orderId' => $orderId,
                'courseId' => 0,
                'entityType' => $entityLabel,
                'entityId' => $entityId,
                'entityCode' => $programPayload['code'],
                'entityTitle' => $programPayload['title'],
                'price' => $subtotal,
                'taxAmount' => $taxAmount,
                'totalAmount' => $totalAmount,
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]));

            $razorpayOrder = $api->order->create([
                'receipt' => strtolower($entityType) . '_' . $orderId,
                'amount' => (int) round($totalAmount * 100),
                'currency' => self::CURRENCY,
                'notes' => [
                    'local_order_id' => (string) $orderId,
                    'user_id' => (string) $userId,
                    'entity_type' => $entityType,
                    'entity_id' => (string) $entityId,
                ],
            ]);

            DB::table('orders')->where('id', $orderId)->update([
                'razorpayOrderId' => $razorpayOrder['id'],
                'updated_at' => now(),
            ]);

            $order = DB::table('orders')->where('id', $orderId)->first();

            $this->logPaymentEvent($request, 'checkout.program_order_created', [
                'userId' => $userId,
                'orderId' => $orderId,
                'status' => 'pending',
                'entityType' => $entityLabel,
                'entityId' => $entityId,
                'entityCode' => $programPayload['code'],
                'entityTitle' => $programPayload['title'],
                'requestPayload' => ['entityType' => $entityType, 'entityId' => $entityId],
                'responsePayload' => [
                    'razorpayOrderId' => $razorpayOrder['id'],
                    'amount' => $totalAmount,
                    'program' => $programPayload,
                ],
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "{$entityLabel} checkout initialized successfully.",
                'orderId' => (int) $order->id,
                'orderReference' => $order->orderReference,
                'razorpayOrderId' => $razorpayOrder['id'],
                'razorpayKey' => config('services.razorpay.key', env('RAZORPAY_KEY')),
                'currency' => self::CURRENCY,
                'subtotalAmount' => $subtotal,
                'taxAmount' => $taxAmount,
                'totalAmount' => $totalAmount,
                'amountInPaise' => (int) round($totalAmount * 100),
                'program' => $programPayload,
            ]);
        } catch (Throwable $e) {
            DB::rollBack();
            Log::error('Program checkout initialization failed', ['error' => $e->getMessage()]);
            $this->logPaymentEvent($request, 'checkout.program_failed', [
                'userId' => $userId,
                'status' => 'failed',
                'entityType' => $entityLabel,
                'entityId' => $entityId,
                'requestPayload' => ['entityType' => $entityType, 'entityId' => $entityId],
                'errorStack' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => "Unable to initialize {$entityLabel} checkout. Please try again.",
            ], 500);
        }
    }

    public function verifyPayment(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'orderId' => 'required|integer|min:1',
            'razorpay_payment_id' => 'required|string|max:120',
            'razorpay_order_id' => 'required|string|max:120',
            'razorpay_signature' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $userId = (int) $request->user()->id;

        try {
            $this->razorpay()->utility->verifyPaymentSignature([
                'razorpay_order_id' => $request->input('razorpay_order_id'),
                'razorpay_payment_id' => $request->input('razorpay_payment_id'),
                'razorpay_signature' => $request->input('razorpay_signature'),
            ]);
        } catch (SignatureVerificationError $e) {
            $this->recordFailedVerification($request, $userId, $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Payment verification failed. Please contact support if money was debited.',
            ], 400);
        }

        try {
            DB::beginTransaction();

            $order = DB::table('orders')
                ->where('id', (int) $request->input('orderId'))
                ->where('userId', $userId)
                ->where('razorpayOrderId', $request->input('razorpay_order_id'))
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->first();

            if (!$order) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
            }

            if ($order->status === 'paid') {
                $invoice = $this->buildInvoice((int) $order->id, $userId);
                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Payment already verified.',
                    'payment_id' => $request->input('razorpay_payment_id'),
                    'invoice' => $invoice,
                ]);
            }

            if (!in_array($order->status, ['pending', 'failed'], true)) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'This order can no longer be verified.',
                ], 409);
            }

            $existingPayment = DB::table('payments')
                ->where('razorpayPaymentId', $request->input('razorpay_payment_id'))
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->first();

            if ($existingPayment && (int) $existingPayment->orderId !== (int) $order->id) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Duplicate payment reference rejected.',
                ], 409);
            }

            $paymentId = $existingPayment
                ? (int) $existingPayment->id
                : DB::table('payments')->insertGetId([
                    'orderId' => $order->id,
                    'userId' => $userId,
                    'paymentReference' => $this->reference('PAY'),
                    'razorpayPaymentId' => $request->input('razorpay_payment_id'),
                    'razorpayOrderId' => $request->input('razorpay_order_id'),
                    'razorpaySignature' => $request->input('razorpay_signature'),
                    'amount' => $order->subtotalAmount ?? $order->totalAmount,
                    'taxAmount' => $order->taxAmount ?? 0,
                    'totalAmount' => $order->totalAmount,
                    'currency' => $order->currency ?? self::CURRENCY,
                    'status' => 'success',
                    'paidAt' => now(),
                    'deletedFlag' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

            if ($existingPayment) {
                DB::table('payments')->where('id', $paymentId)->update([
                    'razorpaySignature' => $request->input('razorpay_signature'),
                    'status' => 'success',
                    'failureReason' => null,
                    'paidAt' => now(),
                    'updated_at' => now(),
                ]);
            }

            $orderItems = DB::table('order_items')
                ->where('orderId', $order->id)
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->get();
            $courseItems = $this->courseOrderItems($orderItems);

            foreach ($courseItems as $item) {
                DB::table('enrollments')->updateOrInsert(
                    ['userId' => $userId, 'courseId' => $item->courseId, 'deletedFlag' => 0],
                    [
                        'orderId' => $order->id,
                        'paymentId' => $paymentId,
                        'status' => 'active',
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }

            DB::table('orders')->where('id', $order->id)->update([
                'status' => 'paid',
                'updated_at' => now(),
            ]);

            $courseIds = $courseItems->pluck('courseId')->all();
            if (!empty($courseIds)) {
                DB::table('carts')
                    ->where('user_id', $userId)
                    ->whereIn('course_id', $courseIds)
                    ->delete();
            }

            $invoice = $this->createOrFetchInvoice((int) $order->id, $paymentId, $userId);
            $verifiedEntityType = $invoice['entityType'] ?? null;
            $verifiedEntityLabel = $verifiedEntityType ?: 'Courses';

            $this->logPaymentEvent($request, 'payment.verified', [
                'userId' => $userId,
                'orderId' => (int) $order->id,
                'paymentId' => $paymentId,
                'status' => 'success',
                'entityType' => $invoice['entityType'] ?? null,
                'entityId' => $invoice['entityId'] ?? null,
                'entityCode' => $invoice['entityCode'] ?? null,
                'entityTitle' => $invoice['entityTitle'] ?? null,
                'requestPayload' => $request->only(['orderId', 'razorpay_payment_id', 'razorpay_order_id']),
                'verificationResult' => [
                    'signature' => 'valid',
                    'enrollments' => $courseItems->count(),
                    'items' => $orderItems->count(),
                ],
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Payment verified successfully. {$verifiedEntityLabel} purchase is complete.",
                'payment_id' => $request->input('razorpay_payment_id'),
                'invoice' => $invoice,
            ]);
        } catch (Throwable $e) {
            DB::rollBack();
            Log::error('Payment verification failed', ['error' => $e->getMessage()]);
            $this->logPaymentEvent($request, 'payment.verify_exception', [
                'userId' => $userId,
                'status' => 'failed',
                'requestPayload' => $request->all(),
                'errorStack' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to verify payment. Please retry from payment history or contact support.',
            ], 500);
        }
    }

    public function paymentFailure(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'orderId' => 'required|integer|min:1',
            'razorpay_order_id' => 'nullable|string|max:120',
            'razorpay_payment_id' => 'nullable|string|max:120',
            'status' => 'required|string|in:failed,cancelled',
            'reason' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $userId = (int) $request->user()->id;

        try {
            DB::beginTransaction();

            $order = DB::table('orders')
                ->where('id', (int) $request->input('orderId'))
                ->where('userId', $userId)
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->first();

            if (!$order) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Order not found.'], 404);
            }

            if ($order->status !== 'paid') {
                $status = $request->input('status') === 'cancelled' ? 'cancelled' : 'failed';
                $reason = $request->input('reason') ?: ($status === 'cancelled' ? 'Payment window closed.' : 'Payment failed.');
                $entity = $this->orderEntitySummary((int) $order->id);

                DB::table('orders')->where('id', $order->id)->update([
                    'status' => $status,
                    'updated_at' => now(),
                ]);

                $paymentLookup = ['razorpayPaymentId' => $request->input('razorpay_payment_id')];
                if (!$request->filled('razorpay_payment_id')) {
                    $paymentLookup = ['orderId' => $order->id, 'status' => 'pending'];
                }

                DB::table('payments')->updateOrInsert($paymentLookup, [
                    'orderId' => $order->id,
                    'userId' => $userId,
                    'paymentReference' => $this->reference('PAY'),
                    'razorpayOrderId' => $request->input('razorpay_order_id') ?: $order->razorpayOrderId,
                    'razorpayPaymentId' => $request->input('razorpay_payment_id'),
                    'amount' => $order->subtotalAmount ?? $order->totalAmount,
                    'taxAmount' => $order->taxAmount ?? 0,
                    'totalAmount' => $order->totalAmount,
                    'currency' => $order->currency ?? self::CURRENCY,
                    'status' => $status,
                    'failureReason' => $reason,
                    'deletedFlag' => 0,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]);

                $this->logPaymentEvent($request, 'payment.' . $status, [
                    'userId' => $userId,
                    'orderId' => (int) $order->id,
                    'status' => $status,
                    'entityType' => $entity['entityType'] ?? null,
                    'entityId' => $entity['entityId'] ?? null,
                    'entityCode' => $entity['entityCode'] ?? null,
                    'entityTitle' => $entity['entityTitle'] ?? null,
                    'requestPayload' => $request->all(),
                    'verificationResult' => ['recorded' => true],
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Payment status recorded.',
            ]);
        } catch (Throwable $e) {
            DB::rollBack();
            Log::error('Payment failure capture failed', ['error' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to record payment status.',
            ], 500);
        }
    }

    public function webhook(Request $request)
    {
        $payload = $request->getContent();
        $signature = $request->header('X-Razorpay-Signature', '');
        $secret = config('services.razorpay.webhook_secret', env('RAZORPAY_WEBHOOK_SECRET'));

        if (!$secret || !hash_equals(hash_hmac('sha256', $payload, $secret), $signature)) {
            $this->logPaymentEvent($request, 'webhook.signature_failed', [
                'status' => 'failed',
                'webhookPayload' => json_decode($payload, true) ?: ['raw' => $payload],
            ]);

            return response()->json(['success' => false, 'message' => 'Invalid webhook signature.'], 400);
        }

        $event = json_decode($payload, true) ?: [];
        $eventType = (string) ($event['event'] ?? 'unknown');
        $paymentEntity = $event['payload']['payment']['entity'] ?? [];
        $refundEntity = $event['payload']['refund']['entity'] ?? [];
        $razorpayOrderId = $paymentEntity['order_id'] ?? null;
        $razorpayPaymentId = $paymentEntity['id'] ?? ($refundEntity['payment_id'] ?? null);

        try {
            DB::beginTransaction();

            $order = $razorpayOrderId
                ? DB::table('orders')->where('razorpayOrderId', $razorpayOrderId)->where('deletedFlag', 0)->lockForUpdate()->first()
                : null;

            $payment = $razorpayPaymentId
                ? DB::table('payments')->where('razorpayPaymentId', $razorpayPaymentId)->where('deletedFlag', 0)->lockForUpdate()->first()
                : null;

            if ($eventType === 'payment.failed' && $order && $order->status !== 'paid') {
                DB::table('orders')->where('id', $order->id)->update(['status' => 'failed', 'updated_at' => now()]);
                DB::table('payments')->updateOrInsert(
                    ['razorpayPaymentId' => $razorpayPaymentId],
                    [
                        'orderId' => $order->id,
                        'userId' => $order->userId,
                        'paymentReference' => $this->reference('PAY'),
                        'razorpayOrderId' => $razorpayOrderId,
                        'amount' => ($paymentEntity['amount'] ?? 0) / 100,
                        'totalAmount' => ($paymentEntity['amount'] ?? 0) / 100,
                        'currency' => $paymentEntity['currency'] ?? self::CURRENCY,
                        'status' => 'failed',
                        'failureReason' => $paymentEntity['error_description'] ?? $paymentEntity['error_reason'] ?? 'Gateway reported payment failure.',
                        'deletedFlag' => 0,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }

            if ($eventType === 'refund.processed' && $payment) {
                DB::table('payments')->where('id', $payment->id)->update(['status' => 'refunded', 'updated_at' => now()]);
                DB::table('refund_requests')->updateOrInsert(
                    ['razorpayRefundId' => $refundEntity['id'] ?? null],
                    [
                        'userId' => $payment->userId,
                        'orderId' => $payment->orderId,
                        'paymentId' => $payment->id,
                        'refundReference' => $this->reference('REF'),
                        'amount' => ($refundEntity['amount'] ?? 0) / 100,
                        'currency' => $refundEntity['currency'] ?? self::CURRENCY,
                        'status' => 'processed',
                        'gatewayResponse' => json_encode($refundEntity),
                        'processedAt' => now(),
                        'deletedFlag' => 0,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }

            $this->logPaymentEvent($request, 'webhook.' . $eventType, [
                'userId' => $order->userId ?? $payment->userId ?? null,
                'orderId' => $order->id ?? $payment->orderId ?? null,
                'paymentId' => $payment->id ?? null,
                'status' => 'success',
                'webhookPayload' => $event,
                'verificationResult' => ['signature' => 'valid'],
            ]);

            DB::commit();

            return response()->json(['success' => true]);
        } catch (Throwable $e) {
            DB::rollBack();
            Log::error('Razorpay webhook failed', ['error' => $e->getMessage()]);

            return response()->json(['success' => false], 500);
        }
    }

    public function paymentLogs(Request $request)
    {
        $userId = (int) $request->user()->id;
        $status = $request->query('status');
        $search = trim((string) $request->query('search', ''));
        $perPage = min(max((int) $request->query('perPage', 10), 5), 50);
        $hasOfflinePaymentColumns = $this->hasOfflinePaymentLogColumns();

        $query = DB::table('orders as o')
            ->leftJoin('payments as p', function ($join) {
                $join->on('p.orderId', '=', 'o.id')->where('p.deletedFlag', 0);
            })
            ->leftJoin('invoices as i', function ($join) {
                $join->on('i.orderId', '=', 'o.id')->where('i.deletedFlag', 0);
            })
            ->where('o.userId', $userId)
            ->where('o.deletedFlag', 0)
            ->whereIn('o.status', ['paid', 'failed', 'cancelled', 'pending']);

        if ($hasOfflinePaymentColumns) {
            $query->leftJoin('payment_logs as pl', function ($join) {
                $join->on('pl.orderId', '=', 'o.id')
                    ->where('pl.eventType', 'offline.manual_enrollment')
                    ->where('pl.deletedFlag', 0);
            });
        }

        $selectColumns = [
            'o.id',
            'o.orderReference',
            'o.totalAmount',
            'o.currency',
            'o.status',
            'o.razorpayOrderId',
            'o.created_at',
            'p.razorpayPaymentId',
            'p.paymentReference',
            'p.paymentMethod',
            'p.status as paymentStatus',
            'p.failureReason',
            'i.invoiceNumber',
            Schema::hasColumn('invoices', 'entityType') ? 'i.entityType' : DB::raw('NULL as entityType'),
            Schema::hasColumn('invoices', 'entityCode') ? 'i.entityCode' : DB::raw('NULL as entityCode'),
            Schema::hasColumn('invoices', 'entityTitle') ? 'i.entityTitle' : DB::raw('NULL as entityTitle'),
            'i.invoiceData',
            'i.paymentReference as invoicePaymentReference',
            'i.id as invoiceId',
        ];

        $query->select(...array_merge(
            $selectColumns,
            $this->offlinePaymentLogSelects($hasOfflinePaymentColumns)
        ))->orderByDesc('o.id');

        if ($status && $status !== 'all') {
            $query->where('o.status', $status);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search, $hasOfflinePaymentColumns) {
                $q->where('o.orderReference', 'like', "%{$search}%")
                    ->orWhere('o.razorpayOrderId', 'like', "%{$search}%")
                    ->orWhere('p.razorpayPaymentId', 'like', "%{$search}%")
                    ->orWhere('p.paymentReference', 'like', "%{$search}%")
                    ->orWhere('i.paymentReference', 'like', "%{$search}%")
                    ->orWhere('i.invoiceNumber', 'like', "%{$search}%");

                if (Schema::hasColumn('invoices', 'entityCode')) {
                    $q->orWhere('i.entityCode', 'like', "%{$search}%");
                }

                if ($hasOfflinePaymentColumns) {
                    $q->orWhere('pl.transactionNo', 'like', "%{$search}%")
                        ->orWhere('pl.referenceNo', 'like', "%{$search}%");

                    if (Schema::hasColumn('payment_logs', 'entityCode')) {
                        $q->orWhere('pl.entityCode', 'like', "%{$search}%");
                    }
                }
            });
        }

        $page = $query->paginate($perPage);
        $orderIds = collect($page->items())->pluck('id')->all();
        $courseCounts = empty($orderIds)
            ? collect()
            : DB::table('order_items')->whereIn('orderId', $orderIds)->where('deletedFlag', 0)->select('orderId', DB::raw('COUNT(*) as total'))->groupBy('orderId')->pluck('total', 'orderId');

        $data = collect($page->items())->map(function ($order) use ($courseCounts) {
            $invoiceEntity = $this->invoiceEntityFromJson($order->invoiceData ?? null);
            $paymentMethod = $this->paymentMethodLabel(
                $order->paymentMethod,
                $order->offlinePaymentBy,
                $order->razorpayPaymentId
            );

            return [
                'id' => (int) $order->id,
                'orderReference' => $order->orderReference,
                'invoiceNo' => $order->invoiceNumber ?: 'INV-' . date('Y') . '-' . str_pad((string) $order->id, 6, '0', STR_PAD_LEFT),
                'invoiceId' => $order->invoiceId ? (int) $order->invoiceId : null,
                'totalAmount' => $order->totalAmount,
                'currency' => $order->currency ?: self::CURRENCY,
                'status' => $order->status,
                'paymentStatus' => $order->paymentStatus,
                'razorpayOrderId' => $order->razorpayOrderId,
                'razorpayPaymentId' => $order->razorpayPaymentId,
                'paymentReference' => $order->paymentReference,
                'paymentMethod' => $paymentMethod,
                'paymentBy' => $paymentMethod,
                'transactionNo' => $order->offlineTransactionNo,
                'paymentDisplayId' => $this->paymentDisplayId(
                    $order->razorpayPaymentId,
                    $order->offlineTransactionNo,
                    $order->invoicePaymentReference,
                    $order->paymentReference,
                    $order->offlineReferenceNo
                ),
                'entityType' => $order->offlineEntityType ?? $order->entityType ?? ($invoiceEntity['entityType'] ?? null),
                'entityCode' => $order->offlineEntityCode ?? $order->entityCode ?? ($invoiceEntity['entityCode'] ?? null),
                'entityTitle' => $order->offlineEntityTitle ?? $order->entityTitle ?? ($invoiceEntity['entityTitle'] ?? null),
                'failureReason' => $order->failureReason,
                'created_at' => $order->created_at,
                'courseCount' => (int) ($courseCounts[$order->id] ?? 0),
                'refundStatus' => $order->paymentStatus === 'refunded' ? 'refunded' : null,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'message' => 'Payment history fetched successfully.',
            'data' => $data,
            'meta' => [
                'currentPage' => $page->currentPage(),
                'lastPage' => $page->lastPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function myLearning(Request $request)
    {
        $userId = (int) $request->user()->id;

        $courses = DB::table('enrollments as e')
            ->join('courses as c', 'c.id', '=', 'e.courseId')
            ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
            ->leftJoin('orders as o', 'o.id', '=', 'e.orderId')
            ->leftJoin('invoices as i', 'i.orderId', '=', 'e.orderId')
            ->where('e.userId', $userId)
            ->where('e.deletedFlag', 0)
            ->where('c.deletedFlag', 0)
            ->select(
                'e.id as enrollmentId',
                'e.created_at as enrolledAt',
                'e.orderId',
                'e.progressPercent',
                'e.lastWatchedAt',
                'c.id',
                EntityCodeService::codeSelect('courses', 'c'),
                'c.title',
                'c.categoryId',
                'cc.categoryName as categoryName',
                'c.instructorIds',
                'c.duration',
                'c.durationUnit',
                'c.price',
                'c.oldPrice',
                'c.description',
                'c.courseHighlights',
                'c.thumbnail',
                'c.status',
                'c.courseType',
                'c.startDate',
                'c.endDate',
                'c.youtubeLiveUrl',
                'c.meetingLink',
                'o.razorpayOrderId',
                'i.invoiceNumber'
            )
            ->orderByDesc('e.id')
            ->get();

        $courseIds = $courses->pluck('id')->map(fn ($id) => (int) $id)->unique()->values();
        $courseInstructorMap = $courseIds->isEmpty()
            ? collect()
            : DB::table('courseinstructors as ci')
                ->leftJoin('users as u', 'u.id', '=', 'ci.instructorId')
                ->whereIn('ci.courseId', $courseIds)
                ->select('ci.courseId', 'ci.instructorId', 'u.name')
                ->orderBy('ci.id')
                ->get()
                ->groupBy('courseId');

        $fallbackInstructorIds = $courses->flatMap(fn ($course) => $this->normalizeInstructorIds($course->instructorIds ?? []))->unique()->values();
        $fallbackInstructors = $fallbackInstructorIds->isEmpty() ? collect() : DB::table('users')->whereIn('id', $fallbackInstructorIds)->pluck('name', 'id');

        $data = $courses->map(function ($course) use ($request, $courseInstructorMap, $fallbackInstructors) {
            $relationInstructors = collect($courseInstructorMap->get($course->id, []))->map(fn ($instructor) => [
                'id' => (int) $instructor->instructorId,
                'name' => (string) ($instructor->name ?? 'Instructor'),
            ]);

            $instructors = $relationInstructors->isNotEmpty()
                ? $relationInstructors
                : collect($this->normalizeInstructorIds($course->instructorIds ?? []))->map(fn ($id) => [
                    'id' => (int) $id,
                    'name' => (string) ($fallbackInstructors[(int) $id] ?? 'Instructor'),
                ]);

            return [
                'enrollmentId' => (int) $course->enrollmentId,
                'id' => (int) $course->id,
                'code' => $course->code ?? null,
                'title' => $course->title,
                'categoryId' => (int) $course->categoryId,
                'categoryName' => $course->categoryName ?: 'Uncategorized',
                'instructors' => $instructors->values()->all(),
                'instructorName' => $instructors->pluck('name')->filter()->join(', '),
                'duration' => $course->duration,
                'durationUnit' => $course->durationUnit,
                'price' => $course->price,
                'oldPrice' => $course->oldPrice,
                'description' => $course->description,
                'courseHighlights' => $this->decodeCourseHighlights($course->courseHighlights ?? null),
                'thumbnailUrl' => $course->thumbnail ? $this->privateFileUrl($request, $course->thumbnail) : null,
                'status' => (int) $course->status,
                'statusLabel' => ((int) $course->status) === 1 ? 'Active' : 'Inactive',
                'courseType' => (int) ($course->courseType ?? 1),
                'youtubeLiveUrl' => $course->youtubeLiveUrl,
                'meetingLink' => $course->meetingLink,
                'progressPercent' => (int) ($course->progressPercent ?? 0),
                'lastWatchedAt' => $course->lastWatchedAt,
                'enrolledAt' => $course->enrolledAt,
                'orderId' => $course->orderId ? (int) $course->orderId : null,
                'invoiceNo' => $course->invoiceNumber,
                'razorpayOrderId' => $course->razorpayOrderId,
                'startDate' => $course->startDate,
                'endDate' => $course->endDate,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'message' => 'My learning courses fetched successfully.',
            'data' => $data,
        ]);
    }

    public function myPrograms(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'nullable|string|in:all,workshop,seminar',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $userId = (int) $request->user()->id;
        $programType = strtolower(trim((string) $request->query('type', 'all')));
        $programTypes = match ($programType) {
            'workshop' => ['workshop'],
            'seminar' => ['seminar'],
            default => ['workshop', 'seminar'],
        };

        $requiredTables = ['orders', 'payments', 'order_items', 'invoices', 'workshops', 'seminars'];
        $missingTables = array_values(array_filter(
            $requiredTables,
            fn (string $table): bool => !Schema::hasTable($table)
        ));

        if (!empty($missingTables)) {
            return response()->json([
                'success' => false,
                'message' => 'Payment tables are missing: ' . implode(', ', $missingTables),
            ], 500);
        }

        $hasOrderItemEntityType = Schema::hasColumn('order_items', 'entityType');
        $hasOrderItemEntityId = Schema::hasColumn('order_items', 'entityId');
        $hasInvoiceEntityType = Schema::hasColumn('invoices', 'entityType');
        $hasInvoiceEntityId = Schema::hasColumn('invoices', 'entityId');
        $effectiveTypeSql = $this->programEntityTypeCoalesceSql(array_filter([
            $hasOrderItemEntityType ? 'oi.entityType' : null,
            $hasInvoiceEntityType ? 'i.entityType' : null,
        ]));
        $effectiveIdSql = $this->programEntityIdCoalesceSql(array_filter([
            $hasOrderItemEntityId ? 'oi.entityId' : null,
            $hasInvoiceEntityId ? 'i.entityId' : null,
        ]));

        $rows = DB::table('order_items as oi')
            ->join('orders as o', function ($join) {
                $join->on('o.id', '=', 'oi.orderId')
                    ->where('o.status', 'paid')
                    ->where('o.deletedFlag', 0);
            })
            ->leftJoin('payments as p', function ($join) {
                $join->on('p.orderId', '=', 'o.id')
                    ->where('p.status', 'success')
                    ->where('p.deletedFlag', 0);
            })
            ->leftJoin('invoices as i', function ($join) {
                $join->on('i.orderId', '=', 'o.id')
                    ->where('i.deletedFlag', 0);
            })
            ->leftJoin('workshops as w', function ($join) use ($effectiveIdSql, $effectiveTypeSql) {
                $join->whereRaw("w.id = {$effectiveIdSql}")
                    ->whereRaw("{$effectiveTypeSql} = ?", ['workshop'])
                    ->where('w.deletedFlag', 0);
            })
            ->leftJoin('seminars as s', function ($join) use ($effectiveIdSql, $effectiveTypeSql) {
                $join->whereRaw("s.id = {$effectiveIdSql}")
                    ->whereRaw("{$effectiveTypeSql} = ?", ['seminar'])
                    ->where('s.deletedFlag', 0);
            })
            ->where('o.userId', $userId)
            ->where('oi.deletedFlag', 0)
            ->where(function ($query) use ($effectiveTypeSql, $programTypes) {
                $query->whereIn(DB::raw($effectiveTypeSql), $programTypes)
                    ->orWhere(function ($legacyQuery) {
                        $legacyQuery->where(function ($courseQuery) {
                            $courseQuery->whereNull('oi.courseId')
                                ->orWhere('oi.courseId', 0);
                        });
                    });
            })
            ->select(
                'oi.id as purchaseItemId',
                'oi.orderId',
                DB::raw("{$effectiveTypeSql} as normalizedEntityType"),
                DB::raw("{$effectiveIdSql} as normalizedEntityId"),
                $hasOrderItemEntityType ? 'oi.entityType' : DB::raw('NULL as entityType'),
                $hasOrderItemEntityId ? 'oi.entityId' : DB::raw('NULL as entityId'),
                Schema::hasColumn('order_items', 'entityCode') ? 'oi.entityCode' : DB::raw('NULL as entityCode'),
                Schema::hasColumn('order_items', 'entityTitle') ? 'oi.entityTitle' : DB::raw('NULL as entityTitle'),
                'oi.price as itemPrice',
                'oi.totalAmount as itemTotalAmount',
                'o.orderReference',
                'o.totalAmount as orderTotalAmount',
                'o.razorpayOrderId',
                'o.created_at as enrolledAt',
                'p.razorpayPaymentId',
                'p.paymentReference',
                'i.invoiceNumber',
                'i.invoiceData',
                'i.paymentReference as invoicePaymentReference',
                'w.title as workshopTitle',
                'w.topic as workshopTopic',
                'w.venue as workshopVenue',
                'w.city as workshopCity',
                'w.startDate as workshopStartDate',
                'w.endDate as workshopEndDate',
                'w.startTime as workshopStartTime',
                'w.endTime as workshopEndTime',
                'w.speakerName as workshopSpeakerName',
                'w.capacity as workshopCapacity',
                'w.price as workshopPrice',
                'w.description as workshopDescription',
                'w.takeaways as workshopTakeaways',
                'w.bannerImage as workshopBannerImage',
                'w.status as workshopStatus',
                's.title as seminarTitle',
                's.topic as seminarTopic',
                's.venue as seminarVenue',
                's.city as seminarCity',
                's.eventDate as seminarEventDate',
                's.startTime as seminarStartTime',
                's.endTime as seminarEndTime',
                's.speakerName as seminarSpeakerName',
                's.capacity as seminarCapacity',
                's.price as seminarPrice',
                's.description as seminarDescription',
                's.takeaways as seminarTakeaways',
                's.bannerImage as seminarBannerImage',
                's.status as seminarStatus'
            )
            ->orderByDesc('o.id')
            ->orderByDesc('oi.id')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'My programs fetched successfully.',
            'data' => $rows
                ->map(fn ($row) => $this->formatMyProgram($row, $request))
                ->filter(fn (array $program) => in_array($program['type'], $programTypes, true) && (int) $program['id'] > 0)
                ->values(),
        ]);
    }

    public function invoice(Request $request, int $orderId)
    {
        $invoice = $this->buildInvoice($orderId, (int) $request->user()->id, $this->isAdmin($request));

        if (!$invoice) {
            return response()->json(['success' => false, 'message' => 'Invoice not found.'], 404);
        }

        return response()->json(['success' => true, 'message' => 'Invoice fetched successfully.', 'data' => $invoice]);
    }

    public function downloadInvoice(Request $request, int $orderId)
    {
        $invoice = $this->buildInvoice($orderId, (int) $request->user()->id, $this->isAdmin($request));

        if (!$invoice) {
            return response('Invoice not found.', 404);
        }

        return response($this->invoiceHtml($invoice), 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="' . $invoice['invoiceNo'] . '.html"',
        ]);
    }

    public function checkCourseAccess(Request $request, int $courseId)
    {
        $hasAccess = DB::table('enrollments')
            ->where('userId', (int) $request->user()->id)
            ->where('courseId', $courseId)
            ->where('status', 'active')
            ->where('deletedFlag', 0)
            ->exists();

        return response()->json([
            'success' => $hasAccess,
            'message' => $hasAccess ? 'Access granted.' : 'You need to purchase this course to continue.',
            'hasAccess' => $hasAccess,
        ], $hasAccess ? 200 : 403);
    }

    public function adminPayments(Request $request)
    {
        if (!$this->isAdmin($request)) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $hasOfflinePaymentColumns = $this->hasOfflinePaymentLogColumns();
        $paidTotal = (float) DB::table('payments')->where('status', 'success')->where('deletedFlag', 0)->sum('totalAmount');
        $successfulPayments = DB::table('payments')->where('status', 'success')->where('deletedFlag', 0)->count();
        $failedPayments = DB::table('payments')->whereIn('status', ['failed', 'cancelled'])->where('deletedFlag', 0)->count();
        $refunds = DB::table('refund_requests')->where('deletedFlag', 0)->count();

        $recentQuery = DB::table('orders as o')
            ->leftJoin('users as u', 'u.id', '=', 'o.userId')
            ->leftJoin('payments as p', function ($join) {
                $join->on('p.orderId', '=', 'o.id')->where('p.deletedFlag', 0);
            })
            ->leftJoin('invoices as i', 'i.orderId', '=', 'o.id')
            ->where('o.deletedFlag', 0);

        if ($hasOfflinePaymentColumns) {
            $recentQuery->leftJoin('payment_logs as pl', function ($join) {
                $join->on('pl.orderId', '=', 'o.id')
                    ->where('pl.eventType', 'offline.manual_enrollment')
                    ->where('pl.deletedFlag', 0);
            });
        }

        $recentSelectColumns = [
            'o.id',
            'o.orderReference',
            'o.totalAmount',
            'o.status',
            'o.created_at',
            'u.name as userName',
            'u.email as userEmail',
            'p.razorpayPaymentId',
            'p.paymentReference',
            'p.paymentMethod',
            'i.invoiceNumber',
            Schema::hasColumn('invoices', 'entityType') ? 'i.entityType' : DB::raw('NULL as entityType'),
            Schema::hasColumn('invoices', 'entityCode') ? 'i.entityCode' : DB::raw('NULL as entityCode'),
            Schema::hasColumn('invoices', 'entityTitle') ? 'i.entityTitle' : DB::raw('NULL as entityTitle'),
            'i.invoiceData',
            'i.paymentReference as invoicePaymentReference',
        ];

        $recent = $recentQuery
            ->select(...array_merge(
                $recentSelectColumns,
                $this->offlinePaymentLogSelects($hasOfflinePaymentColumns)
            ))
            ->orderByDesc('o.id')
            ->limit(20)
            ->get()
            ->map(function ($row) {
                $invoiceEntity = $this->invoiceEntityFromJson($row->invoiceData ?? null);
                $paymentMethod = $this->paymentMethodLabel(
                    $row->paymentMethod,
                    $row->offlinePaymentBy,
                    $row->razorpayPaymentId
                );

                $row->paymentMethod = $paymentMethod;
                $row->paymentBy = $paymentMethod;
                $row->transactionNo = $row->offlineTransactionNo;
                $row->paymentDisplayId = $this->paymentDisplayId(
                    $row->razorpayPaymentId,
                    $row->offlineTransactionNo,
                    $row->invoicePaymentReference,
                    $row->paymentReference,
                    $row->offlineReferenceNo
                );
                $row->entityType = $row->offlineEntityType ?? $row->entityType ?? ($invoiceEntity['entityType'] ?? null);
                $row->entityCode = $row->offlineEntityCode ?? $row->entityCode ?? ($invoiceEntity['entityCode'] ?? null);
                $row->entityTitle = $row->offlineEntityTitle ?? $row->entityTitle ?? ($invoiceEntity['entityTitle'] ?? null);
                unset($row->invoiceData);

                return $row;
            });

        return response()->json([
            'success' => true,
            'message' => 'Admin payment dashboard fetched successfully.',
            'data' => [
                'summary' => [
                    'revenue' => $paidTotal,
                    'successfulPayments' => $successfulPayments,
                    'failedPayments' => $failedPayments,
                    'refundRequests' => $refunds,
                ],
                'recentTransactions' => $recent,
            ],
        ]);
    }

    private function createOrFetchInvoice(int $orderId, int $paymentId, int $userId): ?array
    {
        $existing = DB::table('invoices')->where('orderId', $orderId)->where('deletedFlag', 0)->first();
        if ($existing) {
            return $this->buildInvoice($orderId, $userId);
        }

        $payload = $this->invoicePayload($orderId, $paymentId, $userId);
        if (!$payload) {
            return null;
        }

        $invoiceId = DB::table('invoices')->insertGetId($this->filterExistingColumns('invoices', [
            'userId' => $userId,
            'orderId' => $orderId,
            'paymentId' => $paymentId,
            'invoiceNumber' => 'INV-' . date('Y') . '-PENDING',
            'invoiceDate' => now()->toDateString(),
            'entityType' => $payload['entityType'] ?? null,
            'entityId' => $payload['entityId'] ?? null,
            'entityCode' => $payload['entityCode'] ?? null,
            'entityTitle' => $payload['entityTitle'] ?? null,
            'customerName' => $payload['customer']['name'],
            'customerEmail' => $payload['customer']['email'],
            'customerPhone' => $payload['customer']['phone'],
            'subtotal' => $payload['subtotal'],
            'tax' => $payload['tax'],
            'grandTotal' => $payload['totalAmount'],
            'currency' => $payload['currency'],
            'paymentReference' => $payload['paymentDisplayId'] ?? $payload['paymentReference'] ?? $payload['razorpayPaymentId'] ?? null,
            'invoiceData' => json_encode($payload),
            'created_at' => now(),
            'updated_at' => now(),
        ]));

        $invoiceNumber = 'INV-' . date('Y') . '-' . str_pad((string) $invoiceId, 6, '0', STR_PAD_LEFT);
        $payload['invoiceNo'] = $invoiceNumber;

        DB::table('invoices')->where('id', $invoiceId)->update($this->filterExistingColumns('invoices', [
            'invoiceNumber' => $invoiceNumber,
            'entityType' => $payload['entityType'] ?? null,
            'entityId' => $payload['entityId'] ?? null,
            'entityCode' => $payload['entityCode'] ?? null,
            'entityTitle' => $payload['entityTitle'] ?? null,
            'invoiceData' => json_encode($payload),
            'updated_at' => now(),
        ]));

        return $payload;
    }

    private function buildInvoice(int $orderId, int $userId, bool $allowAnyUser = false): ?array
    {
        $invoiceQuery = DB::table('invoices')
            ->where('orderId', $orderId)
            ->where('deletedFlag', 0);

        if (!$allowAnyUser) {
            $invoiceQuery->where('userId', $userId);
        }

        $invoice = $invoiceQuery->first();
        if ($invoice && $invoice->invoiceData) {
            $payload = json_decode($invoice->invoiceData, true);
            if (is_array($payload)) {
                $payload['invoiceNo'] = $invoice->invoiceNumber;
                $payload = $this->enrichStoredInvoicePayload($payload, $invoice, $orderId);
                return $this->normalizeInvoicePaymentFields($payload);
            }
        }

        $paymentQuery = DB::table('payments')
            ->where('orderId', $orderId)
            ->where('status', 'success')
            ->where('deletedFlag', 0);

        if (!$allowAnyUser) {
            $paymentQuery->where('userId', $userId);
        }

        $payment = $paymentQuery->first();
        return $payment ? $this->invoicePayload($orderId, (int) $payment->id, $allowAnyUser ? (int) $payment->userId : $userId) : null;
    }

    private function enrichStoredInvoicePayload(array $payload, object $invoice, int $orderId): array
    {
        foreach (['entityType', 'entityId', 'entityCode', 'entityTitle'] as $field) {
            if (empty($payload[$field]) && isset($invoice->{$field})) {
                $payload[$field] = $invoice->{$field};
            }
        }

        if (!isset($payload['items']) || !is_array($payload['items'])) {
            return $payload;
        }

        $itemsByCourseId = collect();
        if (Schema::hasTable('order_items') && Schema::hasTable('courses')) {
            $itemsByCourseId = DB::table('order_items as oi')
                ->join('courses as c', 'c.id', '=', 'oi.courseId')
                ->where('oi.orderId', $orderId)
                ->where('oi.deletedFlag', 0)
                ->select(
                    'oi.courseId',
                    'c.title',
                    'c.courseType',
                    EntityCodeService::codeSelect('courses', 'c')
                )
                ->get()
                ->keyBy(fn($item) => (int) $item->courseId);
        }

        $singleItemInvoice = count($payload['items']) === 1;
        $payload['items'] = array_map(function ($item) use ($itemsByCourseId, $invoice, $singleItemInvoice) {
            if (!is_array($item)) {
                return $item;
            }

            $courseId = (int) ($item['courseId'] ?? 0);
            $course = $courseId > 0 ? $itemsByCourseId->get($courseId) : null;

            if ($course) {
                $entityType = ((int) ($course->courseType ?? 1)) === 2 ? 'Academic Course' : 'Main Course';
                $item['code'] = $item['code'] ?? ($course->code ?? null);
                $item['entityType'] = $item['entityType'] ?? $entityType;
                $item['entityCode'] = $item['entityCode'] ?? ($course->code ?? null);
                $item['entityTitle'] = $item['entityTitle'] ?? ($course->title ?? ($item['title'] ?? null));

                return $item;
            }

            if ($singleItemInvoice) {
                $item['entityType'] = $item['entityType'] ?? ($invoice->entityType ?? null);
                $item['entityCode'] = $item['entityCode'] ?? ($invoice->entityCode ?? null);
                $item['entityTitle'] = $item['entityTitle'] ?? ($invoice->entityTitle ?? ($item['title'] ?? null));
                $item['code'] = $item['code'] ?? ($invoice->entityCode ?? null);
            }

            return $item;
        }, $payload['items']);

        return $payload;
    }

    private function invoicePayload(int $orderId, int $paymentId, int $userId): ?array
    {
        $order = DB::table('orders as o')
            ->leftJoin('payments as p', 'p.id', '=', DB::raw((string) $paymentId))
            ->leftJoin('users as u', 'u.id', '=', 'o.userId')
            ->where('o.id', $orderId)
            ->where('o.userId', $userId)
            ->where('o.status', 'paid')
            ->where('o.deletedFlag', 0)
            ->select(
                'o.*',
                'p.razorpayPaymentId',
                'p.paymentReference',
                'p.paymentMethod',
                'p.status as paymentStatus',
                'p.currency as paymentCurrency',
                'u.name as userName',
                'u.email as userEmail',
                'u.phone as userPhone'
            )
            ->first();

        if (!$order) {
            return null;
        }

        $orderEntity = $this->orderEntitySummary($orderId);
        $itemSelects = [
            'oi.courseId',
            'oi.price',
            'oi.taxAmount',
            'oi.totalAmount',
            'c.title as courseTitle',
            'c.courseType',
            EntityCodeService::codeSelect('courses', 'c'),
            'cc.categoryName',
        ];

        $items = DB::table('order_items as oi')
            ->leftJoin('courses as c', 'c.id', '=', 'oi.courseId')
            ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
            ->where('oi.orderId', $orderId)
            ->where('oi.deletedFlag', 0)
            ->select(...array_merge($itemSelects, $this->orderItemEntitySelects()))
            ->get()
            ->map(function ($item) use ($orderEntity) {
                $courseId = (int) ($item->courseId ?? 0);
                $hasCourse = $courseId > 0 && !empty($item->courseTitle);

                if ($hasCourse) {
                    $entityType = ((int) ($item->courseType ?? 1)) === 2 ? 'Academic Course' : 'Main Course';

                    return [
                        'courseId' => $courseId,
                        'entityId' => $courseId,
                        'title' => $item->courseTitle,
                        'code' => $item->code ?? null,
                        'entityType' => $entityType,
                        'entityCode' => $item->code ?? null,
                        'entityTitle' => $item->courseTitle,
                        'categoryName' => $item->categoryName ?: 'Course',
                        'price' => $item->price,
                        'taxAmount' => $item->taxAmount ?? 0,
                        'totalAmount' => $item->totalAmount ?? $item->price,
                    ];
                }

                $entityType = $item->itemEntityType ?? ($orderEntity['entityType'] ?? 'Program');
                $entityId = (int) ($item->itemEntityId ?? ($orderEntity['entityId'] ?? 0));
                $entityTitle = $item->itemEntityTitle ?? ($orderEntity['entityTitle'] ?? 'Program Purchase');
                $entityCode = $item->itemEntityCode ?? ($orderEntity['entityCode'] ?? null);

                return [
                    'courseId' => $courseId,
                    'entityId' => $entityId ?: null,
                    'title' => $entityTitle,
                    'code' => $entityCode,
                    'entityType' => $entityType,
                    'entityCode' => $entityCode,
                    'entityTitle' => $entityTitle,
                    'categoryName' => $entityType,
                    'price' => $item->price,
                    'taxAmount' => $item->taxAmount ?? 0,
                    'totalAmount' => $item->totalAmount ?? $item->price,
                ];
            })
            ->values()
            ->all();

        if (empty($items) && $orderEntity) {
            $items = [[
                'courseId' => 0,
                'entityId' => $orderEntity['entityId'] ?? null,
                'title' => $orderEntity['entityTitle'] ?? 'Program Purchase',
                'code' => $orderEntity['entityCode'] ?? null,
                'entityType' => $orderEntity['entityType'] ?? 'Program',
                'entityCode' => $orderEntity['entityCode'] ?? null,
                'entityTitle' => $orderEntity['entityTitle'] ?? 'Program Purchase',
                'categoryName' => $orderEntity['entityType'] ?? 'Program',
                'price' => $order->subtotalAmount ?? $order->totalAmount,
                'taxAmount' => $order->taxAmount ?? 0,
                'totalAmount' => $order->totalAmount,
            ]];
        }

        $firstItem = $items[0] ?? null;
        $singleItemInvoice = count($items) === 1;

        $invoice = DB::table('invoices')->where('orderId', $orderId)->where('deletedFlag', 0)->first();

        $paymentMethod = $this->paymentMethodLabel(
            $order->paymentMethod,
            null,
            $order->razorpayPaymentId
        );

        return [
            'invoiceNo' => $invoice->invoiceNumber ?? 'INV-' . date('Y') . '-' . str_pad((string) $orderId, 6, '0', STR_PAD_LEFT),
            'orderId' => (int) $order->id,
            'orderReference' => $order->orderReference,
            'orderDate' => $order->created_at,
            'invoiceDate' => $invoice->invoiceDate ?? now()->toDateString(),
            'status' => $order->status,
            'paymentStatus' => $order->paymentStatus,
            'razorpayOrderId' => $order->razorpayOrderId,
            'razorpayPaymentId' => $order->razorpayPaymentId,
            'paymentReference' => $order->paymentReference,
            'paymentMethod' => $paymentMethod,
            'paymentBy' => $paymentMethod,
            'paymentDisplayId' => $this->paymentDisplayId(
                $order->razorpayPaymentId,
                $order->paymentReference
            ),
            'currency' => $order->paymentCurrency ?: ($order->currency ?: self::CURRENCY),
            'customer' => [
                'name' => $order->userName,
                'email' => $order->userEmail,
                'phone' => $order->userPhone,
            ],
            'company' => [
                'name' => 'ICETL',
                'subtitle' => 'Ice Technology Lab',
                'email' => 'support@icetl.com',
            ],
            'items' => $items,
            'entityType' => $singleItemInvoice ? ($firstItem['entityType'] ?? null) : 'Course Bundle',
            'entityId' => $singleItemInvoice ? ($firstItem['entityId'] ?? $firstItem['courseId'] ?? null) : null,
            'entityCode' => $singleItemInvoice ? ($firstItem['entityCode'] ?? null) : null,
            'entityTitle' => $singleItemInvoice ? ($firstItem['entityTitle'] ?? null) : count($items) . ' Courses',
            'subtotal' => (float) ($order->subtotalAmount ?? array_sum(array_map(fn ($item) => (float) $item['price'], $items))),
            'tax' => (float) ($order->taxAmount ?? 0),
            'totalAmount' => (float) $order->totalAmount,
        ];
    }

    private function logPaymentEvent(Request $request, string $eventType, array $data = []): void
    {
        if (!Schema::hasTable('payment_logs')) {
            return;
        }

        try {
            $transactionNo = $this->paymentDisplayId(
                $data['transactionNo'] ?? null,
                $request->input('razorpay_payment_id'),
                data_get($data, 'webhookPayload.payload.payment.entity.id'),
                data_get($data, 'webhookPayload.payload.refund.entity.payment_id')
            );
            $referenceNo = $this->paymentDisplayId(
                $data['referenceNo'] ?? null,
                $request->input('razorpay_order_id'),
                data_get($data, 'webhookPayload.payload.payment.entity.order_id')
            );
            $payload = [
                'userId' => $data['userId'] ?? optional($request->user())->id,
                'orderId' => $data['orderId'] ?? null,
                'paymentId' => $data['paymentId'] ?? null,
                'eventType' => $eventType,
                'gateway' => 'razorpay',
                'status' => $data['status'] ?? null,
                'requestPayload' => isset($data['requestPayload']) ? json_encode($data['requestPayload']) : null,
                'responsePayload' => isset($data['responsePayload']) ? json_encode($data['responsePayload']) : null,
                'verificationResult' => isset($data['verificationResult']) ? json_encode($data['verificationResult']) : null,
                'webhookPayload' => isset($data['webhookPayload']) ? json_encode($data['webhookPayload']) : null,
                'errorStack' => isset($data['errorStack']) ? (string) $data['errorStack'] : null,
                'ipAddress' => $request->ip(),
                'browserInfo' => $request->userAgent(),
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            $optionalColumns = [
                'paymentMode' => $transactionNo ? 'ONLINE' : null,
                'paymentBy' => $transactionNo ? 'RAZORPAY' : null,
                'referenceNo' => $referenceNo,
                'transactionNo' => $transactionNo,
                'entityType' => $data['entityType'] ?? null,
                'entityId' => $data['entityId'] ?? null,
                'entityCode' => $data['entityCode'] ?? null,
                'entityTitle' => $data['entityTitle'] ?? null,
            ];

            foreach ($optionalColumns as $column => $value) {
                if ($value !== null && Schema::hasColumn('payment_logs', $column)) {
                    $payload[$column] = $value;
                }
            }

            DB::table('payment_logs')->insert($payload);
        } catch (Throwable $e) {
            Log::warning('Unable to write payment log', ['error' => $e->getMessage()]);
        }
    }

    private function recordFailedVerification(Request $request, int $userId, string $reason): void
    {
        $order = DB::table('orders')
            ->where('id', (int) $request->input('orderId'))
            ->where('userId', $userId)
            ->where('deletedFlag', 0)
            ->first();

        if ($order && $order->status !== 'paid') {
            DB::table('orders')->where('id', $order->id)->update(['status' => 'failed', 'updated_at' => now()]);
        }

        $entity = $order ? $this->orderEntitySummary((int) $order->id) : null;

        $this->logPaymentEvent($request, 'payment.signature_failed', [
            'userId' => $userId,
            'orderId' => $order->id ?? null,
            'status' => 'failed',
            'entityType' => $entity['entityType'] ?? null,
            'entityId' => $entity['entityId'] ?? null,
            'entityCode' => $entity['entityCode'] ?? null,
            'entityTitle' => $entity['entityTitle'] ?? null,
            'requestPayload' => $request->all(),
            'verificationResult' => ['signature' => 'invalid', 'reason' => $reason],
        ]);
    }

    private function normalizeProgramEntityType(mixed $value): string
    {
        return $this->resolveProgramEntityType($value) ?? 'workshop';
    }

    private function resolveProgramEntityType(mixed $value): ?string
    {
        $normalized = strtolower(trim((string) $value));

        if ($normalized === '') {
            return null;
        }

        if (str_contains($normalized, 'seminar')) {
            return 'seminar';
        }

        if (str_contains($normalized, 'workshop')) {
            return 'workshop';
        }

        return null;
    }

    private function programEntityTypeSql(string $column): string
    {
        return "CASE
            WHEN LOWER(TRIM({$column})) LIKE '%seminar%' THEN 'seminar'
            WHEN LOWER(TRIM({$column})) LIKE '%workshop%' THEN 'workshop'
            ELSE NULL
        END";
    }

    private function programEntityTypeCoalesceSql(array $columns): string
    {
        $expressions = array_map(fn (string $column): string => $this->programEntityTypeSql($column), $columns);

        return empty($expressions) ? 'NULL' : 'COALESCE(' . implode(', ', $expressions) . ')';
    }

    private function programEntityIdCoalesceSql(array $columns): string
    {
        $expressions = array_map(fn (string $column): string => "NULLIF({$column}, 0)", $columns);

        return empty($expressions) ? 'NULL' : 'COALESCE(' . implode(', ', $expressions) . ')';
    }

    private function programEntityLabel(string $entityType): string
    {
        return $entityType === 'seminar' ? 'Seminar' : 'Workshop';
    }

    private function programEntityTable(string $entityType): string
    {
        return $entityType === 'seminar' ? 'seminars' : 'workshops';
    }

    private function getProgramForCheckout(string $entityType, int $entityId): ?object
    {
        $today = now()->toDateString();

        if ($entityType === 'seminar') {
            return DB::table('seminars as s')
                ->where('s.id', $entityId)
                ->where('s.status', 1)
                ->where('s.deletedFlag', 0)
                ->where('s.eventDate', '>=', $today)
                ->select(
                    's.id',
                    EntityCodeService::codeSelect('seminars', 's'),
                    's.title',
                    's.topic',
                    's.venue',
                    's.city',
                    's.eventDate',
                    DB::raw('NULL as endDate'),
                    's.startTime',
                    's.endTime',
                    's.speakerName',
                    's.price'
                )
                ->first();
        }

        return DB::table('workshops as w')
            ->where('w.id', $entityId)
            ->where('w.status', 1)
            ->where('w.deletedFlag', 0)
            ->whereRaw('COALESCE(w.endDate, w.startDate) >= ?', [$today])
            ->select(
                'w.id',
                EntityCodeService::codeSelect('workshops', 'w'),
                'w.title',
                'w.topic',
                'w.venue',
                'w.city',
                'w.startDate as eventDate',
                'w.endDate',
                'w.startTime',
                'w.endTime',
                'w.speakerName',
                'w.price'
            )
            ->first();
    }

    private function programResponsePayload(object $program, string $entityType, string $entityLabel): array
    {
        return [
            'id' => (int) $program->id,
            'entityType' => $entityType,
            'entityLabel' => $entityLabel,
            'code' => $program->code ?? null,
            'title' => (string) $program->title,
            'topic' => (string) ($program->topic ?? ''),
            'venue' => (string) ($program->venue ?? ''),
            'city' => (string) ($program->city ?? ''),
            'eventDate' => $program->eventDate ?? null,
            'endDate' => $program->endDate ?? null,
            'startTime' => $program->startTime ?? null,
            'endTime' => $program->endTime ?? null,
            'speakerName' => (string) ($program->speakerName ?? ''),
            'price' => (float) ($program->price ?? 0),
        ];
    }

    private function formatMyProgram(object $row, Request $request): array
    {
        $invoiceEntity = $this->invoiceEntityFromJson($row->invoiceData ?? null);
        $programType = $this->resolveProgramEntityType($row->normalizedEntityType ?? null)
            ?? $this->resolveProgramEntityType($row->entityType ?? null)
            ?? $this->resolveProgramEntityType($invoiceEntity['entityType'] ?? null)
            ?? 'workshop';
        $isSeminar = $programType === 'seminar';
        $entityLabel = $this->programEntityLabel($programType);
        $entityId = (int) ($row->normalizedEntityId ?? $row->entityId ?? ($invoiceEntity['entityId'] ?? 0));
        $joinedTitle = $isSeminar ? ($row->seminarTitle ?? null) : ($row->workshopTitle ?? null);
        $details = (!$joinedTitle && $entityId > 0) ? $this->myProgramDetails($programType, $entityId) : null;
        $title = $joinedTitle ?? ($details->title ?? null);
        $topic = ($isSeminar ? ($row->seminarTopic ?? null) : ($row->workshopTopic ?? null)) ?? ($details->topic ?? null);
        $venue = ($isSeminar ? ($row->seminarVenue ?? null) : ($row->workshopVenue ?? null)) ?? ($details->venue ?? null);
        $city = ($isSeminar ? ($row->seminarCity ?? null) : ($row->workshopCity ?? null)) ?? ($details->city ?? null);
        $startDate = ($isSeminar ? ($row->seminarEventDate ?? null) : ($row->workshopStartDate ?? null)) ?? ($details->startDate ?? null);
        $endDate = ($isSeminar ? null : ($row->workshopEndDate ?? null)) ?? ($details->endDate ?? null);
        $startTime = ($isSeminar ? ($row->seminarStartTime ?? null) : ($row->workshopStartTime ?? null)) ?? ($details->startTime ?? null);
        $endTime = ($isSeminar ? ($row->seminarEndTime ?? null) : ($row->workshopEndTime ?? null)) ?? ($details->endTime ?? null);
        $speakerName = ($isSeminar ? ($row->seminarSpeakerName ?? null) : ($row->workshopSpeakerName ?? null)) ?? ($details->speakerName ?? null);
        $capacity = ($isSeminar ? ($row->seminarCapacity ?? null) : ($row->workshopCapacity ?? null)) ?? ($details->capacity ?? null);
        $price = ($isSeminar ? ($row->seminarPrice ?? null) : ($row->workshopPrice ?? null)) ?? ($details->price ?? null);
        $description = ($isSeminar ? ($row->seminarDescription ?? null) : ($row->workshopDescription ?? null)) ?? ($details->description ?? null);
        $takeaways = ($isSeminar ? ($row->seminarTakeaways ?? null) : ($row->workshopTakeaways ?? null)) ?? ($details->takeaways ?? null);
        $bannerImage = ($isSeminar ? ($row->seminarBannerImage ?? null) : ($row->workshopBannerImage ?? null)) ?? ($details->bannerImage ?? null);
        $status = (int) (($isSeminar ? ($row->seminarStatus ?? null) : ($row->workshopStatus ?? null)) ?? ($details->status ?? 0));
        $entityCode = $row->entityCode ?? ($invoiceEntity['entityCode'] ?? ($details->code ?? null));
        $entityTitle = $row->entityTitle ?? ($invoiceEntity['entityTitle'] ?? null);

        return [
            'purchaseId' => (int) $row->purchaseItemId,
            'id' => $entityId,
            'type' => $programType,
            'entityType' => $entityLabel,
            'code' => $entityCode,
            'title' => (string) ($title ?: ($entityTitle ?? $entityLabel)),
            'topic' => (string) ($topic ?? ''),
            'venue' => (string) ($venue ?? ''),
            'city' => (string) ($city ?? ''),
            'eventDate' => $startDate ? (string) $startDate : '',
            'startDate' => $startDate ? (string) $startDate : '',
            'endDate' => $endDate ? (string) $endDate : null,
            'startTime' => $this->formatProgramTime($startTime ?? null),
            'endTime' => $this->formatProgramTime($endTime ?? null),
            'speakerName' => (string) ($speakerName ?? ''),
            'capacity' => (int) ($capacity ?? 0),
            'price' => is_numeric($price) ? (float) $price : (float) ($row->itemPrice ?? 0),
            'totalAmount' => (float) ($row->orderTotalAmount ?? $row->itemTotalAmount ?? 0),
            'description' => (string) ($description ?? ''),
            'takeaways' => $this->decodeProgramTakeaways($takeaways ?? null),
            'bannerImage' => $bannerImage ? (string) $bannerImage : null,
            'bannerImageUrl' => $bannerImage ? $this->privateFileUrl($request, (string) $bannerImage) : null,
            'status' => $status,
            'statusLabel' => $status === 1 ? 'Active' : 'Inactive',
            'scheduleStatus' => $this->programScheduleStatus(
                $programType,
                $startDate ? (string) $startDate : '',
                $endDate ? (string) $endDate : null
            ),
            'enrolledAt' => $row->enrolledAt,
            'orderId' => (int) $row->orderId,
            'orderReference' => $row->orderReference,
            'invoiceNo' => $row->invoiceNumber,
            'razorpayOrderId' => $row->razorpayOrderId,
            'razorpayPaymentId' => $row->razorpayPaymentId,
            'paymentReference' => $row->paymentReference,
            'paymentDisplayId' => $this->paymentDisplayId(
                $row->razorpayPaymentId,
                $row->invoicePaymentReference,
                $row->paymentReference
            ),
        ];
    }

    private function myProgramDetails(string $programType, int $entityId): ?object
    {
        if ($entityId <= 0) {
            return null;
        }

        if ($programType === 'seminar') {
            return DB::table('seminars as s')
                ->where('s.id', $entityId)
                ->where('s.deletedFlag', 0)
                ->select(
                    EntityCodeService::codeSelect('seminars', 's'),
                    's.title',
                    's.topic',
                    's.venue',
                    's.city',
                    's.eventDate as startDate',
                    DB::raw('NULL as endDate'),
                    's.startTime',
                    's.endTime',
                    's.speakerName',
                    's.capacity',
                    's.price',
                    's.description',
                    's.takeaways',
                    's.bannerImage',
                    's.status'
                )
                ->first();
        }

        return DB::table('workshops as w')
            ->where('w.id', $entityId)
            ->where('w.deletedFlag', 0)
            ->select(
                EntityCodeService::codeSelect('workshops', 'w'),
                'w.title',
                'w.topic',
                'w.venue',
                'w.city',
                'w.startDate',
                'w.endDate',
                'w.startTime',
                'w.endTime',
                'w.speakerName',
                'w.capacity',
                'w.price',
                'w.description',
                'w.takeaways',
                'w.bannerImage',
                'w.status'
            )
            ->first();
    }

    private function programScheduleStatus(string $programType, string $startDate, ?string $endDate): string
    {
        if ($startDate === '') {
            return 'upcoming';
        }

        $today = now()->toDateString();
        $lastDate = $programType === 'seminar' ? $startDate : ($endDate ?: $startDate);

        if ($lastDate < $today) {
            return 'completed';
        }

        if ($startDate <= $today && $lastDate >= $today) {
            return 'ongoing';
        }

        return 'upcoming';
    }

    private function formatProgramTime(?string $value): ?string
    {
        $time = trim((string) ($value ?? ''));

        return $time === '' ? null : substr($time, 0, 5);
    }

    private function decodeProgramTakeaways(?string $takeaways): array
    {
        if (!$takeaways) {
            return [];
        }

        $decoded = json_decode($takeaways, true);

        if (!is_array($decoded)) {
            return [];
        }

        return collect($decoded)
            ->filter(fn ($item) => is_string($item) || is_numeric($item))
            ->map(fn ($item) => trim((string) $item))
            ->filter(fn ($item) => $item !== '')
            ->values()
            ->all();
    }

    private function hasSuccessfulProgramPurchase(int $userId, string $entityLabel, int $entityId): bool
    {
        $entityType = $this->normalizeProgramEntityType($entityLabel);

        if (
            Schema::hasTable('invoices')
            && Schema::hasColumn('invoices', 'entityType')
            && Schema::hasColumn('invoices', 'entityId')
        ) {
            $invoiceMatch = DB::table('invoices as i')
                ->join('orders as o', 'o.id', '=', 'i.orderId')
                ->where('i.userId', $userId)
                ->whereIn(DB::raw($this->programEntityTypeSql('i.entityType')), [$entityType])
                ->where('i.entityId', $entityId)
                ->where('i.deletedFlag', 0)
                ->where('o.status', 'paid')
                ->where('o.deletedFlag', 0)
                ->exists();

            if ($invoiceMatch) {
                return true;
            }
        }

        if (
            Schema::hasTable('payment_logs')
            && Schema::hasColumn('payment_logs', 'entityType')
            && Schema::hasColumn('payment_logs', 'entityId')
        ) {
            return DB::table('payment_logs')
                ->where('userId', $userId)
                ->whereIn(DB::raw($this->programEntityTypeSql('entityType')), [$entityType])
                ->where('entityId', $entityId)
                ->where('eventType', 'payment.verified')
                ->where('status', 'success')
                ->where('deletedFlag', 0)
                ->exists();
        }

        return false;
    }

    private function courseOrderItems($orderItems)
    {
        return collect($orderItems)
            ->filter(fn ($item) => (int) ($item->courseId ?? 0) > 0)
            ->values();
    }

    private function orderItemEntitySelects(): array
    {
        return [
            Schema::hasColumn('order_items', 'entityType') ? 'oi.entityType as itemEntityType' : DB::raw('NULL as itemEntityType'),
            Schema::hasColumn('order_items', 'entityId') ? 'oi.entityId as itemEntityId' : DB::raw('NULL as itemEntityId'),
            Schema::hasColumn('order_items', 'entityCode') ? 'oi.entityCode as itemEntityCode' : DB::raw('NULL as itemEntityCode'),
            Schema::hasColumn('order_items', 'entityTitle') ? 'oi.entityTitle as itemEntityTitle' : DB::raw('NULL as itemEntityTitle'),
        ];
    }

    private function orderEntitySummary(int $orderId): ?array
    {
        if (
            Schema::hasTable('order_items')
            && Schema::hasColumn('order_items', 'entityType')
            && Schema::hasColumn('order_items', 'entityId')
        ) {
            $item = DB::table('order_items')
                ->where('orderId', $orderId)
                ->where('deletedFlag', 0)
                ->whereNotNull('entityType')
                ->select(
                    'entityType',
                    'entityId',
                    Schema::hasColumn('order_items', 'entityCode') ? 'entityCode' : DB::raw('NULL as entityCode'),
                    Schema::hasColumn('order_items', 'entityTitle') ? 'entityTitle' : DB::raw('NULL as entityTitle')
                )
                ->first();

            if ($item) {
                return [
                    'entityType' => $item->entityType,
                    'entityId' => $item->entityId ? (int) $item->entityId : null,
                    'entityCode' => $item->entityCode ?? null,
                    'entityTitle' => $item->entityTitle ?? null,
                ];
            }
        }

        if (
            Schema::hasTable('invoices')
            && Schema::hasColumn('invoices', 'entityType')
            && Schema::hasColumn('invoices', 'entityId')
        ) {
            $invoice = DB::table('invoices')
                ->where('orderId', $orderId)
                ->where('deletedFlag', 0)
                ->select(
                    'entityType',
                    'entityId',
                    Schema::hasColumn('invoices', 'entityCode') ? 'entityCode' : DB::raw('NULL as entityCode'),
                    Schema::hasColumn('invoices', 'entityTitle') ? 'entityTitle' : DB::raw('NULL as entityTitle')
                )
                ->first();

            if ($invoice && $invoice->entityType) {
                return [
                    'entityType' => $invoice->entityType,
                    'entityId' => $invoice->entityId ? (int) $invoice->entityId : null,
                    'entityCode' => $invoice->entityCode ?? null,
                    'entityTitle' => $invoice->entityTitle ?? null,
                ];
            }
        }

        return $this->programEntityFromCheckoutLog($orderId);
    }

    private function programEntityFromCheckoutLog(int $orderId): ?array
    {
        if (!Schema::hasTable('payment_logs')) {
            return null;
        }

        $log = DB::table('payment_logs')
            ->where('orderId', $orderId)
            ->where('eventType', 'checkout.program_order_created')
            ->where('deletedFlag', 0)
            ->orderByDesc('id')
            ->first(['requestPayload', 'responsePayload']);

        if (!$log) {
            return null;
        }

        $responsePayload = json_decode($log->responsePayload ?? '', true);
        $requestPayload = json_decode($log->requestPayload ?? '', true);
        $program = is_array($responsePayload) ? ($responsePayload['program'] ?? []) : [];
        $entityType = $this->normalizeProgramEntityType($program['entityType'] ?? ($requestPayload['entityType'] ?? 'workshop'));

        return [
            'entityType' => $program['entityLabel'] ?? $this->programEntityLabel($entityType),
            'entityId' => isset($program['id']) ? (int) $program['id'] : (isset($requestPayload['entityId']) ? (int) $requestPayload['entityId'] : null),
            'entityCode' => $program['code'] ?? null,
            'entityTitle' => $program['title'] ?? null,
        ];
    }

    private function invoiceEntityFromJson(?string $invoiceData): ?array
    {
        if (!$invoiceData) {
            return null;
        }

        $payload = json_decode($invoiceData, true);
        if (!is_array($payload)) {
            return null;
        }

        $firstItem = null;
        if (isset($payload['items']) && is_array($payload['items']) && isset($payload['items'][0]) && is_array($payload['items'][0])) {
            $firstItem = $payload['items'][0];
        }

        return [
            'entityType' => $payload['entityType'] ?? ($firstItem['entityType'] ?? null),
            'entityId' => $payload['entityId'] ?? ($firstItem['entityId'] ?? null),
            'entityCode' => $payload['entityCode'] ?? ($firstItem['entityCode'] ?? ($firstItem['code'] ?? null)),
            'entityTitle' => $payload['entityTitle'] ?? ($firstItem['entityTitle'] ?? ($firstItem['title'] ?? null)),
        ];
    }

    private function razorpay(): Api
    {
        return new Api(
            config('services.razorpay.key', env('RAZORPAY_KEY')),
            config('services.razorpay.secret', env('RAZORPAY_SECRET'))
        );
    }

    private function validationResponse($validator)
    {
        return response()->json([
            'success' => false,
            'message' => 'Validation failed.',
            'errors' => $validator->errors(),
        ], 422);
    }

    private function hasOfflinePaymentLogColumns(): bool
    {
        return Schema::hasTable('payment_logs')
            && Schema::hasColumn('payment_logs', 'transactionNo')
            && Schema::hasColumn('payment_logs', 'referenceNo')
            && Schema::hasColumn('payment_logs', 'paymentBy');
    }

    private function filterExistingColumns(string $table, array $payload): array
    {
        static $columnsByTable = [];

        if (!isset($columnsByTable[$table])) {
            $columnsByTable[$table] = array_flip(Schema::getColumnListing($table));
        }

        return array_intersect_key($payload, $columnsByTable[$table]);
    }

    private function offlinePaymentLogSelects(bool $hasOfflinePaymentColumns): array
    {
        if ($hasOfflinePaymentColumns) {
            return [
                'pl.transactionNo as offlineTransactionNo',
                'pl.referenceNo as offlineReferenceNo',
                'pl.paymentBy as offlinePaymentBy',
                Schema::hasColumn('payment_logs', 'entityType') ? 'pl.entityType as offlineEntityType' : DB::raw('NULL as offlineEntityType'),
                Schema::hasColumn('payment_logs', 'entityCode') ? 'pl.entityCode as offlineEntityCode' : DB::raw('NULL as offlineEntityCode'),
                Schema::hasColumn('payment_logs', 'entityTitle') ? 'pl.entityTitle as offlineEntityTitle' : DB::raw('NULL as offlineEntityTitle'),
            ];
        }

        return [
            DB::raw('NULL as offlineTransactionNo'),
            DB::raw('NULL as offlineReferenceNo'),
            DB::raw('NULL as offlinePaymentBy'),
            DB::raw('NULL as offlineEntityType'),
            DB::raw('NULL as offlineEntityCode'),
            DB::raw('NULL as offlineEntityTitle'),
        ];
    }

    private function paymentDisplayId(mixed ...$values): ?string
    {
        foreach ($values as $value) {
            $normalized = trim((string) ($value ?? ''));
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return null;
    }

    private function paymentMethodLabel(?string $paymentMethod, ?string $paymentBy, ?string $razorpayPaymentId): ?string
    {
        if ($this->paymentDisplayId($razorpayPaymentId)) {
            return $this->paymentDisplayId($paymentMethod, 'RAZORPAY');
        }

        return $this->paymentDisplayId($paymentBy, $paymentMethod);
    }

    private function normalizeInvoicePaymentFields(array $payload): array
    {
        $payload['paymentDisplayId'] = $payload['paymentDisplayId'] ?? $this->paymentDisplayId(
            $payload['razorpayPaymentId'] ?? null,
            $payload['transactionNo'] ?? null,
            $payload['paymentReference'] ?? null
        );

        $payload['paymentMethod'] = $payload['paymentMethod'] ?? $this->paymentMethodLabel(
            null,
            $payload['paymentBy'] ?? null,
            $payload['razorpayPaymentId'] ?? null
        );

        $payload['paymentBy'] = $payload['paymentBy'] ?? $payload['paymentMethod'] ?? null;

        return $payload;
    }

    private function reference(string $prefix): string
    {
        return $prefix . '-' . now()->format('YmdHis') . '-' . strtoupper(bin2hex(random_bytes(4)));
    }

    private function isAdmin(Request $request): bool
    {
        return (int) ($request->user()->role ?? 0) === 1;
    }

    private function invoiceHtml(array $invoice): string
    {
        $rows = collect($invoice['items'])->map(function ($item) {
            $entityType = $item['entityType'] ?? 'Course';
            $entityCode = $item['entityCode'] ?? $item['code'] ?? null;
            $codeHtml = $entityCode ? '<br><span class="code">' . e($entityType) . ' Code: ' . e($entityCode) . '</span>' : '';

            return '<tr><td>' . e($item['title']) . $codeHtml . '</td><td>' . e($item['categoryName']) . '</td><td style="text-align:right">Rs. ' . number_format((float) $item['totalAmount'], 2) . '</td></tr>';
        })->join('');
        $paymentDisplayId = $invoice['paymentDisplayId'] ?? $this->paymentDisplayId($invoice['razorpayPaymentId'] ?? null, $invoice['transactionNo'] ?? null, $invoice['paymentReference'] ?? null);
        $paymentMethod = $invoice['paymentBy'] ?? $invoice['paymentMethod'] ?? (($invoice['razorpayPaymentId'] ?? null) ? 'RAZORPAY' : null);
        $orderReference = $invoice['orderReference'] ?? $invoice['razorpayOrderId'] ?? '';

        return '<!doctype html><html><head><meta charset="utf-8"><title>' . e($invoice['invoiceNo']) . '</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:40px}.brand{display:flex;justify-content:space-between;border-bottom:3px solid #5b5cf6;padding-bottom:20px}.muted{color:#667085}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:28px 0}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #e6e8ef;padding:12px;text-align:left}th{background:#f7f7ff}.code{display:inline-flex;margin-top:6px;padding:4px 10px;border-radius:999px;background:linear-gradient(135deg,rgba(37,99,235,.12),rgba(124,58,237,.12));color:#4f46e5;font:700 12px monospace;border:1px solid rgba(79,70,229,.18)}.total{font-size:24px;font-weight:800;text-align:right;margin-top:24px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save PDF</button><section class="brand"><div><h1>ICETL</h1><p class="muted">Ice Technology Lab</p></div><div><h2>Invoice</h2><strong>' . e($invoice['invoiceNo']) . '</strong></div></section><section class="grid"><div><span class="muted">Billed To</span><h3>' . e($invoice['customer']['name'] ?? 'Customer') . '</h3><p>' . e($invoice['customer']['email'] ?? '') . '</p></div><div><span class="muted">Payment</span><p>Order: ' . e($orderReference) . '</p><p>Transaction: ' . e($paymentDisplayId ?? '') . '</p><p>Method: ' . e($paymentMethod ?? '') . '</p><p>Date: ' . e($invoice['invoiceDate']) . '</p></div></section><table><thead><tr><th>Entity</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>' . $rows . '</tbody></table><p class="total">Total Paid: Rs. ' . number_format((float) $invoice['totalAmount'], 2) . '</p><p class="muted">Thank you for learning with ICETL.</p></body></html>';
    }

    private function privateFileUrl(Request $request, string $path): string
    {
        $requestUrl = $request->url();
        $apiPosition = strpos($requestUrl, '/api/');
        $baseUrl = $apiPosition === false ? $request->getSchemeAndHttpHost() : substr($requestUrl, 0, $apiPosition);

        return $baseUrl . '/api/getAfile?path=' . rawurlencode(trim($path, '/'));
    }

    private function normalizeInstructorIds(mixed $value): array
    {
        $decodedValue = $value;
        for ($i = 0; $i < 2; $i++) {
            if (!is_string($decodedValue)) {
                break;
            }
            $decoded = json_decode($decodedValue, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                break;
            }
            $decodedValue = $decoded;
        }

        if (!is_array($decodedValue)) {
            return [];
        }

        return collect($decodedValue)
            ->map(fn ($item) => is_array($item) && isset($item['id']) ? (int) $item['id'] : (int) $item)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    private function decodeCourseHighlights(?string $courseHighlights): array
    {
        if (!$courseHighlights) {
            return [];
        }

        $decoded = json_decode($courseHighlights, true);
        if (!is_array($decoded)) {
            return [];
        }

        return collect($decoded)
            ->filter(fn ($item) => is_string($item) || is_numeric($item))
            ->map(fn ($item) => trim((string) $item))
            ->filter(fn ($item) => $item !== '')
            ->values()
            ->all();
    }
}
