<style>
    .serialization-toolbar {
        display: grid;
        grid-template-columns: minmax(240px, 1fr) auto;
        gap: 14px;
        align-items: end;
        margin-bottom: 18px;
    }

    .serialization-layout {
        display: grid;
        grid-template-columns: 1fr;
        gap: 18px;
    }

    .serial-panel {
        background: #ffffff;
        border: 1px solid #edf0f5;
        border-radius: 8px;
        padding: 16px;
    }

    .serial-panel h6 {
        font-size: 14px;
        font-weight: 700;
        margin: 0 0 12px;
        color: #263142;
    }

    .serial-list {
        list-style: none;
        margin: 0;
        padding: 0;
        min-height: 14px;
    }

    .serial-item {
        margin-bottom: 8px;
    }

    .serial-row {
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid #e7eaf0;
        background: #ffffff;
        border-radius: 8px;
        padding: 9px 10px;
        transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
    }

    .serial-row:hover {
        background: #faf9ff;
        border-color: #ddd4f4;
    }

    .serial-row--global {
        background: #f6f4ff;
        border-color: #e6defa;
        font-weight: 700;
    }

    .serial-row--primary {
        background: #fbfcff;
    }

    .serial-row--tab {
        font-size: 13px;
    }

    .serial-row.is-disabled {
        opacity: 0.52;
    }

    .serial-item.dragging > .serial-row {
        opacity: 0.45;
        border-style: dashed;
    }

    .drag-handle {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 8px;
        background: #eef1f6;
        color: #6c7480;
        cursor: grab;
        flex: 0 0 auto;
    }

    .drag-handle:active {
        cursor: grabbing;
    }

    .drag-handle i {
        pointer-events: none;
    }

    .serial-icon {
        width: 24px;
        height: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        flex: 0 0 auto;
    }

    .serial-name {
        min-width: 0;
        flex: 1;
    }

    .serial-name strong,
    .serial-name span {
        display: block;
        overflow-wrap: anywhere;
    }

    .serial-type {
        display: block;
        margin-top: 1px;
        font-size: 11px;
        font-weight: 600;
        color: #8b95a5;
    }

    .serial-children {
        display: none;
        margin: 8px 0 0 30px;
        padding-left: 12px;
        border-left: 1px dashed #d9deea;
    }

    .serial-item.is-expanded > .serial-children {
        display: block;
    }

    .serial-collapse,
    .serial-collapse-spacer {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
    }

    .serial-collapse {
        border: 0;
        border-radius: 8px;
        background: #f3f5f8;
        color: #596273;
    }

    .serial-collapse i {
        pointer-events: none;
        transition: transform 0.16s ease;
    }

    .serial-item.is-expanded > .serial-row .serial-collapse i {
        transform: rotate(90deg);
    }

    .serial-empty {
        text-align: center;
        padding: 34px 18px;
        color: #7b8494;
        border: 1px dashed #d9deea;
        border-radius: 8px;
        background: #fbfcff;
    }

    .serial-empty i {
        display: block;
        margin-bottom: 10px;
        color: #8e2de2;
        font-size: 26px;
    }

    @media (max-width: 992px) {
        .serialization-toolbar,
        .serialization-layout {
            grid-template-columns: 1fr;
        }
    }
</style>

<h5 class="mb-3">Add Menu Serialization</h5>

<form id="serializationForm">
    @csrf

    <div class="serialization-toolbar">
        <div class="form-group mb-0">
            <label class="form-label">Select Role</label>
            <select id="serializeRoleSelect" class="form-control"></select>
        </div>

        <button type="button" id="saveSerializationBtn" class="btn-main" disabled>
            <i class="fa-solid fa-floppy-disk me-1"></i>Save Serialization
        </button>
    </div>

    <div id="serializationEditor">
        <div class="serial-empty">
            <i class="fa-solid fa-user-gear"></i>
            <strong>Select Role</strong>
        </div>
    </div>
</form>

