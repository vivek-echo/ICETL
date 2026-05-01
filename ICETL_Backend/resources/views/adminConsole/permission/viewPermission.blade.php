<style>
    /* Tree container */
    .permission-tree {
        padding: 10px;
    }

    /* Each level */
    .tree-node {
        position: relative;
        padding: 6px 0;
    }

    /* Children wrapper */
    .tree-children {
        margin-left: 25px;
        border-left: 1px dashed #e5e7eb;
        padding-left: 12px;
    }

    /* Row */
    .tree-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        border-radius: 8px;
    }

    /* Hover */
    .tree-row:hover {
        background: #f9f7ff;
    }

    /* Icons */
    .tree-icon {
        margin-right: 8px;
        color: #6b7280;
    }

    /* Levels */
    .global-row {
        font-weight: 600;
    }

    .primary-row {
        color: #374151;
    }

    .tab-row {
        color: #6b7280;
        font-size: 13px;
    }

    .status-badge {
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 12px;
    }

    .status-badge.active {
        background: #e6fffa;
        color: #059669;
    }

    .status-badge.inactive {
        background: #f3f4f6;
        color: #6b7280;
    }
    .menu-type {
        font-size: 11px;
        color: #9ca3af;
        margin-left: 6px;
    }
</style>

<h5 class="mb-3">View Role Permissions</h5>

<!-- Role Select -->
<div class="form-group mb-3">
    <label>Select Role</label>
    <select id="viewRoleSelect" class="form-control"></select>
</div>

<!-- Permission View -->
<div id="viewPermissionContainer" class="menu-permission-card"></div>

<script>
    loadRoleDropdown();

    function loadRoleDropdown() {
        fetch('/console/getRolesList')
            .then(res => res.json())
            .then(data => {
                let select = document.getElementById('viewRoleSelect');
                select.innerHTML = '<option value="">Select Role</option>';

                data.forEach(r => {
                    select.innerHTML += `<option value="${r.id}">${r.roleName}</option>`;
                });
            });
    }

    document.getElementById('viewRoleSelect').addEventListener('change', function() {

        let roleId = this.value;

        if (!roleId) {
            showEmptyState();
            return;
        }

        loadPermissionView(roleId);
    });

    function loadPermissionView(roleId) {

        showLoader();

        fetch(`/console/getRolePermissionsTree/${roleId}`)
            .then(res => res.json())
            .then(res => {

                let data = res.menus;
                let permissions = res.permissions;

                let container = document.getElementById('viewPermissionContainer');
                container.innerHTML = `<div class="permission-tree"></div>`;

                let tree = container.querySelector('.permission-tree');

                let globals = data.filter(m => m.type == 1);

                globals.forEach(g => {

                    let html = `
                <div class="tree-node">

                    <!-- GLOBAL -->
                    <div class="tree-row global-row">
                        <div>
                            <i class="${g.icon || 'fa fa-globe'} tree-icon"></i>
                            ${g.name}
                        </div>

                        <span class="status-badge ${permissions[g.id] ? 'active' : 'inactive'}">
                            ${permissions[g.id] ? 'Allowed' : 'Not Allowed'}
                        </span>
                    </div>

                    <div class="tree-children">
                `;

                    let primaryMenus = data.filter(p => p.parentId == g.id);

                    primaryMenus.forEach(p => {

                        html += `
                    <div class="tree-node">

                        <!-- PRIMARY -->
                        <div class="tree-row primary-row">
                            <div>
                                <i class="${p.icon || 'fa fa-bars'} tree-icon"></i>
                                ${p.name}<small class="menu-type">Primary</small>
                            </div>

                            <span class="status-badge ${permissions[p.id] ? 'active' : 'inactive'}">
                                ${permissions[p.id] ? 'Allowed' : 'Not Allowed'}
                            </span>
                        </div>

                        <div class="tree-children">
                    `;

                        let tabs = data.filter(t => t.parentId == p.id);

                        tabs.forEach(t => {

                            html += `
                        <div class="tree-node">
                            <div class="tree-row tab-row">
                                <div>
                                    <i class="${t.icon || 'fa fa-circle'} tree-icon"></i>
                                    ${t.name}<small class="menu-type">Tab</small>
                                </div>

                                <span class="status-badge ${permissions[t.id] ? 'active' : 'inactive'}">
                                    ${permissions[t.id] ? 'Allowed' : 'Not Allowed'}
                                </span>
                            </div>
                        </div>
                        `;
                        });

                        html += `</div></div>`;
                    });

                    html += `</div></div>`;

                    tree.innerHTML += html;
                });

            })
            .finally(() => hideLoader());
    }
</script>