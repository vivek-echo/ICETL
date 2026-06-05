<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class LearningController extends Controller
{
    private const REQUIRED_TABLES = [
        'courses',
        'course_sections',
        'course_curriculum_items',
        'quiz_questions',
        'quiz_question_options',
        'enrollments',
        'learning_item_progress',
        'learning_notes',
        'learning_quiz_attempts',
        'learning_quiz_attempt_answers',
    ];

    public function course(Request $request, int $courseId)
    {
        if (!$this->learningTablesReady()) {
            return $this->missingTablesResponse();
        }

        $userId = (int) $request->user()->id;
        $enrollment = $this->activeEnrollment($userId, $courseId);

        if (!$enrollment) {
            return response()->json([
                'success' => false,
                'message' => 'You need to purchase this course to continue.',
            ], 403);
        }

        $course = $this->courseRecord($courseId);

        if (!$course) {
            return response()->json([
                'success' => false,
                'message' => 'Course not found.',
            ], 404);
        }

        try {
            $sections = DB::table('course_sections')
                ->where('courseId', $courseId)
                ->where('deletedFlag', 0)
                ->orderBy('sortOrder', 'ASC')
                ->orderBy('id', 'ASC')
                ->get();

            $sectionIds = $sections->pluck('id')->map(fn ($id) => (int) $id)->values();
            $itemsBySection = $sectionIds->isEmpty()
                ? collect()
                : DB::table('course_curriculum_items')
                    ->whereIn('sectionId', $sectionIds)
                    ->where('deletedFlag', 0)
                    ->orderBy('sortOrder', 'ASC')
                    ->orderBy('id', 'ASC')
                    ->get()
                    ->groupBy('sectionId');

            $allItems = $itemsBySection->flatten(1)->values();
            $itemIds = $allItems->pluck('id')->map(fn ($id) => (int) $id)->values();
            $quizItemIds = $allItems
                ->filter(fn ($item) => $this->isQuizItem($item))
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();

            $progressByItem = $itemIds->isEmpty()
                ? collect()
                : DB::table('learning_item_progress')
                    ->where('userId', $userId)
                    ->where('courseId', $courseId)
                    ->whereIn('curriculumItemId', $itemIds)
                    ->where('deletedFlag', 0)
                    ->get()
                    ->keyBy('curriculumItemId');

            $notesByItem = $itemIds->isEmpty()
                ? collect()
                : DB::table('learning_notes')
                    ->where('userId', $userId)
                    ->where('courseId', $courseId)
                    ->whereIn('curriculumItemId', $itemIds)
                    ->where('deletedFlag', 0)
                    ->get()
                    ->keyBy('curriculumItemId');

            $questionsByQuiz = $this->questionsByQuiz($quizItemIds->all(), false);
            $attemptsByQuiz = $this->attemptsByQuiz($userId, $courseId, $quizItemIds->all());
            $passedQuizItemIds = $attemptsByQuiz
                ->map(fn ($attempts) => collect($attempts)->contains(fn ($attempt) => (bool) $attempt->passed))
                ->filter()
                ->keys()
                ->map(fn ($id) => (int) $id)
                ->values();

            $completedItemIds = $progressByItem
                ->filter(fn ($progress) => $progress->status === 'completed')
                ->keys()
                ->map(fn ($id) => (int) $id)
                ->merge($passedQuizItemIds)
                ->unique()
                ->values();

            $sectionData = $sections
                ->map(function ($section) use (
                    $request,
                    $itemsBySection,
                    $progressByItem,
                    $notesByItem,
                    $questionsByQuiz,
                    $attemptsByQuiz
                ) {
                    $items = collect($itemsBySection->get($section->id, collect()))
                        ->map(fn ($item) => $this->formatLearningItem(
                            $request,
                            $item,
                            $progressByItem->get($item->id),
                            $notesByItem->get($item->id),
                            collect($questionsByQuiz->get($item->id, [])),
                            collect($attemptsByQuiz->get($item->id, [])),
                        ))
                        ->values();

                    return [
                        'id' => (int) $section->id,
                        'courseId' => (int) $section->courseId,
                        'title' => $section->title,
                        'objective' => $section->objective,
                        'sortOrder' => (int) $section->sortOrder,
                        'items' => $items,
                    ];
                })
                ->values();

            return response()->json([
                'success' => true,
                'message' => 'Learning course fetched successfully.',
                'data' => [
                    'course' => $this->formatCourse($request, $course, $enrollment),
                    'summary' => [
                        'totalItems' => $itemIds->count(),
                        'completedItems' => $completedItemIds->count(),
                        'lectureCount' => $allItems->filter(fn ($item) => !$this->isQuizItem($item))->count(),
                        'quizCount' => $quizItemIds->count(),
                        'notesCount' => $notesByItem->count(),
                    ],
                    'sections' => $sectionData,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Unable to fetch learning course', [
                'courseId' => $courseId,
                'userId' => $userId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to fetch learning course.',
            ], 500);
        }
    }

    public function saveProgress(Request $request)
    {
        if (!$this->learningTablesReady()) {
            return $this->missingTablesResponse();
        }

        $validator = Validator::make($request->all(), [
            'courseId' => 'required|integer|min:1',
            'curriculumItemId' => 'required|integer|min:1',
            'status' => 'required|string|in:not_started,in_progress,completed',
            'progressPercent' => 'nullable|integer|min:0|max:100',
            'lastPositionSeconds' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $userId = (int) $request->user()->id;
        $courseId = (int) $request->input('courseId');
        $itemId = (int) $request->input('curriculumItemId');
        $item = $this->curriculumItemForCourse($courseId, $itemId);

        if (!$this->activeEnrollment($userId, $courseId)) {
            return response()->json([
                'success' => false,
                'message' => 'You need to purchase this course to continue.',
            ], 403);
        }

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'Curriculum item not found.',
            ], 404);
        }

        if ($this->isQuizItem($item) && $request->input('status') === 'completed') {
            return response()->json([
                'success' => false,
                'message' => 'Submit the quiz to complete this item.',
            ], 422);
        }

        try {
            $progress = $this->saveItemProgress(
                $userId,
                $courseId,
                $itemId,
                (string) $request->input('status'),
                $request->input('progressPercent'),
                $request->input('lastPositionSeconds'),
            );
            $courseProgress = $this->recalculateEnrollmentProgress($userId, $courseId);

            return response()->json([
                'success' => true,
                'message' => 'Progress saved successfully.',
                'data' => [
                    'progress' => $progress,
                    'courseProgressPercent' => $courseProgress,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Unable to save learning progress', [
                'courseId' => $courseId,
                'itemId' => $itemId,
                'userId' => $userId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to save progress.',
            ], 500);
        }
    }

    public function saveNote(Request $request)
    {
        if (!$this->learningTablesReady()) {
            return $this->missingTablesResponse();
        }

        $validator = Validator::make($request->all(), [
            'courseId' => 'required|integer|min:1',
            'curriculumItemId' => 'required|integer|min:1',
            'note' => 'nullable|string|max:20000',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $userId = (int) $request->user()->id;
        $courseId = (int) $request->input('courseId');
        $itemId = (int) $request->input('curriculumItemId');
        $note = trim((string) $request->input('note', ''));

        if (!$this->activeEnrollment($userId, $courseId)) {
            return response()->json([
                'success' => false,
                'message' => 'You need to purchase this course to continue.',
            ], 403);
        }

        if (!$this->curriculumItemForCourse($courseId, $itemId)) {
            return response()->json([
                'success' => false,
                'message' => 'Curriculum item not found.',
            ], 404);
        }

        try {
            $existing = DB::table('learning_notes')
                ->where('userId', $userId)
                ->where('courseId', $courseId)
                ->where('curriculumItemId', $itemId)
                ->where('deletedFlag', 0)
                ->first();

            if ($note === '') {
                if ($existing) {
                    DB::table('learning_notes')
                        ->where('id', $existing->id)
                        ->delete();
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Note cleared successfully.',
                    'data' => null,
                ]);
            }

            if ($existing) {
                DB::table('learning_notes')
                    ->where('id', $existing->id)
                    ->update([
                        'note' => $note,
                        'updatedAt' => now(),
                    ]);
                $noteId = (int) $existing->id;
            } else {
                $noteId = DB::table('learning_notes')->insertGetId([
                    'userId' => $userId,
                    'courseId' => $courseId,
                    'curriculumItemId' => $itemId,
                    'note' => $note,
                    'deletedFlag' => 0,
                    'createdAt' => now(),
                    'updatedAt' => now(),
                ]);
            }

            $savedNote = DB::table('learning_notes')->where('id', $noteId)->first();

            return response()->json([
                'success' => true,
                'message' => 'Note saved successfully.',
                'data' => $this->formatNote($savedNote),
            ]);
        } catch (\Throwable $e) {
            Log::error('Unable to save learning note', [
                'courseId' => $courseId,
                'itemId' => $itemId,
                'userId' => $userId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to save note.',
            ], 500);
        }
    }

    public function submitQuiz(Request $request, int $quizId)
    {
        if (!$this->learningTablesReady()) {
            return $this->missingTablesResponse();
        }

        $validator = Validator::make($request->all(), [
            'courseId' => 'required|integer|min:1',
            'answers' => 'required|array',
            'answers.*.questionId' => 'required|integer|min:1',
            'answers.*.selectedOptionIds' => 'required|array',
            'answers.*.selectedOptionIds.*' => 'integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $userId = (int) $request->user()->id;
        $courseId = (int) $request->input('courseId');
        $quiz = $this->curriculumItemForCourse($courseId, $quizId);

        if (!$this->activeEnrollment($userId, $courseId)) {
            return response()->json([
                'success' => false,
                'message' => 'You need to purchase this course to continue.',
            ], 403);
        }

        if (!$quiz || !$this->isQuizItem($quiz)) {
            return response()->json([
                'success' => false,
                'message' => 'Quiz not found.',
            ], 404);
        }

        $attempts = DB::table('learning_quiz_attempts')
            ->where('userId', $userId)
            ->where('courseId', $courseId)
            ->where('curriculumItemId', $quizId)
            ->where('deletedFlag', 0)
            ->orderByDesc('id')
            ->get();

        if ($attempts->contains(fn ($attempt) => (bool) $attempt->passed)) {
            return response()->json([
                'success' => false,
                'message' => 'This quiz is already passed.',
            ], 409);
        }

        $maxAttempts = $this->maxAttemptsForQuiz($quiz);
        if ($maxAttempts !== null && $attempts->count() >= $maxAttempts) {
            return response()->json([
                'success' => false,
                'message' => 'No quiz attempts are remaining.',
            ], 409);
        }

        $questions = $this->questionsByQuiz([$quizId], true)->get($quizId, collect());

        if ($questions->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'This quiz has no questions yet.',
            ], 422);
        }

        $answerMap = collect($request->input('answers', []))->mapWithKeys(function ($answer) {
            return [
                (int) $answer['questionId'] => $this->normalizeIdList($answer['selectedOptionIds'] ?? []),
            ];
        });

        foreach ($questions as $question) {
            if (!$answerMap->has($question['id']) || count($answerMap->get($question['id'], [])) === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Answer all quiz questions before submitting.',
                ], 422);
            }
        }

        try {
            DB::beginTransaction();

            $review = [];
            $score = 0.0;
            $totalMarks = 0.0;

            foreach ($questions as $question) {
                $selectedOptionIds = $answerMap->get($question['id'], []);
                $validOptionIds = collect($question['options'])->pluck('id')->map(fn ($id) => (int) $id)->all();

                if (count(array_diff($selectedOptionIds, $validOptionIds)) > 0) {
                    DB::rollBack();

                    return response()->json([
                        'success' => false,
                        'message' => 'One or more selected quiz options are invalid.',
                    ], 422);
                }

                $correctOptionIds = $this->normalizeIdList(
                    collect($question['options'])
                        ->filter(fn ($option) => (bool) ($option['isCorrect'] ?? false))
                        ->pluck('id')
                        ->all(),
                );
                $marks = (float) $question['marks'];
                $isCorrect = $selectedOptionIds === $correctOptionIds;
                $earnedMarks = $isCorrect ? $marks : 0.0;

                $score += $earnedMarks;
                $totalMarks += $marks;
                $review[] = [
                    'questionId' => (int) $question['id'],
                    'question' => $question['question'],
                    'questionType' => $question['questionType'],
                    'selectedOptionIds' => $selectedOptionIds,
                    'correctOptionIds' => $correctOptionIds,
                    'isCorrect' => $isCorrect,
                    'earnedMarks' => $earnedMarks,
                    'marks' => $marks,
                    'explanation' => $question['explanation'],
                ];
            }

            $percentage = $totalMarks > 0 ? round(($score / $totalMarks) * 100, 2) : 0.0;
            $passingPercentage = (int) ($quiz->passingPercentage ?? 70);
            $passed = $percentage >= $passingPercentage;
            $attemptNo = $attempts->count() + 1;

            $attemptId = DB::table('learning_quiz_attempts')->insertGetId([
                'userId' => $userId,
                'courseId' => $courseId,
                'curriculumItemId' => $quizId,
                'attemptNo' => $attemptNo,
                'score' => $score,
                'totalMarks' => $totalMarks,
                'percentage' => $percentage,
                'passed' => $passed ? 1 : 0,
                'startedAt' => now(),
                'completedAt' => now(),
                'deletedFlag' => 0,
                'createdAt' => now(),
                'updatedAt' => now(),
            ]);

            $answerRows = collect($review)->map(fn ($item) => [
                'attemptId' => $attemptId,
                'questionId' => $item['questionId'],
                'selectedOptionIds' => json_encode($item['selectedOptionIds']),
                'isCorrect' => $item['isCorrect'] ? 1 : 0,
                'earnedMarks' => $item['earnedMarks'],
                'createdAt' => now(),
                'updatedAt' => now(),
            ])->all();

            DB::table('learning_quiz_attempt_answers')->insert($answerRows);

            $progress = $this->saveItemProgress(
                $userId,
                $courseId,
                $quizId,
                $passed ? 'completed' : 'in_progress',
                $passed ? 100 : (int) round($percentage),
                0,
            );
            $courseProgress = $this->recalculateEnrollmentProgress($userId, $courseId);
            $attempt = DB::table('learning_quiz_attempts')->where('id', $attemptId)->first();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => $passed ? 'Quiz passed successfully.' : 'Quiz submitted successfully.',
                'data' => [
                    'attempt' => $this->formatAttempt($attempt),
                    'review' => $review,
                    'progress' => $progress,
                    'courseProgressPercent' => $courseProgress,
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Unable to submit quiz', [
                'courseId' => $courseId,
                'quizId' => $quizId,
                'userId' => $userId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to submit quiz.',
            ], 500);
        }
    }

    private function learningTablesReady(): bool
    {
        foreach (self::REQUIRED_TABLES as $table) {
            if (!Schema::hasTable($table)) {
                return false;
            }
        }

        return true;
    }

    private function missingTablesResponse()
    {
        return response()->json([
            'success' => false,
            'message' => 'Learning tables are not ready. Please run the latest database migrations.',
        ], 500);
    }

    private function validationResponse($validator)
    {
        return response()->json([
            'success' => false,
            'message' => 'Validation failed.',
            'errors' => $validator->errors(),
        ], 422);
    }

    private function activeEnrollment(int $userId, int $courseId): ?object
    {
        return DB::table('enrollments')
            ->where('userId', $userId)
            ->where('courseId', $courseId)
            ->where('status', 'active')
            ->where('deletedFlag', 0)
            ->first();
    }

    private function courseRecord(int $courseId): ?object
    {
        return DB::table('courses as c')
            ->leftJoin('coursecategories as cc', 'cc.id', '=', 'c.categoryId')
            ->where('c.id', $courseId)
            ->where('c.deletedFlag', 0)
            ->select(
                'c.*',
                'cc.categoryName as categoryName',
            )
            ->first();
    }

    private function curriculumItemForCourse(int $courseId, int $itemId): ?object
    {
        return DB::table('course_curriculum_items as ci')
            ->join('course_sections as cs', 'cs.id', '=', 'ci.sectionId')
            ->where('cs.courseId', $courseId)
            ->where('ci.id', $itemId)
            ->where('ci.deletedFlag', 0)
            ->where('cs.deletedFlag', 0)
            ->select('ci.*')
            ->first();
    }

    private function questionsByQuiz(array $quizItemIds, bool $includeCorrect): \Illuminate\Support\Collection
    {
        if (empty($quizItemIds)) {
            return collect();
        }

        $questions = DB::table('quiz_questions')
            ->whereIn('curriculumItemId', $quizItemIds)
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

        return $questions
            ->map(fn ($question) => $this->formatQuestion(
                $question,
                collect($optionsByQuestion->get($question->id, [])),
                $includeCorrect,
            ))
            ->groupBy('curriculumItemId');
    }

    private function attemptsByQuiz(int $userId, int $courseId, array $quizItemIds): \Illuminate\Support\Collection
    {
        if (empty($quizItemIds)) {
            return collect();
        }

        return DB::table('learning_quiz_attempts')
            ->where('userId', $userId)
            ->where('courseId', $courseId)
            ->whereIn('curriculumItemId', $quizItemIds)
            ->where('deletedFlag', 0)
            ->orderByDesc('id')
            ->get()
            ->groupBy('curriculumItemId');
    }

    private function saveItemProgress(
        int $userId,
        int $courseId,
        int $itemId,
        string $status,
        mixed $progressPercent,
        mixed $lastPositionSeconds,
    ): array {
        $normalizedPercent = $status === 'completed'
            ? 100
            : max(0, min(99, (int) ($progressPercent ?? ($status === 'in_progress' ? 1 : 0))));
        $completedAt = $status === 'completed' ? now() : null;
        $existing = DB::table('learning_item_progress')
            ->where('userId', $userId)
            ->where('courseId', $courseId)
            ->where('curriculumItemId', $itemId)
            ->where('deletedFlag', 0)
            ->first();

        $payload = [
            'status' => $status,
            'progressPercent' => $normalizedPercent,
            'lastPositionSeconds' => max(0, (int) ($lastPositionSeconds ?? 0)),
            'completedAt' => $completedAt,
            'updatedAt' => now(),
        ];

        if ($existing) {
            DB::table('learning_item_progress')
                ->where('id', $existing->id)
                ->update($payload);
            $progressId = (int) $existing->id;
        } else {
            $progressId = DB::table('learning_item_progress')->insertGetId([
                'userId' => $userId,
                'courseId' => $courseId,
                'curriculumItemId' => $itemId,
                'deletedFlag' => 0,
                'createdAt' => now(),
                ...$payload,
            ]);
        }

        $progress = DB::table('learning_item_progress')->where('id', $progressId)->first();

        return $this->formatProgress($progress);
    }

    private function recalculateEnrollmentProgress(int $userId, int $courseId): int
    {
        $itemIds = DB::table('course_curriculum_items as ci')
            ->join('course_sections as cs', 'cs.id', '=', 'ci.sectionId')
            ->where('cs.courseId', $courseId)
            ->where('cs.deletedFlag', 0)
            ->where('ci.deletedFlag', 0)
            ->pluck('ci.id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $total = count($itemIds);
        $completed = $total === 0
            ? 0
            : DB::table('learning_item_progress')
                ->where('userId', $userId)
                ->where('courseId', $courseId)
                ->whereIn('curriculumItemId', $itemIds)
                ->where('status', 'completed')
                ->where('deletedFlag', 0)
                ->count();
        $percent = $total === 0 ? 0 : (int) round(($completed / $total) * 100);

        DB::table('enrollments')
            ->where('userId', $userId)
            ->where('courseId', $courseId)
            ->where('deletedFlag', 0)
            ->update([
                'progressPercent' => max(0, min(100, $percent)),
                'lastWatchedAt' => now(),
                'updated_at' => now(),
            ]);

        return max(0, min(100, $percent));
    }

    private function formatCourse(Request $request, object $course, object $enrollment): array
    {
        $instructors = $this->courseInstructors($course);

        return [
            'enrollmentId' => (int) $enrollment->id,
            'id' => (int) $course->id,
            'code' => $course->code ?? null,
            'title' => $course->title,
            'categoryId' => (int) $course->categoryId,
            'categoryName' => $course->categoryName ?: 'Uncategorized',
            'instructors' => $instructors,
            'instructorName' => collect($instructors)->pluck('name')->filter()->join(', '),
            'duration' => $course->duration ?? null,
            'durationUnit' => $course->durationUnit ?? null,
            'description' => $course->description,
            'courseHighlights' => $this->decodeCourseHighlights($course->courseHighlights ?? null),
            'thumbnailUrl' => $course->thumbnail ? $this->privateFileUrl($request, $course->thumbnail) : null,
            'status' => (int) $course->status,
            'progressPercent' => (int) ($enrollment->progressPercent ?? 0),
            'lastWatchedAt' => $enrollment->lastWatchedAt,
            'enrolledAt' => $enrollment->created_at,
        ];
    }

    private function formatLearningItem(
        Request $request,
        object $item,
        ?object $progress,
        ?object $note,
        \Illuminate\Support\Collection $questions,
        \Illuminate\Support\Collection $attempts,
    ): array {
        $latestAttempt = $attempts->sortByDesc('id')->first();
        $hasPassedAttempt = $attempts->contains(fn ($attempt) => (bool) $attempt->passed);
        $status = $progress->status ?? ($hasPassedAttempt ? 'completed' : 'not_started');
        $maxAttempts = $this->maxAttemptsForQuiz($item);
        $attemptsUsed = $attempts->count();
        $canAttempt = $this->isQuizItem($item)
            && !$hasPassedAttempt
            && $questions->isNotEmpty()
            && ($maxAttempts === null || $attemptsUsed < $maxAttempts);
        $rawFileUrl = $item->fileUrl ?: null;

        return [
            'id' => (int) $item->id,
            'sectionId' => (int) $item->sectionId,
            'title' => $item->title,
            'type' => $item->type,
            'contentType' => $item->contentType,
            'youtubeUrl' => $item->youtubeUrl,
            'youtubeVideoId' => $item->youtubeVideoId,
            'fileUrl' => $rawFileUrl ? $this->privateFileUrl($request, $rawFileUrl) : null,
            'rawFileUrl' => $rawFileUrl,
            'description' => $item->description,
            'duration' => $item->duration,
            'passingPercentage' => isset($item->passingPercentage) ? (int) $item->passingPercentage : null,
            'timeLimit' => isset($item->timeLimit) ? (int) $item->timeLimit : null,
            'allowMultipleAttempts' => (bool) ($item->allowMultipleAttempts ?? false),
            'maxAttempts' => $maxAttempts,
            'isPreview' => (bool) ($item->isPreview ?? false),
            'sortOrder' => (int) $item->sortOrder,
            'progress' => $progress
                ? $this->formatProgress($progress)
                : [
                    'id' => null,
                    'status' => $status,
                    'progressPercent' => $status === 'completed' ? 100 : 0,
                    'completedAt' => null,
                    'lastPositionSeconds' => 0,
                ],
            'note' => $note ? $this->formatNote($note) : null,
            'quiz' => $this->isQuizItem($item)
                ? [
                    'questionCount' => $questions->count(),
                    'questions' => $questions->values(),
                    'attemptsUsed' => $attemptsUsed,
                    'maxAttempts' => $maxAttempts,
                    'canAttempt' => $canAttempt,
                    'latestAttempt' => $latestAttempt ? $this->formatAttempt($latestAttempt) : null,
                ]
                : null,
        ];
    }

    private function formatQuestion(object|array $question, \Illuminate\Support\Collection $options, bool $includeCorrect): array
    {
        $questionObject = is_array($question) ? (object) $question : $question;
        $data = [
            'id' => (int) $questionObject->id,
            'curriculumItemId' => (int) $questionObject->curriculumItemId,
            'question' => $questionObject->question,
            'questionType' => $questionObject->questionType,
            'explanation' => $includeCorrect ? $questionObject->explanation : null,
            'marks' => (int) $questionObject->marks,
            'sortOrder' => (int) $questionObject->sortOrder,
            'options' => $options
                ->map(function ($option) use ($includeCorrect) {
                    $formatted = [
                        'id' => (int) $option->id,
                        'questionId' => (int) $option->questionId,
                        'optionText' => $option->optionText,
                        'sortOrder' => (int) $option->sortOrder,
                    ];

                    if ($includeCorrect) {
                        $formatted['isCorrect'] = (bool) $option->isCorrect;
                    }

                    return $formatted;
                })
                ->values(),
        ];

        return $data;
    }

    private function formatProgress(object $progress): array
    {
        return [
            'id' => (int) $progress->id,
            'status' => $progress->status,
            'progressPercent' => (int) $progress->progressPercent,
            'lastPositionSeconds' => (int) ($progress->lastPositionSeconds ?? 0),
            'completedAt' => $progress->completedAt,
            'updatedAt' => $progress->updatedAt,
        ];
    }

    private function formatNote(object $note): array
    {
        return [
            'id' => (int) $note->id,
            'note' => $note->note,
            'updatedAt' => $note->updatedAt,
        ];
    }

    private function formatAttempt(object $attempt): array
    {
        return [
            'id' => (int) $attempt->id,
            'attemptNo' => (int) $attempt->attemptNo,
            'score' => (float) $attempt->score,
            'totalMarks' => (float) $attempt->totalMarks,
            'percentage' => (float) $attempt->percentage,
            'passed' => (bool) $attempt->passed,
            'completedAt' => $attempt->completedAt,
        ];
    }

    private function maxAttemptsForQuiz(object $item): ?int
    {
        if (!$this->isQuizItem($item)) {
            return null;
        }

        if (!(bool) ($item->allowMultipleAttempts ?? false)) {
            return 1;
        }

        $maxAttempts = (int) ($item->maxAttempts ?? 0);

        return $maxAttempts > 0 ? $maxAttempts : null;
    }

    private function isQuizItem(object $item): bool
    {
        return strtolower((string) $item->type) === 'quiz';
    }

    private function normalizeIdList(array $ids): array
    {
        $normalized = collect($ids)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $normalized;
    }

    private function courseInstructors(object $course): array
    {
        $relationInstructors = DB::table('courseinstructors as ci')
            ->leftJoin('users as u', 'u.id', '=', 'ci.instructorId')
            ->where('ci.courseId', (int) $course->id)
            ->select('ci.instructorId', 'u.name')
            ->orderBy('ci.id')
            ->get()
            ->map(fn ($instructor) => [
                'id' => (int) $instructor->instructorId,
                'name' => (string) ($instructor->name ?? 'Instructor'),
            ]);

        if ($relationInstructors->isNotEmpty()) {
            return $relationInstructors->values()->all();
        }

        $instructorIds = $this->normalizeInstructorIds($course->instructorIds ?? []);
        if (empty($instructorIds)) {
            return [];
        }

        $fallbackInstructors = DB::table('users')
            ->whereIn('id', $instructorIds)
            ->pluck('name', 'id');

        return collect($instructorIds)
            ->map(fn ($id) => [
                'id' => (int) $id,
                'name' => (string) ($fallbackInstructors[(int) $id] ?? 'Instructor'),
            ])
            ->values()
            ->all();
    }

    private function privateFileUrl(Request $request, string $path): string
    {
        $requestUrl = $request->url();
        $apiPosition = strpos($requestUrl, '/api/');
        $baseUrl = $apiPosition === false ? $request->getSchemeAndHttpHost() : substr($requestUrl, 0, $apiPosition);

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

        if (!is_array($decodedValue)) {
            return [];
        }

        return collect($decodedValue)
            ->map(fn ($item) => is_array($item) && isset($item['id']) ? (int) $item['id'] : (int) $item)
            ->filter(fn ($id) => $id > 0)
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
            ->filter(fn ($item) => is_string($item) || is_numeric($item))
            ->map(fn ($item) => trim((string) $item))
            ->filter(fn ($item) => $item !== '')
            ->values()
            ->all();
    }
}
