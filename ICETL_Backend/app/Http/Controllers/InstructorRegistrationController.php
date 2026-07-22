<?php

namespace App\Http\Controllers;

use App\Models\Instructor;
use App\Models\InstructorCategory;
use App\Models\InstructorDocument;
use App\Models\InstructorLanguage;
use App\Models\InstructorSkill;
use App\Models\User;
use App\Services\EntityCodeService;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Throwable;

class InstructorRegistrationController extends Controller
{
    private const OTP_EXPIRY_MINUTES = 5;
    private const OTP_RESEND_THROTTLE_SECONDS = 30;
    private const MAX_PROFILE_PHOTO_SIZE_KB = 4096;
    private const MAX_DOCUMENT_SIZE_KB = 5120;
    private const MAX_RESUME_SIZE_KB = 10240;
    private const MAX_CERTIFICATION_SIZE_KB = 5120;
    private const BANK_ACCOUNT_TYPES = ['Savings', 'Current'];
    private const BANK_VERIFICATION_NOT_SUBMITTED = 'Not Submitted';
    private const BANK_VERIFICATION_PENDING = 'Pending';
    private const BANK_VERIFICATION_STATUSES = [
        self::BANK_VERIFICATION_NOT_SUBMITTED,
        self::BANK_VERIFICATION_PENDING,
        'Verified',
        'Rejected',
    ];

    public function sendInstructorOtp(Request $request)
    {
        return $this->dispatchInstructorOtp($request, false);
    }

    public function resendInstructorOtp(Request $request)
    {
        return $this->dispatchInstructorOtp($request, true);
    }

    public function document(string $path)
    {
        $normalizedPath = $this->normalizeInstructorStoragePath($path);
        $disk = Storage::disk('private');

        if (
            $normalizedPath === '' ||
            str_contains($normalizedPath, '../') ||
            str_starts_with($normalizedPath, '../')
        ) {
            abort(404);
        }

        if (!$disk->exists($normalizedPath)) {
            abort(404);
        }

        return response($disk->get($normalizedPath), 200, [
            'Content-Type' => $disk->mimeType($normalizedPath) ?: 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="' . basename($normalizedPath) . '"',
            'Cache-Control' => 'public, max-age=604800',
        ]);
    }

