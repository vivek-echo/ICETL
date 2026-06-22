<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        $otpThrottleResponse = function (Request $request, array $headers) {
            $retryAfter = (int) ($headers['Retry-After'] ?? 60);

            return response()->json([
                'success' => false,
                'status' => false,
                'message' => 'Too many OTP requests. Please try again later.',
                'retryAfter' => max($retryAfter, 1),
                'resendAfter' => max($retryAfter, 1),
            ], 429, $headers);
        };

        RateLimiter::for('otp-send', function (Request $request) use ($otpThrottleResponse) {
            if (env('APP_ENV', 'local') === 'local') {
                return Limit::none();
            }

            $email = strtolower(trim((string) $request->input('emailId', $request->input('email', ''))));
            $emailKey = $email !== '' ? hash('sha256', $email) : hash('sha256', 'missing:' . ($request->ip() ?: 'unknown'));
            $ipKey = hash('sha256', $request->ip() ?: 'unknown');

            return [
                Limit::perMinutes(5, (int) config('authotp.max_send_attempts', 3))
                    ->by('email:' . $emailKey)
                    ->response($otpThrottleResponse),
                Limit::perMinutes(5, (int) config('authotp.max_send_ip_attempts', 10))
                    ->by('ip:' . $ipKey)
                    ->response($otpThrottleResponse),
            ];
        });

        RateLimiter::for('otp-verify', function (Request $request) use ($otpThrottleResponse) {
            if (env('APP_ENV', 'local') === 'local') {
                return Limit::none();
            }

            $ipKey = hash('sha256', $request->ip() ?: 'unknown');

            return Limit::perMinutes(5, (int) config('authotp.max_verify_ip_attempts', 30))
                ->by('ip:' . $ipKey)
                ->response($otpThrottleResponse);
        });

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
}
