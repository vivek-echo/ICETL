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

    public function roles(Request $request)
    {
        if (!$this->canManageAdministration($request)) {
            return $this->unauthorizedResponse();
        }

        if (!Schema::hasTable('roles')) {
            return response()->json([
                'status' => false,
                'success' => false,
                'message' => 'Roles table not found.',
            ], 500);
        }

        try {
            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Roles fetched successfully',
                'data' => $this->administrationService->getRoles(),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching roles: ' . $e->getMessage());

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

    public function storeEmployee(Request $request)
    {
        if (!$this->canManageAdministration($request)) {
            return $this->unauthorizedResponse();
        }

        if (!Schema::hasTable('users')) {
            return $this->missingUsersTableResponse();
        }

        if (!$this->hasUserLocationColumns()) {
            return $this->missingUserLocationColumnsResponse();
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
            'branchId' => 'required|integer|min:1',
            'name' => 'required|string|min:3|max:150',
            'email' => 'required|email|max:150',
            'phone' => 'required|regex:/^[0-9]{10}$/',
            'dob' => 'nullable|date|before:today',
            'gender' => 'nullable|in:1,2,3',
            'status' => 'nullable|in:0,1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $stateCode = (int) $request->input('stateCode');
        $districtCode = (int) $request->input('districtCode');
        $branchId = (int) $request->input('branchId');

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

        if (!$this->administrationService->branchBelongsToLocation($branchId, $stateCode, $districtCode, true)) {
            return response()->json([
                'status' => false,
                'success' => false,
                'message' => 'Selected branch is not active for the selected state and district/city.',
                'errors' => [
                    'branchId' => ['Selected branch is not active for the selected state and district/city.'],
                ],
            ], 422);
        }

        if ($this->administrationService->employeeEmailExists((string) $request->input('email'))) {
            return response()->json([
                'status' => false,
                'success' => false,
                'message' => 'An employee user already exists with this email address.',
                'errors' => [
                    'email' => ['An employee user already exists with this email address.'],
                ],
            ], 409);
        }

        if ($this->administrationService->employeePhoneExists((string) $request->input('phone'))) {
            return response()->json([
                'status' => false,
                'success' => false,
                'message' => 'An employee user already exists with this phone number.',
                'errors' => [
                    'phone' => ['An employee user already exists with this phone number.'],
                ],
            ], 409);
        }

        try {
            $employeeId = $this->administrationService->createEmployee(
                array_merge($validator->validated(), [
                    'status' => $request->input('status', 1),
                ]),
                $request->user()?->id
            );

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Employee user added successfully',
                'data' => [
                    'id' => $employeeId,
                    'roleId' => AdministrationService::EMPLOYEE_ROLE_ID,
                    'defaultPassword' => AdministrationService::DEFAULT_EMPLOYEE_PASSWORD,
                ],
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error saving employee user: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function employees(Request $request)
    {
        if (!$this->canManageAdministration($request)) {
            return $this->unauthorizedResponse();
        }

        if (!Schema::hasTable('users')) {
            return $this->missingUsersTableResponse();
        }

        if (!$this->hasUserLocationColumns()) {
            return $this->missingUserLocationColumnsResponse();
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
            'search' => 'nullable|string|max:150',
            'stateCode' => 'nullable|integer|min:1',
            'districtCode' => 'nullable|integer|min:1',
            'branchId' => 'nullable|integer|min:1',
            'role' => [
                'nullable',
                function ($attribute, $value, $fail) {
                    if ($value === null || $value === '' || $value === 'all') {
                        return;
                    }

                    if (!filter_var($value, FILTER_VALIDATE_INT) || (int) $value < 1) {
                        $fail('The role filter is invalid.');
                    }
                },
            ],
            'status' => 'nullable|in:all,0,1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        try {
            $employeeList = $this->administrationService->getEmployees($request->all());

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Users fetched successfully',
                'data' => $employeeList['data'],
                'meta' => $employeeList['meta'],
                'summary' => $employeeList['summary'],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching users: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function resetEmployeePassword(Request $request, int $employeeId)
    {
        if (!$this->canManageAdministration($request)) {
            return $this->unauthorizedResponse();
        }

        if (!Schema::hasTable('users')) {
            return $this->missingUsersTableResponse();
        }

        try {
            if (!$this->administrationService->resetEmployeePassword($employeeId)) {
                return response()->json([
                    'status' => false,
                    'success' => false,
                    'message' => 'User was not found.',
                ], 404);
            }

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Password reset successfully',
                'data' => [
                    'defaultPassword' => AdministrationService::DEFAULT_EMPLOYEE_PASSWORD,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error resetting employee password: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function updateEmployeeStatus(Request $request, int $employeeId)
    {
        if (!$this->canManageAdministration($request)) {
            return $this->unauthorizedResponse();
        }

        if (!Schema::hasTable('users')) {
            return $this->missingUsersTableResponse();
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:0,1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        try {
            $status = (int) $request->input('status');

            if (!$this->administrationService->updateEmployeeStatus($employeeId, $status)) {
                return response()->json([
                    'status' => false,
                    'success' => false,
                    'message' => 'User was not found.',
                ], 404);
            }

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => $status === 1
                    ? 'User activated successfully'
                    : 'User deactivated successfully',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating employee user status: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function instructorDetails(Request $request, int $userId)
    {
        if (!$this->canManageAdministration($request)) {
            return $this->unauthorizedResponse();
        }

        if (!Schema::hasTable('users')) {
            return $this->missingUsersTableResponse();
        }

        if (!Schema::hasTable('instructors')) {
            return response()->json([
                'status' => false,
                'success' => false,
                'message' => 'Instructors table not found.',
            ], 500);
        }

        try {
            $details = $this->administrationService->getInstructorDetails($userId);

            if (!$details) {
                return response()->json([
                    'status' => false,
                    'success' => false,
                    'message' => 'Instructor user was not found.',
                ], 404);
            }

            return response()->json([
                'status' => true,
                'success' => true,
                'message' => 'Instructor details fetched successfully',
                'data' => $details,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching instructor details: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    private function canManageAdministration(Request $request): bool
    {
        $user = $request->user();

        return $user
            && (int) ($user->deletedFlag ?? 0) === 0
            && in_array((int) $user->role, self::MANAGER_ROLES, true);
    }

    private function hasUserLocationColumns(): bool
    {
        return Schema::hasColumn('users', 'stateCode')
            && Schema::hasColumn('users', 'districtCode')
            && Schema::hasColumn('users', 'branchId');
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
            'message' => 'Only admin and ICETL team users can manage administration.',
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

    private function missingUsersTableResponse()
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'Users table not found.',
        ], 500);
    }

    private function missingUserLocationColumnsResponse()
    {
        return response()->json([
            'status' => false,
            'success' => false,
            'message' => 'User location columns not found. Please run the users table ALTER query or migration.',
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