    public function verifyInstructorOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email', 'max:150'],
            'otp' => ['required', 'digits:6'],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', $validator->errors()->toArray(), 422);
        }

        $email = strtolower(trim((string) $request->input('email')));
        $otp = trim((string) $request->input('otp'));

        /** @var User|null $user */
        $user = $this->resolveInstructorUserByEmail($email);
        if (!$user) {
            return $this->errorResponse('Validation failed', [
                'email' => ['No instructor onboarding draft was found for this email address.'],
            ], 404);
        }

        $cachedOtp = Cache::get($this->otpCacheKey($email));
        if (!$cachedOtp) {
            return $this->errorResponse('OTP expired', [
                'otp' => ['Your OTP has expired. Please request a new code.'],
            ], 422);
        }

        if (!Hash::check($otp, (string) $cachedOtp)) {
            $attempts = Cache::increment($this->otpAttemptsCacheKey($email));
            $maxAttempts = max(1, (int) config('authotp.max_verify_attempts', 5));

            if ($attempts >= $maxAttempts) {
                $this->clearOtpCache($email);
                return $this->errorResponse('Too many attempts', [
                    'otp' => ['Too many invalid attempts. Please request a fresh OTP.'],
                ], 429);
            }

            return $this->errorResponse('Invalid OTP', [
                'otp' => ['The verification code you entered is incorrect.'],
            ], 422);
        }

        try {
            $payload = DB::transaction(function () use ($user, $email): array {
                $cachedFlowType = Cache::get($this->flowTypeCacheKey($email));
                $this->clearOtpCache($email);
                $user->userType = 1;
                $user->role = 3;
                $user->email_verified_at = $user->email_verified_at ?? now();
                $user->save();
                $this->assignInstructorCodeIfMissing($user);

                $this->upsertInstructorDraft($user);
                $instructor = $this->loadInstructorProfile($user->id);
                $flowType = is_string($cachedFlowType) && $cachedFlowType !== ''
                    ? $cachedFlowType
                    : $this->resolveFlowTypeAfterVerification($user, $instructor);

                return [
                    'flowType' => $flowType,
                    'currentStep' => $this->normalizeStep((int) ($instructor->onboardingStep ?: 1)),
                    'onboardingAuth' => $this->buildOnboardingAuthPayload($user),
                    'instructor' => $this->formatInstructorProfile($instructor),
                ];
            });

            return $this->successResponse('OTP verified successfully.', $payload);
        } catch (Throwable $exception) {
            Log::error('Instructor OTP verification failed', [
                'email' => $email,
                'message' => $exception->getMessage(),
            ]);

            return $this->errorResponse(
                'Unable to verify instructor OTP right now. Please try again later.',
                [],
                500
            );
        }
    }

    public function saveAccountInformation(Request $request)
    {
        $context = $this->resolveInstructorContext($request);
        if ($context['response']) {
            return $context['response'];
        }

        /** @var User $user */
        $user = $context['user'];
        /** @var Instructor $instructor */
        $instructor = $context['instructor'];

        $passwordRequired = !filled($user->password) || filled($request->input('password'));

        $validator = Validator::make($request->all(), [
            'fullName' => ['required', 'string', 'min:3', 'max:150', 'regex:/^[A-Za-z ]+$/'],
            'mobileNumber' => ['required', 'regex:/^[0-9]{10}$/'],
            'gender' => ['required', 'in:1,2'],
            'dob' => ['required', 'date', 'before:today'],
            'password' => $passwordRequired
                ? ['required', 'string', 'min:8', 'max:255']
                : ['nullable', 'string', 'min:8', 'max:255'],
            'confirmPassword' => filled($request->input('password'))
                ? ['required', 'same:password']
                : ['nullable', 'same:password'],
            'country' => ['required', 'string', 'max:100'],
            'preferredLanguage' => ['required', 'string', 'max:100'],
        ]);

        $validator->after(function ($validator) use ($request, $user): void {
            $mobileNumber = preg_replace('/\D+/', '', (string) $request->input('mobileNumber')) ?? '';

            
        });

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', $validator->errors()->toArray(), 422);
        }

        $payload = $validator->validated();

        try {
            DB::transaction(function () use ($user, $instructor, $payload): void {
                $user->name = $this->sanitizeText($payload['fullName']);
                $user->phone = preg_replace('/\D+/', '', (string) $payload['mobileNumber']) ?? '';
                $user->gender = (string) $payload['gender'];
                $user->dob = $payload['dob'];
                $user->userType = 1;
                $user->role = 3;
                $user->email_verified_at = $user->email_verified_at ?? now();

                if (!empty($payload['password'])) {
                    $user->password = Hash::make((string) $payload['password']);
                }

                $this->syncUserProfileStage($user, 1);
                $user->save();
                $this->assignInstructorCodeIfMissing($user);

                $instructor->country = $this->sanitizeText($payload['country']);
                $instructor->preferredLanguage = $this->sanitizeText($payload['preferredLanguage']);
                $instructor->onboardingStep = max(2, $this->normalizeStep((int) ($instructor->onboardingStep ?: 1)));
                $instructor->save();
            });

            return $this->successResponse('Account information saved successfully.', [
                'currentStep' => 2,
                'instructor' => $this->formatInstructorProfile($this->loadInstructorProfile($user->id)),
            ]);
        } catch (Throwable $exception) {
            Log::error('Instructor account information save failed', [
                'userId' => $user->id,
                'message' => $exception->getMessage(),
            ]);

            return $this->errorResponse(
                'Unable to save account information right now. Please try again later.',
                [],
                500
            );
        }
    }

    public function saveProfessionalInformation(Request $request)
    {
        $context = $this->resolveInstructorContext($request);
        if ($context['response']) {
            return $context['response'];
        }

        /** @var User $user */
        $user = $context['user'];
        /** @var Instructor $instructor */
        $instructor = $context['instructor'];

        $validator = Validator::make($request->all(), [
            'professionalHeadline' => ['required', 'string', 'min:10', 'max:150'],
            'bio' => ['required', 'string', 'min:80', 'max:2000'],
            'profilePhoto' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:' . self::MAX_PROFILE_PHOTO_SIZE_KB],
            'yearsOfExperience' => ['required', 'integer', 'min:0', 'max:60'],
            'currentJobTitle' => ['required', 'string', 'max:150'],
            'currentOrganization' => ['required', 'string', 'max:150'],
            'highestQualification' => ['required', 'string', 'max:150'],
        ]);

        $validator->after(function ($validator) use ($request, $user): void {
            if (!$request->hasFile('profilePhoto') && !$this->hasDocumentType($user->id, 'profilePhoto')) {
                $validator->errors()->add('profilePhoto', 'Please upload a profile photo before continuing.');
            }
        });

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', $validator->errors()->toArray(), 422);
        }

        $payload = $validator->validated();
        $storedPaths = [];
        $oldPaths = [];
        $newProfileFiles = [];
        $oldProfileFiles = [];

        try {
            DB::transaction(function () use (
                $request,
                $user,
                $instructor,
                $payload,
                &$storedPaths,
                &$oldPaths,
                &$newProfileFiles,
                &$oldProfileFiles
            ): void {
                if ($request->hasFile('profilePhoto')) {
                    $this->replaceSingleDocument(
                        $user->id,
                        'profilePhoto',
                        $request->file('profilePhoto'),
                        'profile',
                        $storedPaths,
                        $oldPaths
                    );

                    $oldProfileFiles[] = ['profile', $user->profileImg];
                    $oldProfileFiles[] = ['thumbnail', $user->thumbnailImg];

                    $profileFileName = $this->storeProfileImage($request->file('profilePhoto'), 'profile');
                    $newProfileFiles[] = ['profile', $profileFileName];
                    $thumbnailFileName = $this->storeGeneratedThumbnail($profileFileName);
                    $newProfileFiles[] = ['thumbnail', $thumbnailFileName];

                    $user->profileImg = $profileFileName;
                    $user->thumbnailImg = $thumbnailFileName;
                }

                $instructor->headline = $this->sanitizeText($payload['professionalHeadline']);
                $instructor->bio = $this->sanitizeText($payload['bio']);
                $instructor->experienceYears = (int) $payload['yearsOfExperience'];
                $instructor->currentJobTitle = $this->sanitizeText($payload['currentJobTitle']);
                $instructor->currentOrganization = $this->sanitizeText($payload['currentOrganization']);
                $instructor->qualification = $this->sanitizeText($payload['highestQualification']);
                $this->syncUserProfileStage($user, 2);
                $user->save();
                $instructor->onboardingStep = max(3, $this->normalizeStep((int) ($instructor->onboardingStep ?: 1)));
                $instructor->save();
            });

            $this->cleanupStoredFiles($oldPaths);
            $this->cleanupProfileFiles($oldProfileFiles);

            return $this->successResponse('Professional information saved successfully.', [
                'currentStep' => 3,
                'instructor' => $this->formatInstructorProfile($this->loadInstructorProfile($user->id)),
            ]);
        } catch (Throwable $exception) {
            $this->cleanupStoredFiles($storedPaths);
            $this->cleanupProfileFiles($newProfileFiles);

            Log::error('Instructor professional information save failed', [
                'userId' => $user->id,
                'message' => $exception->getMessage(),
            ]);

            return $this->errorResponse(
                'Unable to save professional information right now. Please try again later.',
                [],
                500
            );
        }
    }

    public function saveSkillsAndCategories(Request $request)
    {
        $context = $this->resolveInstructorContext($request);
        if ($context['response']) {
            return $context['response'];
        }

        /** @var User $user */
        $user = $context['user'];
        /** @var Instructor $instructor */
        $instructor = $context['instructor'];

        $validator = Validator::make($request->all(), [
            'skills' => ['required', 'array', 'min:1'],
            'skills.*' => ['required', 'string', 'max:120'],
            'teachingCategories' => ['required', 'array', 'min:1'],
            'teachingCategories.*' => ['required', 'string', 'max:120'],
            'languagesYouCanTeach' => ['required', 'array', 'min:1'],
            'languagesYouCanTeach.*' => ['required', 'string', 'max:120'],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', $validator->errors()->toArray(), 422);
        }

        $payload = $validator->validated();

        try {
            DB::transaction(function () use ($user, $instructor, $payload): void {
                InstructorSkill::where('userId', $user->id)->delete();
                InstructorCategory::where('userId', $user->id)->delete();
                InstructorLanguage::where('userId', $user->id)->delete();

                foreach ($this->sanitizeList($payload['skills']) as $skill) {
                    InstructorSkill::create([
                        'userId' => $user->id,
                        'skillName' => $skill,
                    ]);
                }

                foreach ($this->sanitizeList($payload['teachingCategories']) as $category) {
                    InstructorCategory::create([
                        'userId' => $user->id,
                        'categoryName' => $category,
                    ]);
                }

                foreach ($this->sanitizeList($payload['languagesYouCanTeach']) as $language) {
                    InstructorLanguage::create([
                        'userId' => $user->id,
                        'languageName' => $language,
                    ]);
                }

                $this->syncUserProfileStage($user, 3);
                $user->save();
                $instructor->onboardingStep = max(4, $this->normalizeStep((int) ($instructor->onboardingStep ?: 1)));
                $instructor->save();
            });

            return $this->successResponse('Skills and categories saved successfully.', [
                'currentStep' => 4,
                'instructor' => $this->formatInstructorProfile($this->loadInstructorProfile($user->id)),
            ]);
        } catch (Throwable $exception) {
            Log::error('Instructor skills and categories save failed', [
                'userId' => $user->id,
                'message' => $exception->getMessage(),
            ]);

            return $this->errorResponse(
                'Unable to save skills and categories right now. Please try again later.',
                [],
                500
            );
        }
    }

    public function saveDocumentsAndSocialLinks(Request $request)
    {
        $context = $this->resolveInstructorContext($request);
        if ($context['response']) {
            return $context['response'];
        }

        /** @var User $user */
        $user = $context['user'];
        /** @var Instructor $instructor */
        $instructor = $context['instructor'];

        $validator = Validator::make($request->all(), [
            'governmentId' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf,webp', 'max:' . self::MAX_DOCUMENT_SIZE_KB],
            'resume' => ['nullable', 'file', 'mimes:pdf,doc,docx', 'max:' . self::MAX_RESUME_SIZE_KB],
            'certifications' => ['nullable', 'array'],
            'certifications.*' => ['file', 'mimes:jpg,jpeg,png,pdf,webp,doc,docx', 'max:' . self::MAX_CERTIFICATION_SIZE_KB],
            'linkedInUrl' => ['nullable', 'url', 'max:255'],
            'gitHubUrl' => ['nullable', 'url', 'max:255'],
            'youTubeUrl' => ['nullable', 'url', 'max:255'],
            'portfolioWebsite' => ['nullable', 'url', 'max:255'],
        ]);

        $validator->after(function ($validator) use ($request, $user): void {
            if (!$request->hasFile('governmentId') && !$this->hasDocumentType($user->id, 'governmentId')) {
                $validator->errors()->add('governmentId', 'Please upload your government ID.');
            }

            if (!$request->hasFile('resume') && !$this->hasDocumentType($user->id, 'resume')) {
                $validator->errors()->add('resume', 'Please upload your resume.');
            }

            if (
                !$request->hasFile('certifications')
                && !$this->hasDocumentType($user->id, 'certification')
            ) {
                $validator->errors()->add('certifications', 'Please upload at least one certification.');
            }
        });

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', $validator->errors()->toArray(), 422);
        }

        $payload = $validator->validated();
        $storedPaths = [];
        $oldPaths = [];

        try {
            DB::transaction(function () use ($request, $user, $instructor, $payload, &$storedPaths, &$oldPaths): void {
                if ($request->hasFile('governmentId')) {
                    $this->replaceSingleDocument(
                        $user->id,
                        'governmentId',
                        $request->file('governmentId'),
                        'government-id',
                        $storedPaths,
                        $oldPaths
                    );
                }

                if ($request->hasFile('resume')) {
                    $this->replaceSingleDocument(
                        $user->id,
                        'resume',
                        $request->file('resume'),
                        'resume',
                        $storedPaths,
                        $oldPaths
                    );
                }

                if ($request->hasFile('certifications')) {
                    $this->replaceMultipleDocuments(
                        $user->id,
                        'certification',
                        $request->file('certifications'),
                        'certificates',
                        $storedPaths,
                        $oldPaths
                    );
                }

                $instructor->linkedinUrl = $this->sanitizeUrl($payload['linkedInUrl'] ?? null);
                $instructor->githubUrl = $this->sanitizeUrl($payload['gitHubUrl'] ?? null);
                $instructor->youtubeUrl = $this->sanitizeUrl($payload['youTubeUrl'] ?? null);
                $instructor->portfolioUrl = $this->sanitizeUrl($payload['portfolioWebsite'] ?? null);
                $this->syncUserProfileStage($user, 4);
                $user->save();
                $instructor->onboardingStep = max(5, $this->normalizeStep((int) ($instructor->onboardingStep ?: 1)));
                $instructor->save();
            });

            $this->cleanupStoredFiles($oldPaths);

            return $this->successResponse('Documents and social links saved successfully.', [
                'currentStep' => 5,
                'instructor' => $this->formatInstructorProfile($this->loadInstructorProfile($user->id)),
            ]);
        } catch (Throwable $exception) {
            $this->cleanupStoredFiles($storedPaths);

            Log::error('Instructor documents and social links save failed', [
                'userId' => $user->id,
                'message' => $exception->getMessage(),
            ]);

            return $this->errorResponse(
                'Unable to save documents and social links right now. Please try again later.',
                [],
                500
            );
        }
    }

    public function saveBankAndSettlementDetails(Request $request)
    {
        $context = $this->resolveInstructorContext($request);
        if ($context['response']) {
            return $context['response'];
        }

        /** @var User $user */
        $user = $context['user'];
        /** @var Instructor $instructor */
        $instructor = $context['instructor'];

        $validator = Validator::make($request->all(), [
            'accountHolderName' => ['required', 'string', 'min:2', 'max:150', "regex:/^[A-Za-z][A-Za-z .'-]*$/"],
            'bankName' => ['required', 'string', 'min:2', 'max:150'],
            'accountNumber' => ['required', 'string', 'regex:/^[0-9]{6,30}$/'],
            'confirmAccountNumber' => ['required', 'same:accountNumber'],
            'ifscCode' => ['required', 'string', 'regex:/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/'],
            'accountType' => ['required', 'in:' . implode(',', self::BANK_ACCOUNT_TYPES)],
            'bankBranchName' => ['required', 'string', 'min:2', 'max:150'],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', $validator->errors()->toArray(), 422);
        }

        $payload = $validator->validated();

        try {
            DB::transaction(function () use ($user, $instructor, $payload): void {
                $instructor->bankAccountHolderName = $this->sanitizeText($payload['accountHolderName']);
                $instructor->bankName = $this->sanitizeText($payload['bankName']);
                $instructor->bankAccountNumber = preg_replace('/\D+/', '', (string) $payload['accountNumber']) ?? '';
                $instructor->bankIfscCode = strtoupper($this->sanitizeText($payload['ifscCode']));
                $instructor->bankAccountType = $this->sanitizeText($payload['accountType']);
                $instructor->bankBranchName = $this->sanitizeText($payload['bankBranchName']);
                $instructor->bankVerificationStatus = self::BANK_VERIFICATION_NOT_SUBMITTED;

                $this->syncUserProfileStage($user, 5);
                $user->save();
                $instructor->onboardingStep = 6;
                $instructor->save();
            });

            return $this->successResponse('Bank and settlement details saved successfully.', [
                'currentStep' => 6,
                'instructor' => $this->formatInstructorProfile($this->loadInstructorProfile($user->id)),
            ]);
        } catch (Throwable $exception) {
            Log::error('Instructor bank and settlement details save failed', [
                'userId' => $user->id,
                'message' => $exception->getMessage(),
            ]);

            return $this->errorResponse(
                'Unable to save bank and settlement details right now. Please try again later.',
                [],
                500
            );
        }
    }

    public function completeInstructorOnboarding(Request $request)
    {
        $context = $this->resolveInstructorContext($request);
        if ($context['response']) {
            return $context['response'];
        }

        /** @var User $user */
        $user = $context['user'];
        /** @var Instructor $instructor */
        $instructor = $context['instructor'];

        $validator = Validator::make($request->all(), [
            'acceptTerms' => ['accepted'],
            'acceptInstructorPolicy' => ['accepted'],
            'verifyInformation' => ['accepted'],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', $validator->errors()->toArray(), 422);
        }

        $completionErrors = $this->validateInstructorCompletion($user);
        if (!empty($completionErrors)) {
            return $this->errorResponse('Validation failed', $completionErrors, 422);
        }

        try {
            DB::transaction(function () use ($user, $instructor): void {
                $this->syncUserProfileStage($user, 6);
                $user->save();
                $this->assignInstructorCodeIfMissing($user);
                $instructor->onboardingCompleted = true;
                $instructor->onboardingStep = 6;
                $instructor->approvalStatus = 'pending';
                $instructor->status = 1;
                $instructor->save();
            });

            $profile = $this->loadInstructorProfile($user->id);
            $request->user()?->currentAccessToken()?->delete();

            return $this->successResponse('Instructor onboarding completed successfully.', [
                'currentStep' => 6,
                'onboardingCompleted' => true,
                'instructor' => $this->formatInstructorProfile($profile),
            ]);
        } catch (Throwable $exception) {
            Log::error('Instructor onboarding completion failed', [
                'userId' => $user->id,
                'message' => $exception->getMessage(),
            ]);

            return $this->errorResponse(
                'Unable to complete instructor onboarding right now. Please try again later.',
                [],
                500
            );
        }
    }

    public function getInstructorProfile(Request $request)
    {
        $context = $this->resolveInstructorContext($request);
        if ($context['response']) {
            return $context['response'];
        }

        /** @var Instructor $instructor */
        $instructor = $this->loadInstructorProfile($context['user']->id);

        return $this->successResponse('Instructor profile fetched successfully.', [
            'currentStep' => $this->normalizeStep((int) ($instructor->onboardingStep ?: 1)),
            'instructor' => $this->formatInstructorProfile($instructor),
        ]);
    }

    private function dispatchInstructorOtp(Request $request, bool $resend): \Illuminate\Http\JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email', 'max:150'],
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', $validator->errors()->toArray(), 422);
        }

        $email = strtolower(trim((string) $request->input('email')));

        try {
            $payload = DB::transaction(function () use ($email): array {
                /** @var User|null $user */
                $user = $this->resolveInstructorUserByEmail($email);
                $hadExistingUser = (bool) $user;
                $existingInstructor = null;

                if (!$user) {
                    $user = User::create([
                        'email' => $email,
                        'userType' => 1,
                        'role' => 3,
                    ]);
                } else {
                    $existingInstructor = Instructor::where('userId', $user->id)->first();
                }

                $this->assignInstructorCodeIfMissing($user);
                $draft = $this->upsertInstructorDraft($user);
                $currentStep = $this->normalizeStep((int) ($draft->onboardingStep ?: 1));
                $flowType = $this->determineFlowType($hadExistingUser, $existingInstructor, $user);
                if (env('APP_ENV', 'local') !== 'local' && Cache::has($this->otpLockCacheKey($email))) {
                    $remaining = $this->secondsUntilCacheExpires($this->otpLockCacheKey($email))
                        ?: self::OTP_RESEND_THROTTLE_SECONDS;
                    return [
                        'throttled' => true,
                        'remaining' => max($remaining, 1),
                    ];
                }

                $otp = (string) random_int(100000, 999999);
                Cache::put($this->otpCacheKey($email), Hash::make($otp), now()->addMinutes(self::OTP_EXPIRY_MINUTES));
                Cache::put($this->otpAttemptsCacheKey($email), 0, now()->addMinutes(self::OTP_EXPIRY_MINUTES));
                Cache::put($this->otpLockCacheKey($email), true, now()->addSeconds(self::OTP_RESEND_THROTTLE_SECONDS));
                Cache::put($this->flowTypeCacheKey($email), $flowType, now()->addMinutes(10));

                $exposeOtp = $this->shouldExposeOtpWithoutMail();

                if (!$exposeOtp) {
                    try {
                        $this->sendInstructorOtpMail($email, $otp);
                    } catch (Throwable $exception) {
                        $this->clearOtpCache($email);
                        throw $exception;
                    }
                }

                $responsePayload = [
                    'throttled' => false,
                    'email' => $email,
                    'flowType' => $flowType,
                    'currentStep' => $currentStep,
                    'expiresIn' => self::OTP_EXPIRY_MINUTES * 60,
                    'resendAvailableIn' => self::OTP_RESEND_THROTTLE_SECONDS,
                ];

                if ($exposeOtp) {
                    $responsePayload['otp'] = $otp;
                }

                return $responsePayload;
            });

            if (($payload['throttled'] ?? false) === true) {
                return $this->errorResponse('Please wait before requesting another OTP.', [
                    'otp' => ['You can request a new OTP after ' . $payload['remaining'] . ' seconds.'],
                ], 429);
            }

            return $this->successResponse(
                $resend ? 'OTP resent successfully.' : 'OTP sent successfully.',
                $payload
            );
        } catch (Throwable $exception) {
            Log::error('Instructor OTP dispatch failed', [
                'email' => $email,
                'message' => $exception->getMessage(),
            ]);

            return $this->errorResponse(
                'Unable to send instructor OTP right now. Please try again later.',
                [],
                500
            );
        }
    }

    private function resolveInstructorContext(Request $request): array
    {
        /** @var User|null $user */
        $user = $request->user();

        if (!$user) {
            return [
                'user' => null,
                'instructor' => null,
                'response' => $this->errorResponse('Unauthorized', [], 401),
            ];
        }

        $instructor = Instructor::where('userId', $user->id)->first();
        if (!$instructor) {
            return [
                'user' => $user,
                'instructor' => null,
                'response' => $this->errorResponse('Instructor onboarding draft not found.', [], 404),
            ];
        }

        $this->assignInstructorCodeIfMissing($user);

        return [
            'user' => $user,
            'instructor' => $instructor,
            'response' => null,
            ];
    }

    private function otpCacheKey(string $email): string
    {
        return 'instructor_otp_' . $this->emailCacheKey($email);
    }

    private function otpAttemptsCacheKey(string $email): string
    {
        return 'instructor_otp_attempts_' . $this->emailCacheKey($email);
    }

    private function otpLockCacheKey(string $email): string
    {
        return 'instructor_otp_lock_' . $this->emailCacheKey($email);
    }

    private function flowTypeCacheKey(string $email): string
    {
        return 'instructor_otp_flow_' . $this->emailCacheKey($email);
    }

    private function emailCacheKey(string $email): string
    {
        return hash('sha256', strtolower(trim($email)));
    }

    private function shouldExposeOtpWithoutMail(): bool
    {
        $appEnv = env('APP_ENV', 'local');
        $exposeInResponse = env('OTP_EXPOSE_IN_RESPONSE', in_array($appEnv, ['local', 'staging'], true));
        return in_array($appEnv, ['local', 'staging'], true) && (bool) $exposeInResponse;
    }

    private function clearOtpCache(string $email): void
    {
        Cache::forget($this->otpCacheKey($email));
        Cache::forget($this->otpAttemptsCacheKey($email));
        Cache::forget($this->otpLockCacheKey($email));
        Cache::forget($this->flowTypeCacheKey($email));
    }

    private function secondsUntilCacheExpires(string $key): ?int
    {
        $store = Cache::getStore();

        if (!method_exists($store, 'getRedis')) {
            return null;
        }

        try {
            $prefix = method_exists($store, 'getPrefix') ? $store->getPrefix() : '';
            $ttl = $store->getRedis()->pttl($prefix . $key);

            return is_numeric($ttl) && (int) $ttl > 0 ? (int) ceil(((int) $ttl) / 1000) : null;
        } catch (Throwable $exception) {
            return null;
        }
    }

    private function assignInstructorCodeIfMissing(User $user): ?string
    {
        $code = EntityCodeService::assignIfMissing(
            'users',
            (int) $user->id,
            EntityCodeService::PREFIX_INSTRUCTOR
        );

        if ($code !== null) {
            $user->code = $code;
        }

        return $code ?? ($user->code ?? null);
    }

    private function upsertInstructorDraft(User $user): Instructor
    {
        $draft = Instructor::firstOrNew(['userId' => $user->id]);
        $draft->userId = $user->id;
        $draft->onboardingStep = $this->normalizeStep((int) ($draft->onboardingStep ?: 1));
        $draft->onboardingCompleted = (bool) ($draft->onboardingCompleted ?? false);
        $draft->approvalStatus = $draft->approvalStatus ?: 'draft';
        $draft->status = (int) ($draft->status ?: 1);
        $draft->save();

        return $draft;
    }

    private function loadInstructorProfile(int $userId): Instructor
    {
        return Instructor::with([
            'user',
            'skills',
            'categories',
            'languages',
            'documents' => fn($query) => $query->orderByDesc('id'),
        ])->where('userId', $userId)->firstOrFail();
    }

    private function formatInstructorProfile(Instructor $instructor): array
    {
        $documents = $instructor->documents->map(function (InstructorDocument $document): array {
            $normalizedFilePath = $this->normalizeInstructorStoragePath((string) $document->filePath);
            $fileName = basename($normalizedFilePath);

            return [
                'id' => $document->id,
                'userId' => $document->userId,
                'documentType' => $document->documentType,
                'fileName' => $fileName,
                'originalName' => $fileName,
                'filePath' => $normalizedFilePath,
                'fileUrl' => $this->publicUploadUrl($normalizedFilePath),
            ];
        })->values();

        $profilePhoto = $documents->firstWhere('documentType', 'profilePhoto');

        return [
            'id' => $instructor->id,
            'code' => $instructor->user?->code,
            'userId' => $instructor->userId,
            'dob' => optional($instructor->user?->dob)->format('Y-m-d'),
            'gender' => filled($instructor->user?->gender) ? (string) $instructor->user?->gender : null,
            'headline' => $instructor->headline,
            'bio' => $instructor->bio,
            'experienceYears' => $instructor->experienceYears,
            'currentJobTitle' => $instructor->currentJobTitle,
            'currentOrganization' => $instructor->currentOrganization,
            'qualification' => $instructor->qualification,
            'country' => $instructor->country,
            'preferredLanguage' => $instructor->preferredLanguage,
            'linkedinUrl' => $instructor->linkedinUrl,
            'githubUrl' => $instructor->githubUrl,
            'youtubeUrl' => $instructor->youtubeUrl,
            'portfolioUrl' => $instructor->portfolioUrl,
            'bankAccountHolderName' => $instructor->bankAccountHolderName,
            'bankName' => $instructor->bankName,
            'bankAccountNumber' => $instructor->bankAccountNumber,
            'bankIfscCode' => $instructor->bankIfscCode,
            'bankAccountType' => $instructor->bankAccountType,
            'bankBranchName' => $instructor->bankBranchName,
            'bankVerificationStatus' => $this->normalizeBankVerificationStatus($instructor->bankVerificationStatus ?? null),
            'onboardingStep' => $this->normalizeStep((int) ($instructor->onboardingStep ?: 1)),
            'onboardingCompleted' => (bool) $instructor->onboardingCompleted,
            'approvalStatus' => $instructor->approvalStatus ?: 'draft',
            'status' => (int) ($instructor->status ?: 1),
            'profilePhotoUrl' => $profilePhoto['fileUrl'] ?? null,
            'skills' => $instructor->skills->pluck('skillName')->values(),
            'categories' => $instructor->categories->pluck('categoryName')->values(),
            'languagesYouCanTeach' => $instructor->languages->pluck('languageName')->values(),
            'documents' => $documents,
            'user' => [
                'id' => $instructor->user?->id,
                'code' => $instructor->user?->code,
                'name' => $instructor->user?->name,
                'email' => $instructor->user?->email,
                'phone' => $instructor->user?->phone,
                'dob' => optional($instructor->user?->dob)->format('Y-m-d'),
                'gender' => filled($instructor->user?->gender) ? (string) $instructor->user?->gender : null,
                'hasPassword' => filled($instructor->user?->password),
            ],
        ];
    }

    private function buildOnboardingAuthPayload(User $user): array
    {
        $userCode = $this->assignInstructorCodeIfMissing($user);
        $expirationMinutes = (int) config('sanctum.expiration', 10080);
        $expiresAt = now()->addMinutes($expirationMinutes);
        $token = $user->createToken('instructor_onboarding_token', ['*'], $expiresAt);

        return [
            'token' => $token->plainTextToken,
            'expiresAt' => $expiresAt->toDateTimeString(),
            'user' => [
                'id' => $user->id,
                'code' => $userCode,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'dob' => optional($user->dob)->format('Y-m-d'),
                'gender' => filled($user->gender) ? (string) $user->gender : null,
                'hasPassword' => filled($user->password),
            ],
        ];
    }

    private function validateInstructorCompletion(User $user): array
    {
        $errors = [];
        $instructor = $this->loadInstructorProfile($user->id);

        if (!filled($user->name)) {
            $errors['fullName'][] = 'Full name is required.';
        }

        if (!filled($user->phone)) {
            $errors['mobileNumber'][] = 'Mobile number is required.';
        }

        if (!filled($user->gender)) {
            $errors['gender'][] = 'Gender is required.';
        }

        if (!filled($user->dob)) {
            $errors['dob'][] = 'Date of birth is required.';
        }

        if (!filled($user->password)) {
            $errors['password'][] = 'Password is required.';
        }

        $requiredInstructorFields = [
            'country' => $instructor->country,
            'preferredLanguage' => $instructor->preferredLanguage,
            'professionalHeadline' => $instructor->headline,
            'bio' => $instructor->bio,
            'currentJobTitle' => $instructor->currentJobTitle,
            'currentOrganization' => $instructor->currentOrganization,
            'highestQualification' => $instructor->qualification,
            'accountHolderName' => $instructor->bankAccountHolderName,
            'bankName' => $instructor->bankName,
            'accountNumber' => $instructor->bankAccountNumber,
            'ifscCode' => $instructor->bankIfscCode,
            'accountType' => $instructor->bankAccountType,
            'bankBranchName' => $instructor->bankBranchName,
        ];

        foreach ($requiredInstructorFields as $field => $value) {
            if (!filled($value)) {
                $errors[$field][] = 'This field is required.';
            }
        }

        if ($instructor->experienceYears === null) {
            $errors['yearsOfExperience'][] = 'Years of experience is required.';
        }

        if ($instructor->skills->isEmpty()) {
            $errors['skills'][] = 'Select at least one skill.';
        }

        if ($instructor->categories->isEmpty()) {
            $errors['teachingCategories'][] = 'Select at least one teaching category.';
        }

        if ($instructor->languages->isEmpty()) {
            $errors['languagesYouCanTeach'][] = 'Select at least one teaching language.';
        }

        $requiredDocuments = [
            'profilePhoto' => 'Profile photo is required.',
            'governmentId' => 'Government ID is required.',
            'resume' => 'Resume is required.',
            'certifications' => 'At least one certification is required.',
        ];

        if (!$this->hasDocumentType($user->id, 'profilePhoto')) {
            $errors['profilePhoto'][] = $requiredDocuments['profilePhoto'];
        }

        if (!$this->hasDocumentType($user->id, 'governmentId')) {
            $errors['governmentId'][] = $requiredDocuments['governmentId'];
        }

        if (!$this->hasDocumentType($user->id, 'resume')) {
            $errors['resume'][] = $requiredDocuments['resume'];
        }

        if (!$this->hasDocumentType($user->id, 'certification')) {
            $errors['certifications'][] = $requiredDocuments['certifications'];
        }

        return $errors;
    }

    private function determineFlowType(
        bool $hadExistingUser,
        ?Instructor $existingInstructor,
        User $user
    ): string {
        if (!$hadExistingUser) {
            return 'new';
        }

        if ($existingInstructor && ((int) ($existingInstructor->onboardingStep ?: 1) > 1 || (bool) $existingInstructor->onboardingCompleted)) {
            return 'resume';
        }

        if (filled($user->name) || filled($user->phone) || filled($user->password)) {
            return 'roleUpgrade';
        }

        return 'resume';
    }

    private function resolveFlowTypeAfterVerification(User $user, Instructor $instructor): string
    {
        if ((int) ($instructor->onboardingStep ?: 1) > 1 || (bool) $instructor->onboardingCompleted) {
            return 'resume';
        }

        if (filled($user->name) || filled($user->phone) || filled($user->password)) {
            return 'roleUpgrade';
        }

        return 'new';
    }

    private function resolveInstructorUserByEmail(string $email): ?User
    {
        return User::query()
            ->where('email', strtolower(trim($email)))
            ->where('role', 3)
            ->orderByDesc('id')
            ->first();
    }

    private function normalizeStep(int $step): int
    {
        return max(1, min(6, $step));
    }

    private function normalizeBankVerificationStatus(?string $status): string
    {
        $normalizedStatus = trim((string) $status);

        foreach (self::BANK_VERIFICATION_STATUSES as $allowedStatus) {
            if (strcasecmp($normalizedStatus, $allowedStatus) === 0) {
                return $allowedStatus;
            }
        }

        return self::BANK_VERIFICATION_NOT_SUBMITTED;
    }

    private function syncUserProfileStage(User $user, int $stage): void
    {
        $user->profileStage = max((int) ($user->profileStage ?? 0), max(0, $stage));
    }

    private function phoneExists(string $mobileNumber, ?int $ignoreUserId = null): bool
    {
        return User::query()
            ->when($ignoreUserId, fn($query) => $query->where('id', '!=', $ignoreUserId))
            ->where('phone', $mobileNumber)
            ->exists();
    }

    private function sanitizeText(?string $value): string
    {
        return trim(strip_tags((string) $value));
    }

    private function sanitizeList(array $items): array
    {
        $unique = [];

        foreach ($items as $item) {
            $value = $this->sanitizeText((string) $item);
            if ($value === '') {
                continue;
            }

            $unique[strtolower($value)] = $value;
        }

        return array_values($unique);
    }

    private function sanitizeUrl(?string $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized === '' ? null : filter_var($normalized, FILTER_SANITIZE_URL);
    }

    private function createDocumentRecord(
        int $userId,
        string $documentType,
        ?UploadedFile $file,
        string $directory,
        array &$storedPaths
    ): ?InstructorDocument {
        if (!$file) {
            return null;
        }

        $storedFile = $this->storeInstructorFile($file, $directory);
        $storedPaths[] = $storedFile['filePath'];

        return InstructorDocument::create([
            'userId' => $userId,
            'documentType' => $documentType,
            'filePath' => $storedFile['filePath'],
        ]);
    }

    private function replaceSingleDocument(
        int $userId,
        string $documentType,
        ?UploadedFile $file,
        string $directory,
        array &$storedPaths,
        array &$oldPaths
    ): void {
        $existingDocuments = InstructorDocument::where('userId', $userId)
            ->where('documentType', $documentType)
            ->get();

        foreach ($existingDocuments as $document) {
            $oldPaths[] = $document->filePath;
            $document->delete();
        }

        $this->createDocumentRecord($userId, $documentType, $file, $directory, $storedPaths);
    }

    private function replaceMultipleDocuments(
        int $userId,
        string $documentType,
        array $files,
        string $directory,
        array &$storedPaths,
        array &$oldPaths
    ): void {
        $existingDocuments = InstructorDocument::where('userId', $userId)
            ->where('documentType', $documentType)
            ->get();

        foreach ($existingDocuments as $document) {
            $oldPaths[] = $document->filePath;
            $document->delete();
        }

        foreach ($files as $file) {
            if ($file instanceof UploadedFile) {
                $this->createDocumentRecord($userId, $documentType, $file, $directory, $storedPaths);
            }
        }
    }

    private function storeInstructorFile(UploadedFile $file, string $directory): array
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin');
        $fileName = now()->format('YmdHis') . '-' . Str::uuid() . '.' . $extension;
        $storageDirectory = $this->normalizeInstructorDirectory($directory);
        $filePath = $storageDirectory . '/' . $fileName;
        $disk = Storage::disk('private');

        if (!$disk->putFileAs($storageDirectory, $file, $fileName)) {
            throw new \RuntimeException('Unable to store instructor file.');
        }

        return [
            'filePath' => $filePath,
        ];
    }

    private function cleanupStoredFiles(array $paths): void
    {
        $disk = Storage::disk('private');

        foreach (array_filter($paths) as $path) {
            $normalizedPath = $this->normalizeInstructorStoragePath((string) $path);

            if ($disk->exists($normalizedPath)) {
                $disk->delete($normalizedPath);
            }
        }
    }

    private function storeProfileImage(UploadedFile $file, string $directory): string
    {
        $fileName = $this->makeProfileFileName($file);
        $disk = Storage::disk('private');
        $storageDirectory = $this->profileStorageDirectory($directory);

        if (!$disk->putFileAs($storageDirectory, $file, $fileName)) {
            throw new \RuntimeException('Unable to store instructor profile image.');
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
                throw new \RuntimeException('Unable to create instructor profile thumbnail directory.');
            }
        }

        if (!$this->writeCroppedThumbnail($imagePath, $targetPath, $extension)) {
            if (!is_file($imagePath)) {
                throw new \RuntimeException('Stored instructor profile image could not be found for thumbnail generation.');
            }

            if (!copy($imagePath, $targetPath)) {
                throw new \RuntimeException('Unable to create instructor profile thumbnail.');
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
        } catch (Throwable $exception) {
            Log::warning('Unable to create instructor profile thumbnail', [
                'message' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    private function cleanupProfileFiles(array $files): void
    {
        $disk = Storage::disk('private');

        foreach ($files as [$directory, $fileName]) {
            if (!$fileName) {
                continue;
            }

            foreach ([
                $this->profileStoragePath((string) $directory, (string) $fileName),
                $this->legacyProfileStoragePath((string) $directory, (string) $fileName),
            ] as $path) {
                if ($disk->exists($path)) {
                    $disk->delete($path);
                }
            }
        }
    }

    private function makeProfileFileName(UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: 'jpg');

        return Str::uuid() . '.' . $extension;
    }

    private function hasDocumentType(int $userId, string $documentType): bool
    {
        return InstructorDocument::where('userId', $userId)
            ->where('documentType', $documentType)
            ->exists();
    }

    private function publicUploadUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        return $this->privateFileUrl($this->normalizeInstructorStoragePath($path));
    }

    private function normalizeInstructorDirectory(string $directory): string
    {
        $normalizedDirectory = trim(str_replace('\\', '/', $directory), '/');

        if ($normalizedDirectory === '') {
            return 'uploads/instructors';
        }

        return str_starts_with($normalizedDirectory, 'uploads/instructors/')
            ? $normalizedDirectory
            : 'uploads/instructors/' . $normalizedDirectory;
    }

    private function normalizeInstructorStoragePath(string $path): string
    {
        $normalizedPath = trim(str_replace('\\', '/', urldecode($path)), '/');

        if (
            $normalizedPath === '' ||
            str_starts_with($normalizedPath, 'uploads/instructors/')
        ) {
            return $normalizedPath;
        }

        return 'uploads/instructors/' . $normalizedPath;
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

    private function privateFileUrl(string $path): string
    {
        $requestUrl = request()->url();
        $apiPosition = strpos($requestUrl, '/api/');
        $baseUrl = $apiPosition === false
            ? request()->getSchemeAndHttpHost()
            : substr($requestUrl, 0, $apiPosition);

        return $baseUrl . '/api/getAfile?path=' . rawurlencode(trim($path, '/'));
    }

    private function successResponse(string $message, array $data = [], int $statusCode = 200)
    {
        return response()->json([
            'status' => true,
            'message' => $message,
            'data' => $data,
        ], $statusCode);
    }

    private function errorResponse(string $message, array $errors = [], int $statusCode = 422)
    {
        return response()->json([
            'status' => false,
            'message' => $message,
            'errors' => $errors,
        ], $statusCode);
    }

    private function sendInstructorOtpMail(string $email, string $otp): void
    {
        Mail::html("
        <!DOCTYPE html>
        <html lang='en'>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>ICETL Instructor Verification</title>
        </head>
        <body style='margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;'>
            <table width='100%' cellpadding='0' cellspacing='0' style='background:#f4f7fb;padding:40px 15px;'>
                <tr>
                    <td align='center'>
                        <table width='100%' cellpadding='0' cellspacing='0' style='max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 15px 40px rgba(0,0,0,0.08);'>
                            <tr>
                                <td align='center' style='padding:45px 30px;background:linear-gradient(135deg,#2563eb,#0ea5e9);'>
                                    <h1 style='margin:0;color:#ffffff;font-size:36px;font-weight:800;letter-spacing:1px;text-transform:uppercase;font-family:Arial,sans-serif;'>
                                        ICETL
                                    </h1>
                                    <p style='margin:10px 0 0 0;color:rgba(255,255,255,0.92);font-size:15px;letter-spacing:1px;font-weight:500;'>
                                        ICE TECHNOLOGY LAB
                                    </p>
                                    <h1 style='margin:18px 0 0 0;color:#ffffff;font-size:34px;font-weight:700;letter-spacing:-0.5px;'>
                                        Become an Instructor
                                    </h1>
                                    <p style='margin:14px 0 0 0;color:rgba(255,255,255,0.92);font-size:16px;line-height:24px;'>
                                        Verify your email to continue your premium instructor onboarding journey.
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td style='padding:50px 40px;text-align:center;'>
                                    <h2 style='margin:0;color:#111827;font-size:30px;font-weight:700;'>
                                        Your secure verification code
                                    </h2>
                                    <p style='margin:22px 0 0 0;color:#6b7280;font-size:17px;line-height:30px;'>
                                        Use this six-digit OTP to access or resume your ICETL instructor onboarding.
                                    </p>
                                    <div style='margin:40px 0;'>
                                        <div style='display:inline-block;background:#eff6ff;border:2px dashed #3b82f6;border-radius:18px;padding:22px 38px;box-shadow:0 8px 18px rgba(37,99,235,0.08);'>
                                            <span style='font-size:44px;font-weight:700;letter-spacing:14px;color:#2563eb;display:block;'>
                                                {$otp}
                                            </span>
                                        </div>
                                    </div>
                                    <p style='margin:0;color:#374151;font-size:16px;'>
                                        This OTP is valid for <strong>5 minutes</strong>.
                                    </p>
                                    <div style='margin-top:40px;background:#eff6ff;border-left:5px solid #2563eb;border-radius:14px;padding:18px 20px;text-align:left;'>
                                        <p style='margin:0;color:#1e40af;font-size:14px;line-height:24px;'>
                                            <strong>Security Tip:</strong> Never share your OTP with anyone. ICETL will never ask for your verification code.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <div style='height:1px;background:#e5e7eb;'></div>
                                </td>
                            </tr>
                            <tr>
                                <td align='center' style='padding:35px 30px;background:#f9fafb;'>
                                    <p style='margin:0;color:#6b7280;font-size:14px;line-height:26px;'>
                                        If you did not request this OTP, you can safely ignore this email.
                                    </p>
                                    <p style='margin:18px 0 0 0;color:#9ca3af;font-size:13px;'>
                                        &copy; " . date('Y') . " ICETL. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        ", function ($message) use ($email): void {
            $message->to($email)->subject('Your ICETL Instructor Verification Code');
        });
    }
}
