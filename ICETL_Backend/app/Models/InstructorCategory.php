<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InstructorCategory extends Model
{
    use HasFactory;

    protected $table = 'instructorCategories';

    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = 'updatedAt';

    protected $fillable = [
        'userId',
        'categoryName',
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
