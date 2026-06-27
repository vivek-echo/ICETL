<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moduleMaterials')) {
            return;
        }

        Schema::create('moduleMaterials', function (Blueprint $table) {
            $table->id();
            $table->string('moduleType', 40);
            $table->unsignedBigInteger('moduleId');
            $table->unsignedBigInteger('instructorId')->nullable();
            $table->string('title', 150);
            $table->text('description')->nullable();
            $table->date('materialDate')->nullable();
            $table->string('originalFileName', 255);
            $table->string('storedFileName', 255);
            $table->string('filePath', 500);
            $table->string('fileExtension', 20)->nullable();
            $table->string('mimeType', 150)->nullable();
            $table->unsignedBigInteger('fileSize')->nullable();
            $table->unsignedTinyInteger('status')->default(1);
            $table->boolean('deletedFlag')->default(false);
            $table->unsignedBigInteger('createdBy')->nullable();
            $table->unsignedBigInteger('updatedBy')->nullable();
            $table->timestamps();

            $table->index(['moduleType', 'moduleId'], 'module_materials_module_index');
            $table->index('instructorId', 'module_materials_instructor_index');
            $table->index('materialDate', 'module_materials_material_date_index');
            $table->index('deletedFlag', 'module_materials_deleted_flag_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moduleMaterials');
    }
};
