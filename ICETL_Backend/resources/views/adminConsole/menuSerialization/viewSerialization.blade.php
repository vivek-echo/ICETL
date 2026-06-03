<style>
    .serialization-view-toolbar {
        margin-bottom: 18px;
    }

    .serialization-view-layout {
        display: grid;
        grid-template-columns: 1fr;
        gap: 18px;
    }

    .serial-view-panel {
        background: #ffffff;
        border: 1px solid #edf0f5;
        border-radius: 8px;
        padding: 16px;
    }

    .serial-view-panel h6 {
        font-size: 14px;
        font-weight: 700;
        margin: 0 0 12px;
        color: #263142;
    }

    .serial-view-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .serial-view-item {
        margin-bottom: 8px;
    }

    .serial-view-row {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid #e7eaf0;
        border-radius: 8px;
        padding: 9px 10px;
        background: #ffffff;
    }

    .serial-view-row--global {
        background: #f6f4ff;
        border-color: #e6defa;
        font-weight: 700;
    }

    .serial-view-row--primary {
        background: #fbfcff;
    }

    .serial-view-row--tab {
        font-size: 13px;
    }

    .serial-view-icon {
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        flex: 0 0 auto;
    }

    .serial-view-name {
        flex: 1;
        min-width: 0;
    }

    .serial-view-name strong,
    .serial-view-name span {
        display: block;
        overflow-wrap: anywhere;
    }

    .serial-view-type {
        display: block;
        margin-top: 1px;
        font-size: 11px;
        font-weight: 600;
        color: #8b95a5;
    }

    .serial-view-children {
        display: none;
        margin: 8px 0 0 30px;
        padding-left: 12px;
        border-left: 1px dashed #d9deea;
    }

    .serial-view-item.is-expanded > .serial-view-children {
        display: block;
    }

    .serial-view-collapse,
    .serial-view-collapse-spacer {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
    }

    .serial-view-collapse {
        border: 0;
        border-radius: 8px;
        background: #f3f5f8;
        color: #596273;
    }

    .serial-view-collapse i {
        pointer-events: none;
        transition: transform 0.16s ease;
    }

    .serial-view-item.is-expanded > .serial-view-row .serial-view-collapse i {
        transform: rotate(90deg);
    }

    .serial-status {
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
    }

    .serial-status.allowed {
        background: #e6fffa;
        color: #047857;
    }

    .serial-status.blocked {
        background: #f1f3f6;
        color: #6b7280;
    }

    .serial-view-empty {
        text-align: center;
        padding: 34px 18px;
        color: #7b8494;
        border: 1px dashed #d9deea;
        border-radius: 8px;
        background: #fbfcff;
    }

    .serial-view-empty i {
        display: block;
        margin-bottom: 10px;
        color: #8e2de2;
        font-size: 26px;
    }

    @media (max-width: 992px) {
        .serialization-view-layout {
            grid-template-columns: 1fr;
        }
    }
</style>

<h5 class="mb-3">View Menu Serialization</h5>

<div class="serialization-view-toolbar">
    <div class="form-group">
        <label class="form-label">Select Role</label>
        <select id="viewSerializeRoleSelect" class="form-control"></select>
    </div>
</div>

<div id="serializationViewContainer">
    <div class="serial-view-empty">
        <i class="fa-solid fa-user-gear"></i>
        <strong>Select Role</strong>
    </div>
</div>

