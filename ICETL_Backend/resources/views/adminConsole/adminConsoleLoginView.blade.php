<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Login</title>

    <!-- Bootstrap -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- FontAwesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

    <style>
        body {
            height: 100vh;
            background: linear-gradient(135deg, #f8f9ff, #ffffff);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Segoe UI', sans-serif;
        }

        .login-wrapper {
            display: flex;
            width: 900px;
            max-width: 100%;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
            animation: fadeIn 0.6s ease;
        }

        /* Left side */
        .login-left {
            background: linear-gradient(135deg, #6a11cb, #8e2de2);
            color: white;
            flex: 1;
            padding: 50px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .login-left h2 {
            font-weight: 700;
            margin-bottom: 15px;
        }

        .login-left p {
            opacity: 0.9;
        }

        /* Right side */
        .login-right {
            background: #fff;
            flex: 1;
            padding: 50px;
        }

        .form-title {
            font-weight: 600;
            margin-bottom: 30px;
        }

        .form-control {
            border-radius: 12px;
            padding: 12px 15px 12px 40px;
            border: 1px solid #eee;
            transition: 0.3s;
        }

        .form-control:focus {
            border-color: #8e2de2;
            box-shadow: 0 0 0 3px rgba(142, 45, 226, 0.1);
        }

        .form-group {
            position: relative;
        }



        .btn-login {
            background: linear-gradient(135deg, #6a11cb, #8e2de2);
            border: none;
            border-radius: 12px;
            padding: 12px;
            font-weight: 600;
            transition: 0.3s;
        }

        .btn-login:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }

        .forgot {
            font-size: 14px;
            text-align: right;
            display: block;
            margin-top: 8px;
            color: #8e2de2;
            text-decoration: none;
        }

        .forgot:hover {
            text-decoration: underline;
        }

        @media(max-width: 768px) {
            .login-wrapper {
                flex-direction: column;
            }

            .login-left {
                display: none;
            }
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .input-icon {
            position: absolute;
            top: 50%;
            left: 12px;
            transform: translateY(-50%);
            color: #8e2de2;
            z-index: 2;
        }

        .toggle-password {
            position: absolute;
            top: 50%;
            right: 12px;
            transform: translateY(-50%);
            cursor: pointer;
            color: #8e2de2;
            z-index: 2;
            font-size: 14px;
        }

        .toggle-password:hover {
            color: #6a11cb;
        }

        .form-control {
            padding-left: 40px !important;
            padding-right: 40px !important;
        }
    </style>
</head>

<body>

    <div class="login-wrapper">

        <!-- Left Design Panel -->
        <div class="login-left">
            <h2>Welcome Back 👋</h2>
            <p>Login to continue managing your platform with a secure and modern experience.</p>
        </div>

        <!-- Right Form Panel -->
        <div class="login-right">
            <h4 class="form-title">Login</h4>

            <form method="POST" action="/adminlogin">
                @csrf

                <!-- Email -->
                <div class="mb-3 form-group position-relative">
                    <i class="fa fa-envelope input-icon"></i>
                    <input type="email" name="email" class="form-control" placeholder="Email address" required>

                    @error('email')
                    <small class="text-danger">{{ $message }}</small>
                    @enderror
                </div>

                <!-- Password -->
                <div class="mb-3 form-group position-relative">

                    <i class="fa fa-lock input-icon"></i>

                    <input type="password" id="password" name="password"
                        class="form-control" placeholder="Password" required>

                    <!-- Eye Button -->
                    <span class="toggle-password" onclick="togglePassword()">
                        <i class="fa fa-eye" id="eyeIcon"></i>
                    </span>

                    @error('password')
                    <small class="text-danger">{{ $message }}</small>
                    @enderror

                </div>

                <!-- Remember -->
                

                <!-- Button -->
                <div class="d-grid">
                    <button type="submit" class="btn btn-login text-white" id="loginBtn">
                        <span id="btnText"><i class="fa-solid fa-right-to-bracket me-1"></i>Login</span>
                        <span id="btnLoader" class="spinner-border spinner-border-sm d-none"></span>
                    </button>
                </div>

            </form>
        </div>

    </div>

</body>
<script>
    function togglePassword() {
        let input = document.getElementById("password");
        let icon = document.getElementById("eyeIcon");

        if (input.type === "password") {
            input.type = "text";
            icon.classList.replace("fa-eye", "fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.replace("fa-eye-slash", "fa-eye");
        }
    }
</script>
<script>
    document.querySelector("form").addEventListener("submit", function() {
        document.getElementById("btnText").classList.add("d-none");
        document.getElementById("btnLoader").classList.remove("d-none");
    });
</script>

</html>