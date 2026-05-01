<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Models\User;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        try {

            // ✅ Validation
            $request->validate([
                'login'   => 'required',
                'loginBy' => 'required|in:1,2',
                'password' => 'required_if:loginBy,2|prohibited_if:loginBy,1',
                'otp'     => 'required_if:loginBy,1|prohibited_if:loginBy,2',
            ]);
            // 🔍 Detect email or phone
            $field = filter_var($request->login, FILTER_VALIDATE_EMAIL) ? 'email' : 'phone';

            $user = User::where($field, $request->login)->first();

            if (!$user) {
                return response()->json(['message' => 'User not found'], 404);
            }

            // 🔐 Password login
            if ($request->loginBy == 2) {
                if (!Hash::check($request->password, $user->password)) {
                    return response()->json(['message' => 'Invalid credentials'], 401);
                }
            }

            // 🔑 OTP login
            if ($request->loginBy == 1) {
                if ($user->otp !== $request->otp) {
                    return response()->json(['message' => 'Invalid OTP'], 401);
                }

                if ($user->otp_expires_at < now()) {
                    return response()->json(['message' => 'OTP expired'], 401);
                }
            }

            // 🧹 Optional: limit sessions
            $user->tokens()->delete();

            // 🔥 Create token
            $tokenResult = $user->createToken('auth_token');
            $token = $tokenResult->plainTextToken;

            $tokenId = explode('|', $token)[0];

            // ⏳ Expiry
            $expiresAt = now()->addMinutes(212);

            $tokenModel = $tokenResult->accessToken;
            $tokenModel->expires_at = $expiresAt;
            $tokenModel->save();

            // ⚡ Cache in Redis (safe)
            try {
                Cache::put("auth_{$tokenId}", [
                    'id' => $user->id,
                    'name' => $user->name
                ], $expiresAt);
            } catch (\Exception $e) {
                // Redis failure should NOT break login
            }

            return response()->json([
                'message' => 'Login successful',
                'token' => $token,
                'expires_at' => $expiresAt,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name
                ]
            ]);
        } catch (ValidationException $e) {

            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {

            // Optional: log error
            //Log::error('Login error: '.$e->getMessage());

            return response()->json([
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function logout(Request $request)
    {
        try {

            // Get current token
            $token = $request->user()?->currentAccessToken();

            if (!$token) {
                return response()->json([
                    'status' => false,
                    'message' => 'Already logged out or invalid token'
                ], 401);
            }

            $tokenId = $token->id;

            // 🔥 Remove from Redis (safe)
            try {
                Cache::forget("auth_{$tokenId}");
            } catch (\Exception $e) {
                // ignore Redis failure
            }

            // 🔥 Delete token from DB
            $token->delete();

            return response()->json([
                'status' => true,
                'message' => 'Logged out successfully'
            ]);
        } catch (\Exception $e) {

            //\Log::error('Logout error: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong'
            ], 500);
        }
    }
    public function debug()
    {
        $query =DB::table('users')->get();
        return response()->json([
            'data' => $query,
        ]);
    }
}
