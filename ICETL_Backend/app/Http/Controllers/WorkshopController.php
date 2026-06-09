<?php

namespace App\Http\Controllers;

use App\Services\EntityCodeService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class WorkshopController extends Controller
{
    private const SCHEDULE_UPCOMING = 'upcoming';
    private const SCHEDULE_ONGOING = 'ongoing';
    private const SCHEDULE_COMPLETED = 'completed';

    public function createWorkshop(Request $request)
    {
        if (!Schema::hasTable('workshops')) {
            return $this->missingTableResponse();
        }

        $validator = $this->validateWorkshopPayload($request);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        if ($this->hasInvalidSameDayTimeRange($request)) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'endTime' => ['End time must be later than start time for a same-day workshop.']
                ]
            ], 422);
        }

        DB::beginTransaction();
        $bannerImagePath = null;

        try {
            $bannerImagePath = $this->storeBannerImage($request);
            $workshopId = DB::table('workshops')->insertGetId([
                ...$this->workshopPayload($request, $bannerImagePath),
                'createdBy' => (int) $user->id,
                'createdByRoleId' => $user->role ?? null,
                'deletedFlag' => 0,
                'createdOn' => now(),
                'updatedOn' => now(),
            ]);

            $workshopCode = EntityCodeService::assignIfMissing(
                'workshops',
                $workshopId,
                EntityCodeService::PREFIX_WORKSHOP
            );

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Workshop created successfully',
                'data' => [
                    'id' => $workshopId,
                    'code' => $workshopCode,
                ]
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            $this->deleteBannerImage($bannerImagePath);
            Log::error('Error creating workshop: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function getMyWorkshops(Request $request)
    {
        return $this->getWorkshopList($request, true, true);
    }

    public function getAllWorkshops(Request $request)
    {
        return $this->getWorkshopList($request, false, true);
    }

    public function getPublicWorkshops(Request $request)
    {
        if (!Schema::hasTable('workshops')) {
            return $this->missingTableResponse();
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
            'search' => 'nullable|string|max:100',
            'city' => 'nullable|string|max:100',
            'scheduleStatus' => 'nullable|in:all,upcoming,ongoing',
            'sortBy' => 'nullable|in:latest,dateAsc,dateDesc',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        try {
            $query = $this->baseWorkshopQuery()
                ->where('w.status', 1);

            $this->applyPublicActiveScheduleFilter($query);
            $this->applyPublicFilters($query, $request);

            $scheduleStatus = (string) $request->input('scheduleStatus', 'all');

            if ($scheduleStatus !== '' && $scheduleStatus !== 'all') {
                $this->applyPublicScheduleStatusFilter($query, $scheduleStatus);
            }

            $isAllPageSize = $request->input('perPage') === 'all';
            $filteredTotal = (clone $query)->count();
            $page = $isAllPageSize ? 1 : (int) $request->input('page', 1);
            $perPage = $isAllPageSize
                ? max($filteredTotal, 1)
                : (int) $request->input('perPage', 10);

            $workshops = $this->applyPublicSort($query, (string) $request->input('sortBy', 'dateAsc'))
                ->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'status' => true,
                'message' => 'Public workshops fetched successfully',
                'data' => collect($workshops->items())
                    ->map(fn($workshop) => $this->formatPublicWorkshop($workshop, $request))
                    ->values(),
                'meta' => [
                    'currentPage' => $workshops->currentPage(),
                    'perPage' => $isAllPageSize ? 'all' : $workshops->perPage(),
                    'total' => $workshops->total(),
                    'lastPage' => $workshops->lastPage(),
                    'from' => $workshops->firstItem(),
                    'to' => $workshops->lastItem(),
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching public workshops: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function getWorkshopById(Request $request)
    {
        if (!Schema::hasTable('workshops')) {
            return $this->missingTableResponse();
        }

        $validator = Validator::make($request->all(), [
            'id' => 'required|integer'
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        try {
            $workshop = $this->baseWorkshopQuery()
                ->where('w.id', (int) $request->input('id'))
                ->where('w.createdBy', (int) $user->id)
                ->first();

            if (!$workshop) {
                return response()->json([
                    'status' => false,
                    'message' => 'Workshop not found'
                ], 404);
            }

            return response()->json([
                'status' => true,
                'message' => 'Workshop fetched successfully',
                'data' => $this->formatWorkshop($workshop, $request),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching workshop: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function updateWorkshop(Request $request)
    {
        if (!Schema::hasTable('workshops')) {
            return $this->missingTableResponse();
        }

        $validator = $this->validateWorkshopPayload($request, true);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        if ($this->hasInvalidSameDayTimeRange($request)) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'endTime' => ['End time must be later than start time for a same-day workshop.']
                ]
            ], 422);
        }

        $bannerImagePath = null;

        try {
            $workshop = DB::table('workshops')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', (int) $user->id)
                ->where('deletedFlag', 0)
                ->first();

            if (!$workshop) {
                return response()->json([
                    'status' => false,
                    'message' => 'Workshop not found'
                ], 404);
            }

            if ($this->getScheduleStatus((string) ($workshop->startDate ?? ''), $workshop->endDate ? (string) $workshop->endDate : null) === self::SCHEDULE_ONGOING) {
                return response()->json([
                    'status' => false,
                    'message' => 'Ongoing workshops cannot be edited.'
                ], 422);
            }

            $bannerImagePath = $this->storeBannerImage($request);
            $currentBannerImage = $workshop->bannerImage ?? null;

            DB::table('workshops')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', (int) $user->id)
                ->where('deletedFlag', 0)
                ->update([
                    ...$this->workshopPayload($request, $bannerImagePath),
                    'updatedOn' => now(),
                ]);

            if ($bannerImagePath) {
                $this->deleteBannerImage($currentBannerImage);
            }

            $workshopCode = EntityCodeService::assignIfMissing(
                'workshops',
                (int) $request->input('id'),
                EntityCodeService::PREFIX_WORKSHOP
            );

            return response()->json([
                'status' => true,
                'message' => 'Workshop updated successfully',
                'data' => [
                    'id' => (int) $request->input('id'),
                    'code' => $workshopCode,
                ],
            ], 200);
        } catch (\Exception $e) {
            $this->deleteBannerImage($bannerImagePath);
            Log::error('Error updating workshop: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function updateWorkshopStatus(Request $request)
    {
        if (!Schema::hasTable('workshops')) {
            return $this->missingTableResponse();
        }

        $validator = Validator::make($request->all(), [
            'id' => 'required|integer',
            'status' => 'required|in:0,1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        try {
            $workshop = DB::table('workshops')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', (int) $user->id)
                ->where('deletedFlag', 0)
                ->first();

            if (!$workshop) {
                return response()->json([
                    'status' => false,
                    'message' => 'Workshop not found'
                ], 404);
            }

            if ($this->getScheduleStatus((string) ($workshop->startDate ?? ''), $workshop->endDate ? (string) $workshop->endDate : null) === self::SCHEDULE_ONGOING) {
                return response()->json([
                    'status' => false,
                    'message' => 'Ongoing workshops cannot be activated or deactivated.'
                ], 422);
            }

            $updated = DB::table('workshops')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', (int) $user->id)
                ->where('deletedFlag', 0)
                ->update([
                    'status' => (int) $request->input('status'),
                    'updatedOn' => now(),
                ]);

            if (!$updated) {
                return response()->json([
                    'status' => false,
                    'message' => 'Workshop not found'
                ], 404);
            }

            return response()->json([
                'status' => true,
                'message' => 'Workshop status updated successfully'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating workshop status: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function deleteWorkshop(Request $request)
    {
        if (!Schema::hasTable('workshops')) {
            return $this->missingTableResponse();
        }

        $validator = Validator::make($request->all(), [
            'id' => 'required|integer'
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        try {
            $workshop = DB::table('workshops')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', (int) $user->id)
                ->where('deletedFlag', 0)
                ->first();

            if (!$workshop) {
                return response()->json([
                    'status' => false,
                    'message' => 'Workshop not found'
                ], 404);
            }

            if ($this->getScheduleStatus((string) ($workshop->startDate ?? ''), $workshop->endDate ? (string) $workshop->endDate : null) === self::SCHEDULE_ONGOING) {
                return response()->json([
                    'status' => false,
                    'message' => 'Ongoing workshops cannot be deleted.'
                ], 422);
            }

            $updated = DB::table('workshops')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', (int) $user->id)
                ->where('deletedFlag', 0)
                ->update([
                    'deletedFlag' => 1,
                    'updatedOn' => now(),
                ]);

            if (!$updated) {
                return response()->json([
                    'status' => false,
                    'message' => 'Workshop not found'
                ], 404);
            }

            return response()->json([
                'status' => true,
                'message' => 'Workshop deleted successfully'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error deleting workshop: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    private function getWorkshopList(Request $request, bool $onlyMine, bool $paginate)
    {
        if (!Schema::hasTable('workshops')) {
            return $this->missingTableResponse();
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
            'search' => 'nullable|string|max:100',
            'city' => 'nullable|string|max:100',
            'status' => 'nullable|in:0,1',
            'scheduleStatus' => 'nullable|in:all,upcoming,ongoing,completed',
            'sortBy' => 'nullable|in:newest,oldest,dateAsc,dateDesc',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        try {
            $query = $this->baseWorkshopQuery();
            $summaryQuery = DB::table('workshops as w')->where('w.deletedFlag', 0);

            if ($onlyMine) {
                $query->where('w.createdBy', (int) $user->id);
                $summaryQuery->where('w.createdBy', (int) $user->id);
            }

            $this->applyFilters($query, $request);
            $summary = $this->buildSummary($summaryQuery);

            if (!$paginate) {
                $workshops = $this->applySort($query, (string) $request->input('sortBy', 'newest'))
                    ->get()
                    ->map(fn($workshop) => $this->formatWorkshop($workshop, $request));

                return response()->json([
                    'status' => true,
                    'message' => 'Workshops fetched successfully',
                    'data' => $workshops,
                    'summary' => $summary,
                ], 200);
            }

            $page = (int) $request->input('page', 1);
            $isAllPageSize = $request->input('perPage') === 'all';
            $filteredTotal = (clone $query)->count();
            $perPage = $isAllPageSize
                ? max($filteredTotal, 1)
                : (int) $request->input('perPage', 10);

            $workshops = $this->applySort($query, (string) $request->input('sortBy', 'newest'))
                ->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'status' => true,
                'message' => 'All workshops fetched successfully',
                'data' => collect($workshops->items())
                    ->map(fn($workshop) => $this->formatWorkshop($workshop, $request))
                    ->values(),
                'meta' => [
                    'currentPage' => $workshops->currentPage(),
                    'perPage' => $isAllPageSize ? 'all' : $workshops->perPage(),
                    'total' => $workshops->total(),
                    'lastPage' => $workshops->lastPage(),
                    'from' => $workshops->firstItem(),
                    'to' => $workshops->lastItem(),
                ],
                'summary' => $summary,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching workshops: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    private function baseWorkshopQuery()
    {
        return DB::table('workshops as w')
            ->leftJoin('users as creator', 'creator.id', '=', 'w.createdBy')
            ->where('w.deletedFlag', 0)
            ->select(
                'w.id',
                EntityCodeService::codeSelect('workshops', 'w'),
                'w.title',
                'w.topic',
                'w.venue',
                'w.city',
                'w.startDate',
                'w.endDate',
                'w.startTime',
                'w.endTime',
                'w.speakerName',
                'w.capacity',
                'w.price',
                'w.description',
                'w.takeaways',
                'w.bannerImage',
                'w.status',
                'w.createdBy',
                'creator.name as createdByName',
                'creator.email as createdByEmail',
                'w.createdOn',
                'w.updatedOn'
            );
    }

    private function validateWorkshopPayload(Request $request, bool $isUpdate = false)
    {
        $this->prepareTakeawaysForValidation($request);

        $rules = [
            'title' => ['required', 'string', 'min:5', 'max:120'],
            'topic' => ['required', 'string', 'min:3', 'max:120'],
            'venue' => ['required', 'string', 'min:3', 'max:150'],
            'city' => ['required', 'string', 'min:2', 'max:100'],
            'startDate' => 'required|date',
            'endDate' => 'required|date|after_or_equal:startDate',
            'startTime' => 'required|date_format:H:i',
            'endTime' => 'nullable|date_format:H:i',
            'speakerName' => ['required', 'string', 'min:2', 'max:120'],
            'capacity' => 'nullable|integer|min:0',
            'price' => 'required|numeric|min:0',
            'description' => ['required', 'string', 'min:20', 'max:300'],
            'takeaways' => 'nullable|array',
            'takeaways.*' => 'string|max:255',
            'bannerImage' => 'nullable|image|mimes:png,jpg,jpeg,webp|max:4096',
            'status' => 'required|in:0,1',
        ];

        if ($isUpdate) {
            $rules['id'] = 'required|integer';
        }

        return Validator::make($request->all(), $rules);
    }

    private function workshopPayload(Request $request, ?string $bannerImagePath = null): array
    {
        $takeaways = $this->normalizeTakeaways($request->input('takeaways', []));

        $payload = [
            'title' => trim((string) $request->input('title')),
            'topic' => trim((string) $request->input('topic')),
            'venue' => trim((string) $request->input('venue')),
            'city' => trim((string) $request->input('city')),
            'startDate' => $request->input('startDate'),
            'endDate' => $request->input('endDate') ?: null,
            'startTime' => $request->input('startTime'),
            'endTime' => $request->input('endTime') ?: null,
            'speakerName' => trim((string) $request->input('speakerName')),
            'capacity' => (int) $request->input('capacity', 0),
            'price' => $request->input('price'),
            'description' => trim((string) $request->input('description')),
            'takeaways' => !empty($takeaways) ? json_encode($takeaways) : null,
            'status' => (int) $request->input('status'),
        ];

        if ($bannerImagePath) {
            $payload['bannerImage'] = $bannerImagePath;
        }

        return $payload;
    }

    private function applyFilters($query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));

            $query->where(function ($subQuery) use ($search) {
                $subQuery->where('w.title', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.topic', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.venue', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.city', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.speakerName', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.description', 'LIKE', '%' . $search . '%')
                    ->orWhere('creator.name', 'LIKE', '%' . $search . '%')
                    ->orWhere('creator.email', 'LIKE', '%' . $search . '%');
                EntityCodeService::orWhereCode($subQuery, 'workshops', 'w.code', $search);
            });
        }

        if ($request->filled('city')) {
            $city = trim((string) $request->input('city'));
            $query->where('w.city', 'LIKE', '%' . $city . '%');
        }

        if ($request->input('status') !== null && $request->input('status') !== '') {
            $query->where('w.status', (int) $request->input('status'));
        }

        $scheduleStatus = (string) $request->input('scheduleStatus', '');

        if ($scheduleStatus !== '' && $scheduleStatus !== 'all') {
            $this->applyScheduleStatusFilter($query, $scheduleStatus);
        }
    }

    private function applySort($query, string $sortBy)
    {
        if ($sortBy === 'oldest') {
            return $query->orderBy('w.id', 'ASC');
        }

        if ($sortBy === 'dateAsc') {
            return $query->orderBy('w.startDate', 'ASC')
                ->orderBy('w.startTime', 'ASC')
                ->orderBy('w.id', 'DESC');
        }

        if ($sortBy === 'dateDesc') {
            return $query->orderBy('w.startDate', 'DESC')
                ->orderBy('w.startTime', 'DESC')
                ->orderBy('w.id', 'DESC');
        }

        return $query->orderBy('w.id', 'DESC');
    }

    private function buildSummary($summaryQuery): array
    {
        $upcomingQuery = clone $summaryQuery;
        $ongoingQuery = clone $summaryQuery;
        $completedQuery = clone $summaryQuery;

        $this->applyScheduleStatusFilter($upcomingQuery, self::SCHEDULE_UPCOMING);
        $this->applyScheduleStatusFilter($ongoingQuery, self::SCHEDULE_ONGOING);
        $this->applyScheduleStatusFilter($completedQuery, self::SCHEDULE_COMPLETED);

        return [
            'totalWorkshops' => (clone $summaryQuery)->count(),
            'activeWorkshops' => (clone $summaryQuery)->where('w.status', 1)->count(),
            'inactiveWorkshops' => (clone $summaryQuery)->where('w.status', 0)->count(),
            'upcomingWorkshops' => $upcomingQuery->count(),
            'ongoingWorkshops' => $ongoingQuery->count(),
            'completedWorkshops' => $completedQuery->count(),
        ];
    }

    private function applyScheduleStatusFilter($query, string $scheduleStatus): void
    {
        $today = Carbon::today()->toDateString();
        $dateExpression = DB::raw('COALESCE(w.endDate, w.startDate)');

        if ($scheduleStatus === self::SCHEDULE_ONGOING) {
            $query->whereDate('w.startDate', '<=', $today)
                ->whereDate($dateExpression, '>=', $today);
            return;
        }

        if ($scheduleStatus === self::SCHEDULE_UPCOMING) {
            $query->whereDate('w.startDate', '>', $today);
            return;
        }

        if ($scheduleStatus === self::SCHEDULE_COMPLETED) {
            $query->whereDate($dateExpression, '<', $today);
        }
    }

    private function applyPublicActiveScheduleFilter($query): void
    {
        $today = Carbon::today()->toDateString();
        $dateExpression = DB::raw('COALESCE(w.endDate, w.startDate)');

        $query->whereDate($dateExpression, '>=', $today);
    }

    private function applyPublicFilters($query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));

            $query->where(function ($subQuery) use ($search) {
                $subQuery->where('w.title', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.topic', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.venue', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.city', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.speakerName', 'LIKE', '%' . $search . '%')
                    ->orWhere('w.description', 'LIKE', '%' . $search . '%');
                EntityCodeService::orWhereCode($subQuery, 'workshops', 'w.code', $search);
            });
        }

        if ($request->filled('city')) {
            $query->where('w.city', 'LIKE', '%' . trim((string) $request->input('city')) . '%');
        }
    }

    private function applyPublicScheduleStatusFilter($query, string $scheduleStatus): void
    {
        $today = Carbon::today()->toDateString();
        $dateExpression = DB::raw('COALESCE(w.endDate, w.startDate)');

        if ($scheduleStatus === 'ongoing') {
            $query->whereDate('w.startDate', '<=', $today)
                ->whereDate($dateExpression, '>=', $today);
            return;
        }

        if ($scheduleStatus === self::SCHEDULE_UPCOMING) {
            $query->whereDate('w.startDate', '>', $today);
        }
    }

    private function applyPublicSort($query, string $sortBy)
    {
        if ($sortBy === 'latest') {
            return $query->orderBy('w.createdOn', 'DESC')
                ->orderBy('w.id', 'DESC');
        }

        if ($sortBy === 'dateDesc') {
            return $query->orderBy('w.startDate', 'DESC')
                ->orderBy('w.startTime', 'DESC')
                ->orderBy('w.id', 'DESC');
        }

        $today = Carbon::today()->toDateString();

        return $query->orderByRaw(
            'CASE WHEN w.startDate <= ? AND COALESCE(w.endDate, w.startDate) >= ? THEN 0 ELSE 1 END',
            [$today, $today]
        )
            ->orderBy('w.startDate', 'ASC')
            ->orderBy('w.startTime', 'ASC')
            ->orderBy('w.id', 'DESC');
    }

    private function prepareTakeawaysForValidation(Request $request): void
    {
        if (!$request->has('takeaways')) {
            return;
        }

        $request->merge([
            'takeaways' => $this->normalizeTakeaways($request->input('takeaways'))
        ]);
    }

    private function normalizeTakeaways(mixed $value): array
    {
        $decodedValue = $value;

        if (is_string($decodedValue)) {
            $decodedValue = json_decode($decodedValue, true);
        }

        if (!is_array($decodedValue)) {
            return [];
        }

        return collect($decodedValue)
            ->filter(fn($item) => is_string($item) || is_numeric($item))
            ->map(fn($item) => trim((string) $item))
            ->filter(fn($item) => $item !== '')
            ->values()
            ->all();
    }

    private function decodeTakeaways(?string $takeaways): array
    {
        if (!$takeaways) {
            return [];
        }

        $decoded = json_decode($takeaways, true);

        return is_array($decoded) ? $this->normalizeTakeaways($decoded) : [];
    }

    private function formatWorkshop(object $workshop, Request $request): array
    {
        $startDate = $workshop->startDate ? (string) $workshop->startDate : '';
        $endDate = $workshop->endDate ? (string) $workshop->endDate : null;
        $bannerImage = $workshop->bannerImage ? (string) $workshop->bannerImage : null;

        return [
            'id' => (int) $workshop->id,
            'code' => $workshop->code ?? null,
            'type' => 'workshop',
            'title' => (string) $workshop->title,
            'topic' => (string) $workshop->topic,
            'venue' => (string) $workshop->venue,
            'city' => (string) $workshop->city,
            'eventDate' => $startDate,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'startTime' => $this->formatTime($workshop->startTime ?? null),
            'endTime' => $this->formatTime($workshop->endTime ?? null),
            'speakerName' => (string) $workshop->speakerName,
            'capacity' => (int) ($workshop->capacity ?? 0),
            'price' => is_numeric($workshop->price) ? (float) $workshop->price : 0,
            'description' => (string) $workshop->description,
            'takeaways' => $this->decodeTakeaways($workshop->takeaways ?? null),
            'bannerImage' => $bannerImage,
            'bannerImageUrl' => $bannerImage ? $this->privateFileUrl($request, $bannerImage) : null,
            'status' => (int) $workshop->status,
            'statusLabel' => ((int) $workshop->status) === 1 ? 'Active' : 'Inactive',
            'scheduleStatus' => $this->getScheduleStatus($startDate, $endDate),
            'createdById' => $workshop->createdBy ? (int) $workshop->createdBy : null,
            'createdByName' => $workshop->createdByName ?: 'Unknown User',
            'createdByEmail' => $workshop->createdByEmail,
            'createdOn' => $workshop->createdOn,
            'updatedOn' => $workshop->updatedOn,
        ];
    }

    private function formatPublicWorkshop(object $workshop, Request $request): array
    {
        $formatted = $this->formatWorkshop($workshop, $request);

        $formatted['scheduleStatus'] = $this->getPublicScheduleStatus(
            $formatted['startDate'],
            $formatted['endDate']
        );

        return $formatted;
    }

    private function getScheduleStatus(string $startDate, ?string $endDate): string
    {
        $lastWorkshopDate = $endDate ?: $startDate;

        if ($lastWorkshopDate && $lastWorkshopDate < Carbon::today()->toDateString()) {
            return self::SCHEDULE_COMPLETED;
        }

        if ($startDate && $startDate <= Carbon::today()->toDateString()) {
            return self::SCHEDULE_ONGOING;
        }

        return self::SCHEDULE_UPCOMING;
    }

    private function getPublicScheduleStatus(string $startDate, ?string $endDate): string
    {
        $today = Carbon::today()->toDateString();
        $lastWorkshopDate = $endDate ?: $startDate;

        if ($startDate && $startDate <= $today && $lastWorkshopDate >= $today) {
            return 'ongoing';
        }

        return self::SCHEDULE_UPCOMING;
    }

    private function formatTime(?string $value): ?string
    {
        $time = trim((string) ($value ?? ''));

        return $time === '' ? null : substr($time, 0, 5);
    }

    private function storeBannerImage(Request $request): ?string
    {
        if (!$request->hasFile('bannerImage')) {
            return null;
        }

        $file = $request->file('bannerImage');
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'jpg');

        return $file->storeAs(
            'program-banners/workshops',
            Str::uuid() . '.' . $extension,
            'private'
        );
    }

    private function deleteBannerImage(?string $path): void
    {
        if ($path && Storage::disk('private')->exists($path)) {
            Storage::disk('private')->delete($path);
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

    private function hasInvalidSameDayTimeRange(Request $request): bool
    {
        $startDate = (string) $request->input('startDate');
        $endDate = (string) ($request->input('endDate') ?: $startDate);
        $startTime = (string) $request->input('startTime');
        $endTime = (string) $request->input('endTime');

        return $startDate !== ''
            && $startDate === $endDate
            && $startTime !== ''
            && $endTime !== ''
            && $endTime <= $startTime;
    }

    private function validationResponse($validator)
    {
        return response()->json([
            'status' => false,
            'message' => 'Validation failed',
            'errors' => $validator->errors()
        ], 422);
    }

    private function unauthenticatedResponse()
    {
        return response()->json([
            'status' => false,
            'message' => 'Unauthenticated'
        ], 401);
    }

    private function missingTableResponse()
    {
        return response()->json([
            'status' => false,
            'message' => 'Workshop table not found. Please run database migrations.'
        ], 500);
    }

    private function exceptionResponse(\Exception $e)
    {
        return response()->json([
            'status' => false,
            'message' => 'Something went wrong',
            'error' => $e->getMessage()
        ], 500);
    }
}
