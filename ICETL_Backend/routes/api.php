<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\InstructorRegistrationController;
use App\Http\Controllers\UserProfileController;
use App\Http\Controllers\CoursesController;
use App\Http\Controllers\CommonController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CurriculumController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\DashboardController;
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
// Route::post('/info', function () {
//         phpinfo();
//     });
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
    Route::post('/getCourseById', [CoursesController::class, 'getCourseById']);
    Route::post('/updateCourse', [CoursesController::class, 'updateCourse']);

    // curriculum section routes
    Route::post('/curriculum/section/add', [CurriculumController::class, 'addSection']);
    Route::post('/curriculum/section/list', [CurriculumController::class, 'listSections']);
    Route::post('/curriculum/section/update', [CurriculumController::class, 'updateSection']);
    Route::post('/curriculum/section/delete', [CurriculumController::class, 'deleteSection']);
    Route::post('/curriculum/section/order', [CurriculumController::class, 'updateSectionOrder']);
    Route::post('/curriculum/item/video/upload', [CurriculumController::class, 'uploadItemVideo']);
    Route::post('/curriculum/item/add', [CurriculumController::class, 'addItem']);
    Route::post('/curriculum/item/list', [CurriculumController::class, 'listItems']);
    Route::post('/curriculum/item/update', [CurriculumController::class, 'updateItem']);
    Route::post('/curriculum/item/delete', [CurriculumController::class, 'deleteItem']);
    Route::post('/curriculum/item/order', [CurriculumController::class, 'updateItemOrder']);
    Route::post('/curriculum/quiz/add', [CurriculumController::class, 'addQuiz']);
    Route::post('/curriculum/quiz/update', [CurriculumController::class, 'updateQuiz']);
    Route::post('/curriculum/quiz/delete', [CurriculumController::class, 'deleteQuiz']);
    Route::post('/curriculum/quiz/list', [CurriculumController::class, 'listQuizzes']);
    Route::post('/quiz/question/add', [CurriculumController::class, 'addQuizQuestion']);
    Route::post('/quiz/question/update', [CurriculumController::class, 'updateQuizQuestion']);
    Route::post('/quiz/question/delete', [CurriculumController::class, 'deleteQuizQuestion']);
    Route::post('/quiz/question/list', [CurriculumController::class, 'listQuizQuestions']);

    // cart routes
    Route::post('/getCartItems', [CartController::class, 'getCartItems']);
    Route::post('/addToCart', [CartController::class, 'addToCart']);
    Route::post('/removeFromCart', [CartController::class, 'removeFromCart']);
    Route::post('/clearCart', [CartController::class, 'clearCart']);

    //master dataa
    Route::post('/getInstructorListByInstructorId', [CommonController::class, 'getInstructorListByInstructorId']);

    //payment routes
    Route::post('/cartCheckoutInit', [PaymentController::class, 'cartCheckoutInit']);
    Route::post('/verifyPayment', [PaymentController::class, 'verifyPayment']);
    Route::post('/paymentFailure', [PaymentController::class, 'paymentFailure']);
    Route::get('/paymentLogs', [PaymentController::class, 'paymentLogs']);
    Route::get('/myLearning', [PaymentController::class, 'myLearning']);
    Route::get('/invoice/{orderId}', [PaymentController::class, 'invoice']);
    Route::get('/invoice/{orderId}/download', [PaymentController::class, 'downloadInvoice']);
    Route::get('/course-access/{courseId}', [PaymentController::class, 'checkCourseAccess']);
    Route::get('/admin/payments', [PaymentController::class, 'adminPayments']);

    // dashboard routes
    Route::get('/dashboard/learner', [DashboardController::class, 'learner']);
    Route::get('/dashboard/instructor', [DashboardController::class, 'instructor']);
    Route::get('/dashboard/admin', [DashboardController::class, 'admin']);
});

Route::post('/razorpay/webhook', [PaymentController::class, 'webhook']);

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
