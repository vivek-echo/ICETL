<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class AdministrationService
{
    public const INSTRUCTOR_ROLE_ID = 3;
    public const EMPLOYEE_ROLE_ID = 4;
    public const DEFAULT_EMPLOYEE_PASSWORD = 'ICETL@123';

    public function getStates()
    {
        return DB::table('location')
            ->select('state_code as stateCode', 'state_name_english as stateName')
            ->whereNotNull('state_code')
            ->whereNotNull('state_name_english')
            ->whereRaw("TRIM(state_name_english) <> ''")
            ->distinct()
            ->orderBy('state_name_english')
            ->get()
            ->map(fn($state) => [
                'stateCode' => (int) $state->stateCode,
                'stateName' => (string) $state->stateName,
            ])
            ->values();
    }

    public function getDistricts(int $stateCode)
    {
        return DB::table('location')
            ->select('district_code as districtCode', 'district_name_english as districtName')
            ->where('state_code', $stateCode)
            ->whereNotNull('district_code')
            ->whereNotNull('district_name_english')
            ->whereRaw("TRIM(district_name_english) <> ''")
            ->distinct()
            ->orderBy('district_name_english')
            ->get()
            ->map(fn($district) => [
                'districtCode' => (int) $district->districtCode,
                'districtName' => (string) $district->districtName,
            ])
            ->values();
    }

    public function getRoles()
    {
        return DB::table('roles')
            ->select('id', 'roleName')
            ->where('deletedFlag', 0)
            ->orderBy('roleName')
            ->get()
            ->map(fn($role) => [
                'id' => (int) $role->id,
                'roleName' => (string) $role->roleName,
            ])
            ->values();
    }

    public function stateExists(int $stateCode): bool
    {
        return DB::table('location')
            ->where('state_code', $stateCode)
            ->exists();
    }

    public function districtBelongsToState(int $stateCode, int $districtCode): bool
    {
        return DB::table('location')
            ->where('state_code', $stateCode)
            ->where('district_code', $districtCode)
            ->exists();
    }

    public function branchExists(string $branchName, int $stateCode, int $districtCode): bool
    {
        return DB::table('branches')
            ->where('deletedFlag', 0)
            ->where('stateCode', $stateCode)
            ->where('districtCode', $districtCode)
            ->whereRaw('LOWER(branchName) = ?', [strtolower($this->normalizeText($branchName))])
            ->exists();
    }

    public function branchBelongsToLocation(
        int $branchId,
        int $stateCode,
        int $districtCode,
        bool $activeOnly = false
    ): bool {
        $query = DB::table('branches')
            ->where('id', $branchId)
            ->where('deletedFlag', 0)
            ->where('stateCode', $stateCode)
            ->where('districtCode', $districtCode);

        if ($activeOnly) {
            $query->where('status', 1);
        }

        return $query->exists();
    }

    public function createBranch(array $payload, ?int $userId = null): int
    {
        return (int) DB::table('branches')->insertGetId([
            'stateCode' => (int) $payload['stateCode'],
            'districtCode' => (int) $payload['districtCode'],
            'branchName' => $this->normalizeText((string) $payload['branchName']),
            'branchAddress' => $this->normalizeText((string) $payload['branchAddress']),
            'status' => (int) ($payload['status'] ?? 1),
            'createdBy' => $userId,
            'updatedBy' => $userId,
            'deletedFlag' => 0,
            'createdOn' => now(),
            'updatedOn' => now(),
        ]);
    }

    public function getBranches(array $filters): array
    {
        $query = DB::table('branches as b')
            ->leftJoinSub($this->locationLookupQuery(), 'l', function ($join): void {
                $join->on('l.state_code', '=', 'b.stateCode')
                    ->on('l.district_code', '=', 'b.districtCode');
            })
            ->where('b.deletedFlag', 0);

        $this->applyBranchFilters($query, $filters);

        $page = max((int) ($filters['page'] ?? 1), 1);
        $isAllPageSize = ($filters['perPage'] ?? null) === 'all';
        $filteredTotal = (clone $query)->count();
        $perPage = $isAllPageSize ? max($filteredTotal, 1) : (int) ($filters['perPage'] ?? 10);

        $branches = $query
            ->select(
                'b.id',
                'b.stateCode',
                'l.state_name_english as stateName',
                'b.districtCode',
                'l.district_name_english as districtName',
                'b.branchName',
                'b.branchAddress',
                'b.status',
                'b.createdOn',
                'b.updatedOn'
            )
            ->orderBy('b.createdOn', 'DESC')
            ->orderBy('b.id', 'DESC')
            ->paginate($perPage, ['*'], 'page', $page);

        $summaryQuery = DB::table('branches')->where('deletedFlag', 0);

        return [
            'data' => collect($branches->items())
                ->map(fn($branch) => $this->formatBranch($branch))
                ->values(),
            'meta' => [
                'currentPage' => $branches->currentPage(),
                'perPage' => $isAllPageSize ? 'all' : $branches->perPage(),
                'total' => $branches->total(),
                'lastPage' => $branches->lastPage(),
                'from' => $branches->firstItem(),
                'to' => $branches->lastItem(),
            ],
            'summary' => [
                'totalBranches' => (clone $summaryQuery)->count(),
                'activeBranches' => (clone $summaryQuery)->where('status', 1)->count(),
                'inactiveBranches' => (clone $summaryQuery)->where('status', 0)->count(),
            ],
        ];
    }

    public function employeeEmailExists(string $email, ?int $ignoreEmployeeId = null): bool
    {
        $query = DB::table('users')
            ->where('role', self::EMPLOYEE_ROLE_ID)
            ->whereRaw('LOWER(email) = ?', [strtolower(trim($email))]);

        if ($ignoreEmployeeId !== null) {
            $query->where('id', '<>', $ignoreEmployeeId);
        }

        return $query->exists();
    }

    public function employeePhoneExists(string $phone, ?int $ignoreEmployeeId = null): bool
    {
        $normalizedPhone = preg_replace('/\D+/', '', $phone) ?? '';

        if ($normalizedPhone === '') {
            return false;
        }

        $query = DB::table('users')
            ->where('role', self::EMPLOYEE_ROLE_ID)
            ->where('phone', $normalizedPhone);

        if ($ignoreEmployeeId !== null) {
            $query->where('id', '<>', $ignoreEmployeeId);
        }

        return $query->exists();
    }

    public function createEmployee(array $payload, ?int $userId = null): int
    {
        return (int) DB::transaction(function () use ($payload, $userId): int {
            $now = now();
            $status = (int) ($payload['status'] ?? 1);
            $employeeId = DB::table('users')->insertGetId($this->filterExistingColumns('users', [
                'userType' => 1,
                'name' => $this->normalizeText((string) $payload['name']),
                'email' => strtolower(trim((string) $payload['email'])),
                'phone' => preg_replace('/\D+/', '', (string) $payload['phone']) ?? '',
                'password' => Hash::make(self::DEFAULT_EMPLOYEE_PASSWORD),
                'email_verified_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
                'role' => self::EMPLOYEE_ROLE_ID,
                'dob' => ($payload['dob'] ?? null) ?: null,
                'gender' => ($payload['gender'] ?? null) ?: null,
                'deletedFlag' => $status === 1 ? 0 : 1,
                'profileStage' => 1,
                'stateCode' => (int) $payload['stateCode'],
                'districtCode' => (int) $payload['districtCode'],
                'branchId' => (int) $payload['branchId'],
                'createdBy' => $userId,
                'updatedBy' => $userId,
            ]));

            EntityCodeService::assignIfMissing('users', $employeeId, EntityCodeService::PREFIX_EMPLOYEE);

            return $employeeId;
        });
    }

    public function getEmployees(array $filters): array
    {
        return $this->getUsers($filters);
    }

    public function getUsers(array $filters): array
    {
        $query = DB::table('users as u')
            ->leftJoinSub($this->locationLookupQuery(), 'l', function ($join): void {
                $join->on('l.state_code', '=', 'u.stateCode')
                    ->on('l.district_code', '=', 'u.districtCode');
            })
            ->leftJoin('branches as b', 'b.id', '=', 'u.branchId')
            ->leftJoin('roles as r', 'r.id', '=', 'u.role');

        $this->applyEmployeeFilters($query, $filters);

        $page = max((int) ($filters['page'] ?? 1), 1);
        $isAllPageSize = ($filters['perPage'] ?? null) === 'all';
        $filteredTotal = (clone $query)->count();
        $perPage = $isAllPageSize ? max($filteredTotal, 1) : (int) ($filters['perPage'] ?? 10);

        $employees = $query
            ->select(
                'u.id',
                'u.code',
                'u.name',
                'u.email',
                'u.phone',
                'u.dob',
                'u.gender',
                'u.role',
                'r.roleName',
                'u.stateCode',
                'l.state_name_english as stateName',
                'u.districtCode',
                'l.district_name_english as districtName',
                'u.branchId',
                'b.branchName',
                'u.deletedFlag',
                'u.created_at',
                'u.updated_at'
            )
            ->orderBy('u.created_at', 'DESC')
            ->orderBy('u.id', 'DESC')
            ->paginate($perPage, ['*'], 'page', $page);

        $summaryQuery = DB::table('users');

        return [
            'data' => collect($employees->items())
                ->map(fn($employee) => $this->formatEmployee($employee))
                ->values(),
            'meta' => [
                'currentPage' => $employees->currentPage(),
                'perPage' => $isAllPageSize ? 'all' : $employees->perPage(),
                'total' => $employees->total(),
                'lastPage' => $employees->lastPage(),
                'from' => $employees->firstItem(),
                'to' => $employees->lastItem(),
            ],
            'summary' => [
                'totalUsers' => (clone $summaryQuery)->count(),
                'activeUsers' => (clone $summaryQuery)->where('deletedFlag', 0)->count(),
                'inactiveUsers' => (clone $summaryQuery)->where('deletedFlag', 1)->count(),
            ],
        ];
    }

    public function employeeExists(int $employeeId): bool
    {
        return $this->userExists($employeeId);
    }

    public function userExists(int $userId): bool
    {
        return DB::table('users')
            ->where('id', $userId)
            ->exists();
    }

    public function resetEmployeePassword(int $employeeId): bool
    {
        if (!$this->userExists($employeeId)) {
            return false;
        }

        DB::table('users')
            ->where('id', $employeeId)
            ->update($this->filterExistingColumns('users', [
                'password' => Hash::make(self::DEFAULT_EMPLOYEE_PASSWORD),
                'updated_at' => now(),
            ]));

        return true;
    }

    public function updateEmployeeStatus(int $employeeId, int $status): bool
    {
        if (!$this->userExists($employeeId)) {
            return false;
        }

        DB::table('users')
            ->where('id', $employeeId)
            ->update($this->filterExistingColumns('users', [
                'deletedFlag' => $status === 1 ? 0 : 1,
                'updated_at' => now(),
            ]));

        return true;
    }

    public function getInstructorDetails(int $userId): ?array
    {
        $user = DB::table('users as u')
            ->leftJoin('roles as r', 'r.id', '=', 'u.role')
            ->leftJoinSub($this->locationLookupQuery(), 'l', function ($join): void {
                $join->on('l.state_code', '=', 'u.stateCode')
                    ->on('l.district_code', '=', 'u.districtCode');
            })
            ->leftJoin('branches as b', 'b.id', '=', 'u.branchId')
            ->where('u.id', $userId)
            ->select(
                'u.id',
                'u.code',
                'u.name',
                'u.email',
                'u.phone',
                'u.dob',
                'u.gender',
                'u.role',
                'r.roleName',
                'u.userType',
                'u.profileStage',
                'u.profileImg',
                'u.thumbnailImg',
                'u.stateCode',
                'l.state_name_english as stateName',
                'u.districtCode',
                'l.district_name_english as districtName',
                'u.branchId',
                'b.branchName',
                'u.deletedFlag',
                'u.email_verified_at',
                'u.created_at',
                'u.updated_at'
            )
            ->first();

        if (!$user || (int) $user->role !== self::INSTRUCTOR_ROLE_ID) {
            return null;
        }

        $instructor = Schema::hasTable('instructors')
            ? DB::table('instructors')->where('userId', $userId)->first()
            : null;

        $documents = Schema::hasTable('instructordocuments')
            ? DB::table('instructordocuments')
                ->where('userId', $userId)
                ->orderByDesc('id')
                ->get()
                ->map(fn($document) => $this->formatInstructorDocument($document))
                ->values()
            : collect();

        $profilePhoto = $documents->firstWhere('documentType', 'profilePhoto');
        $userProfilePhotoUrl = $this->storedUserProfileFileUrl('profile', $user->profileImg ?? null);

        return [
            'user' => $this->formatInstructorUser($user),
            'profile' => $instructor ? [
                'id' => (int) $instructor->id,
                'userId' => (int) $instructor->userId,
                'headline' => (string) ($instructor->headline ?? ''),
                'bio' => (string) ($instructor->bio ?? ''),
                'experienceYears' => $instructor->experienceYears !== null ? (int) $instructor->experienceYears : null,
                'currentJobTitle' => (string) ($instructor->currentJobTitle ?? ''),
                'currentOrganization' => (string) ($instructor->currentOrganization ?? ''),
                'qualification' => (string) ($instructor->qualification ?? ''),
                'country' => (string) ($instructor->country ?? ''),
                'preferredLanguage' => (string) ($instructor->preferredLanguage ?? ''),
                'linkedinUrl' => (string) ($instructor->linkedinUrl ?? ''),
                'githubUrl' => (string) ($instructor->githubUrl ?? ''),
                'youtubeUrl' => (string) ($instructor->youtubeUrl ?? ''),
                'portfolioUrl' => (string) ($instructor->portfolioUrl ?? ''),
                'onboardingStep' => max(1, min(5, (int) ($instructor->onboardingStep ?? 1))),
                'onboardingCompleted' => (bool) ($instructor->onboardingCompleted ?? false),
                'approvalStatus' => (string) ($instructor->approvalStatus ?: 'draft'),
                'status' => (int) ($instructor->status ?? 1),
                'statusLabel' => (int) ($instructor->status ?? 1) === 1 ? 'Active' : 'Inactive',
                'profilePhotoUrl' => $profilePhoto['fileUrl'] ?? $userProfilePhotoUrl,
                'skills' => $this->instructorValues('instructorskills', 'skillName', $userId),
                'categories' => $this->instructorValues('instructorcategories', 'categoryName', $userId),
                'languagesYouCanTeach' => $this->instructorValues('instructorlanguages', 'languageName', $userId),
                'documents' => $documents,
                'createdAt' => $instructor->createdAt ?? null,
                'updatedAt' => $instructor->updatedAt ?? null,
            ] : null,
        ];
    }

    private function applyBranchFilters($query, array $filters): void
    {
        if (!empty($filters['branchName'])) {
            $branchName = trim((string) $filters['branchName']);

            $query->where('b.branchName', 'LIKE', '%' . $branchName . '%');
        }

        if (!empty($filters['stateCode'])) {
            $query->where('b.stateCode', (int) $filters['stateCode']);
        }

        if (!empty($filters['districtCode'])) {
            $query->where('b.districtCode', (int) $filters['districtCode']);
        }

        $status = $filters['status'] ?? 'all';

        if ($status !== '' && $status !== 'all' && $status !== null) {
            $query->where('b.status', (int) $status);
        }
    }

    private function applyEmployeeFilters($query, array $filters): void
    {
        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);

            $query->where(function ($subQuery) use ($search): void {
                $subQuery
                    ->where('u.name', 'LIKE', '%' . $search . '%')
                    ->orWhere('u.email', 'LIKE', '%' . $search . '%')
                    ->orWhere('u.phone', 'LIKE', '%' . $search . '%')
                    ->orWhere('u.code', 'LIKE', '%' . $search . '%');
            });
        }

        if (!empty($filters['stateCode'])) {
            $query->where('u.stateCode', (int) $filters['stateCode']);
        }

        if (!empty($filters['districtCode'])) {
            $query->where('u.districtCode', (int) $filters['districtCode']);
        }

        if (!empty($filters['branchId'])) {
            $query->where('u.branchId', (int) $filters['branchId']);
        }

        $role = $filters['role'] ?? 'all';

        if ($role !== '' && $role !== 'all' && $role !== null) {
            $query->where('u.role', (int) $role);
        }

        $status = $filters['status'] ?? 'all';

        if ($status !== '' && $status !== 'all' && $status !== null) {
            $query->where('u.deletedFlag', (int) $status === 1 ? 0 : 1);
        }
    }

    private function locationLookupQuery()
    {
        return DB::table('location')
            ->select(
                'state_code',
                'state_name_english',
                'district_code',
                'district_name_english'
            )
            ->distinct();
    }

    private function formatBranch(object $branch): array
    {
        $status = (int) $branch->status;

        return [
            'id' => (int) $branch->id,
            'stateCode' => (int) $branch->stateCode,
            'stateName' => (string) ($branch->stateName ?? ''),
            'districtCode' => (int) $branch->districtCode,
            'districtName' => (string) ($branch->districtName ?? ''),
            'branchName' => (string) $branch->branchName,
            'branchAddress' => (string) $branch->branchAddress,
            'status' => $status,
            'statusLabel' => $status === 1 ? 'Active' : 'Inactive',
            'createdOn' => $branch->createdOn,
            'updatedOn' => $branch->updatedOn,
        ];
    }

    private function formatEmployee(object $employee): array
    {
        $deletedFlag = (int) ($employee->deletedFlag ?? 0);
        $status = $deletedFlag === 0 ? 1 : 0;

        return [
            'id' => (int) $employee->id,
            'code' => (string) ($employee->code ?? ''),
            'name' => (string) $employee->name,
            'email' => (string) $employee->email,
            'phone' => (string) ($employee->phone ?? ''),
            'dob' => $employee->dob,
            'gender' => $employee->gender,
            'role' => (int) $employee->role,
            'roleName' => (string) ($employee->roleName ?? ''),
            'stateCode' => (int) ($employee->stateCode ?? 0),
            'stateName' => (string) ($employee->stateName ?? ''),
            'districtCode' => (int) ($employee->districtCode ?? 0),
            'districtName' => (string) ($employee->districtName ?? ''),
            'branchId' => (int) ($employee->branchId ?? 0),
            'branchName' => (string) ($employee->branchName ?? ''),
            'status' => $status,
            'statusLabel' => $status === 1 ? 'Active' : 'Inactive',
            'deletedFlag' => $deletedFlag,
            'createdAt' => $employee->created_at,
            'updatedAt' => $employee->updated_at,
        ];
    }

    private function formatInstructorUser(object $user): array
    {
        $deletedFlag = (int) ($user->deletedFlag ?? 0);
        $status = $deletedFlag === 0 ? 1 : 0;

        return [
            'id' => (int) $user->id,
            'code' => (string) ($user->code ?? ''),
            'name' => (string) ($user->name ?? ''),
            'email' => (string) ($user->email ?? ''),
            'phone' => (string) ($user->phone ?? ''),
            'dob' => $user->dob ?? null,
            'gender' => $user->gender ?? null,
            'role' => (int) ($user->role ?? 0),
            'roleName' => (string) ($user->roleName ?? ''),
            'userType' => $user->userType !== null ? (int) $user->userType : null,
            'profileStage' => $user->profileStage !== null ? (int) $user->profileStage : null,
            'profileImg' => (string) ($user->profileImg ?? ''),
            'thumbnailImg' => (string) ($user->thumbnailImg ?? ''),
            'profileImgUrl' => $this->storedUserProfileFileUrl('profile', $user->profileImg ?? null),
            'thumbnailImgUrl' => $this->storedUserProfileFileUrl('thumbnail', $user->thumbnailImg ?? null),
            'stateCode' => (int) ($user->stateCode ?? 0),
            'stateName' => (string) ($user->stateName ?? ''),
            'districtCode' => (int) ($user->districtCode ?? 0),
            'districtName' => (string) ($user->districtName ?? ''),
            'branchId' => (int) ($user->branchId ?? 0),
            'branchName' => (string) ($user->branchName ?? ''),
            'status' => $status,
            'statusLabel' => $status === 1 ? 'Active' : 'Inactive',
            'deletedFlag' => $deletedFlag,
            'emailVerifiedAt' => $user->email_verified_at ?? null,
            'createdAt' => $user->created_at ?? null,
            'updatedAt' => $user->updated_at ?? null,
        ];
    }

    private function instructorValues(string $table, string $column, int $userId): array
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) {
            return [];
        }

        return DB::table($table)
            ->where('userId', $userId)
            ->whereNotNull($column)
            ->pluck($column)
            ->map(fn($value) => (string) $value)
            ->filter(fn($value) => trim($value) !== '')
            ->values()
            ->all();
    }

    private function formatInstructorDocument(object $document): array
    {
        $normalizedFilePath = $this->normalizeInstructorStoragePath((string) ($document->filePath ?? ''));
        $fileName = basename($normalizedFilePath);

        return [
            'id' => (int) $document->id,
            'userId' => (int) $document->userId,
            'documentType' => (string) ($document->documentType ?? ''),
            'fileName' => $fileName,
            'originalName' => $fileName,
            'filePath' => $normalizedFilePath,
            'fileUrl' => $normalizedFilePath !== '' ? $this->privateFileUrl($normalizedFilePath) : null,
            'createdAt' => $document->createdAt ?? null,
            'updatedAt' => $document->updatedAt ?? null,
        ];
    }

    private function storedUserProfileFileUrl(string $type, ?string $fileName): ?string
    {
        $fileName = trim((string) $fileName);

        if ($fileName === '') {
            return null;
        }

        return $this->privateFileUrl('uploads/user/' . trim($type, '/') . '/' . basename($fileName));
    }

    private function normalizeInstructorStoragePath(string $path): string
    {
        $normalizedPath = trim(str_replace('\\', '/', urldecode($path)), '/');

        if (
            $normalizedPath === ''
            || str_starts_with($normalizedPath, 'uploads/instructors/')
        ) {
            return $normalizedPath;
        }

        return 'uploads/instructors/' . $normalizedPath;
    }

    private function privateFileUrl(string $path): string
    {
        $requestUrl = request()->url();
        $apiPosition = strpos($requestUrl, '/api/');
        $baseUrl = $apiPosition === false
            ? request()->getSchemeAndHttpHost()
            : substr($requestUrl, 0, $apiPosition);

        return $baseUrl . '/api/getAfile?path=' . rawurlencode(trim($path, '/'));
    }

    private function normalizeText(string $value): string
    {
        return trim((string) preg_replace('/\s+/', ' ', $value));
    }

    private function filterExistingColumns(string $table, array $payload): array
    {
        return array_filter(
            $payload,
            fn($value, $column): bool => Schema::hasColumn($table, (string) $column),
            ARRAY_FILTER_USE_BOTH
        );
    }
}
