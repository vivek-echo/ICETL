<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class CurriculumController extends Controller
{
    public function addSection(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'courseId' => 'required|integer|min:1',
            'title' => 'required|string|max:255',
            'objective' => 'nullable|string',
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
            $courseId = (int) $request->input('courseId');

            $courseExists = DB::table('courses')
                ->where('id', $courseId)
                ->where('deletedFlag', 0)
                ->exists();

            if (!$courseExists) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Course not found',
                ], 404);
            }

            $nextSortOrder = ((int) DB::table('course_sections')
                ->where('courseId', $courseId)
                ->where('deletedFlag', 0)
                ->max('sortOrder')) + 1;

            $sectionId = DB::table('course_sections')->insertGetId([
                'courseId' => $courseId,
                'title' => trim((string) $request->input('title')),
                'objective' => $request->input('objective'),
                'sortOrder' => $nextSortOrder,
                'status' => 1,
                'deletedFlag' => 0,
                'createdAt' => now(),
                'updatedAt' => now(),
            ]);

            $section = $this->getSectionById($sectionId);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Section added successfully',
                'data' => $section,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error adding curriculum section: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to add section',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function listSections(Request $request)
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

            $sections = DB::table('course_sections')
                ->where('courseId', $courseId)
                ->where('deletedFlag', 0)
                ->orderBy('sortOrder', 'ASC')
                ->orderBy('id', 'ASC')
                ->get();

            $sectionIds = $sections->pluck('id')->map(fn($id) => (int) $id)->values();

            $itemsBySection = $sectionIds->isEmpty()
                ? collect()
                : DB::table('course_curriculum_items')
                    ->whereIn('sectionId', $sectionIds)
                    ->where('deletedFlag', 0)
                    ->orderBy('sortOrder', 'ASC')
                    ->orderBy('id', 'ASC')
                    ->get()
                    ->groupBy('sectionId');

            $data = $sections->map(function ($section) use ($itemsBySection) {
                return $this->formatSection($section, $itemsBySection->get($section->id, collect()));
            })->values();

            return response()->json([
                'status' => true,
                'message' => 'Sections fetched successfully',
                'data' => $data,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching curriculum sections: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch sections',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateSection(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|min:1',
            'title' => 'required|string|max:255',
            'objective' => 'nullable|string',
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
            $sectionId = (int) $request->input('id');

            $sectionExists = DB::table('course_sections')
                ->where('id', $sectionId)
                ->where('deletedFlag', 0)
                ->exists();

            if (!$sectionExists) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Section not found',
                ], 404);
            }

            DB::table('course_sections')
                ->where('id', $sectionId)
                ->update([
                    'title' => trim((string) $request->input('title')),
                    'objective' => $request->input('objective'),
                    'updatedAt' => now(),
                ]);

            $section = $this->getSectionById($sectionId);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Section updated successfully',
                'data' => $section,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating curriculum section: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to update section',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function deleteSection(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|min:1',
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
            $sectionId = (int) $request->input('id');

            $sectionExists = DB::table('course_sections')
                ->where('id', $sectionId)
                ->where('deletedFlag', 0)
                ->exists();

            if (!$sectionExists) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Section not found',
                ], 404);
            }

            DB::table('course_sections')
                ->where('id', $sectionId)
                ->update([
                    'deletedFlag' => 1,
                    'updatedAt' => now(),
                ]);

            DB::table('course_curriculum_items')
                ->where('sectionId', $sectionId)
                ->where('deletedFlag', 0)
                ->update([
                    'deletedFlag' => 1,
                    'updatedAt' => now(),
                ]);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Section deleted successfully',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting curriculum section: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to delete section',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateSectionOrder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'data' => 'required|array',
            'data.*.id' => 'required|integer|min:1',
            'data.*.sortOrder' => 'required|integer|min:1',
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
            foreach ($request->input('data') as $section) {
                DB::table('course_sections')
                    ->where('id', (int) $section['id'])
                    ->where('deletedFlag', 0)
                    ->update([
                        'sortOrder' => (int) $section['sortOrder'],
                        'updatedAt' => now(),
                    ]);
            }

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Section order updated successfully',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating curriculum section order: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to update section order',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function uploadItemVideo(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'video' => 'required|file|mimes:mp4,mov,webm|max:2097152',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $file = $request->file('video');
            $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $filePath = $file->storeAs('curriculum-videos', $fileName, 'private');

            if (!$filePath) {
                throw new \RuntimeException('Unable to store curriculum video.');
            }

            return response()->json([
                'status' => true,
                'message' => 'Video uploaded successfully',
                'data' => [
                    'fileUrl' => $filePath,
                    'fileName' => $fileName,
                    'originalName' => $file->getClientOriginalName(),
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error uploading curriculum video: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to upload video',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function addItem(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'sectionId' => 'required|integer|min:1',
            'title' => 'required|string|max:255',
            'type' => 'required|string|max:50',
            'contentType' => 'nullable|string|max:50',
            'youtubeUrl' => 'nullable|string',
            'youtubeVideoId' => 'nullable|string|max:100',
            'fileUrl' => 'nullable|string',
            'description' => 'nullable|string',
            'duration' => 'nullable|string|max:100',
            'isPreview' => 'nullable|boolean',
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
            $sectionId = (int) $request->input('sectionId');

            $sectionExists = DB::table('course_sections')
                ->where('id', $sectionId)
                ->where('deletedFlag', 0)
                ->exists();

            if (!$sectionExists) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Section not found',
                ], 404);
            }

            $nextSortOrder = ((int) DB::table('course_curriculum_items')
                ->where('sectionId', $sectionId)
                ->where('deletedFlag', 0)
                ->max('sortOrder')) + 1;

            $itemId = DB::table('course_curriculum_items')->insertGetId([
                'sectionId' => $sectionId,
                'title' => trim((string) $request->input('title')),
                'type' => $this->normalizeItemType($request->input('type')),
                'contentType' => $this->normalizeContentType($request->input('contentType')),
                'youtubeUrl' => $request->input('youtubeUrl'),
                'youtubeVideoId' => $request->input('youtubeVideoId'),
                'fileUrl' => $request->input('fileUrl'),
                'description' => $request->input('description'),
                'duration' => $request->input('duration'),
                'isPreview' => $request->boolean('isPreview') ? 1 : 0,
                'sortOrder' => $nextSortOrder,
                'status' => 1,
                'deletedFlag' => 0,
                'createdAt' => now(),
                'updatedAt' => now(),
            ]);

            $item = $this->getItemById($itemId);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Curriculum item added successfully',
                'data' => $item,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error adding curriculum item: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to add curriculum item',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function listItems(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'sectionId' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $items = DB::table('course_curriculum_items')
                ->where('sectionId', (int) $request->input('sectionId'))
                ->where('deletedFlag', 0)
                ->orderBy('sortOrder', 'ASC')
                ->orderBy('id', 'ASC')
                ->get()
                ->map(fn($item) => $this->formatItem($item))
                ->values();

            return response()->json([
                'status' => true,
                'message' => 'Curriculum items fetched successfully',
                'data' => $items,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching curriculum items: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch curriculum items',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateItem(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|min:1',
            'title' => 'nullable|string|max:255',
            'type' => 'nullable|string|max:50',
            'contentType' => 'nullable|string|max:50',
            'youtubeUrl' => 'nullable|string',
            'youtubeVideoId' => 'nullable|string|max:100',
            'fileUrl' => 'nullable|string',
            'description' => 'nullable|string',
            'duration' => 'nullable|string|max:100',
            'isPreview' => 'nullable|boolean',
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
            $itemId = (int) $request->input('id');

            $itemExists = DB::table('course_curriculum_items')
                ->where('id', $itemId)
                ->where('deletedFlag', 0)
                ->exists();

            if (!$itemExists) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Curriculum item not found',
                ], 404);
            }

            $updateData = ['updatedAt' => now()];

            foreach (['youtubeUrl', 'youtubeVideoId', 'fileUrl', 'description', 'duration'] as $field) {
                if ($request->has($field)) {
                    $updateData[$field] = $request->input($field);
                }
            }

            if ($request->has('title')) {
                $updateData['title'] = trim((string) $request->input('title'));
            }

            if ($request->has('type')) {
                $updateData['type'] = $this->normalizeItemType($request->input('type'));
            }

            if ($request->has('contentType')) {
                $updateData['contentType'] = $this->normalizeContentType($request->input('contentType'));
            }

            if ($request->has('isPreview')) {
                $updateData['isPreview'] = $request->boolean('isPreview') ? 1 : 0;
            }

            DB::table('course_curriculum_items')
                ->where('id', $itemId)
                ->update($updateData);

            $item = $this->getItemById($itemId);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Curriculum item updated successfully',
                'data' => $item,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating curriculum item: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to update curriculum item',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function deleteItem(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|min:1',
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
            $itemId = (int) $request->input('id');

            DB::table('course_curriculum_items')
                ->where('id', $itemId)
                ->where('deletedFlag', 0)
                ->update([
                    'deletedFlag' => 1,
                    'updatedAt' => now(),
                ]);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Curriculum item deleted successfully',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting curriculum item: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to delete curriculum item',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateItemOrder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'data' => 'required|array',
            'data.*.id' => 'required|integer|min:1',
            'data.*.sortOrder' => 'required|integer|min:1',
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
            foreach ($request->input('data') as $item) {
                DB::table('course_curriculum_items')
                    ->where('id', (int) $item['id'])
                    ->where('deletedFlag', 0)
                    ->update([
                        'sortOrder' => (int) $item['sortOrder'],
                        'updatedAt' => now(),
                    ]);
            }

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Curriculum item order updated successfully',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating curriculum item order: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to update curriculum item order',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function getSectionById(int $sectionId): ?array
    {
        $section = DB::table('course_sections')
            ->where('id', $sectionId)
            ->where('deletedFlag', 0)
            ->first();

        return $section ? $this->formatSection($section, collect()) : null;
    }

    private function getItemById(int $itemId): ?array
    {
        $item = DB::table('course_curriculum_items')
            ->where('id', $itemId)
            ->where('deletedFlag', 0)
            ->first();

        return $item ? $this->formatItem($item) : null;
    }

    private function normalizeItemType(?string $type): string
    {
        $normalized = strtolower(str_replace(' ', '_', trim((string) $type)));

        return in_array($normalized, [
            'lecture',
            'quiz',
            'coding_exercise',
            'practice_test',
            'assignment',
            'role_play',
        ], true) ? $normalized : 'lecture';
    }

    private function normalizeContentType(?string $contentType): ?string
    {
        $normalized = strtolower(trim((string) $contentType));

        return in_array($normalized, ['youtube', 'upload', 'article'], true) ? $normalized : 'article';
    }

    private function formatSection(object $section, $items): array
    {
        return [
            'id' => (int) $section->id,
            'courseId' => (int) $section->courseId,
            'title' => $section->title,
            'objective' => $section->objective,
            'sortOrder' => (int) $section->sortOrder,
            'status' => (int) $section->status,
            'deletedFlag' => (int) $section->deletedFlag,
            'createdAt' => $section->createdAt,
            'updatedAt' => $section->updatedAt,
            'items' => collect($items)->map(fn($item) => $this->formatItem($item))->values(),
        ];
    }

    private function formatItem(object $item): array
    {
        return [
            'id' => (int) $item->id,
            'sectionId' => (int) $item->sectionId,
            'title' => $item->title,
            'type' => $item->type,
            'contentType' => $item->contentType,
            'youtubeUrl' => $item->youtubeUrl,
            'youtubeVideoId' => $item->youtubeVideoId,
            'fileUrl' => $item->fileUrl,
            'description' => $item->description,
            'duration' => $item->duration,
            'isPreview' => (int) $item->isPreview,
            'sortOrder' => (int) $item->sortOrder,
            'status' => (int) $item->status,
            'deletedFlag' => (int) $item->deletedFlag,
            'createdAt' => $item->createdAt,
            'updatedAt' => $item->updatedAt,
        ];
    }
}
