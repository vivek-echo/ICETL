<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\AdminConsole\AdminConsoleController;
/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/
use Barryvdh\DomPDF\Facade\Pdf;

Route::get('/view', function () {
    $certificate = (object) [
        'enrollmentId'    => 'LR_2026_4',
        'studentId'       => 'ICETL-001',
        'gender'          => '1',
        'studentName'     => 'Vivek Kumar Jha',
        'durationText'    => '1 weeks',
        'grade'           => 'A',
        'moduleTitle'     => 'Full Stack Web Development with Angular and Laravel',
        'courseCategory'  => 'Finance and Accounting',
        'issueDate'       => '2026-06-10',
        'certificateNo'   => 'ICETL-C-2026-000001',
    ];

    $pdf = Pdf::loadView('certificates.course', [
        'certificate' => $certificate,
        'isPdf' => true,
    ])->setPaper('a4', 'portrait');

    return $pdf->stream('ICETL-C-2026-000001.pdf');
});
Route::get('/workshop-certificate', function () {
    $startDate = '2026-06-15';
    $endDate = '2026-06-16';

    $start = strtotime($startDate);
    $end = strtotime($endDate);

    $days = $start && $end
        ? max(1, ceil(($end - $start) / (24 * 60 * 60)) + 1)
        : null;

    $durationText = $days
        ? $days . ' ' . ($days > 1 ? 'Days' : 'Day')
        : '';

    $certificate = (object) [
        'certificateNo' => 'ICETL-WK-2026-000001',
        'studentName' => 'Vivek',
        'studentId' => 'LR_2026_4',
        'workshopTitle' => 'Modern Web Development with Angular & Laravel',
        'startDate' => $startDate,
        'endDate' => $endDate,
        'workshopDate' => $startDate,
        'issuedOn' => now()->format('Y-m-d'),
        'durationText' => $durationText,
        'gender' => 1,
        'venue' => 'ICETL Training Hall asdsa asdcsad asdcsad zxcdsadc xcsdac, Patna',
    ];

    $pdf = Pdf::loadView('certificates.workshop', [
        'certificate' => $certificate,
        'isPdf' => true,
    ])
        ->setPaper('a4', 'portrait')
        ->setOptions([
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled' => true,
            'defaultFont' => 'DejaVu Serif',
            'dpi' => 96,
        ]);

    return $pdf->stream('workshop-certificate-preview.pdf');
});
Route::get('/', function () {
    return redirect('adminConsoleLoginView');
});

Route::get('/adminConsoleLoginView', [AdminConsoleController::class, 'adminConsoleLoginView'])->name('login');
Route::Post('/adminlogin', [AdminConsoleController::class, 'adminConsoleLogin'])->name('adminlogin');
Route::POST('/adminLogout', [AdminConsoleController::class, 'adminLogout'])->name('adminLogout');

Route::prefix('console')->middleware(['auth'])->group(function () {

    Route::get('/dashboard', function () {

        return view('adminConsole.dashboard');
    });

    Route::get('/manageMenu', function () {
        return view('adminConsole.menuLink.index');
    });
    Route::get('/manageRole', function () {
        return view('adminConsole.manageRole.index');
    });
    Route::get('/managePermission', function () {
        return view('adminConsole.permission.index');
    });
    Route::get('/menuSerialization', function () {
        return view('adminConsole.menuSerialization.index');
    });
    // Route::get('/systemLogs', function () {
    //     return response()->json([
    //         'status'=>false
    //     ],401);
    // });

    // menu link
    Route::post('/storeMenu', [AdminConsoleController::class, 'storeMenu'])->name('storeMenu');
    Route::get('/getGlobalMenus', [AdminConsoleController::class, 'getGlobalMenus']);
    Route::get('/getPrimaryMenus/{parentId}', [AdminConsoleController::class, 'getPrimaryMenus']);
    Route::get('/getMenus', [AdminConsoleController::class, 'getMenus']);
    Route::post('/deleteMenu', [AdminConsoleController::class, 'deleteMenu'])->name('deleteMenu');

    // manage role
    Route::post('/storeRole', [AdminConsoleController::class, 'storeRole'])->name('storeRole');
    Route::get('/getRoles', [AdminConsoleController::class, 'getRoles']);
    Route::post('/deleteRole', [AdminConsoleController::class, 'deleteRole'])->name('deleteRole');


    Route::get('/getRolesList', [AdminConsoleController::class, 'getRolesList']);
    Route::get('/getMenuHierarchy', [AdminConsoleController::class, 'getMenuHierarchy']);
    Route::post('/saveRolePermissions', [AdminConsoleController::class, 'saveRolePermissions']);

    Route::get('/getRolePermissions/{roleId}', [AdminConsoleController::class, 'getRolePermissions']);

    Route::get('/getRolePermissionsTree/{roleId}', [AdminConsoleController::class, 'getRolePermissionsTree']);
    Route::get('/getRoleMenuSerialization/{roleId}', [AdminConsoleController::class, 'getRoleMenuSerialization']);
    Route::post('/saveRoleMenuSerialization', [AdminConsoleController::class, 'saveRoleMenuSerialization']);
    Route::get('/getLogs', [AdminConsoleController::class, 'getLogs']);
});
