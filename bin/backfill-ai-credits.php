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

$defaultCredits = max(0, (int) (getenv('APP_DEFAULT_AI_CREDITS') !== false ? getenv('APP_DEFAULT_AI_CREDITS') : 25));
$onlyZeroBalance = true;
$confirmAllUsers = false;
$referenceId = 'initial_ai_credit_backfill_v1';

foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--credits=(\d+)$/', $arg, $matches)) {
        $defaultCredits = max(0, (int) $matches[1]);
        continue;
    }
    if ($arg === '--all-users') {
        $onlyZeroBalance = false;
        continue;
    }
    if ($arg === '--confirm-all-users') {
        $confirmAllUsers = true;
        continue;
    }
    if (str_starts_with($arg, '--reference=')) {
        $referenceId = trim(substr($arg, 12)) ?: $referenceId;
        continue;
    }
}

if ($onlyZeroBalance === false && !$confirmAllUsers) {
    fwrite(STDERR, "--all-users requires --confirm-all-users\n");
    exit(1);
}

if (!firebase_credit_transactions_available()) {
    fwrite(STDERR, "AI credit transactions are not available. Configure the Firestore SDK transaction path.\n");
    exit(1);
}

$result = firebase_backfill_ai_credits($defaultCredits, $onlyZeroBalance, $referenceId);
fwrite(STDOUT, json_encode([
    'ok' => true,
    'default_credits' => $defaultCredits,
    'only_zero_balance' => $onlyZeroBalance,
    'reference_id' => $referenceId,
    'updated' => $result['updated'] ?? 0,
    'skipped' => $result['skipped'] ?? 0,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
