<?php

namespace App\Http\Controllers;

use App\Models\ModuleMaterial;
use App\Services\EntityCodeService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Throwable;

class ModuleMaterialController extends Controller
{
    private const MODULE_ACADEMIC_COURSE = 'ACADEMIC_COURSE';
    private const MODULE_WORKSHOP = 'WORKSHOP';
    private const MODULE_SEMINAR = 'SEMINAR';

    private const MODULE_TYPES = [
        self::MODULE_ACADEMIC_COURSE,
        self::MODULE_WORKSHOP,
        self::MODULE_SEMINAR,
    ];

    private const ROLE_ADMIN = 1;
    private const ROLE_LEARNER = 2;
    private const ROLE_INSTRUCTOR = 3;
    private const MAX_UPLOAD_KB = 20480;

    private const ALLOWED_EXTENSIONS = [
        'pdf',
        'doc',
        'docx',
        'ppt',
        'pptx',
        'xls',
        'xlsx',
        'jpg',
        'jpeg',
        'png',
        'zip',
    ];

    public function assignedModules(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'moduleType' => ['nullable', 'string', Rule::in(self::MODULE_TYPES)],
            'search' => 'nullable|string|max:120',
            'page' => 'nullable|integer|min:1',
            'perPage' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        if (!$this->isInstructor($user) && !$this->isAdmin($user)) {
            return $this->forbiddenResponse('Only instructors can view assigned modules.');
        }

        $moduleType = (string) $request->input('moduleType', self::MODULE_ACADEMIC_COURSE);

        try {
            $query = match ($moduleType) {
                self::MODULE_WORKSHOP => $this->assignedWorkshopQuery($user, $request),
                self::MODULE_SEMINAR => $this->assignedSeminarQuery($user, $request),
                default => $this->assignedAcademicCourseQuery($user, $request),
            };

            $page = max(1, (int) $request->input('page', 1));
            $perPage = max(1, min(100, (int) $request->input('perPage', 10)));
            $modules = $query->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Assigned modules fetched successfully.',
                'data' => collect($modules->items())
                    ->map(fn($module) => $this->formatAssignedModule($module, $moduleType, $request))
                    ->values(),
                'meta' => [
                    'currentPage' => $modules->currentPage(),
                    'perPage' => $modules->perPage(),
                    'total' => $modules->total(),
                    'lastPage' => $modules->lastPage(),
                    'from' => $modules->firstItem(),
                    'to' => $modules->lastItem(),
                ],
            ]);
        } catch (Throwable $e) {
            Log::error('Unable to fetch assigned modules', [
                'userId' => $user->id,
                'moduleType' => $moduleType,
                'error' => $e->getMessage(),
            ]);

            return $this->serverErrorResponse('Unable to fetch assigned modules.');
        }
    }

    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'moduleType' => ['required', 'string', Rule::in(self::MODULE_TYPES)],
            'moduleId' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        if (!Schema::hasTable('moduleMaterials')) {
            return $this->missingMaterialsTableResponse();
        }

        $moduleType = (string) $request->input('moduleType');
        $moduleId = (int) $request->input('moduleId');

        if (!$this->moduleExists($moduleType, $moduleId)) {
            return $this->notFoundResponse('Module not found.');
        }

        $authorization = $this->authorizeMaterialRead($request, $moduleType, $moduleId);

        if (!$authorization['allowed']) {
            return $this->forbiddenResponse($authorization['message']);
        }

        try {
            $materials = DB::table('moduleMaterials as mm')
                ->leftJoin('users as uploader', 'uploader.id', '=', 'mm.instructorId')
                ->where('mm.moduleType', $moduleType)
                ->where('mm.moduleId', $moduleId)
                ->where('mm.deletedFlag', 0)
                ->where('mm.status', 1)
                ->select(
                    'mm.*',
                    'uploader.name as uploadedByName',
                    'uploader.email as uploadedByEmail',
                )
                ->orderByRaw('COALESCE(mm.materialDate, DATE(mm.created_at)) DESC')
                ->orderByDesc('mm.created_at')
                ->get()
                ->map(fn($material) => $this->formatMaterial($material, $request))
                ->values();

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Materials fetched successfully.',
                'data' => $materials,
            ]);
        } catch (Throwable $e) {
            Log::error('Unable to fetch module materials', [
                'moduleType' => $moduleType,
                'moduleId' => $moduleId,
                'userId' => $request->user()?->id,
                'error' => $e->getMessage(),
            ]);

            return $this->serverErrorResponse('Unable to fetch materials.');
        }
    }

    public function assignedModuleStudents(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'moduleType' => ['required', 'string', Rule::in(self::MODULE_TYPES)],
            'moduleId' => 'required|integer|min:1',
            'search' => 'nullable|string|max:120',
            'page' => 'nullable|integer|min:1',
            'perPage' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        if (!$this->isInstructor($user) && !$this->isAdmin($user)) {
            return $this->forbiddenResponse('Only instructors can view enrolled students.');
        }

        $moduleType = (string) $request->input('moduleType');
        $moduleId = (int) $request->input('moduleId');

        if (!$this->moduleExists($moduleType, $moduleId)) {
            return $this->notFoundResponse('Module not found.');
        }

        if (!$this->isAdmin($user) && !$this->isModuleAssignedToInstructor($moduleType, $moduleId, (int) $user->id)) {
            return $this->forbiddenResponse('This module is not assigned to you.');
        }

        $missingTables = $this->missingAssignedStudentTables($moduleType);

        if (!empty($missingTables)) {
            return $this->missingAssignedStudentsTableResponse($missingTables);
        }

        try {
            $queryConfig = $moduleType === self::MODULE_ACADEMIC_COURSE
                ? $this->assignedAcademicCourseStudentQuery($moduleId, $request)
                : $this->assignedProgramStudentQuery($moduleType, $moduleId, $request);

            $query = $queryConfig['query'];
            $studentIdColumn = $queryConfig['studentIdColumn'];
            $amountExpression = $queryConfig['amountExpression'];
            $page = max(1, (int) $request->input('page', 1));
            $perPage = max(1, min(100, (int) $request->input('perPage', 10)));

            $summaryQuery = clone $query;
            $summary = [
                'totalEnrollments' => (clone $summaryQuery)->count(),
                'totalStudents' => (clone $summaryQuery)->distinct()->count($studentIdColumn),
                'totalPaid' => (float) (clone $summaryQuery)->sum(DB::raw($amountExpression)),
            ];

            $students = $query
                ->select($queryConfig['selectColumns'])
                ->orderByDesc('enrolledAt')
                ->orderByDesc('rowId')
                ->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Enrolled students fetched successfully.',
                'data' => collect($students->items())
                    ->map(fn($student) => $this->formatAssignedModuleStudent($student, $moduleType, $moduleId))
                    ->values(),
                'summary' => $summary,
                'meta' => [
                    'currentPage' => $students->currentPage(),
                    'perPage' => $students->perPage(),
                    'total' => $students->total(),
                    'lastPage' => $students->lastPage(),
                    'from' => $students->firstItem(),
                    'to' => $students->lastItem(),
                ],
            ]);
        } catch (Throwable $e) {
            Log::error('Unable to fetch assigned module students', [
                'userId' => $user->id,
                'moduleType' => $moduleType,
                'moduleId' => $moduleId,
                'error' => $e->getMessage(),
            ]);

            return $this->serverErrorResponse('Unable to fetch enrolled students.');
        }
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'moduleType' => ['required', 'string', Rule::in(self::MODULE_TYPES)],
            'moduleId' => 'required|integer|min:1',
            'title' => ['required', 'string', 'min:2', 'max:150'],
            'description' => 'nullable|string|max:2000',
            'materialDate' => 'nullable|date',
            'file' => [
                'required',
                'file',
                'mimes:' . implode(',', self::ALLOWED_EXTENSIONS),
                'max:' . self::MAX_UPLOAD_KB,
            ],
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        if (!Schema::hasTable('moduleMaterials')) {
            return $this->missingMaterialsTableResponse();
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        if (!$this->isInstructor($user) && !$this->isAdmin($user)) {
            return $this->forbiddenResponse('Only instructors can upload materials.');
        }

        $moduleType = (string) $request->input('moduleType');
        $moduleId = (int) $request->input('moduleId');

        if (!$this->moduleExists($moduleType, $moduleId)) {
            return $this->notFoundResponse('Module not found.');
        }

        if (!$this->isAdmin($user) && !$this->isModuleAssignedToInstructor($moduleType, $moduleId, (int) $user->id)) {
            return $this->forbiddenResponse('This module is not assigned to you.');
        }

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: '');

        if (!in_array($extension, self::ALLOWED_EXTENSIONS, true)) {
            return response()->json([
                'status' => false,
                'success' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'file' => ['This file type is not supported.'],
                ],
            ], 422);
        }

        try {
            $folder = sprintf(
                'module-materials/%s/%d/%s',
                $moduleType,
                $moduleId,
                now()->format('Y/m'),
            );
            $storedFileName = Str::uuid()->toString() . '.' . $extension;
            $filePath = $file->storeAs($folder, $storedFileName, 'private');

            if (!$filePath) {
                return $this->serverErrorResponse('Unable to store the uploaded file.');
            }

            $material = ModuleMaterial::create([
                'moduleType' => $moduleType,
                'moduleId' => $moduleId,
                'instructorId' => (int) $user->id,
                'title' => trim((string) $request->input('title')),
                'description' => trim((string) $request->input('description', '')) ?: null,
                'materialDate' => $request->input('materialDate') ?: now()->toDateString(),
                'originalFileName' => $this->safeOriginalFileName($file->getClientOriginalName()),
                'storedFileName' => $storedFileName,
                'filePath' => $filePath,
                'fileExtension' => $extension,
                'mimeType' => $file->getMimeType(),
                'fileSize' => $file->getSize(),
                'status' => 1,
                'deletedFlag' => 0,
                'createdBy' => (int) $user->id,
                'updatedBy' => (int) $user->id,
            ]);

            $material = DB::table('moduleMaterials as mm')
                ->leftJoin('users as uploader', 'uploader.id', '=', 'mm.instructorId')
                ->where('mm.id', $material->id)
                ->select('mm.*', 'uploader.name as uploadedByName', 'uploader.email as uploadedByEmail')
                ->first();

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Material uploaded successfully.',
                'data' => $this->formatMaterial($material, $request),
            ], 201);
        } catch (Throwable $e) {
            Log::error('Unable to upload module material', [
                'moduleType' => $moduleType,
                'moduleId' => $moduleId,
                'userId' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return $this->serverErrorResponse('Unable to upload material.');
        }
    }

    public function download(Request $request, int $id)
    {
        if (!Schema::hasTable('moduleMaterials')) {
            return $this->missingMaterialsTableResponse();
        }

        $material = ModuleMaterial::query()
            ->where('id', $id)
            ->where('deletedFlag', 0)
            ->where('status', 1)
            ->first();

        if (!$material) {
            return $this->notFoundResponse('Material not found.');
        }

        $authorization = $this->authorizeMaterialRead(
            $request,
            (string) $material->moduleType,
            (int) $material->moduleId,
        );

        if (!$authorization['allowed']) {
            return $this->forbiddenResponse($authorization['message']);
        }

        $path = $this->normalizeStoredPath((string) $material->filePath);

        if ($path === '' || str_contains($path, '../') || str_starts_with($path, '../')) {
            return $this->notFoundResponse('Material file not found.');
        }

        if (!Storage::disk('private')->exists($path)) {
            return $this->notFoundResponse('Material file not found.');
        }

        $fullPath = Storage::disk('private')->path($path);
        $downloadName = $this->safeDownloadFileName((string) $material->originalFileName);
        $mimeType = Storage::disk('private')->mimeType($path) ?: 'application/octet-stream';

        if ($request->boolean('download')) {
            return response()->download($fullPath, $downloadName, [
                'Content-Type' => $mimeType,
            ]);
        }

        return response()->file($fullPath, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline; filename="' . addslashes($downloadName) . '"',
            'Cache-Control' => 'private, max-age=0',
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        if (!Schema::hasTable('moduleMaterials')) {
            return $this->missingMaterialsTableResponse();
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        $material = ModuleMaterial::query()
            ->where('id', $id)
            ->where('deletedFlag', 0)
            ->first();

        if (!$material) {
            return $this->notFoundResponse('Material not found.');
        }

        if (!$this->isAdmin($user)) {
            if (!$this->isInstructor($user)) {
                return $this->forbiddenResponse('Learners cannot delete materials.');
            }

            if ((int) $material->instructorId !== (int) $user->id) {
                return $this->forbiddenResponse('You can delete only materials uploaded by you.');
            }

            if (!$this->isModuleAssignedToInstructor((string) $material->moduleType, (int) $material->moduleId, (int) $user->id)) {
                return $this->forbiddenResponse('This module is not assigned to you.');
            }
        }

        $material->update([
            'deletedFlag' => 1,
            'status' => 0,
            'updatedBy' => (int) $user->id,
        ]);

        return response()->json([
            'status' => true,
            'success' => true,
            'message' => 'Material deleted successfully.',
        ]);
    }

    private function missingAssignedStudentTables(string $moduleType): array
    {
        $requiredTables = $moduleType === self::MODULE_ACADEMIC_COURSE
            ? ['enrollments', 'users']
            : ['orders', 'order_items', 'users', 'payments', 'invoices', $this->programTableForModule($moduleType)];

        return array_values(array_filter(
            $requiredTables,
            fn(string $table): bool => !Schema::hasTable($table)
        ));
    }

    private function assignedAcademicCourseStudentQuery(int $moduleId, Request $request): array
    {
        $hasOrderJoin = Schema::hasTable('orders') && Schema::hasColumn('enrollments', 'orderId');
        $hasPaymentJoin = Schema::hasTable('payments') && Schema::hasColumn('enrollments', 'paymentId');
        $hasInvoiceJoin = Schema::hasTable('invoices') && Schema::hasColumn('enrollments', 'orderId');
        $amountExpression = $hasPaymentJoin && Schema::hasColumn('payments', 'totalAmount')
            ? 'COALESCE(p.totalAmount, 0)'
            : '0';

        $query = DB::table('enrollments as e')
            ->join('users as student', 'student.id', '=', 'e.userId')
            ->where('e.courseId', $moduleId);

        $this->whereNotDeleted($query, 'enrollments', 'e');
        $this->whereNotDeleted($query, 'users', 'student');

        if ($hasOrderJoin) {
            $query->leftJoin('orders as o', 'o.id', '=', 'e.orderId');
        }

        if ($hasPaymentJoin) {
            $query->leftJoin('payments as p', 'p.id', '=', 'e.paymentId');
        }

        if ($hasInvoiceJoin) {
            $query->leftJoin('invoices as i', function ($join) {
                $join->on('i.orderId', '=', 'e.orderId');
                $this->whereJoinNotDeleted($join, 'invoices', 'i');
            });
        }

        $this->applyAssignedAcademicStudentSearch($query, $request, $hasOrderJoin, $hasPaymentJoin, $hasInvoiceJoin);

        return [
            'query' => $query,
            'studentIdColumn' => 'student.id',
            'amountExpression' => $amountExpression,
            'selectColumns' => [
                'e.id as rowId',
                'e.id as enrollmentId',
                'student.id as studentId',
                $this->nullableColumn('users', 'student', 'code', 'studentCode'),
                'student.name as studentName',
                'student.email as studentEmail',
                $this->nullableColumn('users', 'student', 'phone', 'studentPhone'),
                $this->nullableColumn('users', 'student', 'dob', 'studentDob'),
                $this->nullableColumn('users', 'student', 'gender', 'studentGender'),
                $this->nullableColumn('enrollments', 'e', 'status', 'enrollmentStatus'),
                $this->nullableColumn('enrollments', 'e', 'created_at', 'enrolledAt'),
                $hasOrderJoin && Schema::hasColumn('orders', 'orderReference')
                    ? 'o.orderReference as orderReference'
                    : DB::raw('NULL as orderReference'),
                $hasInvoiceJoin && Schema::hasColumn('invoices', 'invoiceNumber')
                    ? 'i.invoiceNumber as invoiceNumber'
                    : DB::raw('NULL as invoiceNumber'),
                $hasPaymentJoin && Schema::hasColumn('payments', 'paymentMethod')
                    ? 'p.paymentMethod as paymentMode'
                    : DB::raw('NULL as paymentMode'),
                DB::raw("{$amountExpression} as amountPaid"),
            ],
        ];
    }

    private function assignedProgramStudentQuery(string $moduleType, int $moduleId, Request $request): array
    {
        $programType = $this->programTypeForModule($moduleType);
        $programTable = $this->programTableForModule($moduleType);
        $hasOrderItemEntityType = Schema::hasColumn('order_items', 'entityType');
        $hasOrderItemEntityId = Schema::hasColumn('order_items', 'entityId');
        $hasOrderItemCourseId = Schema::hasColumn('order_items', 'courseId');
        $hasInvoiceEntityType = Schema::hasColumn('invoices', 'entityType');
        $hasInvoiceEntityId = Schema::hasColumn('invoices', 'entityId');
        $hasInvoiceCourseId = Schema::hasColumn('invoices', 'courseId');
        $effectiveTypeSql = $this->programEntityTypeCoalesceSql(array_filter([
            $hasOrderItemEntityType ? 'oi.entityType' : null,
            $hasInvoiceEntityType ? 'i.entityType' : null,
        ]));
        $effectiveIdSql = $this->programEntityIdCoalesceSql(array_filter([
            $hasOrderItemEntityId ? 'oi.entityId' : null,
            $hasInvoiceEntityId ? 'i.entityId' : null,
            $hasInvoiceCourseId ? 'i.courseId' : null,
            $hasOrderItemCourseId ? 'oi.courseId' : null,
        ]));
        $amountExpression = $this->programStudentAmountExpression();

        $query = DB::table('order_items as oi')
            ->join('orders as o', function ($join) {
                $join->on('o.id', '=', 'oi.orderId');

                if (Schema::hasColumn('orders', 'status')) {
                    $join->where('o.status', 'paid');
                }

                $this->whereJoinNotDeleted($join, 'orders', 'o');
            })
            ->join('users as student', function ($join) {
                $join->on('student.id', '=', 'o.userId');
                $this->whereJoinNotDeleted($join, 'users', 'student');
            })
            ->leftJoin('invoices as i', function ($join) {
                $join->on('i.orderId', '=', 'o.id');
                $this->whereJoinNotDeleted($join, 'invoices', 'i');
            })
            ->leftJoin('payments as p', function ($join) {
                $join->on('p.orderId', '=', 'o.id');

                if (Schema::hasColumn('payments', 'status')) {
                    $join->where('p.status', 'success');
                }

                $this->whereJoinNotDeleted($join, 'payments', 'p');
            })
            ->join($programTable . ' as program', function ($join) use ($effectiveIdSql, $effectiveTypeSql, $programType) {
                $join->on('program.id', '=', DB::raw($effectiveIdSql))
                    ->whereRaw("({$effectiveTypeSql}) = ?", [$programType]);

                $this->whereJoinNotDeleted($join, $programType === 'seminar' ? 'seminars' : 'workshops', 'program');
            });

        $this->whereNotDeleted($query, 'order_items', 'oi');
        $query->where('program.id', $moduleId);

        $this->applyAssignedProgramStudentSearch($query, $request);

        return [
            'query' => $query,
            'studentIdColumn' => 'student.id',
            'amountExpression' => $amountExpression,
            'selectColumns' => [
                'oi.id as rowId',
                DB::raw('NULL as enrollmentId'),
                'student.id as studentId',
                $this->nullableColumn('users', 'student', 'code', 'studentCode'),
                'student.name as studentName',
                'student.email as studentEmail',
                $this->nullableColumn('users', 'student', 'phone', 'studentPhone'),
                $this->nullableColumn('users', 'student', 'dob', 'studentDob'),
                $this->nullableColumn('users', 'student', 'gender', 'studentGender'),
                DB::raw("'paid' as enrollmentStatus"),
                $this->nullableColumn('orders', 'o', 'created_at', 'enrolledAt'),
                $this->nullableColumn('orders', 'o', 'orderReference', 'orderReference'),
                $this->nullableColumn('invoices', 'i', 'invoiceNumber', 'invoiceNumber'),
                $this->nullableColumn('payments', 'p', 'paymentMethod', 'paymentMode'),
                DB::raw("{$amountExpression} as amountPaid"),
            ],
        ];
    }

    private function applyAssignedAcademicStudentSearch(
        $query,
        Request $request,
        bool $hasOrderJoin,
        bool $hasPaymentJoin,
        bool $hasInvoiceJoin
    ): void {
        if (!$request->filled('search')) {
            return;
        }

        $search = trim((string) $request->input('search'));

        $query->where(function ($searchQuery) use ($search, $hasOrderJoin, $hasPaymentJoin, $hasInvoiceJoin) {
            $searchQuery
                ->where('student.name', 'LIKE', '%' . $search . '%')
                ->orWhere('student.email', 'LIKE', '%' . $search . '%');

            if (Schema::hasColumn('users', 'phone')) {
                $searchQuery->orWhere('student.phone', 'LIKE', '%' . $search . '%');
            }

            if (Schema::hasColumn('users', 'code')) {
                $searchQuery->orWhere('student.code', 'LIKE', '%' . $search . '%');
            }

            if ($hasOrderJoin && Schema::hasColumn('orders', 'orderReference')) {
                $searchQuery->orWhere('o.orderReference', 'LIKE', '%' . $search . '%');
            }

            if ($hasInvoiceJoin && Schema::hasColumn('invoices', 'invoiceNumber')) {
                $searchQuery->orWhere('i.invoiceNumber', 'LIKE', '%' . $search . '%');
            }

            if ($hasPaymentJoin && Schema::hasColumn('payments', 'paymentReference')) {
                $searchQuery->orWhere('p.paymentReference', 'LIKE', '%' . $search . '%');
            }
        });
    }

    private function applyAssignedProgramStudentSearch($query, Request $request): void
    {
        if (!$request->filled('search')) {
            return;
        }

        $search = trim((string) $request->input('search'));

        $query->where(function ($searchQuery) use ($search) {
            $searchQuery
                ->where('student.name', 'LIKE', '%' . $search . '%')
                ->orWhere('student.email', 'LIKE', '%' . $search . '%')
                ->orWhere('program.title', 'LIKE', '%' . $search . '%');

            if (Schema::hasColumn('users', 'phone')) {
                $searchQuery->orWhere('student.phone', 'LIKE', '%' . $search . '%');
            }

            if (Schema::hasColumn('users', 'code')) {
                $searchQuery->orWhere('student.code', 'LIKE', '%' . $search . '%');
            }

            if (Schema::hasColumn('orders', 'orderReference')) {
                $searchQuery->orWhere('o.orderReference', 'LIKE', '%' . $search . '%');
            }

            if (Schema::hasColumn('invoices', 'invoiceNumber')) {
                $searchQuery->orWhere('i.invoiceNumber', 'LIKE', '%' . $search . '%');
            }

            if (Schema::hasColumn('payments', 'paymentReference')) {
                $searchQuery->orWhere('p.paymentReference', 'LIKE', '%' . $search . '%');
            }

            if (Schema::hasColumn('payments', 'razorpayPaymentId')) {
                $searchQuery->orWhere('p.razorpayPaymentId', 'LIKE', '%' . $search . '%');
            }
        });
    }

    private function formatAssignedModuleStudent(object $student, string $moduleType, int $moduleId): array
    {
        return [
            'id' => (int) $student->rowId,
            'enrollmentId' => $student->enrollmentId ? (int) $student->enrollmentId : null,
            'moduleType' => $moduleType,
            'moduleId' => $moduleId,
            'studentId' => (int) $student->studentId,
            'studentCode' => $student->studentCode ?: null,
            'studentName' => (string) ($student->studentName ?? 'Learner'),
            'studentEmail' => (string) ($student->studentEmail ?? ''),
            'studentPhone' => $student->studentPhone ?: null,
            'studentDob' => $student->studentDob ?: null,
            'studentGender' => $student->studentGender ? (int) $student->studentGender : null,
            'enrollmentStatus' => $student->enrollmentStatus ?: null,
            'enrolledAt' => $student->enrolledAt ?: null,
            'orderReference' => $student->orderReference ?: null,
            'invoiceNumber' => $student->invoiceNumber ?: null,
            'paymentMode' => $student->paymentMode ?: null,
            'amountPaid' => (float) ($student->amountPaid ?? 0),
        ];
    }

    private function nullableColumn(string $table, string $alias, string $column, string $as)
    {
        return Schema::hasColumn($table, $column)
            ? "{$alias}.{$column} as {$as}"
            : DB::raw("NULL as {$as}");
    }

    private function whereNotDeleted($query, string $table, string $alias): void
    {
        if (Schema::hasColumn($table, 'deletedFlag')) {
            $query->where($alias . '.deletedFlag', 0);
        }
    }

    private function whereJoinNotDeleted($join, string $table, string $alias): void
    {
        if (Schema::hasColumn($table, 'deletedFlag')) {
            $join->where($alias . '.deletedFlag', 0);
        }
    }

    private function programTypeForModule(string $moduleType): string
    {
        return $moduleType === self::MODULE_SEMINAR ? 'seminar' : 'workshop';
    }

    private function programTableForModule(string $moduleType): string
    {
        return $moduleType === self::MODULE_SEMINAR ? 'seminars' : 'workshops';
    }

    private function programEntityTypeCoalesceSql(array $columns): string
    {
        $expressions = array_map(fn(string $column): string => "
            CASE
                WHEN LOWER(TRIM({$column})) LIKE '%seminar%' THEN 'seminar'
                WHEN LOWER(TRIM({$column})) LIKE '%workshop%' THEN 'workshop'
                ELSE LOWER(TRIM({$column}))
            END
        ", $columns);

        return empty($expressions) ? 'NULL' : 'COALESCE(' . implode(', ', $expressions) . ')';
    }

    private function programEntityIdCoalesceSql(array $columns): string
    {
        $expressions = array_map(fn(string $column): string => "NULLIF({$column}, 0)", $columns);

        return empty($expressions) ? 'NULL' : 'COALESCE(' . implode(', ', $expressions) . ')';
    }

    private function programStudentAmountExpression(): string
    {
        $columns = [];

        if (Schema::hasColumn('order_items', 'totalAmount')) {
            $columns[] = 'oi.totalAmount';
        }

        if (Schema::hasColumn('payments', 'totalAmount')) {
            $columns[] = 'p.totalAmount';
        }

        if (Schema::hasColumn('orders', 'totalAmount')) {
            $columns[] = 'o.totalAmount';
        }

        return empty($columns) ? '0' : 'COALESCE(' . implode(', ', $columns) . ', 0)';
    }

    private function assignedAcademicCourseQuery(object $user, Request $request)
    {
        if (!Schema::hasTable('courses')) {
            return DB::query()->fromSub('select null as id where 1 = 0', 'empty_modules');
        }

        $query = DB::table('courses as c')
            ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
            ->leftJoin('courses as parentCourse', 'parentCourse.id', '=', 'c.parentCourseId')
            ->where('c.deletedFlag', 0)
            ->where('c.courseType', 2);

        if (!$this->isAdmin($user)) {
            $userId = (int) $user->id;
            $query->where(function ($assignmentQuery) use ($userId) {
                $assignmentQuery->where('c.createdBy', $userId);

                if (Schema::hasTable('courseinstructors')) {
                    $assignmentQuery->orWhereExists(function ($existsQuery) use ($userId) {
                        $existsQuery
                            ->select(DB::raw(1))
                            ->from('courseinstructors as ci')
                            ->whereColumn('ci.courseId', 'c.id')
                            ->where('ci.instructorId', $userId);
                    });
                }
            });
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery
                    ->where('c.title', 'LIKE', '%' . $search . '%')
                    ->orWhere('cc.categoryName', 'LIKE', '%' . $search . '%')
                    ->orWhere('c.venue', 'LIKE', '%' . $search . '%')
                    ->orWhere('c.city', 'LIKE', '%' . $search . '%');
                EntityCodeService::orWhereCode($searchQuery, 'courses', 'c.code', $search);
            });
        }

        $this->leftJoinMaterialCounts($query, self::MODULE_ACADEMIC_COURSE, 'c.id');

        return $query
            ->select(
                'c.id',
                EntityCodeService::codeSelect('courses', 'c'),
                'c.title',
                'cc.categoryName as categoryName',
                'c.thumbnail as imagePath',
                'c.isSpecial',
                'c.parentCourseId',
                'parentCourse.title as parentCourseTitle',
                $this->parentCourseCodeSelect(),
                'c.status',
                'c.startDate',
                'c.endDate',
                'c.createdOn',
                DB::raw('COALESCE(materialCounts.materialsCount, 0) as materialsCount'),
            )
            ->orderBy('c.startDate', 'DESC')
            ->orderBy('c.id', 'DESC');
    }

    private function assignedWorkshopQuery(object $user, Request $request)
    {
        if (!Schema::hasTable('workshops')) {
            return DB::query()->fromSub('select null as id where 1 = 0', 'empty_modules');
        }

        $query = DB::table('workshops as w')
            ->where('w.deletedFlag', 0);

        if (!$this->isAdmin($user)) {
            $query->where('w.createdBy', (int) $user->id);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery
                    ->where('w.title', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.topic', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.speakerName', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.city', 'LIKE', '%' . $search . '%');
                EntityCodeService::orWhereCode($searchQuery, 'workshops', 'w.code', $search);
            });
        }

        $this->leftJoinMaterialCounts($query, self::MODULE_WORKSHOP, 'w.id');

        return $query
            ->select(
                'w.id',
                EntityCodeService::codeSelect('workshops', 'w'),
                'w.title',
                'w.topic as categoryName',
                'w.bannerImage as imagePath',
                'w.status',
                'w.startDate',
                'w.endDate',
                'w.createdOn',
                DB::raw('COALESCE(materialCounts.materialsCount, 0) as materialsCount'),
            )
            ->orderBy('w.startDate', 'DESC')
            ->orderBy('w.id', 'DESC');
    }

    private function assignedSeminarQuery(object $user, Request $request)
    {
        if (!Schema::hasTable('seminars')) {
            return DB::query()->fromSub('select null as id where 1 = 0', 'empty_modules');
        }

        $query = DB::table('seminars as s')
            ->where('s.deletedFlag', 0);

        if (!$this->isAdmin($user)) {
            $query->where('s.createdBy', (int) $user->id);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery
                    ->where('s.title', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.topic', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.speakerName', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.city', 'LIKE', '%' . $search . '%');
                EntityCodeService::orWhereCode($searchQuery, 'seminars', 's.code', $search);
            });
        }

        $this->leftJoinMaterialCounts($query, self::MODULE_SEMINAR, 's.id');

        return $query
            ->select(
                's.id',
                EntityCodeService::codeSelect('seminars', 's'),
                's.title',
                's.topic as categoryName',
                's.bannerImage as imagePath',
                's.status',
                's.eventDate as startDate',
                DB::raw('NULL as endDate'),
                's.createdOn',
                DB::raw('COALESCE(materialCounts.materialsCount, 0) as materialsCount'),
            )
            ->orderBy('s.eventDate', 'DESC')
            ->orderBy('s.id', 'DESC');
    }

    private function leftJoinMaterialCounts($query, string $moduleType, string $moduleIdColumn): void
    {
        if (!Schema::hasTable('moduleMaterials')) {
            $emptyCounts = DB::query()
                ->fromSub('select null as moduleId, 0 as materialsCount where 1 = 0', 'emptyMaterialCounts');

            $query->leftJoinSub($emptyCounts, 'materialCounts', function ($join) use ($moduleIdColumn) {
                $join->on('materialCounts.moduleId', '=', DB::raw($moduleIdColumn));
            });

            return;
        }

        $counts = DB::table('moduleMaterials')
            ->select('moduleId', DB::raw('COUNT(*) as materialsCount'))
            ->where('moduleType', $moduleType)
            ->where('deletedFlag', 0)
            ->where('status', 1)
            ->groupBy('moduleId');

        $query->leftJoinSub($counts, 'materialCounts', function ($join) use ($moduleIdColumn) {
            $join->on('materialCounts.moduleId', '=', DB::raw($moduleIdColumn));
        });
    }

    private function parentCourseCodeSelect(): mixed
    {
        return Schema::hasColumn('courses', 'code')
            ? DB::raw('parentCourse.code as parentCourseCode')
            : DB::raw('NULL as parentCourseCode');
    }

    private function formatAssignedModule(object $module, string $moduleType, Request $request): array
    {
        $imagePath = $module->imagePath ? (string) $module->imagePath : null;
        $startDate = $module->startDate ? (string) $module->startDate : null;
        $endDate = $module->endDate ? (string) $module->endDate : $startDate;

        return [
            'id' => (int) $module->id,
            'moduleId' => (int) $module->id,
            'moduleType' => $moduleType,
            'moduleTypeLabel' => $this->moduleTypeLabel($moduleType),
            'code' => $module->code ?? null,
            'title' => (string) $module->title,
            'subtitle' => $module->categoryName ?? null,
            'isSpecial' => (int) ($module->isSpecial ?? 0),
            'parentCourseId' => empty($module->parentCourseId ?? null) ? null : (int) $module->parentCourseId,
            'parentCourseTitle' => $module->parentCourseTitle ?? null,
            'parentCourseCode' => $module->parentCourseCode ?? null,
            'thumbnailUrl' => $imagePath ? $this->privateFileUrl($request, $imagePath) : null,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'status' => (int) ($module->status ?? 0),
            'statusLabel' => ((int) ($module->status ?? 0)) === 1 ? 'Active' : 'Inactive',
            'scheduleStatus' => $this->scheduleStatus($startDate, $endDate),
            'materialsCount' => (int) ($module->materialsCount ?? 0),
            'createdOn' => $module->createdOn ?? null,
        ];
    }

    private function formatMaterial(object $material, Request $request): array
    {
        return [
            'id' => (int) $material->id,
            'moduleType' => (string) $material->moduleType,
            'moduleId' => (int) $material->moduleId,
            'title' => (string) $material->title,
            'description' => $material->description,
            'materialDate' => $material->materialDate,
            'originalFileName' => (string) $material->originalFileName,
            'fileExtension' => $material->fileExtension,
            'mimeType' => $material->mimeType,
            'fileSize' => $material->fileSize ? (int) $material->fileSize : null,
            'fileSizeLabel' => $this->humanFileSize((int) ($material->fileSize ?? 0)),
            'uploadedBy' => [
                'id' => $material->instructorId ? (int) $material->instructorId : null,
                'name' => $material->uploadedByName ?: null,
                'email' => $material->uploadedByEmail ?: null,
            ],
            'createdAt' => $material->created_at,
            'updatedAt' => $material->updated_at,
            'downloadUrl' => $this->downloadUrl($request, (int) $material->id, true),
            'viewUrl' => $this->downloadUrl($request, (int) $material->id, false),
        ];
    }

    private function authorizeMaterialRead(Request $request, string $moduleType, int $moduleId): array
    {
        $user = $request->user();

        if (!$user) {
            return ['allowed' => false, 'message' => 'Unauthenticated'];
        }

        if ($this->isAdmin($user)) {
            return ['allowed' => true, 'message' => ''];
        }

        if ($this->isInstructor($user) && $this->isModuleAssignedToInstructor($moduleType, $moduleId, (int) $user->id)) {
            return ['allowed' => true, 'message' => ''];
        }

        if ($this->hasLearnerModuleAccess((int) $user->id, $moduleType, $moduleId)) {
            return ['allowed' => true, 'message' => ''];
        }

        return ['allowed' => false, 'message' => 'You do not have access to these materials.'];
    }

    private function moduleExists(string $moduleType, int $moduleId): bool
    {
        return match ($moduleType) {
            self::MODULE_ACADEMIC_COURSE => Schema::hasTable('courses')
                && DB::table('courses')
                    ->where('id', $moduleId)
                    ->where('courseType', 2)
                    ->where('deletedFlag', 0)
                    ->exists(),
            self::MODULE_WORKSHOP => Schema::hasTable('workshops')
                && DB::table('workshops')
                    ->where('id', $moduleId)
                    ->where('deletedFlag', 0)
                    ->exists(),
            self::MODULE_SEMINAR => Schema::hasTable('seminars')
                && DB::table('seminars')
                    ->where('id', $moduleId)
                    ->where('deletedFlag', 0)
                    ->exists(),
            default => false,
        };
    }

    private function isModuleAssignedToInstructor(string $moduleType, int $moduleId, int $instructorId): bool
    {
        if ($instructorId <= 0) {
            return false;
        }

        if ($moduleType === self::MODULE_ACADEMIC_COURSE) {
            if (!Schema::hasTable('courses')) {
                return false;
            }

            $course = DB::table('courses')
                ->where('id', $moduleId)
                ->where('courseType', 2)
                ->where('deletedFlag', 0)
                ->first(['id', 'createdBy', 'instructorIds']);

            if (!$course) {
                return false;
            }

            if ((int) ($course->createdBy ?? 0) === $instructorId) {
                return true;
            }

            if (
                Schema::hasTable('courseinstructors')
                && DB::table('courseinstructors')
                    ->where('courseId', $moduleId)
                    ->where('instructorId', $instructorId)
                    ->exists()
            ) {
                return true;
            }

            return in_array($instructorId, $this->normalizeInstructorIds($course->instructorIds ?? []), true);
        }

        $table = $moduleType === self::MODULE_SEMINAR ? 'seminars' : 'workshops';

        return Schema::hasTable($table)
            && DB::table($table)
                ->where('id', $moduleId)
                ->where('createdBy', $instructorId)
                ->where('deletedFlag', 0)
                ->exists();
    }

    private function hasLearnerModuleAccess(int $userId, string $moduleType, int $moduleId): bool
    {
        if ($moduleType === self::MODULE_ACADEMIC_COURSE) {
            return Schema::hasTable('enrollments')
                && DB::table('enrollments')
                    ->where('userId', $userId)
                    ->where('courseId', $moduleId)
                    ->where('deletedFlag', 0)
                    ->where('status', 'active')
                    ->exists();
        }

        $programType = $moduleType === self::MODULE_SEMINAR ? 'seminar' : 'workshop';

        if (
            Schema::hasTable('invoices')
            && Schema::hasColumn('invoices', 'entityType')
            && Schema::hasColumn('invoices', 'entityId')
            && Schema::hasTable('orders')
        ) {
            $invoiceAccess = DB::table('invoices as i')
                ->join('orders as o', 'o.id', '=', 'i.orderId')
                ->where('i.userId', $userId)
                ->where('i.entityId', $moduleId)
                ->where('i.deletedFlag', 0)
                ->where('o.status', 'paid')
                ->where('o.deletedFlag', 0)
                ->whereRaw('LOWER(i.entityType) LIKE ?', ['%' . $programType . '%'])
                ->exists();

            if ($invoiceAccess) {
                return true;
            }
        }

        if (
            Schema::hasTable('order_items')
            && Schema::hasColumn('order_items', 'entityType')
            && Schema::hasColumn('order_items', 'entityId')
            && Schema::hasTable('orders')
        ) {
            $orderItemAccess = DB::table('order_items as oi')
                ->join('orders as o', 'o.id', '=', 'oi.orderId')
                ->where('o.userId', $userId)
                ->where('o.status', 'paid')
                ->where('o.deletedFlag', 0)
                ->where('oi.deletedFlag', 0)
                ->where('oi.entityId', $moduleId)
                ->whereRaw('LOWER(oi.entityType) LIKE ?', ['%' . $programType . '%'])
                ->exists();

            if ($orderItemAccess) {
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
                ->where('entityId', $moduleId)
                ->where('status', 'success')
                ->where('deletedFlag', 0)
                ->whereRaw('LOWER(entityType) LIKE ?', ['%' . $programType . '%'])
                ->exists();
        }

        return false;
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
            ->map(fn($item) => is_array($item) && isset($item['id']) ? (int) $item['id'] : (int) $item)
            ->filter(fn($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    private function moduleTypeLabel(string $moduleType): string
    {
        return match ($moduleType) {
            self::MODULE_WORKSHOP => 'Workshop',
            self::MODULE_SEMINAR => 'Seminar',
            default => 'Academic Course',
        };
    }

    private function scheduleStatus(?string $startDate, ?string $endDate): string
    {
        $start = $startDate ? substr($startDate, 0, 10) : null;
        $end = $endDate ? substr($endDate, 0, 10) : $start;
        $today = now()->toDateString();

        if ($end && $end < $today) {
            return 'completed';
        }

        if ($start && $start <= $today) {
            return 'ongoing';
        }

        return 'upcoming';
    }

    private function safeOriginalFileName(string $fileName): string
    {
        $name = basename(str_replace('\\', '/', $fileName));
        $name = preg_replace('/[^\w.\- ()]+/', '_', $name) ?: 'material';

        return Str::limit($name, 240, '');
    }

    private function safeDownloadFileName(string $fileName): string
    {
        $safeName = $this->safeOriginalFileName($fileName);

        return $safeName !== '' ? $safeName : 'material-download';
    }

    private function normalizeStoredPath(string $path): string
    {
        return trim(str_replace('\\', '/', urldecode($path)), '/');
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

        return rtrim(rtrim(number_format($size, $unitIndex === 0 ? 0 : 1), '0'), '.') . ' ' . $units[$unitIndex];
    }

    private function privateFileUrl(Request $request, string $path): string
    {
        $requestUrl = $request->url();
        $apiPosition = strpos($requestUrl, '/api/');
        $baseUrl = $apiPosition === false
            ? $request->getSchemeAndHttpHost()
            : substr($requestUrl, 0, $apiPosition);

        return $baseUrl . '/api/getAfile?path=' . rawurlencode(trim($path, '/'));
    }

    private function downloadUrl(Request $request, int $id, bool $download): string
    {
        $requestUrl = $request->url();
        $apiPosition = strpos($requestUrl, '/api/');
        $baseUrl = $apiPosition === false
            ? $request->getSchemeAndHttpHost()
            : substr($requestUrl, 0, $apiPosition);

        return $baseUrl . '/api/module-materials/' . $id . '/download' . ($download ? '?download=1' : '');
    }

    private function isAdmin(object $user): bool
    {
        return (int) ($user->role ?? 0) === self::ROLE_ADMIN;
    }

    private function isInstructor(object $user): bool
    {
        return (int) ($user->role ?? 0) === self::ROLE_INSTRUCTOR;
    }

    private function unauthenticatedResponse()
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'Unauthenticated',
        ], 401);
    }

    private function forbiddenResponse(string $message)
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => $message,
        ], 403);
    }

    private function notFoundResponse(string $message)
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => $message,
        ], 404);
    }

    private function serverErrorResponse(string $message)
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => $message,
        ], 500);
    }

    private function missingMaterialsTableResponse()
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'Materials table not found. Please run database migrations.',
        ], 500);
    }

    private function missingAssignedStudentsTableResponse(array $tables)
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'Enrollment tables are missing: ' . implode(', ', $tables),
        ], 500);
    }

    private function validationResponse($validator)
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $validator->errors(),
        ], 422);
    }
}
