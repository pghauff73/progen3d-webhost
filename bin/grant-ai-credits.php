#!/usr/bin/env php
<?php

require dirname(__DIR__) . '/includes/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must run from the CLI.\n");
    exit(1);
}

if (!firebase_admin_ready()) {
    fwrite(STDERR, "Firebase Admin is not ready.\n");
    fwrite(STDERR, json_encode(firebase_admin_runtime_status(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
    exit(1);
}

if (!firebase_credit_transactions_available()) {
    fwrite(STDERR, "AI credit transactions are not available. Configure the Firestore SDK transaction path.\n");
    exit(1);
}

if (count($argv) < 3) {
    fwrite(STDERR, "Usage: grant-ai-credits.php <uid-or-email> <amount> [--source=name]\n");
    exit(1);
}

$identity = trim((string) $argv[1]);
$amount = (int) $argv[2];
$source = 'admin_grant';

foreach (array_slice($argv, 3) as $arg) {
    if (str_starts_with($arg, '--source=')) {
        $source = trim(substr($arg, 9)) ?: 'admin_grant';
    }
}

$user = str_contains($identity, '@') ? find_user_by_email($identity) : find_user_by_id($identity);
if (!$user) {
    fwrite(STDERR, "User not found: {$identity}\n");
    exit(1);
}

$updatedUser = firebase_grant_ai_credits(
    (string) ($user['uid'] ?? $user['id'] ?? ''),
    $amount,
    $source,
    'user',
    (string) ($user['uid'] ?? $user['id'] ?? ''),
    ['operator' => 'cli']
);

fwrite(STDOUT, json_encode([
    'ok' => true,
    'user' => [
        'uid' => (string) ($updatedUser['uid'] ?? $updatedUser['id'] ?? ''),
        'username' => (string) ($updatedUser['username'] ?? ''),
        'email' => (string) ($updatedUser['email'] ?? ''),
    ],
    'credits' => firebase_credit_summary($updatedUser),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
