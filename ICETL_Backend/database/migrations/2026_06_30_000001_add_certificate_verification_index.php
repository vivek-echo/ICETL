<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('certificates')) {
            return;
        }

        Schema::table('certificates', function (Blueprint $table) {
            if (! Schema::hasColumn('certificates', 'verificationCode')) {
                $table->string('verificationCode', 100)->nullable()->after('completionDate');
            }

            if (! Schema::hasColumn('certificates', 'verificationUrl')) {
                $table->string('verificationUrl', 500)->nullable()->after('verificationCode');
            }
        });

        $this->backfillVerificationDetails();

        if (
            ! Schema::hasIndex('certificates', 'certificates_verification_code_unique')
            && ! Schema::hasIndex('certificates', ['verificationCode'], 'unique')
        ) {
            Schema::table('certificates', function (Blueprint $table) {
                $table->unique('verificationCode', 'certificates_verification_code_unique');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('certificates')) {
            return;
        }

        if (Schema::hasIndex('certificates', 'certificates_verification_code_unique')) {
            Schema::table('certificates', function (Blueprint $table) {
                $table->dropUnique('certificates_verification_code_unique');
            });
        }
    }

    private function backfillVerificationDetails(): void
    {
        if (
            ! Schema::hasColumn('certificates', 'verificationCode')
            || ! Schema::hasColumn('certificates', 'verificationUrl')
        ) {
            return;
        }

        $keyColumn = Schema::hasColumn('certificates', 'id') ? 'id' : 'certificateNo';
        $seenCodes = [];
        $rows = DB::table('certificates')
            ->select($keyColumn, 'verificationCode')
            ->orderBy($keyColumn)
            ->get();

        foreach ($rows as $row) {
            $keyValue = $row->{$keyColumn} ?? null;

            if ($keyValue === null || $keyValue === '') {
                continue;
            }

            $verificationCode = trim((string) ($row->verificationCode ?? ''));

            if ($verificationCode === '' || isset($seenCodes[$verificationCode])) {
                $verificationCode = $this->makeUniqueCode($seenCodes);
            }

            $seenCodes[$verificationCode] = true;

            DB::table('certificates')
                ->where($keyColumn, $keyValue)
                ->update([
                    'verificationCode' => $verificationCode,
                    'verificationUrl' => $this->buildVerificationUrl($verificationCode),
                ]);
        }
    }

    private function makeUniqueCode(array $seenCodes): string
    {
        do {
            $verificationCode = (string) Str::uuid();
        } while (
            isset($seenCodes[$verificationCode])
            || DB::table('certificates')->where('verificationCode', $verificationCode)->exists()
        );

        return $verificationCode;
    }

    private function buildVerificationUrl(string $verificationCode): string
    {
        $frontendUrl = rtrim((string) config('certificate.frontend_url', env('FRONTEND_URL', config('app.url'))), '/');
        $verificationPath = trim((string) config('certificate.verification_path', 'verify-certificate'), '/');

        return $frontendUrl . '/' . $verificationPath . '/' . rawurlencode($verificationCode);
    }
};
