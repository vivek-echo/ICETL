<style>
    /* Container */
    .menu-permission-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 20px;
        border: 1px solid #eee;
    }

    /* Group */
    .menu-group {
        margin-bottom: 16px;
        padding: 10px;
        border-radius: 12px;
        transition: 0.2s;
    }

    /* Row */
    .menu-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-radius: 10px;
        transition: 0.2s;
    }

    /* Hover */
    .menu-row:hover {
        background: #f9f7ff;
    }

    /* Left section */
    .menu-left {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    /* Icon */
    .menu-icon i {
        font-size: 14px;
        color: #6b7280;
    }

    /* Labels */
    .menu-label {
        font-size: 14px;
    }

    /* Hierarchy spacing */
    .menu-children {
        margin-left: 20px;
        margin-top: 6px;
    }

    /* Global emphasis */
    .global-row {
        background: #f5f3ff;
        font-weight: 600;
    }

    /* Primary */
    .primary-row {
        background: #fafafa;
    }

    /* Tabs */
    .tab-row {
        opacity: 0.85;
    }

    /* Switch */
    .switch {
        position: relative;
        width: 38px;
        height: 20px;
    }

    .switch input {
        display: none;
    }

    .slider {
        position: absolute;
        cursor: pointer;
        background: #ccc;
        border-radius: 20px;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        transition: 0.3s;
    }

    .slider:before {
        content: "";
        position: absolute;
        height: 14px;
        width: 14px;
        left: 3px;
        top: 3px;
        background: white;
        border-radius: 50%;
        transition: 0.3s;
    }

    .switch input:checked+.slider {
        background: #8e2de2;
    }

    .switch input:checked+.slider:before {
        transform: translateX(18px);
    }

    /* Checkbox */
    .menu-checkbox {
        transform: scale(1.1);
    }

    /* Hover */
    .menu-item:hover {
        background: #f9f7ff;
        border-radius: 8px;
    }

    .menu-type {
        font-size: 11px;
        color: #9ca3af;
        margin-left: 6px;
    }

    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #6b7280;
    }

    .empty-icon {
        font-size: 30px;
        color: #8e2de2;
        margin-bottom: 10px;
    }

    .empty-state h5 {
        margin-bottom: 5px;
        font-weight: 600;
        color: #374151;
    }

    .empty-state p {
        font-size: 13px;
        color: #9ca3af;
    }
</style>
<h5>Assign Menu Permissions</h5>

<!-- Role Dropdown -->
<div class="form-group">
    <label>Select Role</label>
    <select id="roleSelect" class="form-control"></select>
</div>

<!-- Menu Tree -->
<div id="menuTree" class="menu-permission-card mt-2"></div>

<button class="btn-main mt-3" onclick="savePermissions()"><i class="fa-solid fa-check-to-slot me-1"></i>Update</button>
<script>
    function showLoader() {
        document.getElementById('loaderOverlay').classList.remove('d-none');
    }

    function hideLoader() {
        document.getElementById('loaderOverlay').classList.add('d-none');
    }
