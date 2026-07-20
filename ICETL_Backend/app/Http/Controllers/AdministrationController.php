<?php

namespace App\Http\Controllers;

use App\Services\AdministrationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class AdministrationController extends Controller
{
    private const MANAGER_ROLES = [1, 4];

    public function __construct(private readonly AdministrationService $administrationService)
    {
    }

    public function states()
    {
        if (!Schema::hasTable('location')) {
            return $this->missingLocationResponse();
        }

        try {
            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'States fetched successfully',
                'data' => $this->administrationService->getStates(),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching states: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function districts(Request $request)
    {
        if (!Schema::hasTable('location')) {
            return $this->missingLocationResponse();
        }

        $validator = Validator::make($request->all(), [
            'stateCode' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $stateCode = (int) $request->input('stateCode');

        if (!$this->administrationService->stateExists($stateCode)) {
            return response()->json([
                'status' => false,
                'success' => false,
                'message' => 'Selected state was not found.',
            ], 404);
        }

        try {
            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Districts fetched successfully',
                'data' => $this->administrationService->getDistricts($stateCode),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching districts: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function storeBranch(Request $request)
    {
        if (!$this->canManageAdministration($request)) {
            return $this->unauthorizedResponse();
        }

        if (!Schema::hasTable('branches')) {
            return $this->missingBranchTableResponse();
        }

        if (!Schema::hasTable('location')) {
            return $this->missingLocationResponse();
        }

        $validator = Validator::make($request->all(), [
            'stateCode' => 'required|integer|min:1',
            'districtCode' => 'required|integer|min:1',
            'branchName' => 'required|string|min:2|max:150',
            'branchAddress' => 'required|string|min:5|max:1000',
            'status' => 'nullable|in:0,1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $stateCode = (int) $request->input('stateCode');
        $districtCode = (int) $request->input('districtCode');

        if (!$this->administrationService->districtBelongsToState($stateCode, $districtCode)) {
            return response()->json([
                'status' => false,
                'success' => false,
                'message' => 'Selected district/city does not belong to the selected state.',
                'errors' => [
                    'districtCode' => ['Selected district/city does not belong to the selected state.'],
                ],
            ], 422);
        }

        if (
            $this->administrationService->branchExists(
                (string) $request->input('branchName'),
                $stateCode,
                $districtCode
            )
        ) {
            return response()->json([
                'status' => false,
                'success' => false,
                'message' => 'A branch with this name already exists for the selected district/city.',
            ], 409);
        }

        try {
            $branchId = $this->administrationService->createBranch(
                $request->only(['stateCode', 'districtCode', 'branchName', 'branchAddress', 'status']),
                $request->user()?->id
            );

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Branch added successfully',
                'data' => [
                    'id' => $branchId,
                ],
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error saving branch: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function branches(Request $request)
    {
        if (!$this->canManageAdministration($request)) {
            return $this->unauthorizedResponse();
        }

        if (!Schema::hasTable('branches')) {
            return $this->missingBranchTableResponse();
        }

        $validator = Validator::make($request->all(), [
            'page' => 'nullable|integer|min:1',
            'perPage' => [
                'nullable',
                function ($attribute, $value, $fail) {
                    if ($value === null || $value === '' || $value === 'all') {
                        return;
                    }

                    if (
                        !filter_var($value, FILTER_VALIDATE_INT)
                        || !in_array((int) $value, [10, 20, 50, 100], true)
                    ) {
                        $fail('The per page value must be 10, 20, 50, 100, or all.');
                    }
                },
            ],
            'branchName' => 'nullable|string|max:150',
            'stateCode' => 'nullable|integer|min:1',
            'districtCode' => 'nullable|integer|min:1',
            'status' => 'nullable|in:all,0,1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        try {
            $branchList = $this->administrationService->getBranches($request->all());

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Branches fetched successfully',
                'data' => $branchList['data'],
                'meta' => $branchList['meta'],
                'summary' => $branchList['summary'],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching branches: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    private function canManageAdministration(Request $request): bool
    {
        $user = $request->user();

        return $user && in_array((int) $user->role, self::MANAGER_ROLES, true);
    }

    private function validationResponse($validator)
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $validator->errors(),
        ], 422);
    }

    private function unauthorizedResponse()
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'Only admin and ICETL team users can manage branches.',
        ], 403);
    }

    private function missingLocationResponse()
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'Location table not found.',
        ], 500);
    }

    private function missingBranchTableResponse()
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'Branch table not found. Please run migrations.',
        ], 500);
    }

    private function exceptionResponse(\Exception $e)
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'Something went wrong',
            'error' => $e->getMessage(),
        ], 500);
    }
}