<script>
    (function() {
        const roleSelect = document.getElementById('viewSerializeRoleSelect');
        const container = document.getElementById('serializationViewContainer');

        loadRoles();
        bindCollapseEvents();

        roleSelect.addEventListener('change', function() {
            if (!this.value) {
                showEmpty('Select Role');
                return;
            }

            loadSerializationView(this.value);
        });

        function loadRoles() {
            showSerializationLoader();

            fetch("{{ url('/console/getRolesList') }}")
                .then(res => res.json())
                .then(data => {
                    roleSelect.innerHTML = '<option value="">Select Role</option>';

                    data.forEach(role => {
                        roleSelect.innerHTML += `<option value="${role.id}">${escapeHtml(role.roleName)}</option>`;
                    });
                })
                .finally(() => hideSerializationLoader());
        }

        function loadSerializationView(roleId) {
            showSerializationLoader();

            fetch(`{{ url('/console/getRoleMenuSerialization') }}/${roleId}`)
                .then(async response => {
                    const data = await response.json().catch(() => ({}));

                    if (!response.ok || data.status === false) {
                        throw new Error(data.message || 'Unable to load menu serialization');
                    }

                    renderView(data);
                })
                .catch(error => {
                    showEmpty(error.message);
                    Swal.fire('Error', error.message, 'error');
                })
                .finally(() => hideSerializationLoader());
        }

        function renderView(data) {
            const menus = Array.isArray(data.menus) ? data.menus : [];
            const permissions = data.permissions || {};
            const serialization = data.serialization || {
                menuOrder: [],
                topMenuOrder: []
            };

            if (!menus.length) {
                showEmpty('No menus found');
                return;
            }

            container.innerHTML = `
                <div class="serialization-view-layout">
                    <div class="serial-view-panel">
                        <h6><i class="fa-solid fa-layer-group me-1"></i>Menu Tree</h6>
                        <ul id="viewGlobalMenuList" class="serial-view-list"></ul>
                    </div>
                </div>
            `;

            renderTree(menus, permissions, serialization);
        }

        function renderTree(menus, permissions, serialization) {
            const globalList = document.getElementById('viewGlobalMenuList');
            const globals = sortMenus(menus.filter(menu => Number(menu.type) === 1), serialization.menuOrder);

            globalList.innerHTML = globals.map(globalMenu => {
                const primaryMenus = sortMenus(childrenOf(menus, globalMenu.id, 2), serialization.menuOrder);
                const primaryHtml = primaryMenus.map(primaryMenu => {
                    const tabs = sortMenus(childrenOf(menus, primaryMenu.id, 3), serialization.menuOrder);
                    const tabHtml = tabs.map(tab => renderMenuItem(tab, 'tab', permissions)).join('');

                    return renderMenuItem(primaryMenu, 'primary', permissions, tabHtml);
                }).join('');

                return renderMenuItem(globalMenu, 'global', permissions, primaryHtml);
            }).join('');
        }

        function renderMenuItem(menu, level, permissions, childrenHtml = '') {
            const allowed = isAllowed(menu.id, permissions);
            const icon = menu.icon || defaultIcon(level);
            const hasChildren = childrenHtml.trim().length > 0;

            return `
                <li class="serial-view-item">
                    <div class="serial-view-row serial-view-row--${level}">
                        ${hasChildren
                            ? `<button type="button" class="serial-view-collapse" aria-expanded="false" title="Expand"><i class="fa-solid fa-chevron-right"></i></button>`
                            : `<span class="serial-view-collapse-spacer"></span>`}
                        <span class="serial-view-icon"><i class="${escapeHtml(icon)}"></i></span>
                        <span class="serial-view-name">
                            <strong>${escapeHtml(menu.name)}</strong>
                            <small class="serial-view-type">${levelLabel(level)}</small>
                        </span>
                        <span class="serial-status ${allowed ? 'allowed' : 'blocked'}">
                            ${allowed ? 'Allowed' : 'Not Allowed'}
                        </span>
                    </div>
                    ${hasChildren ? `<div class="serial-view-children"><ul class="serial-view-list">${childrenHtml}</ul></div>` : ''}
                </li>
            `;
        }

        function bindCollapseEvents() {
            document.addEventListener('click', function(event) {
                const button = event.target.closest('.serial-view-collapse');

                if (!button || !container.contains(button)) {
                    return;
                }

                const item = button.closest('.serial-view-item');

                if (!item) {
                    return;
                }

                const expanded = item.classList.toggle('is-expanded');
                button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                button.setAttribute('title', expanded ? 'Collapse' : 'Expand');
            });
        }

        function childrenOf(menus, parentId, type) {
            return menus.filter(menu => Number(menu.parentId) === Number(parentId) && Number(menu.type) === type);
        }

        function sortMenus(menus, order) {
            const orderMap = new Map((order || []).map((id, index) => [Number(id), index]));

            return [...menus].sort((left, right) => {
                const leftOrder = orderMap.has(Number(left.id)) ? orderMap.get(Number(left.id)) : Number.MAX_SAFE_INTEGER;
                const rightOrder = orderMap.has(Number(right.id)) ? orderMap.get(Number(right.id)) : Number.MAX_SAFE_INTEGER;

                return leftOrder - rightOrder || Number(left.id) - Number(right.id);
            });
        }

        function isAllowed(menuId, permissions) {
            return Boolean(permissions[String(menuId)] || permissions[menuId]);
        }

        function showEmpty(message) {
            container.innerHTML = `
                <div class="serial-view-empty">
                    <i class="fa-solid fa-user-gear"></i>
                    <strong>${escapeHtml(message)}</strong>
                </div>
            `;
        }

        function defaultIcon(level) {
            if (level === 'global') {
                return 'fa fa-globe';
            }

            if (level === 'primary') {
                return 'fa fa-bars';
            }

            return 'fa fa-circle';
        }

        function levelLabel(level) {
            if (level === 'global') {
                return 'Global Menu';
            }

            if (level === 'primary') {
                return 'Primary Menu';
            }

            return 'Tab';
        }

        function escapeHtml(value) {
            return String(value ?? '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[char]));
        }

        function showSerializationLoader() {
            if (typeof window.showLoader === 'function') {
                window.showLoader();
                return;
            }

            document.getElementById('loaderOverlay')?.classList.remove('d-none');
        }

        function hideSerializationLoader() {
            if (typeof window.hideLoader === 'function') {
                window.hideLoader();
                return;
            }

            document.getElementById('loaderOverlay')?.classList.add('d-none');
        }
    })();
</script>
