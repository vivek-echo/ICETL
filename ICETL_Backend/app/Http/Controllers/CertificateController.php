<?php

namespace App\Http\Controllers;

use App\Models\Certificate;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CertificateController extends Controller
{


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

            if (!$moduleDetails) {
                DB::rollBack();

                return response()->json([
                    'success' => false,
                    'message' => 'Module details not found.',
                ], 404);
            }

            $certificateNo = $this->generateCertificateNo($moduleType);
            $verificationCode = Str::uuid()->toString();
            $verificationUrl = url('/verify-certificate/' . $certificateNo);
            $certificate = Certificate::create([
                'certificateNo' => $certificateNo,
                'userId' => $userid,
                'moduleType' => $moduleType,
                'moduleId' => $moduleId,
                'enrollmentId' =>  null, // learner code

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

                'verificationCode' => $verificationCode,
                'verificationUrl' => $verificationUrl,

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
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Unable to generate certificate.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function verify(string $certificateNo)
    {
        $certificate = Certificate::where('certificateNo', $certificateNo)
            ->where('deletedFlag', 0)
            ->where('status', 1)
            ->first();

        if (!$certificate) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid certificate number.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Certificate is valid.',
            'data' => [
                'certificateNo' => $certificate->certificateNo,
                'studentName' => $certificate->studentName,
                'studentId' => $certificate->studentId,
                'moduleType' => $certificate->moduleType,
                'moduleTitle' => $certificate->moduleTitle,
                'durationText' => $certificate->durationText,
                'issueDate' => $certificate->issueDate,
                'verificationUrl' => $certificate->verificationUrl,
            ],
        ]);
    }

    private function getModuleDetails(string $moduleType, int $moduleId): ?array
    {
        if ($moduleType === 'COURSE') {
            $course = DB::table('courses')
                ->where('id', $moduleId)
                ->where('deletedFlag', 0)
                ->first();

            if (!$course) {
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

            if (!$workshop) {
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
                )
            ];
        }

        if ($moduleType === 'ACADEMIC_COURSE') {
            $academicCourse = DB::table('courses')
                ->where('id', $moduleId)
                ->where('deletedFlag', 0)
                ->first();

            if (!$academicCourse) {
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

            if (!$seminar) {
                return null;
            }

            return [
                'title' => $seminar->title ?? $seminar->seminarTitle ?? $seminar->name ?? 'Seminar',
                'durationText' => $seminar->duration ?? $seminar->durationText ?? null,
            ];
        }

        return null;
    }

    private function getDurationText($startDate, $endDate): ?string
    {
        if (!$startDate || !$endDate) {
            return null;
        }

        $start = strtotime($startDate);
        $end = strtotime($endDate);

        if (!$start || !$end || $end < $start) {
            return null;
        }

        // Inclusive days: 15 Jun to 16 Jun = 2 days
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

    // private function generateCertificatePdf(Certificate $certificate): string
    // {
    //     $folder = 'certificates';

    //     if (!Storage::disk('private')->exists($folder)) {
    //         Storage::disk('private')->makeDirectory($folder);
    //     }

    //     $fileName = $certificate->certificateNo . '.pdf';
    //     $storagePath = $folder . '/' . $fileName;

    //     $logoPath = public_path('certificate-assets/logo.png');

    //     $pdf = Pdf::loadView('certificates.default', [
    //         'certificate' => $certificate,
    //         'certificateTitle' => $this->getCertificateTitle($certificate->moduleType),
    //         'logoPath' => file_exists($logoPath) ? $logoPath : null,
    //     ])->setPaper('a4', 'landscape');

    //     Storage::disk('private')->put($storagePath, $pdf->output());

    //     return $storagePath;
    // }

    private function generateCertificatePdf(Certificate $certificate): string
    {
        $folder = 'certificates';

        if (!Storage::disk('private')->exists($folder)) {
            Storage::disk('private')->makeDirectory($folder);
        }

        $fileName = $certificate->certificateNo . '.pdf';
        $storagePath = $folder . '/' . $fileName;

        if (Storage::disk('private')->exists($storagePath)) {
            Storage::disk('private')->delete($storagePath);
        }
        if ($certificate->moduleType === 'WORKSHOP') {
            $view = 'certificates.workshop';
        } else {
            $view = 'certificates.course';
        }
        $pdf = Pdf::loadView($view, [
            'certificate' => $certificate,
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

    private function getCertificateDownloadUrl(Certificate $certificate): ?string
    {
        if (!$certificate->certificatePdfPath) {
            return null;
        }

        return asset('storage/' . $certificate->certificatePdfPath);
    }
}
