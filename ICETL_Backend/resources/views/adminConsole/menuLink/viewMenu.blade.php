

    <!-- Header -->
    <div class="table-header">
        <h5>Menu List</h5>

        <div class="table-actions">
            <div class="filter-bar">

                <!-- Search -->
                <div class="filter-item search-box">
                    <i class="fa fa-search"></i>
                    <input type="text" id="searchInput" placeholder="Search menu...">
                </div>

                <!-- Type Filter -->
                <div class="filter-item">
                    <select id="typeFilter">
                        <option value="">All Types</option>
                        <option value="1">Global</option>
                        <option value="2">Primary</option>
                        <option value="3">Tabs</option>
                    </select>
                </div>

                <!-- Clear -->
                <div class="filter-item">
                    <button class="btn-clear" onclick="resetFilters()">
                        <i class="fa fa-rotate-left"></i> Reset
                    </button>
                </div>

            </div>
        </div>
    </div>

    <!-- Table -->
    <div class="table-responsive">
        <table class="modern-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Menu Name</th>
                    <th>Menu Type</th>
                    <th>Global</th>
                    <th>Primary</th>
                    <th>Menu URL</th>
                    <th>Menu Icon</th>
                    <th class="text-end">Action</th>
                </tr>
            </thead>

            <tbody id="menuTableBody"></tbody>
        </table>
    </div>

    <!-- Pagination -->
    <div class="table-footer">
        <span>Showing 1 of 10</span>

        <div class="pagination">
            <button class="page-btn">Prev</button>
            <button class="page-btn active">1</button>
            <button class="page-btn">Next</button>
        </div>
    </div>


<script>
    let currentPage = 1;

    function loadMenus(page = 1) {

        currentPage = page;

        let search = document.getElementById('searchInput').value;
        let type = document.getElementById('typeFilter').value;

        fetch(`/console/getMenus?page=${page}&search=${search}&type=${type}`)
            .then(res => res.json())
            .then(res => {

                let tbody = document.getElementById('menuTableBody');
                tbody.innerHTML = '';

                if (res.data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5">No data found</td></tr>`;
                    return;
                }

                res.data.forEach((item, index) => {

                    let typeLabel = '';
                    if (item.type == 1) typeLabel = 'Global';
                    if (item.type == 2) typeLabel = 'Primary';
                    if (item.type == 3) typeLabel = 'Tabs';

                    let global = '-';
                    let primary = '-';

                    if (item.type == 2) {
                        global = item.parentName ?? '-';
                    }

                    if (item.type == 3) {
                        primary = item.parentName ?? '-';
                        global = item.grandParentName ?? '-';
                    }

                    tbody.innerHTML += `
        <tr>
            <td>${index + 1}</td>
            <td>${item.name}</td>
            <td>${typeLabel}</td>
            <td>${global}</td>
            <td>${primary}</td>
            <td>${item.url ?? '-'}</td>
            <td>${item.icon ?? '-'} - <i class="${item.icon}"></i></td>
            <td class="text-end">
                <button class="btn-icon delete" onclick="deleteMenu('${item.id}')"   >
    <i class="fa fa-trash"></i>
</button>
            </td>
        </tr>
    `;
                });

                renderPagination(res);

            });
    }
</script>

<script>
    function renderPagination(res) {

        let pagination = document.querySelector('.pagination');
        pagination.innerHTML = '';

        if (res.page > 1) {
            pagination.innerHTML += `<button class="page-btn" onclick="loadMenus(${res.page - 1})">Prev</button>`;
        }

        for (let i = 1; i <= res.lastPage; i++) {
            pagination.innerHTML += `
            <button class="page-btn ${i === res.page ? 'active' : ''}" 
                onclick="loadMenus(${i})">${i}</button>
        `;
        }

        if (res.page < res.lastPage) {
            pagination.innerHTML += `<button class="page-btn" onclick="loadMenus(${res.page + 1})">Next</button>`;
        }

        // footer text
        document.querySelector('.table-footer span').innerText =
            `Showing page ${res.page} of ${res.lastPage}`;
    }
</script>

<script>
    document.addEventListener('DOMContentLoaded', () => {
        loadMenus();
    });

    // 🔍 Live search (debounce)
    let timer;
    document.getElementById('searchInput').addEventListener('keyup', () => {
        clearTimeout(timer);
        timer = setTimeout(() => loadMenus(1), 400);
    });

    // 🔍 Type filter
    document.getElementById('typeFilter').addEventListener('change', () => {
        loadMenus(1);
    });
</script>

<script>
function deleteMenu(id) {
    Swal.fire({
        title: 'Are you sure?',
        text: "This will delete the menu",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#8e2de2',
        cancelButtonColor: '#ccc',
        confirmButtonText: 'Yes, delete it'
    }).then((result) => {

        if (!result.isConfirmed) return;

        showLoader();

        fetch("{{ route('deleteMenu') }}", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('input[name="_token"]').value
            },
            body: JSON.stringify({ id: id })
        })
        .then(async response => {
            let data = await response.json();

            if (response.status === 200) {

                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: data.message,
                    timer: 1500,
                    showConfirmButton: false
                });

                loadMenus(currentPage); // 🔥 refresh table
                return;
            }

            if (response.status === 409 || response.status === 422) {
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
            hideLoader();
        });

    });
}
</script>

<script>
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('typeFilter').value = '';

    loadMenus(1); // reload table
}
</script>