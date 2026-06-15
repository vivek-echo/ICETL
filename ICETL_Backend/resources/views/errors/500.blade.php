<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Server Error</title>
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
            width: min(560px, calc(100% - 32px));
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

        .debug-message {
            margin-top: 20px;
            padding: 12px;
            border-radius: 6px;
            background: #f3f4f6;
            color: #374151;
            font-family: Consolas, "Courier New", monospace;
            font-size: 14px;
            text-align: left;
            overflow-wrap: anywhere;
        }
    </style>
</head>
<body>
    <main class="error-page">
        <h1>500</h1>
        <h2>Server error</h2>
        <p>Something went wrong while processing your request.</p>

        @if (!empty($message))
            <div class="debug-message">{{ $message }}</div>
        @endif
    </main>
</body>
</html>
