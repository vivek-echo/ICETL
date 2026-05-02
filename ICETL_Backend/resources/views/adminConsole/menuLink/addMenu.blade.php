<h5 class="mb-3">Add New Menu</h5>

<form id="menuForm">
    @csrf

    <!-- Menu Type -->
    <div class="form-group">
        <label class="form-label">Menu Type<span class="text-danger">*</span></label>
        <select name="type" id="menuType" class="form-control">
            <option value="">Select Type</option>
            <option value="1">Global Link</option>
            <option value="2">Primary Link</option>
            <option value="3">Tabs</option>
        </select>
    </div>

    <!-- Global Link -->
    <div class="form-group d-none" id="globalLinkDiv">
        <label class="form-label">Select Global Link<span class="text-danger">*</span></label>
        <select name="globalLink" id="globalLink" class="form-control"></select>
    </div>

    <!-- Primary Link -->
    <div class="form-group d-none" id="primaryLinkDiv">
        <label class="form-label">Select Primary Link<span class="text-danger">*</span></label>
        <select name="primaryLink" id="primaryLink" class="form-control"></select>
    </div>

    <!-- Menu Name -->
    <div class="form-group">
        <label class="form-label">Menu Name<span class="text-danger">*</span></label>
        <input type="text" name="name" class="form-control">
    </div>

    <!-- Menu URL -->
    <div class="form-group">
        <label class="form-label">Menu URL<span class="text-danger">*</span></label>
        <input type="text" name="url" class="form-control" placeholder="/example-route">
    </div>

    <!-- Menu Icon -->
    <div class="form-group">
        <label class="form-label">Menu Icon<span class="text-danger">*</span></label>
        <input type="text" name="icon" class="form-control" placeholder="fa-solid fa-home">
    </div>

    <!-- Buttons -->
    <div class="d-flex gap-2 mt-3">
        <button type="submit" class="btn-main"><i class="fa-solid fa-check-to-slot me-1"></i>Add Menu</button>

        <button type="button" class="btn-reset" onclick="resetForm()">
            Reset
        </button>
    </div>

</form>
<script>
    document.getElementById('menuType').addEventListener('change', function() {

        let type = this.value;

        let globalDiv = document.getElementById('globalLinkDiv');
        let primaryDiv = document.getElementById('primaryLinkDiv');

        let globalSelect = document.getElementById('globalLink');
        let primarySelect = document.getElementById('primaryLink');

        // Reset visibility
        globalDiv.classList.add('d-none');
        primaryDiv.classList.add('d-none');

        // Reset values
        globalSelect.innerHTML = '<option value="">Select Global Menu</option>';
        primarySelect.innerHTML = '<option value="">Select Primary Menu</option>';

        // 🔥 Load based on type
        if (type == 2) {
            globalDiv.classList.remove('d-none');
            loadGlobalMenus(); // 🔥 important
        } else if (type == 3) {
            globalDiv.classList.remove('d-none');
            primaryDiv.classList.remove('d-none');
            loadGlobalMenus(); // 🔥 important
        }

    });
</script>

<script>
    document.getElementById('globalLink').addEventListener('change', function() {

        let parentId = this.value;

        let primarySelect = document.getElementById('primaryLink');

        // Reset primary dropdown
        primarySelect.innerHTML = '<option value="">Select Primary Menu</option>';

        if (!parentId) return;

        loadPrimaryMenu(parentId);
    });



    function loadGlobalMenus() {


        fetch("{{ url('/console/getGlobalMenus') }}")
            .then(res => res.json())
            .then(data => {
                let select = document.getElementById('globalLink');
                select.innerHTML = '<option value="">Select Global Menu</option>';

                data.forEach(item => {
                    select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
                });

            });
    }

    function loadPrimaryMenu(parentId) {

        let select = document.getElementById('primaryLink');
        select.innerHTML = '<option>Loading...</option>';
        select.disabled = true;

        fetch(`{{ url('/console/getPrimaryMenus') }}/${parentId}`)
            .then(res => res.json())
            .then(data => {
                select.innerHTML = '<option value="">Select Primary Menu</option>';

                data.forEach(item => {
                    select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
                });

                select.disabled = false;
            });
    }
</script>

<script>
    function resetForm() {

        let form = document.getElementById('menuForm');
        form.reset();

        document.getElementById('globalLinkDiv').classList.add('d-none');
        document.getElementById('primaryLinkDiv').classList.add('d-none');

        document.getElementById('globalLink').innerHTML = '<option value="">Select Global Menu</option>';
        document.getElementById('primaryLink').innerHTML = '<option value="">Select Primary Menu</option>';
    }
</script>

<script>
    document.getElementById('menuForm').addEventListener('submit', function(e) {
        e.preventDefault();
        showLoader();
        let form = this;
        let formData = new FormData(form);

        // 🔥 ADD HERE
        formData.set('name', formData.get('name')?.trim());
        formData.set('url', formData.get('url')?.trim());
        formData.set('icon', formData.get('icon')?.trim());

        // Then your fetch

        fetch("{{ route('storeMenu') }}", {
                method: "POST",
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('input[name="_token"]').value
                },
                body: formData
            })
            .then(async response => {

                let data;

                try {
                    data = await response.json();
                } catch {
                    throw new Error("Invalid JSON response");
                }

                // ✅ SUCCESS
                if (response.status === 200) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: data.message,
                        timer: 1500,
                        showConfirmButton: false
                    });

                    // Reset form
                    form.reset();
                    document.getElementById('globalLinkDiv').classList.add('d-none');
                    document.getElementById('primaryLinkDiv').classList.add('d-none');

                    return;
                }

                // ⚠️ VALIDATION ERROR (422)
                if (response.status === 422) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Validation Error',
                        text: data.message
                    });
                    return;
                }

                // ⚠️ DUPLICATE (409)
                if (response.status === 409) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Duplicate',
                        text: data.message
                    });
                    return;
                }

                // ❌ SERVER ERROR (500)
                if (response.status === 500) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Server Error',
                        text: data.message || 'Something went wrong'
                    });
                    return;
                }

                // ❌ FALLBACK
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Unexpected error occurred'
                });

            })
            .catch(error => {
                console.error(error);

                Swal.fire({
                    icon: 'error',
                    title: 'Network Error',
                    text: 'Unable to process request. Check connection.'
                });
            }).finally(() => {
                hideLoader(); // 🔥 IMPORTANT
            });
    });
</script>