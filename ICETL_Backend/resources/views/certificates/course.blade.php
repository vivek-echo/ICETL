@php
    $isPdf = $isPdf ?? false;

    $bgFilePath = public_path('certificate-assets/course-certificate-bg.png');

    if ($isPdf && file_exists($bgFilePath)) {
        $bgImageData = base64_encode(file_get_contents($bgFilePath));
        $bgPath = 'data:image/png;base64,' . $bgImageData;
    } else {
        $bgPath = asset('certificate-assets/course-certificate-bg.png');
    }

    $studentCode =  $certificate->studentId ?? '';

    $prefix = $certificate->gender == 1 ? 'Mr.' :  'Ms.' ;
    $studentName = $certificate->studentName ?? 'Learner';

    $durationText = $certificate->durationText ?? '6 MONTH';
    $gradeText = $certificate->grade ?? 'A';

    $courseName = $certificate->moduleTitle ?? 'Course Name';
    $courseCategory = $certificate->courseCategory ?? 'Course Category';

    $issueDate = !empty($certificate->issueDate)
        ? \Carbon\Carbon::parse($certificate->issueDate)->format('d F Y')
        : now()->format('d F Y');

    $certificateNo = $certificate->certificateNo ?? '';

    $fullStudentName = trim($prefix . ' ' . $studentName);
    $fullStudentName = ucwords(strtolower($fullStudentName));
@endphp

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>{{ $certificateNo ?: 'Course Completion Certificate' }}</title>

    <style>
        @page {
            size: A4 portrait;
            margin: 0;
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
            background: #ffffff;
            font-family: DejaVu Serif, "Times New Roman", serif;
            color: #111111;
        }

        body {
            overflow: hidden;
        }

        .certificate-page {
            position: relative;
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
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
            height: 297mm;
            z-index: 1;
        }

        .field {
            position: absolute;
            z-index: 2;
        }

        .student-id {
            top: 10.5mm;
            right: 28mm;
            font-size: 14px;
            line-height: 14px;
            font-weight: bold;
            color: #061b78;
            white-space: nowrap;
        }

        .student-name {
            top: 90mm;
            left: 39mm;
            width: 132mm;
            height: 15mm;

            text-align: center;
            font-family: "Georgia", "Times New Roman", serif;
            font-size: 35px;
            line-height: 15mm;
            font-weight: bold;
            letter-spacing: 0.3px;

            color: #061b78;
            white-space: nowrap;
            overflow: hidden;
        }

        .details-table {
            position: absolute;
            z-index: 2;
            top: 168mm;
            left: 24mm;
            width: 143mm;
            height: 42mm;
            font-family: "Georgia", "Times New Roman", serif;
        }

        .detail-row {
            position: relative;
            width: 143mm;
            height: 10.5mm;
            margin: 0;
            padding: 0;
            font-size: 15px;
        }

        .detail-value {
            position: absolute;
            top: 2.6mm;
            left: 47mm;
            width: 95mm;
            height: 5.5mm;

            color: #111111;
            font-size: 15px;
            font-weight: bold;
            line-height: 1.15;

            overflow: hidden;
            white-space: nowrap;
        }

        .detail-value.long-text {
            font-size: 15px;
        }

        .dated {
            top: 211mm;
            left: 96mm;
            width: 50mm;
            font-size: 15px;
            line-height: 15px;
            color: #111111;
            font-weight: bold;
            white-space: nowrap;
        }

        .certificate-no {
            bottom: 20mm;
            left: 61mm;
            width: 84mm;
            font-size: 12px;
            line-height: 12px;
            font-weight: bold;
            color: #061b78;
            text-align: center;
            white-space: nowrap;
        }
    </style>
</head>

<body>

    <div class="certificate-page">

        <img
            src="{{ $bgPath }}"
            alt="Course Completion Certificate Background"
            class="certificate-bg">

        <div class="field student-id">
            Student Code : {{ $studentCode }} 
        </div>

        <div class="field student-name">
            {{ $fullStudentName }}
        </div>

        <div class="details-table">

            <div class="detail-row">
                <div class="detail-value long-text">
                    {{ $courseName }}
                </div>
            </div>

            <div class="detail-row">
                <div class="detail-value long-text">
                    {{ $courseCategory }}
                </div>
            </div>

            <div class="detail-row">
                <div class="detail-value">
                    {{ $durationText }}
                </div>
            </div>

            <div class="detail-row">
                <div class="detail-value">
                    {{ $gradeText }}
                </div>
            </div>

        </div>

        <div class="field dated">
            {{ $issueDate }}
        </div>

        <div class="field certificate-no">
            Certificate No : {{ $certificateNo }}
        </div>

    </div>

</body>

</html>