</script>
<script>
    let container = document.getElementById('menuTree');

    container.innerHTML = `
    <div class="empty-state">
        <div class="empty-icon">
            <i class="fa-solid fa-user-check"></i>
        </div>
        <h5>Select a Role</h5>
        <p>Please choose a role to view and assign menu permissions.</p>
    </div>
`;
    loadRoles();

    function loadRoles() {
        showLoader();
        fetch("{{ url('/console/getRolesList') }}")
            .then(res => res.json())
            .then(data => {
                let select = document.getElementById('roleSelect');
                select.innerHTML = '<option value="">Select Role</option>';

                data.forEach(r => {
                    select.innerHTML += `<option value="${r.id}">${r.roleName}</option>`;
                });
            }).finally(() => {
                hideLoader()
            });
    }

    document.getElementById('roleSelect').addEventListener('change', function() {

        let roleId = this.value;

        if (!roleId) {
            showEmptyState(); // optional
            return;
        }

        // Step 1: Load menu tree
        loadMenuTree(() => {
            // Step 2: After tree rendered → load permissions
            loadSavedPermissions(roleId);
        });

    });

    function loadSavedPermissions(roleId) {

        fetch(`{{ url('/console/getRolePermissions') }}/${roleId}`)
            .then(res => res.json())
            .then(data => {

                if (!data) return;

                document.querySelectorAll('.menu-check').forEach(cb => {

                    let id = cb.dataset.id;

                    if (data[id]) {
                        cb.checked = true;
                    }
                });

                // 🔥 Re-trigger logic (VERY IMPORTANT)
                document.querySelectorAll('.global').forEach(el => el.dispatchEvent(new Event('change')));
                document.querySelectorAll('.primary').forEach(el => el.dispatchEvent(new Event('change')));
            });
    }

    document.getElementById('roleSelect').addEventListener('change', loadMenuTree);

    function loadMenuTree(callback = null) {
        showLoader();
        fetch("{{ url('/console/getMenuHierarchy') }}")
            .then(res => res.json())
            .then(data => {

                let container = document.getElementById('menuTree');
                container.innerHTML = '';

                let globals = data.filter(m => m.type == 1);

                globals.forEach(g => {

                    let html = `
                <div class="menu-group">

                    <!-- GLOBAL -->
                    <div class="menu-row global-row">
                        <div class="menu-left">
                            <span class="menu-icon">
                                <i class="${g.icon || 'fa fa-globe'}"></i>
                            </span>
                            <span class="menu-label">${g.name}</span>
                        </div>

                        <label class="switch">
                            <input type="checkbox" class="menu-check global" data-id="${g.id}">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div class="menu-children">
                `;

                    let primaryMenus = data.filter(p => p.parentId == g.id);

                    primaryMenus.forEach(p => {

                        html += `
                    <div class="menu-row primary-row">
                        <div class="menu-left">
                            <span class="menu-icon">
                                <i class="${p.icon || 'fa fa-bars'}"></i>
                            </span>
                            <span class="menu-label">${p.name}<small class="menu-type">Primary</small></span>
                        </div>

                        <input type="checkbox" class="menu-check primary menu-checkbox" 
                            data-id="${p.id}" disabled>
                    </div>

                    <div class="menu-children">
                    `;

                        let tabs = data.filter(t => t.parentId == p.id);

                        tabs.forEach(t => {

                            html += `
                        <div class="menu-row tab-row">
                            <div class="menu-left">
                                <span class="menu-icon">
                                    <i class="${t.icon || 'fa fa-circle'}"></i>
                                </span>
                                <span class="menu-label">${t.name}<small class="menu-type">Tab</small></span>
                            </div>

                            <input type="checkbox" class="menu-check tab menu-checkbox" 
                                data-id="${t.id}" disabled>
                        </div>
                        `;
                        });

                        html += `</div>`;
                    });

                    html += `</div></div>`;
                    container.innerHTML += html;
                });

                attachCheckboxLogic();
                if (typeof callback === 'function') {
                    callback();
                }
            }).finally(() => {
                hideLoader();
            });
    }

    function attachCheckboxLogic() {

        // 🔥 GLOBAL SWITCH
        document.querySelectorAll('.global').forEach(global => {

            global.addEventListener('change', function() {

                let group = this.closest('.menu-group');

                let primaryCheckboxes = group.querySelectorAll('.primary');
                let tabCheckboxes = group.querySelectorAll('.tab');

                if (this.checked) {
                    // Enable primary
                    primaryCheckboxes.forEach(p => {
                        p.disabled = false;
                    });
                } else {
                    // Disable everything
                    primaryCheckboxes.forEach(p => {
                        p.checked = false;
                        p.disabled = true;
                    });

                    tabCheckboxes.forEach(t => {
                        t.checked = false;
                        t.disabled = true;
                    });
                }
            });
        });

        // 🔥 PRIMARY CHECKBOX
        document.querySelectorAll('.primary').forEach(primary => {

            primary.addEventListener('change', function() {

                // Only affect its own tabs
                let parentWrapper = this.closest('.menu-row').nextElementSibling;

                if (!parentWrapper) return;

                let tabs = parentWrapper.querySelectorAll('.tab');

                if (this.checked) {
                    tabs.forEach(t => {
                        t.disabled = false;
                    });
                } else {
                    tabs.forEach(t => {
                        t.checked = false;
                        t.disabled = true;
                    });
                }
            });
        });
    }

    function savePermissions() {

        let roleId = document.getElementById('roleSelect').value;

        let checked = document.querySelectorAll('.menu-check:checked');

        let menuIds = [];

        checked.forEach(c => {
            menuIds.push(c.dataset.id);
        });
        showLoader();
        fetch("{{ url('/console/saveRolePermissions') }}", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('input[name="_token"]').value
                },
                body: JSON.stringify({
                    roleId,
                    menuIds
                })
            })
            .then(res => res.json())
            .then(res => {
                Swal.fire("Success", res.message, "success");
            }).finally(() => {
                hideLoader();
            });
    }
</script>