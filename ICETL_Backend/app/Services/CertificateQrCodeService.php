<?php

namespace App\Services;

use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\RoundBlockSizeMode;
use Endroid\QrCode\Writer\PngWriter;
use Endroid\QrCode\Writer\SvgWriter;
use Endroid\QrCode\Writer\WriterInterface;
use Illuminate\Support\Facades\Log;
use Throwable;

class CertificateQrCodeService
{
    public function generateDataUri(?string $verificationUrl): ?string
    {
        $verificationUrl = trim((string) $verificationUrl);

        if ($verificationUrl === '') {
            return null;
        }

        try {
            return $this->buildDataUri(new PngWriter(), $verificationUrl);
        } catch (Throwable $exception) {
            Log::warning('Certificate QR PNG generation failed.', [
                'message' => $exception->getMessage(),
            ]);
        }

        try {
            return $this->buildDataUri(new SvgWriter(), $verificationUrl);
        } catch (Throwable $exception) {
            Log::warning('Certificate QR SVG generation failed.', [
                'message' => $exception->getMessage(),
            ]);
        }

        return null;
    }

    private function buildDataUri(WriterInterface $writer, string $verificationUrl): string
    {
        $logoPath = $this->getLogoPath();

        $builder = new Builder(
            writer: $writer,
            writerOptions: [],
            validateResult: false,
            data: $verificationUrl,
            encoding: new Encoding('UTF-8'),
            errorCorrectionLevel: ErrorCorrectionLevel::High,
            size: max((int) config('certificate.qr_size', 220), 120),
            margin: max((int) config('certificate.qr_margin', 12), 4),
            roundBlockSizeMode: RoundBlockSizeMode::Margin,
            logoPath: $logoPath ?? '',
            logoResizeToWidth: $logoPath ? max((int) config('certificate.qr_logo_width', 44), 24) : null,
            logoPunchoutBackground: true,
        );

        return $builder->build()->getDataUri();
    }

    private function getLogoPath(): ?string
    {
        $configuredPath = trim((string) config('certificate.qr_logo_path', 'certificate-assets/logo.jpeg'));

        if ($configuredPath === '') {
            return null;
        }

        $isAbsolutePath = str_starts_with($configuredPath, DIRECTORY_SEPARATOR)
            || preg_match('/^[A-Za-z]:[\\\\\/]/', $configuredPath) === 1;

        $logoPath = $isAbsolutePath
            ? $configuredPath
            : public_path($configuredPath);

        return is_file($logoPath) ? $logoPath : null;
    }
}
