<?php

namespace App\Services\Auth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;

class EmailOtpService
{
    public function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    public function issueOtp(Request $request, callable $sendMail): array
    {
        $email = $this->normalizeEmail((string) $request->input('emailId', ''));
        $sendLimit = $this->checkSendLimits($email, $request);

        if ($sendLimit !== null) {
            return $sendLimit;
        }

        $otp = (string) random_int(100000, 999999);
        $expiresIn = $this->expirySeconds();
        $resendAfter = $this->resendSeconds();

        Cache::put($this->otpCacheKey($email), Hash::make($otp), $expiresIn);
        Cache::put($this->attemptsCacheKey($email), 0, $expiresIn);
        Cache::put($this->cooldownCacheKey($email), time() + $resendAfter, $resendAfter);

        try {
            if (!$this->shouldExposeOtpInResponse()) {
                $sendMail($email, $otp);
            }
        } catch (Throwable $exception) {
            $this->invalidate($email);
            Cache::forget($this->cooldownCacheKey($email));

            Log::error('OTP mail dispatch failed', [
                'email_hash' => $this->hashValue($email),
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        $response = [
            'success' => true,
            'status' => true,
            'message' => 'OTP sent successfully',
            'expiresIn' => $expiresIn,
            'resendAfter' => $resendAfter,
        ];

        if ($this->shouldExposeOtpInResponse()) {
            $response['otp'] = $otp;
        }

        return $response;
    }

    public function verifyOtp(Request $request): array
    {
        $email = $this->normalizeEmail((string) $request->input('emailId', ''));
        $otp = trim((string) $request->input('otp', ''));
        $ipLimit = $this->checkVerifyIpLimit($request);

        if ($ipLimit !== null) {
            return $ipLimit;
        }

        $cachedOtp = Cache::get($this->otpCacheKey($email));

        if (!$cachedOtp) {
            return [
                'success' => false,
                'status' => false,
                'message' => 'OTP expired',
                'http_status' => 422,
            ];
        }

        RateLimiter::hit($this->verifyIpRateLimitKey($request), $this->verifyIpDecaySeconds());

        if (!Hash::check($otp, (string) $cachedOtp)) {
            $attempts = (int) Cache::increment($this->attemptsCacheKey($email));

            if ($attempts >= $this->maxVerifyAttempts()) {
                $this->invalidate($email);

                Log::warning('OTP invalidated due to too many attempts', [
                    'email_hash' => $this->hashValue($email),
                    'attempts' => $attempts,
                ]);

                return [
                    'success' => false,
                    'status' => false,
                    'message' => 'Too many attempts. Please request a new OTP.',
                    'http_status' => 429,
                ];
            }

            return [
                'success' => false,
                'status' => false,
                'message' => 'Invalid OTP',
                'http_status' => 422,
            ];
        }

        $this->invalidate($email);

        return [
            'success' => true,
            'status' => true,
            'email' => $email,
        ];
    }

    public function invalidate(string $email): void
    {
        $email = $this->normalizeEmail($email);

        Cache::forget($this->otpCacheKey($email));
        Cache::forget($this->attemptsCacheKey($email));
    }

    public function shouldExposeOtpInResponse(): bool
    {
        $appEnv = env('APP_ENV', 'local');
        $exposeInResponse = env('OTP_EXPOSE_IN_RESPONSE', in_array($appEnv, ['local', 'staging'], true));
        return in_array($appEnv, ['local', 'staging'], true) && (bool) $exposeInResponse;
    }

    private function checkSendLimits(string $email, Request $request): ?array
    {
        if (env('APP_ENV', 'local') === 'local') {
            return null;
        }

        $cooldownUntil = (int) Cache::get($this->cooldownCacheKey($email), 0);

        if ($cooldownUntil > time()) {
            $retryAfter = max($cooldownUntil - time(), 1);

            return $this->rateLimitedResponse(
                'Please wait before requesting another OTP',
                $retryAfter
            );
        }

        $emailKey = $this->sendEmailRateLimitKey($email);
        $ipKey = $this->sendIpRateLimitKey($request);

        if (RateLimiter::tooManyAttempts($emailKey, $this->maxSendAttempts())) {
            return $this->rateLimitedResponse(
                'Too many OTP requests. Please try again later.',
                RateLimiter::availableIn($emailKey)
            );
        }

        if (RateLimiter::tooManyAttempts($ipKey, $this->maxSendIpAttempts())) {
            return $this->rateLimitedResponse(
                'Too many OTP requests. Please try again later.',
                RateLimiter::availableIn($ipKey)
            );
        }

        RateLimiter::hit($emailKey, $this->sendDecaySeconds());
        RateLimiter::hit($ipKey, $this->sendIpDecaySeconds());

        return null;
    }

    private function checkVerifyIpLimit(Request $request): ?array
    {
        $ipKey = $this->verifyIpRateLimitKey($request);

        if (!RateLimiter::tooManyAttempts($ipKey, $this->maxVerifyIpAttempts())) {
            return null;
        }

        return $this->rateLimitedResponse(
            'Too many OTP verification attempts. Please try again later.',
            RateLimiter::availableIn($ipKey)
        );
    }

    private function rateLimitedResponse(string $message, int $retryAfter): array
    {
        $retryAfter = max($retryAfter, 1);

        return [
            'success' => false,
            'status' => false,
            'message' => $message,
            'retryAfter' => $retryAfter,
            'resendAfter' => $retryAfter,
            'http_status' => 429,
        ];
    }

    private function otpCacheKey(string $email): string
    {
        return 'otp:code:' . $this->hashValue($email);
    }

    private function attemptsCacheKey(string $email): string
    {
        return 'otp:verify:attempts:' . $this->hashValue($email);
    }

    private function cooldownCacheKey(string $email): string
    {
        return 'otp:cooldown:' . $this->hashValue($email);
    }

    private function sendEmailRateLimitKey(string $email): string
    {
        return 'otp:send:email:' . $this->hashValue($email);
    }

    private function sendIpRateLimitKey(Request $request): string
    {
        return 'otp:send:ip:' . $this->hashValue($request->ip() ?: 'unknown');
    }

    private function verifyIpRateLimitKey(Request $request): string
    {
        return 'otp:verify:ip:' . $this->hashValue($request->ip() ?: 'unknown');
    }

    private function hashValue(string $value): string
    {
        return hash('sha256', $value);
    }

    private function expirySeconds(): int
    {
        return (int) config('authotp.expiry_seconds', 300);
    }

    private function resendSeconds(): int
    {
        return (int) config('authotp.resend_seconds', 30);
    }

    private function maxSendAttempts(): int
    {
        return (int) config('authotp.max_send_attempts', 3);
    }

    private function sendDecaySeconds(): int
    {
        return (int) config('authotp.max_send_attempts_decay_seconds', 300);
    }

    private function maxSendIpAttempts(): int
    {
        return (int) config('authotp.max_send_ip_attempts', 10);
    }

    private function sendIpDecaySeconds(): int
    {
        return (int) config('authotp.max_send_ip_attempts_decay_seconds', 300);
    }

    private function maxVerifyAttempts(): int
    {
        return (int) config('authotp.max_verify_attempts', 5);
    }

    private function maxVerifyIpAttempts(): int
    {
        return (int) config('authotp.max_verify_ip_attempts', 30);
    }

    private function verifyIpDecaySeconds(): int
    {
        return (int) config('authotp.max_verify_ip_attempts_decay_seconds', 300);
    }
}
