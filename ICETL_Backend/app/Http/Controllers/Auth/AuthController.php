<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        try {
            $request->validate([
                'login' => 'required',
                'loginBy' => 'required|in:1,2',
                'password' => 'required_if:loginBy,2|prohibited_if:loginBy,1',
                'otp' => 'required_if:loginBy,1|prohibited_if:loginBy,2',
            ]);

            $field = filter_var($request->login, FILTER_VALIDATE_EMAIL)
                ? 'email'
                : $this->getUserIdentifierField();

            $user = $this->newFrontendUserQuery()
                ->where($field, $request->login)
                ->first();

            if (!$user) {
                return response()->json(['message' => 'User not found'], 404);
            }

            if ((int) $request->loginBy === 2 && !Hash::check($request->password, $user->password)) {
                return response()->json(['message' => 'Invalid credentials'], 401);
            }

            if ((int) $request->loginBy === 1) {
                if ($user->otp !== $request->otp) {
                    return response()->json(['message' => 'Invalid OTP'], 401);
                }

                if ($user->otp_expires_at < now()) {
                    return response()->json(['message' => 'OTP expired'], 401);
                }
            }

            $tokenPayload = $this->issueToken($user);

            return response()->json([
                'message' => 'Login successful',
                'token' => $tokenPayload['token'],
                'expires_at' => $tokenPayload['expires_at'],
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                ],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function logout(Request $request)
    {
        try {
            $token = $request->user()?->currentAccessToken();

            if (!$token) {
                return response()->json([
                    'status' => false,
                    'message' => 'Already logged out or invalid token',
                ], 401);
            }

            $tokenId = $token->id;

            try {
                Cache::forget("auth_{$tokenId}");
            } catch (\Exception $e) {
                // Ignore cache failures during logout.
            }

            $token->delete();

            return response()->json([
                'status' => true,
                'message' => 'Logged out successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Something went wrong',
            ], 500);
        }
    }

    public function debug()
    {
        try {
            $query = DB::table('users')->get();

            return response()->json([
                'data' => $query,
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function sendOtp(Request $request)
    {
        try {
            $request->validate([
                'user' => 'required|string',
            ]);

            $userKey = $this->normalizeUserKey($request->user);

            if (Cache::has('otp_lock_' . $userKey)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Please wait before requesting another OTP',
                ]);
            }

            Cache::forget($this->getProfileCompletionCacheKey($userKey));

            $otp = rand(100000, 999999);

            Cache::put('otp_' . $userKey, Hash::make((string) $otp), now()->addMinutes(5));
            Cache::put('otp_attempts_' . $userKey, 0, now()->addMinutes(5));
            Cache::put('otp_lock_' . $userKey, true, now()->addSeconds(30));

            Log::info("OTP for {$userKey} is {$otp}");

            return response()->json([
                'success' => true,
                'message' => 'OTP sent successfully',
                'otp' => $otp,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function verifyOtp(Request $request)
    {
        try {
            $request->validate([
                'user' => 'required|string',
                'otp' => 'required|digits:6',
            ]);

            $userKey = $this->normalizeUserKey($request->user);
            $cachedOtp = Cache::get('otp_' . $userKey);

            if (!$cachedOtp || !Hash::check((string) $request->otp, $cachedOtp)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid or expired OTP',
                ], 422);
            }

            Cache::forget('otp_' . $userKey);
            Cache::forget('otp_attempts_' . $userKey);
            Cache::forget('otp_lock_' . $userKey);

            $user = $this->findUserByIdentifier($userKey);

            if (!$user) {
                Cache::put($this->getProfileCompletionCacheKey($userKey), true, now()->addMinutes(10));

                return response()->json([
                    'success' => true,
                    'is_new_user' => true,
                    'message' => 'OTP verified. Please complete profile.',
                ]);
            }

            Cache::forget($this->getProfileCompletionCacheKey($userKey));

            $tokenPayload = $this->issueToken($user);

            return response()->json([
                'success' => true,
                'is_new_user' => false,
                'message' => 'Login successful',
                'data' => $this->buildAuthData($user, $tokenPayload),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function completeProfile(Request $request)
    {
        try {
            $userKey = $this->normalizeUserKey($request->user);
            $identifierField = $this->getUserIdentifierField();
            $isEmailLogin = filter_var($userKey, FILTER_VALIDATE_EMAIL) !== false;

            $request->validate([
                'user' => [
                    'required',
                    'string',
                    $isEmailLogin ? 'email' : $this->newFrontendUserUniqueRule($identifierField),
                ],
                'name' => 'required|string|min:3|max:255',
                'email' => ['required', 'email', 'max:255', $this->newFrontendUserUniqueRule('email')],
            ]);

            if (!Cache::pull($this->getProfileCompletionCacheKey($userKey))) {
                return response()->json([
                    'success' => false,
                    'message' => 'Verify OTP before completing your profile',
                ], 403);
            }

            if ($this->findUserByIdentifier($userKey)) {
                return response()->json([
                    'success' => false,
                    'message' => 'User already exists. Please log in instead.',
                ], 409);
            }

            $attributes = [
                'name' => trim((string) $request->name),
                'email' => trim((string) $request->email),
            ];

            if ($this->hasUserTypeColumn()) {
                $attributes[$this->getUserTypeField()] = 1;
            }

            if (!$isEmailLogin) {
                $attributes[$identifierField] = $userKey;
            }

            $user = User::create($attributes);
            $tokenPayload = $this->issueToken($user);

            return response()->json([
                'success' => true,
                'message' => 'Profile created successfully',
                'data' => $this->buildAuthData($user, $tokenPayload),
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    private function normalizeUserKey(mixed $userKey): string
    {
        try {
            return trim((string) $userKey);
        } catch (Throwable $e) {
            Log::error('normalizeUserKey failed', ['message' => $e->getMessage()]);
            throw $e;
        }
    }

    private function getUserIdentifierField(): string
    {
        try {
            if (Schema::hasColumn('users', 'mobile')) {
                return 'mobile';
            }

            if (Schema::hasColumn('users', 'phone')) {
                return 'phone';
            }

            return 'mobile';
        } catch (Throwable $e) {
            Log::error('getUserIdentifierField failed', ['message' => $e->getMessage()]);
            throw $e;
        }
    }

    private function findUserByIdentifier(string $userKey): ?User
    {
        try {
            $field = filter_var($userKey, FILTER_VALIDATE_EMAIL)
                ? 'email'
                : $this->getUserIdentifierField();

            return $this->newFrontendUserQuery()
                ->where($field, $userKey)
                ->first();
        } catch (Throwable $e) {
            Log::error('findUserByIdentifier failed', [
                'userKey' => $userKey,
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function getProfileCompletionCacheKey(string $userKey): string
    {
        try {
            return 'otp_verified_' . $userKey;
        } catch (Throwable $e) {
            Log::error('getProfileCompletionCacheKey failed', [
                'userKey' => $userKey,
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function hasUserTypeColumn(): bool
    {
        try {
            return Schema::hasColumn('users', 'userType') || Schema::hasColumn('users', 'user_type');
        } catch (Throwable $e) {
            Log::error('hasUserTypeColumn failed', ['message' => $e->getMessage()]);
            throw $e;
        }
    }

    private function getUserTypeField(): string
    {
        try {
            if (Schema::hasColumn('users', 'userType')) {
                return 'userType';
            }

            return 'user_type';
        } catch (Throwable $e) {
            Log::error('getUserTypeField failed', ['message' => $e->getMessage()]);
            throw $e;
        }
    }

    private function newFrontendUserQuery()
    {
        try {
            $query = User::query();

            if ($this->hasUserTypeColumn()) {
                $query->where($this->getUserTypeField(), 1);
            }

            return $query;
        } catch (Throwable $e) {
            Log::error('newFrontendUserQuery failed', ['message' => $e->getMessage()]);
            throw $e;
        }
    }

    private function newFrontendUserUniqueRule(string $column): Unique
    {
        try {
            $rule = Rule::unique('users', $column);

            if (!$this->hasUserTypeColumn()) {
                return $rule;
            }

            return $rule->where(fn($query) => $query->where($this->getUserTypeField(), 1));
        } catch (Throwable $e) {
            Log::error('newFrontendUserUniqueRule failed', [
                'column' => $column,
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function issueToken(User $user): array
    {
        try {
            $user->tokens()->delete();

            $tokenResult = $user->createToken('auth_token');
            $expiresAt = now()->addMinutes(60);
            $tokenModel = $tokenResult->accessToken;

            if ($tokenModel && Schema::hasColumn($tokenModel->getTable(), 'expires_at')) {
                $tokenModel->expires_at = $expiresAt;
                $tokenModel->save();
            }

            return [
                'token' => $tokenResult->plainTextToken,
                'expires_at' => $expiresAt,
            ];
        } catch (Throwable $e) {
            Log::error('issueToken failed', [
                'user_id' => $user->id ?? null,
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    private function buildAuthData(User $user, array $tokenPayload): array
    {
        try {
            return [
                'token' => $tokenPayload['token'],
                'expires_at' => $tokenPayload['expires_at'],
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ],
            ];
        } catch (Throwable $e) {
            Log::error('buildAuthData failed', [
                'user_id' => $user->id ?? null,
                'message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
