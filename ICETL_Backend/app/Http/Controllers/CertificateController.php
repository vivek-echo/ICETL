<?php

namespace App\Http\Controllers;

use App\Models\Certificate;
use App\Services\CertificateQrCodeService;
use App\Services\CertificateVerificationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use RuntimeException;
use Throwable;

class CertificateController extends Controller
{
    public function __construct(
        private readonly CertificateQrCodeService $certificateQrCodeService,
        private readonly CertificateVerificationService $certificateVerificationService,
    ) {
    }

    public function generate(Request $request)
    {
        $requestData = $request->all();
        $request->validate([
            'moduleType' => 'required|in:COURSE,ACADEMIC_COURSE,WORKSHOP,SEMINAR',
            'moduleId' => 'required|integer|min:1',
        ]);

        $user = $requestData['userProfile'] ?? null;
        $userid = Crypt::decryptstring($user['id']);

        $moduleType = $request->moduleType;
        $moduleId = (int) $request->moduleId;

        $existingCertificate = Certificate::where('userId', $userid)
            ->where('moduleType', $moduleType)
            ->where('moduleId', $moduleId)
            ->where('deletedFlag', 0)
            ->where('status', 1)
            ->first();

        if ($existingCertificate) {
            $this->syncExistingCertificateVerification($existingCertificate);

            return response()->json([
                'success' => true,
                'message' => 'Certificate already generated.',
                'alreadyGenerated' => true,
                'certificateNo' => $existingCertificate->certificateNo,
                'downloadUrl' => $this->getCertificateDownloadUrl($existingCertificate),
            ]);
        }

        try {
            DB::beginTransaction();

            $moduleDetails = $this->getModuleDetails($moduleType, $moduleId);

            if (! $moduleDetails) {
                DB::rollBack();

                return response()->json([
                    'success' => false,
                    'message' => 'Module details not found.',
                ], 404);
            }

            $certificateNo = $this->generateCertificateNo($moduleType);
            $certificate = $this->createCertificateWithVerification([
                'certificateNo' => $certificateNo,
                'userId' => $userid,
                'moduleType' => $moduleType,
                'moduleId' => $moduleId,
                'enrollmentId' => null,

                'studentName' => $user['name'] ?? 'Learner',
                'studentId' => $user['code'] ?? null,
                'gender' => $user['gender'] ?? null,
                'moduleTitle' => $moduleDetails['title'],
                'durationText' => $moduleDetails['durationText'] ?? null,
                'courseCategory' => $moduleDetails['courseCategory'] ?? null,
                'endDate' => $moduleDetails['endDate'] ?? null,
                'startDate' => $moduleDetails['startDate'] ?? null,
                'venue' => $moduleDetails['venue'] ?? null,
                'grade' => 'A',
                'score' => null,

                'issueDate' => now()->toDateString(),
                'completionDate' => now()->toDateString(),
                'certificatePdfPath' => null,

                'status' => 1,
                'createdBy' => $userid,
                'createdOn' => now(),
                'updatedOn' => null,
                'deletedFlag' => 0,
            ]);

            $pdfPath = $this->generateCertificatePdf($certificate);

            $certificate->certificatePdfPath = $pdfPath;
            $certificate->updatedOn = now();
            $certificate->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Certificate generated successfully.',
                'alreadyGenerated' => false,
                'certificateNo' => $certificate->certificateNo,
                'downloadUrl' => $this->getCertificateDownloadUrl($certificate),
            ]);
        } catch (Throwable $exception) {
            DB::rollBack();

            Log::error('Certificate generation failed.', [
                'message' => $exception->getMessage(),
                'moduleType' => $moduleType,
                'moduleId' => $moduleId,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to generate certificate.',
            ], 500);
        }
    }

    public function verify(string $verificationCode)
    {
        $verificationCode = trim($verificationCode);

        $validator = Validator::make([
            'verificationCode' => $verificationCode,
        ], [
            'verificationCode' => ['required', 'string', 'min:20', 'max:120', 'regex:/^[A-Za-z0-9-]+$/'],
        ]);

        if ($validator->fails()) {
            return $this->invalidCertificateResponse();
        }

        try {
            $certificate = Certificate::where('verificationCode', $verificationCode)
                ->where('deletedFlag', 0)
                ->first();

            if (! $certificate) {
                return $this->invalidCertificateResponse();
            }

            if ((int) $certificate->status !== 1) {
                return response()->json([
                    'success' => false,
                    'message' => 'Certificate has been revoked or is inactive.',
                    'data' => [
                        'isValid' => false,
                        'status' => 'Inactive',
                    ],
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Certificate verified successfully.',
                'data' => $this->certificateVerificationService->toPublicPayload($certificate),
            ]);
        } catch (Throwable $exception) {
            Log::error('Certificate verification lookup failed.', [
                'message' => $exception->getMessage(),
                'verificationCode' => $verificationCode,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to verify certificate at the moment.',
                'data' => [
                    'isValid' => false,
                ],
            ], 500);
        }
    }

    private function getModuleDetails(string $moduleType, int $moduleId): ?array
    {
        if ($moduleType === 'COURSE') {
            $course = DB::table('courses')
                ->where('id', $moduleId)
                ->where('deletedFlag', 0)
                ->first();

            if (! $course) {
                return null;
            }

            return [
                'courseCategory' => $course->categoryId ? DB::table('coursecategories')->where('id', $course->categoryId)->value('categoryName') : null,
                'courseCode' => $course->code ?? null,
                'title' => $course->title,
                'durationText' => $course->duration . ' ' . ($course->durationUnit == 1 ? 'weeks' : 'months'),
                'startDate' => $course->startDate,
                'endDate' => $course->endDate,
            ];
        }

        if ($moduleType === 'WORKSHOP') {
            $workshop = DB::table('workshops')
                ->where('id', $moduleId)
                ->where('deletedFlag', 0)
                ->first();

            if (! $workshop) {
                return null;
            }

            return [
                'title' => $workshop->title,
                'venue' => $workshop->venue ?? null,
                'startDate' => $workshop->startDate,
                'endDate' => $workshop->endDate,
                'durationText' => $this->getDurationText(
                    $workshop->startDate,
                    $workshop->endDate
                ),
            ];
        }

        if ($moduleType === 'ACADEMIC_COURSE') {
            $academicCourse = DB::table('courses')
                ->where('id', $moduleId)
                ->where('deletedFlag', 0)
                ->first();

            if (! $academicCourse) {
                return null;
            }

            return [
                'courseCategory' => $academicCourse->categoryId
                    ? DB::table('coursecategories')->where('id', $academicCourse->categoryId)->value('categoryName')
                    : null,

                'courseCode' => $academicCourse->code ?? null,

                'title' => $academicCourse->title,
                'startDate' => $academicCourse->startDate,
                'endDate' => $academicCourse->endDate,

                'durationText' => $academicCourse->startDate && $academicCourse->endDate
                    ? date('d M Y', strtotime($academicCourse->startDate))
                    . ' - '
                    . date('d M Y', strtotime($academicCourse->endDate))
                    . ' ('
                    . $this->getDurationText(
                        $academicCourse->startDate,
                        $academicCourse->endDate
                    )
                    . ')'
                    : null,
            ];
        }

        if ($moduleType === 'SEMINAR') {
            $seminar = DB::table('seminars')
                ->where('id', $moduleId)
                ->where('deletedFlag', 0)
                ->first();

            if (! $seminar) {
                return null;
            }

            return [
                'title' => $seminar->title,
                'venue' => $seminar->venue ?? null,
                'startDate' => $seminar->startDate,
                'endDate' => $seminar->endDate,
                'durationText' => $this->getDurationText(
                    $seminar->startDate,
                    $seminar->endDate
                ),
            ];
        }

        return null;
    }

    private function getDurationText($startDate, $endDate): ?string
    {
        if (! $startDate || ! $endDate) {
            return null;
        }

        $start = strtotime($startDate);
        $end = strtotime($endDate);

        if (! $start || ! $end || $end < $start) {
            return null;
        }

        $days = floor(($end - $start) / (24 * 60 * 60)) + 1;

        if ($days < 7) {
            return $days . ' ' . ($days > 1 ? 'days' : 'day');
        }

        if ($days < 30) {
            $weeks = ceil($days / 7);
            return $weeks . ' ' . ($weeks > 1 ? 'weeks' : 'week');
        }

        if ($days < 365) {
            $months = ceil($days / 30);
            return $months . ' ' . ($months > 1 ? 'months' : 'month');
        }

        $years = round($days / 365, 1);

        return $years . ' ' . ($years > 1 ? 'years' : 'year');
    }

    private function createCertificateWithVerification(array $attributes): Certificate
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $verificationCode = $this->certificateVerificationService->generateUniqueVerificationCode();

            try {
                return Certificate::create([
                    ...$attributes,
                    'verificationCode' => $verificationCode,
                    'verificationUrl' => $this->certificateVerificationService->buildVerificationUrl($verificationCode),
                ]);
            } catch (QueryException $exception) {
                if (! $this->isVerificationCodeConflict($exception)) {
                    throw $exception;
                }
            }
        }

        throw new RuntimeException('Unable to create a certificate with a unique verification code.');
    }

    private function syncExistingCertificateVerification(Certificate $certificate): void
    {
        try {
            $changed = $this->certificateVerificationService->ensureVerificationDetails($certificate);

            if (! $changed) {
                return;
            }

            $certificate->updatedOn = now();
            $certificate->save();

            if (! $certificate->certificatePdfPath) {
                return;
            }

            $certificate->certificatePdfPath = $this->generateCertificatePdf($certificate);
            $certificate->updatedOn = now();
            $certificate->save();
        } catch (Throwable $exception) {
            Log::warning('Unable to sync existing certificate verification details.', [
                'message' => $exception->getMessage(),
                'certificateNo' => $certificate->certificateNo,
            ]);
        }
    }

    private function isVerificationCodeConflict(QueryException $exception): bool
    {
        $message = $exception->getMessage();

        return (string) $exception->getCode() === '23000'
            && (
                str_contains($message, 'verificationCode')
                || str_contains($message, 'verification_code')
                || str_contains($message, 'certificates_verification_code_unique')
            );
    }

    private function generateCertificateNo(string $moduleType): string
    {
        $year = date('Y');

        $prefix = match ($moduleType) {
            'COURSE' => 'ICETL-C',
            'ACADEMIC_COURSE' => 'ICETL-AC',
            'WORKSHOP' => 'ICETL-WK',
            'SEMINAR' => 'ICETL-SM',
            default => 'ICETL-CERT',
        };

        $count = Certificate::where('moduleType', $moduleType)
            ->whereYear('issueDate', $year)
            ->count() + 1;

        return $prefix . '-' . $year . '-' . str_pad($count, 6, '0', STR_PAD_LEFT);
    }

    private function getCertificateTitle(string $moduleType): string
    {
        return match ($moduleType) {
            'COURSE' => 'Certificate of Completion',
            'ACADEMIC_COURSE' => 'Certificate of Enrollment',
            'WORKSHOP' => 'Certificate of Participation',
            'SEMINAR' => 'Certificate of Participation',
            default => 'Certificate',
        };
    }

    private function generateCertificatePdf(Certificate $certificate): string
    {
        if ($this->certificateVerificationService->ensureVerificationDetails($certificate)) {
            $certificate->updatedOn = now();
            $certificate->save();
        }

        $folder = 'certificates';

        if (! Storage::disk('private')->exists($folder)) {
            Storage::disk('private')->makeDirectory($folder);
        }

        $fileName = $certificate->certificateNo . '.pdf';
        $storagePath = $folder . '/' . $fileName;

        if (Storage::disk('private')->exists($storagePath)) {
            Storage::disk('private')->delete($storagePath);
        }

        $pdf = Pdf::loadView($this->getCertificateView($certificate->moduleType), [
            'certificate' => $certificate,
            'certificateTitle' => $this->getCertificateTitle($certificate->moduleType),
            'qrCodeDataUri' => $this->certificateQrCodeService->generateDataUri($certificate->verificationUrl),
            'isPdf' => true,
        ])
            ->setPaper('a4', 'portrait')
            ->setOptions([
                'isHtml5ParserEnabled' => true,
                'isRemoteEnabled' => true,
                'defaultFont' => 'DejaVu Serif',
                'dpi' => 96,
                'chroot' => public_path(),
            ]);

        Storage::disk('private')->put($storagePath, $pdf->output());

        return $storagePath;
    }

    private function getCertificateView(string $moduleType): string
    {
        return match ($moduleType) {
            'WORKSHOP' => 'certificates.workshop',
            'SEMINAR' => 'certificates.seminar',
            default => 'certificates.course',
        };
    }

    private function getCertificateDownloadUrl(Certificate $certificate): ?string
    {
        if (! $certificate->certificatePdfPath) {
            return null;
        }

        return url('/api/certificates/download/' . $certificate->certificateNo);
    }

    private function invalidCertificateResponse()
    {
        return response()->json([
            'success' => false,
            'message' => 'Certificate not found or verification code is invalid.',
            'data' => [
                'isValid' => false,
            ],
        ], 404);
    }

    public function download(string $certificateNo)
    {
        $certificate = Certificate::where('certificateNo', $certificateNo)
            ->where('deletedFlag', 0)
            ->where('status', 1)
            ->first();

        if (! $certificate || ! $certificate->certificatePdfPath) {
            return response()->json([
                'success' => false,
                'message' => 'Certificate not found.',
            ], 404);
        }

        if (! Storage::disk('private')->exists($certificate->certificatePdfPath)) {
            return response()->json([
                'success' => false,
                'message' => 'Certificate file not found.',
            ], 404);
        }

        $filePath = Storage::disk('private')->path($certificate->certificatePdfPath);
        $fileName = $certificate->certificateNo . '.pdf';

        return response()->download($filePath, $fileName, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $fileName . '"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
        ]);
    }
}
