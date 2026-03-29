<?php
require __DIR__ . '/../includes/bootstrap.php';
header('Content-Type: application/json; charset=UTF-8');

function builtin_rules_json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function builtin_rules_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function builtin_rules_authenticated_user(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }

    $bearer = firebase_extract_bearer_token();
    if ($bearer !== '') {
        $verified = firebase_verify_id_token($bearer);
        if (!$verified['ok']) {
            builtin_rules_json_response(['ok' => false, 'error' => $verified['error'], 'runtime' => $verified['runtime'] ?? null], (int) ($verified['status'] ?? 401));
        }

        if (empty($verified['identity']['emailVerified'])) {
            builtin_rules_json_response(['ok' => false, 'error' => 'Email verification is required.'], 403);
        }

        try {
            $user = sync_firebase_identity_to_local($verified['identity']);
            $_SESSION['firebase_uid'] = (string) ($user['uid'] ?? $user['id'] ?? '');
            return $user;
        } catch (Throwable $error) {
            builtin_rules_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
        }
    }

    $user = current_user();
    return $user;
}

function builtin_rules_require_admin(): array
{
    $user = builtin_rules_authenticated_user();
    if (!$user) {
        builtin_rules_json_response(['ok' => false, 'error' => 'Authentication required.'], 401);
    }
    if (!is_admin($user)) {
        builtin_rules_json_response(['ok' => false, 'error' => 'Admin access required.'], 403);
    }

    return $user;
}

$action = (string) ($_GET['action'] ?? 'publish');
$body = builtin_rules_json_body();

if ($action === 'library') {
    $user = builtin_rules_authenticated_user();
    if (!$user) {
        builtin_rules_json_response(['ok' => false, 'error' => 'Authentication required.'], 401);
    }

    try {
        builtin_rules_json_response([
            'ok' => true,
            'library' => firebase_builtin_rule_library_payload(true),
        ]);
    } catch (Throwable $error) {
        builtin_rules_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
    }
}

if ($action === 'resolve') {
    $user = builtin_rules_authenticated_user();
    if (!$user) {
        builtin_rules_json_response(['ok' => false, 'error' => 'Authentication required.'], 401);
    }

    $entryRules = $body['entry_rules'] ?? $_GET['entry_rules'] ?? [];
    if (is_string($entryRules)) {
        $entryRules = [$entryRules];
    }
    if (!is_array($entryRules)) {
        builtin_rules_json_response(['ok' => false, 'error' => 'entry_rules must be an array.'], 422);
    }

    $resolved = [];
    foreach ($entryRules as $entryRule) {
        $name = trim((string) $entryRule);
        if ($name === '') {
            continue;
        }
        $record = firebase_builtin_rule_find_by_entry_rule($name, true);
        if (!$record || empty($record['is_active'])) {
            continue;
        }
        $resolved[$name] = [
            'id' => (string) ($record['id'] ?? ''),
            'title' => (string) ($record['title'] ?? ''),
            'entry_rule' => (string) ($record['entry_rule'] ?? ''),
            'group' => (string) ($record['group'] ?? 'General'),
            'summary' => (string) ($record['summary'] ?? ''),
            'grammar' => (string) ($record['grammar'] ?? ''),
            'updated_at' => (string) ($record['updated_at'] ?? ''),
        ];
    }

    builtin_rules_json_response([
        'ok' => true,
        'rulesByEntryRule' => $resolved,
    ]);
}

$user = builtin_rules_require_admin();
if (firebase_extract_bearer_token() === '') {
    verify_csrf();
}

if ($action === 'publish') {
    try {
        $record = firebase_publish_builtin_rule($user, [
            'title' => (string) ($body['title'] ?? ''),
            'entry_rule' => (string) ($body['entry_rule'] ?? ''),
            'group' => (string) ($body['group'] ?? ''),
            'summary' => (string) ($body['summary'] ?? ''),
            'grammar' => (string) ($body['grammar'] ?? ''),
        ]);

        builtin_rules_json_response([
            'ok' => true,
            'record' => $record,
            'library' => firebase_builtin_rule_library_payload(true),
        ]);
    } catch (Throwable $error) {
        builtin_rules_json_response(['ok' => false, 'error' => $error->getMessage()], 422);
    }
}

builtin_rules_json_response(['ok' => false, 'error' => 'Unknown action.'], 400);
