<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Certificate extends Model
{
    protected $table = 'certificates';

    public $timestamps = false;

    protected $fillable = [
        'certificateNo',
        'userId',
        'moduleType',
        'moduleId',
        'enrollmentId',
        'studentName',
        'studentId',
        'moduleTitle',
        'durationText',
        'courseCategory',
        'grade',
        'gender',
        'venue',
        'score',
        'issueDate',
        'completionDate',
        'verificationCode',
        'verificationUrl',
        'certificatePdfPath',
        'status',
        'createdBy',
        'createdOn',
        'updatedOn',
        'deletedFlag',
        'startDate',
        'endDate',
    ];
}