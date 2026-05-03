<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/


Route::middleware(['auth:sanctum'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/debug', [AuthController::class, 'debug']);
});


Route::post('/login', [AuthController::class, 'login']);
Route::post('/check',function(){
    return response()->json([
        'check'=>true
        ]);
});
Route::post('/sendOtp', [AuthController::class, 'sendOtp']);
Route::post('/verifyOtp', [AuthController::class, 'verifyOtp']);
Route::post('/completeProfile', [AuthController::class, 'completeProfile']);
