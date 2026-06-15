<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Forbidden</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f6f7fb;
            color: #1f2937;
            font-family: Arial, Helvetica, sans-serif;
        }

        .error-page {
            width: min(520px, calc(100% - 32px));
            padding: 32px;
            border-radius: 8px;
            background: #ffffff;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
            text-align: center;
        }

        h1 {
            margin: 0 0 8px;
            color: #dc2626;
            font-size: 56px;
            line-height: 1;
        }

        h2 {
            margin: 0 0 12px;
            font-size: 24px;
        }

        p {
            margin: 0;
            color: #4b5563;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <main class="error-page">
        <h1>403</h1>
        <h2>Access denied</h2>
        <p>You do not have permission to access this page.</p>
    </main>
</body>
</html>
