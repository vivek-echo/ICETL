<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('workshops')) {
            Schema::create('workshops', function (Blueprint $table) {
                $table->id();
                $table->string('title', 120);
                $table->string('topic', 120);
                $table->string('venue', 150);
                $table->string('city', 100);
                $table->date('startDate');
                $table->date('endDate')->nullable();
                $table->time('startTime')->nullable();
                $table->time('endTime')->nullable();
                $table->string('speakerName', 120);
                $table->unsignedInteger('capacity')->default(0);
                $table->decimal('price', 10, 2)->default(0);
                $table->text('description');
                $table->json('takeaways')->nullable();
                $table->unsignedTinyInteger('status')->default(1);
                $table->unsignedBigInteger('createdBy')->nullable();
                $table->unsignedInteger('createdByRoleId')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamp('createdOn')->nullable();
                $table->timestamp('updatedOn')->nullable();

                $table->index('createdBy', 'workshops_created_by_index');
                $table->index('status', 'workshops_status_index');
                $table->index('startDate', 'workshops_start_date_index');
                $table->index('deletedFlag', 'workshops_deleted_flag_index');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('workshops');
    }
};
