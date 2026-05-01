<h5 class="mb-3">Add Role</h5>

<form id="roleForm">
    @csrf

    <div class="form-group">
        <label class="form-label">Role Name <span class="text-danger">*</span></label>
        <input type="text" name="roleName" class="form-control" placeholder="Enter role name">
    </div>

    <div class="mt-3">
        <button type="submit" class="btn-main" id="roleSubmitBtn">
            <span id="roleBtnText"><i class="fa-solid fa-check-to-slot me-1"></i>Save Role</span>
            <span id="roleSpinner" class="spinner d-none"></span>
        </button>
    </div>
</form>

<script>
document.getElementById('roleForm').addEventListener('submit', function(e) {
    e.preventDefault();

    let form = this;
    let formData = new FormData(form);

    // Trim
    let roleName = formData.get('roleName')?.trim();
    formData.set('roleName', roleName);

    if (!roleName) {
        Swal.fire({
            icon: 'warning',
            title: 'Validation',
            text: 'Role name is required'
        });
        return;
    }

    let btn = document.getElementById('roleSubmitBtn');
    let text = document.getElementById('roleBtnText');
    let spinner = document.getElementById('roleSpinner');

    btn.disabled = true;
    text.innerText = "Saving...";
    spinner.classList.remove('d-none');

    fetch("{{ route('storeRole') }}", {
        method: "POST",
        headers: {
            'X-CSRF-TOKEN': document.querySelector('input[name="_token"]').value
        },
        body: formData
    })
    .then(async res => {
        let data = await res.json();

        if (res.status === 200) {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: data.message,
                timer: 1500,
                showConfirmButton: false
            });

            form.reset();
            return;
        }

        if (res.status === 409 || res.status === 422) {
            Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: data.message
            });
            return;
        }

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: data.message || 'Something went wrong'
        });

    })
    .catch(() => {
        Swal.fire({
            icon: 'error',
            title: 'Network Error'
        });
    })
    .finally(() => {
        btn.disabled = false;
        text.innerText = "Save Role";
        spinner.classList.add('d-none');
    });
});
</script>