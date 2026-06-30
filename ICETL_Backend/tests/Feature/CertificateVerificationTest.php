<?php

namespace Tests\Feature;

use App\Models\Certificate;
use App\Services\CertificateVerificationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CertificateVerificationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => false,
            ],
            'certificate.frontend_url' => 'http://localhost:4200',
            'cache.default' => 'array',
        ]);

        DB::setDefaultConnection('sqlite');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->createCertificatesTable();
    }

    public function test_valid_certificate_verification_returns_safe_public_data(): void
    {
        $verificationCode = '7f315f62-9a92-4d50-b283-eed79bb1e811';
        $this->makeCertificate([
            'verificationCode' => $verificationCode,
            'verificationUrl' => 'http://localhost:4200/verify-certificate/' . $verificationCode,
        ]);

        $response = $this->getJson('/api/public/certificates/verify/' . $verificationCode);

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Certificate verified successfully.')
            ->assertJsonPath('data.isValid', true)
            ->assertJsonPath('data.certificateNo', 'ICETL-C-2026-000001')
            ->assertJsonPath('data.studentName', 'Student Name')
            ->assertJsonPath('data.moduleTypeLabel', 'Course Completion')
            ->assertJsonPath('data.issueDate', '30 June 2026')
            ->assertJsonPath('data.completionDate', '29 June 2026');

        $data = $response->json('data');

        foreach (['id', 'userId', 'enrollmentId', 'certificatePdfPath', 'createdBy', 'createdOn', 'updatedOn', 'deletedFlag'] as $unsafeField) {
            $this->assertArrayNotHasKey($unsafeField, $data);
        }
    }

    public function test_invalid_verification_code_returns_not_found_response(): void
    {
        $response = $this->getJson('/api/public/certificates/verify/7f315f62-9a92-4d50-b283-eed79bb1e812');

        $response
            ->assertNotFound()
            ->assertJsonPath('success', false)
            ->assertJsonPath('data.isValid', false);
    }

    public function test_inactive_certificate_returns_clear_invalid_response(): void
    {
        $verificationCode = '7f315f62-9a92-4d50-b283-eed79bb1e813';
        $this->makeCertificate([
            'verificationCode' => $verificationCode,
            'status' => 0,
        ]);

        $response = $this->getJson('/api/public/certificates/verify/' . $verificationCode);

        $response
            ->assertOk()
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Certificate has been revoked or is inactive.')
            ->assertJsonPath('data.isValid', false)
            ->assertJsonPath('data.status', 'Inactive');
    }

    public function test_deleted_certificate_is_not_exposed(): void
    {
        $verificationCode = '7f315f62-9a92-4d50-b283-eed79bb1e814';
        $this->makeCertificate([
            'verificationCode' => $verificationCode,
            'deletedFlag' => 1,
        ]);

        $response = $this->getJson('/api/public/certificates/verify/' . $verificationCode);

        $response
            ->assertNotFound()
            ->assertJsonPath('success', false)
            ->assertJsonPath('data.isValid', false);
    }

    public function test_public_verification_route_does_not_require_authentication(): void
    {
        $verificationCode = '7f315f62-9a92-4d50-b283-eed79bb1e815';
        $this->makeCertificate(['verificationCode' => $verificationCode]);

        $response = $this->getJson('/api/public/certificates/verify/' . $verificationCode);

        $response->assertOk();
    }

    public function test_existing_verification_code_is_reused_when_url_is_refreshed(): void
    {
        $verificationCode = '7f315f62-9a92-4d50-b283-eed79bb1e816';
        $certificate = $this->makeCertificate([
            'verificationCode' => $verificationCode,
            'verificationUrl' => 'http://old.example/verify-certificate/old-code',
        ]);

        $changed = app(CertificateVerificationService::class)->ensureVerificationDetails($certificate);

        $this->assertTrue($changed);
        $this->assertSame($verificationCode, $certificate->verificationCode);
        $this->assertSame(
            'http://localhost:4200/verify-certificate/' . $verificationCode,
            $certificate->verificationUrl
        );
    }

    private function createCertificatesTable(): void
    {
        Schema::connection('sqlite')->create('certificates', function (Blueprint $table) {
            $table->id();
            $table->string('certificateNo')->unique();
            $table->unsignedBigInteger('userId')->nullable();
            $table->string('moduleType', 40);
            $table->unsignedBigInteger('moduleId')->nullable();
            $table->unsignedBigInteger('enrollmentId')->nullable();
            $table->string('studentName')->nullable();
            $table->string('studentId')->nullable();
            $table->string('moduleTitle')->nullable();
            $table->string('durationText')->nullable();
            $table->string('courseCategory')->nullable();
            $table->string('grade', 20)->nullable();
            $table->unsignedTinyInteger('gender')->nullable();
            $table->string('venue')->nullable();
            $table->unsignedSmallInteger('score')->nullable();
            $table->date('issueDate')->nullable();
            $table->date('completionDate')->nullable();
            $table->string('verificationCode', 100)->nullable()->unique();
            $table->string('verificationUrl', 500)->nullable();
            $table->string('certificatePdfPath')->nullable();
            $table->unsignedTinyInteger('status')->default(1);
            $table->unsignedBigInteger('createdBy')->nullable();
            $table->timestamp('createdOn')->nullable();
            $table->timestamp('updatedOn')->nullable();
            $table->unsignedTinyInteger('deletedFlag')->default(0);
            $table->date('startDate')->nullable();
            $table->date('endDate')->nullable();
        });
    }

    private function makeCertificate(array $overrides = []): Certificate
    {
        $defaults = [
            'certificateNo' => 'ICETL-C-2026-000001',
            'userId' => 10,
            'moduleType' => 'COURSE',
            'moduleId' => 15,
            'enrollmentId' => 20,
            'studentName' => 'Student Name',
            'studentId' => 'ICETL-ST-001',
            'moduleTitle' => 'Angular Development',
            'durationText' => '6 Weeks',
            'courseCategory' => 'Web Development',
            'grade' => 'A',
            'issueDate' => '2026-06-30',
            'completionDate' => '2026-06-29',
            'verificationCode' => '7f315f62-9a92-4d50-b283-eed79bb1e800',
            'verificationUrl' => 'http://localhost:4200/verify-certificate/7f315f62-9a92-4d50-b283-eed79bb1e800',
            'certificatePdfPath' => 'certificates/ICETL-C-2026-000001.pdf',
            'status' => 1,
            'createdBy' => 10,
            'createdOn' => now(),
            'updatedOn' => now(),
            'deletedFlag' => 0,
        ];

        return Certificate::create([...$defaults, ...$overrides]);
    }
}
