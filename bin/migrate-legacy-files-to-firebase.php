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

$legacyFiles = all_files();
$migrated = 0;
$skipped = 0;
$errors = 0;
$ownerSkips = [];

foreach ($legacyFiles as $file) {
    $legacyId = (int) ($file['id'] ?? 0);
    $linkedFirebaseId = trim((string) ($file['migrated_to_firebase_id'] ?? ''));
    if ($legacyId < 1 || $linkedFirebaseId !== '') {
        $skipped++;
        continue;
    }

    $owner = find_user_by_legacy_id((int) ($file['user_id'] ?? 0));
    if (!$owner) {
        fwrite(STDERR, "skip legacy file {$legacyId}: owner not mapped to a Firebase profile yet\n");
        $ownerSkips[(string) ($file['user_id'] ?? 'unknown')] = ($ownerSkips[(string) ($file['user_id'] ?? 'unknown')] ?? 0) + 1;
        $skipped++;
        continue;
    }

    if (trim((string) ($owner['firebase_uid'] ?? '')) === '') {
        fwrite(STDERR, "skip legacy file {$legacyId}: owner {$owner['username']} has no firebase_uid\n");
        $skipped++;
        continue;
    }

    try {
        $result = firebase_migrate_legacy_file_record($file, $owner);
        $migrated++;
        fwrite(STDOUT, sprintf("migrated legacy file %d -> %s\n", $legacyId, (string) ($result['id'] ?? 'unknown')));
    } catch (Throwable $error) {
        $errors++;
        fwrite(STDERR, sprintf("failed legacy file %d: %s\n", $legacyId, $error->getMessage()));
    }
}

fwrite(STDOUT, sprintf("done: migrated=%d skipped=%d errors=%d\n", $migrated, $skipped, $errors));
if ($ownerSkips !== []) {
    ksort($ownerSkips);
    fwrite(STDOUT, "owner mapping blockers:\n");
    foreach ($ownerSkips as $legacyOwnerId => $count) {
        fwrite(STDOUT, sprintf("  legacy_user_id=%s pending_files=%d\n", $legacyOwnerId, $count));
    }
}
exit($errors > 0 ? 2 : 0);
