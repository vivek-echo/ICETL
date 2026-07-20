<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class AdministrationService
{
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

    private function normalizeText(string $value): string
    {
        return trim((string) preg_replace('/\s+/', ' ', $value));
    }
}
