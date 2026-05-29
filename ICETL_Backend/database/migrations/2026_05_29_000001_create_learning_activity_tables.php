<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('learning_item_progress')) {
            Schema::create('learning_item_progress', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('userId');
                $table->unsignedBigInteger('courseId');
                $table->unsignedBigInteger('curriculumItemId');
                $table->string('status', 40)->default('in_progress');
                $table->unsignedTinyInteger('progressPercent')->default(0);
                $table->unsignedInteger('lastPositionSeconds')->default(0);
                $table->timestamp('completedAt')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamp('createdAt')->nullable();
                $table->timestamp('updatedAt')->nullable();

                $table->unique(
                    ['userId', 'courseId', 'curriculumItemId', 'deletedFlag'],
                    'learning_progress_user_course_item_unique'
                );
                $table->index(['userId', 'courseId'], 'learning_progress_user_course_index');
                $table->index('curriculumItemId', 'learning_progress_item_index');
            });
        }

        if (!Schema::hasTable('learning_notes')) {
            Schema::create('learning_notes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('userId');
                $table->unsignedBigInteger('courseId');
                $table->unsignedBigInteger('curriculumItemId');
                $table->longText('note');
                $table->boolean('deletedFlag')->default(false);
                $table->timestamp('createdAt')->nullable();
                $table->timestamp('updatedAt')->nullable();

                $table->unique(
                    ['userId', 'courseId', 'curriculumItemId', 'deletedFlag'],
                    'learning_notes_user_course_item_unique'
                );
                $table->index(['userId', 'courseId'], 'learning_notes_user_course_index');
                $table->index('curriculumItemId', 'learning_notes_item_index');
            });
        }

        if (!Schema::hasTable('learning_quiz_attempts')) {
            Schema::create('learning_quiz_attempts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('userId');
                $table->unsignedBigInteger('courseId');
                $table->unsignedBigInteger('curriculumItemId');
                $table->unsignedInteger('attemptNo')->default(1);
                $table->decimal('score', 8, 2)->default(0);
                $table->decimal('totalMarks', 8, 2)->default(0);
                $table->decimal('percentage', 5, 2)->default(0);
                $table->boolean('passed')->default(false);
                $table->timestamp('startedAt')->nullable();
                $table->timestamp('completedAt')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamp('createdAt')->nullable();
                $table->timestamp('updatedAt')->nullable();

                $table->index(
                    ['userId', 'courseId', 'curriculumItemId'],
                    'learning_quiz_attempts_user_course_item_index'
                );
                $table->index('curriculumItemId', 'learning_quiz_attempts_item_index');
            });
        }

        if (!Schema::hasTable('learning_quiz_attempt_answers')) {
            Schema::create('learning_quiz_attempt_answers', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('attemptId');
                $table->unsignedBigInteger('questionId');
                $table->json('selectedOptionIds')->nullable();
                $table->boolean('isCorrect')->default(false);
                $table->decimal('earnedMarks', 8, 2)->default(0);
                $table->timestamp('createdAt')->nullable();
                $table->timestamp('updatedAt')->nullable();

                $table->index('attemptId', 'learning_quiz_answers_attempt_index');
                $table->index('questionId', 'learning_quiz_answers_question_index');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_quiz_attempt_answers');
        Schema::dropIfExists('learning_quiz_attempts');
        Schema::dropIfExists('learning_notes');
        Schema::dropIfExists('learning_item_progress');
    }
};
