<?php

namespace App\Http\Controllers;

use App\Models\User;
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
                $courseCountQuery = $this->applyOnlineCourseScope(
                    DB::table('courses')
                        ->select('categoryId', DB::raw('COUNT(*) as courseCount'))
                        ->where('deletedFlag', 0)
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
            'title' => (string) $course->title,
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

            $query = $this->applyOnlineCourseScope(
                DB::table('courses as c')
                    ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
                    ->where('c.deletedFlag', 0),
                'c'
            )
                ->where('c.status', 1)
                ->select(
                    'c.id',
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
                        ->orWhere('cc.categoryName', 'LIKE', '%' . $search . '%');
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

            $summaryQuery = $this->applyOnlineCourseScope(
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
                'createdBy' => $this->resolveCreatedById($request, $ProfileData),
                'createdByRoleId' => $ProfileData ? $ProfileData['role'] : null,
                'deletedFlag' => 0,
                'createdOn' => now()
            ]);

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
                'message' => 'Course created successfully'
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
            'instructor' => 'required',
            'venue' => ['required', 'string', 'min:3', 'max:150'],
            'city' => ['required', 'string', 'min:2', 'max:100'],
            'startDate' => 'required|date',
            'endDate' => 'nullable|date|after_or_equal:startDate',
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
            $request->filled('endDate')
            && $request->input('endDate') === $request->input('startDate')
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

        if (empty($instructorIds)) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'instructor' => ['Please select at least one valid instructor.']
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

            $courseId = DB::table('courses')->insertGetId([
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
                'status' => (int) $request->input('status'),
                'courseType' => 2,
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
                'deletedFlag' => 0,
                'createdOn' => now(),
            ]);

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
                    'id' => $courseId
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
                'status' => 'nullable|in:0,1',
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
                $query->where('c.createdBy', (int) $user->id);
                $summaryQuery->where('c.createdBy', (int) $user->id);
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
            $data = $courseItems
                ->map(fn($course) => $this->formatOfflineCourse(
                    $course,
                    $courseInstructorMap,
                    $fallbackInstructors
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
            ->where('c.deletedFlag', 0)
            ->where('c.courseType', 2)
            ->select(
                'c.id',
                'c.title',
                'c.categoryId',
                'cc.categoryName as categoryName',
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
                'creator.name as createdByName',
                'creator.email as createdByEmail',
                'c.createdOn',
                'c.updatedOn'
            );
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

        if ($request->input('status') !== null && $request->input('status') !== '') {
            $query->where('c.status', (int) $request->input('status'));
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

    private function formatOfflineCourse(object $course, $courseInstructorMap, $fallbackInstructors): array
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

        return [
            'id' => (int) $course->id,
            'title' => (string) $course->title,
            'categoryId' => $course->categoryId ? (int) $course->categoryId : null,
            'categoryName' => $course->categoryName ?: 'Uncategorized',
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
            'scheduleStatus' => $this->getOfflineCourseScheduleStatus($startDate, $endDate),
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
            'createdByName' => $course->createdByName ?: 'Unknown User',
            'createdByEmail' => $course->createdByEmail,
            'createdOn' => $course->createdOn,
            'updatedOn' => $course->updatedOn,
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
        ]);

        $validator = Validator::make($request->all(), [
            'courseId' => 'required|integer|exists:courses,id',
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'email' => ['required', 'email', 'max:191'],
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
            $student = DB::table('users')
                ->where('email', $email)
                ->where('userType', 1)
                ->where('role', 2)
                ->where('deletedFlag', 0)
                ->lockForUpdate()
                ->first();

            $studentId = $student
                ? (int) $student->id
                : DB::table('users')->insertGetId($this->filterExistingColumns('users', [
                    'name' => trim((string) $request->input('name')),
                    'email' => $email,
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
                'subtotalAmount' => $totalFee,
                'taxAmount' => 0,
                'totalAmount' => $totalFee,
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
                'price' => $totalFee,
                'taxAmount' => 0,
                'totalAmount' => $totalFee,
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

            DB::table('enrollments')->insert([
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

            $invoiceId = DB::table('invoices')->insertGetId([
                'userId' => $studentId,
                'orderId' => $orderId,
                'paymentId' => $paymentId,
                'invoiceNumber' => $this->offlineEnrollmentReference('OFFINV'),
                'invoiceDate' => now()->toDateString(),
                'customerName' => $student ? $student->name : trim((string) $request->input('name')),
                'customerEmail' => $email,
                'customerPhone' => $student->phone ?? null,
                'gstNumber' => null,
                'subtotal' => $totalFee,
                'tax' => 0,
                'grandTotal' => $totalFee,
                'currency' => 'INR',
                'paymentReference' => $transactionNo ?: $referenceNo,
                'pdfPath' => null,
                'invoiceData' => null,
                'deletedFlag' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $invoiceNumber = $this->offlineEnrollmentInvoiceNumber($invoiceId);
            $invoiceData = $this->offlineEnrollmentInvoiceData(
                $invoiceNumber,
                $orderId,
                $paymentId,
                $studentId,
                $course,
                $request,
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
                'userId' => $studentId,
                'courseId' => (int) $course->id,
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
                'eventType' => 'offline.manual_enrollment',
                'gateway' => 'offline',
                'status' => $paymentStatus,
                'totalFee' => $totalFee,
                'amountPaid' => $amountPaid,
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
                    DB::table('offline_course_installments')->insert([
                        'paymentLogId' => $paymentLogId,
                        'userId' => $studentId,
                        'courseId' => (int) $course->id,
                        'installmentNo' => (int) $installment['installmentNo'],
                        'amount' => $installment['amount'],
                        'expectedDate' => $installment['expectedDate'],
                        'paidDate' => $installment['status'] === 'PAID' ? now()->toDateString() : null,
                        'status' => $installment['status'],
                        'deletedFlag' => 0,
                        'createdOn' => now(),
                        'updatedOn' => null,
                    ]);
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

        return collect($installments)
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
                    'title' => (string) $course->title,
                    'categoryName' => $course->categoryName ?? 'Offline Course',
                    'price' => $totalFee,
                    'taxAmount' => 0,
                    'totalAmount' => $totalFee,
                ],
            ],
            'subtotal' => $totalFee,
            'tax' => 0,
            'totalAmount' => $totalFee,
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

        try {
            $updated = DB::table('courses')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', $request->user()->id)
                ->where('courseType', 2)
                ->where('deletedFlag', 0)
                ->update([
                    'status' => (int) $request->input('status'),
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
                'message' => 'Offline course status updated successfully'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating offline course status: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
                'error' => $e->getMessage()
            ], 500);
        }
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
                    DB::raw('COALESCE(coursePopularity.cart_count, 0) as popularityCount')
                );

            if ($request->filled('search')) {
                $search = trim((string) $request->input('search'));

                $query->where(function ($subQuery) use ($search) {
                    $subQuery->where('c.title', 'LIKE', '%' . $search . '%')
                        ->orWhere('c.description', 'LIKE', '%' . $search . '%');
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

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Course updated successfully'
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
