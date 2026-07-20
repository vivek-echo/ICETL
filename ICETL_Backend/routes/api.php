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
use App\Http\Controllers\LearningController;
use App\Http\Controllers\WorkshopController;
use App\Http\Controllers\SeminarController;
use App\Http\Controllers\ContactEnquiryController;
use App\Http\Controllers\CertificateController;
use App\Http\Controllers\ModuleMaterialController;
use App\Http\Controllers\WorkflowController;
use App\Http\Controllers\AdministrationController;
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
    Route::get('/instructor/assigned-modules', [ModuleMaterialController::class, 'assignedModules']);
    Route::get('/instructor/assigned-module-students', [ModuleMaterialController::class, 'assignedModuleStudents']);
    Route::get('/module-materials', [ModuleMaterialController::class, 'index']);
    Route::post('/module-materials', [ModuleMaterialController::class, 'store']);
    Route::get('/module-materials/{id}/download', [ModuleMaterialController::class, 'download'])
        ->whereNumber('id');
    Route::delete('/module-materials/{id}', [ModuleMaterialController::class, 'destroy'])
        ->whereNumber('id');
    Route::get('/workflow/activity', [WorkflowController::class, 'activity']);
    Route::get('/workflow/certificates', [WorkflowController::class, 'certificates']);
    Route::get('/workflow/payments', [WorkflowController::class, 'payments']);
    Route::get('/workflow/materials', [WorkflowController::class, 'materials']);

    // administration routes
    Route::get('/administration/states', [AdministrationController::class, 'states']);
    Route::get('/administration/districts', [AdministrationController::class, 'districts']);
    Route::post('/administration/branches', [AdministrationController::class, 'storeBranch']);
    Route::get('/administration/branches', [AdministrationController::class, 'branches']);

    // course category routes
    Route::post('/addCourseCategory', [CoursesController::class, 'addCourseCategory']);

    Route::post('/updateCourseCategory', [CoursesController::class, 'updateCourseCategory']);
    Route::post('/deleteCourseCategory', [CoursesController::class, 'deleteCourseCategory']);
    Route::post('/getCourseCategories', [CoursesController::class, 'getCourseCategories']);
    Route::post('/createCourse', [CoursesController::class, 'createCourse']);
    Route::post('/createOfflineCourse', [CoursesController::class, 'createOfflineCourse']);
    Route::post('/getOfflineCourses', [CoursesController::class, 'getOfflineCourses']);
    Route::post('/getMyOfflineCourses', [CoursesController::class, 'getMyOfflineCourses']);
    Route::post('/getAllOfflineCourses', [CoursesController::class, 'getAllOfflineCourses']);
    Route::post('/getOfflineCourseById', [CoursesController::class, 'getOfflineCourseById']);
    Route::post('/updateOfflineCourse', [CoursesController::class, 'updateOfflineCourse']);
    Route::post('/offline-courses/approve', [CoursesController::class, 'approveOfflineCourse']);
    Route::post('/offline-courses/reject', [CoursesController::class, 'rejectOfflineCourse']);
    Route::post('/offline-courses/publish', [CoursesController::class, 'publishOfflineCourse']);
    Route::post('/offline-courses/enroll-student', [CoursesController::class, 'enrollStudent']);
    Route::post('/offline-courses/enrolled-students', [CoursesController::class, 'getOfflineCourseEnrolledStudents']);
    Route::post('/offline-courses/installments/pay', [CoursesController::class, 'payOfflineCourseInstallment']);
    Route::post('/offline-courses/installments/update', [CoursesController::class, 'updateOfflineCourseInstallments']);
    Route::post('/updateOfflineCourseStatus', [CoursesController::class, 'updateOfflineCourseStatus']);
    Route::post('/deleteOfflineCourse', [CoursesController::class, 'deleteOfflineCourse']);
    Route::post('/getCourses', [CoursesController::class, 'getCourses']);
    Route::post('/getAllCourses', [CoursesController::class, 'getAllCourses']);
    Route::post('/getCourseById', [CoursesController::class, 'getCourseById']);
    Route::post('/updateCourse', [CoursesController::class, 'updateCourse']);

    // workshop routes
    Route::post('/createWorkshop', [WorkshopController::class, 'createWorkshop']);
    Route::post('/getMyWorkshops', [WorkshopController::class, 'getMyWorkshops']);
    Route::post('/getAllWorkshops', [WorkshopController::class, 'getAllWorkshops']);
    Route::post('/getWorkshopById', [WorkshopController::class, 'getWorkshopById']);
    Route::post('/updateWorkshop', [WorkshopController::class, 'updateWorkshop']);
    Route::post('/updateWorkshopStatus', [WorkshopController::class, 'updateWorkshopStatus']);
    Route::post('/workshops/enroll-student', [PaymentController::class, 'enrollWorkshopStudent']);
    Route::post('/workshops/enrolled-students', [PaymentController::class, 'workshopEnrolledStudents']);
    Route::post('/deleteWorkshop', [WorkshopController::class, 'deleteWorkshop']);

    // seminar routes
    Route::post('/createSeminar', [SeminarController::class, 'createSeminar']);
    Route::post('/getMySeminars', [SeminarController::class, 'getMySeminars']);
    Route::post('/getAllSeminars', [SeminarController::class, 'getAllSeminars']);
    Route::post('/getSeminarById', [SeminarController::class, 'getSeminarById']);
    Route::post('/updateSeminar', [SeminarController::class, 'updateSeminar']);
    Route::post('/updateSeminarStatus', [SeminarController::class, 'updateSeminarStatus']);
    Route::post('/seminars/enroll-student', [PaymentController::class, 'enrollSeminarStudent']);
    Route::post('/seminars/enrolled-students', [PaymentController::class, 'seminarEnrolledStudents']);
    Route::post('/deleteSeminar', [SeminarController::class, 'deleteSeminar']);

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
    Route::post('/programCheckoutInit', [PaymentController::class, 'programCheckoutInit']);
    Route::post('/verifyPayment', [PaymentController::class, 'verifyPayment']);
    Route::post('/paymentFailure', [PaymentController::class, 'paymentFailure']);
    Route::get('/paymentStatus', [PaymentController::class, 'paymentStatus']);
    Route::get('/paymentLogs', [PaymentController::class, 'paymentLogs']);
    Route::get('/myLearning', [PaymentController::class, 'myLearning']);
    Route::get('/myPrograms', [PaymentController::class, 'myPrograms']);
    Route::get('/invoice/{orderId}', [PaymentController::class, 'invoice']);
    Route::get('/invoice/{orderId}/download', [PaymentController::class, 'downloadInvoice']);
    Route::get('/course-access/{courseId}', [PaymentController::class, 'checkCourseAccess']);
    Route::get('/admin/payments', [PaymentController::class, 'adminPayments']);
    Route::get('/admin/payments/export', [PaymentController::class, 'exportAdminPayments']);

    // learner course player routes
    Route::get('/learning/course/{courseId}', [LearningController::class, 'course']);
    Route::post('/learning/progress', [LearningController::class, 'saveProgress']);
    Route::post('/learning/notes', [LearningController::class, 'saveNote']);
    Route::post('/learning/quiz/{quizId}/submit', [LearningController::class, 'submitQuiz']);

    // dashboard routes
    Route::get('/dashboard', [DashboardController::class, 'current']);
    Route::get('/dashboard/learner', [DashboardController::class, 'learner']);
    Route::get('/dashboard/instructor', [DashboardController::class, 'instructor']);
    Route::get('/dashboard/admin', [DashboardController::class, 'admin']);

    // contact enquiry routes
    Route::post('/getContactEnquiries', [ContactEnquiryController::class, 'index']);
    Route::get('/contact-enquiries/unread-count', [ContactEnquiryController::class, 'unreadCount']);
    Route::post('/contact-enquiries/mark-read', [ContactEnquiryController::class, 'markRead']);

    Route::post('/certificates/generate', [CertificateController::class, 'generate']);

    
});
Route::get('/public/certificates/verify/{verificationCode}', [CertificateController::class, 'verify'])
    ->middleware('throttle:certificate-verify')
    ->where('verificationCode', '[A-Za-z0-9\-]+');

