<?php

namespace App\Services;

use App\Models\Certificate;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class CertificateVerificationService
{
    private const MAX_CODE_ATTEMPTS = 10;

    public function ensureVerificationDetails(Certificate $certificate): bool
    {
        $changed = false;
        $verificationCode = trim((string) $certificate->verificationCode);

        if ($verificationCode === '' || $this->isDuplicateCodeForAnotherCertificate($certificate, $verificationCode)) {
            $verificationCode = $this->generateUniqueVerificationCode();
            $certificate->verificationCode = $verificationCode;
            $changed = true;
        }

        $verificationUrl = $this->buildVerificationUrl($verificationCode);

        if ((string) $certificate->verificationUrl !== $verificationUrl) {
            $certificate->verificationUrl = $verificationUrl;
            $changed = true;
        }

        return $changed;
    }

    public function generateUniqueVerificationCode(): string
    {
        for ($attempt = 0; $attempt < self::MAX_CODE_ATTEMPTS; $attempt++) {
            $verificationCode = (string) Str::uuid();

            if (! Certificate::where('verificationCode', $verificationCode)->exists()) {
                return $verificationCode;
            }
        }

        throw new RuntimeException('Unable to generate a unique certificate verification code.');
    }

    public function buildVerificationUrl(string $verificationCode): string
    {
        $frontendUrl = rtrim((string) config('certificate.frontend_url'), '/');
        $verificationPath = trim((string) config('certificate.verification_path', 'verify-certificate'), '/');

        return $frontendUrl . '/' . $verificationPath . '/' . rawurlencode($verificationCode);
    }

    public function toPublicPayload(Certificate $certificate): array
    {
        return [
            'isValid' => true,
            'certificateNo' => $certificate->certificateNo,
            'studentName' => $certificate->studentName,
            'moduleType' => $certificate->moduleType,
            'moduleTypeLabel' => $this->getModuleTypeLabel((string) $certificate->moduleType),
            'moduleTitle' => $certificate->moduleTitle,
            'courseCategory' => $certificate->courseCategory,
            'durationText' => $certificate->durationText,
            'grade' => $certificate->grade,
            'issueDate' => $this->formatDate($certificate->issueDate),
            'completionDate' => $this->formatDate($certificate->completionDate),
            'verificationCode' => $certificate->verificationCode,
            'status' => 'Valid',
        ];
    }

    public function getModuleTypeLabel(string $moduleType): string
    {
        return match ($moduleType) {
            'COURSE' => 'Course Completion',
            'ACADEMIC_COURSE' => 'Academic Course',
            'WORKSHOP' => 'Workshop',
            'SEMINAR' => 'Seminar',
            default => 'Certificate',
        };
    }

    public function formatDate($date): ?string
    {
        if (empty($date)) {
            return null;
        }

        try {
            return Carbon::parse($date)->format('d F Y');
        } catch (Throwable) {
            return null;
        }
    }

    private function isDuplicateCodeForAnotherCertificate(Certificate $certificate, string $verificationCode): bool
    {
        if ($verificationCode === '') {
            return false;
        }

        $query = Certificate::where('verificationCode', $verificationCode);

        if (! empty($certificate->certificateNo)) {
            $query->where('certificateNo', '!=', $certificate->certificateNo);
        }

        return $query->exists();
    }
}
