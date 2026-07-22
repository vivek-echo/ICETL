<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Instructor extends Model
{
    use HasFactory;

    protected $table = 'instructors';

    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'userId',
        'headline',
        'bio',
        'experienceYears',
        'currentJobTitle',
        'currentOrganization',
        'qualification',
        'country',
        'preferredLanguage',
        'linkedinUrl',
        'githubUrl',
        'youtubeUrl',
        'portfolioUrl',
        'bankAccountHolderName',
        'bankName',
        'bankAccountNumber',
        'bankIfscCode',
        'bankAccountType',
        'bankBranchName',
        'bankVerificationStatus',
        'onboardingStep',
        'onboardingCompleted',
        'approvalStatus',
        'status',
    ];

    protected $casts = [
        'experienceYears' => 'integer',
        'onboardingStep' => 'integer',
        'onboardingCompleted' => 'boolean',
        'status' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function skills()
    {
        return $this->hasMany(InstructorSkill::class, 'userId', 'userId');
    }

    public function categories()
    {
        return $this->hasMany(InstructorCategory::class, 'userId', 'userId');
    }

    public function languages()
    {
        return $this->hasMany(InstructorLanguage::class, 'userId', 'userId');
    }

    public function documents()
    {
        return $this->hasMany(InstructorDocument::class, 'userId', 'userId');
    }
}
