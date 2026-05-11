<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class UserProfileController extends Controller
{
    public function show(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => 'User profile fetched successfully',
            'data' => $this->formatProfile($request->user(), $request),
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'phone' => ['nullable', 'digits:10'],
            'dob' => ['nullable', 'date', 'before:today'],
            'gender' => ['nullable', 'in:1,2,3'],
            'profileImg' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'thumbnailImg' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'coverImg' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:6144'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $newFiles = [];
        $oldFiles = [];

        $user->fill([
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'dob' => $validated['dob'] ?? null,
            'gender' => $validated['gender'] ?? null,
        ]);

        try {
            if ($request->hasFile('profileImg')) {
                $oldProfileFileName = $user->profileImg;
                $profileFileName = $this->storeProfileImage($request->file('profileImg'), 'profile');
                $newFiles[] = ['profile', $profileFileName];

                $user->profileImg = $profileFileName;
                $oldFiles[] = ['profile', $oldProfileFileName];

                if (!$request->hasFile('thumbnailImg')) {
                    $oldThumbnailFileName = $user->thumbnailImg;
                    $thumbnailFileName = $this->storeGeneratedThumbnail($profileFileName);
                    $newFiles[] = ['thumbnail', $thumbnailFileName];

                    $user->thumbnailImg = $thumbnailFileName;
                    $oldFiles[] = ['thumbnail', $oldThumbnailFileName];
                }
            }

            if ($request->hasFile('thumbnailImg')) {
                $oldThumbnailFileName = $user->thumbnailImg;
                $thumbnailFileName = $this->storeProfileImage($request->file('thumbnailImg'), 'thumbnail');
                $newFiles[] = ['thumbnail', $thumbnailFileName];

                $user->thumbnailImg = $thumbnailFileName;
                $oldFiles[] = ['thumbnail', $oldThumbnailFileName];
            }

            if ($request->hasFile('coverImg')) {
                $oldCoverFileName = $user->coverImg;
                $coverFileName = $this->storeProfileImage($request->file('coverImg'), 'cover');
                $newFiles[] = ['cover', $coverFileName];

                $user->coverImg = $coverFileName;
                $oldFiles[] = ['cover', $oldCoverFileName];
            }

            DB::transaction(static function () use ($user): void {
                $user->save();
            });
        } catch (Throwable $e) {
            foreach ($newFiles as [$directory, $fileName]) {
                $this->deleteStoredFile($directory, $fileName);
            }

            Log::error('User profile update failed', [
                'user_id' => $user->id ?? null,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to update profile right now. Please try again later.',
            ], 500);
        }

        foreach ($oldFiles as [$directory, $fileName]) {
            $this->deleteStoredFile($directory, $fileName);
        }

        return response()->json([
            'success' => true,
            'message' => 'User profile updated successfully',
            'data' => $this->formatProfile($user->fresh(), $request),
        ]);
    }

    public function image(string $type, string $filename)
    {
        $path = $this->resolveExistingProfileStoragePath($type, $filename);
        $disk = Storage::disk('private');

        if (!$path || !$disk->exists($path)) {
            abort(404);
        }

        return response($disk->get($path), 200, [
            'Content-Type' => $disk->mimeType($path) ?: 'application/octet-stream',
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }

    private function storeProfileImage(UploadedFile $file, string $directory): string
    {
        $fileName = $this->makeFileName($file);
        $disk = Storage::disk('private');
        $storageDirectory = $this->profileStorageDirectory($directory);

        if (!$disk->putFileAs($storageDirectory, $file, $fileName)) {
            throw new \RuntimeException('Unable to store profile image.');
        }

        return $fileName;
    }

    private function storeGeneratedThumbnail(string $profileFileName): string
    {
        $disk = Storage::disk('private');
        $imagePath = $disk->path($this->profileStoragePath('profile', $profileFileName));
        $extension = strtolower(pathinfo($profileFileName, PATHINFO_EXTENSION)) ?: 'jpg';
        $thumbnailFileName = Str::uuid() . '.' . $extension;
        $targetPath = $disk->path($this->profileStoragePath('thumbnail', $thumbnailFileName));
        $targetDirectory = dirname($targetPath);

        if (!is_dir($targetDirectory)) {
            if (!mkdir($targetDirectory, 0775, true) && !is_dir($targetDirectory)) {
                throw new \RuntimeException('Unable to create profile thumbnail directory.');
            }
        }

        if (!$this->writeCroppedThumbnail($imagePath, $targetPath, $extension)) {
            if (!is_file($imagePath)) {
                throw new \RuntimeException('Stored profile image could not be found for thumbnail generation.');
            }

            if (!copy($imagePath, $targetPath)) {
                throw new \RuntimeException('Unable to create profile thumbnail.');
            }
        }

        return $thumbnailFileName;
    }

    private function writeCroppedThumbnail(string $imagePath, string $targetPath, string $extension): bool
    {
        if (!function_exists('getimagesize') || !function_exists('imagecreatetruecolor')) {
            return false;
        }

        if (!is_file($imagePath)) {
            return false;
        }

        $imageInfo = @getimagesize($imagePath);

        if (!$imageInfo) {
            return false;
        }

        [$width, $height] = $imageInfo;

        $source = $this->createImageResource($imagePath, $imageInfo[2]);

        if (!$source) {
            return false;
        }

        $size = min($width, $height);

        $srcX = (int) (($width - $size) / 2);
        $srcY = (int) (($height - $size) / 2);

        $thumbSize = 220;

        $thumbnail = imagecreatetruecolor($thumbSize, $thumbSize);

        imagecopyresampled(
            $thumbnail,
            $source,
            0,
            0,
            $srcX,
            $srcY,
            $thumbSize,
            $thumbSize,
            $size,
            $size
        );

        $written = false;

        switch ($extension) {

            case 'png':
                $written = imagepng($thumbnail, $targetPath);
                break;

            case 'webp':
                if (function_exists('imagewebp')) {
                    $written = imagewebp($thumbnail, $targetPath, 85);
                } else {
                    $written = imagejpeg($thumbnail, $targetPath, 85);
                }
                break;

            default:
                $written = imagejpeg($thumbnail, $targetPath, 85);
                break;
        }

        imagedestroy($source);
        imagedestroy($thumbnail);

        return $written;
    }

    private function createImageResource(string $path, int $imageType)
    {
        try {
            return match ($imageType) {
                IMAGETYPE_JPEG => imagecreatefromjpeg($path),
                IMAGETYPE_PNG => imagecreatefrompng($path),
                IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? imagecreatefromwebp($path) : false,
                default => false,
            };
        } catch (\Throwable $e) {
            Log::warning('Unable to create profile thumbnail', [
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function deleteStoredFile(string $directory, ?string $fileName): void
    {
        if (!$fileName) {
            return;
        }

        $disk = Storage::disk('private');

        foreach ([
            $this->profileStoragePath($directory, $fileName),
            $this->legacyProfileStoragePath($directory, $fileName),
        ] as $path) {
            if ($disk->exists($path)) {
                $disk->delete($path);
            }
        }
    }

    private function makeFileName(UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: 'jpg');

        return Str::uuid() . '.' . $extension;
    }

    private function formatProfile(?User $user, Request $request): array
    {
        if (!$user) {
            return [];
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone ?? $user->mobile ?? null,
            'dob' => $user->dob ? optional($user->dob)->format('Y-m-d') : null,
            'gender' => $user->gender ?? null,
            'profileImg' => $user->profileImg,
            'thumbnailImg' => $user->thumbnailImg,
            'coverImg' => $user->coverImg,
            'profileImgUrl' => $this->imageUrl($request, 'profile', $user->profileImg),
            'thumbnailImgUrl' => $this->imageUrl($request, 'thumbnail', $user->thumbnailImg),
            'coverImgUrl' => $this->imageUrl($request, 'cover', $user->coverImg),
        ];
    }

    private function imageUrl(Request $request, string $type, ?string $fileName): ?string
    {
        if (!$fileName) {
            return null;
        }

        $path = $this->resolveExistingProfileStoragePath($type, $fileName)
            ?? $this->profileStoragePath($type, $fileName);

        return $this->privateFileUrl($request, $path);
    }

    private function profileStorageDirectory(string $type): string
    {
        return 'uploads/user/' . trim($type, '/');
    }

    private function profileStoragePath(string $type, string $fileName): string
    {
        return $this->profileStorageDirectory($type) . '/' . basename($fileName);
    }

    private function legacyProfileStoragePath(string $type, string $fileName): string
    {
        return 'app/profile-images/' . trim($type, '/') . '/' . basename($fileName);
    }

    private function resolveExistingProfileStoragePath(string $type, string $fileName): ?string
    {
        $disk = Storage::disk('private');

        foreach ([
            $this->profileStoragePath($type, $fileName),
            $this->legacyProfileStoragePath($type, $fileName),
        ] as $path) {
            if ($disk->exists($path)) {
                return $path;
            }
        }

        return null;
    }

    private function privateFileUrl(Request $request, string $path): string
    {
        $apiPosition = strpos($request->url(), '/api/');
        $baseUrl = $apiPosition === false
            ? $request->getSchemeAndHttpHost()
            : substr($request->url(), 0, $apiPosition);

        return $baseUrl . '/api/getAfile?path=' . rawurlencode(trim($path, '/'));
    }
}
