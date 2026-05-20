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
            $instructorIds = json_decode(
                $request->instructor,
                true
            );
            // Insert Data
            $courseId = DB::table('courses')->insertGetId([
                'title' => $request->title,
                'categoryId' => $request->category,
                'instructorIds' => json_encode($instructorIds),
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
}
