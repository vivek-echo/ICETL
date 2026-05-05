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
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Mail;
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

            // Delete current token (Sanctum)
            $token->delete();

            return response()->json([
                'success' => true,
                'message' => 'Logged out successfully',
            ]);
        } catch (\Throwable $e) {

            Log::error('Logout failed', [
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage()
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
            'emailId' => 'required|email'
        ])->validate();
        $email = strtolower(trim($request->emailId));
        // Rate limit (30 sec)
        if (Cache::has("otp_lock_$email")) {
            return response()->json([
                'success' => false,
                'message' => 'Please wait before requesting another OTP'
            ]);
        }

        $otp = random_int(100000, 999999);

        Cache::put("otp_$email", Hash::make($otp), now()->addMinutes(5));
        Cache::put("otp_attempts_$email", 0, now()->addMinutes(5));
        Cache::put("otp_lock_$email", true, now()->addSeconds(30));

        if (!app()->isLocal()) {
            $this->sendOtpMail($email, $otp);
        }

        return response()->json([
            'success' => true,
            'message' => 'OTP sent successfully',
            'otp' => app()->isLocal() ? $otp : null
        ]);
    }

    //////////////////////////////////////////////////////////////
    // SEND OTP MAIL (HTML)
    //////////////////////////////////////////////////////////////

    public function sendOtpMail($email, $otp)
    {
        Mail::html("
    <html>
    <body style='font-family: Arial; background:#f4f6f8; padding:20px;'>
        <div style='max-width:400px;margin:auto;background:#fff;padding:30px;border-radius:10px;text-align:center'>
            <h2>OTP Verification</h2>
            <p>Your OTP is:</p>
            <h1 style='letter-spacing:5px;color:#2d89ef;'>$otp</h1>
            <p>This OTP is valid for 5 minutes.</p>
            <p style='font-size:12px;color:#999;'>Do not share this OTP.</p>
        </div>
    </body>
    </html>
    ", function ($message) use ($email) {
            $message->to($email)->subject('Your OTP Code');
        });
    }

    //////////////////////////////////////////////////////////////
    // VERIFY OTP
    //////////////////////////////////////////////////////////////

    public function verifyOtp(Request $request)
    {
        $email = strtolower(trim($request->emailId));

        Validator::make($request->all(), [
            'emailId' => 'required|email',
            'otp' => 'required|digits:6'
        ])->validate();

        $cachedOtp = Cache::get("otp_$email");

        if (!$cachedOtp) {
            return response()->json([
                'success' => false,
                'message' => 'OTP expired'
            ], 422);
        }

        // Attempt limit
        $attempts = Cache::increment("otp_attempts_$email");
        if ($attempts > 5) {
            Cache::forget("otp_$email");
            return response()->json([
                'success' => false,
                'message' => 'Too many attempts'
            ], 429);
        }

        if (!Hash::check($request->otp, $cachedOtp)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid OTP'
            ], 422);
        }

        // Clear cache
        Cache::forget("otp_$email");
        Cache::forget("otp_attempts_$email");

        // Check user
        $user = User::where('email', $email)->where('userType', 1)->first();
        $isNewUser = !$user;

        if ($isNewUser) {
            Cache::put("profile_$email", true, now()->addMinutes(10));
        }

        // Existing user → login
        if (!$isNewUser) {
            $tokenData = $this->issueToken($user);
            return response()->json([
                'success' => true,
                'is_new_user' => false,
                'message' => 'Login successful',
                'data' => $this->buildAuthData($user, $tokenData)
            ]);
        }

        // New user
        return response()->json([
            'success' => true,
            'is_new_user' => true,
            'message' => 'OTP verified. Please complete profile.',
            'data' => null
        ]);
    }

    //////////////////////////////////////////////////////////////
    // COMPLETE PROFILE
    //////////////////////////////////////////////////////////////

    public function completeProfile(Request $request)
    {
        $email = strtolower(trim($request->email));

        Validator::make($request->all(), [
            'email' => 'required|email',
            'name' => 'required|min:3',
            'phone' => 'required|digits:10',
            'dob' => 'required|date|before:today',
            'gender' => 'required|in:1,2,3'
        ])->validate();

        if (!Cache::pull("profile_$email")) {
            return response()->json([
                'success' => false,
                'message' => 'Verify OTP first'
            ], 403);
        }

        if (User::where('email', $email)->where('userType', 1)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'User already exists'
            ], 409);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $email,
            'phone' => $request->phone,
            'dob' => $request->dob,
            'gender' => $request->gender,
            'role' => 2,
            'userType' => 1
        ]);

        $tokenData = $this->issueToken($user);

        return response()->json([
            'success' => true,
            'message' => 'Profile created successfully',
            'data' => $this->buildAuthData($user, $tokenData)
        ]);
    }

    //////////////////////////////////////////////////////////////
    // ISSUE TOKEN (SANCTUM)
    //////////////////////////////////////////////////////////////

    private function issueToken(User $user): array
    {
        try {
            $user->tokens()->delete(); // single device login

            $token = $user->createToken('auth_token');

            return [
                'token' => $token->plainTextToken,
                'expires_at' => now()->addMinutes(1)
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
            $roleId = $user->role;

            $role = DB::table('roles')
                ->where('id', $roleId)
                ->where('deletedFlag', 0)
                ->value('roleName');

            $permissions = DB::table('role_menu_permissions')
                ->where('roleId', $roleId)
                ->where('deletedFlag', 0)
                ->value('permissionJson');

            $decoded = json_decode($permissions ?? '{}', true);

            $allowedIds = is_array($decoded)
                ? array_keys(array_filter($decoded))
                : [];

            $menus = DB::table('menus')
                ->where('deletedFlag', 0)
                ->whereIn('id', $allowedIds)
                ->orderBy('parentId')
                ->get();

            return [
                'token' => $tokenPayload['token'],
                'expires_at' => $tokenPayload['expires_at'],
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone ?? $user->mobile ?? null,
                    'dob' => $user->dob ? optional($user->dob)->format('Y-m-d') : null,
                    'gender' => $user->gender ?? null,
                    'menus' => $menus,
                    'dashboard' => [
                        'dashboardName' => $role ?? '',
                        'dashboardUrl' => strtolower(trim((string) ($role ?? '')))
                    ]
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
