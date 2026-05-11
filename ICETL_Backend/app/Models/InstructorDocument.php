<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InstructorDocument extends Model
{
    use HasFactory;

    protected $table = 'instructorDocuments';

    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'userId',
        'documentType',
        'filePath',
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
