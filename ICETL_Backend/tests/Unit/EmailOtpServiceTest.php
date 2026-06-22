<?php

namespace Tests\Unit;

use App\Services\Auth\EmailOtpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class EmailOtpServiceTest extends TestCase
{
    private string $originalEnvironment;

    protected function setUp(): void
    {
        parent::setUp();

        $this->originalEnvironment = (string) $this->app->environment();
        Cache::flush();
        config([
            'authotp.expose_in_response' => false,
            'authotp.expiry_seconds' => 300,
            'authotp.resend_seconds' => 30,
            'authotp.max_send_attempts' => 3,
            'authotp.max_send_ip_attempts' => 10,
            'authotp.max_verify_attempts' => 5,
            'authotp.max_verify_ip_attempts' => 30,
        ]);
    }

    protected function tearDown(): void
    {
        $this->app['env'] = $this->originalEnvironment;
        Cache::flush();

        parent::tearDown();
    }

    public function test_local_requires_explicit_flag_to_expose_otp(): void
    {
        $this->app['env'] = 'local';

        $response = $this->service()->issueOtp(
            $this->requestFor('local-flag-off@example.com'),
            fn() => null,
        );

        $this->assertTrue($response['success']);
        $this->assertArrayNotHasKey('otp', $response);
    }

    public function test_staging_never_exposes_otp_even_when_flag_is_enabled(): void
    {
        config(['authotp.expose_in_response' => true]);

        $this->app['env'] = 'local';
        $localResponse = $this->service()->issueOtp(
            $this->requestFor('local-flag-on@example.com'),
            fn() => null,
        );

        $this->assertArrayHasKey('otp', $localResponse);

        $this->app['env'] = 'staging';
        $stagingResponse = $this->service()->issueOtp(
            $this->requestFor('staging-flag-on@example.com'),
            fn() => null,
        );

        $this->assertTrue($stagingResponse['success']);
        $this->assertArrayNotHasKey('otp', $stagingResponse);
    }

    public function test_resend_cooldown_blocks_duplicate_send(): void
    {
        $this->app['env'] = 'local';
        config(['authotp.expose_in_response' => true]);

        $request = $this->requestFor('cooldown@example.com');
        $firstResponse = $this->service()->issueOtp($request, fn() => null);
        $secondResponse = $this->service()->issueOtp($request, fn() => null);

        $this->assertTrue($firstResponse['success']);
        $this->assertFalse($secondResponse['success']);
        $this->assertSame(429, $secondResponse['http_status']);
        $this->assertGreaterThan(0, $secondResponse['retryAfter']);
    }

    public function test_five_invalid_attempts_invalidate_active_otp(): void
    {
        $this->app['env'] = 'local';
        config(['authotp.expose_in_response' => true]);

        $service = $this->service();
        $email = 'invalid-attempts@example.com';
        $issueResponse = $service->issueOtp($this->requestFor($email), fn() => null);

        $this->assertArrayHasKey('otp', $issueResponse);

        for ($attempt = 1; $attempt <= 4; $attempt++) {
            $verifyResponse = $service->verifyOtp($this->requestFor($email, ['otp' => '000000']));

            $this->assertFalse($verifyResponse['success']);
            $this->assertSame(422, $verifyResponse['http_status']);
        }

        $fifthResponse = $service->verifyOtp($this->requestFor($email, ['otp' => '000000']));

        $this->assertFalse($fifthResponse['success']);
        $this->assertSame(429, $fifthResponse['http_status']);

        $correctAfterInvalidation = $service->verifyOtp(
            $this->requestFor($email, ['otp' => (string) $issueResponse['otp']])
        );

        $this->assertFalse($correctAfterInvalidation['success']);
        $this->assertSame('OTP expired', $correctAfterInvalidation['message']);
    }

    private function service(): EmailOtpService
    {
        return $this->app->make(EmailOtpService::class);
    }

    private function requestFor(string $email, array $extraPayload = []): Request
    {
        return Request::create(
            '/api/sendOtp',
            'POST',
            ['emailId' => $email, ...$extraPayload],
            [],
            [],
            ['REMOTE_ADDR' => '10.10.10.10']
        );
    }
}
