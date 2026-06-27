<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ModuleMaterial extends Model
{
    protected $table = 'moduleMaterials';

    protected $fillable = [
        'moduleType',
        'moduleId',
        'instructorId',
        'title',
        'description',
        'materialDate',
        'originalFileName',
        'storedFileName',
        'filePath',
        'fileExtension',
        'mimeType',
        'fileSize',
        'status',
        'deletedFlag',
        'createdBy',
        'updatedBy',
    ];

    protected $casts = [
        'moduleId' => 'integer',
        'instructorId' => 'integer',
        'fileSize' => 'integer',
        'status' => 'integer',
        'deletedFlag' => 'boolean',
        'materialDate' => 'date',
    ];
}
