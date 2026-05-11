<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
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
                'unique:courseCategories,categoryName'
            ],
            'status' => 'required|in:0,1',
            'icon' => 'nullable|image|mimes:png,jpg,jpeg,svg|max:2048'
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
            $inserted = DB::table('courseCategories')->insert([
                'categoryName' => $request->categoryName,
                'slug' => Str::slug($request->categoryName),
                'status' => $request->status,
                'icon' => $iconPath,
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

            $query = DB::table('courseCategories');

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
            'id' => 'required|integer|exists:courseCategories,id',
            'categoryName' => [
                'required',
                'string',
                'min:3',
                'max:50',
                'regex:/^[a-zA-Z\s]+$/',
                Rule::unique('courseCategories', 'categoryName')->ignore($categoryId, 'id')
            ],
            'status' => 'required|in:0,1',
            'icon' => 'nullable|image|mimes:png,jpg,jpeg,svg|max:2048'
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
            $category = DB::table('courseCategories')
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

            DB::table('courseCategories')
                ->where('id', $categoryId)
                ->update([
                    'categoryName' => $request->categoryName,
                    'slug' => Str::slug($request->categoryName),
                    'status' => $request->status,
                    'icon' => $iconPath,
                    'updated_at' => now()
                ]);

            $updatedCategory = DB::table('courseCategories')
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
            'id' => 'required|integer|exists:courseCategories,id'
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
            $category = DB::table('courseCategories')
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

            DB::table('courseCategories')
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
}
