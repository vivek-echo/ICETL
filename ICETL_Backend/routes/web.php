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
    Route::get('/getLogs', [AdminConsoleController::class, 'getLogs']);
});
