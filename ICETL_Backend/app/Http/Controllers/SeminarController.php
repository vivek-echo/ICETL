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

class SeminarController extends Controller
{
    private const SCHEDULE_UPCOMING = 'upcoming';
    private const SCHEDULE_ONGOING = 'ongoing';
    private const SCHEDULE_COMPLETED = 'completed';

    public function createSeminar(Request $request)
    {
        if (!Schema::hasTable('seminars')) {
            return $this->missingTableResponse();
        }

        $validator = $this->validateSeminarPayload($request);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        if ($this->hasInvalidTimeRange($request)) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'endTime' => ['End time must be later than start time.']
                ]
            ], 422);
        }

        DB::beginTransaction();
        $bannerImagePath = null;

        try {
            $bannerImagePath = $this->storeBannerImage($request);
            $seminarId = DB::table('seminars')->insertGetId([
                ...$this->seminarPayload($request, $bannerImagePath),
                'createdBy' => (int) $user->id,
                'createdByRoleId' => $user->role ?? null,
                'deletedFlag' => 0,
                'createdOn' => now(),
                'updatedOn' => now(),
            ]);

            $seminarCode = EntityCodeService::assignIfMissing(
                'seminars',
                $seminarId,
                EntityCodeService::PREFIX_SEMINAR
            );

            DB::commit();

            return response()->json([
                'status' => true,
                'message' => 'Seminar created successfully',
                'data' => [
                    'id' => $seminarId,
                    'code' => $seminarCode,
                ]
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            $this->deleteBannerImage($bannerImagePath);
            Log::error('Error creating seminar: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function getMySeminars(Request $request)
    {
        return $this->getSeminarList($request, true, true);
    }

    public function getAllSeminars(Request $request)
    {
        return $this->getSeminarList($request, false, true);
    }

    public function getPublicSeminars(Request $request)
    {
        if (!Schema::hasTable('seminars')) {
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
            $query = $this->baseSeminarQuery()
                ->where('s.status', 1);

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

            $seminars = $this->applyPublicSort($query, (string) $request->input('sortBy', 'dateAsc'))
                ->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'status' => true,
                'message' => 'Public seminars fetched successfully',
                'data' => collect($seminars->items())
                    ->map(fn($seminar) => $this->formatPublicSeminar($seminar, $request))
                    ->values(),
                'meta' => [
                    'currentPage' => $seminars->currentPage(),
                    'perPage' => $isAllPageSize ? 'all' : $seminars->perPage(),
                    'total' => $seminars->total(),
                    'lastPage' => $seminars->lastPage(),
                    'from' => $seminars->firstItem(),
                    'to' => $seminars->lastItem(),
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching public seminars: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function getSeminarById(Request $request)
    {
        if (!Schema::hasTable('seminars')) {
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
            $seminar = $this->baseSeminarQuery()
                ->where('s.id', (int) $request->input('id'))
                ->where('s.createdBy', (int) $user->id)
                ->first();

            if (!$seminar) {
                return response()->json([
                    'status' => false,
                    'message' => 'Seminar not found'
                ], 404);
            }

            return response()->json([
                'status' => true,
                'message' => 'Seminar fetched successfully',
                'data' => $this->formatSeminar($seminar, $request),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching seminar: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function updateSeminar(Request $request)
    {
        if (!Schema::hasTable('seminars')) {
            return $this->missingTableResponse();
        }

        $validator = $this->validateSeminarPayload($request, true);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        if (!$user) {
            return $this->unauthenticatedResponse();
        }

        if ($this->hasInvalidTimeRange($request)) {
            return response()->json([
                'status' => false,
                'message' => 'Validation failed',
                'errors' => [
                    'endTime' => ['End time must be later than start time.']
                ]
            ], 422);
        }

        $bannerImagePath = null;

        try {
            $seminar = DB::table('seminars')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', (int) $user->id)
                ->where('deletedFlag', 0)
                ->first();

            if (!$seminar) {
                return response()->json([
                    'status' => false,
                    'message' => 'Seminar not found'
                ], 404);
            }

            if ($this->getScheduleStatus((string) ($seminar->eventDate ?? '')) === self::SCHEDULE_ONGOING) {
                return response()->json([
                    'status' => false,
                    'message' => 'Ongoing seminars cannot be edited.'
                ], 422);
            }

            $bannerImagePath = $this->storeBannerImage($request);
            $currentBannerImage = $seminar->bannerImage ?? null;

            DB::table('seminars')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', (int) $user->id)
                ->where('deletedFlag', 0)
                ->update([
                    ...$this->seminarPayload($request, $bannerImagePath),
                    'updatedOn' => now(),
                ]);

            if ($bannerImagePath) {
                $this->deleteBannerImage($currentBannerImage);
            }

            $seminarCode = EntityCodeService::assignIfMissing(
                'seminars',
                (int) $request->input('id'),
                EntityCodeService::PREFIX_SEMINAR
            );

            return response()->json([
                'status' => true,
                'message' => 'Seminar updated successfully',
                'data' => [
                    'id' => (int) $request->input('id'),
                    'code' => $seminarCode,
                ],
            ], 200);
        } catch (\Exception $e) {
            $this->deleteBannerImage($bannerImagePath);
            Log::error('Error updating seminar: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function updateSeminarStatus(Request $request)
    {
        if (!Schema::hasTable('seminars')) {
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
            $seminar = DB::table('seminars')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', (int) $user->id)
                ->where('deletedFlag', 0)
                ->first();

            if (!$seminar) {
                return response()->json([
                    'status' => false,
                    'message' => 'Seminar not found'
                ], 404);
            }

            if ($this->getScheduleStatus((string) ($seminar->eventDate ?? '')) === self::SCHEDULE_ONGOING) {
                return response()->json([
                    'status' => false,
                    'message' => 'Ongoing seminars cannot be activated or deactivated.'
                ], 422);
            }

            $updated = DB::table('seminars')
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
                    'message' => 'Seminar not found'
                ], 404);
            }

            return response()->json([
                'status' => true,
                'message' => 'Seminar status updated successfully'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error updating seminar status: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function deleteSeminar(Request $request)
    {
        if (!Schema::hasTable('seminars')) {
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
            $seminar = DB::table('seminars')
                ->where('id', (int) $request->input('id'))
                ->where('createdBy', (int) $user->id)
                ->where('deletedFlag', 0)
                ->first();

            if (!$seminar) {
                return response()->json([
                    'status' => false,
                    'message' => 'Seminar not found'
                ], 404);
            }

            if ($this->getScheduleStatus((string) ($seminar->eventDate ?? '')) === self::SCHEDULE_ONGOING) {
                return response()->json([
                    'status' => false,
                    'message' => 'Ongoing seminars cannot be deleted.'
                ], 422);
            }

            $updated = DB::table('seminars')
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
                    'message' => 'Seminar not found'
                ], 404);
            }

            return response()->json([
                'status' => true,
                'message' => 'Seminar deleted successfully'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error deleting seminar: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    private function getSeminarList(Request $request, bool $onlyMine, bool $paginate)
    {
        if (!Schema::hasTable('seminars')) {
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
            $query = $this->baseSeminarQuery();
            $summaryQuery = DB::table('seminars as s')->where('s.deletedFlag', 0);

            if ($onlyMine) {
                $query->where('s.createdBy', (int) $user->id);
                $summaryQuery->where('s.createdBy', (int) $user->id);
            }

            $this->applyFilters($query, $request);
            $summary = $this->buildSummary($summaryQuery);

            if (!$paginate) {
                $seminars = $this->applySort($query, (string) $request->input('sortBy', 'newest'))
                    ->get()
                    ->map(fn($seminar) => $this->formatSeminar($seminar, $request));

                return response()->json([
                    'status' => true,
                    'message' => 'Seminars fetched successfully',
                    'data' => $seminars,
                    'summary' => $summary,
                ], 200);
            }

            $page = (int) $request->input('page', 1);
            $isAllPageSize = $request->input('perPage') === 'all';
            $filteredTotal = (clone $query)->count();
            $perPage = $isAllPageSize
                ? max($filteredTotal, 1)
                : (int) $request->input('perPage', 10);

            $seminars = $this->applySort($query, (string) $request->input('sortBy', 'newest'))
                ->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'status' => true,
                'message' => 'All seminars fetched successfully',
                'data' => collect($seminars->items())
                    ->map(fn($seminar) => $this->formatSeminar($seminar, $request))
                    ->values(),
                'meta' => [
                    'currentPage' => $seminars->currentPage(),
                    'perPage' => $isAllPageSize ? 'all' : $seminars->perPage(),
                    'total' => $seminars->total(),
                    'lastPage' => $seminars->lastPage(),
                    'from' => $seminars->firstItem(),
                    'to' => $seminars->lastItem(),
                ],
                'summary' => $summary,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching seminars: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    private function baseSeminarQuery()
    {
        return DB::table('seminars as s')
            ->leftJoin('users as creator', 'creator.id', '=', 's.createdBy')
            ->where('s.deletedFlag', 0)
            ->select(
                's.id',
                EntityCodeService::codeSelect('seminars', 's'),
                's.title',
                's.topic',
                's.venue',
                's.city',
                's.eventDate',
                's.startTime',
                's.endTime',
                's.speakerName',
                's.capacity',
                's.price',
                's.description',
                's.takeaways',
                's.bannerImage',
                's.status',
                's.createdBy',
                'creator.name as createdByName',
                'creator.email as createdByEmail',
                's.createdOn',
                's.updatedOn'
            );
    }

    private function validateSeminarPayload(Request $request, bool $isUpdate = false)
    {
        $this->prepareTakeawaysForValidation($request);

        $rules = [
            'title' => ['required', 'string', 'min:5', 'max:120'],
            'topic' => ['required', 'string', 'min:3', 'max:120'],
            'venue' => ['required', 'string', 'min:3', 'max:150'],
            'city' => ['required', 'string', 'min:2', 'max:100'],
            'eventDate' => 'required|date|after_or_equal:today',
            'startTime' => 'required|date_format:H:i',
            'endTime' => 'nullable|date_format:H:i',
            'speakerName' => ['required', 'string', 'min:2', 'max:120'],
            'capacity' => 'required|integer|min:1',
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

    private function seminarPayload(Request $request, ?string $bannerImagePath = null): array
    {
        $takeaways = $this->normalizeTakeaways($request->input('takeaways', []));

        $payload = [
            'title' => trim((string) $request->input('title')),
            'topic' => trim((string) $request->input('topic')),
            'venue' => trim((string) $request->input('venue')),
            'city' => trim((string) $request->input('city')),
            'eventDate' => $request->input('eventDate'),
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
                $subQuery->where('s.title', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.topic', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.venue', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.city', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.speakerName', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.description', 'LIKE', '%' . $search . '%')
                    ->orWhere('creator.name', 'LIKE', '%' . $search . '%')
                    ->orWhere('creator.email', 'LIKE', '%' . $search . '%');
                EntityCodeService::orWhereCode($subQuery, 'seminars', 's.code', $search);
            });
        }

        if ($request->filled('city')) {
            $city = trim((string) $request->input('city'));
            $query->where('s.city', 'LIKE', '%' . $city . '%');
        }

        if ($request->input('status') !== null && $request->input('status') !== '') {
            $query->where('s.status', (int) $request->input('status'));
        }

        $scheduleStatus = (string) $request->input('scheduleStatus', '');

        if ($scheduleStatus !== '' && $scheduleStatus !== 'all') {
            $this->applyScheduleStatusFilter($query, $scheduleStatus);
        }
    }

    private function applySort($query, string $sortBy)
    {
        if ($sortBy === 'oldest') {
            return $query->orderBy('s.id', 'ASC');
        }

        if ($sortBy === 'dateAsc') {
            return $query->orderBy('s.eventDate', 'ASC')
                ->orderBy('s.startTime', 'ASC')
                ->orderBy('s.id', 'DESC');
        }

        if ($sortBy === 'dateDesc') {
            return $query->orderBy('s.eventDate', 'DESC')
                ->orderBy('s.startTime', 'DESC')
                ->orderBy('s.id', 'DESC');
        }

        return $query->orderBy('s.id', 'DESC');
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
            'totalSeminars' => (clone $summaryQuery)->count(),
            'activeSeminars' => (clone $summaryQuery)->where('s.status', 1)->count(),
            'inactiveSeminars' => (clone $summaryQuery)->where('s.status', 0)->count(),
            'upcomingSeminars' => $upcomingQuery->count(),
            'ongoingSeminars' => $ongoingQuery->count(),
            'completedSeminars' => $completedQuery->count(),
        ];
    }

    private function applyScheduleStatusFilter($query, string $scheduleStatus): void
    {
        $today = Carbon::today()->toDateString();

        if ($scheduleStatus === self::SCHEDULE_ONGOING) {
            $query->whereDate('s.eventDate', '=', $today);
            return;
        }

        if ($scheduleStatus === self::SCHEDULE_UPCOMING) {
            $query->whereDate('s.eventDate', '>', $today);
            return;
        }

        if ($scheduleStatus === self::SCHEDULE_COMPLETED) {
            $query->whereDate('s.eventDate', '<', $today);
        }
    }

    private function applyPublicActiveScheduleFilter($query): void
    {
        $query->whereDate('s.eventDate', '>=', Carbon::today()->toDateString());
    }

    private function applyPublicFilters($query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));

            $query->where(function ($subQuery) use ($search) {
                $subQuery->where('s.title', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.topic', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.venue', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.city', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.speakerName', 'LIKE', '%' . $search . '%')
                    ->orWhere('s.description', 'LIKE', '%' . $search . '%');
                EntityCodeService::orWhereCode($subQuery, 'seminars', 's.code', $search);
            });
        }

        if ($request->filled('city')) {
            $query->where('s.city', 'LIKE', '%' . trim((string) $request->input('city')) . '%');
        }
    }

    private function applyPublicScheduleStatusFilter($query, string $scheduleStatus): void
    {
        $today = Carbon::today()->toDateString();

        if ($scheduleStatus === 'ongoing') {
            $query->whereDate('s.eventDate', '=', $today);
            return;
        }

        if ($scheduleStatus === self::SCHEDULE_UPCOMING) {
            $query->whereDate('s.eventDate', '>', $today);
        }
    }

    private function applyPublicSort($query, string $sortBy)
    {
        if ($sortBy === 'latest') {
            return $query->orderBy('s.createdOn', 'DESC')
                ->orderBy('s.id', 'DESC');
        }

        if ($sortBy === 'dateDesc') {
            return $query->orderBy('s.eventDate', 'DESC')
                ->orderBy('s.startTime', 'DESC')
                ->orderBy('s.id', 'DESC');
        }

        $today = Carbon::today()->toDateString();

        return $query->orderByRaw(
            'CASE WHEN s.eventDate = ? THEN 0 ELSE 1 END',
            [$today]
        )
            ->orderBy('s.eventDate', 'ASC')
            ->orderBy('s.startTime', 'ASC')
            ->orderBy('s.id', 'DESC');
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

    private function formatSeminar(object $seminar, Request $request): array
    {
        $eventDate = $seminar->eventDate ? (string) $seminar->eventDate : '';
        $bannerImage = $seminar->bannerImage ? (string) $seminar->bannerImage : null;

        return [
            'id' => (int) $seminar->id,
            'code' => $seminar->code ?? null,
            'type' => 'seminar',
            'title' => (string) $seminar->title,
            'topic' => (string) $seminar->topic,
            'venue' => (string) $seminar->venue,
            'city' => (string) $seminar->city,
            'eventDate' => $eventDate,
            'startDate' => $eventDate,
            'endDate' => null,
            'startTime' => $this->formatTime($seminar->startTime ?? null),
            'endTime' => $this->formatTime($seminar->endTime ?? null),
            'speakerName' => (string) $seminar->speakerName,
            'capacity' => (int) ($seminar->capacity ?? 0),
            'price' => is_numeric($seminar->price) ? (float) $seminar->price : 0,
            'description' => (string) $seminar->description,
            'takeaways' => $this->decodeTakeaways($seminar->takeaways ?? null),
            'bannerImage' => $bannerImage,
            'bannerImageUrl' => $bannerImage ? $this->privateFileUrl($request, $bannerImage) : null,
            'status' => (int) $seminar->status,
            'statusLabel' => ((int) $seminar->status) === 1 ? 'Active' : 'Inactive',
            'scheduleStatus' => $this->getScheduleStatus($eventDate),
            'createdById' => $seminar->createdBy ? (int) $seminar->createdBy : null,
            'createdByName' => $seminar->createdByName ?: 'Unknown User',
            'createdByEmail' => $seminar->createdByEmail,
            'createdOn' => $seminar->createdOn,
            'updatedOn' => $seminar->updatedOn,
        ];
    }

    private function formatPublicSeminar(object $seminar, Request $request): array
    {
        $formatted = $this->formatSeminar($seminar, $request);

        $formatted['scheduleStatus'] = $this->getPublicScheduleStatus($formatted['eventDate']);

        return $formatted;
    }

    private function getScheduleStatus(string $eventDate): string
    {
        if ($eventDate && $eventDate < Carbon::today()->toDateString()) {
            return self::SCHEDULE_COMPLETED;
        }

        if ($eventDate === Carbon::today()->toDateString()) {
            return self::SCHEDULE_ONGOING;
        }

        return self::SCHEDULE_UPCOMING;
    }

    private function getPublicScheduleStatus(string $eventDate): string
    {
        return $eventDate === Carbon::today()->toDateString()
            ? 'ongoing'
            : self::SCHEDULE_UPCOMING;
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
            'program-banners/seminars',
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

    private function hasInvalidTimeRange(Request $request): bool
    {
        $startTime = (string) $request->input('startTime');
        $endTime = (string) $request->input('endTime');

        return $startTime !== '' && $endTime !== '' && $endTime <= $startTime;
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
            'message' => 'Seminar table not found. Please run database migrations.'
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
