<?php

namespace App\Exceptions;

use Throwable;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;

use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Log;

class Handler extends ExceptionHandler
{
    public function render($request, Throwable $exception)
    {
        // ✅ Log all exceptions (important)
        Log::error('Exception Occurred', [
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
        ]);

        // ============================
        // 🔥 API RESPONSE
        // ============================
        if ($request->is('api/*') || $request->expectsJson()) {

            if ($exception instanceof ValidationException) {
                return response()->json([
                    'status' => false,
                    'message' => 'Validation failed',
                    'errors' => $exception->errors()
                ], 422);
            }

            if ($exception instanceof AuthenticationException) {
                return response()->json([
                    'status' => false,
                    'message' => 'Unauthorized'
                ], 401);
            }

            if ($exception instanceof ModelNotFoundException) {
                return response()->json([
                    'status' => false,
                    'message' => 'Resource not found'
                ], 404);
            }

            if ($exception instanceof HttpExceptionInterface) {
                return response()->json([
                    'status' => false,
                    'message' => $exception->getMessage() ?: 'HTTP error'
                ], $exception->getStatusCode());
            }

            return response()->json([
                'status' => false,
                'message' => config('app.debug')
                    ? $exception->getMessage()
                    : 'Something went wrong'
            ], 500);
        }

        // ============================
        // 🌐 WEB RESPONSE
        // ============================

        // 🔴 404 Page
        if (
            $exception instanceof ModelNotFoundException ||
            ($exception instanceof HttpExceptionInterface && $exception->getStatusCode() == 404)
        ) {

            return response()->view('errors.404', [], 404);
        }

        // 🔐 Unauthorized
        if ($exception instanceof AuthenticationException) {
            return redirect()->route('login')->with('error', 'Please login first');
        }

        // 🔒 Forbidden (403)
        if ($exception instanceof HttpExceptionInterface && $exception->getStatusCode() == 403) {
            return response()->view('errors.403', [], 403);
        }

        // 💥 General Error (500)
        return response()->view('errors.500', [
            'message' => config('app.debug') ? $exception->getMessage() : null
        ], 500);
    }
}
