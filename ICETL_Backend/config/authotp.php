<?php

return [
    'expose_in_response' => env('OTP_EXPOSE_IN_RESPONSE', in_array(env('APP_ENV'), ['local', 'staging'], true)),
    'expiry_seconds' => 300,
    'resend_seconds' => 30,
    'max_send_attempts' => 3,
    'max_send_attempts_decay_seconds' => 300,
    'max_send_ip_attempts' => 10,
    'max_send_ip_attempts_decay_seconds' => 300,
    'max_verify_attempts' => 5,
    'max_verify_ip_attempts' => 30,
    'max_verify_ip_attempts_decay_seconds' => 300,
    'flow_expiry_seconds' => 600,
    'flow_bind_ip' => env('OTP_FLOW_BIND_IP', false),
    'flow_bind_user_agent' => env('OTP_FLOW_BIND_USER_AGENT', true),
];
