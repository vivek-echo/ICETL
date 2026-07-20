<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('branches')) {
            return;
        }

        Schema::create('branches', function (Blueprint $table): void {
            $table->id();
            $table->integer('stateCode');
            $table->integer('districtCode');
            $table->string('branchName', 150);
            $table->text('branchAddress');
            $table->tinyInteger('status')->default(1);
            $table->unsignedBigInteger('createdBy')->nullable();
            $table->unsignedBigInteger('updatedBy')->nullable();
            $table->timestamp('createdOn')->useCurrent();
            $table->timestamp('updatedOn')->nullable();
            $table->tinyInteger('deletedFlag')->default(0);

            $table->index(['stateCode', 'districtCode'], 'branches_location_index');
            $table->index(['status', 'deletedFlag'], 'branches_status_deleted_index');
            $table->index('branchName', 'branches_name_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
