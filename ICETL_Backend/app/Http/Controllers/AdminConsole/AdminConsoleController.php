<?php

namespace App\Http\Controllers\AdminConsole;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Validator;

class AdminConsoleController extends Controller
{
    public function adminConsoleLoginView()
    {
        
        return view('adminConsole.adminConsoleLoginView');
    }

    public function adminConsoleLogin(Request $request)
    {
        // Validation
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|min:4'
        ]);

        // Add userType condition
        $credentials = [
            'email' => $request->email,
            'password' => $request->password,
            'userType' => 3
        ];

        // Attempt login ONLY if userType = 3
        if (Auth::attempt($credentials, $request->remember)) {

            $request->session()->regenerate();

            return redirect('/console/dashboard');
        }

        return back()->withErrors([
            'email' => 'Invalid credentials or not authorized as admin'
        ])->withInput();
    }

    public function adminLogout(Request $request)
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/adminConsoleLoginView');
    }

    public function storeMenu(Request $request)
    {
        try {

            // ✅ Validation with conditional rules
            $validator = Validator::make($request->all(), [

                // 1️⃣ MENU TYPE FIRST (because UI starts here)
                'type' => ['required', 'in:1,2,3'],

                // 2️⃣ CONDITIONAL FIELDS
                'globalLink' => ['required_if:type,primary', 'nullable', 'integer'],
                'primaryLink' => ['required_if:type,tabs', 'nullable', 'integer'],

                // 3️⃣ MAIN FIELD (NAME)
                'name' => ['required', 'string', 'max:255'],

                // 4️⃣ OPTIONAL FIELDS
                'url'  => ['nullable', 'string', 'max:255'],
                'icon' => ['nullable', 'string', 'max:255'],

            ], [

                'type.required' => 'Menu type is required',

                'globalLink.required_if' => 'Select global link for primary menu',
                'primaryLink.required_if' => 'Select primary link for tabs',

                'name.required' => 'Menu name is required',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'message' => $validator->errors()->first()
                ], 422);
            }

            // ✅ Resolve parentId
            $parentId = null;

            if ($request->type == 2) {
                $parentId = $request->globalLink;
            }

            if ($request->type == 3) {
                $parentId = $request->primaryLink;
            }
            // ✅ Optional: prevent duplicate menu name
            $exists = DB::table('menus')
                ->where('name', $request->name)
                ->where('deletedFlag', 0)
                ->exists();

            if ($exists) {
                return response()->json([
                    'status' => false,
                    'message' => 'Menu name already exists'
                ], 409);
            }

            // ✅ Insert into DB
            DB::table('menus')->insert([
                'name' => trim($request->name),
                'type' => $request->type,
                'url' => $request->url ? trim($request->url) : null,
                'icon' => $request->icon ? trim($request->icon) : null,
                'parentId' => (int)$parentId,
                'createdOn' => now(),
                'updatedOn' => now(),
                'deletedFlag' => 0
            ]);

            return response()->json([
                'status' => true,
                'message' => 'Menu added successfully'
            ], 200);
        } catch (\Exception $e) {

            // 🔥 Log error (very important in production)
            //\Log::error('Menu Store Error: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong. Please try again.'
            ], 500);
        }
    }

    public function getGlobalMenus()
    {
        $data = DB::table('menus')
            ->where('type', 1)
            ->where('deletedFlag', 0)
            ->get();

        return response()->json($data);
    }

    public function getPrimaryMenus($parentId)
    {

        $data = DB::table('menus')
            ->where('type', 2)
            ->where('parentId', $parentId)
            ->where('deletedFlag', 0)
            ->get();
        return response()->json($data);
    }


    public function getMenus(Request $request)
    {
        try {

            $query = DB::table('menus as m')
                ->leftJoin('menus as g', 'm.parentId', '=', 'g.id')
                ->leftJoin('menus as p', 'g.parentId', '=', 'p.id')
                ->where('m.deletedFlag', 0);

            // 🔍 Search
            if ($request->search) {
                $query->where('m.name', 'like', '%' . $request->search . '%');
            }

            // 🔍 Type filter
            if ($request->type) {
                $query->where('m.type', $request->type);
            }

            // 📄 Pagination setup
            $page = $request->page ?? 1;
            $perPage = 10;

            // 🔥 Clone query for count
            $total = (clone $query)->count();

            // 📊 Fetch data
            $menus = $query
                ->select(
                    'm.id',
                    'm.name',
                    'm.type',
                    'm.url',
                    'm.icon',
                    'g.name as parentName',
                    'p.name as grandParentName'
                )
                ->orderBy('m.id', 'desc')
                ->offset(($page - 1) * $perPage)
                ->limit($perPage)
                ->get();

            // 🔐 Encrypt IDs
            foreach ($menus as $key => $val) {
                $menus[$key]->id = Crypt::encryptString($val->id);
            }

            return response()->json([
                'status' => true,
                'data' => $menus,
                'total' => $total,
                'page' => (int)$page,
                'lastPage' => ceil($total / $perPage)
            ]);
        } catch (\Exception $e) {

            // \Log::error('Get Menus Error: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Failed to load menus'
            ], 500);
        }
    }

    public function deleteMenu(Request $request)
    {
        try {

            if (!$request->id) {
                return response()->json([
                    'status' => false,
                    'message' => 'Invalid menu ID'
                ], 422);
            }
            $id = Crypt::decryptString($request->id);

            // Optional: check if menu has children
            $hasChild = DB::table('menus')
                ->where('parentId', $id)
                ->where('deletedFlag', 0)
                ->exists();

            if ($hasChild) {
                return response()->json([
                    'status' => false,
                    'message' => 'Cannot delete. This menu has child items.'
                ], 409);
            }

            DB::table('menus')
                ->where('id', $id)
                ->update([
                    'deletedFlag' => 1,
                    'updatedOn' => now()
                ]);

            return response()->json([
                'status' => true,
                'message' => 'Menu deleted successfully'
            ]);
        } catch (\Exception $e) {

            // \Log::error('Delete Menu Error: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong'
            ], 500);
        }
    }

    public function storeRole(Request $request)
    {
        try {

            $validator = Validator::make($request->all(), [
                'roleName' => 'required|string|max:255'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => false,
                    'message' => $validator->errors()->first()
                ], 422);
            }

            // 🔁 Check duplicate
            $exists = DB::table('roles')
                ->where('roleName', $request->roleName)
                ->where('deletedFlag', 0)
                ->exists();

            if ($exists) {
                return response()->json([
                    'status' => false,
                    'message' => 'Role already exists'
                ], 409);
            }

            DB::table('roles')->insert([
                'roleName' => trim($request->roleName),
                'createdOn' => now(),
                'updatedOn' => now(),
                'deletedFlag' => 0
            ]);

            return response()->json([
                'status' => true,
                'message' => 'Role added successfully'
            ]);
        } catch (\Exception $e) {

            // \Log::error('Store Role Error: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong'
            ], 500);
        }
    }

    public function getRoles(Request $request)
    {
        try {

            $query = DB::table('roles')
                ->where('deletedFlag', 0);

            // 🔍 Search
            if ($request->search) {
                $query->where('roleName', 'like', '%' . $request->search . '%');
            }

            $page = $request->page ?? 1;
            $perPage = 10;

            $total = (clone $query)->count();

            $roles = $query
                ->select('id', 'roleName')
                ->orderBy('id', 'desc')
                ->offset(($page - 1) * $perPage)
                ->limit($perPage)
                ->get();

            // 🔐 Encrypt ID
            foreach ($roles as $key => $val) {
                $roles[$key]->id = Crypt::encryptString($val->id);
            }

            return response()->json([
                'status' => true,
                'data' => $roles,
                'total' => $total,
                'page' => (int)$page,
                'lastPage' => ceil($total / $perPage)
            ]);
        } catch (\Exception $e) {

            // \Log::error('Get Roles Error: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Failed to load roles'
            ], 500);
        }
    }

    public function deleteRole(Request $request)
    {
        try {

            $id = Crypt::decryptString($request->id);

            DB::table('roles')
                ->where('id', $id)
                ->update([
                    'deletedFlag' => 1,
                    'updatedOn' => now()
                ]);

            DB::table('role_menu_permissions')
                ->where('roleId', $id)
                ->update([
                    'deletedFlag' => 1,
                    'updatedOn' => now()
                ]);

            return response()->json([
                'status' => true,
                'message' => 'Role deleted successfully'
            ]);
        } catch (\Exception $e) {

            // \Log::error('Delete Role Error: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Something went wrong'
            ], 500);
        }
    }

    public function getRolesList()
    {
        return DB::table('roles')
            ->where('deletedFlag', 0)
            ->get();
    }

    public function getMenuHierarchy()
    {
        $menus = DB::table('menus')
            ->where('deletedFlag', 0)
            ->orderBy('id')
            ->get();

        return response()->json($menus);
    }



    public function saveRolePermissions(Request $request)
    {
        try {

            $request->validate([
                'roleId' => 'required|integer',
                'menuIds' => 'required|array'
            ]);

            $roleId = $request->roleId;
            $menuIds = $request->menuIds;

            // Convert to key-value like Node (optional)
            $permissions = [];

            foreach ($menuIds as $id) {
                $permissions[$id] = 1; // simple flag (you can expand later)
            }

            $exists = DB::table('role_menu_permissions')
                ->where('roleId', $roleId)
                ->where('deletedFlag', 0)
                ->first();

            if ($exists) {

                DB::table('role_menu_permissions')
                    ->where('id', $exists->id)
                    ->update([
                        'permissionJson' => json_encode($permissions),
                        'updatedOn' => now()
                    ]);
            } else {

                DB::table('role_menu_permissions')->insert([
                    'roleId' => $roleId,
                    'permissionJson' => json_encode($permissions),
                    'createdOn' => now(),
                    'deletedFlag' => 0
                ]);
            }

            return response()->json([
                'status' => true,
                'message' => 'Permissions saved successfully'
            ]);
        } catch (\Exception $e) {
            dd($e->getMessage());
            // \Log::error('Permission Save Error: ' . $e->getMessage());

            return response()->json([
                'status' => false,
                'message' => 'Error saving permissions'
            ], 500);
        }
    }

    public function getRolePermissions($roleId)
    {
        try {

            $data = DB::table('role_menu_permissions')
                ->where('roleId', $roleId)
                ->where('deletedFlag', 0)
                ->first();

            if (!$data) {
                return response()->json([]);
            }

            return response()->json(json_decode($data->permissionJson, true));
        } catch (\Exception $e) {

            return response()->json([], 500);
        }
    }

    public function getRolePermissionsTree($roleId)
    {
        try {

            $menus = DB::table('menus')
                ->where('deletedFlag', 0)
                ->get();

            $permission = DB::table('role_menu_permissions')
                ->where('roleId', $roleId)
                ->where('deletedFlag', 0)
                ->first();

            $permissionData = $permission ? json_decode($permission->permissionJson, true) : [];

            return response()->json([
                'menus' => $menus,
                'permissions' => $permissionData
            ]);
        } catch (\Exception $e) {

            return response()->json([], 500);
        }
    }

    public function getLogs(Request $request)
    {
        try {

            $file = storage_path('logs/laravel.log');

            if (!file_exists($file)) {
                return response()->json([
                    'status' => false,
                    'message' => 'Log file not found'
                ]);
            }

            $logs = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

            // Reverse (latest first)
            $logs = array_reverse($logs);

            // 🔍 Search
            if ($request->search) {
                $logs = array_filter($logs, function ($line) use ($request) {
                    return stripos($line, $request->search) !== false;
                });
            }

            $page = $request->page ?? 1;
            $perPage = 20;

            $total = count($logs);

            $logs = array_slice($logs, ($page - 1) * $perPage, $perPage);

            // Parse logs
            $parsed = [];

            foreach ($logs as $line) {

                preg_match('/\[(.*?)\].*\.(\w+):\s(.*)/', $line, $match);

                $parsed[] = [
                    'time' => $match[1] ?? '',
                    'level' => $match[2] ?? 'info',
                    'message' => $match[3] ?? $line,
                    'raw' => $line
                ];
            }

            return response()->json([
                'status' => true,
                'data' => $parsed,
                'page' => (int)$page,
                'lastPage' => ceil($total / $perPage)
            ]);
        } catch (\Exception $e) {

            return response()->json([
                'status' => false,
                'message' => 'Error reading logs'
            ], 500);
        }
    }
}
