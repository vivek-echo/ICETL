<h5 class="mb-3">Role List</h5>

<div class="table-card">

    <!-- Filter -->
    <div class="filter-bar">
        <div class="filter-item search-box">
            <i class="fa fa-search"></i>
            <input type="text" id="roleSearch" placeholder="Search role...">
        </div>
    </div>

    <!-- Table -->
    <div class="table-responsive">
        <table class="modern-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Role Name</th>
                    <th class="text-end">Action</th>
                </tr>
            </thead>

            <tbody id="roleTableBody"></tbody>
        </table>
    </div>

    <!-- Footer -->
    <!-- Pagination -->
    <div class="table-footer">
        <span>Showing 1 of 10</span>

        <div class="pagination">
            <button class="page-btn">Prev</button>
            <button class="page-btn active">1</button>
            <button class="page-btn">Next</button>
        </div>
    </div>

</div>

<script>
    let rolePage = 1;

    function loadRoles(page = 1) {

        rolePage = page;

        let search = document.getElementById('roleSearch').value;

        fetch(`/console/getRoles?page=${page}&search=${search}`)
            .then(res => res.json())
            .then(res => {

                let tbody = document.getElementById('roleTableBody');
                tbody.innerHTML = '';

                if (res.data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="3">No roles found</td></tr>`;
                    return;
                }

                res.data.forEach((item, index) => {
                    tbody.innerHTML += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.roleName}</td>
                        <td class="text-end">
                            <button class="btn-icon delete" data-id="${item.id}">
                                <i class="fa fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                });

                renderRolePagination(res);
            });
    }
</script>

<script>
    function renderRolePagination(res) {

    let container = document.getElementById('paginationContainer');
    let info = document.getElementById('paginationInfo');

    if (!container || !info) {
        console.warn('Pagination elements not found');
        return;
    }

    container.innerHTML = '';

    info.innerText = `Page ${res.page} of ${res.lastPage}`;

    if (res.lastPage <= 1) return;

    if (res.page > 1) {
        container.innerHTML += `<button onclick="loadRoles(${res.page - 1})">Prev</button>`;
    }

    for (let i = 1; i <= res.lastPage; i++) {
        container.innerHTML += `
            <button class="${i === res.page ? 'active' : ''}" 
                onclick="loadRoles(${i})">${i}</button>
        `;
    }

    if (res.page < res.lastPage) {
        container.innerHTML += `<button onclick="loadRoles(${res.page + 1})">Next</button>`;
    }
}
</script>

<script>
    document.addEventListener('click', function(e) {

        if (!e.target.closest('.delete')) return;

        let id = e.target.closest('.delete').dataset.id;

        Swal.fire({
            title: 'Delete role?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes'
        }).then((result) => {

            if (!result.isConfirmed) return;

            fetch("{{ route('deleteRole') }}", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('input[name="_token"]').value
                    },
                    body: JSON.stringify({
                        id
                    })
                })
                .then(res => res.json())
                .then(res => {

                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted',
                        text: res.message,
                        timer: 1500,
                        showConfirmButton: false
                    });

                    loadRoles(rolePage);
                });
        });
    });
</script>

<script>
    document.addEventListener('DOMContentLoaded', () => {
        loadRoles();
    });

    let timer;
    document.getElementById('roleSearch').addEventListener('keyup', () => {
        clearTimeout(timer);
        timer = setTimeout(() => loadRoles(1), 400);
    });
</script>