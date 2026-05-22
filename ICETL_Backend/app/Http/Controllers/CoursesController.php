<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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

            $query = DB::table('coursecategories');

            // Search
            if ($request->search) {

                $query->where(
                    'categoryName',
                    'LIKE',
                    '%' . $request->search . '%'
                );
            }

            // Status Filter
            if ($request->status != '') {

                $query->where('status', $request->status);
            }

            $categories = $query
                ->orderBy('id', 'DESC')
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

    public function createCourse(Request $request)
    {

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
            'durationUnit' => 'required|in:weeks,months',
            'price' => 'required|numeric|min:0',
            'oldPrice' => 'nullable|numeric|min:0',
            'students' => 'nullable|integer|min:0',
            'description' => [
                'required',
                'string',
                'min:20',
                'max:300'
            ],
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

            // Insert Data
            $courseId = DB::table('courses')->insertGetId([
                'title' => $request->title,
                'categoryId' => $request->category,
                'instructorIds' => json_encode($instructorIds),
                'duration' => (int) $request->duration,
                'durationUnit' => $request->durationUnit,
                'price' => $request->price,
                'oldPrice' => $request->oldPrice,
                'description' => $request->description,
                'thumbnail' => $thumbnailPath,
                'status' => $request->status,
                'createdBy' => $ProfileData ? Crypt::decryptString($ProfileData['id']) : null,
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

            $query = DB::table('courses as c')
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
                ->where('c.deletedFlag', 0)
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
                    'c.thumbnail',
                    'c.status',
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

            $summaryQuery = DB::table('courses')
                ->where('deletedFlag', 0)
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

            $query = DB::table('courses as c')
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
                ->where('c.deletedFlag', 0)
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
                    'c.thumbnail',
                    'c.status',
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

            $summaryQuery = DB::table('courses')
                ->where('deletedFlag', 0);

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

    public function updateCourse(Request $request)
    {
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
            'durationUnit' => 'required|in:weeks,months',
            'price' => 'required|numeric|min:0',
            'oldPrice' => 'nullable|numeric|min:0',
            'description' => [
                'required',
                'string',
                'min:20',
                'max:300'
            ],
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
            $course = DB::table('courses')
                ->where('id', $courseId)
                ->where('deletedFlag', 0)
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

            DB::table('courses')
                ->where('id', $courseId)
                ->update([
                    'title' => $request->title,
                    'categoryId' => (int) $request->category,
                    'instructorIds' => json_encode($instructorIds),
                    'duration' => (int) $request->duration,
                    'durationUnit' => $request->durationUnit,
                    'price' => $request->price,
                    'oldPrice' => $request->oldPrice,
                    'description' => $request->description,
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
