<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Admin Panel</title>

    <!-- Bootstrap -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- FontAwesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

    <!-- Custom Style -->
    <style>
        body {
            background: #f8f9ff;
        }

        .text-purple {
            color: #8e2de2;
        }
    </style>
    @vite(['resources/css/app.css'])
</head>
<body>
<div id="loaderOverlay" class="loader-overlay d-none">
    <div class="loader-box">
        <div class="loader-spinner"></div>
        <p>Processing...</p>
    </div>
</div>
    <!-- Top Navbar -->
    @include('adminConsole.layout.topnav')

    <!-- Page Content -->
    <div class="container-fluid mt-4">
        @yield('content')
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script>
function toggleDropdown() {
    document.getElementById("userDropdown").classList.toggle("show");
}

// Close on outside click
window.addEventListener('click', function(e) {
    const dropdown = document.getElementById("userDropdown");
    const trigger = document.querySelector(".user-trigger");

    if (!trigger.contains(e.target)) {
        dropdown.classList.remove("show");
    }
});
</script>
<script>
function showLoader() {
    document.getElementById('loaderOverlay').classList.remove('d-none');
}

function hideLoader() {
    document.getElementById('loaderOverlay').classList.add('d-none');
}
</script>
</body>
</html>