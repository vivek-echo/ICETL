@extends('adminConsole.layout.app')

@section('content')
<style>
    .log-badge {
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
    }

    .log-error {
        background: #fee2e2;
        color: #dc2626;
    }

    .log-warning {
        background: #fef3c7;
        color: #d97706;
    }

    .log-info {
        background: #e0f2fe;
        color: #0284c7;
    }
</style>

<h5 class="mb-3">System Logs</h5>

<div class="table-card">

    <!-- Filter -->
    <div class="filter-bar">
        <div class="search-box">
            <i class="fa fa-search"></i>
            <input type="text" id="logSearch" placeholder="Search logs...">
        </div>
    </div>

    <!-- Table -->
    <div class="table-responsive">
        <table class="modern-table">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Level</th>
                    <th>Message</th>
                    <th>Action</th>
                </tr>
            </thead>

            <tbody id="logTableBody"></tbody>
        </table>
    </div>

    <!-- Pagination -->
    <div class="table-footer">
        <span id="logPaginationInfo"></span>
        <div class="pagination" id="logPagination"></div>
    </div>

</div>

<script>
    let logPage = 1;

    function loadLogs(page = 1) {

        logPage = page;

        let search = document.getElementById('logSearch').value;

        showLoader();
        fetch(`{{ url('/console/getLogs') }}?page=${page}&search=${search}`)
            .then(res => res.json())
            .then(res => {

                let tbody = document.getElementById('logTableBody');
                tbody.innerHTML = '';

                if (!res.data.length) {
                    tbody.innerHTML = `<tr><td colspan="4">No logs found</td></tr>`;
                    return;
                }

                res.data.forEach(log => {

                    let levelClass = 'log-info';

                    if (log.level.includes('error')) levelClass = 'log-error';
                    if (log.level.includes('warning')) levelClass = 'log-warning';

                    tbody.innerHTML += `
                <tr>
                    <td>${log.time}</td>
                    <td><span class="log-badge ${levelClass}">${log.level}</span></td>
                    <td>${log.message.substring(0, 80)}...</td>
                    <td>
                        <button onclick="viewLog('${encodeURIComponent(log.raw)}')" class="btn-icon">
                            <i class="fa fa-eye"></i>
                        </button>
                    </td>
                </tr>
                `;
                });

                renderLogPagination(res);

            })
            .finally(() => hideLoader());
    }

    function viewLog(raw) {

        let decoded = decodeURIComponent(raw);

        Swal.fire({
            title: 'Log Details',
            html: `<pre style="text-align:left;max-height:400px;overflow:auto;">${decoded}</pre>`,
            width: 800
        });
    }

    function renderLogPagination(res) {

        let container = document.getElementById('logPagination');
        let info = document.getElementById('logPaginationInfo');

        container.innerHTML = '';

        info.innerText = `Page ${res.page} of ${res.lastPage}`;

        if (res.lastPage <= 1) return;

        let current = res.page;
        let last = res.lastPage;

        let start = Math.max(1, current - 2);
        let end = Math.min(last, current + 2);

        // 🔙 Prev
        if (current > 1) {
            container.innerHTML += `<button onclick="loadLogs(${current - 1})">Prev</button>`;
        }

        // 🔢 First page
        if (start > 1) {
            container.innerHTML += `<button onclick="loadLogs(1)">1</button>`;
            if (start > 2) container.innerHTML += `<span>...</span>`;
        }

        // 🔢 Middle pages
        for (let i = start; i <= end; i++) {
            container.innerHTML += `
            <button class="${i === current ? 'active' : ''}" 
                onclick="loadLogs(${i})">${i}</button>
        `;
        }

        // 🔢 Last page
        if (end < last) {
            if (end < last - 1) container.innerHTML += `<span>...</span>`;
            container.innerHTML += `<button onclick="loadLogs(${last})">${last}</button>`;
        }

        // 🔜 Next
        if (current < last) {
            container.innerHTML += `<button onclick="loadLogs(${current + 1})">Next</button>`;
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        loadLogs();
    });

    let timer;
    document.getElementById('logSearch').addEventListener('keyup', () => {
        clearTimeout(timer);
        timer = setTimeout(() => loadLogs(1), 400);
    });
</script>
@endsection