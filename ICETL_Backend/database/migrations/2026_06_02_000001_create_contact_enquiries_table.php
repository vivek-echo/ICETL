<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('contact_enquiries')) {
            Schema::create('contact_enquiries', function (Blueprint $table) {
                $table->id();
                $table->string('fullName', 120);
                $table->string('email', 150);
                $table->string('phone', 20);
                $table->string('enquiryType', 80)->default('Other');
                $table->string('subject', 150);
                $table->text('message');
                $table->boolean('isRead')->default(false);
                $table->unsignedBigInteger('readBy')->nullable();
                $table->timestamp('readOn')->nullable();
                $table->string('ipAddress', 64)->nullable();
                $table->text('browserInfo')->nullable();
                $table->boolean('deletedFlag')->default(false);
                $table->timestamp('createdOn')->nullable();
                $table->timestamp('updatedOn')->nullable();

                $table->index('email', 'contact_enquiries_email_index');
                $table->index('phone', 'contact_enquiries_phone_index');
                $table->index('isRead', 'contact_enquiries_is_read_index');
                $table->index('createdOn', 'contact_enquiries_created_on_index');
                $table->index('deletedFlag', 'contact_enquiries_deleted_flag_index');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_enquiries');
    }
};