Route::get('/certificates/download/{certificateNo}', [CertificateController::class, 'download']);
Route::post('/razorpay/webhook', [PaymentController::class, 'webhook']);

Route::get('/user-profile/image/{type}/{filename}', [UserProfileController::class, 'image'])
    ->where('type', 'profile|thumbnail|cover')
    ->where('filename', '[A-Za-z0-9._-]+');

Route::get('/files/profile-images/{type}/{filename}', [UserProfileController::class, 'image'])
    ->where('type', 'profile|thumbnail|cover')
    ->where('filename', '[A-Za-z0-9._-]+');

Route::get('/files/instructor-documents/{path}', [InstructorRegistrationController::class, 'document'])
    ->where('path', '.*');

Route::post('/contact-enquiries', [ContactEnquiryController::class, 'store']);

Route::post('/sendOtp', [AuthController::class, 'sendOtp'])->middleware('throttle:otp-send');
Route::post('/verifyOtp', [AuthController::class, 'verifyOtp'])->middleware('throttle:otp-verify');
Route::post('/selectRole', [AuthController::class, 'selectRole']);
Route::post('/completeProfile', [AuthController::class, 'completeProfile']);
Route::get('/getAfile', [AuthController::class, 'getAfile']);

Route::post('/instructors/send-otp', [InstructorRegistrationController::class, 'sendInstructorOtp'])->middleware('throttle:otp-send');
Route::post('/instructors/resend-otp', [InstructorRegistrationController::class, 'resendInstructorOtp'])->middleware('throttle:otp-send');
Route::post('/instructors/verify-otp', [InstructorRegistrationController::class, 'verifyInstructorOtp'])->middleware('throttle:otp-verify');


Route::group(['prefix' => '/preloginapi'], function () {
    Route::post('/getCourseCategories', [CoursesController::class, 'getCourseCategories']);
    Route::post('/getPublicCourses', [CoursesController::class, 'getPublicCourses']);
    Route::post('/getPublicWorkshops', [WorkshopController::class, 'getPublicWorkshops']);
    Route::post('/getPublicSeminars', [SeminarController::class, 'getPublicSeminars']);
});
