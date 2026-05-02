<nav class="modern-navbar">

    <!-- Left -->
    <div class="nav-left">
        <div class="logo">
            <i class="fa fa-layer-group"></i>
            <span>ICTEL Admin Panel</span>
        </div>

        <div class="nav-links">
            <a href="/console/dashboard" class="{{ request()->is('console/dashboard') ? 'active' : '' }}">
                <i class="fa-solid fa-desktop me-1"></i>Dashboard
            </a>
            <a href="{{ url('/console/manageRole') }}" class="{{ request()->is('console/manageRole') ? 'active' : '' }}"><i class="fa-solid fa-user-gear me-1"></i>Manage Role</a>
            <a href="{{ url('/console/manageMenu') }}" class="{{ request()->is('console/manageMenu') ? 'active' : '' }}"><i class="fa-solid fa-bars me-1"></i>Manage Menu</a>
            <a href="{{ url('/console/managePermission') }}"  class="{{ request()->is('console/managePermission') ? 'active' : '' }}"><i class="fa-solid fa-file-shield me-1"></i>Manage Menu Permission</a>
            
            <!-- <a href="/console/systemLogs" class="{{ request()->is('console/systemLogs') ? 'active' : '' }}"><i class="fa-solid fa-file-contract me-1"></i>System Logs</a> -->
        </div>
    </div>

    <!-- Right -->
    <div class="nav-right">

        <!-- Search -->
        

        <!-- Notification -->
        

        <!-- User -->
        <div class="user-dropdown">

            <div class="user-trigger" onclick="toggleDropdown()">
                <div class="avatar">
                    {{ strtoupper(substr(auth()->user()->name ?? 'A', 0, 1)) }}
                </div>
                <span>{{ auth()->user()->name ?? 'Admin' }}</span>
                <i class="fa fa-chevron-down"></i>
            </div>

            <!-- Dropdown -->
            <div class="dropdown-menu-custom" id="userDropdown">

                <div class="dropdown-header">
                    <strong>{{ auth()->user()->name ?? 'Admin' }}</strong>
                    <small>{{ auth()->user()->email ?? 'admin@email.com' }}</small>
                </div>

                <!-- <a href="#" class="dropdown-item">
                    <i class="fa fa-user"></i> Profile
                </a>

                <a href="#" class="dropdown-item">
                    <i class="fa fa-cog"></i> Settings
                </a> -->

                <!-- <div class="dropdown-divider"></div> -->

                <form method="POST" action="{{ route('adminLogout') }}">
                    @csrf
                    <a href="#" onclick="event.preventDefault(); this.closest('form').submit();" class="dropdown-item logout">
                        <i class="fa fa-sign-out-alt"></i> Logout
                    </a>
                </form>

            </div>

        </div>

    </div>

</nav>