<?php

namespace App\Exceptions;

use Throwable;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;

use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class Handler extends ExceptionHandler
{
    public function render($request, Throwable $exception)
    {
        // Force JSON for API
        if ($request->is('api/*') || $request->expectsJson()) {

            // 🔴 Validation Error
            if ($exception instanceof ValidationException) {
                return response()->json([
                    'status' => false,
                    'message' => 'Validation failed',
                    'errors' => $exception->errors()
                ], 422);
            }

            // 🔐 Unauthorized
            if ($exception instanceof AuthenticationException) {
                return response()->json([
                    'status' => false,
                    'message' => 'Unauthorized'
                ], 401);
            }

            // 🔍 Model not found
            if ($exception instanceof ModelNotFoundException) {
                return response()->json([
                    'status' => false,
                    'message' => 'Resource not found'
                ], 404);
            }

            // 🌐 HTTP exceptions (404, 403, etc.)
            if ($exception instanceof HttpExceptionInterface) {
                return response()->json([
                    'status' => false,
                    'message' => $exception->getMessage() ?: 'HTTP error'
                ], $exception->getStatusCode());
            }

            // 💥 General error
            return response()->json([
                'status' => false,
                'message' => config('app.debug')
                    ? $exception->getMessage()
                    : 'Something went wrong'
            ], 500);
        }

        return parent::render($request, $exception);
    }

    protected function unauthenticated($request, AuthenticationException $exception)
    {
        if ($request->is('api/*') || $request->expectsJson()) {
            return response()->json([
                'status' => false,
                'message' => 'Unauthenticated'
            ], 401);
        }

        // fallback (not really needed for API, but safe)
        return redirect()->guest(route('login'));
    }
}
