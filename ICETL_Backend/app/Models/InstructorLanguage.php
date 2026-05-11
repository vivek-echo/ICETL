<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InstructorLanguage extends Model
{
    use HasFactory;

    protected $table = 'instructorLanguages';

    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'userId',
        'languageName',
    ];

    public function instructor()
    {
        return $this->belongsTo(Instructor::class, 'userId', 'userId');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
