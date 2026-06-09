<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>{{ $certificate->certificateNo }}</title>

    <style>
        @page {
            margin: 0;
            size: A4 portrait;
        }

        * {
            box-sizing: border-box;
        }

        html,
        body {
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 297mm;
            overflow: hidden;
            font-family: DejaVu Sans, Arial, sans-serif;
            background: #ffffff;
            color: #111827;
            line-height: 1;
        }

        /*
        |--------------------------------------------------------------------------
        | Bootstrap-like helper classes for DomPDF
        |--------------------------------------------------------------------------
        */

        .position-relative {
            position: relative;
        }

        .position-absolute {
            position: absolute;
        }

        .text-center {
            text-align: center;
        }

        .text-left {
            text-align: left;
        }

        .text-uppercase {
            text-transform: uppercase;
        }

        .text-capitalize {
            text-transform: capitalize;
        }

        .fw-normal {
            font-weight: 400;
        }

        .fw-semibold {
            font-weight: 600;
        }

        .fw-bold {
            font-weight: 700;
        }

        .fw-bolder {
            font-weight: 900;
        }

        .fst-italic {
            font-style: italic;
        }

        .text-primary {
            color: #073d8f;
        }

        .text-dark {
            color: #111827;
        }

        .text-white {
            color: #ffffff;
        }

        .nowrap {
            white-space: nowrap;
        }

        .overflow-hidden {
            overflow: hidden;
        }

        /*
        |--------------------------------------------------------------------------
        | Certificate Layout
        |--------------------------------------------------------------------------
        */

        .certificate-page {
            position: relative;
            width: 210mm;
            height: 296.5mm;
            overflow: hidden;
            background: #ffffff;
            page-break-before: avoid;
            page-break-after: avoid;
            page-break-inside: avoid;
        }

        .certificate-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 210mm;
            height: 296.5mm;
            z-index: 1;
            display: block;
        }

        .field {
            position: absolute;
            z-index: 2;
            text-align: center;
            line-height: 1.15;
        }

        .student-code {
            top: 21.5mm;
            left: 165mm;
            width: 34mm;
            font-size: 8.5pt;
        }

        .certify-text {
            top: 89mm;
            left: 42mm;
            width: 126mm;
            font-size: 13.5pt;
        }

        .student-name {
            top: 99mm;
            left: 36mm;
            width: 138mm;
            font-size: 22pt;
            line-height: 1.05;
        }

        .completion-text {
            top: 110mm;
            left: 36mm;
            width: 138mm;
            font-size: 12.4pt;
            line-height: 1.35;
        }

        .duration-value {
            top: 133mm;
            left: 64mm;
            width: 38mm;
            font-size: 13.5pt;
        }

        .grade-value {
            top: 133mm;
            left: 114mm;
            width: 35mm;
            font-size: 13.5pt;
        }

        .award-text {
            top: 150mm;
            left: 44mm;
            width: 126mm;
            font-size: 13.5pt;
        }

        .course-name {
            top: 162mm;
            left: 35mm;
            width: 146mm;
            max-height: 18mm;
            font-size: 15.5pt;
            line-height: 1.18;
            word-wrap: break-word;
        }

        .amp {
            top: 172mm;
            left: 93mm;
            width: 30mm;
            font-size: 16pt;
        }

        .course-category {
            top: 181mm;
            left: 34mm;
            width: 146mm;
            max-height: 20mm;
            font-size: 14.8pt;
            line-height: 1.18;
            word-wrap: break-word;
        }

        .rights-text {
            top: 195mm;
            left: 31mm;
            width: 154mm;
            font-size: 11.3pt;
            line-height: 1.25;
        }

        .declared-date {
            top: 48mm;
            left: 150mm;
            width: 36mm;
            font-size: 8.3pt;
        }

        .certificate-no {
            top: 281mm;
            left: 53mm;
            width: 72mm;
            font-size: 8.2pt;
        }

        .verify-url {
            top: 276mm;
            left: 54mm;
            width: 102mm;
            font-size: 6.8pt;
            line-height: 1.25;
            word-break: break-all;
        }
    </style>
</head>

<body>
    @php
        $bgPath = public_path('certificate-assets/course-certificate-bg.png');

        $studentCode = $certificate->enrollmentId ?? $certificate->studentId ?? '';

        $gender = (string) ($certificate->gender ?? '');
        $prefix = $gender === '1' ? 'Mr.' : 'Ms.';

        $studentName = $certificate->studentName ?? 'Learner';

        $durationText = $certificate->durationText ?? '6 MONTH';
        $gradeText = $certificate->grade ?? 'A';

        $courseName = $certificate->moduleTitle ?? 'Course Name';
        $courseCategory = $certificate->courseCategory ?? 'Course Category';

        $issueDate = \Carbon\Carbon::parse($certificate->issueDate)->format('d/m/Y');
    @endphp

    <div class="certificate-page position-relative">
        <img class="certificate-bg" src="{{ $bgPath }}" alt="Course Certificate Background">

        <div class="field student-code text-left fw-bolder text-dark nowrap">
            {{ $studentCode }}
        </div>

        <div class="field certify-text fw-normal text-dark">
            This is to certify that
        </div>

        <div class="field student-name fw-normal fst-italic text-primary text-capitalize nowrap overflow-hidden">
            {{ $prefix }} {{ $studentName }}
        </div>

        <div class="field completion-text fw-semibold text-dark">
            has successfully completed the prescribed training program<br>
            with dedication, commitment, and satisfactory performance,<br>
            and has secured the grade mentioned below
        </div>

        <div class="field duration-value fw-bolder text-dark text-uppercase nowrap">
            {{ $durationText }}
        </div>

        <div class="field grade-value fw-bolder text-dark text-uppercase nowrap">
            Grade: {{ $gradeText }}
        </div>

        <div class="field award-text fw-semibold text-dark">
            and is hereby awarded this certificate for
        </div>

        <div class="field course-name fw-bolder text-primary text-uppercase overflow-hidden">
            {{ $courseName }}
        </div>

        <div class="field amp fw-bolder text-dark">
            in
        </div>

        <div class="field course-category fw-bolder text-primary text-uppercase overflow-hidden">
            {{ $courseCategory }}
        </div>

        <div class="field rights-text fw-normal text-dark">
            This certificate is issued in recognition of the learner’s successful completion,
            skills gained, and commitment to professional development.
        </div>

        <div class="field declared-date fw-bolder text-primary text-left nowrap">
            Dated: {{ $issueDate }}
        </div>

        <div class="field certificate-no fw-bolder text-white text-center nowrap">
            Certificate No: {{ $certificate->certificateNo }}
        </div>

        {{-- Enable this when you want verification URL visible --}}
        {{-- 
        <div class="field verify-url text-white text-center">
            {{ $certificate->verificationUrl }}
        </div>
        --}}
    </div>
</body>

</html>