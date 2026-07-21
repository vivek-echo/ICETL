<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CommonController extends Controller
{

    public function getInstructorListByInstructorId(Request $request)
    {

        try {
            $insId = $this->resolveInstructorId($request);

            if ($insId === false) {
                return response()->json([
                    'status' => false,
                    'message' => 'Invalid instructor id'
                ], 422);
            }

            $ins = DB::table('users')
                ->where('role', 3)
                ->whereNotNull('name')
                ->where('deletedFlag', 0)
                ->select('id', 'name', 'email', 'code');

            if (!empty($insId)) {
                $ins->where('id', $insId);
            }
            $responseData = $ins->get();
            return response()->json([
                'status' => true,
                'message' => 'Instructor list fetched successfully',
                'data' => $responseData
            ], 200);
        } catch (Throwable $e) {
            Log::error('Error fetching instructor list: ' . $e->getMessage());
            return response()->json([
                'status' => false,
                'message' => 'Failed to fetch instructor list'
            ], 500);
        }
    }

    private function resolveInstructorId(Request $request): int|false|null
    {
        $authenticatedUser = $request->user();

        if ($authenticatedUser && (int) $authenticatedUser->role === 3) {
            return (int) $authenticatedUser->id;
        }

        $instructorId = $request->input('instructorId');

        if ($instructorId === null || $instructorId === '') {
            return null;
        }

        if (is_numeric($instructorId)) {
            $resolvedInstructorId = (int) $instructorId;

            return $resolvedInstructorId > 0 ? $resolvedInstructorId : false;
        }

        if (!is_string($instructorId)) {
            return false;
        }

        try {
            $decryptedInstructorId = Crypt::decryptString($instructorId);

            if (!is_numeric($decryptedInstructorId)) {
                return false;
            }

            $resolvedInstructorId = (int) $decryptedInstructorId;

            return $resolvedInstructorId > 0 ? $resolvedInstructorId : false;
        } catch (Throwable $e) {
            Log::warning('Invalid instructor id payload: ' . $e->getMessage());

            return false;
        }
    }
}
