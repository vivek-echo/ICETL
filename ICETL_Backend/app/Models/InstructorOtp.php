<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InstructorOtp extends Model
{
    use HasFactory;

    protected $table = 'instructorOtps';

    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'userId',
        'email',
        'otp',
        'expiresAt',
        'verified',
    ];

    protected $casts = [
        'expiresAt' => 'datetime',
        'verified' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
