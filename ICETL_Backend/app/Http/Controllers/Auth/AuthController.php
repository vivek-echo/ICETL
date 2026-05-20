<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\InstructorDocument;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Throwable;

class AuthController extends Controller
{
    public function logout(Request $request)
    {
        try {
            $token = $request->user()?->currentAccessToken();

            if (!$token) {
                return response()->json([
                    'success' => false,
                    'message' => 'Already logged out or invalid token',
                ], 401);
            }

            $token->delete();

            return response()->json([
                'success' => true,
                'message' => 'Logged out successfully',
            ]);
        } catch (Throwable $e) {
            Log::error('Logout failed', [
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Logout failed',
            ], 500);
        }
    }

    //////////////////////////////////////////////////////////////
    // SEND OTP
    //////////////////////////////////////////////////////////////

    public function sendOtp(Request $request)
    {
        Validator::make($request->all(), [
            'emailId' => 'required|email',
        ])->validate();

        $email = strtolower(trim((string) $request->emailId));

        if (Cache::has("otp_lock_{$email}")) {
            return response()->json([
                'success' => false,
                'message' => 'Please wait before requesting another OTP',
            ]);
        }

        $otp = random_int(100000, 999999);

        Cache::put("otp_{$email}", Hash::make($otp), now()->addMinutes(5));
        Cache::put("otp_attempts_{$email}", 0, now()->addMinutes(5));
        Cache::put("otp_lock_{$email}", true, now()->addSeconds(30));

        if (!app()->isLocal()) {
            $this->sendOtpMail($email, $otp);
        }

        return response()->json([
            'success' => true,
            'message' => 'OTP sent successfully',
            'otp' => app()->isLocal() ? $otp : null,
        ]);
    }

    //////////////////////////////////////////////////////////////
    // SEND OTP MAIL (HTML)
    //////////////////////////////////////////////////////////////

    public function sendOtpMail($email, $otp)
    {
        Mail::html("
    <!DOCTYPE html>
    <html lang='en'>

    <head>
        <meta charset='UTF-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        <title>OTP Verification</title>
    </head>

    <body style='margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;'>

        <table width='100%' cellpadding='0' cellspacing='0'
            style='background:#f4f7fb;padding:40px 15px;'>

            <tr>
                <td align='center'>

                    <table width='100%' cellpadding='0' cellspacing='0'
                        style='max-width:560px;
                        background:#ffffff;
                        border-radius:22px;
                        overflow:hidden;
                        box-shadow:0 15px 40px rgba(0,0,0,0.08);'>

                        <tr>
                            <td align='center'
                                style='padding:45px 30px;
                                background:linear-gradient(135deg,#2563eb,#0ea5e9);'>

                               <h1 style='margin:0;
    color:#ffffff;
    font-size:36px;
    font-weight:800;
    letter-spacing:1px;
    text-transform:uppercase;
    font-family:Arial,sans-serif;'>
    ICETL
</h1>

<p style='margin:10px 0 0 0;
    color:rgba(255,255,255,0.92);
    font-size:15px;
    letter-spacing:1px;
    font-weight:500;'>

    ICE TECHNOLOGY LAB
</p>

                                <h1 style='margin:0;
                                    color:#ffffff;
                                    font-size:34px;
                                    font-weight:700;
                                    letter-spacing:-0.5px;'>

                                    OTP Verification
                                </h1>

                                <p style='margin:14px 0 0 0;
                                    color:rgba(255,255,255,0.92);
                                    font-size:16px;
                                    line-height:24px;'>

                                    Secure One-Time Password Authentication
                                </p>

                            </td>
                        </tr>

                        <tr>
                            <td style='padding:50px 40px;
                                text-align:center;'>

                                <h2 style='margin:0;
                                    color:#111827;
                                    font-size:30px;
                                    font-weight:700;'>

                                    Hello
                                </h2>

                                <p style='margin:22px 0 0 0;
                                    color:#6b7280;
                                    font-size:17px;
                                    line-height:30px;'>

                                    Use the following One-Time Password (OTP)
                                    to securely continue your login process.
                                </p>

                                <div style='margin:40px 0;'>

                                    <div style='display:inline-block;
                                        background:#eff6ff;
                                        border:2px dashed #3b82f6;
                                        border-radius:18px;
                                        padding:22px 38px;
                                        box-shadow:0 8px 18px rgba(37,99,235,0.08);'>

                                        <span style='font-size:44px;
                                            font-weight:700;
                                            letter-spacing:14px;
                                            color:#2563eb;
                                            display:block;'>

                                            {$otp}
                                        </span>

                                    </div>

                                </div>

                                <div style='margin-top:10px;'>

                                    <p style='margin:0;
                                        color:#374151;
                                        font-size:16px;'>

                                        This OTP is valid for
                                        <strong>5 minutes</strong>.
                                    </p>

                                </div>

                                <div style='margin-top:40px;
                                    background:#eff6ff;
                                    border-left:5px solid #2563eb;
                                    border-radius:14px;
                                    padding:18px 20px;
                                    text-align:left;'>

                                    <p style='margin:0;
                                        color:#1e40af;
                                        font-size:14px;
                                        line-height:24px;'>

                                        <strong>Security Tip:</strong>
                                        Never share your OTP with anyone.
                                        Our support team will never ask for your password or OTP.
                                    </p>

                                </div>

                            </td>
                        </tr>

                        <tr>
                            <td>
                                <div style='height:1px;background:#e5e7eb;'></div>
                            </td>
                        </tr>

                        <tr>
                            <td align='center'
                                style='padding:35px 30px;
                                background:#f9fafb;'>

                                <p style='margin:0;
                                    color:#6b7280;
                                    font-size:14px;
                                    line-height:26px;'>

                                    If you did not request this OTP,
                                    you can safely ignore this email.
                                </p>

                                <p style='margin:18px 0 0 0;
                                    color:#9ca3af;
                                    font-size:13px;'>

                                    &copy; " . date('Y') . " ICETL. All rights reserved.
                                </p>

                            </td>
                        </tr>

                    </table>

                </td>
            </tr>

        </table>

    </body>
    </html>

    ", function ($message) use ($email) {
            $message->to($email)
                ->subject('Your OTP Verification Code');
        });
    }

