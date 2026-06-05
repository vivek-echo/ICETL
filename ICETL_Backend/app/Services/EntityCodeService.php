<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class EntityCodeService
{
    public const PREFIX_MAIN_COURSE = 'MC';
    public const PREFIX_ACADEMIC_COURSE = 'AC';
    public const PREFIX_WORKSHOP = 'WS';
    public const PREFIX_SEMINAR = 'SM';
    public const PREFIX_LEARNER = 'LR';
    public const PREFIX_INSTRUCTOR = 'INS';

    public static function generateEntityCode(string $prefix, int $id): string
    {
        return strtoupper($prefix) . '_' . date('Y') . '_' . $id;
    }

    public static function assignIfMissing(string $table, int $id, string $prefix, string $primaryKey = 'id'): ?string
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, 'code')) {
            return null;
        }

        $record = DB::table($table)
            ->where($primaryKey, $id)
            ->lockForUpdate()
            ->first([$primaryKey, 'code']);

        if (!$record) {
            return null;
        }

        $existingCode = trim((string) ($record->code ?? ''));

        if ($existingCode !== '') {
            return $existingCode;
        }

        $code = self::generateEntityCode($prefix, $id);
        $payload = ['code' => $code];

        if (Schema::hasColumn($table, 'updatedOn')) {
            $payload['updatedOn'] = now();
        } elseif (Schema::hasColumn($table, 'updated_at')) {
            $payload['updated_at'] = now();
        }

        DB::table($table)
            ->where($primaryKey, $id)
            ->update($payload);

        return $code;
    }

    public static function codeSelect(string $table, string $alias = ''): mixed
    {
        if (Schema::hasTable($table) && Schema::hasColumn($table, 'code')) {
            return ($alias !== '' ? $alias . '.' : '') . 'code';
        }

        return DB::raw('NULL as code');
    }

    public static function orWhereCode($query, string $table, string $qualifiedColumn, string $search): void
    {
        if (Schema::hasTable($table) && Schema::hasColumn($table, 'code')) {
            $query->orWhere($qualifiedColumn, 'LIKE', '%' . $search . '%');
        }
    }
}
