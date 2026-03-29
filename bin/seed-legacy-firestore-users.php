#!/usr/bin/env php
<?php

putenv('FIREBASE_FIRESTORE_TRANSPORT=rest');
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

$legacyIds = [];
foreach (array_slice($argv, 1) as $arg) {
    $id = (int) $arg;
    if ($id > 0) {
        $legacyIds[] = $id;
    }
}

if ($legacyIds === []) {
    $owners = [];
    foreach (all_files() as $file) {
        $legacyUserId = (int) ($file['user_id'] ?? 0);
        if ($legacyUserId > 0) {
            $owners[$legacyUserId] = true;
        }
    }
    $legacyIds = array_keys($owners);
    sort($legacyIds);
}

$seeded = 0;
$skipped = 0;

foreach ($legacyIds as $legacyId) {
    $legacy = legacy_find_user_by_id((int) $legacyId);
    if (!$legacy) {
        fwrite(STDERR, "skip legacy user {$legacyId}: not found\n");
        $skipped++;
        continue;
    }

    if (find_user_by_legacy_id((int) $legacyId)) {
        fwrite(STDOUT, "skip legacy user {$legacyId}: already mapped\n");
        $skipped++;
        continue;
    }

    $uid = 'legacy-import-' . $legacyId;
    $record = [
        'uid' => $uid,
        'id' => $uid,
        'username' => (string) ($legacy['username'] ?? ('legacy-user-' . $legacyId)),
        'role' => (string) ($legacy['role'] ?? 'user'),
        'email' => strtolower(trim((string) ($legacy['email'] ?? ''))),
        'email_verified' => !empty($legacy['email_verified']),
        'email_verified_at' => $legacy['email_verified_at'] ?? null,
        'created_at' => (string) ($legacy['created_at'] ?? gmdate('c')),
        'updated_at' => gmdate('c'),
        'firebase_uid' => $uid,
        'firebase_provider' => 'legacy-import',
        'firebase_last_login_at' => null,
        'firebase_claims' => [],
        'legacy_user_id' => (int) $legacyId,
    ];

    firebase_write_user_record($record);
    fwrite(STDOUT, "seeded {$uid}\n");
    $seeded++;
}

fwrite(STDOUT, sprintf("done: seeded=%d skipped=%d\n", $seeded, $skipped));
