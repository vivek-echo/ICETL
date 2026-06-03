<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('courses')
            ->where('courseType', 1)
            ->where(function ($query) {
                $query
                    ->whereNotNull('venue')
                    ->orWhereNotNull('city')
                    ->orWhereNotNull('startDate')
                    ->orWhereNotNull('startTime')
                    ->orWhereNotNull('youtubeLiveUrl')
                    ->orWhereNotNull('meetingLink');
            })
            ->update([
                'courseType' => 2,
                'updatedOn' => now(),
            ]);
    }

    public function down(): void
    {
        // Intentionally left blank to avoid changing course classifications back.
    }
};
