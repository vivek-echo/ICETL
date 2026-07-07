<?php

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class WorkflowDataService
{
    private const ROLE_ADMIN = 1;
    private const ROLE_LEARNER = 2;
    private const ROLE_INSTRUCTOR = 3;

    private const OFFLINE_COURSE_PERMISSION_ROUTES = [
        '/application/courses/manageOfflineCourses',
        '/application/courses/manageOfflineCourses/add',
        '/application/courses/manageOfflineCourses/viewMyOfflineCourses',
        '/application/courses/manageOfflineCourses/viewAllOfflineCourses',
    ];

    public function canViewAdminWorkflow(object $user): bool
    {
        if ($this->isAdmin($user)) {
            return true;
        }

        return $this->isAuthorizedTeamRole($user);
    }

    public function adminDashboardWorkflow(Request $request): array
    {
        $pendingApprovals = $this->pendingOfflineCourseApprovals();
        $recentEnrollments = $this->recentEnrollmentsForAdmin();
        $recentPayments = $this->recentPaymentsForAdmin();
        $recentCertificates = $this->certificateHistory($request, 5);
        $recentMaterials = $this->materialHistory($request, 5);
        $paymentWorkflow = $this->paymentWorkflow($request, 5);

        return [
            'summary' => [
                'pendingApprovals' => $pendingApprovals['total'],
                'recentEnrollments' => count($recentEnrollments),
                'recentPayments' => count($recentPayments),
                'failedOrPendingPayments' => $paymentWorkflow['summary']['failedOrders'] + $paymentWorkflow['summary']['pendingOrders'],
                'pendingInstallments' => $paymentWorkflow['summary']['pendingInstallments'],
                'overdueInstallments' => $paymentWorkflow['summary']['overdueInstallments'],
                'recentCertificates' => count($recentCertificates),
                'recentMaterialUploads' => count($recentMaterials),
            ],
            'pendingApprovals' => $pendingApprovals['items'],
            'recentEnrollments' => $recentEnrollments,
            'recentPayments' => $recentPayments,
            'recentCertificates' => $recentCertificates,
            'recentMaterials' => $recentMaterials,
            'activity' => $this->activityFeed($request, 8),
            'paymentSummary' => $paymentWorkflow['summary'],
        ];
    }

    public function instructorDashboardWorkflow(Request $request): array
    {
        $user = $request->user();
        $userId = (int) ($user->id ?? 0);
        $courseIds = $this->instructorCourseIds($userId);
        $workshopIds = $this->createdModuleIds('workshops', $userId);
        $seminarIds = $this->createdModuleIds('seminars', $userId);
        $offlineStatus = $this->offlineCourseStatusForInstructor($userId);
        $recentMaterials = $this->materialHistory($request, 5);

        return [
            'summary' => [
                'assignedCourses' => count($courseIds),
                'assignedWorkshops' => count($workshopIds),
                'assignedSeminars' => count($seminarIds),
                'recentMaterialUploads' => count($recentMaterials),
                'offlinePending' => $offlineStatus['pending'],
                'offlineApproved' => $offlineStatus['approved'],
                'offlineRejected' => $offlineStatus['rejected'],
                'recentEnrolledStudents' => $this->recentLearnerCountForInstructor($courseIds),
            ],
            'offlineCourseStatus' => [
                ['label' => 'Pending', 'value' => $offlineStatus['pending']],
                ['label' => 'Approved', 'value' => $offlineStatus['approved']],
                ['label' => 'Rejected', 'value' => $offlineStatus['rejected']],
            ],
            'recentMaterials' => $recentMaterials,
            'activity' => $this->activityFeed($request, 8),
        ];
    }

    public function learnerDashboardWorkflow(Request $request): array
    {
        $userId = (int) ($request->user()->id ?? 0);
        $paymentWorkflow = $this->paymentWorkflow($request, 5);
        $certificates = $this->certificateHistory($request, 5);
        $recentMaterials = $this->materialHistory($request, 5);

        return [
            'summary' => [
                'continueLearning' => $this->continueLearningCount($userId),
                'certificateReadyCourses' => $this->certificateReadyCourseCount($userId),
                'generatedCertificates' => count($certificates),
                'pendingPayments' => $paymentWorkflow['summary']['pendingOrders'],
                'pendingInstallments' => $paymentWorkflow['summary']['pendingInstallments'],
                'overdueInstallments' => $paymentWorkflow['summary']['overdueInstallments'],
                'recentMaterials' => count($recentMaterials),
            ],
            'continueLearning' => $this->continueLearningItems($userId),
            'certificates' => $certificates,
            'recentMaterials' => $recentMaterials,
            'activity' => $this->activityFeed($request, 8),
            'paymentSummary' => $paymentWorkflow['summary'],
        ];
    }

    public function activityFeed(Request $request, int $limit = 20): array
    {
        $limit = $this->safeLimit($limit);
        $items = collect()
            ->merge($this->enrollmentActivities($request, $limit))
            ->merge($this->paymentActivities($request, $limit))
            ->merge($this->materialActivities($request, $limit))
            ->merge($this->certificateActivities($request, $limit))
            ->merge($this->offlineCourseActivities($request, $limit));

        return $items
            ->filter(fn(array $item) => !empty($item['createdAt']))
            ->sortByDesc('createdAt')
            ->take($limit)
            ->values()
            ->all();
    }

    public function certificateHistory(Request $request, int $limit = 20): array
    {
        if (!$this->hasTable('certificates')) {
            return [];
        }

        $limit = $this->safeLimit($limit);
        $user = $request->user();
        $query = DB::table('certificates as cert')
            ->leftJoin('users as u', 'u.id', '=', 'cert.userId')
            ->where('cert.deletedFlag', 0);

        $this->applyCertificateScope($query, $user);

        $query
            ->select(
                'cert.id',
                'cert.certificateNo',
                'cert.userId',
                'cert.studentName',
                'u.name as userName',
                'u.email as userEmail',
                'cert.moduleType',
                'cert.moduleId',
                'cert.moduleTitle',
                'cert.issueDate',
                'cert.verificationCode',
                'cert.verificationUrl',
                'cert.certificatePdfPath',
                'cert.status',
                'cert.createdOn'
            )
            ->orderByDesc(DB::raw('COALESCE(cert.createdOn, cert.issueDate)'))
            ->limit($limit);

        return $query->get()
            ->map(fn(object $row) => $this->formatCertificate($row))
            ->values()
            ->all();
    }

    public function paymentWorkflow(Request $request, int $limit = 20): array
    {
        $orders = $this->paymentOrders($request, $limit);
        $installments = $this->offlineInstallments($request, $limit);
        $summary = [
            'orders' => count($orders),
            'paidOrders' => collect($orders)->where('status', 'paid')->count(),
            'failedOrders' => collect($orders)->whereIn('status', ['failed', 'cancelled'])->count(),
            'pendingOrders' => collect($orders)->where('status', 'pending')->count(),
            'totalPaid' => collect($orders)->where('status', 'paid')->sum(fn(array $row) => (float) ($row['totalAmount'] ?? 0)),
            'pendingInstallments' => collect($installments)->whereIn('status', ['PENDING', 'PARTIALLY_PAID'])->count(),
            'overdueInstallments' => collect($installments)->where('dueStatus', 'overdue')->count(),
            'balanceAmount' => collect($installments)->sum(fn(array $row) => (float) ($row['balanceAmount'] ?? 0)),
        ];

        return [
            'summary' => $summary,
            'orders' => $orders,
            'installments' => $installments,
        ];
    }

    public function materialHistory(Request $request, int $limit = 20): array
    {
        if (!$this->hasTable('moduleMaterials')) {
            return [];
        }

        $limit = $this->safeLimit($limit);
        $query = DB::table('moduleMaterials as mm')
            ->leftJoin('users as uploader', 'uploader.id', '=', 'mm.instructorId')
            ->where('mm.deletedFlag', 0)
            ->where('mm.status', 1);

        $moduleType = strtoupper(trim((string) $request->query('moduleType', '')));
        $moduleId = (int) $request->query('moduleId', 0);

        if (in_array($moduleType, ['ACADEMIC_COURSE', 'WORKSHOP', 'SEMINAR'], true)) {
            $query->where('mm.moduleType', $moduleType);
        }

        if ($moduleId > 0) {
            $query->where('mm.moduleId', $moduleId);
        }

        $this->applyMaterialScope($query, $request->user());

        return $query
            ->select(
                'mm.id',
                'mm.moduleType',
                'mm.moduleId',
                'mm.instructorId',
                'mm.title',
                'mm.description',
                'mm.materialDate',
                'mm.originalFileName',
                'mm.fileExtension',
                'mm.mimeType',
                'mm.fileSize',
                'mm.created_at',
                'mm.updated_at',
                'uploader.name as uploadedByName',
                'uploader.email as uploadedByEmail'
            )
            ->orderByRaw('COALESCE(mm.materialDate, DATE(mm.created_at)) DESC')
            ->orderByDesc('mm.created_at')
            ->limit($limit)
            ->get()
            ->map(fn(object $row) => $this->formatMaterial($row))
            ->values()
            ->all();
    }

    private function enrollmentActivities(Request $request, int $limit): Collection
    {
        if (!$this->hasTable('enrollments') || !$this->hasTable('courses')) {
            return collect();
        }

        $query = DB::table('enrollments as e')
            ->join('courses as c', 'c.id', '=', 'e.courseId')
            ->leftJoin('users as u', 'u.id', '=', 'e.userId')
            ->where('e.deletedFlag', 0)
            ->where('c.deletedFlag', 0);

        $this->applyCourseRecordScope($query, $request->user(), 'e.userId', 'e.courseId');

        return $query
            ->select('e.id', 'e.userId', 'e.courseId', 'e.status', 'e.created_at', 'c.title', 'u.name as userName')
            ->orderByDesc('e.id')
            ->limit($limit)
            ->get()
            ->map(fn(object $row) => [
                'id' => 'enrollment-' . (int) $row->id,
                'type' => 'enrollment.created',
                'title' => 'Enrollment created',
                'description' => trim(($row->userName ?: 'Learner') . ' enrolled in ' . ($row->title ?: 'a course')),
                'moduleType' => 'ACADEMIC_COURSE',
                'moduleId' => (int) $row->courseId,
                'createdAt' => $row->created_at,
                'routeKey' => 'enrollments',
                'status' => $row->status,
            ]);
    }

    private function paymentActivities(Request $request, int $limit): Collection
    {
        if (!$this->hasTable('orders')) {
            return collect();
        }

        $query = DB::table('orders as o')
            ->leftJoin('payments as p', function ($join) {
                $join->on('p.orderId', '=', 'o.id')->where('p.deletedFlag', 0);
            })
            ->leftJoin('users as u', 'u.id', '=', 'o.userId')
            ->where('o.deletedFlag', 0);

        $this->applyPaymentScope($query, $request->user());

        return $query
            ->select(
                'o.id',
                'o.userId',
                'o.orderReference',
                'o.totalAmount',
                'o.status',
                'o.created_at',
                'p.status as paymentStatus',
                'p.paidAt',
                'u.name as userName'
            )
            ->orderByDesc('o.id')
            ->limit($limit)
            ->get()
            ->map(function (object $row) {
                $status = $row->paymentStatus ?: $row->status;

                return [
                    'id' => 'payment-' . (int) $row->id,
                    'type' => 'payment.' . strtolower((string) $status),
                    'title' => 'Payment ' . ucfirst((string) ($status ?: 'updated')),
                    'description' => trim(($row->userName ?: 'Learner') . ' - ' . ($row->orderReference ?: 'Order #' . $row->id) . ' - Rs. ' . number_format((float) $row->totalAmount, 2)),
                    'moduleType' => null,
                    'moduleId' => null,
                    'createdAt' => $row->paidAt ?: $row->created_at,
                    'routeKey' => 'payments',
                    'status' => $status,
                ];
            });
    }

    private function materialActivities(Request $request, int $limit): Collection
    {
        return collect($this->materialHistory($request, $limit))
            ->map(fn(array $row) => [
                'id' => 'material-' . (int) $row['id'],
                'type' => 'material.uploaded',
                'title' => 'Material uploaded',
                'description' => trim(($row['title'] ?: $row['originalFileName']) . ' uploaded by ' . ($row['uploadedBy']['name'] ?? 'Instructor')),
                'moduleType' => $row['moduleType'],
                'moduleId' => $row['moduleId'],
                'createdAt' => $row['createdAt'] ?: $row['materialDate'],
                'routeKey' => 'materials',
                'status' => 'available',
            ]);
    }

    private function certificateActivities(Request $request, int $limit): Collection
    {
        return collect($this->certificateHistory($request, $limit))
            ->map(fn(array $row) => [
                'id' => 'certificate-' . (int) $row['id'],
                'type' => 'certificate.generated',
                'title' => 'Certificate generated',
                'description' => trim(($row['certificateNo'] ?: 'Certificate') . ' for ' . ($row['moduleTitle'] ?: 'module')),
                'moduleType' => $row['moduleType'],
                'moduleId' => $row['moduleId'],
                'createdAt' => $row['createdAt'] ?: $row['issueDate'],
                'routeKey' => 'certificates',
                'status' => $row['status'],
            ]);
    }

    private function offlineCourseActivities(Request $request, int $limit): Collection
    {
        if (!$this->hasTable('courses') || !$this->hasColumn('courses', 'approvalStatus')) {
            return collect();
        }

        $user = $request->user();
        $query = DB::table('courses as c')
            ->leftJoin('users as creator', 'creator.id', '=', 'c.createdBy')
            ->where('c.courseType', 2)
            ->where('c.deletedFlag', 0)
            ->whereIn('c.approvalStatus', ['APPROVED', 'REJECTED', 'PENDING']);

        if (!$this->canViewAdminWorkflow($user)) {
            if ($this->isInstructor($user)) {
                $this->applyInstructorCourseScope($query, (int) $user->id, 'c');
            } else {
                return collect();
            }
        }

        return $query
            ->select(
                'c.id',
                'c.title',
                'c.approvalStatus',
                'c.approvedOn',
                'c.rejectedOn',
                'c.publishedOn',
                'c.publishedFlag',
                'c.createdOn',
                'creator.name as creatorName'
            )
            ->orderByDesc(DB::raw('COALESCE(c.publishedOn, c.rejectedOn, c.approvedOn, c.createdOn)'))
            ->limit($limit)
            ->get()
            ->map(function (object $row) {
                $status = strtoupper((string) ($row->approvalStatus ?: 'PENDING'));
                $published = (int) ($row->publishedFlag ?? 0) === 1;
                $type = $published ? 'course.published' : 'course.' . strtolower($status);
                $title = $published ? 'Course published' : 'Course ' . strtolower($status);

                return [
                    'id' => 'offline-course-' . (int) $row->id . '-' . strtolower($status) . '-' . (int) $published,
                    'type' => $type,
                    'title' => ucfirst($title),
                    'description' => trim(($row->title ?: 'Offline course') . ' by ' . ($row->creatorName ?: 'ICETL')),
                    'moduleType' => 'ACADEMIC_COURSE',
                    'moduleId' => (int) $row->id,
                    'createdAt' => $row->publishedOn ?: ($row->rejectedOn ?: ($row->approvedOn ?: $row->createdOn)),
                    'routeKey' => 'offlineCourses',
                    'status' => $published ? 'PUBLISHED' : $status,
                ];
            });
    }

    private function pendingOfflineCourseApprovals(): array
    {
        if (!$this->hasTable('courses') || !$this->hasColumn('courses', 'approvalStatus')) {
            return ['total' => 0, 'items' => []];
        }

        $query = DB::table('courses as c')
            ->leftJoin('users as creator', 'creator.id', '=', 'c.createdBy')
            ->where('c.courseType', 2)
            ->where('c.deletedFlag', 0)
            ->where('c.approvalStatus', 'PENDING');

        $total = (clone $query)->count();
        $items = $query
            ->select('c.id', 'c.title', 'c.createdOn', 'creator.name as creatorName')
            ->orderByDesc('c.createdOn')
            ->limit(6)
            ->get()
            ->map(fn(object $row) => [
                'id' => (int) $row->id,
                'title' => (string) $row->title,
                'creatorName' => $row->creatorName ?: 'Instructor',
                'createdAt' => $row->createdOn,
                'status' => 'PENDING',
            ])
            ->values()
            ->all();

        return ['total' => $total, 'items' => $items];
    }

    private function recentEnrollmentsForAdmin(): array
    {
        if (!$this->hasTable('enrollments') || !$this->hasTable('courses')) {
            return [];
        }

        return DB::table('enrollments as e')
            ->join('courses as c', 'c.id', '=', 'e.courseId')
            ->leftJoin('users as u', 'u.id', '=', 'e.userId')
            ->where('e.deletedFlag', 0)
            ->where('c.deletedFlag', 0)
            ->select('e.id', 'e.userId', 'e.courseId', 'e.status', 'e.created_at', 'c.title', 'u.name as userName', 'u.email as userEmail')
            ->orderByDesc('e.id')
            ->limit(6)
            ->get()
            ->map(fn(object $row) => [
                'id' => (int) $row->id,
                'userId' => (int) $row->userId,
                'courseId' => (int) $row->courseId,
                'courseTitle' => $row->title,
                'userName' => $row->userName ?: 'Learner',
                'userEmail' => $row->userEmail,
                'status' => $row->status,
                'createdAt' => $row->created_at,
            ])
            ->values()
            ->all();
    }

    private function recentPaymentsForAdmin(): array
    {
        if (!$this->hasTable('orders')) {
            return [];
        }

        return DB::table('orders as o')
            ->leftJoin('payments as p', function ($join) {
                $join->on('p.orderId', '=', 'o.id')->where('p.deletedFlag', 0);
            })
            ->leftJoin('users as u', 'u.id', '=', 'o.userId')
            ->where('o.deletedFlag', 0)
            ->select('o.id', 'o.orderReference', 'o.totalAmount', 'o.status', 'o.created_at', 'p.status as paymentStatus', 'u.name as userName')
            ->orderByDesc('o.id')
            ->limit(6)
            ->get()
            ->map(fn(object $row) => [
                'id' => (int) $row->id,
                'orderReference' => $row->orderReference,
                'userName' => $row->userName ?: 'Learner',
                'totalAmount' => (float) $row->totalAmount,
                'status' => $row->paymentStatus ?: $row->status,
                'createdAt' => $row->created_at,
            ])
            ->values()
            ->all();
    }

    private function paymentOrders(Request $request, int $limit): array
    {
        if (!$this->hasTable('orders')) {
            return [];
        }

        $query = DB::table('orders as o')
            ->leftJoin('payments as p', function ($join) {
                $join->on('p.orderId', '=', 'o.id')->where('p.deletedFlag', 0);
            })
            ->leftJoin('invoices as i', function ($join) {
                $join->on('i.orderId', '=', 'o.id')->where('i.deletedFlag', 0);
            })
            ->leftJoin('users as u', 'u.id', '=', 'o.userId')
            ->where('o.deletedFlag', 0);

        $this->applyPaymentScope($query, $request->user());

        return $query
            ->select(
                'o.id',
                'o.userId',
                'o.orderReference',
                'o.totalAmount',
                'o.currency',
                'o.status',
                'o.created_at',
                'p.status as paymentStatus',
                'p.paymentMethod',
                'p.paymentReference',
                'p.razorpayPaymentId',
                'p.failureReason',
                'i.id as invoiceId',
                'i.invoiceNumber',
                'i.paymentReference as invoicePaymentReference',
                'u.name as userName',
                'u.email as userEmail'
            )
            ->orderByDesc('o.id')
            ->limit($this->safeLimit($limit))
            ->get()
            ->map(fn(object $row) => [
                'id' => (int) $row->id,
                'userId' => (int) $row->userId,
                'userName' => $row->userName ?: 'Learner',
                'userEmail' => $row->userEmail,
                'orderReference' => $row->orderReference,
                'totalAmount' => (float) $row->totalAmount,
                'currency' => $row->currency ?: 'INR',
                'status' => $row->status,
                'paymentStatus' => $row->paymentStatus,
                'paymentMethod' => $row->paymentMethod,
                'paymentReference' => $this->paymentDisplayId(
                    $row->razorpayPaymentId ?? null,
                    $row->invoicePaymentReference ?? null,
                    $row->paymentReference ?? null
                ),
                'failureReason' => $row->failureReason,
                'invoiceId' => $row->invoiceId ? (int) $row->invoiceId : null,
                'invoiceNumber' => $row->invoiceNumber,
                'invoiceDownloadUrl' => $row->invoiceId ? url('/api/invoice/' . (int) $row->id . '/download') : null,
                'createdAt' => $row->created_at,
            ])
            ->values()
            ->all();
    }

    private function offlineInstallments(Request $request, int $limit): array
    {
        if (!$this->hasTable('offline_course_installments')) {
            return [];
        }

        $query = DB::table('offline_course_installments as oci')
            ->leftJoin('courses as c', 'c.id', '=', 'oci.courseId')
            ->leftJoin('users as u', 'u.id', '=', 'oci.userId')
            ->leftJoin('invoices as i', 'i.id', '=', 'oci.invoiceId')
            ->where('oci.deletedFlag', 0);

        $this->applyInstallmentScope($query, $request->user());

        return $query
            ->select(
                'oci.id',
                'oci.paymentLogId',
                'oci.userId',
                'oci.courseId',
                'oci.enrollmentId',
                'oci.installmentNo',
                'oci.amount',
                'oci.paidAmount',
                'oci.balanceAmount',
                'oci.paymentStatus',
                'oci.expectedDate',
                'oci.paidDate',
                'oci.paymentDate',
                'oci.paymentBy',
                'oci.paymentType',
                'oci.transactionNo',
                'oci.invoiceId',
                'oci.status',
                'oci.createdOn',
                'c.title as courseTitle',
                'u.name as userName',
                'u.email as userEmail',
                'i.invoiceNumber',
                'i.orderId as invoiceOrderId'
            )
            ->orderByRaw('COALESCE(oci.expectedDate, oci.createdOn) ASC')
            ->limit($this->safeLimit($limit))
            ->get()
            ->map(function (object $row) {
                $status = strtoupper((string) ($row->paymentStatus ?: $row->status ?: 'PENDING'));
                $expectedDate = $row->expectedDate ? (string) $row->expectedDate : null;

                return [
                    'id' => (int) $row->id,
                    'paymentLogId' => (int) $row->paymentLogId,
                    'userId' => (int) $row->userId,
                    'userName' => $row->userName ?: 'Learner',
                    'userEmail' => $row->userEmail,
                    'courseId' => (int) $row->courseId,
                    'courseTitle' => $row->courseTitle ?: 'Offline course',
                    'enrollmentId' => $row->enrollmentId ? (int) $row->enrollmentId : null,
                    'installmentNo' => (int) $row->installmentNo,
                    'amount' => (float) $row->amount,
                    'paidAmount' => (float) ($row->paidAmount ?? 0),
                    'balanceAmount' => (float) ($row->balanceAmount ?? max(((float) $row->amount) - ((float) ($row->paidAmount ?? 0)), 0)),
                    'status' => $status,
                    'dueStatus' => $this->dueStatus($status, $expectedDate),
                    'expectedDate' => $expectedDate,
                    'paidDate' => $row->paidDate ?: $row->paymentDate,
                    'paymentBy' => $row->paymentBy ?: $row->paymentType,
                    'transactionNo' => $row->transactionNo,
                    'invoiceId' => $row->invoiceId ? (int) $row->invoiceId : null,
                    'invoiceNumber' => $row->invoiceNumber,
                    'invoiceOrderId' => $row->invoiceOrderId ? (int) $row->invoiceOrderId : null,
                    'invoiceDownloadUrl' => $row->invoiceOrderId ? url('/api/invoice/' . (int) $row->invoiceOrderId . '/download') : null,
                    'createdAt' => $row->createdOn,
                ];
            })
            ->values()
            ->all();
    }

    private function formatCertificate(object $row): array
    {
        $active = (int) ($row->status ?? 0) === 1;
        $downloadAvailable = $active && trim((string) ($row->certificatePdfPath ?? '')) !== '';

        return [
            'id' => (int) $row->id,
            'certificateNo' => $row->certificateNo,
            'userId' => $row->userId ? (int) $row->userId : null,
            'studentName' => $row->studentName ?: ($row->userName ?: 'Learner'),
            'userName' => $row->userName,
            'userEmail' => $row->userEmail,
            'moduleType' => $row->moduleType,
            'moduleId' => (int) $row->moduleId,
            'moduleTitle' => $row->moduleTitle,
            'issueDate' => $row->issueDate,
            'verificationCode' => $row->verificationCode,
            'verificationUrl' => $row->verificationUrl,
            'downloadAvailable' => $downloadAvailable,
            'downloadUrl' => $downloadAvailable ? url('/api/certificates/download/' . $row->certificateNo) : null,
            'verificationStatus' => $active ? 'verified' : 'inactive',
            'status' => $active ? 'active' : 'inactive',
            'createdAt' => $row->createdOn,
        ];
    }

    private function formatMaterial(object $row): array
    {
        return [
            'id' => (int) $row->id,
            'moduleType' => (string) $row->moduleType,
            'moduleId' => (int) $row->moduleId,
            'title' => (string) $row->title,
            'description' => $row->description,
            'materialDate' => $row->materialDate,
            'originalFileName' => (string) $row->originalFileName,
            'fileExtension' => $row->fileExtension,
            'mimeType' => $row->mimeType,
            'fileSize' => $row->fileSize ? (int) $row->fileSize : null,
            'fileSizeLabel' => $this->humanFileSize((int) ($row->fileSize ?? 0)),
            'uploadedBy' => [
                'id' => $row->instructorId ? (int) $row->instructorId : null,
                'name' => $row->uploadedByName ?: null,
                'email' => $row->uploadedByEmail ?: null,
            ],
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
            'downloadUrl' => url('/api/module-materials/' . (int) $row->id . '/download?download=1'),
            'viewUrl' => url('/api/module-materials/' . (int) $row->id . '/download'),
        ];
    }

    private function applyCertificateScope(Builder $query, ?object $user): void
    {
        if (!$user) {
            $query->whereRaw('1 = 0');
            return;
        }

        if ($this->canViewAdminWorkflow($user)) {
            return;
        }

        if ($this->isInstructor($user)) {
            $courseIds = $this->instructorCourseIds((int) $user->id);
            $workshopIds = $this->createdModuleIds('workshops', (int) $user->id);
            $seminarIds = $this->createdModuleIds('seminars', (int) $user->id);

            $query->where(function ($scope) use ($courseIds, $workshopIds, $seminarIds) {
                if ($courseIds) {
                    $scope->orWhere(function ($courseScope) use ($courseIds) {
                        $courseScope->whereIn('cert.moduleType', ['COURSE', 'ACADEMIC_COURSE'])
                            ->whereIn('cert.moduleId', $courseIds);
                    });
                }

                if ($workshopIds) {
                    $scope->orWhere(function ($workshopScope) use ($workshopIds) {
                        $workshopScope->where('cert.moduleType', 'WORKSHOP')
                            ->whereIn('cert.moduleId', $workshopIds);
                    });
                }

                if ($seminarIds) {
                    $scope->orWhere(function ($seminarScope) use ($seminarIds) {
                        $seminarScope->where('cert.moduleType', 'SEMINAR')
                            ->whereIn('cert.moduleId', $seminarIds);
                    });
                }

                if (!$courseIds && !$workshopIds && !$seminarIds) {
                    $scope->whereRaw('1 = 0');
                }
            });
            return;
        }

        $query->where('cert.userId', (int) $user->id);
    }

    private function applyCourseRecordScope(Builder $query, ?object $user, string $studentColumn, string $courseColumn): void
    {
        if (!$user) {
            $query->whereRaw('1 = 0');
            return;
        }

        if ($this->canViewAdminWorkflow($user)) {
            return;
        }

        if ($this->isInstructor($user)) {
            $courseIds = $this->instructorCourseIds((int) $user->id);
            $courseIds ? $query->whereIn($courseColumn, $courseIds) : $query->whereRaw('1 = 0');
            return;
        }

        $query->where($studentColumn, (int) $user->id);
    }

    private function applyPaymentScope(Builder $query, ?object $user): void
    {
        if (!$user) {
            $query->whereRaw('1 = 0');
            return;
        }

        if ($this->canViewAdminWorkflow($user)) {
            return;
        }

        if ($this->isInstructor($user) && $this->hasTable('order_items')) {
            $courseIds = $this->instructorCourseIds((int) $user->id);
            $workshopIds = $this->createdModuleIds('workshops', (int) $user->id);
            $seminarIds = $this->createdModuleIds('seminars', (int) $user->id);

            $query->whereExists(function ($exists) use ($courseIds, $workshopIds, $seminarIds) {
                $exists->select(DB::raw(1))
                    ->from('order_items as oi')
                    ->whereColumn('oi.orderId', 'o.id')
                    ->where('oi.deletedFlag', 0)
                    ->where(function ($itemScope) use ($courseIds, $workshopIds, $seminarIds) {
                        if ($courseIds) {
                            $itemScope->orWhereIn('oi.courseId', $courseIds);
                        }

                        if ($this->hasColumn('order_items', 'entityType') && $this->hasColumn('order_items', 'entityId')) {
                            if ($workshopIds) {
                                $itemScope->orWhere(function ($programScope) use ($workshopIds) {
                                    $programScope->whereRaw('LOWER(oi.entityType) = ?', ['workshop'])->whereIn('oi.entityId', $workshopIds);
                                });
                            }

                            if ($seminarIds) {
                                $itemScope->orWhere(function ($programScope) use ($seminarIds) {
                                    $programScope->whereRaw('LOWER(oi.entityType) = ?', ['seminar'])->whereIn('oi.entityId', $seminarIds);
                                });
                            }
                        }

                        if (!$courseIds && !$workshopIds && !$seminarIds) {
                            $itemScope->whereRaw('1 = 0');
                        }
                    });
            });
            return;
        }

        $query->where('o.userId', (int) $user->id);
    }

    private function applyInstallmentScope(Builder $query, ?object $user): void
    {
        if (!$user) {
            $query->whereRaw('1 = 0');
            return;
        }

        if ($this->canViewAdminWorkflow($user)) {
            return;
        }

        if ($this->isInstructor($user)) {
            $courseIds = $this->instructorCourseIds((int) $user->id);
            $courseIds ? $query->whereIn('oci.courseId', $courseIds) : $query->whereRaw('1 = 0');
            return;
        }

        $query->where('oci.userId', (int) $user->id);
    }

    private function applyMaterialScope(Builder $query, ?object $user): void
    {
        if (!$user) {
            $query->whereRaw('1 = 0');
            return;
        }

        if ($this->canViewAdminWorkflow($user)) {
            return;
        }

        if ($this->isInstructor($user)) {
            $courseIds = $this->instructorCourseIds((int) $user->id);
            $workshopIds = $this->createdModuleIds('workshops', (int) $user->id);
            $seminarIds = $this->createdModuleIds('seminars', (int) $user->id);

            $query->where(function ($scope) use ($user, $courseIds, $workshopIds, $seminarIds) {
                $scope->where('mm.instructorId', (int) $user->id);

                if ($courseIds) {
                    $scope->orWhere(function ($moduleScope) use ($courseIds) {
                        $moduleScope->where('mm.moduleType', 'ACADEMIC_COURSE')->whereIn('mm.moduleId', $courseIds);
                    });
                }

                if ($workshopIds) {
                    $scope->orWhere(function ($moduleScope) use ($workshopIds) {
                        $moduleScope->where('mm.moduleType', 'WORKSHOP')->whereIn('mm.moduleId', $workshopIds);
                    });
                }

                if ($seminarIds) {
                    $scope->orWhere(function ($moduleScope) use ($seminarIds) {
                        $moduleScope->where('mm.moduleType', 'SEMINAR')->whereIn('mm.moduleId', $seminarIds);
                    });
                }
            });
            return;
        }

        $courseIds = $this->learnerCourseIds((int) $user->id);
        $workshopIds = $this->learnerProgramIds((int) $user->id, 'workshop');
        $seminarIds = $this->learnerProgramIds((int) $user->id, 'seminar');

        $query->where(function ($scope) use ($courseIds, $workshopIds, $seminarIds) {
            if ($courseIds) {
                $scope->orWhere(function ($moduleScope) use ($courseIds) {
                    $moduleScope->where('mm.moduleType', 'ACADEMIC_COURSE')->whereIn('mm.moduleId', $courseIds);
                });
            }

            if ($workshopIds) {
                $scope->orWhere(function ($moduleScope) use ($workshopIds) {
                    $moduleScope->where('mm.moduleType', 'WORKSHOP')->whereIn('mm.moduleId', $workshopIds);
                });
            }

            if ($seminarIds) {
                $scope->orWhere(function ($moduleScope) use ($seminarIds) {
                    $moduleScope->where('mm.moduleType', 'SEMINAR')->whereIn('mm.moduleId', $seminarIds);
                });
            }

            if (!$courseIds && !$workshopIds && !$seminarIds) {
                $scope->whereRaw('1 = 0');
            }
        });
    }

    private function applyInstructorCourseScope(Builder $query, int $userId, string $courseAlias): void
    {
        $query->where(function ($scope) use ($userId, $courseAlias) {
            $scope->where($courseAlias . '.createdBy', $userId);

            if ($this->hasTable('courseinstructors')) {
                $scope->orWhereExists(function ($exists) use ($userId, $courseAlias) {
                    $exists->select(DB::raw(1))
                        ->from('courseinstructors as ci')
                        ->whereColumn('ci.courseId', $courseAlias . '.id')
                        ->where('ci.instructorId', $userId);
                });
            }
        });
    }

    private function instructorCourseIds(int $userId): array
    {
        $ids = collect();

        if ($this->hasTable('courseinstructors')) {
            $ids = $ids->merge(DB::table('courseinstructors')->where('instructorId', $userId)->pluck('courseId'));
        }

        if ($this->hasTable('courses')) {
            $ids = $ids->merge(DB::table('courses')->where('createdBy', $userId)->where('deletedFlag', 0)->pluck('id'));
        }

        return $ids->map(fn($id) => (int) $id)->filter()->unique()->values()->all();
    }

    private function learnerCourseIds(int $userId): array
    {
        if (!$this->hasTable('enrollments')) {
            return [];
        }

        return DB::table('enrollments')
            ->where('userId', $userId)
            ->where('deletedFlag', 0)
            ->pluck('courseId')
            ->map(fn($id) => (int) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function learnerProgramIds(int $userId, string $programType): array
    {
        if (!$this->hasTable('orders') || !$this->hasTable('order_items') || !$this->hasColumn('order_items', 'entityType')) {
            return [];
        }

        return DB::table('order_items as oi')
            ->join('orders as o', 'o.id', '=', 'oi.orderId')
            ->where('o.userId', $userId)
            ->where('o.deletedFlag', 0)
            ->where('oi.deletedFlag', 0)
            ->whereRaw('LOWER(oi.entityType) = ?', [$programType])
            ->whereNotNull('oi.entityId')
            ->pluck('oi.entityId')
            ->map(fn($id) => (int) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function createdModuleIds(string $table, int $userId): array
    {
        if (!$this->hasTable($table)) {
            return [];
        }

        return DB::table($table)
            ->where('createdBy', $userId)
            ->where('deletedFlag', 0)
            ->pluck('id')
            ->map(fn($id) => (int) $id)
            ->filter()
            ->values()
            ->all();
    }

    private function offlineCourseStatusForInstructor(int $userId): array
    {
        $status = ['pending' => 0, 'approved' => 0, 'rejected' => 0];

        if (!$this->hasTable('courses') || !$this->hasColumn('courses', 'approvalStatus')) {
            return $status;
        }

        $query = DB::table('courses as c')
            ->where('c.courseType', 2)
            ->where('c.deletedFlag', 0);
        $this->applyInstructorCourseScope($query, $userId, 'c');

        $rows = $query
            ->selectRaw("UPPER(COALESCE(c.approvalStatus, 'PENDING')) as approvalStatus, COUNT(*) as total")
            ->groupBy('approvalStatus')
            ->pluck('total', 'approvalStatus');

        $status['pending'] = (int) ($rows['PENDING'] ?? 0);
        $status['approved'] = (int) ($rows['APPROVED'] ?? 0);
        $status['rejected'] = (int) ($rows['REJECTED'] ?? 0);

        return $status;
    }

    private function recentLearnerCountForInstructor(array $courseIds): int
    {
        if (!$courseIds || !$this->hasTable('enrollments')) {
            return 0;
        }

        return DB::table('enrollments')
            ->whereIn('courseId', $courseIds)
            ->where('deletedFlag', 0)
            ->where('created_at', '>=', now()->subDays(30))
            ->distinct('userId')
            ->count('userId');
    }

    private function continueLearningCount(int $userId): int
    {
        if (!$this->hasTable('enrollments')) {
            return 0;
        }

        return DB::table('enrollments')
            ->where('userId', $userId)
            ->where('deletedFlag', 0)
            ->where('progressPercent', '<', 100)
            ->count();
    }

    private function certificateReadyCourseCount(int $userId): int
    {
        if (!$this->hasTable('enrollments')) {
            return 0;
        }

        return DB::table('enrollments')
            ->where('userId', $userId)
            ->where('deletedFlag', 0)
            ->where('progressPercent', '>=', 75)
            ->count();
    }

    private function continueLearningItems(int $userId): array
    {
        if (!$this->hasTable('enrollments') || !$this->hasTable('courses')) {
            return [];
        }

        return DB::table('enrollments as e')
            ->join('courses as c', 'c.id', '=', 'e.courseId')
            ->where('e.userId', $userId)
            ->where('e.deletedFlag', 0)
            ->where('c.deletedFlag', 0)
            ->where('e.progressPercent', '<', 100)
            ->select('e.id as enrollmentId', 'e.courseId', 'e.progressPercent', 'e.lastWatchedAt', 'c.title')
            ->orderByDesc(DB::raw('COALESCE(e.lastWatchedAt, e.created_at)'))
            ->limit(5)
            ->get()
            ->map(fn(object $row) => [
                'enrollmentId' => (int) $row->enrollmentId,
                'courseId' => (int) $row->courseId,
                'title' => $row->title,
                'progressPercent' => (int) ($row->progressPercent ?? 0),
                'lastWatchedAt' => $row->lastWatchedAt,
            ])
            ->values()
            ->all();
    }

    private function dueStatus(string $status, ?string $expectedDate): string
    {
        if (in_array($status, ['PAID'], true)) {
            return 'paid';
        }

        if ($expectedDate && $expectedDate < now()->toDateString()) {
            return 'overdue';
        }

        if ($expectedDate === now()->toDateString()) {
            return 'due_today';
        }

        return 'upcoming';
    }

    private function paymentDisplayId(?string ...$values): ?string
    {
        foreach ($values as $value) {
            $normalized = trim((string) ($value ?? ''));
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return null;
    }

    private function humanFileSize(int $bytes): string
    {
        if ($bytes <= 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB'];
        $size = (float) $bytes;
        $unitIndex = 0;

        while ($size >= 1024 && $unitIndex < count($units) - 1) {
            $size /= 1024;
            $unitIndex++;
        }

        return round($size, $unitIndex === 0 ? 0 : 1) . ' ' . $units[$unitIndex];
    }

    private function safeLimit(int $limit): int
    {
        return max(1, min(50, $limit));
    }

    private function isAdmin(?object $user): bool
    {
        return (int) ($user->role ?? 0) === self::ROLE_ADMIN;
    }

    private function isInstructor(?object $user): bool
    {
        return (int) ($user->role ?? 0) === self::ROLE_INSTRUCTOR;
    }

    private function isAuthorizedTeamRole(?object $user): bool
    {
        $roleId = (int) ($user->role ?? 0);

        if ($roleId <= 0 || $roleId === self::ROLE_LEARNER || $roleId === self::ROLE_INSTRUCTOR) {
            return false;
        }

        if (!$this->hasTable('roles') || !$this->hasTable('role_menu_permissions') || !$this->hasTable('menus')) {
            return false;
        }

        static $permissionCache = [];

        if (array_key_exists($roleId, $permissionCache)) {
            return $permissionCache[$roleId];
        }

        $role = DB::table('roles')
            ->where('id', $roleId)
            ->where('deletedFlag', 0)
            ->first();

        if (!$role || !str_contains($this->normalizeRoleValue($role->roleName ?? ''), 'team')) {
            $permissionCache[$roleId] = false;
            return false;
        }

        $permission = DB::table('role_menu_permissions')
            ->where('roleId', $roleId)
            ->where('deletedFlag', 0)
            ->first();

        if (!$permission || !is_string($permission->permissionJson ?? null)) {
            $permissionCache[$roleId] = false;
            return false;
        }

        $payload = json_decode($permission->permissionJson, true);

        if (!is_array($payload)) {
            $permissionCache[$roleId] = false;
            return false;
        }

        $allowedMenuIds = collect($payload)
            ->filter(function ($value, $key): bool {
                if (!ctype_digit((string) $key)) {
                    return false;
                }

                if (is_bool($value)) {
                    return $value;
                }

                if (is_numeric($value)) {
                    return (int) $value === 1;
                }

                if (is_string($value)) {
                    return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
                }

                return false;
            })
            ->keys()
            ->map(fn($id) => (int) $id)
            ->values()
            ->all();

        if (!$allowedMenuIds) {
            $permissionCache[$roleId] = false;
            return false;
        }

        $allowedRoutes = DB::table('menus')
            ->whereIn('id', $allowedMenuIds)
            ->where('deletedFlag', 0)
            ->pluck('url')
            ->map(fn($url) => $this->normalizeRoute($url))
            ->filter()
            ->values()
            ->all();

        $requiredRoutes = collect(self::OFFLINE_COURSE_PERMISSION_ROUTES)
            ->map(fn($route) => $this->normalizeRoute($route))
            ->values()
            ->all();

        $permissionCache[$roleId] = count(array_intersect($allowedRoutes, $requiredRoutes)) > 0;

        return $permissionCache[$roleId];
    }

    private function normalizeRoleValue(mixed $value): string
    {
        return preg_replace('/[^a-z0-9]+/', '', strtolower(trim((string) ($value ?? '')))) ?? '';
    }

    private function normalizeRoute(mixed $value): string
    {
        $route = trim((string) ($value ?? ''));
        $route = $route === '' ? '' : ('/' . ltrim($route, '/'));

        return preg_replace(
            '#/application/courses/manageOfflineCourse(/|$)#',
            '/application/courses/manageOfflineCourses$1',
            rtrim($route, '/')
        ) ?: '';
    }

    private function hasTable(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (Throwable) {
            return false;
        }
    }

    private function hasColumn(string $table, string $column): bool
    {
        try {
            return Schema::hasColumn($table, $column);
        } catch (Throwable) {
            return false;
        }
    }
}
