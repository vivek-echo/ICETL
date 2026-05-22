<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\InstructorRegistrationController;
use App\Http\Controllers\UserProfileController;
use App\Http\Controllers\CoursesController;
use App\Http\Controllers\CommonController;
use App\Http\Controllers\CartController;
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
    Route::post('/check', function () {
        return response()->json([
            'check' => true
        ]);
    });

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user-profile', [UserProfileController::class, 'show']);
    Route::post('/user-profile', [UserProfileController::class, 'update']);
    Route::post('/instructors/account-information', [InstructorRegistrationController::class, 'saveAccountInformation']);
    Route::post('/instructors/professional-information', [InstructorRegistrationController::class, 'saveProfessionalInformation']);
    Route::post('/instructors/skills-and-categories', [InstructorRegistrationController::class, 'saveSkillsAndCategories']);
    Route::post('/instructors/documents-and-social-links', [InstructorRegistrationController::class, 'saveDocumentsAndSocialLinks']);
    Route::post('/instructors/complete-onboarding', [InstructorRegistrationController::class, 'completeInstructorOnboarding']);
    Route::get('/instructors/profile', [InstructorRegistrationController::class, 'getInstructorProfile']);

    // course category routes
    Route::post('/addCourseCategory', [CoursesController::class, 'addCourseCategory']);

    Route::post('/updateCourseCategory', [CoursesController::class, 'updateCourseCategory']);
    Route::post('/deleteCourseCategory', [CoursesController::class, 'deleteCourseCategory']);
    Route::post('/getCourseCategories', [CoursesController::class, 'getCourseCategories']);
    Route::post('/createCourse', [CoursesController::class, 'createCourse']);
    Route::post('/getCourses', [CoursesController::class, 'getCourses']);
    Route::post('/getAllCourses', [CoursesController::class, 'getAllCourses']);
    Route::post('/updateCourse', [CoursesController::class, 'updateCourse']);

    // cart routes
    Route::post('/getCartItems', [CartController::class, 'getCartItems']);
    Route::post('/addToCart', [CartController::class, 'addToCart']);
    Route::post('/removeFromCart', [CartController::class, 'removeFromCart']);
    Route::post('/clearCart', [CartController::class, 'clearCart']);

    //master dataa
    Route::post('/getInstructorListByInstructorId', [CommonController::class, 'getInstructorListByInstructorId']);
});

Route::get('/user-profile/image/{type}/{filename}', [UserProfileController::class, 'image'])
    ->where('type', 'profile|thumbnail|cover')
    ->where('filename', '[A-Za-z0-9._-]+');

Route::get('/files/profile-images/{type}/{filename}', [UserProfileController::class, 'image'])
    ->where('type', 'profile|thumbnail|cover')
    ->where('filename', '[A-Za-z0-9._-]+');

Route::get('/files/instructor-documents/{path}', [InstructorRegistrationController::class, 'document'])
    ->where('path', '.*');

Route::post('/login', [AuthController::class, 'login']);

Route::post('/sendOtp', [AuthController::class, 'sendOtp']);
Route::post('/verifyOtp', [AuthController::class, 'verifyOtp']);
Route::post('/selectRole', [AuthController::class, 'selectRole']);
Route::post('/completeProfile', [AuthController::class, 'completeProfile']);
Route::get('/getAfile', [AuthController::class, 'getAfile']);

Route::post('/instructors/send-otp', [InstructorRegistrationController::class, 'sendInstructorOtp']);
Route::post('/instructors/resend-otp', [InstructorRegistrationController::class, 'resendInstructorOtp']);
Route::post('/instructors/verify-otp', [InstructorRegistrationController::class, 'verifyInstructorOtp']);


Route::group(['prefix' => '/preloginapi'], function () {
    Route::post('/getCourseCategories', [CoursesController::class, 'getCourseCategories']);
});