<script>
    (function() {
        const state = {
            menus: [],
            permissions: {},
            serialization: {
                menuOrder: [],
                topMenuOrder: []
            }
        };

        const roleSelect = document.getElementById('serializeRoleSelect');
        const editor = document.getElementById('serializationEditor');
        const saveButton = document.getElementById('saveSerializationBtn');
        let draggedItem = null;

        loadRoles();
        bindDragEvents();
        bindCollapseEvents();

        roleSelect.addEventListener('change', function() {
            const roleId = this.value;

            if (!roleId) {
                saveButton.disabled = true;
                showInitialState();
                return;
            }

            loadSerialization(roleId);
        });

        saveButton.addEventListener('click', saveSerialization);

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

        function loadSerialization(roleId) {
            showSerializationLoader();
            saveButton.disabled = true;

            fetch(`{{ url('/console/getRoleMenuSerialization') }}/${roleId}`)
                .then(async response => {
                    const data = await response.json().catch(() => ({}));

                    if (!response.ok || data.status === false) {
                        throw new Error(data.message || 'Unable to load menu serialization');
                    }

                    state.menus = Array.isArray(data.menus) ? data.menus : [];
                    state.permissions = data.permissions || {};
                    state.serialization = data.serialization || {
                        menuOrder: [],
                        topMenuOrder: []
                    };

                    renderEditor();
                    saveButton.disabled = getSerializableMenus().length === 0;
                })
                .catch(error => {
                    showInitialState(error.message);
                    Swal.fire('Error', error.message, 'error');
                })
                .finally(() => hideSerializationLoader());
        }

        function renderEditor() {
            const serializableMenus = getSerializableMenus();

            if (!serializableMenus.length) {
                editor.innerHTML = `
                    <div class="serial-empty">
                        <i class="fa-solid fa-circle-info"></i>
                        <strong>No permitted menus found</strong>
                    </div>
                `;
                return;
            }

            editor.innerHTML = `
                <div class="serialization-layout">
                    <div class="serial-panel">
                        <h6><i class="fa-solid fa-layer-group me-1"></i>Menu Tree</h6>
                        <ul id="globalMenuList" class="serial-list"></ul>
                    </div>
                </div>
            `;

            renderTree(serializableMenus);
        }

        function renderTree(menus) {
            const globalList = document.getElementById('globalMenuList');
            const globals = sortMenus(menus.filter(menu => Number(menu.type) === 1), state.serialization.menuOrder);

            globalList.innerHTML = globals.map(globalMenu => {
                const primaryMenus = sortMenus(childrenOf(menus, globalMenu.id, 2), state.serialization.menuOrder);
                const primaryHtml = primaryMenus.map(primaryMenu => {
                    const tabs = sortMenus(childrenOf(menus, primaryMenu.id, 3), state.serialization.menuOrder);
                    const tabHtml = tabs.map(tab => renderMenuItem(tab, 'tab')).join('');

                    return renderMenuItem(primaryMenu, 'primary', tabHtml);
                }).join('');

                return renderMenuItem(globalMenu, 'global', primaryHtml);
            }).join('');
        }

        function renderMenuItem(menu, level, childrenHtml = '') {
            const id = Number(menu.id);
            const icon = menu.icon || defaultIcon(level);
            const hasChildren = childrenHtml.trim().length > 0;

            return `
                <li class="serial-item" data-menu-id="${id}">
                    <div class="serial-row serial-row--${level}" draggable="true">
                        <button type="button" class="drag-handle" title="Drag menu" draggable="true">
                            <i class="fa-solid fa-grip-vertical"></i>
                        </button>
                        ${hasChildren
                            ? `<button type="button" class="serial-collapse" aria-expanded="false" title="Expand"><i class="fa-solid fa-chevron-right"></i></button>`
                            : `<span class="serial-collapse-spacer"></span>`}
                        <span class="serial-icon"><i class="${escapeHtml(icon)}"></i></span>
                        <span class="serial-name">
                            <strong>${escapeHtml(menu.name)}</strong>
                            <small class="serial-type">${levelLabel(level)}</small>
                        </span>
                    </div>
                    ${hasChildren ? `<div class="serial-children"><ul class="serial-list">${childrenHtml}</ul></div>` : ''}
                </li>
            `;
        }

        function saveSerialization() {
            const roleId = roleSelect.value;

            if (!roleId) {
                Swal.fire('Warning', 'Please select a role', 'warning');
                return;
            }

            const menuIds = getSerializableMenus().map(menu => Number(menu.id));

            if (!menuIds.length) {
                Swal.fire('Warning', 'No permitted menus found for this role', 'warning');
                return;
            }

            const menuSet = new Set(menuIds);
            const menuOrder = readMenuOrder(document.getElementById('globalMenuList'))
                .filter(id => menuSet.has(id));

            showSerializationLoader();

            fetch("{{ url('/console/saveRoleMenuSerialization') }}", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('#serializationForm input[name="_token"]').value
                    },
                    body: JSON.stringify({
                        roleId: Number(roleId),
                        menuIds,
                        menuOrder,
                        topMenuOrder: []
                    })
                })
                .then(async response => {
                    const data = await response.json().catch(() => ({}));

                    if (!response.ok || data.status === false) {
                        throw new Error(data.message || 'Unable to save menu serialization');
                    }

                    state.serialization.menuOrder = menuOrder;
                    state.serialization.topMenuOrder = [];

                    Swal.fire('Success', data.message, 'success');
                })
                .catch(error => {
                    Swal.fire('Error', error.message, 'error');
                })
                .finally(() => hideSerializationLoader());
        }

        function readMenuOrder(list) {
            const order = [];

            if (!list) {
                return order;
            }

            Array.from(list.children).forEach(item => {
                if (!item.classList.contains('serial-item')) {
                    return;
                }

                const id = Number(item.dataset.menuId);

                if (id > 0) {
                    order.push(id);
                }

                const childList = item.querySelector(':scope > .serial-children > .serial-list');
                order.push(...readMenuOrder(childList));
            });

            return order;
        }

        function bindDragEvents() {
            document.addEventListener('dragstart', function(event) {
                const dragSource = event.target.closest('.drag-handle, .serial-row');
                const item = dragSource ? dragSource.closest('.serial-item') : null;

                if (!item) {
                    event.preventDefault();
                    return;
                }

                draggedItem = item;
                item.classList.add('dragging');
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', item.dataset.menuId || '');
            });

            document.addEventListener('dragover', function(event) {
                const list = event.target.closest('.serial-list');

                if (!list || !draggedItem || draggedItem.parentElement !== list) {
                    return;
                }

                event.preventDefault();
                const afterElement = getDragAfterElement(list, event.clientY);

                if (!afterElement) {
                    list.appendChild(draggedItem);
                } else {
                    list.insertBefore(draggedItem, afterElement);
                }
            });

            document.addEventListener('dragend', function() {
                if (draggedItem) {
                    draggedItem.classList.remove('dragging');
                }

                draggedItem = null;
            });
        }

        function bindCollapseEvents() {
            document.addEventListener('click', function(event) {
                const button = event.target.closest('.serial-collapse');

                if (!button || !editor.contains(button)) {
                    return;
                }

                const item = button.closest('.serial-item');

                if (!item) {
                    return;
                }

                const expanded = item.classList.toggle('is-expanded');
                button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                button.setAttribute('title', expanded ? 'Collapse' : 'Expand');
            });
        }

        function getDragAfterElement(list, y) {
            const items = [...list.querySelectorAll(':scope > .serial-item:not(.dragging)')];

            return items.reduce((closest, item) => {
                const box = item.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;

                if (offset < 0 && offset > closest.offset) {
                    return {
                        offset,
                        element: item
                    };
                }

                return closest;
            }, {
                offset: Number.NEGATIVE_INFINITY,
                element: null
            }).element;
        }

        function childrenOf(menus, parentId, type) {
            return menus.filter(menu => Number(menu.parentId) === Number(parentId) && Number(menu.type) === type);
        }

        function getSerializableMenus() {
            const menuById = new Map(state.menus.map(menu => [Number(menu.id), menu]));
            const visibleIds = new Set();

            Object.keys(state.permissions || {}).forEach(menuId => {
                const numericId = Number(menuId);

                if (!Number.isInteger(numericId) || numericId <= 0 || !isAllowed(numericId)) {
                    return;
                }

                let currentId = numericId;

                while (currentId > 0 && menuById.has(currentId)) {
                    if (visibleIds.has(currentId)) {
                        break;
                    }

                    visibleIds.add(currentId);
                    currentId = Number(menuById.get(currentId).parentId || 0);
                }
            });

            return state.menus.filter(menu => visibleIds.has(Number(menu.id)));
        }

        function sortMenus(menus, order) {
            const orderMap = new Map((order || []).map((id, index) => [Number(id), index]));

            return [...menus].sort((left, right) => {
                const leftOrder = orderMap.has(Number(left.id)) ? orderMap.get(Number(left.id)) : Number.MAX_SAFE_INTEGER;
                const rightOrder = orderMap.has(Number(right.id)) ? orderMap.get(Number(right.id)) : Number.MAX_SAFE_INTEGER;

                return leftOrder - rightOrder || Number(left.id) - Number(right.id);
            });
        }

        function isAllowed(menuId) {
            return Boolean(state.permissions[String(menuId)] || state.permissions[menuId]);
        }

        function showInitialState(message = 'Select Role') {
            editor.innerHTML = `
                <div class="serial-empty">
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
