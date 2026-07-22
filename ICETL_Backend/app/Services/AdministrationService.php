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
    public const CURRENCY = 'INR';
    public const INSTRUCTOR_PAYOUT_PERCENT = 40.0;
    public const INSTRUCTOR_PAYOUT_EVENT = 'instructor.payout_initiated';
    public const INSTRUCTOR_PAYOUT_INVOICE_TYPE = 'INSTRUCTOR_PAYOUT';
    public const BANK_VERIFICATION_NOT_SUBMITTED = 'Not Submitted';
    public const BANK_VERIFICATION_PENDING = 'Pending';
    public const BANK_VERIFICATION_VERIFIED = 'Verified';
    public const BANK_VERIFICATION_REJECTED = 'Rejected';
    public const ADMIN_BANK_VERIFICATION_STATUSES = [
        self::BANK_VERIFICATION_PENDING,
        self::BANK_VERIFICATION_VERIFIED,
        self::BANK_VERIFICATION_REJECTED,
    ];

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

    public function getBranchLocation(
        int $branchId,
        ?int $stateCode = null,
        ?int $districtCode = null,
        bool $activeOnly = false
    ): ?object {
        $query = DB::table('branches as b')
            ->leftJoinSub($this->locationLookupQuery(), 'l', function ($join): void {
                $join->on('l.state_code', '=', 'b.stateCode')
                    ->on('l.district_code', '=', 'b.districtCode');
            })
            ->where('b.id', $branchId)
            ->where('b.deletedFlag', 0);

        if ($stateCode !== null) {
            $query->where('b.stateCode', $stateCode);
        }

        if ($districtCode !== null) {
            $query->where('b.districtCode', $districtCode);
        }

        if ($activeOnly) {
            $query->where('b.status', 1);
        }

        return $query
            ->select(
                'b.id as branchId',
                'b.stateCode',
                'l.state_name_english as stateName',
                'b.districtCode',
                'l.district_name_english as districtName',
                'b.branchName',
                'b.branchAddress',
                'b.status'
            )
            ->first();
    }

    public function formatProgramLocation(object $location, ?string $legacyVenue = null, ?string $legacyCity = null): array
    {
        $stateCode = (int) ($location->stateCode ?? 0);
        $districtCode = (int) ($location->districtCode ?? 0);
        $branchId = (int) ($location->branchId ?? 0);
        $stateName = trim((string) ($location->stateName ?? ''));
        $districtName = trim((string) ($location->districtName ?? ''));
        $branchName = trim((string) ($location->branchName ?? ''));
        $branchAddress = trim((string) ($location->branchAddress ?? ''));
        $legacyParts = collect([$legacyVenue, $legacyCity])
            ->map(fn($value) => trim((string) ($value ?? '')))
            ->filter()
            ->unique()
            ->values()
            ->all();
        $locationParts = collect([$branchName, $districtName, $stateName])
            ->filter()
            ->unique()
            ->values()
            ->all();

        return [
            'stateCode' => $stateCode ?: null,
            'stateName' => $stateName,
            'districtCode' => $districtCode ?: null,
            'districtName' => $districtName,
            'branchId' => $branchId ?: null,
            'branchName' => $branchName,
            'branchAddress' => $branchAddress,
            'locationLabel' => implode(', ', $locationParts ?: $legacyParts),
        ];
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

        $employeeRows = collect($employees->items());
        $instructorPayoutSummaries = $this->instructorPayoutSummariesForUsers(
            $employeeRows
                ->filter(fn($employee): bool => (int) ($employee->role ?? 0) === self::INSTRUCTOR_ROLE_ID)
                ->pluck('id')
                ->map(fn($id): int => (int) $id)
                ->values()
                ->all()
        );
        $summaryQuery = DB::table('users');

        return [
            'data' => $employeeRows
                ->map(fn($employee) => $this->formatEmployee(
                    $employee,
                    $instructorPayoutSummaries[(int) $employee->id] ?? null
                ))
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

    public function instructorHasCompleteBankDetails(int $userId): bool
    {
        if (!Schema::hasTable('instructors')) {
            return false;
        }

        foreach ([
            'bankAccountHolderName',
            'bankName',
            'bankAccountNumber',
            'bankIfscCode',
            'bankAccountType',
            'bankBranchName',
        ] as $column) {
            if (!Schema::hasColumn('instructors', $column)) {
                return false;
            }
        }

        $instructor = DB::table('instructors')
            ->where('userId', $userId)
            ->select(
                'bankAccountHolderName',
                'bankName',
                'bankAccountNumber',
                'bankIfscCode',
                'bankAccountType',
                'bankBranchName'
            )
            ->first();

        if (!$instructor) {
            return false;
        }

        foreach ([
            $instructor->bankAccountHolderName ?? '',
            $instructor->bankName ?? '',
            $instructor->bankAccountNumber ?? '',
            $instructor->bankIfscCode ?? '',
            $instructor->bankAccountType ?? '',
            $instructor->bankBranchName ?? '',
        ] as $value) {
            if (trim((string) $value) === '') {
                return false;
            }
        }

        return true;
    }

    public function updateInstructorBankVerificationStatus(
        int $userId,
        string $status,
        ?int $adminUserId = null
    ): bool {
        $exists = DB::table('instructors as i')
            ->join('users as u', 'u.id', '=', 'i.userId')
            ->where('i.userId', $userId)
            ->where('u.role', self::INSTRUCTOR_ROLE_ID)
            ->exists();

        if (!$exists) {
            return false;
        }

        DB::table('instructors')
            ->where('userId', $userId)
            ->update($this->filterExistingColumns('instructors', [
                'bankVerificationStatus' => $this->normalizeBankVerificationStatus($status),
                'updatedBy' => $adminUserId,
                'updatedAt' => now(),
            ]));

        return true;
    }

    public function instructorPayoutSummary(int $userId, bool $includeDetails = false): array
    {
        $bankProfile = $this->instructorBankProfile($userId);
        $eligibleItems = $this->eligibleInstructorPayoutItems($userId);
        $settledSummary = $this->settledInstructorPayoutSummary($userId);

        $eligibleSalesAmount = round((float) $eligibleItems->sum('saleAmount'), 2);
        $eligibleTaxAmount = round((float) $eligibleItems->sum('taxAmount'), 2);
        $eligibleSalesTotalAmount = round((float) $eligibleItems->sum('saleTotalAmount'), 2);
        $eligiblePayoutAmount = round((float) $eligibleItems->sum('payoutAmount'), 2);

        $summary = [
            'commissionPercent' => self::INSTRUCTOR_PAYOUT_PERCENT,
            'eligiblePurchaseCount' => $eligibleItems->count(),
            'eligibleSalesAmount' => $eligibleSalesAmount,
            'eligibleTaxAmount' => $eligibleTaxAmount,
            'eligibleSalesTotalAmount' => $eligibleSalesTotalAmount,
            'eligiblePayoutAmount' => $eligiblePayoutAmount,
            'paidPayoutCount' => $settledSummary['paidPayoutCount'],
            'paidPayoutAmount' => $settledSummary['paidPayoutAmount'],
            'paidSalesAmount' => $settledSummary['paidSalesAmount'],
            'lastPayoutAt' => $settledSummary['lastPayoutAt'],
            'bankVerificationStatus' => $bankProfile['bankVerificationStatus'],
            'bankDetailsComplete' => $bankProfile['bankDetailsComplete'],
            'bankVerified' => $bankProfile['bankVerified'],
            'bankAccountNumberMasked' => $bankProfile['bankAccountNumberMasked'],
            'bankName' => $bankProfile['bankName'],
            'bankIfscCode' => $bankProfile['bankIfscCode'],
            'canInitiatePayout' => $eligiblePayoutAmount > 0
                && $bankProfile['bankDetailsComplete']
                && $bankProfile['bankVerified']
                && $this->hasInstructorPayoutTables(),
        ];

        if ($includeDetails) {
            $summary['eligibleItems'] = $eligibleItems->take(50)->values()->all();
            $summary['recentPayouts'] = $this->recentInstructorPayouts($userId);
        }

        return $summary;
    }

    public function initiateInstructorPayout(
        int $userId,
        int $adminUserId,
        ?string $ipAddress = null,
        ?string $browserInfo = null
    ): array {
        if (!$this->hasInstructorPayoutTables()) {
            throw new \RuntimeException('Instructor payout tables are missing. Please run the latest migrations.');
        }

        $details = $this->getInstructorDetails($userId);

        if (!$details || !$details['profile']) {
            throw new \InvalidArgumentException('Instructor profile was not found.');
        }

        $bankProfile = $this->instructorBankProfile($userId);

        if (!$bankProfile['bankDetailsComplete']) {
            throw new \InvalidArgumentException('Bank details are incomplete. Verification cannot be initiated yet.');
        }

        if (!$bankProfile['bankVerified']) {
            throw new \InvalidArgumentException('Instructor bank account must be verified before initiating payment.');
        }

        return DB::transaction(function () use ($userId, $adminUserId, $details, $bankProfile, $ipAddress, $browserInfo): array {
            $items = $this->eligibleInstructorPayoutItems($userId, true);

            if ($items->isEmpty()) {
                throw new \InvalidArgumentException('There is no payable instructor amount right now.');
            }

            $salesAmount = round((float) $items->sum('saleAmount'), 2);
            $taxAmount = round((float) $items->sum('taxAmount'), 2);
            $salesTotalAmount = round((float) $items->sum('saleTotalAmount'), 2);
            $payoutAmount = round((float) $items->sum('payoutAmount'), 2);

            if ($payoutAmount <= 0) {
                throw new \InvalidArgumentException('There is no payable instructor amount right now.');
            }

            $instructorUser = (object) $details['user'];
            $payoutReference = $this->reference('IPAY');
            $paymentReference = $this->reference('IBANK');
            $entityTitle = 'Instructor payout - ' . ($instructorUser->name ?: 'Instructor');
            $bankSnapshot = $this->payoutBankSnapshot($bankProfile);
            $now = now();

            $payoutId = DB::table('instructor_payouts')->insertGetId($this->filterExistingColumns('instructor_payouts', [
                'payoutReference' => $payoutReference,
                'instructorUserId' => $userId,
                'adminUserId' => $adminUserId,
                'totalSalesAmount' => $salesAmount,
                'commissionPercent' => self::INSTRUCTOR_PAYOUT_PERCENT,
                'payoutAmount' => $payoutAmount,
                'currency' => self::CURRENCY,
                'status' => 'initiated',
                'bankSnapshot' => json_encode($bankSnapshot),
                'remarks' => '40% instructor cut payout initiated to verified bank account.',
                'initiatedAt' => $now,
                'deletedFlag' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]));

            $payoutItemRows = $items->map(fn(array $item): array => $this->filterExistingColumns('instructor_payout_items', [
                'payoutId' => $payoutId,
                'instructorUserId' => $userId,
                'orderItemId' => $item['orderItemId'],
                'orderId' => $item['orderId'],
                'paymentId' => $item['paymentId'],
                'courseId' => $item['courseId'],
                'courseCode' => $item['courseCode'],
                'courseTitle' => $item['courseTitle'],
                'learnerUserId' => $item['learnerUserId'],
                'saleAmount' => $item['saleAmount'],
                'taxAmount' => $item['taxAmount'],
                'saleTotalAmount' => $item['saleTotalAmount'],
                'commissionPercent' => self::INSTRUCTOR_PAYOUT_PERCENT,
                'payoutAmount' => $item['payoutAmount'],
                'currency' => self::CURRENCY,
                'deletedFlag' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]))->all();

            DB::table('instructor_payout_items')->insert($payoutItemRows);

            $orderId = DB::table('orders')->insertGetId($this->filterExistingColumns('orders', [
                'userId' => $userId,
                'orderReference' => $payoutReference,
                'subtotalAmount' => $payoutAmount,
                'taxAmount' => 0,
                'totalAmount' => $payoutAmount,
                'currency' => self::CURRENCY,
                'status' => 'paid',
                'razorpayOrderId' => null,
                'expiresAt' => null,
                'deletedFlag' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]));

            $paymentId = DB::table('payments')->insertGetId($this->filterExistingColumns('payments', [
                'orderId' => $orderId,
                'userId' => $userId,
                'paymentReference' => $paymentReference,
                'razorpayPaymentId' => null,
                'razorpayOrderId' => null,
                'razorpaySignature' => null,
                'amount' => $payoutAmount,
                'taxAmount' => 0,
                'totalAmount' => $payoutAmount,
                'currency' => self::CURRENCY,
                'paymentMethod' => 'BANK_TRANSFER',
                'status' => 'success',
                'failureReason' => null,
                'paidAt' => $now,
                'deletedFlag' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]));

            $invoicePayload = $this->instructorPayoutInvoicePayload(
                $orderId,
                $payoutReference,
                $paymentReference,
                $instructorUser,
                $entityTitle,
                $items,
                $salesAmount,
                $taxAmount,
                $salesTotalAmount,
                $payoutAmount,
                $bankSnapshot,
                $now
            );

            $invoiceId = DB::table('invoices')->insertGetId($this->filterExistingColumns('invoices', [
                'userId' => $userId,
                'orderId' => $orderId,
                'paymentId' => $paymentId,
                'invoiceType' => self::INSTRUCTOR_PAYOUT_INVOICE_TYPE,
                'invoiceAmount' => $payoutAmount,
                'paymentType' => 'BANK_TRANSFER',
                'transactionNo' => $paymentReference,
                'paymentDate' => $now->toDateString(),
                'invoiceStatus' => 'paid',
                'createdBy' => $adminUserId,
                'invoiceNumber' => 'INV-' . date('Y') . '-PENDING',
                'entityType' => 'Instructor Payout',
                'entityId' => $userId,
                'entityCode' => $instructorUser->code ?? null,
                'entityTitle' => $entityTitle,
                'invoiceDate' => $now->toDateString(),
                'customerName' => $instructorUser->name ?? 'Instructor',
                'customerEmail' => $instructorUser->email ?? null,
                'customerPhone' => $instructorUser->phone ?? null,
                'subtotal' => $payoutAmount,
                'tax' => 0,
                'grandTotal' => $payoutAmount,
                'currency' => self::CURRENCY,
                'paymentReference' => $paymentReference,
                'invoiceData' => json_encode($invoicePayload),
                'deletedFlag' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]));

            $invoiceNumber = 'INV-' . date('Y') . '-' . str_pad((string) $invoiceId, 6, '0', STR_PAD_LEFT);
            $invoicePayload['invoiceNo'] = $invoiceNumber;

            DB::table('invoices')->where('id', $invoiceId)->update($this->filterExistingColumns('invoices', [
                'invoiceNumber' => $invoiceNumber,
                'invoiceData' => json_encode($invoicePayload),
                'updated_at' => $now,
            ]));

            DB::table('instructor_payouts')->where('id', $payoutId)->update($this->filterExistingColumns('instructor_payouts', [
                'orderId' => $orderId,
                'paymentId' => $paymentId,
                'invoiceId' => $invoiceId,
                'invoiceNumber' => $invoiceNumber,
                'updated_at' => $now,
            ]));

            $this->insertInstructorPayoutPaymentLogs(
                $userId,
                $adminUserId,
                $orderId,
                $paymentId,
                $invoiceNumber,
                $payoutReference,
                $paymentReference,
                $entityTitle,
                $salesAmount,
                $payoutAmount,
                $items->count(),
                $bankSnapshot,
                $ipAddress,
                $browserInfo
            );

            return [
                'payout' => [
                    'id' => (int) $payoutId,
                    'payoutReference' => $payoutReference,
                    'orderId' => (int) $orderId,
                    'paymentId' => (int) $paymentId,
                    'invoiceId' => (int) $invoiceId,
                    'invoiceNumber' => $invoiceNumber,
                    'eligiblePurchaseCount' => $items->count(),
                    'salesAmount' => $salesAmount,
                    'taxAmount' => $taxAmount,
                    'salesTotalAmount' => $salesTotalAmount,
                    'commissionPercent' => self::INSTRUCTOR_PAYOUT_PERCENT,
                    'payoutAmount' => $payoutAmount,
                    'currency' => self::CURRENCY,
                    'status' => 'initiated',
                    'initiatedAt' => (string) $now,
                ],
                'summary' => $this->instructorPayoutSummary($userId, true),
                'instructorDetails' => $this->getInstructorDetails($userId),
            ];
        });
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
                'bankAccountHolderName' => (string) ($instructor->bankAccountHolderName ?? ''),
                'bankName' => (string) ($instructor->bankName ?? ''),
                'bankAccountNumber' => (string) ($instructor->bankAccountNumber ?? ''),
                'bankIfscCode' => (string) ($instructor->bankIfscCode ?? ''),
                'bankAccountType' => (string) ($instructor->bankAccountType ?? ''),
                'bankBranchName' => (string) ($instructor->bankBranchName ?? ''),
                'bankVerificationStatus' => $this->normalizeBankVerificationStatus($instructor->bankVerificationStatus ?? null),
                'onboardingStep' => max(1, min(6, (int) ($instructor->onboardingStep ?? 1))),
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
            'payoutSummary' => $this->instructorPayoutSummary($userId, true),
        ];
    }

    private function instructorPayoutSummariesForUsers(array $userIds): array
    {
        $uniqueUserIds = collect($userIds)
            ->map(fn($userId): int => (int) $userId)
            ->filter(fn(int $userId): bool => $userId > 0)
            ->unique()
            ->values();

        if ($uniqueUserIds->isEmpty()) {
            return [];
        }

        return $uniqueUserIds
            ->mapWithKeys(fn(int $userId): array => [$userId => $this->instructorPayoutSummary($userId)])
            ->all();
    }

    private function eligibleInstructorPayoutItems(int $userId, bool $lockRows = false)
    {
        if (!$this->hasInstructorPayoutSourceTables()) {
            return collect();
        }

        $successfulPayments = DB::table('payments')
            ->select('orderId', DB::raw('MAX(id) as paymentId'))
            ->where('status', 'success')
            ->where('deletedFlag', 0)
            ->groupBy('orderId');

        $query = DB::table('order_items as oi')
            ->join('orders as o', function ($join): void {
                $join->on('o.id', '=', 'oi.orderId')
                    ->where('o.deletedFlag', 0)
                    ->where('o.status', 'paid');
            })
            ->joinSub($successfulPayments, 'successful_payments', function ($join): void {
                $join->on('successful_payments.orderId', '=', 'o.id');
            })
            ->join('payments as p', 'p.id', '=', 'successful_payments.paymentId')
            ->join('courses as c', function ($join) use ($userId): void {
                $join->on('c.id', '=', 'oi.courseId')
                    ->where('c.deletedFlag', 0)
                    ->where('c.createdBy', $userId);
            })
            ->leftJoin('users as learner', 'learner.id', '=', 'o.userId')
            ->where('oi.deletedFlag', 0);

        if ($this->hasInstructorPayoutTables()) {
            $query->whereNotExists(function ($subQuery) use ($userId): void {
                $subQuery
                    ->select(DB::raw(1))
                    ->from('instructor_payout_items as ipi')
                    ->join('instructor_payouts as ip', 'ip.id', '=', 'ipi.payoutId')
                    ->whereColumn('ipi.orderItemId', 'oi.id')
                    ->where('ipi.instructorUserId', $userId)
                    ->where('ipi.deletedFlag', 0)
                    ->where('ip.deletedFlag', 0)
                    ->whereNotIn('ip.status', ['cancelled', 'failed', 'rejected']);
            });
        }

        if ($lockRows) {
            $query->lockForUpdate();
        }

        return $query
            ->select(
                'oi.id as orderItemId',
                'oi.orderId',
                'p.id as paymentId',
                'o.orderReference',
                'o.created_at as purchasedAt',
                'o.userId as learnerUserId',
                'learner.name as learnerName',
                'learner.email as learnerEmail',
                'oi.courseId',
                Schema::hasColumn('courses', 'code') ? 'c.code as courseCode' : DB::raw('NULL as courseCode'),
                'c.title as courseTitle',
                'oi.price as saleAmount',
                'oi.taxAmount',
                'oi.totalAmount as saleTotalAmount'
            )
            ->orderBy('o.created_at')
            ->orderBy('oi.id')
            ->get()
            ->map(function (object $item): array {
                $saleAmount = round(max((float) ($item->saleAmount ?? 0), 0), 2);
                $taxAmount = round(max((float) ($item->taxAmount ?? 0), 0), 2);
                $saleTotalAmount = round(max((float) ($item->saleTotalAmount ?? ($saleAmount + $taxAmount)), 0), 2);
                $payoutAmount = round($saleAmount * self::INSTRUCTOR_PAYOUT_PERCENT / 100, 2);

                return [
                    'orderItemId' => (int) $item->orderItemId,
                    'orderId' => (int) $item->orderId,
                    'paymentId' => $item->paymentId ? (int) $item->paymentId : null,
                    'orderReference' => $item->orderReference,
                    'purchasedAt' => $item->purchasedAt,
                    'learnerUserId' => $item->learnerUserId ? (int) $item->learnerUserId : null,
                    'learnerName' => (string) ($item->learnerName ?? ''),
                    'learnerEmail' => (string) ($item->learnerEmail ?? ''),
                    'courseId' => (int) $item->courseId,
                    'courseCode' => $item->courseCode ?? null,
                    'courseTitle' => (string) ($item->courseTitle ?? 'Course'),
                    'saleAmount' => $saleAmount,
                    'taxAmount' => $taxAmount,
                    'saleTotalAmount' => $saleTotalAmount,
                    'commissionPercent' => self::INSTRUCTOR_PAYOUT_PERCENT,
                    'payoutAmount' => $payoutAmount,
                ];
            })
            ->filter(fn(array $item): bool => $item['payoutAmount'] > 0)
            ->values();
    }

    private function instructorBankProfile(int $userId): array
    {
        $instructor = Schema::hasTable('instructors')
            ? DB::table('instructors')->where('userId', $userId)->first()
            : null;

        $status = $this->normalizeBankVerificationStatus($instructor->bankVerificationStatus ?? null);
        $requiredFields = [
            $instructor->bankAccountHolderName ?? '',
            $instructor->bankName ?? '',
            $instructor->bankAccountNumber ?? '',
            $instructor->bankIfscCode ?? '',
            $instructor->bankAccountType ?? '',
            $instructor->bankBranchName ?? '',
        ];
        $bankDetailsComplete = $instructor
            && collect($requiredFields)->every(fn($value): bool => trim((string) $value) !== '');

        return [
            'bankAccountHolderName' => (string) ($instructor->bankAccountHolderName ?? ''),
            'bankName' => (string) ($instructor->bankName ?? ''),
            'bankAccountNumberMasked' => $this->maskBankAccountNumber($instructor->bankAccountNumber ?? null),
            'bankIfscCode' => (string) ($instructor->bankIfscCode ?? ''),
            'bankAccountType' => (string) ($instructor->bankAccountType ?? ''),
            'bankBranchName' => (string) ($instructor->bankBranchName ?? ''),
            'bankVerificationStatus' => $status,
            'bankDetailsComplete' => (bool) $bankDetailsComplete,
            'bankVerified' => $status === self::BANK_VERIFICATION_VERIFIED,
        ];
    }

    private function settledInstructorPayoutSummary(int $userId): array
    {
        if (!$this->hasInstructorPayoutTables()) {
            return [
                'paidPayoutCount' => 0,
                'paidPayoutAmount' => 0.0,
                'paidSalesAmount' => 0.0,
                'lastPayoutAt' => null,
            ];
        }

        $query = DB::table('instructor_payouts')
            ->where('instructorUserId', $userId)
            ->where('deletedFlag', 0)
            ->whereNotIn('status', ['cancelled', 'failed', 'rejected']);

        return [
            'paidPayoutCount' => (clone $query)->count(),
            'paidPayoutAmount' => round((float) (clone $query)->sum('payoutAmount'), 2),
            'paidSalesAmount' => round((float) (clone $query)->sum('totalSalesAmount'), 2),
            'lastPayoutAt' => (clone $query)->max('initiatedAt'),
        ];
    }

    private function recentInstructorPayouts(int $userId): array
    {
        if (!$this->hasInstructorPayoutTables()) {
            return [];
        }

        return DB::table('instructor_payouts')
            ->where('instructorUserId', $userId)
            ->where('deletedFlag', 0)
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn(object $payout): array => [
                'id' => (int) $payout->id,
                'payoutReference' => $payout->payoutReference,
                'invoiceNumber' => $payout->invoiceNumber,
                'invoiceId' => $payout->invoiceId ? (int) $payout->invoiceId : null,
                'orderId' => $payout->orderId ? (int) $payout->orderId : null,
                'invoiceDownloadUrl' => $payout->orderId ? url('/api/invoice/' . (int) $payout->orderId . '/download') : null,
                'totalSalesAmount' => (float) $payout->totalSalesAmount,
                'commissionPercent' => (float) $payout->commissionPercent,
                'payoutAmount' => (float) $payout->payoutAmount,
                'currency' => $payout->currency ?: self::CURRENCY,
                'status' => $payout->status,
                'initiatedAt' => $payout->initiatedAt,
            ])
            ->values()
            ->all();
    }

    private function instructorPayoutInvoicePayload(
        int $orderId,
        string $payoutReference,
        string $paymentReference,
        object $instructorUser,
        string $entityTitle,
        $items,
        float $salesAmount,
        float $taxAmount,
        float $salesTotalAmount,
        float $payoutAmount,
        array $bankSnapshot,
        object $now
    ): array {
        $invoiceItems = $items
            ->map(fn(array $item): array => [
                'courseId' => $item['orderItemId'],
                'entityId' => $item['courseId'],
                'title' => $item['courseTitle'],
                'code' => $item['courseCode'],
                'entityType' => 'Course',
                'entityCode' => $item['courseCode'],
                'entityTitle' => $item['courseTitle'],
                'categoryName' => 'Instructor Cut (40%)',
                'price' => $item['payoutAmount'],
                'taxAmount' => 0,
                'totalAmount' => $item['payoutAmount'],
                'saleAmount' => $item['saleAmount'],
                'saleTotalAmount' => $item['saleTotalAmount'],
                'orderReference' => $item['orderReference'],
                'learnerName' => $item['learnerName'],
            ])
            ->values()
            ->all();

        return [
            'invoiceNo' => 'PENDING',
            'orderId' => $orderId,
            'orderReference' => $payoutReference,
            'orderDate' => (string) $now,
            'invoiceDate' => $now->toDateString(),
            'status' => 'paid',
            'paymentStatus' => 'success',
            'paymentReference' => $paymentReference,
            'paymentDisplayId' => $paymentReference,
            'paymentMethod' => 'BANK_TRANSFER',
            'paymentBy' => 'BANK_TRANSFER',
            'transactionNo' => $paymentReference,
            'currency' => self::CURRENCY,
            'customer' => [
                'name' => $instructorUser->name ?? 'Instructor',
                'email' => $instructorUser->email ?? null,
                'phone' => $instructorUser->phone ?? null,
            ],
            'company' => [
                'name' => 'ICETL',
                'subtitle' => 'Ice Technology Lab',
                'email' => 'support@icetl.com',
            ],
            'entityType' => 'Instructor Payout',
            'entityId' => (int) ($instructorUser->id ?? 0),
            'entityCode' => $instructorUser->code ?? null,
            'entityTitle' => $entityTitle,
            'items' => $invoiceItems,
            'subtotal' => $payoutAmount,
            'taxPercent' => 0,
            'tax' => 0,
            'totalAmount' => $payoutAmount,
            'settlement' => [
                'grossCourseSales' => $salesAmount,
                'grossTaxAmount' => $taxAmount,
                'grossCourseSalesWithTax' => $salesTotalAmount,
                'commissionPercent' => self::INSTRUCTOR_PAYOUT_PERCENT,
                'bank' => $bankSnapshot,
            ],
        ];
    }

    private function insertInstructorPayoutPaymentLogs(
        int $instructorUserId,
        int $adminUserId,
        int $orderId,
        int $paymentId,
        string $invoiceNumber,
        string $payoutReference,
        string $paymentReference,
        string $entityTitle,
        float $salesAmount,
        float $payoutAmount,
        int $itemCount,
        array $bankSnapshot,
        ?string $ipAddress,
        ?string $browserInfo
    ): void {
        if (!Schema::hasTable('payment_logs')) {
            return;
        }

        $now = now();
        $logUserIds = collect([$adminUserId, $instructorUserId])
            ->filter(fn(int $userId): bool => $userId > 0)
            ->unique()
            ->values();

        foreach ($logUserIds as $logUserId) {
            DB::table('payment_logs')->insert($this->filterExistingColumns('payment_logs', [
                'userId' => $logUserId,
                'orderId' => $orderId,
                'paymentId' => $paymentId,
                'entityType' => 'Instructor Payout',
                'entityId' => $instructorUserId,
                'entityTitle' => $entityTitle,
                'totalFee' => $salesAmount,
                'amountPaid' => $payoutAmount,
                'amount' => $payoutAmount,
                'amountBalance' => 0,
                'paymentMode' => 'BANK_TRANSFER',
                'paymentBy' => 'BANK_TRANSFER',
                'paymentType' => self::INSTRUCTOR_PAYOUT_INVOICE_TYPE,
                'paymentStatus' => 'PAID',
                'invoiceNumber' => $invoiceNumber,
                'referenceNo' => $payoutReference,
                'transactionNo' => $paymentReference,
                'createdBy' => $adminUserId,
                'paymentFor' => 'INSTRUCTOR_PAYOUT',
                'remarks' => '40% instructor cut payout initiated to verified bank account.',
                'eventType' => self::INSTRUCTOR_PAYOUT_EVENT,
                'gateway' => 'bank_transfer',
                'status' => 'success',
                'requestPayload' => json_encode([
                    'instructorUserId' => $instructorUserId,
                    'commissionPercent' => self::INSTRUCTOR_PAYOUT_PERCENT,
                    'eligiblePurchaseCount' => $itemCount,
                ]),
                'responsePayload' => json_encode([
                    'payoutReference' => $payoutReference,
                    'invoiceNumber' => $invoiceNumber,
                    'salesAmount' => $salesAmount,
                    'payoutAmount' => $payoutAmount,
                    'bank' => $bankSnapshot,
                ]),
                'ipAddress' => $ipAddress,
                'browserInfo' => $browserInfo,
                'deletedFlag' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }

    private function payoutBankSnapshot(array $bankProfile): array
    {
        return [
            'accountHolderName' => $bankProfile['bankAccountHolderName'],
            'bankName' => $bankProfile['bankName'],
            'accountNumberMasked' => $bankProfile['bankAccountNumberMasked'],
            'ifscCode' => $bankProfile['bankIfscCode'],
            'accountType' => $bankProfile['bankAccountType'],
            'branchName' => $bankProfile['bankBranchName'],
            'verificationStatus' => $bankProfile['bankVerificationStatus'],
        ];
    }

    private function maskBankAccountNumber(?string $accountNumber): string
    {
        $normalized = trim((string) $accountNumber);

        if ($normalized === '') {
            return '';
        }

        $visibleDigits = substr($normalized, -4);
        $hiddenCount = max(strlen($normalized) - strlen($visibleDigits), 0);

        return str_repeat('*', $hiddenCount) . $visibleDigits;
    }

    private function hasInstructorPayoutSourceTables(): bool
    {
        foreach (['courses', 'orders', 'order_items', 'payments', 'users'] as $table) {
            if (!Schema::hasTable($table)) {
                return false;
            }
        }

        foreach ([
            'courses' => ['id', 'createdBy', 'deletedFlag'],
            'orders' => ['id', 'userId', 'status', 'deletedFlag'],
            'order_items' => ['id', 'orderId', 'courseId', 'price', 'deletedFlag'],
            'payments' => ['id', 'orderId', 'status', 'deletedFlag'],
        ] as $table => $columns) {
            foreach ($columns as $column) {
                if (!Schema::hasColumn($table, $column)) {
                    return false;
                }
            }
        }

        return true;
    }

    private function hasInstructorPayoutTables(): bool
    {
        return Schema::hasTable('instructor_payouts')
            && Schema::hasTable('instructor_payout_items');
    }

    private function reference(string $prefix): string
    {
        return $prefix . '-' . now()->format('YmdHis') . '-' . strtoupper(bin2hex(random_bytes(4)));
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

    public function locationLookupQuery()
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

    private function formatEmployee(object $employee, ?array $instructorPayoutSummary = null): array
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
            'instructorPayout' => $instructorPayoutSummary,
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

    private function normalizeBankVerificationStatus(?string $status): string
    {
        $normalizedStatus = trim((string) $status);

        foreach ([
            self::BANK_VERIFICATION_NOT_SUBMITTED,
            self::BANK_VERIFICATION_PENDING,
            self::BANK_VERIFICATION_VERIFIED,
            self::BANK_VERIFICATION_REJECTED,
        ] as $allowedStatus) {
            if (strcasecmp($normalizedStatus, $allowedStatus) === 0) {
                return $allowedStatus;
            }
        }

        return self::BANK_VERIFICATION_NOT_SUBMITTED;
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
