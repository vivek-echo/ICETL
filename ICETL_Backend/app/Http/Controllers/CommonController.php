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
            $requestData = $request->all();
            $profileData = $requestData['userProfile'] ?? null;
            // $isAdmin = $profileData && isset($profileData['role']) && $profileData['role'] === 1;
            
            $insId = $requestData['instructorId'] ? Crypt::decryptString($requestData['instructorId']) : null;
            $ins = DB::table('users')->where('role', 3)->where('deletedFlag', 0)->select('id', 'name', 'email');

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
}
