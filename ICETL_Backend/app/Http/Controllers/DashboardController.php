<?php

namespace App\Http\Controllers;

use App\Services\WorkflowDataService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class DashboardController extends Controller
{
    public function __construct(private readonly WorkflowDataService $workflowData)
    {
    }

    public function learner(Request $request)
    {
        $userId = (int) $request->user()->id;

        $enrollments = $this->table('enrollments');
        $orders = $this->table('orders');
        $payments = $this->table('payments');
        $carts = $this->table('carts');

        $enrolledCourses = $enrollments
            ? (clone $enrollments)->where('userId', $userId)->where('deletedFlag', 0)->count()
            : 0;
        $activeCourses = $enrollments
            ? (clone $enrollments)->where('userId', $userId)->where('status', 'active')->where('deletedFlag', 0)->count()
            : 0;
        $completedCourses = $enrollments
            ? (clone $enrollments)->where('userId', $userId)->where('progressPercent', '>=', 100)->where('deletedFlag', 0)->count()
            : 0;
        $averageProgress = $enrollments
            ? (int) round((float) (clone $enrollments)->where('userId', $userId)->where('deletedFlag', 0)->avg('progressPercent'))
            : 0;
        $cartItems = $carts ? (clone $carts)->where('user_id', $userId)->count() : 0;
        $totalSpent = $payments
            ? (float) (clone $payments)->where('userId', $userId)->where('status', 'success')->where('deletedFlag', 0)->sum('totalAmount')
            : 0;

        $recentCourses = $enrollments && $this->hasTable('courses')
            ? DB::table('enrollments as e')
                ->join('courses as c', 'c.id', '=', 'e.courseId')
                ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
                ->where('e.userId', $userId)
                ->where('e.deletedFlag', 0)
                ->where('c.deletedFlag', 0)
                ->select('c.id', 'c.title', 'cc.categoryName', 'c.status', 'e.progressPercent', 'e.created_at as createdAt')
                ->orderByDesc('e.id')
                ->limit(5)
                ->get()
                ->map(fn ($course) => [
                    'id' => (int) $course->id,
                    'title' => $course->title,
                    'categoryName' => $course->categoryName ?: 'Uncategorized',
                    'status' => ((int) $course->status) === 1 ? 'Active' : 'Inactive',
                    'progressPercent' => (int) ($course->progressPercent ?? 0),
                    'createdAt' => $course->createdAt,
                ])
                ->values()
            : collect();

        $recentPayments = $orders
            ? DB::table('orders as o')
                ->leftJoin('payments as p', 'p.orderId', '=', 'o.id')
                ->where('o.userId', $userId)
                ->where('o.deletedFlag', 0)
                ->select('o.id', 'o.orderReference', 'o.totalAmount', 'o.status', 'o.created_at as createdAt', 'p.status as paymentStatus')
                ->orderByDesc('o.id')
                ->limit(5)
                ->get()
                ->map(fn ($order) => [
                    'id' => (int) $order->id,
                    'orderReference' => $order->orderReference,
                    'totalAmount' => $order->totalAmount,
                    'status' => $order->paymentStatus ?: $order->status,
                    'createdAt' => $order->createdAt,
                ])
                ->values()
            : collect();

        return $this->success([
            'summary' => [
                'enrolledCourses' => $enrolledCourses,
                'activeCourses' => $activeCourses,
                'completedCourses' => $completedCourses,
                'averageProgress' => $averageProgress,
                'cartItems' => $cartItems,
                'totalSpent' => $totalSpent,
            ],
            'progressBreakdown' => [
                ['label' => 'Not started', 'value' => $this->progressCount($userId, 0, 0)],
                ['label' => 'In progress', 'value' => $this->progressCount($userId, 1, 99)],
                ['label' => 'Completed', 'value' => $this->progressCount($userId, 100, 100)],
            ],
            'recentCourses' => $recentCourses,
            'recentPayments' => $recentPayments,
            'workflow' => $this->workflowData->learnerDashboardWorkflow($request),
        ], 'Learner dashboard fetched successfully.');
    }

    public function instructor(Request $request)
    {
        $userId = (int) $request->user()->id;
        $courseIds = $this->instructorCourseIds($userId);

        $courses = $this->table('courses');
        $enrollments = $this->table('enrollments');

        $totalCourses = count($courseIds);
        $activeCourses = $courses && $courseIds
            ? (clone $courses)->whereIn('id', $courseIds)->where('status', 1)->where('deletedFlag', 0)->count()
            : 0;
        $pendingCourses = max($totalCourses - $activeCourses, 0);
        $enrolledLearners = $enrollments && $courseIds
            ? (clone $enrollments)->whereIn('courseId', $courseIds)->where('deletedFlag', 0)->distinct('userId')->count('userId')
            : 0;
        $averageProgress = $enrollments && $courseIds
            ? (int) round((float) (clone $enrollments)->whereIn('courseId', $courseIds)->where('deletedFlag', 0)->avg('progressPercent'))
            : 0;
        $totalRevenue = $this->courseRevenue($courseIds);

        $topCourses = $courses && $courseIds
            ? DB::table('courses as c')
                ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
                ->leftJoinSub(
                    DB::table('enrollments')->select('courseId', DB::raw('COUNT(*) as students'))->where('deletedFlag', 0)->groupBy('courseId'),
                    'enrolled',
                    'enrolled.courseId',
                    '=',
                    'c.id'
                )
                ->whereIn('c.id', $courseIds)
                ->where('c.deletedFlag', 0)
                ->select('c.id', 'c.title', 'cc.categoryName', 'c.status', DB::raw('COALESCE(enrolled.students, 0) as students'))
                ->orderByDesc('students')
                ->limit(6)
                ->get()
                ->map(fn ($course) => [
                    'id' => (int) $course->id,
                    'title' => $course->title,
                    'categoryName' => $course->categoryName ?: 'Uncategorized',
                    'status' => ((int) $course->status) === 1 ? 'Active' : 'Inactive',
                    'students' => (int) $course->students,
                ])
                ->values()
            : collect();

        $recentLearners = $enrollments && $courseIds
            ? DB::table('enrollments as e')
                ->join('courses as c', 'c.id', '=', 'e.courseId')
                ->leftJoin('users as u', 'u.id', '=', 'e.userId')
                ->whereIn('e.courseId', $courseIds)
                ->where('e.deletedFlag', 0)
                ->select('e.id', 'c.title', 'u.name as learnerName', 'u.email as learnerEmail', 'e.progressPercent', 'e.created_at as createdAt')
                ->orderByDesc('e.id')
                ->limit(6)
                ->get()
                ->map(fn ($item) => [
                    'id' => (int) $item->id,
                    'title' => $item->title,
                    'learnerName' => $item->learnerName ?: 'Learner',
                    'learnerEmail' => $item->learnerEmail,
                    'progressPercent' => (int) ($item->progressPercent ?? 0),
                    'createdAt' => $item->createdAt,
                ])
                ->values()
            : collect();

        return $this->success([
            'summary' => [
                'totalCourses' => $totalCourses,
                'activeCourses' => $activeCourses,
                'enrolledLearners' => $enrolledLearners,
                'totalRevenue' => $totalRevenue,
                'averageProgress' => $averageProgress,
                'pendingCourses' => $pendingCourses,
            ],
            'courseStatus' => [
                ['label' => 'Active', 'value' => $activeCourses],
                ['label' => 'Inactive', 'value' => $pendingCourses],
            ],
            'topCourses' => $topCourses,
            'recentLearners' => $recentLearners,
            'workflow' => $this->workflowData->instructorDashboardWorkflow($request),
        ], 'Instructor dashboard fetched successfully.');
    }

    public function admin(Request $request)
    {
        if (!$this->workflowData->canViewAdminWorkflow($request->user())) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $users = $this->table('users');
        $courses = $this->table('courses');
        $enrollments = $this->table('enrollments');
        $payments = $this->table('payments');

        $learners = $users ? (clone $users)->where('role', 2)->where('deletedFlag', 0)->count() : 0;
        $instructors = $users ? (clone $users)->where('role', 3)->where('deletedFlag', 0)->count() : 0;
        $courseCount = $courses ? (clone $courses)->where('deletedFlag', 0)->count() : 0;
        $activeCourses = $courses ? (clone $courses)->where('status', 1)->where('deletedFlag', 0)->count() : 0;
        $enrollmentCount = $enrollments ? (clone $enrollments)->where('deletedFlag', 0)->count() : 0;
        $revenue = $payments ? (float) (clone $payments)->where('status', 'success')->where('deletedFlag', 0)->sum('totalAmount') : 0;
        $successfulPayments = $payments ? (clone $payments)->where('status', 'success')->where('deletedFlag', 0)->count() : 0;
        $failedPayments = $payments ? (clone $payments)->whereIn('status', ['failed', 'cancelled'])->where('deletedFlag', 0)->count() : 0;

        return $this->success([
            'summary' => [
                'learners' => $learners,
                'instructors' => $instructors,
                'courses' => $courseCount,
                'activeCourses' => $activeCourses,
                'enrollments' => $enrollmentCount,
                'revenue' => $revenue,
                'successfulPayments' => $successfulPayments,
                'failedPayments' => $failedPayments,
            ],
            'monthlyRevenue' => $this->monthlyRevenue(),
            'userRoles' => [
                ['label' => 'Learners', 'value' => $learners],
                ['label' => 'Instructors', 'value' => $instructors],
                ['label' => 'Admins', 'value' => $users ? (clone $users)->where('role', 1)->where('deletedFlag', 0)->count() : 0],
            ],
            'courseCategories' => $this->categoryBreakdown(),
            'recentTransactions' => $this->recentTransactions(),
            'recentCourses' => $this->recentCourses(),
            'workflow' => $this->workflowData->adminDashboardWorkflow($request),
        ], 'Admin dashboard fetched successfully.');
    }

    private function progressCount(int $userId, int $min, int $max): int
    {
        if (!$this->hasTable('enrollments')) {
            return 0;
        }

        $query = DB::table('enrollments')->where('userId', $userId)->where('deletedFlag', 0);

        return $min === $max
            ? $query->where('progressPercent', $min)->count()
            : $query->whereBetween('progressPercent', [$min, $max])->count();
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

        return $ids->map(fn ($id) => (int) $id)->filter()->unique()->values()->all();
    }

    private function courseRevenue(array $courseIds): float
    {
        if (!$courseIds || !$this->hasTable('order_items') || !$this->hasTable('payments')) {
            return 0;
        }

        return (float) DB::table('order_items as oi')
            ->join('payments as p', 'p.orderId', '=', 'oi.orderId')
            ->whereIn('oi.courseId', $courseIds)
            ->where('p.status', 'success')
            ->where('oi.deletedFlag', 0)
            ->where('p.deletedFlag', 0)
            ->sum('oi.totalAmount');
    }

    private function monthlyRevenue()
    {
        if (!$this->hasTable('payments')) {
            return collect();
        }

        $rows = DB::table('payments')
            ->where('status', 'success')
            ->where('deletedFlag', 0)
            ->where('created_at', '>=', now()->subMonths(5)->startOfMonth())
            ->selectRaw("DATE_FORMAT(created_at, '%b') as label, SUM(totalAmount) as value, MIN(created_at) as sortDate")
            ->groupBy('label')
            ->orderBy('sortDate')
            ->get()
            ->keyBy('label');

        return collect(range(5, 0))
            ->map(fn ($offset) => now()->subMonths($offset)->format('M'))
            ->map(fn ($label) => ['label' => $label, 'value' => (float) ($rows[$label]->value ?? 0)])
            ->values();
    }

    private function categoryBreakdown()
    {
        if (!$this->hasTable('courses')) {
            return collect();
        }

        return DB::table('courses as c')
            ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
            ->where('c.deletedFlag', 0)
            ->selectRaw("COALESCE(cc.categoryName, 'Uncategorized') as label, COUNT(*) as value")
            ->groupBy('label')
            ->orderByDesc('value')
            ->limit(5)
            ->get()
            ->map(fn ($row) => ['label' => $row->label, 'value' => (int) $row->value]);
    }

    private function recentTransactions()
    {
        if (!$this->hasTable('orders')) {
            return collect();
        }

        return DB::table('orders as o')
            ->leftJoin('users as u', 'u.id', '=', 'o.userId')
            ->where('o.deletedFlag', 0)
            ->select('o.id', 'o.orderReference', 'o.totalAmount', 'o.status', 'o.created_at as createdAt', 'u.name as userName', 'u.email as userEmail')
            ->orderByDesc('o.id')
            ->limit(6)
            ->get()
            ->map(fn ($order) => [
                'id' => (int) $order->id,
                'orderReference' => $order->orderReference,
                'userName' => $order->userName ?: 'Learner',
                'userEmail' => $order->userEmail,
                'totalAmount' => $order->totalAmount,
                'status' => $order->status,
                'createdAt' => $order->createdAt,
            ]);
    }

    private function recentCourses()
    {
        if (!$this->hasTable('courses')) {
            return collect();
        }

        return DB::table('courses as c')
            ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
            ->leftJoin('users as u', 'u.id', '=', 'c.createdBy')
            ->where('c.deletedFlag', 0)
            ->select('c.id', 'c.title', 'cc.categoryName', 'c.status', 'c.createdOn as createdAt', 'u.name as instructorName')
            ->orderByDesc('c.id')
            ->limit(6)
            ->get()
            ->map(fn ($course) => [
                'id' => (int) $course->id,
                'title' => $course->title,
                'categoryName' => $course->categoryName ?: 'Uncategorized',
                'status' => ((int) $course->status) === 1 ? 'Active' : 'Inactive',
                'instructorName' => $course->instructorName ?: 'Instructor',
                'createdAt' => $course->createdAt,
            ]);
    }

    private function table(string $table)
    {
        return $this->hasTable($table) ? DB::table($table) : null;
    }

    private function hasTable(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (Throwable) {
            return false;
        }
    }

    private function success(array $data, string $message)
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ]);
    }
}
