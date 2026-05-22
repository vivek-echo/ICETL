<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('course_id');
            $table->timestamps();

            $table->unique(['user_id', 'course_id'], 'carts_user_course_unique');
            $table->index('user_id', 'carts_user_id_index');
            $table->index('course_id', 'carts_course_id_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('carts');
    }
};
