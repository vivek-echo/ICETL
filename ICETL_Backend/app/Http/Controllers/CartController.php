<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class CartController extends Controller
{
    public function getCartItems(Request $request)
    {
        try {
            $items = $this->cartItemsQuery($request)
                ->orderBy('cart.id', 'DESC')
                ->get();

            return response()->json([
                'status' => true,
                'message' => 'Cart items fetched successfully',
                'data' => $this->formatCartItems($request, $items),
                'summary' => [
                    'totalItems' => $items->count(),
                    'totalAmount' => $items->sum(fn($item) => (float) ($item->price ?? 0)),
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching cart items: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch cart items',
            ], 500);
        }
    }

    public function addToCart(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'courseId' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $courseId = (int) $request->input('courseId');
            $courseExists = DB::table('courses')
                ->where('id', $courseId)
                ->where('deletedFlag', 0)
                ->where('status', 1)
                ->exists();

            if (!$courseExists) {
                return response()->json([
                    'status' => false,
                    'message' => 'Course not found or inactive',
                ], 404);
            }

            DB::table('carts')->insertOrIgnore([
                'user_id' => $request->user()->id,
                'course_id' => $courseId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $items = $this->cartItemsQuery($request)->orderBy('cart.id', 'DESC')->get();

            return response()->json([
                'status' => true,
                'message' => 'Course added to cart',
                'data' => $this->formatCartItems($request, $items),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error adding course to cart: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to add course to cart',
            ], 500);
        }
    }

    public function removeFromCart(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'courseId' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::table('carts')
                ->where('user_id', $request->user()->id)
                ->where('course_id', (int) $request->input('courseId'))
                ->delete();

            $items = $this->cartItemsQuery($request)->orderBy('cart.id', 'DESC')->get();

            return response()->json([
                'status' => true,
                'message' => 'Course removed from cart',
                'data' => $this->formatCartItems($request, $items),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error removing course from cart: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to remove course from cart',
            ], 500);
        }
    }

    public function clearCart(Request $request)
    {
        try {
            DB::table('carts')
                ->where('user_id', $request->user()->id)
                ->delete();

            return response()->json([
                'status' => true,
                'message' => 'Cart cleared successfully',
                'data' => [],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error clearing cart: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to clear cart',
            ], 500);
        }
    }

    private function cartItemsQuery(Request $request)
    {
        return DB::table('carts as cart')
            ->join('courses as c', 'c.id', '=', 'cart.course_id')
            ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
            ->where('cart.user_id', $request->user()->id)
            ->where('c.deletedFlag', 0)
            ->select(
                'cart.id as cartId',
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
                'c.status'
            );
    }

    private function formatCartItems(Request $request, $items): array
    {
        $courseIds = $items
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

        $fallbackInstructorIds = $items
            ->flatMap(fn($course) => $this->normalizeInstructorIds($course->instructorIds ?? []))
            ->unique()
            ->values();

        $fallbackInstructors = $fallbackInstructorIds->isEmpty()
            ? collect()
            : DB::table('users')
                ->whereIn('id', $fallbackInstructorIds)
                ->pluck('name', 'id');

        return $items->map(function ($course) use ($request, $courseInstructorMap, $fallbackInstructors) {
            $relationInstructors = collect($courseInstructorMap->get($course->id, []))
                ->map(fn($instructor) => [
                    'id' => (int) $instructor->instructorId,
                    'name' => (string) ($instructor->name ?? 'Instructor'),
                ]);

            $instructors = $relationInstructors->isNotEmpty()
                ? $relationInstructors
                : collect($this->normalizeInstructorIds($course->instructorIds ?? []))
                    ->map(fn($id) => [
                        'id' => (int) $id,
                        'name' => (string) ($fallbackInstructors[(int) $id] ?? 'Instructor'),
                    ]);

            return [
                'cartId' => (int) $course->cartId,
                'id' => (int) $course->id,
                'title' => $course->title,
                'categoryName' => $course->categoryName ?: 'Uncategorized',
                'instructorName' => $instructors->pluck('name')->filter()->join(', '),
                'duration' => $course->duration,
                'durationUnit' => $course->durationUnit,
                'price' => $course->price,
                'oldPrice' => $course->oldPrice,
                'description' => $course->description,
                'courseHighlights' => $this->decodeCourseHighlights($course->courseHighlights ?? null),
                'thumbnailUrl' => $course->thumbnail
                    ? $this->privateFileUrl($request, $course->thumbnail)
                    : null,
                'status' => $course->status,
            ];
        })->values()->all();
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

        return collect(is_array($decodedValue) ? $decodedValue : [])
            ->map(fn($id) => (int) $id)
            ->filter(fn($id) => $id > 0)
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
            ->filter(fn($item) => is_string($item) || is_numeric($item))
            ->map(fn($item) => trim((string) $item))
            ->filter(fn($item) => $item !== '')
            ->values()
            ->all();
    }
}
