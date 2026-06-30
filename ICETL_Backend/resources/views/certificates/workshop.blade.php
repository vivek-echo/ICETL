<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>{{ $certificate->certificateNo ?? 'Workshop Certificate' }}</title>

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
            font-family: DejaVu Serif, serif;
            color: #071f68;
            background: #ffffff;
        }

        .certificate-page {
            position: relative;
            width: 210mm;
            height: 297mm;
            overflow: hidden;
            background: #ffffff;
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
            text-align: center;
        }

        .student-name {
            top: 103mm;
            left: 30mm;
            width: 150mm;
            font-size: 38px;
            font-weight: normal;
            font-style: italic;
            color: #071f68;
            line-height: 1.1;
        }

        .workshop-title {
            top: 140mm;
            left: 25mm;
            width: 160mm;
            font-size: 21px;
            font-weight: bold;
            color: #071f68;
            line-height: 1.25;
        }

        .workshop-date {
            top: 156mm;
            left: 118mm;
            width: 55mm;
            font-size: 13px;
            font-weight: 800;
            color: #111111;
            text-align: left;
        }

        .duration {
            top: 197mm;
            left: 55mm;
            width: 45mm;
            font-size: 14px;
            color: #111111;
            text-align: left;
        }

        .venue {
            top: 207mm;
            left: 51mm;
            width: 58mm;
            font-size: 14px;
            color: #111111;
            text-align: left;
        }

        .certificate-no {
            top: 197mm;
            left: 145mm;
            width: 55mm;
            font-size: 14px;
            color: #111111;
            text-align: left;
        }

        .issued-on {
            top: 207mm;
            left: 136mm;
            width: 48mm;
            font-size: 14px;
            color: #111111;
            text-align: left;
        }

        .coordinator-sign {
            top: 237mm;
            left: 24mm;
            width: 55mm;
            font-size: 22px;
            font-style: italic;
            color: #071f68;
        }

        .director-sign {
            top: 237mm;
            left: 135mm;
            width: 55mm;
            font-size: 22px;
            font-style: italic;
            color: #071f68;
        }

        .website-text {
            bottom: 3mm;
            left: 7mm;
            width: 45mm;
            font-size: 13px;
            line-height: 11px;
            font-weight: bold;
            color: #fbfcfd;
            text-align: center;
            white-space: nowrap;
        }

        .iso-text {
            bottom: 3mm;
            right: 7mm;
            width: 45mm;
            font-size: 13px;
            line-height: 11px;
            font-weight: bold;
            color: #fbfcfd;
            text-align: center;
            white-space: nowrap;
        }
        .student-id {
            top: 11.5mm;
            right: 28mm;
            font-size: 14px;
            line-height: 14px;
            font-weight: bold;
            color: #061b78;
            white-space: nowrap;
        }

        .verification-qr {
            top: 218mm;
            left: 25mm;
            width: 30mm;
            padding: 0;
            border: none;
            background: transparent;
            text-align: center;
        }

        .verification-qr img {
            display: block;
            width: 22mm;
            height: 22mm;
            margin: 0 auto;
            padding: 1.1mm;
            border: 0.18mm solid #d7a146;
            background: #ffffff;
        }

        .verification-qr__label {
            margin-top: 1mm;
            color: #071f68;
            font-family: DejaVu Serif, "Times New Roman", serif;
            font-size: 6.4px;
            line-height: 1.1;
            font-weight: bold;
            text-transform: uppercase;
        }

        .verification-qr__code {
            margin-top: 0.4mm;
            color: #8a5b18;
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 4.4px;
            line-height: 1.1;
            letter-spacing: 0;
        }
    </style>
</head>

<body>
    @php
    $isPdf = $isPdf ?? false;

    $bgFilePath = public_path('certificate-assets/workshop_new.png');

    if ($isPdf && file_exists($bgFilePath)) {
    $bgImageData = base64_encode(file_get_contents($bgFilePath));
    $bgPath = 'data:image/png;base64,' . $bgImageData;
    } else {
    $bgPath = asset('certificate-assets/workshop_new.png');
    }
    $studentCode = $certificate->studentId ?? '';
    $prefix = $certificate->gender == 1 ? 'Mr.' : 'Ms.' ;
    $studentName = $certificate->studentName ?? 'Student Name';

    $workshopTitle = $certificate->moduleTitle ?? 'Workshop Title';

    $workshopDate = date('d M Y', strtotime($certificate->startDate)) . ' - ' . date('d M Y', strtotime($certificate->endDate));

    $issuedOn = date('d M Y');

    $duration = $certificate->durationText ?? $certificate->duration ?? '';
    $venue = Str::limit($certificate->venue ?? 'ICETL Training Hall', 45, '...');
    $certificateNo = $certificate->certificateNo ?? '';
    $verificationCode = $certificate->verificationCode ?? '';
    $verificationCodeShort = $verificationCode ? substr($verificationCode, 0, 8) : '';
    $fullStudentName = trim($prefix . ' ' . $studentName);
    $fullStudentName = ucwords(strtolower($fullStudentName));
    @endphp

    <div class="certificate-page">
        <img class="certificate-bg" src="{{ $bgPath }}" alt="Workshop Certificate Background">
        <div class="field student-id">
            Student Code : {{ $studentCode }}
        </div>
        <div class="field student-name">
            {{ $fullStudentName }}
        </div>

        <div class="field workshop-title">
            {{ $workshopTitle }}
        </div>

        <div class="field workshop-date">
            {{ $workshopDate }}
        </div>

        <div class="field duration">
            {{ $duration }}
        </div>

        <div class="field venue">
            {{ $venue }}
        </div>

        <div class="field certificate-no">
            {{ $certificateNo }}
        </div>

        <div class="field issued-on">
            {{ $issuedOn }}
        </div>

        @if (!empty($qrCodeDataUri))
            <div class="field verification-qr">
                <img src="{{ $qrCodeDataUri }}" alt="Certificate verification QR code">
                <div class="verification-qr__label">Scan to Verify</div>
                @if (!empty($verificationCodeShort))
                    <div class="verification-qr__code">Ref: {{ $verificationCodeShort }}</div>
                @endif
            </div>
        @endif

        <div class="field website-text">
            www.icetl.com
        </div>

        <div class="field iso-text">
            ISO 9001:2015
        </div>
    </div>

</body>

</html>
