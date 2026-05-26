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

    public function addQuiz(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'sectionId' => 'required|integer|min:1',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'passingPercentage' => 'nullable|integer|min:0|max:100',
            'timeLimit' => 'nullable|integer|min:1',
            'allowMultipleAttempts' => 'nullable|boolean',
            'maxAttempts' => 'nullable|integer|min:1',
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

            $allowMultipleAttempts = $request->boolean('allowMultipleAttempts');
            $maxAttempts = $allowMultipleAttempts
                ? $this->quizIntegerValue($request, 'maxAttempts', 1)
                : null;
            $nextSortOrder = ((int) DB::table('course_curriculum_items')
                ->where('sectionId', $sectionId)
                ->where('deletedFlag', 0)
                ->max('sortOrder')) + 1;

            $quizId = DB::table('course_curriculum_items')->insertGetId([
                'sectionId' => $sectionId,
                'title' => trim((string) $request->input('title')),
                'type' => 'quiz',
                'contentType' => 'article',
                'youtubeUrl' => null,
                'youtubeVideoId' => null,
                'fileUrl' => null,
                'description' => $request->input('description'),
                'duration' => null,
                'passingPercentage' => $this->quizIntegerValue($request, 'passingPercentage', 70),
                'timeLimit' => $this->quizIntegerValue($request, 'timeLimit', 30),
                'allowMultipleAttempts' => $allowMultipleAttempts ? 1 : 0,
                'maxAttempts' => $maxAttempts,
                'isPreview' => $request->boolean('isPreview') ? 1 : 0,
                'sortOrder' => $nextSortOrder,
                'status' => 1,
                'deletedFlag' => 0,
                'createdAt' => now(),
                'updatedAt' => now(),
            ]);

            $quiz = $this->getQuizById($quizId);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Quiz added successfully',
                'data' => $quiz,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error adding quiz: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to add quiz',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateQuiz(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|min:1',
            'sectionId' => 'nullable|integer|min:1',
            'title' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'passingPercentage' => 'nullable|integer|min:0|max:100',
            'timeLimit' => 'nullable|integer|min:1',
            'allowMultipleAttempts' => 'nullable|boolean',
            'maxAttempts' => 'nullable|integer|min:1',
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
            $quizId = (int) $request->input('id');

            $quizExists = DB::table('course_curriculum_items')
                ->where('id', $quizId)
                ->where('type', 'quiz')
                ->where('deletedFlag', 0)
                ->exists();

            if (!$quizExists) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Quiz not found',
                ], 404);
            }

            $updateData = ['updatedAt' => now()];

            if ($request->has('sectionId')) {
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

                $updateData['sectionId'] = $sectionId;
            }

            if ($request->has('title')) {
                $updateData['title'] = trim((string) $request->input('title'));
            }

            foreach (['description', 'passingPercentage', 'timeLimit', 'maxAttempts'] as $field) {
                if ($request->has($field)) {
                    $updateData[$field] = $request->input($field);
                }
            }

            if ($request->has('allowMultipleAttempts')) {
                $allowMultipleAttempts = $request->boolean('allowMultipleAttempts');
                $updateData['allowMultipleAttempts'] = $allowMultipleAttempts ? 1 : 0;

                if (!$allowMultipleAttempts) {
                    $updateData['maxAttempts'] = null;
                }
            }

            if ($request->has('isPreview')) {
                $updateData['isPreview'] = $request->boolean('isPreview') ? 1 : 0;
            }

            DB::table('course_curriculum_items')
                ->where('id', $quizId)
                ->where('type', 'quiz')
                ->where('deletedFlag', 0)
                ->update($updateData);

            $quiz = $this->getQuizById($quizId);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Quiz updated successfully',
                'data' => $quiz,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating quiz: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to update quiz',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function deleteQuiz(Request $request)
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
            $quizId = (int) $request->input('id');

            $updated = DB::table('course_curriculum_items')
                ->where('id', $quizId)
                ->where('type', 'quiz')
                ->where('deletedFlag', 0)
                ->update([
                    'deletedFlag' => 1,
                    'updatedAt' => now(),
                ]);

            if (!$updated) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Quiz not found',
                ], 404);
            }

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Quiz deleted successfully',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting quiz: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to delete quiz',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function listQuizzes(Request $request)
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
            $quizzes = DB::table('course_curriculum_items')
                ->where('sectionId', (int) $request->input('sectionId'))
                ->where('type', 'quiz')
                ->where('deletedFlag', 0)
                ->orderBy('sortOrder', 'ASC')
                ->orderBy('id', 'ASC')
                ->get()
                ->map(fn($quiz) => $this->formatQuiz($quiz))
                ->values();

            return response()->json([
                'status' => true,
                'message' => 'Quizzes fetched successfully',
                'data' => $quizzes,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching quizzes: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch quizzes',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function addQuizQuestion(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'curriculumItemId' => 'required|integer|min:1',
            'question' => 'required|string',
            'questionType' => 'required|in:single_choice,multiple_choice,true_false',
            'explanation' => 'nullable|string',
            'marks' => 'nullable|integer|min:1',
            'options' => 'required|array|min:2|max:10',
            'options.*.optionText' => 'required|string',
            'options.*.isCorrect' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $questionType = (string) $request->input('questionType');
        $options = $this->normalizeQuizQuestionOptions($request->input('options', []));
        $optionsValidationMessage = $this->getQuizQuestionOptionsValidationMessage(
            $questionType,
            $options,
        );

        if ($optionsValidationMessage) {
            return $this->quizQuestionValidationError($optionsValidationMessage);
        }

        DB::beginTransaction();

        try {
            $curriculumItemId = (int) $request->input('curriculumItemId');
            $quizExists = $this->quizItemExists($curriculumItemId);

            if (!$quizExists) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Quiz not found',
                ], 404);
            }

            $nextSortOrder = ((int) DB::table('quiz_questions')
                ->where('curriculumItemId', $curriculumItemId)
                ->where('deletedFlag', 0)
                ->max('sortOrder')) + 1;

            $questionId = DB::table('quiz_questions')->insertGetId([
                'curriculumItemId' => $curriculumItemId,
                'question' => trim((string) $request->input('question')),
                'questionType' => $questionType,
                'explanation' => $request->input('explanation'),
                'marks' => $this->quizIntegerValue($request, 'marks', 1),
                'sortOrder' => $nextSortOrder,
                'status' => 1,
                'deletedFlag' => 0,
                'createdAt' => now(),
                'updatedAt' => now(),
            ]);

            $this->insertQuizQuestionOptions($questionId, $options);

            $question = $this->getQuizQuestionById($questionId);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Quiz question added successfully',
                'data' => $question,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error adding quiz question: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to add quiz question',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateQuizQuestion(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|integer|min:1',
            'curriculumItemId' => 'nullable|integer|min:1',
            'question' => 'nullable|string',
            'questionType' => 'nullable|in:single_choice,multiple_choice,true_false',
            'explanation' => 'nullable|string',
            'marks' => 'nullable|integer|min:1',
            'options' => 'nullable|array|min:2|max:10',
            'options.*.optionText' => 'required_with:options|string',
            'options.*.isCorrect' => 'nullable|boolean',
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
            $questionId = (int) $request->input('id');
            $existingQuestion = DB::table('quiz_questions')
                ->where('id', $questionId)
                ->where('deletedFlag', 0)
                ->first();

            if (!$existingQuestion) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Quiz question not found',
                ], 404);
            }

            $questionType = (string) $request->input(
                'questionType',
                $existingQuestion->questionType,
            );
            $replaceOptions = $request->has('options');

            if ($replaceOptions) {
                $options = $this->normalizeQuizQuestionOptions($request->input('options', []));
            } else {
                $options = DB::table('quiz_question_options')
                    ->where('questionId', $questionId)
                    ->where('deletedFlag', 0)
                    ->orderBy('sortOrder', 'ASC')
                    ->orderBy('id', 'ASC')
                    ->get()
                    ->map(fn($option) => [
                        'optionText' => $option->optionText,
                        'isCorrect' => (bool) $option->isCorrect,
                    ])
                    ->values()
                    ->all();
            }

            $optionsValidationMessage = $this->getQuizQuestionOptionsValidationMessage(
                $questionType,
                $options,
            );

            if ($optionsValidationMessage) {
                DB::rollBack();

                return $this->quizQuestionValidationError($optionsValidationMessage);
            }

            $updateData = ['updatedAt' => now()];

            if ($request->has('curriculumItemId')) {
                $curriculumItemId = (int) $request->input('curriculumItemId');

                if (!$this->quizItemExists($curriculumItemId)) {
                    DB::rollBack();

                    return response()->json([
                        'status' => false,
                        'message' => 'Quiz not found',
                    ], 404);
                }

                $updateData['curriculumItemId'] = $curriculumItemId;
            }

            if ($request->has('question')) {
                $updateData['question'] = trim((string) $request->input('question'));
            }

            if ($request->has('questionType')) {
                $updateData['questionType'] = $questionType;
            }

            if ($request->has('explanation')) {
                $updateData['explanation'] = $request->input('explanation');
            }

            if ($request->has('marks')) {
                $updateData['marks'] = (int) $request->input('marks');
            }

            DB::table('quiz_questions')
                ->where('id', $questionId)
                ->where('deletedFlag', 0)
                ->update($updateData);

            if ($replaceOptions) {
                DB::table('quiz_question_options')
                    ->where('questionId', $questionId)
                    ->where('deletedFlag', 0)
                    ->update([
                        'deletedFlag' => 1,
                        'updatedAt' => now(),
                    ]);

                $this->insertQuizQuestionOptions($questionId, $options);
            }

            $question = $this->getQuizQuestionById($questionId);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Quiz question updated successfully',
                'data' => $question,
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating quiz question: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to update quiz question',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function deleteQuizQuestion(Request $request)
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
            $questionId = (int) $request->input('id');
            $updated = DB::table('quiz_questions')
                ->where('id', $questionId)
                ->where('deletedFlag', 0)
                ->update([
                    'deletedFlag' => 1,
                    'updatedAt' => now(),
                ]);

            if (!$updated) {
                DB::rollBack();

                return response()->json([
                    'status' => false,
                    'message' => 'Quiz question not found',
                ], 404);
            }

            DB::table('quiz_question_options')
                ->where('questionId', $questionId)
                ->where('deletedFlag', 0)
                ->update([
                    'deletedFlag' => 1,
                    'updatedAt' => now(),
                ]);

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Quiz question deleted successfully',
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting quiz question: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to delete quiz question',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function listQuizQuestions(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'curriculumItemId' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $curriculumItemId = (int) $request->input('curriculumItemId');

            if (!$this->quizItemExists($curriculumItemId)) {
                return response()->json([
                    'status' => false,
                    'message' => 'Quiz not found',
                ], 404);
            }

            $questions = DB::table('quiz_questions')
                ->where('curriculumItemId', $curriculumItemId)
                ->where('deletedFlag', 0)
                ->orderBy('sortOrder', 'ASC')
                ->orderBy('id', 'ASC')
                ->get();
            $questionIds = $questions->pluck('id')->all();
            $optionsByQuestion = empty($questionIds)
                ? collect()
                : DB::table('quiz_question_options')
                    ->whereIn('questionId', $questionIds)
                    ->where('deletedFlag', 0)
                    ->orderBy('sortOrder', 'ASC')
                    ->orderBy('id', 'ASC')
                    ->get()
                    ->groupBy('questionId');

            return response()->json([
                'status' => true,
                'message' => 'Quiz questions fetched successfully',
                'data' => $questions
                    ->map(fn($question) => $this->formatQuizQuestion(
                        $question,
                        $optionsByQuestion->get($question->id, collect()),
                    ))
                    ->values(),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching quiz questions: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Unable to fetch quiz questions',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function quizItemExists(int $curriculumItemId): bool
    {
        return DB::table('course_curriculum_items')
            ->where('id', $curriculumItemId)
            ->where('type', 'quiz')
            ->where('deletedFlag', 0)
            ->exists();
    }

    private function normalizeQuizQuestionOptions(array $options): array
    {
        return collect($options)
            ->map(fn($option) => [
                'optionText' => trim((string) ($option['optionText'] ?? '')),
                'isCorrect' => filter_var(
                    $option['isCorrect'] ?? false,
                    FILTER_VALIDATE_BOOLEAN,
                ),
            ])
            ->values()
            ->all();
    }

    private function getQuizQuestionOptionsValidationMessage(
        string $questionType,
        array $options,
    ): ?string {
        $optionCount = count($options);

        if ($optionCount < 2) {
            return 'Minimum 2 options are required';
        }

        if ($optionCount > 10) {
            return 'Maximum 10 options are allowed';
        }

        foreach ($options as $option) {
            if (!trim((string) ($option['optionText'] ?? ''))) {
                return 'All options are required';
            }
        }

        $correctAnswerCount = collect($options)
            ->filter(fn($option) => (bool) ($option['isCorrect'] ?? false))
            ->count();

        if ($correctAnswerCount === 0) {
            return 'Select the correct answer';
        }

        if ($questionType === 'single_choice' && $correctAnswerCount !== 1) {
            return 'Single choice questions require exactly one correct answer';
        }

        if ($questionType === 'true_false') {
            if ($optionCount !== 2) {
                return 'True/False questions require exactly 2 options';
            }

            $optionTexts = collect($options)
                ->map(fn($option) => strtolower(trim((string) $option['optionText'])))
                ->sort()
                ->values()
                ->all();

            if ($optionTexts !== ['false', 'true']) {
                return 'True/False options must be True and False';
            }

            if ($correctAnswerCount !== 1) {
                return 'True/False questions require exactly one correct answer';
            }
        }

        return null;
    }

    private function quizQuestionValidationError(string $message)
    {
        return response()->json([
            'status' => false,
            'message' => 'Validation failed',
            'errors' => [
                'options' => [$message],
            ],
        ], 422);
    }

    private function insertQuizQuestionOptions(int $questionId, array $options): void
    {
        $now = now();
        $rows = collect($options)
            ->map(fn($option, $index) => [
                'questionId' => $questionId,
                'optionText' => trim((string) $option['optionText']),
                'isCorrect' => (bool) $option['isCorrect'] ? 1 : 0,
                'sortOrder' => $index + 1,
                'status' => 1,
                'deletedFlag' => 0,
                'createdAt' => $now,
                'updatedAt' => $now,
            ])
            ->all();

        if (!empty($rows)) {
            DB::table('quiz_question_options')->insert($rows);
        }
    }

    private function getQuizQuestionById(int $questionId): ?array
    {
        $question = DB::table('quiz_questions')
            ->where('id', $questionId)
            ->where('deletedFlag', 0)
            ->first();

        if (!$question) {
            return null;
        }

        $options = DB::table('quiz_question_options')
            ->where('questionId', $questionId)
            ->where('deletedFlag', 0)
            ->orderBy('sortOrder', 'ASC')
            ->orderBy('id', 'ASC')
            ->get();

        return $this->formatQuizQuestion($question, $options);
    }

    private function formatQuizQuestion(object $question, $options): array
    {
        return [
            'id' => (int) $question->id,
            'curriculumItemId' => (int) $question->curriculumItemId,
            'question' => $question->question,
            'questionType' => $question->questionType,
            'explanation' => $question->explanation,
            'marks' => (int) $question->marks,
            'sortOrder' => (int) $question->sortOrder,
            'status' => (int) $question->status,
            'deletedFlag' => (int) $question->deletedFlag,
            'createdAt' => $question->createdAt,
            'updatedAt' => $question->updatedAt,
            'options' => collect($options)
                ->map(fn($option) => $this->formatQuizQuestionOption($option))
                ->values(),
        ];
    }

    private function formatQuizQuestionOption(object $option): array
    {
        return [
            'id' => (int) $option->id,
            'questionId' => (int) $option->questionId,
            'optionText' => $option->optionText,
            'isCorrect' => (int) $option->isCorrect,
            'sortOrder' => (int) $option->sortOrder,
            'status' => (int) $option->status,
            'deletedFlag' => (int) $option->deletedFlag,
            'createdAt' => $option->createdAt,
            'updatedAt' => $option->updatedAt,
        ];
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

    private function getQuizById(int $quizId): ?array
    {
        $quiz = DB::table('course_curriculum_items')
            ->where('id', $quizId)
            ->where('type', 'quiz')
            ->where('deletedFlag', 0)
            ->first();

        return $quiz ? $this->formatQuiz($quiz) : null;
    }

    private function normalizeItemType(?string $type): string
    {
        $normalized = strtolower(str_replace(' ', '_', trim((string) $type)));

        return in_array($normalized, [
            'lecture',
            'quiz',
            'coding_exercise',
            'role_play',
        ], true) ? $normalized : 'lecture';
    }

    private function normalizeContentType(?string $contentType): ?string
    {
        $normalized = strtolower(trim((string) $contentType));

        return in_array($normalized, ['youtube', 'upload', 'article'], true) ? $normalized : 'article';
    }

    private function quizIntegerValue(Request $request, string $field, ?int $default = null): ?int
    {
        $value = $request->input($field);

        if ($value === null || $value === '') {
            return $default;
        }

        return (int) $value;
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
            'passingPercentage' => isset($item->passingPercentage) ? (int) $item->passingPercentage : null,
            'timeLimit' => isset($item->timeLimit) ? (int) $item->timeLimit : null,
            'allowMultipleAttempts' => isset($item->allowMultipleAttempts)
                ? (int) $item->allowMultipleAttempts
                : 0,
            'maxAttempts' => isset($item->maxAttempts) ? (int) $item->maxAttempts : null,
            'isPreview' => (int) $item->isPreview,
            'sortOrder' => (int) $item->sortOrder,
            'status' => (int) $item->status,
            'deletedFlag' => (int) $item->deletedFlag,
            'createdAt' => $item->createdAt,
            'updatedAt' => $item->updatedAt,
        ];
    }

    private function formatQuiz(object $quiz): array
    {
        return [
            'id' => (int) $quiz->id,
            'sectionId' => (int) $quiz->sectionId,
            'title' => $quiz->title,
            'type' => $quiz->type,
            'description' => $quiz->description,
            'passingPercentage' => isset($quiz->passingPercentage) ? (int) $quiz->passingPercentage : null,
            'timeLimit' => isset($quiz->timeLimit) ? (int) $quiz->timeLimit : null,
            'allowMultipleAttempts' => isset($quiz->allowMultipleAttempts)
                ? (int) $quiz->allowMultipleAttempts
                : 0,
            'maxAttempts' => isset($quiz->maxAttempts) ? (int) $quiz->maxAttempts : null,
            'isPreview' => (int) $quiz->isPreview,
            'sortOrder' => (int) $quiz->sortOrder,
            'status' => (int) $quiz->status,
            'deletedFlag' => (int) $quiz->deletedFlag,
            'createdAt' => $quiz->createdAt,
            'updatedAt' => $quiz->updatedAt,
        ];
    }
}
