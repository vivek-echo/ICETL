<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ContactEnquiryController extends Controller
{
    private const MANAGER_ROLES = [1, 4];

    public function store(Request $request)
    {
        if (!Schema::hasTable('contact_enquiries')) {
            return $this->missingTableResponse();
        }

        $validator = Validator::make($request->all(), [
            'fullName' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:150'],
            'phone' => ['required', 'string', 'max:20', 'regex:/^[0-9+\-\s()]{7,20}$/'],
            'enquiryType' => [
                'required',
                'string',
                Rule::in([
                    'Course Guidance',
                    'Admission',
                    'Internship',
                    'Certification',
                    'Technical Support',
                    'Other',
                ]),
            ],
            'subject' => ['required', 'string', 'min:3', 'max:150'],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        try {
            DB::table('contact_enquiries')->insert([
                'fullName' => trim((string) $request->input('fullName')),
                'email' => strtolower(trim((string) $request->input('email'))),
                'phone' => trim((string) $request->input('phone')),
                'enquiryType' => trim((string) $request->input('enquiryType')),
                'subject' => trim((string) $request->input('subject')),
                'message' => trim((string) $request->input('message')),
                'isRead' => 0,
                'ipAddress' => $request->ip(),
                'browserInfo' => substr((string) $request->userAgent(), 0, 500),
                'deletedFlag' => 0,
                'createdOn' => now(),
                'updatedOn' => now(),
            ]);

            return response()->json([
                'status' => true,
                'message' => 'Enquiry submitted successfully. Our team will contact you shortly.',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error saving contact enquiry: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function index(Request $request)
    {
        if (!Schema::hasTable('contact_enquiries')) {
            return $this->missingTableResponse();
        }

        if (!$this->canManageEnquiries($request)) {
            return $this->unauthorizedResponse();
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
            'readStatus' => 'nullable|in:all,read,unread',
            'dateFrom' => 'nullable|date',
            'dateTo' => 'nullable|date|after_or_equal:dateFrom',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        try {
            $query = $this->baseQuery();
            $summaryQuery = DB::table('contact_enquiries')->where('deletedFlag', 0);

            $this->applyFilters($query, $request);

            $page = (int) $request->input('page', 1);
            $isAllPageSize = $request->input('perPage') === 'all';
            $filteredTotal = (clone $query)->count();
            $perPage = $isAllPageSize
                ? max($filteredTotal, 1)
                : (int) $request->input('perPage', 10);

            $enquiries = $query
                ->orderBy('ce.id', 'DESC')
                ->paginate($perPage, ['*'], 'page', $page);

            return response()->json([
                'status' => true,
                'message' => 'Enquiries fetched successfully',
                'data' => collect($enquiries->items())
                    ->map(fn($enquiry) => $this->formatEnquiry($enquiry))
                    ->values(),
                'meta' => [
                    'currentPage' => $enquiries->currentPage(),
                    'perPage' => $isAllPageSize ? 'all' : $enquiries->perPage(),
                    'total' => $enquiries->total(),
                    'lastPage' => $enquiries->lastPage(),
                    'from' => $enquiries->firstItem(),
                    'to' => $enquiries->lastItem(),
                ],
                'summary' => [
                    'totalEnquiries' => (clone $summaryQuery)->count(),
                    'unreadEnquiries' => (clone $summaryQuery)->where('isRead', 0)->count(),
                    'readEnquiries' => (clone $summaryQuery)->where('isRead', 1)->count(),
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching contact enquiries: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function unreadCount(Request $request)
    {
        if (!Schema::hasTable('contact_enquiries')) {
            return $this->missingTableResponse();
        }

        if (!$this->canManageEnquiries($request)) {
            return $this->unauthorizedResponse();
        }

        try {
            return response()->json([
                'status' => true,
                'message' => 'Unread enquiry count fetched successfully',
                'data' => [
                    'unreadCount' => DB::table('contact_enquiries')
                        ->where('deletedFlag', 0)
                        ->where('isRead', 0)
                        ->count(),
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error fetching unread enquiry count: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    public function markRead(Request $request)
    {
        if (!Schema::hasTable('contact_enquiries')) {
            return $this->missingTableResponse();
        }

        if (!$this->canManageEnquiries($request)) {
            return $this->unauthorizedResponse();
        }

        $validator = Validator::make($request->all(), [
            'markAll' => 'nullable|boolean',
            'ids' => 'required_without:markAll|array',
            'ids.*' => 'integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->validationResponse($validator);
        }

        $user = $request->user();

        try {
            $query = DB::table('contact_enquiries')
                ->where('deletedFlag', 0)
                ->where('isRead', 0);

            if (!$request->boolean('markAll')) {
                $ids = collect($request->input('ids', []))
                    ->map(fn($id) => (int) $id)
                    ->filter(fn($id) => $id > 0)
                    ->unique()
                    ->values()
                    ->all();

                $query->whereIn('id', $ids);
            }

            $updated = $query->update([
                'isRead' => 1,
                'readBy' => (int) $user->id,
                'readOn' => now(),
                'updatedOn' => now(),
            ]);

            return response()->json([
                'status' => true,
                'message' => 'Enquiry status updated successfully',
                'data' => [
                    'updated' => $updated,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Error marking contact enquiries as read: ' . $e->getMessage());

            return $this->exceptionResponse($e);
        }
    }

    private function baseQuery()
    {
        return DB::table('contact_enquiries as ce')
            ->leftJoin('users as reader', 'reader.id', '=', 'ce.readBy')
            ->where('ce.deletedFlag', 0)
            ->select(
                'ce.id',
                'ce.fullName',
                'ce.email',
                'ce.phone',
                'ce.enquiryType',
                'ce.subject',
                'ce.message',
                'ce.isRead',
                'ce.readBy',
                'reader.name as readByName',
                'ce.readOn',
                'ce.ipAddress',
                'ce.createdOn',
                'ce.updatedOn'
            );
    }

    private function applyFilters($query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));

            $query->where(function ($subQuery) use ($search) {
                $subQuery->where('ce.fullName', 'LIKE', '%' . $search . '%')
                    ->orWhere('ce.email', 'LIKE', '%' . $search . '%')
                    ->orWhere('ce.phone', 'LIKE', '%' . $search . '%')
                    ->orWhere('ce.enquiryType', 'LIKE', '%' . $search . '%')
                    ->orWhere('ce.subject', 'LIKE', '%' . $search . '%')
                    ->orWhere('ce.message', 'LIKE', '%' . $search . '%');
            });
        }

        $readStatus = (string) $request->input('readStatus', 'all');

        if ($readStatus === 'read') {
            $query->where('ce.isRead', 1);
        }

        if ($readStatus === 'unread') {
            $query->where('ce.isRead', 0);
        }

        if ($request->filled('dateFrom')) {
            $query->whereDate('ce.createdOn', '>=', $request->input('dateFrom'));
        }

        if ($request->filled('dateTo')) {
            $query->whereDate('ce.createdOn', '<=', $request->input('dateTo'));
        }
    }

    private function formatEnquiry(object $enquiry): array
    {
        $isRead = (int) $enquiry->isRead === 1;

        return [
            'id' => (int) $enquiry->id,
            'fullName' => (string) $enquiry->fullName,
            'email' => (string) $enquiry->email,
            'phone' => (string) $enquiry->phone,
            'enquiryType' => (string) $enquiry->enquiryType,
            'subject' => (string) $enquiry->subject,
            'message' => (string) $enquiry->message,
            'isRead' => $isRead,
            'statusLabel' => $isRead ? 'Read' : 'New',
            'readBy' => $enquiry->readBy ? (int) $enquiry->readBy : null,
            'readByName' => $enquiry->readByName,
            'readOn' => $enquiry->readOn,
            'ipAddress' => $enquiry->ipAddress,
            'createdOn' => $enquiry->createdOn,
            'updatedOn' => $enquiry->updatedOn,
        ];
    }

    private function canManageEnquiries(Request $request): bool
    {
        $user = $request->user();

        return $user && in_array((int) $user->role, self::MANAGER_ROLES, true);
    }

    private function validationResponse($validator)
    {
        return response()->json([
            'status' => false,
            'message' => 'Validation failed',
            'errors' => $validator->errors(),
        ], 422);
    }

    private function unauthorizedResponse()
    {
        return response()->json([
            'status' => false,
            'message' => 'Only admin and ICETL team users can manage enquiries.',
        ], 403);
    }

    private function missingTableResponse()
    {
        return response()->json([
            'status' => false,
            'message' => 'Contact enquiry table not found. Please run the provided MySQL query.',
        ], 500);
    }

    private function exceptionResponse(\Exception $e)
    {
        return response()->json([
            'status' => false,
            'message' => 'Something went wrong',
            'error' => $e->getMessage(),
        ], 500);
    }
}
