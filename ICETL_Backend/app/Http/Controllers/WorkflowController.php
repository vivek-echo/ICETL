<?php

namespace App\Http\Controllers;

use App\Services\WorkflowDataService;
use Illuminate\Http\Request;
use Throwable;

class WorkflowController extends Controller
{
    public function __construct(private readonly WorkflowDataService $workflowData)
    {
    }

    public function activity(Request $request)
    {
        try {
            return $this->success([
                'items' => $this->workflowData->activityFeed($request, (int) $request->query('limit', 20)),
            ], 'Activity feed fetched successfully.');
        } catch (Throwable) {
            return $this->error('Unable to fetch activity feed.');
        }
    }

    public function certificates(Request $request)
    {
        try {
            return $this->success([
                'items' => $this->workflowData->certificateHistory($request, (int) $request->query('limit', 20)),
            ], 'Certificate history fetched successfully.');
        } catch (Throwable) {
            return $this->error('Unable to fetch certificate history.');
        }
    }

    public function payments(Request $request)
    {
        try {
            return $this->success(
                $this->workflowData->paymentWorkflow($request, (int) $request->query('limit', 20)),
                'Payment workflow fetched successfully.'
            );
        } catch (Throwable) {
            return $this->error('Unable to fetch payment workflow.');
        }
    }

    public function materials(Request $request)
    {
        try {
            return $this->success([
                'items' => $this->workflowData->materialHistory($request, (int) $request->query('limit', 20)),
            ], 'Material history fetched successfully.');
        } catch (Throwable) {
            return $this->error('Unable to fetch material history.');
        }
    }

    private function success(array $data, string $message)
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ]);
    }

    private function error(string $message)
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], 500);
    }
}
