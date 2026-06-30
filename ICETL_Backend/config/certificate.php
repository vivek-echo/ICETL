<?php

return [
    'frontend_url' => env('FRONTEND_URL', env('APP_URL', 'http://localhost')),

    'verification_path' => env('CERTIFICATE_VERIFICATION_PATH', 'verify-certificate'),

    'qr_size' => (int) env('CERTIFICATE_QR_SIZE', 220),

    'qr_margin' => (int) env('CERTIFICATE_QR_MARGIN', 12),

    'qr_logo_path' => env('CERTIFICATE_QR_LOGO_PATH', 'certificate-assets/logo.jpeg'),

    'qr_logo_width' => (int) env('CERTIFICATE_QR_LOGO_WIDTH', 44),
];
