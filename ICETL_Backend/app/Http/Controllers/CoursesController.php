<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\EntityCodeService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CoursesController extends Controller
{
    private const ROLE_ADMIN = 1;
    private const ROLE_INSTRUCTOR = 3;
    private const APPROVAL_PENDING = 'PENDING';
    private const APPROVAL_APPROVED = 'APPROVED';
    private const APPROVAL_REJECTED = 'REJECTED';
    private const OFFLINE_COURSE_PERMISSION_ROUTES = [
        '/application/courses/manageOfflineCourses',
        '/application/courses/manageOfflineCourses/add',
        '/application/courses/manageOfflineCourses/viewMyOfflineCourses',
        '/application/courses/manageOfflineCourses/viewAllOfflineCourses',
    ];

    public function addCourseCategory(Request $request)
    {
        $validator = Validator::make($request->all(), [

            'categoryName' => [
                'required',
                'string',
                'min:3',
                'max:50',
                'regex:/^[a-zA-Z\s]+$/',
                'unique:coursecategories,categoryName'
            ],
            'status' => 'required|in:0,1',
            'icon' => 'nullable|image|mimes:png,jpg,jpeg,svg|max:2048',
            'categoryIcon' => 'nullable|string|regex:/^fa-[a-z]+ fa-[a-z-]+$/'
        ]);

        // Validation Failed
        if ($validator->fails()) {

            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            $iconPath = null;
            // Upload Icon
            if ($request->hasFile('icon')) {
                $file = $request->file('icon');
                $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                $iconPath = $file->storeAs(
                    'course-category-icons',
                    $fileName,
                    'private'
                );
            }

            // Insert Data
            $inserted = DB::table('coursecategories')->insert([
                'categoryName' => $request->categoryName,
                'slug' => Str::slug($request->categoryName),
                'status' => $request->status,
                'icon' => $iconPath,
                'categoryIcon' => $request->categoryIcon,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Course category added successfully'
            ], 200);
        } catch (\Exception $e) {

            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getCourseCategories(Request $request)
    {
        try {

            $query = DB::table('coursecategories as cc')
                ->select('cc.*');

            if (Schema::hasTable('courses')) {
                $courseCountBaseQuery = DB::table('courses')
                    ->select('categoryId', DB::raw('COUNT(*) as courseCount'))
                    ->where('deletedFlag', 0);

                $courseCountQuery = (
                    $this->isPreLoginRequest($request)
                        ? $this->applyPublicWebsiteCourseScope($courseCountBaseQuery)
                        : $this->applyOnlineCourseScope($courseCountBaseQuery)
                )
                    ->where('status', 1)
                    ->groupBy('categoryId');

                $query
                    ->leftJoinSub($courseCountQuery, 'activeCourses', function ($join) {
                        $join->on('activeCourses.categoryId', '=', 'cc.id');
                    })
                    ->addSelect(DB::raw('COALESCE(activeCourses.courseCount, 0) as courseCount'));
            } else {
                $query->addSelect(DB::raw('0 as courseCount'));
            }

            // Search
            if ($request->search) {

                $query->where(
                    'cc.categoryName',
                    'LIKE',
                    '%' . $request->search . '%'
                );
            }

            // Status Filter
            if ($request->status != '') {

                $query->where('cc.status', $request->status);
            }

            $categories = $query
                ->orderBy('cc.id', 'DESC')
                ->get()
                ->map(fn($category) => $this->attachCategoryIconUrl($request, $category));

            return response()->json([

                'status' => true,

                'message' => 'Categories fetched successfully',

                'data' => $categories

            ]);
        } catch (\Exception $e) {

            return response()->json([

                'status' => false,

                'message' => 'Something went wrong',

                'error' => $e->getMessage()

            ], 500);
        }
    }

    public function updateCourseCategory(Request $request)
    {
        $categoryId = (int) $request->input('id');

        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|exists:coursecategories,id',
            'categoryName' => [
                'required',
                'string',
                'min:3',
                'max:50',
                'regex:/^[a-zA-Z\s]+$/',
                Rule::unique('coursecategories', 'categoryName')->ignore($categoryId, 'id')
            ],
            'status' => 'required|in:0,1',
            'icon' => 'nullable|image|mimes:png,jpg,jpeg,svg|max:2048',
            'categoryIcon' => 'nullable|string|regex:/^fa-[a-z]+ fa-[a-z-]+$/'
        ]);

        if ($validator->fails()) {

            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            $category = DB::table('coursecategories')
                ->where('id', $categoryId)
                ->first();

            if (!$category) {
                return response()->json([
                    'success' => false,
                    'message' => 'Course category not found'
                ], 404);
            }

            $iconPath = $category->icon;

            if ($request->hasFile('icon')) {
                if ($iconPath && Storage::disk('private')->exists($iconPath)) {
                    Storage::disk('private')->delete($iconPath);
                }

                $file = $request->file('icon');
                $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                $iconPath = $file->storeAs(
                    'course-category-icons',
                    $fileName,
                    'private'
                );
            }

            DB::table('coursecategories')
                ->where('id', $categoryId)
                ->update([
                    'categoryName' => $request->categoryName,
                    'slug' => Str::slug($request->categoryName),
                    'status' => $request->status,
                    'icon' => $iconPath,
                    'categoryIcon' => $request->categoryIcon,
                    'updated_at' => now()
                ]);

            $updatedCategory = DB::table('coursecategories')
                ->where('id', $categoryId)
                ->first();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Course category updated successfully',
                'data' => $updatedCategory
                    ? $this->attachCategoryIconUrl($request, $updatedCategory)
                    : null
            ], 200);
        } catch (\Exception $e) {

            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function deleteCourseCategory(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|exists:coursecategories,id'
        ]);

        if ($validator->fails()) {

            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            $category = DB::table('coursecategories')
                ->where('id', (int) $request->id)
                ->first();

            if (!$category) {
                return response()->json([
                    'success' => false,
                    'message' => 'Course category not found'
                ], 404);
            }

            if ($category->icon && Storage::disk('private')->exists($category->icon)) {
                Storage::disk('private')->delete($category->icon);
            }

            DB::table('coursecategories')
                ->where('id', (int) $request->id)
                ->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Course category deleted successfully'
            ], 200);
        } catch (\Exception $e) {

            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
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

    private function attachCategoryIconUrl(Request $request, object $category): object
    {
        $category->iconUrl = $category->icon
            ? $this->privateFileUrl($request, $category->icon)
            : null;

        return $category;
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
            ->map(function ($item) {
                if (is_array($item) && isset($item['id'])) {
                    return (int) $item['id'];
                }

                return (int) $item;
            })
            ->filter(fn($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    private function normalizeCourseHighlights(mixed $value): array
    {
        $decodedValue = $value;

        if (is_string($decodedValue)) {
            $decodedValue = json_decode($decodedValue, true);
        }

        if (!is_array($decodedValue)) {
            return [];
        }

        return collect($decodedValue)
            ->filter(fn($item) => is_string($item) || is_numeric($item))
            ->map(fn($item) => trim((string) $item))
            ->filter(fn($item) => $item !== '')
            ->values()
            ->all();
    }

    private function prepareCourseHighlightsForValidation(Request $request): void
    {
        if (!$request->has('courseHighlights')) {
            return;
        }

        $request->merge([
            'courseHighlights' => $this->normalizeCourseHighlights($request->input('courseHighlights'))
        ]);
    }

    private function decodeCourseHighlights(?string $courseHighlights): array
    {
        if (!$courseHighlights) {
            return [];
        }

        $decoded = json_decode($courseHighlights, true);

        return is_array($decoded) ? $this->normalizeCourseHighlights($decoded) : [];
    }

    private function applyOnlineCourseScope($query, ?string $alias = null)
    {
        $prefix = $alias ? $alias . '.' : '';

        $query->where($prefix . 'courseType', 1);

        foreach (['venue', 'city'] as $column) {
            $query->where(function ($subQuery) use ($prefix, $column) {
                $subQuery
                    ->whereNull($prefix . $column)
                    ->orWhere($prefix . $column, '');
            });
        }

        foreach (['startDate', 'startTime'] as $column) {
            $query->whereNull($prefix . $column);
        }

        return $query;
    }

    private function applyPublicWebsiteCourseScope($query, ?string $alias = null)
    {
        $prefix = $alias ? $alias . '.' : '';

        return $query->whereIn($prefix . 'courseType', [1, 2]);
    }

    private function isPreLoginRequest(Request $request): bool
    {
        return str_contains($request->path(), 'preloginapi');
    }

    private function courseInstructorMap($courses)
    {
        $courseIds = collect($courses)
            ->pluck('id')
            ->map(fn($id) => (int) $id)
            ->unique()
            ->values();

        return $courseIds->isEmpty()
            ? collect()
            : DB::table('courseinstructors as ci')
                ->leftJoin('users as u', 'u.id', '=', 'ci.instructorId')
                ->whereIn('ci.courseId', $courseIds)
                ->select('ci.courseId', 'ci.instructorId', 'u.name')
                ->orderBy('ci.id')
                ->get()
                ->groupBy('courseId');
    }

    private function fallbackInstructorNames($courses)
    {
        $fallbackInstructorIds = collect($courses)
            ->flatMap(fn($course) => $this->normalizeInstructorIds($course->instructorIds ?? []))
            ->unique()
            ->values();

        return $fallbackInstructorIds->isEmpty()
            ? collect()
            : DB::table('users')
                ->whereIn('id', $fallbackInstructorIds)
                ->pluck('name', 'id');
    }

    private function formatPublicCourse(Request $request, object $course, $courseInstructorMap, $fallbackInstructors): array
    {
        $relationInstructors = collect($courseInstructorMap->get($course->id, []))
            ->map(fn($instructor) => [
                'id' => (int) $instructor->instructorId,
                'name' => (string) ($instructor->name ?? 'Instructor')
            ]);

        $instructors = $relationInstructors->isNotEmpty()
            ? $relationInstructors
            : collect($this->normalizeInstructorIds($course->instructorIds ?? []))
                ->map(fn($id) => [
                    'id' => (int) $id,
                    'name' => (string) ($fallbackInstructors[(int) $id] ?? 'Instructor')
                ]);

        $price = is_numeric($course->price ?? null) ? (float) $course->price : 0;
        $oldPrice = is_numeric($course->oldPrice ?? null) ? (float) $course->oldPrice : null;

        return [
            'id' => (int) $course->id,
            'code' => $course->code ?? null,
            'title' => (string) $course->title,
            'courseType' => (int) ($course->courseType ?? 1),
            'courseTypeLabel' => ((int) ($course->courseType ?? 1)) === 2 ? 'Academic Course' : 'Online Course',
            'categoryId' => $course->categoryId ? (int) $course->categoryId : null,
            'categoryName' => $course->categoryName ?: 'Uncategorized',
            'instructors' => $instructors->values()->all(),
            'instructorName' => $instructors->pluck('name')->filter()->join(', '),
            'duration' => $course->duration,
            'durationUnit' => $course->durationUnit,
            'price' => $price,
            'oldPrice' => $oldPrice,
            'description' => $course->description,
            'courseHighlights' => $this->decodeCourseHighlights($course->courseHighlights ?? null),
            'thumbnailUrl' => $course->thumbnail ? $this->privateFileUrl($request, $course->thumbnail) : null,
            'lessonsCount' => (int) ($course->lessonsCount ?? 0),
            'studentsCount' => (int) ($course->studentsCount ?? 0),
            'popularityCount' => (int) ($course->popularityCount ?? 0),
            'status' => (int) $course->status,
            'statusLabel' => ((int) $course->status) === 1 ? 'Active' : 'Inactive',
            'scheduleStatus' => ((int) ($course->courseType ?? 1)) === 2
                ? $this->getOfflineCourseScheduleStatus(
                    (string) ($course->startDate ?? ''),
                    ($course->endDate ?? null) ? (string) $course->endDate : null
                )
                : null,
            'venue' => $course->venue ?? null,
            'city' => $course->city ?? null,
            'startDate' => $course->startDate ?? null,
            'endDate' => $course->endDate ?? null,
            'startTime' => $this->formatOfflineCourseTime($course->startTime ?? null),
            'endTime' => $this->formatOfflineCourseTime($course->endTime ?? null),
            'createdOn' => $course->createdOn ?? null,
            'updatedOn' => $course->updatedOn ?? null,
        ];
    }

    public function getPublicCourses(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'page' => 'nullable|integer|min:1',
            'perPage' => [
                'nullable',
                function ($attribute, $value, $fail) {
                    if ($value === null || $value === '' || $value === 'all') {
                        return;
                    }

                    if (
                        !filter_var($value, FILTER_VALIDATE_INT)
                        || !in_array((int) $value, [3, 6, 9, 10, 12, 20, 50, 100], true)
                    ) {
                        $fail('The per page value must be 3, 6, 9, 10, 12, 20, 50, 100, or all.');
                    }
                },
            ],
            'search' => 'nullable|string|max:100',
            'categoryId' => 'nullable|integer',
            'categoryIds' => 'nullable|array',
            'categoryIds.*' => 'integer',
            'sortBy' => 'nullable|in:newest,popular,priceLowHigh,priceHighLow',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $page = (int) $request->input('page', 1);
            $isAllPageSize = $request->input('perPage') === 'all';

            $query = $this->applyPublicWebsiteCourseScope(
                DB::table('courses as c')
                    ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
                    ->where('c.deletedFlag', 0),
                'c'
            )
                ->where('c.status', 1)
                ->select(
                    'c.id',
                    EntityCodeService::codeSelect('courses', 'c'),
                    'c.title',
                    'c.courseType',
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
                    'c.venue',
                    'c.city',
                    'c.startDate',
                    'c.endDate',
                    'c.startTime',
                    'c.endTime',
                    'c.createdOn',
                    'c.updatedOn'
                );

            if (Schema::hasTable('carts')) {
                $query
                    ->leftJoinSub(
                        DB::table('carts')
                            ->select('course_id', DB::raw('COUNT(*) as cart_count'))
                            ->groupBy('course_id'),
                        'coursePopularity',
                        'coursePopularity.course_id',
                        '=',
                        'c.id'
                    )
                    ->addSelect(DB::raw('COALESCE(coursePopularity.cart_count, 0) as popularityCount'));
            } else {
                $query->addSelect(DB::raw('0 as popularityCount'));
            }

            if (Schema::hasTable('enrollments')) {
                $query
                    ->leftJoinSub(
                        DB::table('enrollments')
                            ->select('courseId', DB::raw('COUNT(DISTINCT userId) as studentsCount'))
                            ->where('deletedFlag', 0)
                            ->groupBy('courseId'),
                        'courseStudents',
                        'courseStudents.courseId',
                        '=',
                        'c.id'
                    )
                    ->addSelect(DB::raw('COALESCE(courseStudents.studentsCount, 0) as studentsCount'));
            } else {
                $query->addSelect(DB::raw('0 as studentsCount'));
            }

            if (Schema::hasTable('course_sections') && Schema::hasTable('course_curriculum_items')) {
                $query
                    ->leftJoinSub(
                        DB::table('course_sections as cs')
                            ->join('course_curriculum_items as cci', 'cci.sectionId', '=', 'cs.id')
                            ->select('cs.courseId', DB::raw('COUNT(cci.id) as lessonsCount'))
                            ->where('cs.deletedFlag', 0)
                            ->where('cci.deletedFlag', 0)
                            ->where('cs.status', 1)
                            ->where('cci.status', 1)
                            ->groupBy('cs.courseId'),
                        'courseLessons',
                        'courseLessons.courseId',
                        '=',
                        'c.id'
                    )
                    ->addSelect(DB::raw('COALESCE(courseLessons.lessonsCount, 0) as lessonsCount'));
            } else {
                $query->addSelect(DB::raw('0 as lessonsCount'));
            }

            if ($request->filled('search')) {
                $search = trim((string) $request->input('search'));

                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('c.title', 'LIKE', '%' . $search . '%')
                        ->orWhere('c.description', 'LIKE', '%' . $search . '%')
                        ->orWhere('cc.categoryName', 'LIKE', '%' . $search . '%')
                        ->orWhere('c.venue', 'LIKE', '%' . $search . '%')
                        ->orWhere('c.city', 'LIKE', '%' . $search . '%');
                    EntityCodeService::orWhereCode($subQuery, 'courses', 'c.code', $search);
                });
            }

            if ($request->filled('categoryIds') && is_array($request->input('categoryIds'))) {
                $categoryIds = collect($request->input('categoryIds'))
                    ->map(fn($id) => (int) $id)
                    ->filter(fn($id) => $id > 0)
                    ->unique()
                    ->values()
                    ->all();

                if (!empty($categoryIds)) {
                    $query->whereIn('c.categoryId', $categoryIds);
                }
            } elseif ($request->filled('categoryId')) {
                $query->where('c.categoryId', (int) $request->input('categoryId'));
            }

            $summaryQuery = $this->applyPublicWebsiteCourseScope(
                DB::table('courses')
                    ->where('deletedFlag', 0)
            )
                ->where('status', 1);

            $summary = [
                'totalCourses' => (clone $summaryQuery)->count(),
                'totalCategories' => Schema::hasTable('coursecategories')
                    ? DB::table('coursecategories')->where('status', 1)->count()
                    : 0,
                'totalStudents' => Schema::hasTable('enrollments')
                    ? DB::table('enrollments')->where('deletedFlag', 0)->distinct()->count('userId')
                    : 0,
            ];

             $query->orderBy('c.createdOn', 'DESC');
            $filteredTotal = (clone $query)->count();
            $perPage = $isAllPageSize
                ? max($filteredTotal, 1)
                : (int) $request->input('perPage', 9);

            $sortBy = $request->input('sortBy', 'newest');

            $courses = $query
                ->when($sortBy === 'priceLowHigh', function ($sortQuery) {
                    $sortQuery->orderBy('c.price', 'ASC')->orderBy('c.id', 'DESC');
                })
                ->when($sortBy === 'priceHighLow', function ($sortQuery) {
                    $sortQuery->orderBy('c.price', 'DESC')->orderBy('c.id', 'DESC');
                })
                ->when($sortBy === 'popular', function ($sortQuery) {
                    $sortQuery
                        ->orderBy('studentsCount', 'DESC')
                        ->orderBy('popularityCount', 'DESC')
                        ->orderBy('c.id', 'DESC');
                })
                ->when($sortBy === 'newest', function ($sortQuery) {
                    $sortQuery->orderBy('c.id', 'DESC');
                })
                ->paginate($perPage, ['*'], 'page', $page);

            $items = collect($courses->items());
            $courseInstructorMap = $this->courseInstructorMap($items);
            $fallbackInstructors = $this->fallbackInstructorNames($items);

            return response()->json([
                'status' => true,
                'message' => 'Public courses fetched successfully',
                'data' => $items
                    ->map(fn($course) => $this->formatPublicCourse($request, $course, $courseInstructorMap, $fallbackInstructors))
                    ->values(),
                'meta' => [
                    'currentPage' => $courses->currentPage(),
                    'perPage' => $isAllPageSize ? 'all' : $courses->perPage(),
                    'total' => $courses->total(),
                    'lastPage' => $courses->lastPage(),
                    'from' => $courses->firstItem(),
                    'to' => $courses->lastItem(),
                ],
                'summary' => $summary,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching public courses: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function resolveCreatedById(Request $request, ?array $profileData): ?int
    {
        if ($request->user()) {
            return (int) $request->user()->id;
        }

        $profileId = $profileData['id'] ?? null;

        if (is_numeric($profileId)) {
            return (int) $profileId;
        }

        if (is_string($profileId) && $profileId !== '') {
            try {
                return (int) Crypt::decryptString($profileId);
            } catch (\Exception $e) {
                Log::warning('Unable to decrypt course creator profile id: ' . $e->getMessage());
            }
        }

        return null;
    }

    public function createCourse(Request $request)
    {
        $this->prepareCourseHighlightsForValidation($request);

        $ProfileData = json_decode(
            $request->input('userProfile', '{}'),
            true
        );
        $validator = Validator::make($request->all(), [

            'title' => [
                'required',
                'string',
                'min:5',
                'max:100'
            ],
            'category' => 'required|numeric',
            'isSpecial' => 'nullable|boolean',
            'parentCourseId' => [
                Rule::requiredIf(fn() => $request->boolean('isSpecial')),
                'nullable',
                'integer',
                'exists:courses,id',
            ],
            'instructor' => 'required',
            'duration' => 'required|integer|min:1',
            'durationUnit' => 'required|integer|in:1,2',
            'price' => 'required|numeric|min:0',
            'oldPrice' => 'nullable|numeric|min:0',
            'students' => 'nullable|integer|min:0',
            'description' => [
                'required',
                'string',
                'min:20',
                'max:300'
            ],
            'courseHighlights' => 'nullable|array',
            'courseHighlights.*' => 'string',
            'thumbnail' =>
            'nullable|image|mimes:png,jpg,jpeg,webp|max:2048',
            'status' => 'required|in:0,1'

        ]);


        // Validation Failed
        if ($validator->fails()) {

            return response()->json([

                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()

            ], 422);
        }


        DB::beginTransaction();

        try {

            $thumbnailPath = null;

            // Upload Thumbnail
            if ($request->hasFile('thumbnail')) {

                $file = $request->file('thumbnail');

                $fileName =
                    time()
                    . '_'
                    . uniqid()
                    . '.'
                    . $file->getClientOriginalExtension();

                $thumbnailPath =
                    $file->storeAs(
                        'course-thumbnails',
                        $fileName,
                        'private'
                    );
            }


            // Convert instructor array to JSON
            $instructorIds = $this->normalizeInstructorIds($request->instructor);

            if (empty($instructorIds)) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Validation failed',
                    'errors' => [
                        'instructor' => ['Please select at least one valid instructor.']
                    ]
                ], 422);
            }

            $courseHighlights = $this->normalizeCourseHighlights($request->input('courseHighlights', []));
            $isSpecial = $request->boolean('isSpecial');
            $parentCourseId = $isSpecial ? (int) $request->input('parentCourseId') : null;

            if ($isSpecial && !$this->isValidParentAcademicCourse($parentCourseId, (int) $request->input('category'))) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Validation failed',
                    'errors' => [
                        'parentCourseId' => ['Please select a valid parent academic course from the same category.']
                    ]
                ], 422);
            }

            // Insert Data
            $courseId = DB::table('courses')->insertGetId([
                'title' => $request->title,
                'categoryId' => $request->category,
                'instructorIds' => json_encode($instructorIds),
                'duration' => (int) $request->duration,
                'durationUnit' => (int) $request->durationUnit,
                'price' => $request->price,
                'oldPrice' => $request->oldPrice,
                'description' => $request->description,
                'courseHighlights' => !empty($courseHighlights) ? json_encode($courseHighlights) : null,
                'thumbnail' => $thumbnailPath,
                'status' => $request->status,
                'courseType' => 1,
                'isSpecial' => $isSpecial ? 1 : 0,
                'parentCourseId' => $parentCourseId,
                'createdBy' => $this->resolveCreatedById($request, $ProfileData),
                'createdByRoleId' => $ProfileData ? $ProfileData['role'] : null,
                'deletedFlag' => 0,
                'createdOn' => now()
            ]);

            $courseCode = EntityCodeService::assignIfMissing(
                'courses',
                $courseId,
                EntityCodeService::PREFIX_MAIN_COURSE
            );

            foreach ($instructorIds as $instructorId) {
                DB::table('courseinstructors')
                    ->insert([
                        'courseId' => $courseId,
                        'instructorId' => $instructorId,
                        'createdOn' => now()
                    ]);
            }
            DB::commit();
            return response()->json([
                'status' => true,
                'message' => 'Course created successfully',
                'data' => [
                    'id' => $courseId,
                    'code' => $courseCode,
                ]
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function createOfflineCourse(Request $request)
    {
        $this->prepareCourseHighlightsForValidation($request);

        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'min:5', 'max:120'],
            'category' => 'required|integer|exists:coursecategories,id',
            'isSpecial' => 'nullable|boolean',
            'parentCourseId' => [
                Rule::requiredIf(fn() => $request->boolean('isSpecial')),
                'nullable',
                'integer',
                'exists:courses,id',
            ],
            'instructor' => 'required',
            'venue' => ['required', 'string', 'min:3', 'max:150'],
            'city' => ['required', 'string', 'min:2', 'max:100'],
            'startDate' => 'required|date|after_or_equal:today',
            'endDate' => 'nullable|date|after:startDate',
            'startTime' => 'required|date_format:H:i',
            'endTime' => 'nullable|date_format:H:i',
            'youtubeLiveUrl' => 'nullable|string|max:255',
            'meetingLink' => 'nullable|string|max:255',
            'price' => 'required|numeric|min:0',
            'description' => ['required', 'string', 'min:20', 'max:300'],
            'courseHighlights' => 'nullable|array',
            'courseHighlights.*' => 'string|max:255',
            'thumbnail' => 'nullable|image|mimes:png,jpg,jpeg,webp|max:2048',
            'status' => 'required|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (
            !$this->isInstructorUser($user)
            && !$this->canManageOfflineCourseWorkflow($user)
        ) {
            return response()->json([
                'status' => false,
                'message' => 'You are not allowed to create offline courses.'
            ], 403);
        }

        if (
            (!$request->filled('endDate') || $request->input('endDate') === $request->input('startDate'))
            && $request->filled('endTime')
            && $request->input('endTime') <= $request->input('startTime')
        ) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'endTime' => ['End time must be later than start time for a same-day course.']
                ]
            ], 422);
        }

        $instructorIds = $this->normalizeInstructorIds($request->input('instructor'));
        $creatorIsInstructor = $this->isInstructorUser($user);
        $isSpecial = $request->boolean('isSpecial') || $creatorIsInstructor;
        $parentCourseId = $isSpecial ? (int) $request->input('parentCourseId') : null;

        if (empty($instructorIds)) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'instructor' => ['Please select at least one valid instructor.']
                ]
            ], 422);
        }

        if ($isSpecial && !$this->isValidParentAcademicCourse($parentCourseId, (int) $request->input('category'))) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'parentCourseId' => ['Please select a valid parent academic course from the same category.']
                ]
            ], 422);
        }

        DB::beginTransaction();
        $thumbnailPath = null;

        try {
            if ($request->hasFile('thumbnail')) {
                $file = $request->file('thumbnail');
                $thumbnailPath = $file->storeAs(
                    'course-thumbnails',
                    uniqid() . '_' . time() . '.' . $file->getClientOriginalExtension(),
                    'private'
                );
            }

            $courseHighlights = $this->normalizeCourseHighlights($request->input('courseHighlights', []));
            $requestedPublishedFlag = (int) $request->input('status') === 1 ? 1 : 0;
            $publishedFlag = $creatorIsInstructor ? 0 : $requestedPublishedFlag;
            $approvalStatus = $creatorIsInstructor
                ? self::APPROVAL_PENDING
                : self::APPROVAL_APPROVED;
            $approvedBy = $approvalStatus === self::APPROVAL_APPROVED ? (int) $user->id : null;
            $approvedOn = $approvalStatus === self::APPROVAL_APPROVED ? now() : null;
            $publishedBy = $publishedFlag === 1 ? (int) $user->id : null;
            $publishedOn = $publishedFlag === 1 ? now() : null;

            $courseId = DB::table('courses')->insertGetId($this->filterExistingColumns('courses', [
                'title' => trim((string) $request->input('title')),
                'categoryId' => (int) $request->input('category'),
                'instructorIds' => json_encode($instructorIds),
                'duration' => 1,
                'durationUnit' => 1,
                'price' => $request->input('price'),
                'oldPrice' => null,
                'description' => trim((string) $request->input('description')),
                'courseHighlights' => !empty($courseHighlights) ? json_encode($courseHighlights) : null,
                'thumbnail' => $thumbnailPath,
                'status' => $publishedFlag,
                'courseType' => 2,
                'isSpecial' => $isSpecial ? 1 : 0,
                'parentCourseId' => $parentCourseId,
                'venue' => trim((string) $request->input('venue')),
                'city' => trim((string) $request->input('city')),
                'startDate' => $request->input('startDate'),
                'endDate' => $request->input('endDate') ?: null,
                'startTime' => $request->input('startTime'),
                'endTime' => $request->input('endTime') ?: null,
                'youtubeLiveUrl' => $request->input('youtubeLiveUrl') ?: null,
                'meetingLink' => $request->input('meetingLink') ?: null,
                'createdBy' => (int) $user->id,
                'createdByRoleId' => $user->role ?? null,
                'approvalStatus' => $approvalStatus,
                'approvedBy' => $approvedBy,
                'approvedOn' => $approvedOn,
                'rejectedBy' => null,
                'rejectedOn' => null,
                'rejectionReason' => null,
                'publishedFlag' => $publishedFlag,
                'publishedBy' => $publishedBy,
                'publishedOn' => $publishedOn,
                'deletedFlag' => 0,
                'createdOn' => now(),
            ]));

            $courseCode = EntityCodeService::assignIfMissing(
                'courses',
                $courseId,
                EntityCodeService::PREFIX_ACADEMIC_COURSE
            );

            foreach ($instructorIds as $instructorId) {
                DB::table('courseinstructors')->insert([
                    'courseId' => $courseId,
                    'instructorId' => $instructorId,
                    'createdOn' => now()
                ]);
            }

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Offline course created successfully',
                'data' => [
                    'id' => $courseId,
                    'code' => $courseCode,
                ]
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            if ($thumbnailPath && Storage::disk('private')->exists($thumbnailPath)) {
                Storage::disk('private')->delete($thumbnailPath);
            }
            Log::error('Error creating offline course: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getOfflineCourses(Request $request)
    {
        return $this->getOfflineCourseList($request, true);
    }

    private function isValidParentAcademicCourse(?int $parentCourseId, int $categoryId): bool
    {
        if (!$parentCourseId || $categoryId <= 0) {
            return false;
        }

        return DB::table('courses')
            ->where('id', $parentCourseId)
            ->where('categoryId', $categoryId)
            ->where('courseType', 2)
            ->where('deletedFlag', 0)
            ->where(function ($query) {
                $query->whereNull('isSpecial')
                    ->orWhere('isSpecial', 0);
            })
            ->exists();
    }

    public function getMyOfflineCourses(Request $request)
    {
        return $this->getOfflineCourseList($request, true);
    }

    public function getAllOfflineCourses(Request $request)
    {
        return $this->getOfflineCourseList($request, false);
    }

    private function getOfflineCourseList(Request $request, bool $onlyMine)
    {
        try {
            $validator = Validator::make($request->all(), [
                'page' => 'nullable|integer|min:1',
                'perPage' => [
                    'nullable',
                    function ($attribute, $value, $fail) {
                        if ($value === null || $value === '' || $value === 'all') {
                            return;
                        }

                        if (
                            !filter_var($value, FILTER_VALIDATE_INT)
                            || !in_array((int) $value, [10, 20, 50, 100], true)
                        ) {
                            $fail('The per page value must be 10, 20, 50, 100, or all.');
                        }
                    },
                ],
                'search' => 'nullable|string|max:100',
                'city' => 'nullable|string|max:100',
                'categoryId' => 'nullable',
                'categoryIds' => 'nullable|array',
                'categoryIds.*' => 'integer',
                'isSpecial' => 'nullable|boolean',
                'status' => 'nullable|in:0,1',
                'approvalStatus' => ['nullable', Rule::in([
                    self::APPROVAL_PENDING,
                    self::APPROVAL_APPROVED,
                    self::APPROVAL_REJECTED,
                ])],
                'publishStatus' => 'nullable|in:0,1',
                'createdByRole' => 'nullable|string|max:50',
                'startDate' => 'nullable|date',
                'endDate' => 'nullable|date',
                'scheduleStatus' => 'nullable|in:all,upcoming,ongoing,completed',
                'activeScheduleOnly' => 'nullable|boolean',
                'sortBy' => 'nullable|in:newest,oldest,dateAsc,dateDesc',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = $request->user();

            if (!$user) {
                return response()->json([
                    'status' => false,
                    'message' => 'Unauthenticated'
                ], 401);
            }

            $query = $this->baseOfflineCourseQuery();
            $summaryQuery = DB::table('courses as c')
                ->where('c.deletedFlag', 0)
                ->where('c.courseType', 2);

            if ($onlyMine) {
                $this->applyOfflineCourseMineScope($query, (int) $user->id);
                $this->applyOfflineCourseMineScope($summaryQuery, (int) $user->id);
            }

            if ($request->boolean('activeScheduleOnly')) {
                if ($request->input('status') !== null && $request->input('status') !== '') {
                    $summaryQuery->where('c.status', (int) $request->input('status'));
                }

                $this->applyOfflineCourseActiveScheduleFilter($summaryQuery);
            }

            $this->applyOfflineCourseFilters($query, $request);

            $page = (int) $request->input('page', 1);
            $isAllPageSize = $request->input('perPage') === 'all';
            $summary = $this->buildOfflineCourseSummary($summaryQuery);
            $filteredTotal = (clone $query)->count();
            $perPage = $isAllPageSize
                ? max($filteredTotal, 1)
                : (int) $request->input('perPage', 10);

            $courses = $this->applyOfflineCourseSort(
                $query,
                (string) $request->input('sortBy', 'newest')
            )->paginate($perPage, ['*'], 'page', $page);

            $courseItems = collect($courses->items());
            $courseInstructorMap = $this->courseInstructorMap($courseItems);
            $fallbackInstructors = $this->fallbackInstructorNames($courseItems);
            $enrolledCourseLookup = $this->enrolledCourseLookup($request, $courseItems);
            $data = $courseItems
                ->map(fn($course) => $this->formatOfflineCourse(
                    $course,
                    $courseInstructorMap,
                    $fallbackInstructors,
                    $enrolledCourseLookup,
                    $user
                ))
                ->values();

            return response()->json([
                'status' => true,
                'message' => $onlyMine
                    ? 'Offline courses fetched successfully'
                    : 'All offline courses fetched successfully',
                'data' => $data,
                'meta' => [
                    'currentPage' => $courses->currentPage(),
                    'perPage' => $isAllPageSize ? 'all' : $courses->perPage(),
                    'total' => $courses->total(),
                    'lastPage' => $courses->lastPage(),
                    'from' => $courses->firstItem(),
                    'to' => $courses->lastItem(),
                ],
                'summary' => $summary,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching offline courses: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function baseOfflineCourseQuery()
    {
        return DB::table('courses as c')
            ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
            ->leftJoin('users as creator', 'creator.id', '=', 'c.createdBy')
            ->leftJoin('roles as creatorRole', 'creatorRole.id', '=', 'c.createdByRoleId')
            ->leftJoin('users as approver', 'approver.id', '=', 'c.approvedBy')
            ->leftJoin('users as rejector', 'rejector.id', '=', 'c.rejectedBy')
            ->leftJoin('users as publisher', 'publisher.id', '=', 'c.publishedBy')
            ->leftJoin('courses as parentCourse', 'parentCourse.id', '=', 'c.parentCourseId')
            ->where('c.deletedFlag', 0)
            ->where('c.courseType', 2)
            ->select(
                'c.id',
                EntityCodeService::codeSelect('courses', 'c'),
                'c.title',
                'c.categoryId',
                'cc.categoryName as categoryName',
                'c.isSpecial',
                'c.parentCourseId',
                'parentCourse.title as parentCourseTitle',
                $this->parentCourseCodeSelect(),
                'c.instructorIds',
                'c.price',
                'c.description',
                'c.courseHighlights',
                'c.thumbnail',
                'c.status',
                'c.courseType',
                'c.venue',
                'c.city',
                'c.startDate',
                'c.endDate',
                'c.startTime',
                'c.endTime',
                'c.youtubeLiveUrl',
                'c.meetingLink',
                'c.createdBy',
                'c.createdByRoleId',
                'creatorRole.roleName as createdByRoleName',
                'creator.name as createdByName',
                'creator.email as createdByEmail',
                $this->courseColumnSelect('c', 'approvalStatus', 'approvalStatus', "'" . self::APPROVAL_PENDING . "'"),
                $this->courseColumnSelect('c', 'approvedBy', 'approvedBy'),
                $this->courseColumnSelect('c', 'approvedOn', 'approvedOn'),
                'approver.name as approvedByName',
                $this->courseColumnSelect('c', 'rejectedBy', 'rejectedBy'),
                $this->courseColumnSelect('c', 'rejectedOn', 'rejectedOn'),
                $this->courseColumnSelect('c', 'rejectionReason', 'rejectionReason'),
                'rejector.name as rejectedByName',
                $this->courseColumnSelect('c', 'publishedFlag', 'publishedFlag', 'c.status'),
                $this->courseColumnSelect('c', 'publishedBy', 'publishedBy'),
                $this->courseColumnSelect('c', 'publishedOn', 'publishedOn'),
                'publisher.name as publishedByName',
                'c.createdOn',
                'c.updatedOn'
            );
    }

    private function parentCourseCodeSelect(): mixed
    {
        return Schema::hasColumn('courses', 'code')
            ? DB::raw('parentCourse.code as parentCourseCode')
            : DB::raw('NULL as parentCourseCode');
    }

    private function courseColumnSelect(string $tableAlias, string $column, string $alias, string $fallback = 'NULL'): mixed
    {
        return Schema::hasColumn('courses', $column)
            ? DB::raw("{$tableAlias}.{$column} as {$alias}")
            : DB::raw("{$fallback} as {$alias}");
    }

    private function applyOfflineCourseFilters($query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));

            $query->where(function ($subQuery) use ($search) {
                $subQuery->where('c.title', 'LIKE', '%' . $search . '%')
                    ->orWhere('c.description', 'LIKE', '%' . $search . '%')
                    ->orWhere('c.venue', 'LIKE', '%' . $search . '%')
                    ->orWhere('c.city', 'LIKE', '%' . $search . '%')
                    ->orWhere('cc.categoryName', 'LIKE', '%' . $search . '%')
                    ->orWhere('creator.name', 'LIKE', '%' . $search . '%')
                    ->orWhere('creator.email', 'LIKE', '%' . $search . '%')
                    ->orWhereExists(function ($instructorQuery) use ($search) {
                        $instructorQuery
                            ->select(DB::raw(1))
                            ->from('courseinstructors as ci')
                            ->leftJoin('users as instructor', 'instructor.id', '=', 'ci.instructorId')
                            ->whereColumn('ci.courseId', 'c.id')
                            ->where(function ($nameQuery) use ($search) {
                                $nameQuery->where('instructor.name', 'LIKE', '%' . $search . '%')
                                    ->orWhere('instructor.email', 'LIKE', '%' . $search . '%');
                            });
                    });
                EntityCodeService::orWhereCode($subQuery, 'courses', 'c.code', $search);
            });
        }

        if ($request->filled('city')) {
            $city = trim((string) $request->input('city'));
            $query->where('c.city', 'LIKE', '%' . $city . '%');
        }

        if ($request->filled('categoryIds') && is_array($request->input('categoryIds'))) {
            $categoryIds = collect($request->input('categoryIds'))
                ->map(fn($id) => (int) $id)
                ->filter(fn($id) => $id > 0)
                ->unique()
                ->values()
                ->all();

            if (!empty($categoryIds)) {
                $query->whereIn('c.categoryId', $categoryIds);
            }
        } elseif ($request->filled('categoryId')) {
            $query->where('c.categoryId', (int) $request->input('categoryId'));
        }

        if ($request->has('isSpecial') && $request->input('isSpecial') !== '') {
            $query->where('c.isSpecial', $request->boolean('isSpecial') ? 1 : 0);
        }

        if ($request->input('status') !== null && $request->input('status') !== '') {
            $query->where('c.status', (int) $request->input('status'));
        }

        if ($request->filled('approvalStatus') && Schema::hasColumn('courses', 'approvalStatus')) {
            $query->where('c.approvalStatus', strtoupper((string) $request->input('approvalStatus')));
        }

        if ($request->input('publishStatus') !== null && $request->input('publishStatus') !== '') {
            if (Schema::hasColumn('courses', 'publishedFlag')) {
                $query->where('c.publishedFlag', (int) $request->input('publishStatus'));
            } else {
                $query->where('c.status', (int) $request->input('publishStatus'));
            }
        }

        if ($request->filled('createdByRole')) {
            $roleFilter = $this->normalizeRoleValue($request->input('createdByRole'));

            if ($roleFilter !== '') {
                $query->where(function ($roleQuery) use ($roleFilter) {
                    $roleQuery->whereRaw(
                        "LOWER(REPLACE(REPLACE(COALESCE(creatorRole.roleName, ''), ' ', ''), '-', '')) LIKE ?",
                        ['%' . $roleFilter . '%']
                    );

                    if (ctype_digit($roleFilter)) {
                        $roleQuery->orWhere('c.createdByRoleId', (int) $roleFilter);
                    }
                });
            }
        }

        if ($request->filled('startDate')) {
            $query->whereDate('c.startDate', '>=', $request->input('startDate'));
        }

        if ($request->filled('endDate')) {
            $lastCourseDate = DB::raw('COALESCE(c.endDate, c.startDate)');
            $query->whereDate($lastCourseDate, '<=', $request->input('endDate'));
        }

        $scheduleStatus = (string) $request->input('scheduleStatus', '');

        if ($scheduleStatus !== '' && $scheduleStatus !== 'all') {
            $this->applyOfflineCourseScheduleStatusFilter($query, $scheduleStatus);
            return;
        }

        if ($request->boolean('activeScheduleOnly')) {
            $this->applyOfflineCourseActiveScheduleFilter($query);
        }
    }

    private function applyOfflineCourseSort($query, string $sortBy)
    {
        if ($sortBy === 'oldest') {
            return $query->orderBy('c.createdOn', 'ASC')
                ->orderBy('c.id', 'ASC');
        }

        if ($sortBy === 'dateAsc') {
            return $query->orderBy('c.startDate', 'ASC')
                ->orderBy('c.startTime', 'ASC')
                ->orderBy('c.id', 'DESC');
        }

        if ($sortBy === 'dateDesc') {
            return $query->orderBy('c.startDate', 'DESC')
                ->orderBy('c.startTime', 'DESC')
                ->orderBy('c.id', 'DESC');
        }

        return $query->orderBy('c.createdOn', 'DESC')
            ->orderBy('c.id', 'DESC');
    }

    private function buildOfflineCourseSummary($summaryQuery): array
    {
        $upcomingQuery = clone $summaryQuery;
        $ongoingQuery = clone $summaryQuery;
        $completedQuery = clone $summaryQuery;

        $this->applyOfflineCourseScheduleStatusFilter($upcomingQuery, 'upcoming');
        $this->applyOfflineCourseScheduleStatusFilter($ongoingQuery, 'ongoing');
        $this->applyOfflineCourseScheduleStatusFilter($completedQuery, 'completed');

        return [
            'totalCourses' => (clone $summaryQuery)->count(),
            'activeCourses' => (clone $summaryQuery)->where('c.status', 1)->count(),
            'inactiveCourses' => (clone $summaryQuery)->where('c.status', 0)->count(),
            'upcomingCourses' => $upcomingQuery->count(),
            'ongoingCourses' => $ongoingQuery->count(),
            'completedCourses' => $completedQuery->count(),
        ];
    }

    private function applyOfflineCourseActiveScheduleFilter($query): void
    {
        $today = now()->toDateString();
        $lastCourseDate = DB::raw('COALESCE(c.endDate, c.startDate)');

        $query->whereDate($lastCourseDate, '>=', $today);
    }

    private function applyOfflineCourseScheduleStatusFilter($query, string $scheduleStatus): void
    {
        $today = now()->toDateString();
        $lastCourseDate = DB::raw('COALESCE(c.endDate, c.startDate)');

        if ($scheduleStatus === 'upcoming') {
            $query->whereDate('c.startDate', '>', $today);
            return;
        }

        if ($scheduleStatus === 'ongoing') {
            $query->whereDate('c.startDate', '<=', $today)
                ->whereDate($lastCourseDate, '>=', $today);
            return;
        }

        if ($scheduleStatus === 'completed') {
            $query->whereDate($lastCourseDate, '<', $today);
        }
    }

    private function enrolledCourseLookup(Request $request, $courseItems): array
    {
        if (!Schema::hasTable('enrollments') || !$request->user()) {
            return [];
        }

        $courseIds = collect($courseItems)
            ->pluck('id')
            ->map(fn($id) => (int) $id)
            ->filter(fn($id) => $id > 0)
            ->unique()
            ->values();

        if ($courseIds->isEmpty()) {
            return [];
        }

        return DB::table('enrollments')
            ->where('userId', (int) $request->user()->id)
            ->whereIn('courseId', $courseIds)
            ->where('deletedFlag', 0)
            ->pluck('courseId')
            ->mapWithKeys(fn($courseId) => [(int) $courseId => true])
            ->all();
    }

    private function formatOfflineCourse(object $course, $courseInstructorMap, $fallbackInstructors, array $enrolledCourseLookup = [], ?object $viewer = null): array
    {
        $relationInstructors = collect($courseInstructorMap->get($course->id, []))
            ->map(fn($instructor) => [
                'id' => (int) $instructor->instructorId,
                'name' => (string) ($instructor->name ?? 'Instructor')
            ]);

        $instructors = $relationInstructors->isNotEmpty()
            ? $relationInstructors
            : collect($this->normalizeInstructorIds($course->instructorIds ?? []))
                ->map(fn($id) => [
                    'id' => (int) $id,
                    'name' => (string) ($fallbackInstructors[(int) $id] ?? 'Instructor')
                ]);

        $startDate = $course->startDate ? (string) $course->startDate : '';
        $endDate = $course->endDate ? (string) $course->endDate : null;
        $highlights = $this->decodeCourseHighlights($course->courseHighlights ?? null);
        $thumbnail = $course->thumbnail ? (string) $course->thumbnail : null;
        $approvalStatus = strtoupper((string) ($course->approvalStatus ?? self::APPROVAL_PENDING));
        $approvalStatus = in_array($approvalStatus, [
            self::APPROVAL_PENDING,
            self::APPROVAL_APPROVED,
            self::APPROVAL_REJECTED,
        ], true)
            ? $approvalStatus
            : self::APPROVAL_PENDING;
        $publishedFlag = (int) ($course->publishedFlag ?? $course->status ?? 0) === 1 ? 1 : 0;
        $actions = $this->offlineCourseActionPermissions($course, $instructors, $viewer);

        return [
            'id' => (int) $course->id,
            'code' => $course->code ?? null,
            'title' => (string) $course->title,
            'categoryId' => $course->categoryId ? (int) $course->categoryId : null,
            'categoryName' => $course->categoryName ?: 'Uncategorized',
            'isSpecial' => (int) ($course->isSpecial ?? 0),
            'parentCourseId' => empty($course->parentCourseId ?? null) ? null : (int) $course->parentCourseId,
            'parentCourseTitle' => $course->parentCourseTitle ?? null,
            'parentCourseCode' => $course->parentCourseCode ?? null,
            'instructors' => $instructors->values()->all(),
            'instructorName' => $instructors->pluck('name')->filter()->join(', '),
            'price' => is_numeric($course->price) ? (float) $course->price : 0,
            'description' => $course->description,
            'courseHighlights' => $highlights,
            'highlights' => $highlights,
            'thumbnail' => $thumbnail,
            'thumbnailUrl' => $thumbnail ? $this->privateFileUrl(request(), $thumbnail) : null,
            'status' => (int) $course->status,
            'statusLabel' => ((int) $course->status) === 1 ? 'Active' : 'Inactive',
            'approvalStatus' => $approvalStatus,
            'approvalStatusLabel' => ucfirst(strtolower($approvalStatus)),
            'approvedBy' => $course->approvedBy ? (int) $course->approvedBy : null,
            'approvedByName' => $course->approvedByName ?? null,
            'approvedOn' => $course->approvedOn ?? null,
            'rejectedBy' => $course->rejectedBy ? (int) $course->rejectedBy : null,
            'rejectedByName' => $course->rejectedByName ?? null,
            'rejectedOn' => $course->rejectedOn ?? null,
            'rejectionReason' => $course->rejectionReason ?? null,
            'publishedFlag' => $publishedFlag,
            'publishStatus' => $publishedFlag,
            'publishStatusLabel' => $publishedFlag === 1 ? 'Published' : 'Unpublished',
            'publishedBy' => $course->publishedBy ? (int) $course->publishedBy : null,
            'publishedByName' => $course->publishedByName ?? null,
            'publishedOn' => $course->publishedOn ?? null,
            'scheduleStatus' => $this->getOfflineCourseScheduleStatus($startDate, $endDate),
            'isEnrolled' => !empty($enrolledCourseLookup[(int) $course->id]),
            'courseType' => (int) $course->courseType,
            'venue' => $course->venue,
            'city' => $course->city,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'startTime' => $this->formatOfflineCourseTime($course->startTime ?? null),
            'endTime' => $this->formatOfflineCourseTime($course->endTime ?? null),
            'youtubeLiveUrl' => $course->youtubeLiveUrl,
            'meetingLink' => $course->meetingLink,
            'createdById' => $course->createdBy ? (int) $course->createdBy : null,
            'createdByRoleId' => $course->createdByRoleId ? (int) $course->createdByRoleId : null,
            'createdByRoleName' => $course->createdByRoleName ?: 'Unknown Role',
            'createdByRole' => $course->createdByRoleName ?: 'Unknown Role',
            'createdByName' => $course->createdByName ?: 'Unknown User',
            'createdByEmail' => $course->createdByEmail,
            'createdOn' => $course->createdOn,
            'updatedOn' => $course->updatedOn,
            'actions' => $actions,
        ];
    }

    private function getOfflineCourseScheduleStatus(string $startDate, ?string $endDate): string
    {
        $courseStartDate = $startDate ? substr($startDate, 0, 10) : '';
        $lastCourseDate = $endDate ?: $startDate;
        $lastCourseDate = $lastCourseDate ? substr($lastCourseDate, 0, 10) : '';
        $today = now()->toDateString();

        if ($lastCourseDate && $lastCourseDate < $today) {
            return 'completed';
        }

        if ($courseStartDate && $courseStartDate <= $today) {
            return 'ongoing';
        }

        return 'upcoming';
    }

    private function formatOfflineCourseTime(?string $value): ?string
    {
        $time = trim((string) ($value ?? ''));

        return $time === '' ? null : substr($time, 0, 5);
    }

    public function enrollStudent(Request $request)
    {
        $request->merge([
            'paymentBy' => strtoupper(trim((string) $request->input('paymentBy', ''))),
            'phone' => preg_replace('/\D+/', '', (string) $request->input('phone', '')) ?? '',
        ]);

        $validator = Validator::make($request->all(), [
            'courseId' => 'required|integer|exists:courses,id',
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'email' => ['required', 'email', 'max:191'],
            'phone' => ['required', 'digits:10'],
            'dob' => 'required|date|before_or_equal:today',
            'gender' => ['required', Rule::in([1, 2])],
            'paymentBy' => ['required', Rule::in(['CASH', 'UPI', 'NETBANKING'])],
            'transactionNo' => 'nullable|string|max:100',
            'totalFee' => 'required|numeric|min:0',
            'amountPaid' => 'required|numeric|min:0',
            'amountBalance' => 'required|numeric|min:0',
            'paidInFull' => 'required|boolean',
            'installments' => 'nullable|array|max:4',
            'installments.*.installmentNo' => 'required_with:installments|integer|min:1|max:4',
            'installments.*.amount' => 'required_with:installments|numeric|min:0',
            'installments.*.expectedDate' => 'nullable|date',
            'installments.*.status' => ['required_with:installments', Rule::in(['PAID', 'PENDING'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        if ((int) ($request->user()->role ?? 0) !== 1) {
            return response()->json([
                'status' => false,
                'message' => 'Only admins can manually enroll offline-course students.',
            ], 403);
        }

        $requiredTables = ['orders', 'payments', 'order_items', 'enrollments', 'payment_logs', 'invoices'];
        $missingTables = array_values(array_filter(
            $requiredTables,
            fn(string $table): bool => !Schema::hasTable($table)
        ));

        if (!empty($missingTables)) {
            return response()->json([
                'status' => false,
                'message' => 'Payment tables are missing: ' . implode(', ', $missingTables),
            ], 500);
        }

        $totalFee = $this->offlineEnrollmentMoney($request->input('totalFee'));
        $amountPaid = $this->offlineEnrollmentMoney($request->input('amountPaid'));
        $amountBalance = $this->offlineEnrollmentMoney($request->input('amountBalance'));
        $paidInFull = filter_var($request->input('paidInFull'), FILTER_VALIDATE_BOOLEAN);
        $paymentBy = (string) $request->input('paymentBy');
        $transactionNo = trim((string) $request->input('transactionNo', '')) ?: null;
        $installments = $this->normalizeOfflineEnrollmentInstallments($request->input('installments', []));
        $amountErrors = $this->validateOfflineEnrollmentAmounts(
            $totalFee,
            $amountPaid,
            $amountBalance,
            $paidInFull,
            $installments
        );

        if (!empty($amountErrors)) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $amountErrors,
            ], 422);
        }

        if ($paymentBy !== 'CASH' && $transactionNo === null) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'transactionNo' => ['Transaction no is required for UPI and Netbanking payments.'],
                ],
            ], 422);
        }

        if ($amountBalance > 0 && !Schema::hasTable('offline_course_installments')) {
            return response()->json([
                'status' => false,
                'message' => 'Offline course installment table is missing. Please run the offline enrollment SQL first.',
            ], 500);
        }

        DB::beginTransaction();

        try {
            $course = DB::table('courses')
                ->where('id', (int) $request->input('courseId'))
                ->where('courseType', 2)
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->first();

            if (!$course) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Offline course not found',
                ], 404);
            }

            $courseCode = EntityCodeService::assignIfMissing(
                'courses',
                (int) $course->id,
                EntityCodeService::PREFIX_ACADEMIC_COURSE
            ) ?? ($course->code ?? null);
            $course->code = $courseCode;
            $courseFee = $this->offlineEnrollmentMoney($course->price ?? 0);

            if (abs($courseFee - $totalFee) > 0.01) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Total fee does not match the selected offline course fee.',
                    'errors' => [
                        'totalFee' => ['Total fee does not match the selected offline course fee.'],
                    ],
                ], 422);
            }

            $email = strtolower(trim((string) $request->input('email')));
            $phone = (string) $request->input('phone');
            $student = DB::table('users')
                ->where('email', $email)
                ->where('userType', 1)
                ->where('role', 2)
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->first();

            if ($student) {
                $studentId = (int) $student->id;

                if (trim((string) ($student->phone ?? '')) === '') {
                    DB::table('users')
                        ->where('id', $studentId)
                        ->update($this->filterExistingColumns('users', [
                            'phone' => $phone,
                            'updated_at' => now(),
                        ]));
                }
            } else {
                $studentId = DB::table('users')->insertGetId($this->filterExistingColumns('users', [
                    'name' => trim((string) $request->input('name')),
                    'email' => $email,
                    'phone' => $phone,
                    'dob' => $request->input('dob'),
                    'gender' => (int) $request->input('gender'),
                    'userType' => 1,
                    'role' => 2,
                    'status' => 1,
                    'deletedFlag' => 0,
                    'createdOn' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
            }

            $studentPhone = trim((string) ($student->phone ?? '')) ?: $phone;
            EntityCodeService::assignIfMissing('users', $studentId, EntityCodeService::PREFIX_LEARNER);

            $alreadyEnrolled = DB::table('enrollments')
                ->where('userId', $studentId)
                ->where('courseId', (int) $course->id)
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->exists();

            if ($alreadyEnrolled) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Student is already enrolled in this offline course.',
                ], 409);
            }

            $paymentStatus = $amountBalance <= 0 ? 'PAID' : 'PARTIAL';
            $referenceNo = $this->offlineEnrollmentReference('OFFPAY');
            $orderId = DB::table('orders')->insertGetId([
                'userId' => $studentId,
                'orderReference' => $this->offlineEnrollmentReference('OFFORD'),
                'subtotalAmount' => $amountPaid,
                'taxAmount' => 0,
                'totalAmount' => $amountPaid,
                'currency' => 'INR',
                'status' => 'paid',
                'razorpayOrderId' => null,
                'expiresAt' => null,
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('order_items')->insert([
                'orderId' => $orderId,
                'courseId' => (int) $course->id,
                'price' => $amountPaid,
                'taxAmount' => 0,
                'totalAmount' => $amountPaid,
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $paymentId = DB::table('payments')->insertGetId([
                'orderId' => $orderId,
                'userId' => $studentId,
                'paymentReference' => $referenceNo,
                'razorpayPaymentId' => null,
                'razorpayOrderId' => null,
                'razorpaySignature' => null,
                'amount' => $amountPaid,
                'taxAmount' => 0,
                'totalAmount' => $amountPaid,
                'currency' => 'INR',
                'paymentMethod' => $paymentBy,
                'status' => 'success',
                'failureReason' => null,
                'paidAt' => $amountPaid > 0 ? now() : null,
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $enrollmentId = DB::table('enrollments')->insertGetId([
                'userId' => $studentId,
                'courseId' => (int) $course->id,
                'orderId' => $orderId,
                'paymentId' => $paymentId,
                'status' => 'active',
                'progressPercent' => 0,
                'lastWatchedAt' => null,
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $invoiceId = DB::table('invoices')->insertGetId($this->filterExistingColumns('invoices', [
                'userId' => $studentId,
                'orderId' => $orderId,
                'paymentId' => $paymentId,
                'entityType' => 'Academic Course',
                'entityId' => (int) $course->id,
                'entityCode' => $courseCode,
                'entityTitle' => (string) $course->title,
                'invoiceNumber' => $this->offlineEnrollmentReference('OFFINV'),
                'invoiceDate' => now()->toDateString(),
                'customerName' => $student ? $student->name : trim((string) $request->input('name')),
                'customerEmail' => $email,
                'customerPhone' => $studentPhone,
                'gstNumber' => null,
                'subtotal' => $amountPaid,
                'tax' => 0,
                'grandTotal' => $amountPaid,
                'currency' => 'INR',
                'paymentReference' => $transactionNo ?: $referenceNo,
                'pdfPath' => null,
                'invoiceData' => null,
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]));

            $invoiceNumber = $this->offlineEnrollmentInvoiceNumber($invoiceId);
            $invoiceData = $this->offlineEnrollmentInvoiceData(
                $invoiceNumber,
                $orderId,
                $paymentId,
                $studentId,
                $course,
                $request,
                $studentPhone,
                $totalFee,
                $amountPaid,
                $amountBalance,
                $paymentStatus,
                $paymentBy,
                $transactionNo,
                $referenceNo,
                $installments
            );

            DB::table('invoices')->where('id', $invoiceId)->update([
                'invoiceNumber' => $invoiceNumber,
                'invoiceData' => json_encode($invoiceData),
                'updated_at' => now(),
            ]);

            $responseData = [
                'enrollmentId' => $enrollmentId,
                'userId' => $studentId,
                'courseId' => (int) $course->id,
                'courseCode' => $courseCode,
                'invoiceNumber' => $invoiceNumber,
                'paymentStatus' => $paymentStatus,
                'paymentBy' => $paymentBy,
                'transactionNo' => $transactionNo,
            ];

            $paymentLogId = DB::table('payment_logs')->insertGetId($this->filterExistingColumns('payment_logs', [
                'userId' => $studentId,
                'orderId' => $orderId,
                'paymentId' => $paymentId,
                'courseId' => (int) $course->id,
                'enrollmentId' => $enrollmentId,
                'entityType' => 'Academic Course',
                'entityId' => (int) $course->id,
                'entityCode' => $courseCode,
                'entityTitle' => (string) $course->title,
                'eventType' => 'offline.manual_enrollment',
                'gateway' => 'offline',
                'status' => $paymentStatus,
                'totalFee' => $totalFee,
                'amountPaid' => $amountPaid,
                'amount' => $amountPaid,
                'amountBalance' => $amountBalance,
                'paymentMode' => 'OFFLINE',
                'paymentBy' => $paymentBy,
                'paymentStatus' => $paymentStatus,
                'invoiceNumber' => $invoiceNumber,
                'referenceNo' => $referenceNo,
                'transactionNo' => $transactionNo,
                'createdBy' => (int) $request->user()->id,
                'requestPayload' => json_encode($request->all()),
                'responsePayload' => json_encode($responseData),
                'verificationResult' => json_encode([
                    'source' => 'manual_offline_enrollment',
                    'paidInFull' => $paidInFull,
                    'paymentBy' => $paymentBy,
                    'transactionNo' => $transactionNo,
                    'installmentCount' => count($installments),
                ]),
                'webhookPayload' => null,
                'errorStack' => null,
                'ipAddress' => $request->ip(),
                'browserInfo' => $request->userAgent(),
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]));

            if ($amountBalance > 0) {
                foreach ($installments as $installment) {
                    DB::table('offline_course_installments')->insert($this->filterExistingColumns('offline_course_installments', [
                        'paymentLogId' => $paymentLogId,
                        'userId' => $studentId,
                        'courseId' => (int) $course->id,
                        'enrollmentId' => $enrollmentId,
                        'installmentNo' => (int) $installment['installmentNo'],
                        'amount' => $installment['amount'],
                        'paidAmount' => $installment['status'] === 'PAID' ? $installment['amount'] : 0,
                        'balanceAmount' => $installment['status'] === 'PAID' ? 0 : $installment['amount'],
                        'paymentStatus' => $installment['status'],
                        'expectedDate' => $installment['expectedDate'],
                        'paidDate' => $installment['status'] === 'PAID' ? now()->toDateString() : null,
                        'paymentDate' => $installment['status'] === 'PAID' ? now()->toDateString() : null,
                        'paymentBy' => $installment['status'] === 'PAID' ? $paymentBy : null,
                        'paymentType' => $installment['status'] === 'PAID' ? $paymentBy : null,
                        'transactionNo' => $installment['status'] === 'PAID' ? $transactionNo : null,
                        'invoiceId' => $installment['status'] === 'PAID' ? $invoiceId : null,
                        'status' => $installment['status'],
                        'deletedFlag' => 0,
                        'createdOn' => now(),
                        'updatedOn' => null,
                    ]));
                }
            }

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Student enrolled successfully',
                'data' => $responseData,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error enrolling offline course student: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function normalizeOfflineEnrollmentInstallments(mixed $installments): array
    {
        if (!is_array($installments)) {
            return [];
        }

        $rows = collect($installments)
            ->map(function ($installment, int $index): array {
                $item = is_array($installment) ? $installment : [];
                $status = strtoupper((string) ($item['status'] ?? 'PENDING'));

                return [
                    'installmentNo' => (int) ($item['installmentNo'] ?? ($index + 1)),
                    'amount' => $this->offlineEnrollmentMoney($item['amount'] ?? 0),
                    'expectedDate' => trim((string) ($item['expectedDate'] ?? '')) ?: null,
                    'status' => in_array($status, ['PAID', 'PENDING'], true) ? $status : 'PENDING',
                ];
            })
            ->values()
            ->all();

        return collect($rows)
            ->sortBy(fn(array $row): string => ($row['status'] === 'PAID' ? '0' : '1') . '-' . str_pad((string) $row['installmentNo'], 2, '0', STR_PAD_LEFT))
            ->values()
            ->map(fn(array $row, int $index): array => array_merge($row, [
                'installmentNo' => $index + 1,
            ]))
            ->all();
    }

    private function validateOfflineEnrollmentAmounts(
        float $totalFee,
        float $amountPaid,
        float $amountBalance,
        bool $paidInFull,
        array $installments
    ): array {
        $errors = [];
        $expectedBalance = $this->offlineEnrollmentMoney(max($totalFee - $amountPaid, 0));

        if ($amountPaid > $totalFee) {
            $errors['amountPaid'][] = 'Amount paid cannot be greater than total fee.';
        }

        if (abs($expectedBalance - $amountBalance) > 0.01) {
            $errors['amountBalance'][] = 'Amount balance must equal total fee minus amount paid.';
        }

        if ($paidInFull && ($amountPaid !== $totalFee || $amountBalance !== 0.0)) {
            $errors['paidInFull'][] = 'Paid in full requires amount paid to equal total fee and balance to be zero.';
        }

        if ($amountBalance <= 0) {
            return $errors;
        }

        if (count($installments) === 0) {
            $errors['installments'][] = 'Installment section is required when balance amount is greater than zero.';
            return $errors;
        }

        if (count($installments) > 4) {
            $errors['installments'][] = 'Installments cannot be greater than 4.';
        }

        $paidRows = array_values(array_filter(
            $installments,
            fn(array $installment): bool => $installment['status'] === 'PAID'
        ));
        $pendingRows = array_values(array_filter(
            $installments,
            fn(array $installment): bool => $installment['status'] === 'PENDING'
        ));
        $paidTotal = $this->offlineEnrollmentMoney(array_sum(array_column($paidRows, 'amount')));
        $pendingTotal = $this->offlineEnrollmentMoney(array_sum(array_column($pendingRows, 'amount')));

        if (count($pendingRows) === 0) {
            $errors['installments'][] = 'At least one pending installment is required when balance amount is greater than zero.';
        }

        if (abs($paidTotal - $amountPaid) > 0.01) {
            $errors['installments'][] = 'Paid installment amount must equal the amount paid.';
        }

        if (abs($pendingTotal - $amountBalance) > 0.01) {
            $errors['installments'][] = 'Pending installment amounts must equal the amount balance.';
        }

        foreach ($pendingRows as $index => $installment) {
            if (empty($installment['expectedDate'])) {
                $errors["installments.$index.expectedDate"][] = 'Expected date is required for pending installments.';
            }
        }

        return $errors;
    }

    private function offlineEnrollmentMoney(mixed $value): float
    {
        return round((float) $value, 2);
    }

    private function offlineEnrollmentReference(string $prefix): string
    {
        return $prefix . '-' . now()->format('YmdHis') . '-' . strtoupper(bin2hex(random_bytes(4)));
    }

    private function offlineEnrollmentInvoiceNumber(int $invoiceId): string
    {
        return 'ICETL-OFFLINE-' . now()->format('Ymd') . '-' . str_pad((string) $invoiceId, 6, '0', STR_PAD_LEFT);
    }

    private function offlineEnrollmentInvoiceData(
        string $invoiceNumber,
        int $orderId,
        int $paymentId,
        int $studentId,
        object $course,
        Request $request,
        string $studentPhone,
        float $totalFee,
        float $amountPaid,
        float $amountBalance,
        string $paymentStatus,
        string $paymentBy,
        ?string $transactionNo,
        string $referenceNo,
        array $installments
    ): array {
        return [
            'invoiceNo' => $invoiceNumber,
            'orderId' => $orderId,
            'paymentId' => $paymentId,
            'studentId' => $studentId,
            'invoiceDate' => now()->toDateString(),
            'status' => 'paid',
            'paymentStatus' => $paymentStatus,
            'paymentMode' => 'OFFLINE',
            'paymentBy' => $paymentBy,
            'transactionNo' => $transactionNo,
            'paymentReference' => $transactionNo ?: $referenceNo,
            'currency' => 'INR',
            'customer' => [
                'name' => trim((string) $request->input('name')),
                'email' => strtolower(trim((string) $request->input('email'))),
                'phone' => $studentPhone,
                'dob' => $request->input('dob'),
                'gender' => (int) $request->input('gender'),
            ],
            'company' => [
                'name' => 'ICETL',
                'subtitle' => 'Ice Technology Lab',
                'email' => 'support@icetl.com',
            ],
            'items' => [
                [
                    'courseId' => (int) $course->id,
                    'code' => $course->code ?? null,
                    'entityType' => 'Academic Course',
                    'entityCode' => $course->code ?? null,
                    'entityTitle' => (string) $course->title,
                    'title' => (string) $course->title,
                    'categoryName' => $course->categoryName ?? 'Offline Course',
                    'courseTotalFee' => $totalFee,
                    'price' => $amountPaid,
                    'taxAmount' => 0,
                    'totalAmount' => $amountPaid,
                ],
            ],
            'totalFee' => $totalFee,
            'courseTotalFee' => $totalFee,
            'subtotal' => $amountPaid,
            'tax' => 0,
            'totalAmount' => $amountPaid,
            'amountPaid' => $amountPaid,
            'amountBalance' => $amountBalance,
            'installments' => $installments,
        ];
    }

    private function filterExistingColumns(string $table, array $payload): array
    {
        static $columnsByTable = [];

        if (!isset($columnsByTable[$table])) {
            $columnsByTable[$table] = array_flip(Schema::getColumnListing($table));
        }

        return array_intersect_key($payload, $columnsByTable[$table]);
    }

    public function getOfflineCourseEnrolledStudents(Request $request)
    {
        if ((int) ($request->user()->role ?? 0) !== 1) {
            return response()->json([
                'status' => false,
                'message' => 'Only admins can view offline-course student payments.',
            ], 403);
        }

        if ($schemaResponse = $this->offlineStudentLedgerSchemaResponse()) {
            return $schemaResponse;
        }

        $validator = Validator::make($request->all(), [
            'page' => 'nullable|integer|min:1',
            'perPage' => [
                'nullable',
                function ($attribute, $value, $fail) {
                    if ($value === null || $value === '' || $value === 'all') {
                        return;
                    }

                    if (
                        !filter_var($value, FILTER_VALIDATE_INT)
                        || !in_array((int) $value, [10, 20, 50, 100], true)
                    ) {
                        $fail('The per page value must be 10, 20, 50, 100, or all.');
                    }
                },
            ],
            'search' => 'nullable|string|max:100',
            'courseId' => 'nullable|integer|min:1',
            'courseCode' => 'nullable|string|max:40',
            'paymentStatus' => 'nullable|in:PAID,PARTIAL',
            'installmentStatus' => 'nullable|in:all,pending,paid,overdue,none',
            'sortBy' => 'nullable|in:nextInstallment,newest,paidDesc,balanceDesc',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $query = $this->baseOfflineCourseStudentQuery();
            $this->applyOfflineCourseStudentFilters($query, $request);

            $summaryQuery = clone $query;
            $summary = $this->buildOfflineCourseStudentSummary($summaryQuery);

            $page = (int) $request->input('page', 1);
            $isAllPageSize = $request->input('perPage') === 'all';
            $filteredTotal = (clone $query)->count();
            $perPage = $isAllPageSize
                ? max($filteredTotal, 1)
                : (int) $request->input('perPage', 10);

            $students = $this->applyOfflineCourseStudentSort(
                $query->select($this->offlineCourseStudentSelectColumns()),
                (string) $request->input('sortBy', 'nextInstallment')
            )->paginate($perPage, ['*'], 'page', $page);

            $studentItems = collect($students->items());
            $paymentLogIds = $studentItems
                ->pluck('paymentLogId')
                ->map(fn($id) => (int) $id)
                ->filter(fn($id) => $id > 0)
                ->unique()
                ->values();
            $installmentMap = $this->offlineCourseInstallmentsByPaymentLogIds($paymentLogIds);

            $data = $studentItems
                ->map(fn($row) => $this->formatOfflineCourseStudentRow($row, $installmentMap))
                ->values();

            return response()->json([
                'status' => true,
                'message' => 'Offline course enrolled students fetched successfully',
                'data' => $data,
                'meta' => [
                    'currentPage' => $students->currentPage(),
                    'perPage' => $isAllPageSize ? 'all' : $students->perPage(),
                    'total' => $students->total(),
                    'lastPage' => $students->lastPage(),
                    'from' => $students->firstItem(),
                    'to' => $students->lastItem(),
                ],
                'summary' => $summary,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching offline course enrolled students: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateOfflineCourseInstallments(Request $request)
    {
        if ((int) ($request->user()->role ?? 0) !== 1) {
            return response()->json([
                'status' => false,
                'message' => 'Only admins can update offline-course installments.',
            ], 403);
        }

        if ($schemaResponse = $this->offlineStudentLedgerSchemaResponse()) {
            return $schemaResponse;
        }

        $validator = Validator::make($request->all(), [
            'paymentLogId' => 'required|integer|min:1',
            'installments' => 'required|array|min:1|max:4',
            'installments.*.id' => 'nullable|integer|min:1',
            'installments.*.installmentNo' => 'required|integer|min:1|max:4',
            'installments.*.amount' => 'required|numeric|min:0',
            'installments.*.expectedDate' => 'nullable|date',
            'installments.*.paidDate' => 'nullable|date',
            'installments.*.paymentBy' => ['nullable', Rule::in(array_merge($this->offlineInstallmentPaymentTypes(), ['NETBANKING']))],
            'installments.*.transactionNo' => 'nullable|string|max:100',
            'installments.*.status' => ['required', Rule::in(['PAID', 'PENDING'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();

        try {
            $paymentLogId = (int) $request->input('paymentLogId');
            $paymentLog = DB::table('payment_logs')
                ->where('id', $paymentLogId)
                ->where('eventType', 'offline.manual_enrollment')
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->first();

            if (!$paymentLog) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Offline enrollment payment record not found.',
                ], 404);
            }

            $course = DB::table('courses')
                ->where('id', (int) $paymentLog->courseId)
                ->where('courseType', 2)
                ->where('deletedFlag', 0)
                ->first();

            if (!$course) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Offline course not found.',
                ], 404);
            }

            $existingInstallments = DB::table('offline_course_installments')
                ->where('paymentLogId', $paymentLogId)
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $installments = $this->normalizeOfflineCourseInstallmentUpdateRows(
                $request->input('installments', [])
            );
            $totalFee = $this->offlineEnrollmentMoney($paymentLog->totalFee ?? $course->price ?? 0);
            $validationErrors = $this->validateOfflineCourseInstallmentUpdateRows(
                $installments,
                $existingInstallments,
                $totalFee
            );

            if (!empty($validationErrors)) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Validation failed',
                    'errors' => $validationErrors,
                ], 422);
            }

            $paidTotal = $this->offlineEnrollmentMoney(
                collect($installments)
                    ->filter(fn(array $row): bool => $row['status'] === 'PAID')
                    ->sum('amount')
            );
            $amountBalance = $this->offlineEnrollmentMoney(max($totalFee - $paidTotal, 0));
            $paymentStatus = $amountBalance <= 0 ? 'PAID' : 'PARTIAL';

            DB::table('offline_course_installments')
                ->where('paymentLogId', $paymentLogId)
                ->update([
                    'deletedFlag' => 1,
                    'updatedOn' => now(),
                ]);

            foreach ($installments as $installment) {
                $existing = $installment['id']
                    ? $existingInstallments->get($installment['id'])
                    : null;
                $paidDate = $installment['status'] === 'PAID'
                    ? ($installment['paidDate'] ?: ($existing->paidDate ?? now()->toDateString()))
                    : null;
                $paidAmount = $installment['status'] === 'PAID' ? $installment['amount'] : 0;
                $balanceAmount = $installment['status'] === 'PAID' ? 0 : $installment['amount'];
                $payload = $this->filterExistingColumns('offline_course_installments', [
                    'paymentLogId' => $paymentLogId,
                    'userId' => (int) $paymentLog->userId,
                    'courseId' => (int) $paymentLog->courseId,
                    'enrollmentId' => $existing->enrollmentId ?? null,
                    'installmentNo' => (int) $installment['installmentNo'],
                    'amount' => $installment['amount'],
                    'paidAmount' => $paidAmount,
                    'balanceAmount' => $balanceAmount,
                    'paymentStatus' => $installment['status'],
                    'expectedDate' => $installment['expectedDate'],
                    'paidDate' => $paidDate,
                    'paymentDate' => $paidDate,
                    'paymentBy' => $installment['status'] === 'PAID' ? $installment['paymentBy'] : null,
                    'paymentType' => $installment['status'] === 'PAID' ? $installment['paymentBy'] : null,
                    'transactionNo' => $installment['status'] === 'PAID' ? $installment['transactionNo'] : null,
                    'status' => $installment['status'],
                    'deletedFlag' => 0,
                    'updatedOn' => now(),
                ]);

                if ($existing) {
                    DB::table('offline_course_installments')
                        ->where('id', (int) $existing->id)
                        ->update($payload);
                } else {
                    DB::table('offline_course_installments')->insert(array_merge($payload, [
                        'createdOn' => now(),
                    ]));
                }
            }

            $savedInstallments = DB::table('offline_course_installments')
                ->where('paymentLogId', $paymentLogId)
                ->where('deletedFlag', 0)
                ->orderBy('installmentNo')
                ->get()
                ->map(fn($row) => $this->formatOfflineInstallmentForResponse($row))
                ->values()
                ->all();
            $latestPaidInstallment = collect($savedInstallments)
                ->filter(fn(array $row): bool => $row['status'] === 'PAID')
                ->sortByDesc(fn(array $row): string => ($row['paidDate'] ?? '') . '-' . str_pad((string) ($row['installmentNo'] ?? 0), 4, '0', STR_PAD_LEFT))
                ->first();
            $latestPaymentBy = is_array($latestPaidInstallment)
                ? ($latestPaidInstallment['paymentBy'] ?? null)
                : ($paymentLog->paymentBy ?? null);
            $latestTransactionNo = is_array($latestPaidInstallment)
                ? ($latestPaidInstallment['transactionNo'] ?? null)
                : ($paymentLog->transactionNo ?? null);

            DB::table('payment_logs')
                ->where('id', $paymentLogId)
                ->update($this->filterExistingColumns('payment_logs', [
                    'status' => $paymentStatus,
                    'amountPaid' => $paidTotal,
                    'amountBalance' => $amountBalance,
                    'paymentBy' => $latestPaymentBy,
                    'paymentStatus' => $paymentStatus,
                    'transactionNo' => $latestTransactionNo,
                    'responsePayload' => json_encode([
                        'userId' => (int) $paymentLog->userId,
                        'courseId' => (int) $paymentLog->courseId,
                        'paymentStatus' => $paymentStatus,
                        'paymentBy' => $latestPaymentBy,
                        'transactionNo' => $latestTransactionNo,
                        'amountPaid' => $paidTotal,
                        'amountBalance' => $amountBalance,
                    ]),
                    'verificationResult' => json_encode([
                        'source' => 'manual_offline_installment_update',
                        'updatedBy' => (int) $request->user()->id,
                        'installmentCount' => count($savedInstallments),
                    ]),
                    'updated_at' => now(),
                ]));

            if ((int) ($paymentLog->paymentId ?? 0) > 0) {
                DB::table('payments')
                    ->where('id', (int) $paymentLog->paymentId)
                    ->update([
                        'amount' => $paidTotal,
                        'totalAmount' => $paidTotal,
                        'paymentMethod' => $latestPaymentBy,
                        'status' => $paidTotal > 0 ? 'success' : 'pending',
                        'paidAt' => $paidTotal > 0 ? now() : null,
                        'updated_at' => now(),
                    ]);
            }

            if ((int) ($paymentLog->orderId ?? 0) > 0) {
                DB::table('orders')
                    ->where('id', (int) $paymentLog->orderId)
                    ->update([
                        'status' => 'paid',
                        'updated_at' => now(),
                    ]);

                $invoice = DB::table('invoices')
                    ->where('orderId', (int) $paymentLog->orderId)
                    ->where('deletedFlag', 0)
                    ->first();

                if ($invoice) {
                    $invoiceData = json_decode((string) ($invoice->invoiceData ?? ''), true);
                    $invoiceData = is_array($invoiceData) ? $invoiceData : [];
                    $invoiceData['paymentStatus'] = $paymentStatus;
                    $invoiceData['paymentBy'] = $latestPaymentBy;
                    $invoiceData['transactionNo'] = $latestTransactionNo;
                    $invoiceData['paymentReference'] = $latestTransactionNo ?: ($invoiceData['paymentReference'] ?? $paymentLog->referenceNo ?? null);
                    $invoiceData['amountPaid'] = $paidTotal;
                    $invoiceData['amountBalance'] = $amountBalance;
                    $invoiceData['installments'] = $savedInstallments;

                    DB::table('invoices')
                        ->where('id', (int) $invoice->id)
                        ->update([
                            'invoiceData' => json_encode($invoiceData),
                            'updated_at' => now(),
                        ]);
                }
            }

            DB::table('enrollments')
                ->where('userId', (int) $paymentLog->userId)
                ->where('courseId', (int) $paymentLog->courseId)
                ->where('deletedFlag', 0)
                ->update(['updated_at' => now()]);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Installments updated successfully',
                'data' => [
                    'paymentLogId' => $paymentLogId,
                    'paymentStatus' => $paymentStatus,
                    'totalFee' => $totalFee,
                    'amountPaid' => $paidTotal,
                    'amountBalance' => $amountBalance,
                    'installments' => $savedInstallments,
                ],
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating offline course installments: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function payOfflineCourseInstallment(Request $request)
    {
        if ((int) ($request->user()->role ?? 0) !== 1) {
            return response()->json([
                'status' => false,
                'message' => 'Only admins can collect offline-course installments.',
            ], 403);
        }

        if ($schemaResponse = $this->offlineInstallmentPaymentSchemaResponse()) {
            return $schemaResponse;
        }

        $request->merge([
            'paymentType' => $this->normalizeOfflineInstallmentPaymentType($request->input('paymentType'))
                ?: strtoupper(str_replace(' ', '_', trim((string) $request->input('paymentType', '')))),
        ]);

        $validator = Validator::make($request->all(), [
            'enrollmentId' => 'required|integer|min:1',
            'installmentId' => 'required|integer|min:1',
            'paymentDate' => 'required|date',
            'paymentType' => ['required', Rule::in($this->offlineInstallmentPaymentTypes())],
            'transactionNo' => 'nullable|string|max:100',
            'amountPaid' => 'required|numeric|min:0.01',
            'remarks' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $paymentType = (string) $request->input('paymentType');
        $transactionNo = trim((string) $request->input('transactionNo', '')) ?: null;

        if ($paymentType !== 'CASH' && $transactionNo === null) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'transactionNo' => ['Transaction no is required for non-cash installment payments.'],
                ],
            ], 422);
        }

        DB::beginTransaction();

        try {
            $enrollmentId = (int) $request->input('enrollmentId');
            $installmentId = (int) $request->input('installmentId');
            $amountPaidNow = $this->offlineEnrollmentMoney($request->input('amountPaid'));
            $paymentDate = substr((string) $request->input('paymentDate'), 0, 10);
            $remarks = trim((string) $request->input('remarks', '')) ?: null;

            $enrollment = DB::table('enrollments as e')
                ->join('users as student', 'student.id', '=', 'e.userId')
                ->join('courses as c', 'c.id', '=', 'e.courseId')
                ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
                ->where('e.id', $enrollmentId)
                ->where('e.deletedFlag', 0)
                ->where('student.deletedFlag', 0)
                ->where('c.deletedFlag', 0)
                ->where('c.courseType', 2)
                ->lockForUpdate()
                ->select(
                    'e.id as enrollmentId',
                    'e.userId',
                    'e.courseId',
                    'e.orderId',
                    'e.paymentId',
                    'student.name as studentName',
                    'student.email as studentEmail',
                    'student.phone as studentPhone',
                    EntityCodeService::codeSelect('courses', 'c'),
                    'c.title as courseTitle',
                    'c.price as coursePrice',
                    'cc.categoryName as categoryName'
                )
                ->first();

            if (!$enrollment) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Offline course enrollment not found.',
                ], 404);
            }
            $enrollment->code = EntityCodeService::assignIfMissing(
                'courses',
                (int) $enrollment->courseId,
                EntityCodeService::PREFIX_ACADEMIC_COURSE
            ) ?? ($enrollment->code ?? null);

            $installment = DB::table('offline_course_installments')
                ->where('id', $installmentId)
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->first();

            if (!$installment) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Installment row not found.',
                ], 404);
            }

            if (
                (int) $installment->userId !== (int) $enrollment->userId
                || (int) $installment->courseId !== (int) $enrollment->courseId
                || (!empty($installment->enrollmentId) && (int) $installment->enrollmentId !== $enrollmentId)
            ) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Installment does not belong to the selected enrollment.',
                ], 422);
            }

            $paymentLog = DB::table('payment_logs')
                ->where('id', (int) $installment->paymentLogId)
                ->where('eventType', 'offline.manual_enrollment')
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->first();

            if (!$paymentLog) {
                $paymentLog = DB::table('payment_logs')
                    ->where('userId', (int) $enrollment->userId)
                    ->where('courseId', (int) $enrollment->courseId)
                    ->where('paymentId', (int) $enrollment->paymentId)
                    ->where('eventType', 'offline.manual_enrollment')
                    ->where('deletedFlag', 0)
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->first();
            }

            if (!$paymentLog) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Original offline enrollment payment record not found.',
                ], 404);
            }

            $formattedInstallment = $this->formatOfflineInstallmentForResponse($installment);
            $installmentAmount = $this->offlineEnrollmentMoney($formattedInstallment['amount'] ?? 0);
            $paidSoFar = $this->offlineEnrollmentMoney($formattedInstallment['paidAmount'] ?? 0);
            $balanceBefore = $this->offlineEnrollmentMoney($formattedInstallment['balanceAmount'] ?? 0);
            $currentPaymentStatus = strtoupper((string) ($formattedInstallment['paymentStatus'] ?? 'PENDING'));

            if ($currentPaymentStatus === 'PAID' || $balanceBefore <= 0.01) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'This installment is already fully paid.',
                ], 409);
            }

            if ($amountPaidNow - $balanceBefore > 0.01) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Validation failed',
                    'errors' => [
                        'amountPaid' => ['Amount paid cannot be greater than the pending installment balance.'],
                    ],
                ], 422);
            }

            $newPaidAmount = $this->offlineEnrollmentMoney(min($installmentAmount, $paidSoFar + $amountPaidNow));
            $newBalanceAmount = $this->offlineEnrollmentMoney(max($installmentAmount - $newPaidAmount, 0));
            $newPaymentStatus = $newBalanceAmount <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';
            $displayInstallmentNo = $this->offlineInstallmentDisplayNumberForPaymentLog(
                (int) $installment->paymentLogId,
                $installmentId
            ) ?: (int) $installment->installmentNo;
            $referenceNo = $this->offlineEnrollmentReference('OFFINSTPAY');

            $orderId = DB::table('orders')->insertGetId([
                'userId' => (int) $enrollment->userId,
                'orderReference' => $this->offlineEnrollmentReference('OFFINSTORD'),
                'subtotalAmount' => $amountPaidNow,
                'taxAmount' => 0,
                'totalAmount' => $amountPaidNow,
                'currency' => 'INR',
                'status' => 'paid',
                'razorpayOrderId' => null,
                'expiresAt' => null,
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('order_items')->insert([
                'orderId' => $orderId,
                'courseId' => (int) $enrollment->courseId,
                'price' => $amountPaidNow,
                'taxAmount' => 0,
                'totalAmount' => $amountPaidNow,
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $paymentId = DB::table('payments')->insertGetId([
                'orderId' => $orderId,
                'userId' => (int) $enrollment->userId,
                'paymentReference' => $referenceNo,
                'razorpayPaymentId' => null,
                'razorpayOrderId' => null,
                'razorpaySignature' => null,
                'amount' => $amountPaidNow,
                'taxAmount' => 0,
                'totalAmount' => $amountPaidNow,
                'currency' => 'INR',
                'paymentMethod' => $paymentType,
                'status' => 'success',
                'failureReason' => null,
                'paidAt' => now(),
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $invoiceId = null;
            $invoiceNumber = null;
            $invoice = null;

            if ($newPaymentStatus === 'PAID') {
                $invoiceId = DB::table('invoices')->insertGetId($this->filterExistingColumns('invoices', [
                    'userId' => (int) $enrollment->userId,
                    'orderId' => $orderId,
                    'paymentId' => $paymentId,
                    'enrollmentId' => $enrollmentId,
                    'courseId' => (int) $enrollment->courseId,
                    'installmentId' => $installmentId,
                    'invoiceType' => 'Course Installment',
                    'entityType' => 'Academic Course',
                    'entityId' => (int) $enrollment->courseId,
                    'entityCode' => $enrollment->code ?? null,
                    'entityTitle' => (string) $enrollment->courseTitle,
                    'invoiceAmount' => $amountPaidNow,
                    'paymentType' => $paymentType,
                    'transactionNo' => $transactionNo,
                    'paymentDate' => $paymentDate,
                    'invoiceStatus' => 'PAID',
                    'createdBy' => (int) $request->user()->id,
                    'invoiceNumber' => $this->offlineEnrollmentReference('OFFINSTINV'),
                    'invoiceDate' => now()->toDateString(),
                    'customerName' => $enrollment->studentName,
                    'customerEmail' => $enrollment->studentEmail,
                    'customerPhone' => $enrollment->studentPhone,
                    'gstNumber' => null,
                    'subtotal' => $amountPaidNow,
                    'tax' => 0,
                    'grandTotal' => $amountPaidNow,
                    'currency' => 'INR',
                    'paymentReference' => $transactionNo ?: $referenceNo,
                    'pdfPath' => null,
                    'invoiceData' => null,
                    'deletedFlag' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));

                $invoiceNumber = $this->offlineInstallmentInvoiceNumber($invoiceId);
                $invoiceInstallment = clone $installment;
                $invoiceInstallment->installmentNo = $displayInstallmentNo;
                $invoiceData = $this->offlineInstallmentInvoiceData(
                    $invoiceNumber,
                    $orderId,
                    $paymentId,
                    $enrollment,
                    $invoiceInstallment,
                    $installmentAmount,
                    $amountPaidNow,
                    $newPaidAmount,
                    $newBalanceAmount,
                    $paymentType,
                    $transactionNo,
                    $referenceNo,
                    $paymentDate,
                    $remarks
                );

                DB::table('invoices')
                    ->where('id', $invoiceId)
                    ->update($this->filterExistingColumns('invoices', [
                        'invoiceNumber' => $invoiceNumber,
                        'entityType' => 'Academic Course',
                        'entityId' => (int) $enrollment->courseId,
                        'entityCode' => $enrollment->code ?? null,
                        'entityTitle' => (string) $enrollment->courseTitle,
                        'invoiceData' => json_encode($invoiceData),
                        'updated_at' => now(),
                    ]));

                $invoice = DB::table('invoices')->where('id', $invoiceId)->first();
            }

            $paymentLogId = DB::table('payment_logs')->insertGetId($this->filterExistingColumns('payment_logs', [
                'userId' => (int) $enrollment->userId,
                'orderId' => $orderId,
                'paymentId' => $paymentId,
                'courseId' => (int) $enrollment->courseId,
                'enrollmentId' => $enrollmentId,
                'installmentId' => $installmentId,
                'entityType' => 'Academic Course',
                'entityId' => (int) $enrollment->courseId,
                'entityCode' => $enrollment->code ?? null,
                'entityTitle' => (string) $enrollment->courseTitle,
                'eventType' => 'offline.installment_payment',
                'gateway' => 'offline',
                'status' => $newPaymentStatus,
                'totalFee' => $this->offlineEnrollmentMoney($paymentLog->totalFee ?? $enrollment->coursePrice ?? 0),
                'amountPaid' => $amountPaidNow,
                'amount' => $amountPaidNow,
                'amountBalance' => $newBalanceAmount,
                'paymentMode' => 'OFFLINE',
                'paymentBy' => $paymentType,
                'paymentType' => $paymentType,
                'paymentStatus' => $newPaymentStatus,
                'invoiceNumber' => $invoiceNumber,
                'referenceNo' => $referenceNo,
                'transactionNo' => $transactionNo,
                'createdBy' => (int) $request->user()->id,
                'paymentFor' => 'Course Installment',
                'remarks' => $remarks,
                'requestPayload' => json_encode($request->all()),
                'responsePayload' => json_encode([
                    'enrollmentId' => $enrollmentId,
                    'installmentId' => $installmentId,
                    'courseCode' => $enrollment->code ?? null,
                    'paymentStatus' => $newPaymentStatus,
                    'invoiceNumber' => $invoiceNumber,
                ]),
                'verificationResult' => json_encode([
                    'source' => 'manual_offline_installment_payment',
                    'paidSoFarBefore' => $paidSoFar,
                    'paidThisTransaction' => $amountPaidNow,
                    'balanceBefore' => $balanceBefore,
                    'balanceAfter' => $newBalanceAmount,
                ]),
                'webhookPayload' => null,
                'errorStack' => null,
                'ipAddress' => $request->ip(),
                'browserInfo' => $request->userAgent(),
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]));

            DB::table('offline_course_installments')
                ->where('id', $installmentId)
                ->update($this->filterExistingColumns('offline_course_installments', [
                    'enrollmentId' => $enrollmentId,
                    'paidAmount' => $newPaidAmount,
                    'balanceAmount' => $newBalanceAmount,
                    'paymentStatus' => $newPaymentStatus,
                    'paymentDate' => $paymentDate,
                    'paidDate' => $newPaymentStatus === 'PAID' ? $paymentDate : null,
                    'paymentBy' => $paymentType,
                    'paymentType' => $paymentType,
                    'transactionNo' => $transactionNo,
                    'invoiceId' => $invoiceId ?: ($installment->invoiceId ?? null),
                    'remarks' => $remarks,
                    'status' => $newPaymentStatus === 'PAID' ? 'PAID' : 'PENDING',
                    'updatedOn' => now(),
                ]));

            $savedInstallments = DB::table('offline_course_installments')
                ->where('paymentLogId', (int) $paymentLog->id)
                ->where('deletedFlag', 0)
                ->orderBy('installmentNo')
                ->get();
            $summary = $this->offlineInstallmentTotals(
                $savedInstallments,
                $this->offlineEnrollmentMoney($paymentLog->totalFee ?? $enrollment->coursePrice ?? 0)
            );
            $manualPaymentStatus = $summary['amountBalance'] <= 0.01 ? 'PAID' : 'PARTIAL';

            DB::table('payment_logs')
                ->where('id', (int) $paymentLog->id)
                ->update($this->filterExistingColumns('payment_logs', [
                    'enrollmentId' => $enrollmentId,
                    'status' => $manualPaymentStatus,
                    'amountPaid' => $summary['amountPaid'],
                    'amountBalance' => $summary['amountBalance'],
                    'paymentBy' => $paymentType,
                    'paymentType' => $paymentType,
                    'paymentStatus' => $manualPaymentStatus,
                    'transactionNo' => $transactionNo ?: ($paymentLog->transactionNo ?? null),
                    'responsePayload' => json_encode([
                        'userId' => (int) $enrollment->userId,
                        'courseId' => (int) $enrollment->courseId,
                        'paymentStatus' => $manualPaymentStatus,
                        'amountPaid' => $summary['amountPaid'],
                        'amountBalance' => $summary['amountBalance'],
                    ]),
                    'verificationResult' => json_encode([
                        'source' => 'manual_offline_installment_payment_summary',
                        'updatedBy' => (int) $request->user()->id,
                        'installmentPaymentLogId' => $paymentLogId,
                    ]),
                    'updated_at' => now(),
                ]));

            $this->updateOfflineEnrollmentInvoiceSnapshot(
                (int) ($paymentLog->orderId ?? 0),
                $manualPaymentStatus,
                $summary['amountPaid'],
                $summary['amountBalance'],
                $savedInstallments
            );

            DB::table('enrollments')
                ->where('id', $enrollmentId)
                ->update(['updated_at' => now()]);

            $freshInstallment = DB::table('offline_course_installments as oci')
                ->leftJoin('invoices as inv', 'inv.id', '=', 'oci.invoiceId')
                ->where('oci.id', $installmentId)
                ->select('oci.*', 'inv.invoiceNumber', 'inv.orderId as invoiceOrderId')
                ->first();

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => $newPaymentStatus === 'PAID'
                    ? 'Installment paid and invoice generated successfully.'
                    : 'Partial installment payment saved successfully.',
                'data' => [
                    'enrollmentId' => $enrollmentId,
                    'installmentId' => $installmentId,
                    'paymentStatus' => $newPaymentStatus,
                    'amountPaid' => $newPaidAmount,
                    'balanceAmount' => $newBalanceAmount,
                    'summary' => [
                        'paymentStatus' => $manualPaymentStatus,
                        'totalFee' => $summary['totalFee'],
                        'amountPaid' => $summary['amountPaid'],
                        'amountBalance' => $summary['amountBalance'],
                    ],
                    'installment' => $freshInstallment
                        ? $this->formatOfflineInstallmentForResponse($freshInstallment)
                        : null,
                    'invoice' => $this->formatOfflineInstallmentInvoiceResponse($invoice),
                ],
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error paying offline course installment: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function offlineInstallmentPaymentSchemaResponse()
    {
        $requiredTables = [
            'orders',
            'payments',
            'order_items',
            'enrollments',
            'payment_logs',
            'invoices',
            'offline_course_installments',
        ];
        $missingTables = array_values(array_filter(
            $requiredTables,
            fn(string $table): bool => !Schema::hasTable($table)
        ));

        if (!empty($missingTables)) {
            return response()->json([
                'status' => false,
                'message' => 'Offline installment payment tables are missing: ' . implode(', ', $missingTables),
            ], 500);
        }

        $requiredInstallmentColumns = [
            'paidAmount',
            'balanceAmount',
            'paymentStatus',
            'paymentDate',
            'paymentType',
            'invoiceId',
            'remarks',
        ];
        $missingInstallmentColumns = array_values(array_filter(
            $requiredInstallmentColumns,
            fn(string $column): bool => !Schema::hasColumn('offline_course_installments', $column)
        ));

        if (!empty($missingInstallmentColumns)) {
            return response()->json([
                'status' => false,
                'message' => 'Offline installment payment columns are missing: ' . implode(', ', $missingInstallmentColumns) . '. Run database/sql/offline_course_manual_enrollment.sql first.',
            ], 500);
        }

        $requiredPaymentLogColumns = [
            'enrollmentId',
            'installmentId',
            'amount',
            'paymentType',
            'paymentFor',
            'remarks',
        ];
        $missingPaymentLogColumns = array_values(array_filter(
            $requiredPaymentLogColumns,
            fn(string $column): bool => !Schema::hasColumn('payment_logs', $column)
        ));

        if (!empty($missingPaymentLogColumns)) {
            return response()->json([
                'status' => false,
                'message' => 'Offline installment payment log columns are missing: ' . implode(', ', $missingPaymentLogColumns) . '. Run database/sql/offline_course_manual_enrollment.sql first.',
            ], 500);
        }

        return null;
    }

    private function offlineInstallmentPaymentTypes(): array
    {
        return ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'];
    }

    private function normalizeOfflineInstallmentPaymentType(mixed $value): ?string
    {
        $paymentType = strtoupper(trim((string) ($value ?? '')));
        $paymentType = str_replace([' ', '-'], '_', $paymentType);

        if ($paymentType === 'NETBANKING' || $paymentType === 'NET_BANKING' || $paymentType === 'BANKTRANSFER') {
            $paymentType = 'BANK_TRANSFER';
        }

        return in_array($paymentType, $this->offlineInstallmentPaymentTypes(), true) ? $paymentType : null;
    }

    private function offlineInstallmentInvoiceNumber(int $invoiceId): string
    {
        return 'ICETL-INST-' . now()->format('Ymd') . '-' . str_pad((string) $invoiceId, 6, '0', STR_PAD_LEFT);
    }

    private function offlineInstallmentInvoiceData(
        string $invoiceNumber,
        int $orderId,
        int $paymentId,
        object $enrollment,
        object $installment,
        float $installmentAmount,
        float $paidThisTransaction,
        float $paidAmount,
        float $balanceAmount,
        string $paymentType,
        ?string $transactionNo,
        string $referenceNo,
        string $paymentDate,
        ?string $remarks
    ): array {
        return [
            'invoiceNo' => $invoiceNumber,
            'orderId' => $orderId,
            'paymentId' => $paymentId,
            'enrollmentId' => (int) $enrollment->enrollmentId,
            'studentId' => (int) $enrollment->userId,
            'courseId' => (int) $enrollment->courseId,
            'courseCode' => $enrollment->code ?? null,
            'entityType' => 'Academic Course',
            'entityId' => (int) $enrollment->courseId,
            'entityCode' => $enrollment->code ?? null,
            'entityTitle' => (string) $enrollment->courseTitle,
            'installmentId' => (int) $installment->id,
            'installmentNo' => (int) $installment->installmentNo,
            'invoiceType' => 'Course Installment',
            'invoiceDate' => now()->toDateString(),
            'paymentDate' => $paymentDate,
            'status' => 'paid',
            'paymentStatus' => 'PAID',
            'paymentMode' => 'OFFLINE',
            'paymentBy' => $paymentType,
            'paymentType' => $paymentType,
            'transactionNo' => $transactionNo,
            'paymentReference' => $transactionNo ?: $referenceNo,
            'remarks' => $remarks,
            'currency' => 'INR',
            'customer' => [
                'name' => $enrollment->studentName,
                'email' => $enrollment->studentEmail,
                'phone' => $enrollment->studentPhone,
            ],
            'company' => [
                'name' => 'ICETL',
                'subtitle' => 'Ice Technology Lab',
                'email' => 'support@icetl.com',
            ],
            'items' => [
                [
                    'courseId' => (int) $enrollment->courseId,
                    'code' => $enrollment->code ?? null,
                    'entityType' => 'Academic Course',
                    'entityCode' => $enrollment->code ?? null,
                    'entityTitle' => (string) $enrollment->courseTitle,
                    'title' => (string) $enrollment->courseTitle . ' - Installment ' . (int) $installment->installmentNo,
                    'categoryName' => $enrollment->categoryName ?: 'Offline Course',
                    'installmentNo' => (int) $installment->installmentNo,
                    'installmentAmount' => $installmentAmount,
                    'price' => $paidThisTransaction,
                    'taxAmount' => 0,
                    'totalAmount' => $paidThisTransaction,
                ],
            ],
            'subtotal' => $paidThisTransaction,
            'tax' => 0,
            'totalAmount' => $paidThisTransaction,
            'installmentAmount' => $installmentAmount,
            'paidThisTransaction' => $paidThisTransaction,
            'paidAmount' => $paidAmount,
            'balanceAmount' => $balanceAmount,
        ];
    }

    private function formatOfflineInstallmentInvoiceResponse(?object $invoice): ?array
    {
        if (!$invoice) {
            return null;
        }

        return [
            'id' => (int) $invoice->id,
            'invoiceNumber' => $invoice->invoiceNumber,
            'orderId' => (int) $invoice->orderId,
            'invoiceDate' => $invoice->invoiceDate,
            'invoiceAmount' => $this->offlineEnrollmentMoney($invoice->invoiceAmount ?? $invoice->grandTotal ?? 0),
            'downloadUrl' => '/api/invoice/' . (int) $invoice->orderId . '/download',
        ];
    }

    private function offlineInstallmentTotals($installments, float $fallbackTotalFee): array
    {
        $totalFee = 0.0;
        $amountPaid = 0.0;

        foreach ($installments as $installment) {
            $amount = $this->offlineEnrollmentMoney($installment->amount ?? 0);
            $status = strtoupper((string) ($installment->paymentStatus ?? $installment->status ?? 'PENDING'));
            $paidAmount = $this->offlineEnrollmentMoney(
                $installment->paidAmount ?? ($status === 'PAID' ? $amount : 0)
            );

            $totalFee = $this->offlineEnrollmentMoney($totalFee + $amount);
            $amountPaid = $this->offlineEnrollmentMoney($amountPaid + min($paidAmount, $amount));
        }

        if ($totalFee <= 0 && $fallbackTotalFee > 0) {
            $totalFee = $fallbackTotalFee;
        }

        return [
            'totalFee' => $this->offlineEnrollmentMoney($totalFee),
            'amountPaid' => $this->offlineEnrollmentMoney($amountPaid),
            'amountBalance' => $this->offlineEnrollmentMoney(max($totalFee - $amountPaid, 0)),
        ];
    }

    private function updateOfflineEnrollmentInvoiceSnapshot(
        int $orderId,
        string $paymentStatus,
        float $amountPaid,
        float $amountBalance,
        $installments
    ): void {
        if ($orderId <= 0) {
            return;
        }

        $invoice = DB::table('invoices')
            ->where('orderId', $orderId)
            ->where('deletedFlag', 0)
            ->first();

        if (!$invoice) {
            return;
        }

        $invoiceData = json_decode((string) ($invoice->invoiceData ?? ''), true);
        $invoiceData = is_array($invoiceData) ? $invoiceData : [];
        $invoiceData['paymentStatus'] = $paymentStatus;
        $invoiceData['amountPaid'] = $amountPaid;
        $invoiceData['amountBalance'] = $amountBalance;
        $invoiceData['installments'] = collect($installments)
            ->map(fn($row) => $this->formatOfflineInstallmentForResponse($row))
            ->values()
            ->all();

        DB::table('invoices')
            ->where('id', (int) $invoice->id)
            ->update([
                'invoiceData' => json_encode($invoiceData),
                'updated_at' => now(),
            ]);
    }

    private function offlineStudentLedgerSchemaResponse()
    {
        $requiredTables = [
            'orders',
            'payments',
            'enrollments',
            'payment_logs',
            'invoices',
            'offline_course_installments',
        ];
        $missingTables = array_values(array_filter(
            $requiredTables,
            fn(string $table): bool => !Schema::hasTable($table)
        ));

        if (!empty($missingTables)) {
            return response()->json([
                'status' => false,
                'message' => 'Offline student payment tables are missing: ' . implode(', ', $missingTables),
            ], 500);
        }

        $requiredPaymentLogColumns = [
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
        $missingColumns = array_values(array_filter(
            $requiredPaymentLogColumns,
            fn(string $column): bool => !Schema::hasColumn('payment_logs', $column)
        ));

        if (!empty($missingColumns)) {
            return response()->json([
                'status' => false,
                'message' => 'Offline student payment columns are missing: ' . implode(', ', $missingColumns),
            ], 500);
        }

        $requiredInstallmentColumns = [
            'paymentBy',
            'paymentType',
            'transactionNo',
            'paidAmount',
            'balanceAmount',
            'paymentStatus',
            'paymentDate',
            'invoiceId',
        ];
        $missingInstallmentColumns = array_values(array_filter(
            $requiredInstallmentColumns,
            fn(string $column): bool => !Schema::hasColumn('offline_course_installments', $column)
        ));

        if (!empty($missingInstallmentColumns)) {
            return response()->json([
                'status' => false,
                'message' => 'Offline installment payment columns are missing: ' . implode(', ', $missingInstallmentColumns),
            ], 500);
        }

        return null;
    }

    private function baseOfflineCourseStudentQuery()
    {
        $manualPaymentLogs = DB::table('payment_logs')
            ->select(
                DB::raw('MAX(id) as id'),
                'userId',
                'paymentId',
                'courseId'
            )
            ->where('eventType', 'offline.manual_enrollment')
            ->where('deletedFlag', 0)
            ->groupBy('userId', 'paymentId', 'courseId');
        $installmentStatus = $this->offlineInstallmentPaymentStatusExpression();
        $installmentPaidAmount = $this->offlineInstallmentPaidAmountExpression();
        $installmentBalanceAmount = $this->offlineInstallmentBalanceAmountExpression();
        $installmentUnpaid = "({$installmentStatus} <> 'PAID' OR {$installmentBalanceAmount} > 0.01)";
        $installmentSummary = DB::table('offline_course_installments')
            ->select(
                'paymentLogId',
                'userId',
                'courseId',
                DB::raw('COUNT(*) as installmentCount'),
                DB::raw("SUM(CASE WHEN {$installmentUnpaid} THEN 1 ELSE 0 END) as pendingInstallments"),
                DB::raw("SUM(CASE WHEN {$installmentStatus} = 'PAID' AND {$installmentBalanceAmount} <= 0.01 THEN 1 ELSE 0 END) as paidInstallments"),
                DB::raw("SUM(CASE WHEN {$installmentUnpaid} THEN {$installmentBalanceAmount} ELSE 0 END) as pendingAmount"),
                DB::raw("SUM({$installmentPaidAmount}) as paidInstallmentAmount"),
                DB::raw("SUM(CASE WHEN {$installmentUnpaid} AND expectedDate < CURDATE() THEN 1 ELSE 0 END) as overdueInstallments"),
                DB::raw("MIN(CASE WHEN {$installmentUnpaid} THEN expectedDate ELSE NULL END) as nextInstallmentDate"),
                DB::raw("MIN(CASE WHEN {$installmentUnpaid} AND expectedDate >= CURDATE() THEN expectedDate ELSE NULL END) as nextUpcomingInstallmentDate")
            )
            ->where('deletedFlag', 0)
            ->groupBy('paymentLogId', 'userId', 'courseId');

        return DB::table('enrollments as e')
            ->join('users as student', 'student.id', '=', 'e.userId')
            ->join('courses as c', 'c.id', '=', 'e.courseId')
            ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
            ->leftJoin('orders as o', 'o.id', '=', 'e.orderId')
            ->leftJoin('payments as p', 'p.id', '=', 'e.paymentId')
            ->leftJoin('invoices as i', function ($join) {
                $join->on('i.orderId', '=', 'e.orderId')
                    ->where('i.deletedFlag', 0);
            })
            ->leftJoinSub($manualPaymentLogs, 'latest_pl', function ($join) {
                $join->on('latest_pl.userId', '=', 'e.userId')
                    ->on('latest_pl.paymentId', '=', 'e.paymentId')
                    ->on('latest_pl.courseId', '=', 'e.courseId');
            })
            ->leftJoin('payment_logs as pl', 'pl.id', '=', 'latest_pl.id')
            ->leftJoinSub($installmentSummary, 'inst', function ($join) {
                $join->on('inst.paymentLogId', '=', 'pl.id')
                    ->on('inst.userId', '=', 'e.userId')
                    ->on('inst.courseId', '=', 'e.courseId');
            })
            ->where('e.deletedFlag', 0)
            ->where('student.deletedFlag', 0)
            ->where('c.deletedFlag', 0)
            ->where('c.courseType', 2);
    }

    private function offlineCourseStudentSelectColumns(): array
    {
        $totalFee = $this->offlineStudentTotalFeeExpression();
        $amountPaid = $this->offlineStudentAmountPaidExpression();
        $amountBalance = $this->offlineStudentAmountBalanceExpression();
        $paymentStatus = $this->offlineStudentPaymentStatusExpression();
        $paymentDisplayId = $this->offlineStudentPaymentDisplayExpression();

        return [
            'e.id as enrollmentId',
            'e.status as enrollmentStatus',
            'e.created_at as enrolledAt',
            'student.id as studentId',
            'student.name as studentName',
            'student.email as studentEmail',
            'student.phone as studentPhone',
            Schema::hasColumn('users', 'code') ? DB::raw('student.code as studentCode') : DB::raw('NULL as studentCode'),
            'student.dob as studentDob',
            'student.gender as studentGender',
            'c.id as courseId',
            EntityCodeService::codeSelect('courses', 'c'),
            'c.title as courseTitle',
            'cc.categoryName as categoryName',
            'c.price as coursePrice',
            'c.venue',
            'c.city',
            'c.startDate',
            'c.endDate',
            'o.id as orderId',
            'o.orderReference',
            'p.id as paymentId',
            'pl.id as paymentLogId',
            DB::raw("{$totalFee} as totalFee"),
            DB::raw("{$amountPaid} as amountPaid"),
            DB::raw("{$amountBalance} as amountBalance"),
            DB::raw("{$paymentStatus} as paymentStatus"),
            DB::raw("COALESCE(pl.paymentMode, p.paymentMethod, 'OFFLINE') as paymentMode"),
            DB::raw("COALESCE(pl.paymentBy, p.paymentMethod, 'OFFLINE') as paymentBy"),
            'pl.referenceNo',
            'pl.transactionNo',
            DB::raw("{$paymentDisplayId} as paymentDisplayId"),
            DB::raw('COALESCE(pl.invoiceNumber, i.invoiceNumber) as invoiceNumber'),
            'i.invoiceDate',
            DB::raw('COALESCE(inst.installmentCount, 0) as installmentCount'),
            DB::raw('COALESCE(inst.pendingInstallments, 0) as pendingInstallments'),
            DB::raw('COALESCE(inst.paidInstallments, 0) as paidInstallments'),
            DB::raw('COALESCE(inst.pendingAmount, 0) as pendingInstallmentAmount'),
            DB::raw('COALESCE(inst.paidInstallmentAmount, 0) as paidInstallmentAmount'),
            DB::raw('COALESCE(inst.overdueInstallments, 0) as overdueInstallments'),
            'inst.nextInstallmentDate',
            'inst.nextUpcomingInstallmentDate',
        ];
    }

    private function applyOfflineCourseStudentFilters($query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $paymentDisplayId = $this->offlineStudentPaymentDisplayExpression();

            $query->where(function ($subQuery) use ($search, $paymentDisplayId) {
                $subQuery->where('student.name', 'LIKE', '%' . $search . '%')
                    ->orWhere('student.email', 'LIKE', '%' . $search . '%')
                    ->orWhere('student.phone', 'LIKE', '%' . $search . '%')
                    ->orWhere('c.title', 'LIKE', '%' . $search . '%')
                    ->orWhere('cc.categoryName', 'LIKE', '%' . $search . '%')
                    ->orWhere('o.orderReference', 'LIKE', '%' . $search . '%')
                    ->orWhere('i.invoiceNumber', 'LIKE', '%' . $search . '%')
                    ->orWhereRaw("{$paymentDisplayId} LIKE ?", ['%' . $search . '%']);
                EntityCodeService::orWhereCode($subQuery, 'courses', 'c.code', $search);

                if (Schema::hasColumn('users', 'code')) {
                    $subQuery->orWhere('student.code', 'LIKE', '%' . $search . '%');
                }
            });
        }

        if ($request->filled('courseId')) {
            $query->where('c.id', (int) $request->input('courseId'));
        }

        if ($request->filled('courseCode') && Schema::hasColumn('courses', 'code')) {
            $courseCode = trim((string) $request->input('courseCode'));

            if ($courseCode !== '') {
                $query->where('c.code', 'LIKE', '%' . $courseCode . '%');
            }
        }

        if ($request->filled('paymentStatus')) {
            $paymentStatus = strtoupper((string) $request->input('paymentStatus'));
            $amountBalance = $this->offlineStudentAmountBalanceExpression();

            if ($paymentStatus === 'PAID') {
                $query->whereRaw("{$amountBalance} <= 0");
            } elseif ($paymentStatus === 'PARTIAL') {
                $query->whereRaw("{$amountBalance} > 0");
            }
        }

        $installmentStatus = (string) $request->input('installmentStatus', 'all');

        if ($installmentStatus === 'pending') {
            $query->whereRaw('COALESCE(inst.pendingInstallments, 0) > 0');
        } elseif ($installmentStatus === 'paid') {
            $query->whereRaw($this->offlineStudentAmountBalanceExpression() . ' <= 0');
        } elseif ($installmentStatus === 'overdue') {
            $query->whereRaw('COALESCE(inst.overdueInstallments, 0) > 0');
        } elseif ($installmentStatus === 'none') {
            $query->whereRaw('COALESCE(inst.installmentCount, 0) = 0');
        }
    }

    private function applyOfflineCourseStudentSort($query, string $sortBy)
    {
        if ($sortBy === 'newest') {
            return $query->orderBy('e.created_at', 'DESC')
                ->orderBy('e.id', 'DESC');
        }

        if ($sortBy === 'paidDesc') {
            return $query->orderByRaw($this->offlineStudentAmountPaidExpression() . ' DESC')
                ->orderBy('e.created_at', 'DESC');
        }

        if ($sortBy === 'balanceDesc') {
            return $query->orderByRaw($this->offlineStudentAmountBalanceExpression() . ' DESC')
                ->orderByRaw('CASE WHEN inst.nextInstallmentDate IS NULL THEN 1 ELSE 0 END ASC')
                ->orderBy('inst.nextInstallmentDate', 'ASC');
        }

        return $query->orderByRaw('CASE WHEN COALESCE(inst.pendingInstallments, 0) > 0 THEN 0 ELSE 1 END ASC')
            ->orderByRaw('CASE WHEN inst.nextInstallmentDate IS NULL THEN 1 ELSE 0 END ASC')
            ->orderBy('inst.nextInstallmentDate', 'ASC')
            ->orderBy('e.created_at', 'DESC');
    }

    private function buildOfflineCourseStudentSummary($query): array
    {
        $totalFee = $this->offlineStudentTotalFeeExpression();
        $amountPaid = $this->offlineStudentAmountPaidExpression();
        $amountBalance = $this->offlineStudentAmountBalanceExpression();
        $row = $query
            ->selectRaw('COUNT(*) as totalEnrollments')
            ->selectRaw('COUNT(DISTINCT e.userId) as totalStudents')
            ->selectRaw('COUNT(DISTINCT c.id) as totalCourses')
            ->selectRaw("SUM({$totalFee}) as totalFee")
            ->selectRaw("SUM({$amountPaid}) as totalPaid")
            ->selectRaw("SUM({$amountBalance}) as totalBalance")
            ->selectRaw("SUM(CASE WHEN {$amountBalance} <= 0 THEN 1 ELSE 0 END) as paidStudents")
            ->selectRaw("SUM(CASE WHEN {$amountBalance} > 0 THEN 1 ELSE 0 END) as partialStudents")
            ->selectRaw('SUM(COALESCE(inst.pendingInstallments, 0)) as pendingInstallments')
            ->selectRaw('SUM(COALESCE(inst.overdueInstallments, 0)) as overdueInstallments')
            ->selectRaw('MIN(inst.nextInstallmentDate) as nextInstallmentDate')
            ->selectRaw('MIN(inst.nextUpcomingInstallmentDate) as nextUpcomingInstallmentDate')
            ->first();

        return [
            'totalEnrollments' => (int) ($row->totalEnrollments ?? 0),
            'totalStudents' => (int) ($row->totalStudents ?? 0),
            'totalCourses' => (int) ($row->totalCourses ?? 0),
            'paidStudents' => (int) ($row->paidStudents ?? 0),
            'partialStudents' => (int) ($row->partialStudents ?? 0),
            'pendingInstallments' => (int) ($row->pendingInstallments ?? 0),
            'overdueInstallments' => (int) ($row->overdueInstallments ?? 0),
            'totalFee' => $this->offlineEnrollmentMoney($row->totalFee ?? 0),
            'totalPaid' => $this->offlineEnrollmentMoney($row->totalPaid ?? 0),
            'totalBalance' => $this->offlineEnrollmentMoney($row->totalBalance ?? 0),
            'nextInstallmentDate' => $row->nextInstallmentDate ?? null,
            'nextUpcomingInstallmentDate' => $row->nextUpcomingInstallmentDate ?? null,
        ];
    }

    private function offlineCourseInstallmentsByPaymentLogIds($paymentLogIds): array
    {
        if ($paymentLogIds->isEmpty()) {
            return [];
        }

        $statusExpression = $this->offlineInstallmentPaymentStatusExpression('oci');
        $balanceExpression = $this->offlineInstallmentBalanceAmountExpression('oci');
        $paidCondition = "({$statusExpression} = 'PAID' AND {$balanceExpression} <= 0.01)";
        $query = DB::table('offline_course_installments as oci')
            ->leftJoin('payment_logs as enrollment_pl', 'enrollment_pl.id', '=', 'oci.paymentLogId')
            ->leftJoin('invoices as enrollment_inv', function ($join) {
                $join->on('enrollment_inv.orderId', '=', 'enrollment_pl.orderId')
                    ->where('enrollment_inv.deletedFlag', 0);
            })
            ->whereIn('oci.paymentLogId', $paymentLogIds->all())
            ->where('oci.deletedFlag', 0);

        if (Schema::hasColumn('offline_course_installments', 'invoiceId')) {
            $query
                ->leftJoin('invoices as inv', 'inv.id', '=', 'oci.invoiceId')
                ->select(
                    'oci.*',
                    DB::raw("COALESCE(oci.invoiceId, CASE WHEN {$paidCondition} THEN enrollment_inv.id ELSE NULL END) as invoiceId"),
                    DB::raw("COALESCE(inv.invoiceNumber, CASE WHEN {$paidCondition} THEN enrollment_inv.invoiceNumber ELSE NULL END) as invoiceNumber"),
                    DB::raw("COALESCE(inv.orderId, CASE WHEN {$paidCondition} THEN enrollment_inv.orderId ELSE NULL END) as invoiceOrderId")
                );
        } else {
            $query->select(
                'oci.*',
                DB::raw("CASE WHEN {$paidCondition} THEN enrollment_inv.id ELSE NULL END as invoiceId"),
                DB::raw("CASE WHEN {$paidCondition} THEN enrollment_inv.invoiceNumber ELSE NULL END as invoiceNumber"),
                DB::raw("CASE WHEN {$paidCondition} THEN enrollment_inv.orderId ELSE NULL END as invoiceOrderId")
            );
        }

        return $query
            ->orderBy('oci.installmentNo')
            ->orderByRaw('CASE WHEN oci.expectedDate IS NULL THEN 1 ELSE 0 END')
            ->orderBy('oci.expectedDate')
            ->get()
            ->groupBy('paymentLogId')
            ->map(fn($rows) => $this->normalizeOfflineInstallmentSequenceForResponse($rows))
            ->all();
    }

    private function normalizeOfflineInstallmentSequenceForResponse($rows): array
    {
        $formattedRows = collect($rows)
            ->map(fn($row) => $this->formatOfflineInstallmentForResponse($row))
            ->values();

        $hasEnrollmentPaidRow = $formattedRows->contains(
            fn(array $row): bool => $row['paymentStatus'] === 'PAID' && empty($row['expectedDate'])
        );

        if (!$hasEnrollmentPaidRow) {
            return $formattedRows
                ->sortBy(fn(array $row): string => str_pad((string) ($row['installmentNo'] ?? 0), 4, '0', STR_PAD_LEFT))
                ->values()
                ->all();
        }

        return $formattedRows
            ->sortBy(function (array $row): string {
                $isEnrollmentPaidRow = $row['paymentStatus'] === 'PAID' && empty($row['expectedDate']);

                return ($isEnrollmentPaidRow ? '0' : '1')
                    . '-' . str_pad((string) ($row['installmentNo'] ?? 0), 4, '0', STR_PAD_LEFT)
                    . '-' . str_pad((string) ($row['id'] ?? 0), 8, '0', STR_PAD_LEFT);
            })
            ->values()
            ->map(fn(array $row, int $index): array => array_merge($row, [
                'installmentNo' => $index + 1,
            ]))
            ->all();
    }

    private function offlineInstallmentDisplayNumberForPaymentLog(int $paymentLogId, int $installmentId): int
    {
        if ($paymentLogId <= 0 || $installmentId <= 0) {
            return 0;
        }

        $rows = DB::table('offline_course_installments')
            ->where('paymentLogId', $paymentLogId)
            ->where('deletedFlag', 0)
            ->orderBy('installmentNo')
            ->orderBy('id')
            ->get();

        return (int) (collect($this->normalizeOfflineInstallmentSequenceForResponse($rows))
            ->firstWhere('id', $installmentId)['installmentNo'] ?? 0);
    }

    private function formatOfflineCourseStudentRow(object $row, array $installmentMap): array
    {
        $paymentLogId = (int) ($row->paymentLogId ?? 0);
        $installments = $paymentLogId > 0 ? ($installmentMap[$paymentLogId] ?? []) : [];
        $studentId = (int) ($row->studentId ?? 0);
        $studentCode = trim((string) ($row->studentCode ?? ''));

        if ($studentCode === '' && $studentId > 0) {
            $studentCode = EntityCodeService::assignIfMissing(
                'users',
                $studentId,
                EntityCodeService::PREFIX_LEARNER
            ) ?? '';
        }

        return [
            'id' => (int) $row->enrollmentId,
            'enrollmentId' => (int) $row->enrollmentId,
            'enrollmentStatus' => $row->enrollmentStatus,
            'enrolledAt' => $row->enrolledAt,
            'studentId' => $studentId,
            'studentCode' => $studentCode !== '' ? $studentCode : null,
            'studentName' => $row->studentName,
            'studentEmail' => $row->studentEmail,
            'studentPhone' => $row->studentPhone,
            'studentDob' => $row->studentDob,
            'studentGender' => $row->studentGender ? (int) $row->studentGender : null,
            'courseId' => (int) $row->courseId,
            'courseCode' => $row->code ?? null,
            'courseTitle' => $row->courseTitle,
            'categoryName' => $row->categoryName ?: 'Offline Course',
            'coursePrice' => $this->offlineEnrollmentMoney($row->coursePrice ?? 0),
            'venue' => $row->venue,
            'city' => $row->city,
            'startDate' => $row->startDate,
            'endDate' => $row->endDate,
            'orderId' => $row->orderId ? (int) $row->orderId : null,
            'orderReference' => $row->orderReference,
            'paymentId' => $row->paymentId ? (int) $row->paymentId : null,
            'paymentLogId' => $paymentLogId ?: null,
            'totalFee' => $this->offlineEnrollmentMoney($row->totalFee ?? 0),
            'amountPaid' => $this->offlineEnrollmentMoney($row->amountPaid ?? 0),
            'amountBalance' => $this->offlineEnrollmentMoney($row->amountBalance ?? 0),
            'paymentStatus' => $row->paymentStatus,
            'paymentMode' => $row->paymentMode,
            'paymentBy' => $row->paymentBy,
            'referenceNo' => $row->referenceNo,
            'transactionNo' => $row->transactionNo,
            'paymentDisplayId' => $row->paymentDisplayId,
            'invoiceNumber' => $row->invoiceNumber,
            'invoiceDate' => $row->invoiceDate,
            'installmentCount' => (int) ($row->installmentCount ?? 0),
            'pendingInstallments' => (int) ($row->pendingInstallments ?? 0),
            'paidInstallments' => (int) ($row->paidInstallments ?? 0),
            'pendingInstallmentAmount' => $this->offlineEnrollmentMoney($row->pendingInstallmentAmount ?? 0),
            'paidInstallmentAmount' => $this->offlineEnrollmentMoney($row->paidInstallmentAmount ?? 0),
            'overdueInstallments' => (int) ($row->overdueInstallments ?? 0),
            'nextInstallmentDate' => $row->nextInstallmentDate,
            'nextUpcomingInstallmentDate' => $row->nextUpcomingInstallmentDate,
            'installments' => $installments,
        ];
    }

    private function normalizeOfflineCourseInstallmentUpdateRows(mixed $installments): array
    {
        if (!is_array($installments)) {
            return [];
        }

        return collect($installments)
            ->map(function ($installment, int $index): array {
                $item = is_array($installment) ? $installment : [];
                $status = strtoupper((string) ($item['status'] ?? 'PENDING'));

                return [
                    'id' => empty($item['id']) ? null : (int) $item['id'],
                    'installmentNo' => (int) ($item['installmentNo'] ?? ($index + 1)),
                    'amount' => $this->offlineEnrollmentMoney($item['amount'] ?? 0),
                    'expectedDate' => trim((string) ($item['expectedDate'] ?? '')) ?: null,
                    'paidDate' => trim((string) ($item['paidDate'] ?? '')) ?: null,
                    'paymentBy' => $this->normalizeOfflineInstallmentPaymentBy($item['paymentBy'] ?? null),
                    'transactionNo' => trim((string) ($item['transactionNo'] ?? '')) ?: null,
                    'status' => in_array($status, ['PAID', 'PENDING'], true) ? $status : 'PENDING',
                ];
            })
            ->values()
            ->all();
    }

    private function validateOfflineCourseInstallmentUpdateRows(array $installments, $existingInstallments, float $totalFee): array
    {
        $errors = [];

        if (count($installments) === 0) {
            $errors['installments'][] = 'Add at least one installment row.';
            return $errors;
        }

        if (count($installments) > 4) {
            $errors['installments'][] = 'Installments cannot be greater than 4.';
        }

        $seenNumbers = [];
        $rowTotal = 0;
        $pendingRows = [];

        foreach ($installments as $index => $installment) {
            if ($installment['id'] && !$existingInstallments->has($installment['id'])) {
                $errors["installments.$index.id"][] = 'Installment row does not belong to this payment.';
            }

            if (isset($seenNumbers[$installment['installmentNo']])) {
                $errors["installments.$index.installmentNo"][] = 'Installment no must be unique.';
            }

            $seenNumbers[$installment['installmentNo']] = true;
            $rowTotal = $this->offlineEnrollmentMoney($rowTotal + $installment['amount']);

            if ($installment['status'] === 'PENDING') {
                $pendingRows[] = $installment;

                if (empty($installment['expectedDate'])) {
                    $errors["installments.$index.expectedDate"][] = 'Expected date is required for pending installments.';
                }
            } else {
                if (empty($installment['paymentBy'])) {
                    $errors["installments.$index.paymentBy"][] = 'Payment by is required for paid installments.';
                }

                if (
                    !empty($installment['paymentBy'])
                    && $installment['paymentBy'] !== 'CASH'
                    && empty($installment['transactionNo'])
                ) {
                    $errors["installments.$index.transactionNo"][] = 'Transaction no is required for UPI and Netbanking installments.';
                }
            }
        }

        if (abs($rowTotal - $totalFee) > 0.01) {
            $errors['installments'][] = 'Installment amounts must equal the total fee.';
        }

        if (count($pendingRows) === 0 && $rowTotal < $totalFee) {
            $errors['installments'][] = 'At least one pending installment is required while balance remains.';
        }

        return $errors;
    }

    private function formatOfflineInstallmentForResponse(object $row): array
    {
        $expectedDate = $row->expectedDate ? (string) $row->expectedDate : null;
        $amount = $this->offlineEnrollmentMoney($row->amount ?? 0);
        $rawStatus = strtoupper((string) ($row->paymentStatus ?? $row->status ?? 'PENDING'));
        $hasEnrollmentPaymentProof = $expectedDate === null
            && $amount > 0
            && (
                trim((string) ($row->paymentBy ?? '')) !== ''
                || trim((string) ($row->paymentType ?? '')) !== ''
                || trim((string) ($row->transactionNo ?? '')) !== ''
                || trim((string) ($row->paymentDate ?? '')) !== ''
                || trim((string) ($row->paidDate ?? '')) !== ''
            );

        if ($hasEnrollmentPaymentProof) {
            $rawStatus = 'PAID';
        }

        $paidAmount = $this->offlineEnrollmentMoney(
            $row->paidAmount ?? ($rawStatus === 'PAID' ? $amount : 0)
        );

        if ($rawStatus === 'PAID' && $paidAmount <= 0.01) {
            $paidAmount = $amount;
        }

        $balanceAmount = $this->offlineEnrollmentMoney(
            $row->balanceAmount ?? max($amount - $paidAmount, 0)
        );

        if ($rawStatus === 'PAID') {
            $balanceAmount = 0;
        }

        $isOverdue = $rawStatus !== 'PAID'
            && $balanceAmount > 0.01
            && $expectedDate !== null
            && $expectedDate < now()->toDateString();
        $paymentStatus = $balanceAmount <= 0.01
            ? 'PAID'
            : ($paidAmount > 0 ? 'PARTIALLY_PAID' : ($isOverdue ? 'OVERDUE' : 'PENDING'));

        return [
            'id' => (int) $row->id,
            'paymentLogId' => (int) $row->paymentLogId,
            'enrollmentId' => empty($row->enrollmentId ?? null) ? null : (int) $row->enrollmentId,
            'installmentNo' => (int) $row->installmentNo,
            'amount' => $amount,
            'installmentAmount' => $amount,
            'paidAmount' => $paidAmount,
            'balanceAmount' => $balanceAmount,
            'expectedDate' => $expectedDate,
            'paidDate' => $row->paidDate ? (string) $row->paidDate : null,
            'paymentDate' => ($row->paymentDate ?? null) ? (string) $row->paymentDate : (($row->paidDate ?? null) ? (string) $row->paidDate : null),
            'paymentBy' => $row->paymentBy ? (string) $row->paymentBy : null,
            'paymentType' => ($row->paymentType ?? null) ? (string) $row->paymentType : ($row->paymentBy ? (string) $row->paymentBy : null),
            'transactionNo' => $row->transactionNo ? (string) $row->transactionNo : null,
            'invoiceId' => empty($row->invoiceId ?? null) ? null : (int) $row->invoiceId,
            'invoiceNumber' => $row->invoiceNumber ?? null,
            'invoiceOrderId' => empty($row->invoiceOrderId ?? null) ? null : (int) $row->invoiceOrderId,
            'invoiceDownloadUrl' => empty($row->invoiceOrderId ?? null) ? null : '/api/invoice/' . (int) $row->invoiceOrderId . '/download',
            'remarks' => ($row->remarks ?? null) ? (string) $row->remarks : null,
            'status' => $paymentStatus,
            'paymentStatus' => $paymentStatus,
            'isOverdue' => $isOverdue,
        ];
    }

    private function normalizeOfflineInstallmentPaymentBy(mixed $value): ?string
    {
        return $this->normalizeOfflineInstallmentPaymentType($value);
    }

    private function offlineInstallmentPaymentStatusExpression(string $alias = ''): string
    {
        $prefix = $alias !== '' ? $alias . '.' : '';
        $paymentProofCondition = "(
            {$prefix}expectedDate IS NULL
            AND COALESCE({$prefix}amount, 0) > 0
            AND (
                NULLIF({$prefix}paymentBy, '') IS NOT NULL
                OR NULLIF({$prefix}paymentType, '') IS NOT NULL
                OR NULLIF({$prefix}transactionNo, '') IS NOT NULL
                OR {$prefix}paymentDate IS NOT NULL
                OR {$prefix}paidDate IS NOT NULL
            )
        )";

        if (Schema::hasColumn('offline_course_installments', 'paymentStatus')) {
            return "CASE WHEN {$paymentProofCondition} THEN 'PAID' ELSE UPPER(COALESCE(NULLIF({$prefix}paymentStatus, ''), {$prefix}status)) END";
        }

        return "CASE WHEN {$paymentProofCondition} THEN 'PAID' ELSE UPPER({$prefix}status) END";
    }

    private function offlineInstallmentPaidAmountExpression(string $alias = ''): string
    {
        $prefix = $alias !== '' ? $alias . '.' : '';
        $amount = "COALESCE({$prefix}amount, 0)";
        $status = $this->offlineInstallmentPaymentStatusExpression($alias);
        $fallback = "CASE WHEN {$status} = 'PAID' THEN {$amount} ELSE 0 END";

        if (Schema::hasColumn('offline_course_installments', 'paidAmount')) {
            return "CASE WHEN {$status} = 'PAID' AND COALESCE({$prefix}paidAmount, 0) <= 0.01 THEN {$amount} ELSE LEAST({$amount}, COALESCE({$prefix}paidAmount, {$fallback})) END";
        }

        return $fallback;
    }

    private function offlineInstallmentBalanceAmountExpression(string $alias = ''): string
    {
        $prefix = $alias !== '' ? $alias . '.' : '';
        $amount = "COALESCE({$prefix}amount, 0)";
        $paidAmount = $this->offlineInstallmentPaidAmountExpression($alias);
        $fallback = "GREATEST({$amount} - {$paidAmount}, 0)";

        if (Schema::hasColumn('offline_course_installments', 'balanceAmount')) {
            return "CASE WHEN {$this->offlineInstallmentPaymentStatusExpression($alias)} = 'PAID' THEN 0 ELSE COALESCE({$prefix}balanceAmount, {$fallback}) END";
        }

        return $fallback;
    }

    private function offlineStudentTotalFeeExpression(): string
    {
        return 'COALESCE(pl.totalFee, o.totalAmount, c.price, 0)';
    }

    private function offlineStudentAmountPaidExpression(): string
    {
        return 'COALESCE(pl.amountPaid, p.totalAmount, 0)';
    }

    private function offlineStudentAmountBalanceExpression(): string
    {
        return 'COALESCE(pl.amountBalance, GREATEST(COALESCE(o.totalAmount, c.price, 0) - COALESCE(p.totalAmount, 0), 0))';
    }

    private function offlineStudentPaymentStatusExpression(): string
    {
        return "CASE WHEN {$this->offlineStudentAmountBalanceExpression()} <= 0 THEN 'PAID' ELSE 'PARTIAL' END";
    }

    private function offlineStudentPaymentDisplayExpression(): string
    {
        return "COALESCE(NULLIF(pl.transactionNo, ''), NULLIF(p.razorpayPaymentId, ''), NULLIF(pl.referenceNo, ''), NULLIF(p.paymentReference, ''), NULLIF(i.paymentReference, ''))";
    }

    public function getOfflineCourseById(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|exists:courses,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        try {
            $course = $this->baseOfflineCourseQuery()
                ->where('c.id', (int) $request->input('id'))
                ->first();

            if (!$course) {
                return response()->json([
                    'status' => false,
                    'message' => 'Offline course not found'
                ], 404);
            }

            $courseItems = collect([$course]);
            $courseInstructorMap = $this->courseInstructorMap($courseItems);
            $fallbackInstructors = $this->fallbackInstructorNames($courseItems);
            $formatted = $this->formatOfflineCourse(
                $course,
                $courseInstructorMap,
                $fallbackInstructors,
                [],
                $user
            );

            if (empty($formatted['actions']['view'])) {
                return response()->json([
                    'status' => false,
                    'message' => 'You are not allowed to view this offline course.'
                ], 403);
            }

            return response()->json([
                'status' => true,
                'message' => 'Offline course fetched successfully',
                'data' => $formatted,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching offline course by id: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function updateOfflineCourse(Request $request)
    {
        $this->prepareCourseHighlightsForValidation($request);

        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|exists:courses,id',
            'title' => ['required', 'string', 'min:5', 'max:120'],
            'category' => 'required|integer|exists:coursecategories,id',
            'isSpecial' => 'nullable|boolean',
            'parentCourseId' => [
                Rule::requiredIf(fn() => $request->boolean('isSpecial')),
                'nullable',
                'integer',
                'exists:courses,id',
            ],
            'instructor' => 'required',
            'venue' => ['required', 'string', 'min:3', 'max:150'],
            'city' => ['required', 'string', 'min:2', 'max:100'],
            'startDate' => 'required|date',
            'endDate' => 'nullable|date|after:startDate',
            'startTime' => 'required|date_format:H:i',
            'endTime' => 'nullable|date_format:H:i',
            'youtubeLiveUrl' => 'nullable|string|max:255',
            'meetingLink' => 'nullable|string|max:255',
            'price' => 'required|numeric|min:0',
            'description' => ['required', 'string', 'min:20', 'max:300'],
            'courseHighlights' => 'nullable|array',
            'courseHighlights.*' => 'string|max:255',
            'thumbnail' => 'nullable|image|mimes:png,jpg,jpeg,webp|max:2048',
            'status' => 'required|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (
            (!$request->filled('endDate') || $request->input('endDate') === $request->input('startDate'))
            && $request->filled('endTime')
            && $request->input('endTime') <= $request->input('startTime')
        ) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'endTime' => ['End time must be later than start time for a same-day course.']
                ]
            ], 422);
        }

        $courseId = (int) $request->input('id');
        $course = $this->findOfflineCourseRecord($courseId);

        if (!$course) {
            return response()->json([
                'status' => false,
                'message' => 'Offline course not found'
            ], 404);
        }

        $currentApprovalStatus = $this->offlineCourseApprovalStatus($course);
        $userCanManageWorkflow = $this->canManageOfflineCourseWorkflow($user);
        $userIsInstructor = $this->isInstructorUser($user);
        $userOwnsOrIsAssigned = $this->offlineCourseBelongsToViewer($course, (int) $user->id);

        if (
            !$userCanManageWorkflow
            && !(
                $userIsInstructor
                && $userOwnsOrIsAssigned
                && in_array($currentApprovalStatus, [self::APPROVAL_PENDING, self::APPROVAL_REJECTED], true)
            )
        ) {
            return response()->json([
                'status' => false,
                'message' => 'You are not allowed to edit this offline course.'
            ], 403);
        }

        $instructorIds = $this->normalizeInstructorIds($request->input('instructor'));
        $isSpecial = $request->boolean('isSpecial') || $userIsInstructor;
        $parentCourseId = $isSpecial ? (int) $request->input('parentCourseId') : null;

        if (empty($instructorIds)) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'instructor' => ['Please select at least one valid instructor.']
                ]
            ], 422);
        }

        if ($isSpecial && !$this->isValidParentAcademicCourse($parentCourseId, (int) $request->input('category'))) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'parentCourseId' => ['Please select a valid parent academic course from the same category.']
                ]
            ], 422);
        }

        $requestedPublishedFlag = (int) $request->input('status') === 1 ? 1 : 0;

        if ($requestedPublishedFlag === 1 && $currentApprovalStatus !== self::APPROVAL_APPROVED) {
            return response()->json([
                'status' => false,
                'message' => 'This offline course must be approved before it can be published.'
            ], 422);
        }

        DB::beginTransaction();

        try {
            $thumbnailPath = $course->thumbnail ?? null;

            if ($request->hasFile('thumbnail')) {
                if ($thumbnailPath && Storage::disk('private')->exists($thumbnailPath)) {
                    Storage::disk('private')->delete($thumbnailPath);
                }

                $file = $request->file('thumbnail');
                $thumbnailPath = $file->storeAs(
                    'course-thumbnails',
                    uniqid() . '_' . time() . '.' . $file->getClientOriginalExtension(),
                    'private'
                );
            }

            $courseHighlights = $this->normalizeCourseHighlights($request->input('courseHighlights', []));
            $nextApprovalStatus = $userIsInstructor
                ? self::APPROVAL_PENDING
                : $currentApprovalStatus;
            $nextPublishedFlag = $userIsInstructor ? 0 : $requestedPublishedFlag;
            $publishedBy = $nextPublishedFlag === 1 ? (int) $user->id : null;
            $publishedOn = $nextPublishedFlag === 1 ? now() : null;

            $updatePayload = [
                'title' => trim((string) $request->input('title')),
                'categoryId' => (int) $request->input('category'),
                'instructorIds' => json_encode($instructorIds),
                'price' => $request->input('price'),
                'description' => trim((string) $request->input('description')),
                'courseHighlights' => !empty($courseHighlights) ? json_encode($courseHighlights) : null,
                'thumbnail' => $thumbnailPath,
                'status' => $nextPublishedFlag,
                'isSpecial' => $isSpecial ? 1 : 0,
                'parentCourseId' => $parentCourseId,
                'venue' => trim((string) $request->input('venue')),
                'city' => trim((string) $request->input('city')),
                'startDate' => $request->input('startDate'),
                'endDate' => $request->input('endDate') ?: null,
                'startTime' => $request->input('startTime'),
                'endTime' => $request->input('endTime') ?: null,
                'youtubeLiveUrl' => $request->input('youtubeLiveUrl') ?: null,
                'meetingLink' => $request->input('meetingLink') ?: null,
                'approvalStatus' => $nextApprovalStatus,
                'publishedFlag' => $nextPublishedFlag,
                'publishedBy' => $publishedBy,
                'publishedOn' => $publishedOn,
                'updatedOn' => now(),
            ];

            if ($userIsInstructor) {
                $updatePayload['approvedBy'] = null;
                $updatePayload['approvedOn'] = null;
            }

            DB::table('courses')
                ->where('id', $courseId)
                ->update($this->filterExistingColumns('courses', $updatePayload));

            DB::table('courseinstructors')
                ->where('courseId', $courseId)
                ->delete();

            foreach ($instructorIds as $instructorId) {
                DB::table('courseinstructors')->insert([
                    'courseId' => $courseId,
                    'instructorId' => $instructorId,
                    'createdOn' => now()
                ]);
            }

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Offline course updated successfully',
                'data' => [
                    'id' => $courseId,
                    'approvalStatus' => $nextApprovalStatus,
                    'publishedFlag' => $nextPublishedFlag,
                ],
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating offline course: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function approveOfflineCourse(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|exists:courses,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (!$this->canManageOfflineCourseWorkflow($user)) {
            return response()->json([
                'status' => false,
                'message' => 'Only Admin or an authorized Team role can approve offline courses.'
            ], 403);
        }

        $course = $this->findOfflineCourseRecord((int) $request->input('id'));

        if (!$course) {
            return response()->json([
                'status' => false,
                'message' => 'Offline course not found'
            ], 404);
        }

        if ($this->offlineCourseApprovalStatus($course) !== self::APPROVAL_PENDING) {
            return response()->json([
                'status' => false,
                'message' => 'Only pending offline courses can be approved.'
            ], 422);
        }

        try {
            DB::table('courses')
                ->where('id', (int) $course->id)
                ->update($this->filterExistingColumns('courses', [
                    'approvalStatus' => self::APPROVAL_APPROVED,
                    'approvedBy' => (int) $user->id,
                    'approvedOn' => now(),
                    'rejectedBy' => null,
                    'rejectedOn' => null,
                    'rejectionReason' => null,
                    'publishedFlag' => 0,
                    'status' => 0,
                    'publishedBy' => null,
                    'publishedOn' => null,
                    'updatedOn' => now(),
                ]));

            return response()->json([
                'status' => true,
                'message' => 'Offline course approved successfully',
                'data' => [
                    'id' => (int) $course->id,
                    'approvalStatus' => self::APPROVAL_APPROVED,
                    'publishedFlag' => 0,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error approving offline course: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function rejectOfflineCourse(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|exists:courses,id',
            'rejectionReason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (!$this->canManageOfflineCourseWorkflow($user)) {
            return response()->json([
                'status' => false,
                'message' => 'Only Admin or an authorized Team role can reject offline courses.'
            ], 403);
        }

        $course = $this->findOfflineCourseRecord((int) $request->input('id'));

        if (!$course) {
            return response()->json([
                'status' => false,
                'message' => 'Offline course not found'
            ], 404);
        }

        if ($this->offlineCourseApprovalStatus($course) === self::APPROVAL_REJECTED) {
            return response()->json([
                'status' => false,
                'message' => 'This offline course is already rejected.'
            ], 422);
        }

        try {
            DB::table('courses')
                ->where('id', (int) $course->id)
                ->update($this->filterExistingColumns('courses', [
                    'approvalStatus' => self::APPROVAL_REJECTED,
                    'approvedBy' => null,
                    'approvedOn' => null,
                    'rejectedBy' => (int) $user->id,
                    'rejectedOn' => now(),
                    'rejectionReason' => trim((string) $request->input('rejectionReason')),
                    'publishedFlag' => 0,
                    'status' => 0,
                    'publishedBy' => null,
                    'publishedOn' => null,
                    'updatedOn' => now(),
                ]));

            return response()->json([
                'status' => true,
                'message' => 'Offline course rejected successfully',
                'data' => [
                    'id' => (int) $course->id,
                    'approvalStatus' => self::APPROVAL_REJECTED,
                    'publishedFlag' => 0,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error rejecting offline course: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function publishOfflineCourse(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|exists:courses,id',
            'publishedFlag' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        return $this->setOfflineCoursePublishState(
            $request,
            (int) $request->input('id'),
            $request->boolean('publishedFlag')
        );
    }

    public function updateOfflineCourseStatus(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|exists:courses,id',
            'status' => 'required|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        return $this->setOfflineCoursePublishState(
            $request,
            (int) $request->input('id'),
            (int) $request->input('status') === 1
        );
    }

    private function setOfflineCoursePublishState(Request $request, int $courseId, bool $shouldPublish)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        if (!$this->canManageOfflineCourseWorkflow($user)) {
            return response()->json([
                'status' => false,
                'message' => 'Only Admin or an authorized Team role can publish or unpublish offline courses.'
            ], 403);
        }

        $course = $this->findOfflineCourseRecord($courseId);

        if (!$course) {
            return response()->json([
                'status' => false,
                'message' => 'Offline course not found'
            ], 404);
        }

        if ($shouldPublish && $this->offlineCourseApprovalStatus($course) !== self::APPROVAL_APPROVED) {
            return response()->json([
                'status' => false,
                'message' => 'This offline course must be approved before it can be published.'
            ], 422);
        }

        try {
            DB::table('courses')
                ->where('id', $courseId)
                ->update($this->filterExistingColumns('courses', [
                    'status' => $shouldPublish ? 1 : 0,
                    'publishedFlag' => $shouldPublish ? 1 : 0,
                    'publishedBy' => $shouldPublish ? (int) $user->id : null,
                    'publishedOn' => $shouldPublish ? now() : null,
                    'updatedOn' => now(),
                ]));

            $courseCode = EntityCodeService::assignIfMissing(
                'courses',
                $courseId,
                EntityCodeService::PREFIX_ACADEMIC_COURSE
            );

            return response()->json([
                'status' => true,
                'message' => $shouldPublish
                    ? 'Offline course published successfully'
                    : 'Offline course unpublished successfully',
                'data' => [
                    'id' => $courseId,
                    'code' => $courseCode,
                    'publishedFlag' => $shouldPublish ? 1 : 0,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating offline course publish status: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    private function findOfflineCourseRecord(int $courseId): ?object
    {
        return DB::table('courses')
            ->where('id', $courseId)
            ->where('courseType', 2)
            ->where('deletedFlag', 0)
            ->first();
    }

    private function offlineCourseApprovalStatus(object $course): string
    {
        $status = strtoupper((string) ($course->approvalStatus ?? self::APPROVAL_PENDING));

        return in_array($status, [
            self::APPROVAL_PENDING,
            self::APPROVAL_APPROVED,
            self::APPROVAL_REJECTED,
        ], true)
            ? $status
            : self::APPROVAL_PENDING;
    }

    private function offlineCourseBelongsToViewer(object $course, int $userId): bool
    {
        if ($userId <= 0) {
            return false;
        }

        if ((int) ($course->createdBy ?? 0) === $userId) {
            return true;
        }

        return DB::table('courseinstructors')
            ->where('courseId', (int) ($course->id ?? 0))
            ->where('instructorId', $userId)
            ->exists();
    }

    private function applyOfflineCourseMineScope($query, int $userId): void
    {
        $query->where(function ($mineQuery) use ($userId) {
            $mineQuery->where('c.createdBy', $userId)
                ->orWhereExists(function ($assignedQuery) use ($userId) {
                    $assignedQuery
                        ->select(DB::raw(1))
                        ->from('courseinstructors as my_ci')
                        ->whereColumn('my_ci.courseId', 'c.id')
                        ->where('my_ci.instructorId', $userId);
                });
        });
    }

    private function offlineCourseActionPermissions(object $course, $instructors, ?object $viewer): array
    {
        if (!$viewer) {
            return [
                'view' => false,
                'edit' => false,
                'approve' => false,
                'reject' => false,
                'publish' => false,
                'unpublish' => false,
            ];
        }

        $approvalStatus = $this->offlineCourseApprovalStatus($course);
        $publishedFlag = (int) ($course->publishedFlag ?? $course->status ?? 0) === 1;
        $canManageWorkflow = $this->canManageOfflineCourseWorkflow($viewer);
        $viewerId = (int) ($viewer->id ?? 0);
        $isCreatedByViewer = (int) ($course->createdBy ?? 0) === $viewerId;
        $isAssignedToViewer = collect($instructors)
            ->contains(fn($instructor) => (int) ($instructor['id'] ?? 0) === $viewerId);
        $isInstructor = $this->isInstructorUser($viewer);
        $canView = $canManageWorkflow || $isCreatedByViewer || $isAssignedToViewer;
        $canEdit = $canManageWorkflow || (
            $isInstructor
            && ($isCreatedByViewer || $isAssignedToViewer)
            && in_array($approvalStatus, [self::APPROVAL_PENDING, self::APPROVAL_REJECTED], true)
        );

        return [
            'view' => $canView,
            'edit' => $canEdit,
            'approve' => $canManageWorkflow && $approvalStatus === self::APPROVAL_PENDING,
            'reject' => $canManageWorkflow && $approvalStatus === self::APPROVAL_PENDING,
            'publish' => $canManageWorkflow && $approvalStatus === self::APPROVAL_APPROVED && !$publishedFlag,
            'unpublish' => $canManageWorkflow && $approvalStatus === self::APPROVAL_APPROVED && $publishedFlag,
        ];
    }

    private function canManageOfflineCourseWorkflow(object $user): bool
    {
        if ($this->isAdminUser($user)) {
            return true;
        }

        if ($this->isInstructorUser($user)) {
            return false;
        }

        $roleId = (int) ($user->role ?? 0);

        if ($roleId <= 0 || !Schema::hasTable('roles') || !Schema::hasTable('role_menu_permissions')) {
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

        $permissionCache[$roleId] = $this->roleHasAnyMenuPermission(
            $roleId,
            self::OFFLINE_COURSE_PERMISSION_ROUTES
        );

        return $permissionCache[$roleId];
    }

    private function roleHasAnyMenuPermission(int $roleId, array $routes): bool
    {
        $permission = DB::table('role_menu_permissions')
            ->where('roleId', $roleId)
            ->where('deletedFlag', 0)
            ->first();

        if (!$permission || !is_string($permission->permissionJson ?? null)) {
            return false;
        }

        $payload = json_decode($permission->permissionJson, true);

        if (!is_array($payload)) {
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

        if (empty($allowedMenuIds)) {
            return false;
        }

        $normalizedRoutes = collect($routes)
            ->map(fn($route) => $this->normalizeRoute($route))
            ->values()
            ->all();

        $allowedRouteSet = array_flip($normalizedRoutes);
        $allowedMenus = DB::table('menus')
            ->whereIn('id', $allowedMenuIds)
            ->where('deletedFlag', 0)
            ->pluck('url');

        return $allowedMenus
            ->contains(fn($url) => isset($allowedRouteSet[$this->normalizeRoute($url)]));
    }

    private function isAdminUser(object $user): bool
    {
        return (int) ($user->role ?? 0) === self::ROLE_ADMIN;
    }

    private function isInstructorUser(object $user): bool
    {
        return (int) ($user->role ?? 0) === self::ROLE_INSTRUCTOR;
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

    public function deleteOfflineCourse(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|exists:courses,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $updated = DB::table('courses')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', $request->user()->id)
                ->where('courseType', 2)
                ->where('deletedFlag', 0)
                ->update([
                    'deletedFlag' => 1,
                    'updatedOn' => now(),
                ]);

            if (!$updated) {
                return response()->json([
                    'status' => false,
                    'message' => 'Offline course not found'
                ], 404);
            }

            return response()->json([
                'status' => true,
                'message' => 'Offline course deleted successfully'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error deleting offline course: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getCourses(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'page' => 'nullable|integer|min:1',
            'perPage' => [
                'nullable',
                function ($attribute, $value, $fail) {
                    if ($value === null || $value === '' || $value === 'all') {
                        return;
                    }

                    if (
                        !filter_var($value, FILTER_VALIDATE_INT)
                        || !in_array((int) $value, [10, 20, 50, 100], true)
                    ) {
                        $fail('The per page value must be 10, 20, 50, 100, or all.');
                    }
                },
            ],
            'search' => 'nullable|string|max:100',
            'categoryId' => 'nullable',
            'categoryIds' => 'nullable|array',
            'categoryIds.*' => 'integer',
            'sortBy' => 'nullable|in:newest,popular,priceLowHigh,priceHighLow',
            'status' => 'nullable|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = $request->user();

            if (!$user) {
                return response()->json([
                    'status' => false,
                    'message' => 'Unauthenticated'
                ], 401);
            }

            $page = (int) $request->input('page', 1);
            $isAllPageSize = $request->input('perPage') === 'all';

            $query = $this->applyOnlineCourseScope(
                DB::table('courses as c')
                    ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
                    ->leftJoin('courses as parentCourse', 'parentCourse.id', '=', 'c.parentCourseId')
                    ->leftJoinSub(
                        DB::table('carts')
                            ->select('course_id', DB::raw('COUNT(*) as cart_count'))
                            ->groupBy('course_id'),
                        'coursePopularity',
                        'coursePopularity.course_id',
                        '=',
                        'c.id'
                    )
                    ->where('c.deletedFlag', 0),
                'c'
            )
                ->where('c.createdBy', $user->id)
                ->select(
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
                    'c.isSpecial',
                    'c.parentCourseId',
                    'parentCourse.title as parentCourseTitle',
                    $this->parentCourseCodeSelect(),
                    'c.status',
                    'c.courseType',
                    'c.createdOn',
                    'c.updatedOn',
                    DB::raw('COALESCE(coursePopularity.cart_count, 0) as popularityCount')
                );

            if ($request->filled('search')) {
                $search = trim((string) $request->input('search'));

                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('c.title', 'LIKE', '%' . $search . '%')
                        ->orWhere('c.description', 'LIKE', '%' . $search . '%');
                    EntityCodeService::orWhereCode($subQuery, 'courses', 'c.code', $search);
                });
            }

            if ($request->filled('categoryIds') && is_array($request->input('categoryIds'))) {
                $categoryIds = collect($request->input('categoryIds'))
                    ->map(fn($id) => (int) $id)
                    ->filter(fn($id) => $id > 0)
                    ->unique()
                    ->values()
                    ->all();

                if (!empty($categoryIds)) {
                    $query->whereIn('c.categoryId', $categoryIds);
                }
            } elseif ($request->filled('categoryId')) {
                $query->where('c.categoryId', (int) $request->input('categoryId'));
            }

            if ($request->input('status') !== null && $request->input('status') !== '') {
                $query->where('c.status', (int) $request->input('status'));
            }

            $summaryQuery = $this->applyOnlineCourseScope(
                DB::table('courses')
                    ->where('deletedFlag', 0)
            )
                ->where('createdBy', $user->id);

            $summary = [
                'totalCourses' => (clone $summaryQuery)->count(),
                'activeCourses' => (clone $summaryQuery)->where('status', 1)->count(),
                'inactiveCourses' => (clone $summaryQuery)->where('status', 0)->count(),
            ];

            $filteredTotal = (clone $query)->count();
            $perPage = $isAllPageSize
                ? max($filteredTotal, 1)
                : (int) $request->input('perPage', 10);

            $courses = $query
                ->when($request->input('sortBy', 'newest') === 'priceLowHigh', function ($sortQuery) {
                    $sortQuery->orderBy('c.price', 'ASC')->orderBy('c.id', 'DESC');
                })
                ->when($request->input('sortBy', 'newest') === 'priceHighLow', function ($sortQuery) {
                    $sortQuery->orderBy('c.price', 'DESC')->orderBy('c.id', 'DESC');
                })
                ->when($request->input('sortBy', 'newest') === 'popular', function ($sortQuery) {
                    $sortQuery->orderBy('popularityCount', 'DESC')->orderBy('c.id', 'DESC');
                })
                ->when($request->input('sortBy', 'newest') === 'newest', function ($sortQuery) {
                    $sortQuery->orderBy('c.id', 'DESC');
                })
                ->paginate($perPage, ['*'], 'page', $page);

            $courseIds = collect($courses->items())
                ->pluck('id')
                ->map(fn($id) => (int) $id)
                ->unique()
                ->values();

            $courseInstructorMap = $courseIds->isEmpty()
                ? collect()
                : DB::table('courseinstructors as ci')
                ->leftJoin('users as u', 'u.id', '=', 'ci.instructorId')
                ->whereIn('ci.courseId', $courseIds)
                ->select('ci.courseId', 'ci.instructorId', 'u.name')
                ->orderBy('ci.id')
                ->get()
                ->groupBy('courseId');

            $fallbackInstructorIds = collect($courses->items())
                ->flatMap(fn($course) => $this->normalizeInstructorIds($course->instructorIds ?? []))
                ->unique()
                ->values();

            $fallbackInstructors = $fallbackInstructorIds->isEmpty()
                ? collect()
                : DB::table('users')
                ->whereIn('id', $fallbackInstructorIds)
                ->pluck('name', 'id');

            $courses->getCollection()->transform(function ($course) use ($request, $courseInstructorMap, $fallbackInstructors) {
                $relationInstructors = collect($courseInstructorMap->get($course->id, []))
                    ->map(fn($instructor) => [
                        'id' => (int) $instructor->instructorId,
                        'name' => (string) ($instructor->name ?? 'Instructor')
                    ]);

                if ($relationInstructors->isNotEmpty()) {
                    $course->instructors = $relationInstructors->values()->all();
                } else {
                    $course->instructors = collect($this->normalizeInstructorIds($course->instructorIds ?? []))
                        ->map(fn($id) => [
                            'id' => (int) $id,
                            'name' => (string) ($fallbackInstructors[(int) $id] ?? 'Instructor')
                        ])
                        ->values()
                        ->all();
                }

                $course->instructorName = collect($course->instructors)
                    ->pluck('name')
                    ->filter()
                    ->join(', ');

                $course->thumbnailUrl = $course->thumbnail
                    ? $this->privateFileUrl($request, $course->thumbnail)
                    : null;

                $course->categoryName = $course->categoryName ?: 'Uncategorized';
                $course->statusLabel = ((int) $course->status) === 1 ? 'Active' : 'Inactive';
                $course->courseHighlights = $this->decodeCourseHighlights($course->courseHighlights ?? null);
                $course->isSpecial = (int) ($course->isSpecial ?? 0);
                $course->parentCourseId = empty($course->parentCourseId ?? null) ? null : (int) $course->parentCourseId;
                $course->parentCourseTitle = $course->parentCourseTitle ?? null;
                $course->parentCourseCode = $course->parentCourseCode ?? null;

                return $course;
            });

            return response()->json([
                'status' => true,
                'message' => 'Courses fetched successfully',
                'data' => $courses->items(),
                'meta' => [
                    'currentPage' => $courses->currentPage(),
                    'perPage' => $isAllPageSize ? 'all' : $courses->perPage(),
                    'total' => $courses->total(),
                    'lastPage' => $courses->lastPage(),
                    'from' => $courses->firstItem(),
                    'to' => $courses->lastItem(),
                ],
                'summary' => $summary,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching courses: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getAllCourses(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'page' => 'nullable|integer|min:1',
            'perPage' => [
                'nullable',
                function ($attribute, $value, $fail) {
                    if ($value === null || $value === '' || $value === 'all') {
                        return;
                    }

                    if (
                        !filter_var($value, FILTER_VALIDATE_INT)
                        || !in_array((int) $value, [10, 20, 50, 100], true)
                    ) {
                        $fail('The per page value must be 10, 20, 50, 100, or all.');
                    }
                },
            ],
            'search' => 'nullable|string|max:100',
            'categoryIds' => 'nullable|array',
            'categoryIds.*' => 'integer',
            'sortBy' => 'nullable|in:newest,popular,priceLowHigh,priceHighLow',
            'status' => 'nullable|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            if (!$request->user()) {
                return response()->json([
                    'status' => false,
                    'message' => 'Unauthenticated'
                ], 401);
            }

            $page = (int) $request->input('page', 1);
            $isAllPageSize = $request->input('perPage') === 'all';

            $query = $this->applyOnlineCourseScope(
                DB::table('courses as c')
                    ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
                    ->leftJoin('users as creator', 'creator.id', '=', 'c.createdBy')
                    ->leftJoin('courses as parentCourse', 'parentCourse.id', '=', 'c.parentCourseId')
                    ->leftJoinSub(
                        DB::table('carts')
                            ->select('course_id', DB::raw('COUNT(*) as cart_count'))
                            ->groupBy('course_id'),
                        'coursePopularity',
                        'coursePopularity.course_id',
                        '=',
                        'c.id'
                    )
                    ->where('c.deletedFlag', 0),
                'c'
            )
                ->select(
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
                    'c.isSpecial',
                    'c.parentCourseId',
                    'parentCourse.title as parentCourseTitle',
                    $this->parentCourseCodeSelect(),
                    'c.status',
                    'c.courseType',
                    'c.createdOn',
                    'c.updatedOn',
                    'c.createdBy',
                    'creator.name as createdByName',
                    'creator.email as createdByEmail',
                    DB::raw('COALESCE(coursePopularity.cart_count, 0) as popularityCount')
                );

            if ($request->filled('search')) {
                $search = trim((string) $request->input('search'));

                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('c.title', 'LIKE', '%' . $search . '%')
                        ->orWhere('c.description', 'LIKE', '%' . $search . '%')
                        ->orWhere('creator.name', 'LIKE', '%' . $search . '%')
                        ->orWhere('creator.email', 'LIKE', '%' . $search . '%');
                    EntityCodeService::orWhereCode($subQuery, 'courses', 'c.code', $search);
                });
            }

            if ($request->filled('categoryIds') && is_array($request->input('categoryIds'))) {
                $categoryIds = collect($request->input('categoryIds'))
                    ->map(fn($id) => (int) $id)
                    ->filter(fn($id) => $id > 0)
                    ->unique()
                    ->values()
                    ->all();

                if (!empty($categoryIds)) {
                    $query->whereIn('c.categoryId', $categoryIds);
                }
            }

            if ($request->input('status') !== null && $request->input('status') !== '') {
                $query->where('c.status', (int) $request->input('status'));
            }

            $summaryQuery = $this->applyOnlineCourseScope(
                DB::table('courses')
                    ->where('deletedFlag', 0)
            );

            $summary = [
                'totalCourses' => (clone $summaryQuery)->count(),
                'activeCourses' => (clone $summaryQuery)->where('status', 1)->count(),
                'inactiveCourses' => (clone $summaryQuery)->where('status', 0)->count(),
            ];

            $filteredTotal = (clone $query)->count();
            $perPage = $isAllPageSize
                ? max($filteredTotal, 1)
                : (int) $request->input('perPage', 10);

            $courses = $query
                ->when($request->input('sortBy', 'newest') === 'priceLowHigh', function ($sortQuery) {
                    $sortQuery->orderBy('c.price', 'ASC')->orderBy('c.id', 'DESC');
                })
                ->when($request->input('sortBy', 'newest') === 'priceHighLow', function ($sortQuery) {
                    $sortQuery->orderBy('c.price', 'DESC')->orderBy('c.id', 'DESC');
                })
                ->when($request->input('sortBy', 'newest') === 'popular', function ($sortQuery) {
                    $sortQuery->orderBy('popularityCount', 'DESC')->orderBy('c.id', 'DESC');
                })
                ->when($request->input('sortBy', 'newest') === 'newest', function ($sortQuery) {
                    $sortQuery->orderBy('c.id', 'DESC');
                })
                ->paginate($perPage, ['*'], 'page', $page);

            $courseIds = collect($courses->items())
                ->pluck('id')
                ->map(fn($id) => (int) $id)
                ->unique()
                ->values();

            $courseInstructorMap = $courseIds->isEmpty()
                ? collect()
                : DB::table('courseinstructors as ci')
                ->leftJoin('users as u', 'u.id', '=', 'ci.instructorId')
                ->whereIn('ci.courseId', $courseIds)
                ->select('ci.courseId', 'ci.instructorId', 'u.name')
                ->orderBy('ci.id')
                ->get()
                ->groupBy('courseId');

            $fallbackInstructorIds = collect($courses->items())
                ->flatMap(fn($course) => $this->normalizeInstructorIds($course->instructorIds ?? []))
                ->unique()
                ->values();

            $fallbackInstructors = $fallbackInstructorIds->isEmpty()
                ? collect()
                : DB::table('users')
                ->whereIn('id', $fallbackInstructorIds)
                ->pluck('name', 'id');

            $courses->getCollection()->transform(function ($course) use ($request, $courseInstructorMap, $fallbackInstructors) {
                $relationInstructors = collect($courseInstructorMap->get($course->id, []))
                    ->map(fn($instructor) => [
                        'id' => (int) $instructor->instructorId,
                        'name' => (string) ($instructor->name ?? 'Instructor')
                    ]);

                if ($relationInstructors->isNotEmpty()) {
                    $course->instructors = $relationInstructors->values()->all();
                } else {
                    $course->instructors = collect($this->normalizeInstructorIds($course->instructorIds ?? []))
                        ->map(fn($id) => [
                            'id' => (int) $id,
                            'name' => (string) ($fallbackInstructors[(int) $id] ?? 'Instructor')
                        ])
                        ->values()
                        ->all();
                }

                $course->instructorName = collect($course->instructors)
                    ->pluck('name')
                    ->filter()
                    ->join(', ');

                $course->thumbnailUrl = $course->thumbnail
                    ? $this->privateFileUrl($request, $course->thumbnail)
                    : null;

                $course->categoryName = $course->categoryName ?: 'Uncategorized';
                $course->statusLabel = ((int) $course->status) === 1 ? 'Active' : 'Inactive';
                $course->createdByName = $course->createdByName ?: 'Unknown User';
                $course->courseHighlights = $this->decodeCourseHighlights($course->courseHighlights ?? null);
                $course->isSpecial = (int) ($course->isSpecial ?? 0);
                $course->parentCourseId = empty($course->parentCourseId ?? null) ? null : (int) $course->parentCourseId;
                $course->parentCourseTitle = $course->parentCourseTitle ?? null;
                $course->parentCourseCode = $course->parentCourseCode ?? null;

                return $course;
            });

            return response()->json([
                'status' => true,
                'message' => 'All courses fetched successfully',
                'data' => $courses->items(),
                'meta' => [
                    'currentPage' => $courses->currentPage(),
                    'perPage' => $isAllPageSize ? 'all' : $courses->perPage(),
                    'total' => $courses->total(),
                    'lastPage' => $courses->lastPage(),
                    'from' => $courses->firstItem(),
                    'to' => $courses->lastItem(),
                ],
                'summary' => $summary,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching all courses: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function getCourseById(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|exists:courses,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            if (!$request->user()) {
                return response()->json([
                    'status' => false,
                    'message' => 'Unauthenticated'
                ], 401);
            }

            $course = $this->applyOnlineCourseScope(
                DB::table('courses as c')
                    ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
                    ->leftJoin('users as creator', 'creator.id', '=', 'c.createdBy')
                    ->where('c.id', (int) $request->input('id'))
                    ->where('c.deletedFlag', 0),
                'c'
            )
                ->select(
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
                    'c.createdOn',
                    'c.updatedOn',
                    'c.createdBy',
                    'creator.name as createdByName',
                    'creator.email as createdByEmail'
                )
                ->first();

            if (!$course) {
                return response()->json([
                    'status' => false,
                    'message' => 'Course not found'
                ], 404);
            }

            $instructorIds = $this->normalizeInstructorIds($course->instructorIds ?? []);
            $instructorNames = empty($instructorIds)
                ? collect()
                : DB::table('users')->whereIn('id', $instructorIds)->pluck('name', 'id');

            $course->instructors = collect($instructorIds)
                ->map(fn($id) => [
                    'id' => (int) $id,
                    'name' => (string) ($instructorNames[(int) $id] ?? 'Instructor')
                ])
                ->values()
                ->all();
            $course->instructorName = collect($course->instructors)->pluck('name')->filter()->join(', ');
            $course->thumbnailUrl = $course->thumbnail
                ? $this->privateFileUrl($request, $course->thumbnail)
                : null;
            $course->categoryName = $course->categoryName ?: 'Uncategorized';
            $course->statusLabel = ((int) $course->status) === 1 ? 'Active' : 'Inactive';
            $course->createdByName = $course->createdByName ?: 'Unknown User';
            $course->courseHighlights = $this->decodeCourseHighlights($course->courseHighlights ?? null);

            return response()->json([
                'status' => true,
                'message' => 'Course fetched successfully',
                'data' => $course
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching course by id: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function updateCourse(Request $request)
    {
        $this->prepareCourseHighlightsForValidation($request);

        $validator = Validator::make($request->all(), [
            'id' => 'required|integer',
            'title' => [
                'required',
                'string',
                'min:5',
                'max:100'
            ],
            'category' => 'required|integer|exists:coursecategories,id',
            'instructor' => 'required|string',
            'duration' => 'required|integer|min:1',
            'durationUnit' => 'required|integer|in:1,2',
            'price' => 'required|numeric|min:0',
            'oldPrice' => 'nullable|numeric|min:0',
            'description' => [
                'required',
                'string',
                'min:20',
                'max:300'
            ],
            'courseHighlights' => 'nullable|array',
            'courseHighlights.*' => 'string',
            'thumbnail' => 'nullable|image|mimes:png,jpg,jpeg,webp|max:2048',
            'status' => 'required|in:0,1'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        $courseId = (int) $request->input('id');
        $instructorIds = $this->normalizeInstructorIds($request->input('instructor'));

        if (empty($instructorIds)) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'instructor' => ['Please select at least one instructor.']
                ]
            ], 422);
        }

        DB::beginTransaction();

        try {
            $course = $this->applyOnlineCourseScope(
                DB::table('courses')
                    ->where('id', $courseId)
                    ->where('deletedFlag', 0)
            )
                ->where('createdBy', $user->id)
                ->first();

            if (!$course) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Course not found'
                ], 404);
            }

            $thumbnailPath = $course->thumbnail;

            if ($request->hasFile('thumbnail')) {
                if ($thumbnailPath && Storage::disk('private')->exists($thumbnailPath)) {
                    Storage::disk('private')->delete($thumbnailPath);
                }

                $file = $request->file('thumbnail');
                $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
                $thumbnailPath = $file->storeAs(
                    'course-thumbnails',
                    $fileName,
                    'private'
                );
            }

            $courseHighlights = $this->normalizeCourseHighlights($request->input('courseHighlights', []));

            DB::table('courses')
                ->where('id', $courseId)
                ->update([
                    'title' => $request->title,
                    'categoryId' => (int) $request->category,
                    'instructorIds' => json_encode($instructorIds),
                    'duration' => (int) $request->duration,
                    'durationUnit' => (int) $request->durationUnit,
                    'price' => $request->price,
                    'oldPrice' => $request->oldPrice,
                    'description' => $request->description,
                    'courseHighlights' => !empty($courseHighlights) ? json_encode($courseHighlights) : null,
                    'thumbnail' => $thumbnailPath,
                    'status' => $request->status,
                    'updatedOn' => now()
                ]);

            DB::table('courseinstructors')
                ->where('courseId', $courseId)
                ->delete();

            foreach ($instructorIds as $instructorId) {
                DB::table('courseinstructors')
                    ->insert([
                        'courseId' => $courseId,
                        'instructorId' => $instructorId,
                        'createdOn' => now()
                    ]);
            }

            $courseCode = EntityCodeService::assignIfMissing(
                'courses',
                $courseId,
                EntityCodeService::PREFIX_MAIN_COURSE
            );

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Course updated successfully',
                'data' => [
                    'id' => $courseId,
                    'code' => $courseCode,
                ],
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating course: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