    //////////////////////////////////////////////////////////////
    // VERIFY OTP
    //////////////////////////////////////////////////////////////

    public function verifyOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'emailId' => 'required|email',
            'otp' => 'required|digits:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $email = strtolower(trim((string) $request->input('emailId')));
        $otp = trim((string) $request->input('otp'));
        $otpCacheKey = "otp_{$email}";
        $otpAttemptsCacheKey = "otp_attempts_{$email}";
        $profileCacheKey = "profile_{$email}";
        $verifiedEmailCacheKey = "verified_email_{$email}";

        try {
            $cachedOtp = Cache::get($otpCacheKey);

            if (!$cachedOtp) {
                return response()->json([
                    'success' => false,
                    'message' => 'OTP expired',
                ], 422);
            }

            $attempts = Cache::increment($otpAttemptsCacheKey);

            if ($attempts > 5) {
                Cache::forget($otpCacheKey);
                Cache::forget($otpAttemptsCacheKey);

                Log::warning('OTP verification blocked due to too many attempts', [
                    'email' => $email,
                    'attempts' => $attempts,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Too many attempts',
                ], 429);
            }

            if (!Hash::check($otp, (string) $cachedOtp)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid OTP',
                ], 422);
            }

            Cache::forget($otpCacheKey);
            Cache::forget($otpAttemptsCacheKey);

            $users = User::query()
                ->where('email', $email)
                ->where('userType', 1)
                ->where('deletedFlag', 0)
                ->get();

            if ($users->isEmpty()) {
                Cache::forget($verifiedEmailCacheKey);
                Cache::put($profileCacheKey, true, now()->addMinutes(10));

                return response()->json([
                    'success' => true,
                    'is_new_user' => true,
                    'is_multi_role_user' => false,
                    'message' => 'OTP verified. Please complete profile.',
                    'data' => null,
                ]);
            }

            if ($users->count() === 1) {
                Cache::forget($verifiedEmailCacheKey);

                /** @var User $user */
                $user = $users->first();
                $tokenData = $this->issueToken($user);

                return response()->json([
                    'success' => true,
                    'is_new_user' => false,
                    'is_multi_role_user' => false,
                    'message' => 'Login successful',
                    'data' => $this->buildAuthData($user, $tokenData),
                ]);
            }

            Cache::put($verifiedEmailCacheKey, $email, now()->addMinutes(10));

            $roleIds = $users->pluck('role')
                ->filter(fn($roleId) => $roleId !== null && $roleId !== '')
                ->map(fn($roleId) => (int) $roleId)
                ->filter(fn(int $roleId) => $roleId > 0)
                ->unique()
                ->values()
                ->all();

            $rolesById = empty($roleIds)
                ? []
                : DB::table('roles')
                ->whereIn('id', $roleIds)
                ->where('deletedFlag', 0)
                ->pluck('roleName', 'id')
                ->all();

            $availableRoles = $users->map(function (User $user) use ($rolesById): array {
                $roleId = (int) $user->role;
                $roleName = (string) ($rolesById[$roleId] ?? '');

                return [
                    'user_id' => (int) $user->id,
                    'role_id' => $roleId,
                    'role_name' => $roleName,
                    'dashboard_url' => $this->dashboardUrlFromRoleName($roleName),
                    'profile_img' => $user->profileImg ?? null,
                ];
            })->values();

            return response()->json([
                'success' => true,
                'is_new_user' => false,
                'is_multi_role_user' => true,
                'message' => 'OTP verified. Please select a role to continue.',
                'data' => null,
                'email' => $email,
                'roles' => $availableRoles,
            ]);
        } catch (Throwable $e) {
            Log::error('verifyOtp failed', [
                'email' => $email,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to verify OTP right now. Please try again later.',
            ], 500);
        }
    }

    public function selectRole(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'user_id' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $email = strtolower(trim((string) $request->input('email')));
        $userId = (int) $request->input('user_id');
        $verifiedEmailCacheKey = "verified_email_{$email}";

        try {
            $verifiedEmail = Cache::get($verifiedEmailCacheKey);

            if (!$verifiedEmail || strtolower(trim((string) $verifiedEmail)) !== $email) {
                return response()->json([
                    'success' => false,
                    'message' => 'Role selection session expired. Please verify OTP again.',
                ], 403);
            }

            /** @var User|null $user */
            $user = User::query()
                ->where('id', $userId)
                ->where('email', $email)
                ->where('userType', 1)
                ->where('deletedFlag', 0)
                ->first();

            if (!$user) {
                Log::warning('Invalid role selection attempted', [
                    'email' => $email,
                    'user_id' => $userId,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Selected role is invalid for this email address.',
                ], 404);
            }

            Cache::forget($verifiedEmailCacheKey);

            $tokenData = $this->issueToken($user);

            return response()->json([
                'success' => true,
                'is_new_user' => false,
                'is_multi_role_user' => false,
                'message' => 'Login successful',
                'data' => $this->buildAuthData($user, $tokenData),
            ]);
        } catch (Throwable $e) {
            Log::error('selectRole failed', [
                'email' => $email,
                'user_id' => $userId,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to complete role selection right now. Please try again later.',
            ], 500);
        }
    }

    //////////////////////////////////////////////////////////////
    // COMPLETE PROFILE
    //////////////////////////////////////////////////////////////

    public function completeProfile(Request $request)
    {
        $email = strtolower(trim((string) $request->email));

        Validator::make($request->all(), [
            'email' => 'required|email',
            'name' => ['required', 'string', 'min:3', 'max:150', 'regex:/^[A-Za-z](?:[A-Za-z ]*[A-Za-z])?$/'],
            'phone' => 'required|digits:10',
            'dob' => 'required|date|before:today',
            'gender' => 'required|in:1,2,3',
        ])->validate();

        if (!Cache::pull("profile_{$email}")) {
            return response()->json([
                'success' => false,
                'message' => 'Verify OTP first',
            ], 403);
        }

        if (User::where('email', $email)->where('userType', 1)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'User already exists',
            ], 409);
        }

        $user = User::create([
            'name' => trim((string) $request->name),
            'email' => $email,
            'phone' => $request->phone,
            'dob' => $request->dob,
            'gender' => $request->gender,
            'role' => 2,
            'userType' => 1,
        ]);

        $tokenData = $this->issueToken($user);

        return response()->json([
            'success' => true,
            'message' => 'Profile created successfully',
            'data' => $this->buildAuthData($user, $tokenData),
        ]);
    }

    //////////////////////////////////////////////////////////////
    // ISSUE TOKEN (SANCTUM)
    //////////////////////////////////////////////////////////////

    private function issueToken(User $user): array
    {
        try {
            $user->tokens()->delete();

            $expirationMinutes = (int) config('sanctum.expiration', 10080);
            $expiresAt = now()->addMinutes($expirationMinutes);
            $token = $user->createToken('auth_token', ['*'], $expiresAt);

            return [
                'token' => $token->plainTextToken,
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

    //////////////////////////////////////////////////////////////
    // BUILD AUTH DATA
    //////////////////////////////////////////////////////////////

    private function buildAuthData(User $user, array $tokenPayload): array
    {
        try {
            $roleId = (int) $user->role;

            $roleMeta = DB::table('roles as r')
                ->leftJoin('role_menu_permissions as rmp', function ($join): void {
                    $join->on('r.id', '=', 'rmp.roleId')
                        ->where('rmp.deletedFlag', 0);
                })
                ->where('r.id', $roleId)
                ->where('r.deletedFlag', 0)
                ->select('r.roleName', 'rmp.permissionJson')
                ->first();

            $roleName = (string) ($roleMeta->roleName ?? '');
            $permissionJson = $roleMeta->permissionJson ?? null;
            $decodedPermissions = [];

            if (is_string($permissionJson) && $permissionJson !== '') {
                $decodedPermissions = json_decode($permissionJson, true);

                if (json_last_error() !== JSON_ERROR_NONE || !is_array($decodedPermissions)) {
                    Log::warning('Invalid permissionJson detected while building auth data', [
                        'user_id' => $user->id,
                        'role_id' => $roleId,
                        'json_error' => json_last_error_msg(),
                    ]);

                    $decodedPermissions = [];
                }
            }

            $allowedMenuIds = collect($decodedPermissions)
                ->filter(function ($isAllowed): bool {
                    if (is_bool($isAllowed)) {
                        return $isAllowed;
                    }

                    if (is_numeric($isAllowed)) {
                        return (int) $isAllowed === 1;
                    }

                    if (is_string($isAllowed)) {
                        return in_array(strtolower(trim($isAllowed)), ['1', 'true', 'yes', 'on'], true);
                    }

                    return false;
                })
                ->keys()
                ->map(fn($menuId) => (int) $menuId)
                ->filter(fn(int $menuId) => $menuId > 0)
                ->unique()
                ->values()
                ->all();

            $menus = empty($allowedMenuIds)
                ? collect()
                : DB::table('menus')
                ->where('deletedFlag', 0)
                ->whereIn('id', $allowedMenuIds)
                ->orderBy('parentId')
                ->orderBy('id')
                ->get();

            return [
                'token' => $tokenPayload['token'],
                'expires_at' => $tokenPayload['expires_at'],
                'user' => [
                    'id' => Crypt::encryptString($user->id),
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone ?? $user->mobile ?? null,
                    'dob' => $user->dob ? optional($user->dob)->format('Y-m-d') : null,
                    'gender' => $user->gender ?? null,
                    'profileImg' => $user->profileImg ?? null,
                    'thumbnailImg' => $user->thumbnailImg ?? null,
                    'coverImg' => $user->coverImg ?? null,
                    'role' => $user->role ?? null,
                    'profileImgUrl' => $this->storedProfileFileUrl('profile', $user->profileImg ?? null),
                    'thumbnailImgUrl' => $this->storedProfileFileUrl('thumbnail', $user->thumbnailImg ?? null),
                    'coverImgUrl' => $this->storedProfileFileUrl('cover', $user->coverImg ?? null),
                    'menus' => $menus,
                    'dashboard' => [
                        'dashboardName' => $roleName,
                        'dashboardUrl' => $this->dashboardUrlFromRoleName($roleName),
                    ],
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

    private function dashboardUrlFromRoleName(?string $roleName): string
    {
        return strtolower(trim((string) $roleName));
    }

    private function storedProfileFileUrl(string $type, ?string $fileName): ?string
    {
        if (!$fileName) {
            return null;
        }

        return $this->privateFileUrl(request(), $this->resolveUserProfileStoragePath($type, $fileName));
    }

    public function getAfile(Request $request)
    {
        try {
            $path = $this->normalizePrivatePath((string) $request->input('path', ''));

            if ($path === '' || str_contains($path, '../') || str_starts_with($path, '../')) {
                return response()->json([
                    'status' => false,
                    'message' => 'Invalid file path'
                ], 400);
            }

            if (!$this->canAccessPrivatePath($path)) {
                return response()->json([
                    'status' => false,
                    'message' => 'Unauthorized file access'
                ], 401);
            }

            $path = $this->resolvePrivateStoragePath($path);

            if (!Storage::disk('private')->exists($path)) {
                return response()->json([
                    'status' => false,
                    'message' => 'File missing from storage'
                ], 404);
            }

            $mimeType = Storage::disk('private')->mimeType($path);

            $allowedMimetypes = [
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/webp',
                'image/gif',
                'application/pdf',
                'application/json',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'video/mp4',
                'video/x-msvideo',
                'video/quicktime',
                'video/webm',
                'audio/mpeg',
                'audio/wav',
                'text/plain',
                'text/csv',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/zip'
            ];

            if (!in_array($mimeType, $allowedMimetypes)) {
                return response()->json([
                    'status' => false,
                    'message' => 'Invalid file type'
                ], 400);
            }

            $fullPath = Storage::disk('private')->path($path);
            $downloadName = basename($path);

            if ($request->boolean('download')) {
                return response()->download($fullPath, $downloadName, [
                    'Content-Type' => $mimeType
                ]);
            }

            return response()->file($fullPath, [
                'Content-Type' => $mimeType,
                'Cache-Control' => 'public, max-age=604800',
            ]);
        } catch (Throwable $e) {

            Log::error('Error in getAfile', [
                'path' => $request->input('path'),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => false,
                'message' => 'Server error'
            ], 500);
        }
    }

    private function privateFileUrl(Request $request, string $path): string
    {
        $requestUrl = $request->url();
        $apiPosition = strpos($requestUrl, '/api/');
        $baseUrl = $apiPosition === false
            ? $request->getSchemeAndHttpHost()
            : substr($requestUrl, 0, $apiPosition);

        return $baseUrl . '/api/getAfile?path=' . rawurlencode(trim($path, '/'));
    }

    private function canAccessPrivatePath(string $path): bool
    {
        $normalizedPath = $this->normalizePrivatePath($path);

        if (
            str_starts_with($normalizedPath, 'app/profile-images/')
            || str_starts_with($normalizedPath, 'uploads/user/')
            || str_starts_with($normalizedPath, 'uploads/instructors/profile/')
            || str_starts_with($normalizedPath, 'course-category-icons/')
        ) {
            return true;
        }

        $user = Auth::guard('sanctum')->user();

        if (!$user) {
            return false;
        }

        if (str_starts_with($normalizedPath, 'uploads/instructors/')) {
            $legacyPath = $this->legacyInstructorPath($normalizedPath);

            return InstructorDocument::query()
                ->where('userId', $user->id)
                ->where(function ($query) use ($normalizedPath, $legacyPath): void {
                    $query->where('filePath', $normalizedPath);

                    if ($legacyPath !== $normalizedPath) {
                        $query->orWhere('filePath', $legacyPath);
                    }
                })
                ->exists();
        }

        return false;
    }

    private function normalizePrivatePath(string $path): string
    {
        $normalizedPath = trim(str_replace('\\', '/', urldecode($path)), '/');

        if (
            $normalizedPath === ''
            || str_starts_with($normalizedPath, 'app/')
            || str_starts_with($normalizedPath, 'course-category-icons/')
            || str_starts_with($normalizedPath, 'uploads/user/')
            || str_starts_with($normalizedPath, 'uploads/instructors/')
        ) {
            return $normalizedPath;
        }

        return 'uploads/instructors/' . $normalizedPath;
    }

    private function resolvePrivateStoragePath(string $path): string
    {
        $disk = Storage::disk('private');

        if ($disk->exists($path)) {
            return $path;
        }

        $legacyUserPath = $this->legacyUserProfileStoragePath($path);

        if ($legacyUserPath !== $path && $disk->exists($legacyUserPath)) {
            return $legacyUserPath;
        }

        return $path;
    }

    private function resolveUserProfileStoragePath(string $type, string $fileName): string
    {
        $disk = Storage::disk('private');
        $currentPath = 'uploads/user/' . trim($type, '/') . '/' . basename($fileName);
        $legacyPath = 'app/profile-images/' . trim($type, '/') . '/' . basename($fileName);

        if ($disk->exists($currentPath)) {
            return $currentPath;
        }

        if ($disk->exists($legacyPath)) {
            return $legacyPath;
        }

        return $currentPath;
    }

    private function legacyUserProfileStoragePath(string $path): string
    {
        if (!str_starts_with($path, 'uploads/user/')) {
            return $path;
        }

        return 'app/profile-images/' . substr($path, strlen('uploads/user/'));
    }

    private function legacyInstructorPath(string $path): string
    {
        return str_starts_with($path, 'uploads/instructors/')
            ? substr($path, strlen('uploads/instructors/'))
            : $path;
    }
}
