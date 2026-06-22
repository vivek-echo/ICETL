<?php

namespace App\Services\Auth;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Throwable;

class AuthFlowTokenService
{
    public const PURPOSE_ROLE_SELECTION = 'role_selection';
    public const PURPOSE_PROFILE_COMPLETION = 'profile_completion';

    public function create(Request $request, string $purpose, array $state): string
    {
        $plainToken = bin2hex(random_bytes(32));
        $tokenHash = $this->hashToken($plainToken);

        Cache::put($this->cacheKey($tokenHash), [
            ...$state,
            'purpose' => $purpose,
            'verified_at' => now()->timestamp,
            'ip_hash' => $this->hashValue($request->ip() ?: 'unknown'),
            'user_agent_hash' => $this->hashValue((string) $request->userAgent()),
        ], $this->expirySeconds());

        return $plainToken;
    }

    public function consume(Request $request, string $plainToken, string $purpose, Closure $callback): mixed
    {
        $tokenHash = $this->hashToken($plainToken);
        $cacheKey = $this->cacheKey($tokenHash);
        $lock = Cache::lock($this->lockKey($tokenHash), 10);

        if (!$lock->get()) {
            return null;
        }

        try {
            $state = Cache::get($cacheKey);

            if (!$this->isValidState($request, $state, $purpose)) {
                return null;
            }

            $result = $callback($state);
            $consumeToken = true;

            if (is_array($result) && array_key_exists('consume_flow', $result)) {
                $consumeToken = (bool) $result['consume_flow'];
                unset($result['consume_flow']);
            }

            if ($consumeToken) {
                Cache::forget($cacheKey);
            }

            return $result;
        } finally {
            try {
                $lock->release();
            } catch (Throwable) {
                // The request already completed its critical section.
            }
        }
    }

    public function expiredResponse(): array
    {
        return [
            'success' => false,
            'status' => false,
            'message' => 'Your login session has expired. Please request a new OTP.',
        ];
    }

    private function isValidState(Request $request, mixed $state, string $purpose): bool
    {
        if (!is_array($state) || ($state['purpose'] ?? null) !== $purpose) {
            return false;
        }

        if ((bool) config('authotp.flow_bind_user_agent', true)) {
            $expectedUserAgentHash = (string) ($state['user_agent_hash'] ?? '');
            $actualUserAgentHash = $this->hashValue((string) $request->userAgent());

            if (!hash_equals($expectedUserAgentHash, $actualUserAgentHash)) {
                return false;
            }
        }

        if ((bool) config('authotp.flow_bind_ip', false)) {
            $expectedIpHash = (string) ($state['ip_hash'] ?? '');
            $actualIpHash = $this->hashValue($request->ip() ?: 'unknown');

            if (!hash_equals($expectedIpHash, $actualIpHash)) {
                return false;
            }
        }

        return true;
    }

    private function cacheKey(string $tokenHash): string
    {
        return 'auth_flow:' . $tokenHash;
    }

    private function lockKey(string $tokenHash): string
    {
        return 'auth_flow:lock:' . $tokenHash;
    }

    private function hashToken(string $plainToken): string
    {
        return $this->hashValue($plainToken);
    }

    private function hashValue(string $value): string
    {
        return hash('sha256', $value);
    }

    private function expirySeconds(): int
    {
        return (int) config('authotp.flow_expiry_seconds', 600);
    }
}
