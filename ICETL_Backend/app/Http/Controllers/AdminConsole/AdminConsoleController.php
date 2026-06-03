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
    private const SERIALIZATION_KEY = '_serialization';

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
            $menuIds = $this->sanitizeIdList($request->menuIds);

            // Convert to key-value like Node (optional)
            $permissions = [];

            foreach ($menuIds as $id) {
                $permissions[(string) $id] = 1; // simple flag (you can expand later)
            }

            $exists = DB::table('role_menu_permissions')
                ->where('roleId', $roleId)
                ->where('deletedFlag', 0)
                ->first();

            if ($exists) {
                $existingPayload = $this->decodePermissionPayload($exists->permissionJson ?? null);
                $serialization = $this->cleanSerializationForPermissions(
                    $this->extractSerialization($existingPayload),
                    $permissions
                );

                if (!empty($serialization['menuOrder']) || !empty($serialization['topMenuOrder'])) {
                    $permissions[self::SERIALIZATION_KEY] = $serialization;
                }
            }

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

    public function getRoleMenuSerialization($roleId)
    {
        try {
            $roleId = (int) $roleId;

            if ($roleId <= 0) {
                return response()->json([
                    'status' => false,
                    'message' => 'Invalid role'
                ], 422);
            }

            $role = DB::table('roles')
                ->where('id', $roleId)
                ->where('deletedFlag', 0)
                ->first();

            if (!$role) {
                return response()->json([
                    'status' => false,
                    'message' => 'Role not found'
                ], 404);
            }

            $permission = DB::table('role_menu_permissions')
                ->where('roleId', $roleId)
                ->where('deletedFlag', 0)
                ->first();

            $payload = $this->decodePermissionPayload($permission->permissionJson ?? null);
            $serialization = $this->extractSerialization($payload);

            $menus = DB::table('menus')
                ->where('deletedFlag', 0)
                ->orderBy('id')
                ->get();

            return response()->json([
                'status' => true,
                'role' => [
                    'id' => (int) $role->id,
                    'roleName' => $role->roleName
                ],
                'menus' => $this->sortMenusBySerialization($menus, $serialization),
                'permissions' => $this->extractPermissionFlags($payload),
                'serialization' => $serialization
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Unable to load menu serialization'
            ], 500);
        }
    }

    public function saveRoleMenuSerialization(Request $request)
    {
        try {
            $request->validate([
                'roleId' => 'required|integer',
                'menuIds' => 'array',
                'menuIds.*' => 'integer',
                'menuOrder' => 'array',
                'menuOrder.*' => 'integer',
                'topMenuOrder' => 'array',
                'topMenuOrder.*' => 'integer',
            ]);

            $roleId = (int) $request->roleId;
            $roleExists = DB::table('roles')
                ->where('id', $roleId)
                ->where('deletedFlag', 0)
                ->exists();

            if (!$roleExists) {
                return response()->json([
                    'status' => false,
                    'message' => 'Role not found'
                ], 404);
            }

            $menus = DB::table('menus')
                ->where('deletedFlag', 0)
                ->select('id', 'type', 'parentId')
                ->get()
                ->keyBy('id');

            $menuIds = collect($this->sanitizeIdList($request->input('menuIds', [])))
                ->filter(fn($id) => $menus->has($id))
                ->values();

            $menuIds = $this->includeParentMenuIds($menuIds->all(), $menus);
            $selectedMenuSet = array_flip($menuIds);

            $menuOrder = collect($this->sanitizeIdList($request->input('menuOrder', [])))
                ->filter(fn($id) => isset($selectedMenuSet[$id]))
                ->unique()
                ->values();

            $menuOrder = $menuOrder
                ->merge(collect($menuIds)->diff($menuOrder))
                ->values()
                ->all();

            $topMenuOrder = collect($this->sanitizeIdList($request->input('topMenuOrder', [])))
                ->filter(fn($id) => isset($selectedMenuSet[$id]) && (int) ($menus[$id]->type ?? 0) === 1)
                ->unique()
                ->values();

            $selectedTopMenus = collect($menuIds)
                ->filter(fn($id) => (int) ($menus[$id]->type ?? 0) === 1)
                ->values();

            $topMenuOrder = $topMenuOrder
                ->merge($selectedTopMenus->diff($topMenuOrder))
                ->values()
                ->all();

            $permissions = [];

            foreach ($menuIds as $id) {
                $permissions[(string) $id] = 1;
            }

            $permissions[self::SERIALIZATION_KEY] = [
                'menuOrder' => $menuOrder,
                'topMenuOrder' => $topMenuOrder,
                'updatedAt' => now()->toIso8601String(),
            ];

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
                    'updatedOn' => now(),
                    'deletedFlag' => 0
                ]);
            }

            return response()->json([
                'status' => true,
                'message' => 'Menu serialization saved successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => false,
                'message' => 'Unable to save menu serialization'
            ], 500);
        }
    }

    private function decodePermissionPayload(?string $permissionJson): array
    {
        if (!is_string($permissionJson) || trim($permissionJson) === '') {
            return [];
        }

        $decoded = json_decode($permissionJson, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function extractPermissionFlags(array $payload): array
    {
        $permissions = [];

        foreach ($payload as $menuId => $isAllowed) {
            if (!ctype_digit((string) $menuId) || !$this->isAllowedPermissionValue($isAllowed)) {
                continue;
            }

            $permissions[(string) (int) $menuId] = 1;
        }

        return $permissions;
    }

    private function isAllowedPermissionValue($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value === 1;
        }

        if (is_string($value)) {
            return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
        }

        return false;
    }

    private function extractSerialization(array $payload): array
    {
        $serialization = $payload[self::SERIALIZATION_KEY] ?? [];

        if (!is_array($serialization)) {
            $serialization = [];
        }

        return [
            'menuOrder' => $this->sanitizeIdList($serialization['menuOrder'] ?? []),
            'topMenuOrder' => $this->sanitizeIdList($serialization['topMenuOrder'] ?? []),
            'updatedAt' => is_string($serialization['updatedAt'] ?? null) ? $serialization['updatedAt'] : null,
        ];
    }

    private function cleanSerializationForPermissions(array $serialization, array $permissions): array
    {
        $allowedMenuSet = array_flip(
            collect(array_keys($permissions))
                ->map(fn($id) => (int) $id)
                ->filter(fn($id) => $id > 0)
                ->values()
                ->all()
        );

        return [
            'menuOrder' => collect($serialization['menuOrder'] ?? [])
                ->map(fn($id) => (int) $id)
                ->filter(fn($id) => isset($allowedMenuSet[$id]))
                ->unique()
                ->values()
                ->all(),
            'topMenuOrder' => collect($serialization['topMenuOrder'] ?? [])
                ->map(fn($id) => (int) $id)
                ->filter(fn($id) => isset($allowedMenuSet[$id]))
                ->unique()
                ->values()
                ->all(),
            'updatedAt' => is_string($serialization['updatedAt'] ?? null) ? $serialization['updatedAt'] : null,
        ];
    }

    private function sanitizeIdList($ids): array
    {
        if (!is_array($ids)) {
            return [];
        }

        return collect($ids)
            ->map(fn($id) => (int) $id)
            ->filter(fn($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    private function includeParentMenuIds(array $menuIds, $menus): array
    {
        $selected = collect($menuIds)->unique()->values()->all();
        $selectedSet = array_flip($selected);

        foreach ($menuIds as $menuId) {
            $parentId = (int) ($menus[$menuId]->parentId ?? 0);

            while ($parentId > 0 && $menus->has($parentId)) {
                if (!isset($selectedSet[$parentId])) {
                    $selected[] = $parentId;
                    $selectedSet[$parentId] = true;
                }

                $parentId = (int) ($menus[$parentId]->parentId ?? 0);
            }
        }

        return collect($selected)
            ->unique()
            ->values()
            ->all();
    }

    private function sortMenusBySerialization($menus, array $serialization)
    {
        $orderMap = array_flip($this->sanitizeIdList($serialization['menuOrder'] ?? []));

        return $menus
            ->sort(function ($left, $right) use ($orderMap) {
                $leftOrder = $orderMap[(int) $left->id] ?? PHP_INT_MAX;
                $rightOrder = $orderMap[(int) $right->id] ?? PHP_INT_MAX;

                if ($leftOrder !== $rightOrder) {
                    return $leftOrder <=> $rightOrder;
                }

                $leftParentId = (int) ($left->parentId ?? 0);
                $rightParentId = (int) ($right->parentId ?? 0);

                return $leftParentId <=> $rightParentId ?: (int) $left->id <=> (int) $right->id;
            })
            ->values();
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
