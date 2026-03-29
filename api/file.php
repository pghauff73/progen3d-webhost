<?php
require __DIR__ . '/../includes/bootstrap.php';
header('Content-Type: application/json; charset=UTF-8');

function api_json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$action = (string) ($_GET['action'] ?? '');

function json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function api_authenticated_user_json(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }

    $bearer = firebase_extract_bearer_token();
    if ($bearer !== '') {
        $verified = firebase_verify_id_token($bearer);
        if (!$verified['ok']) {
            api_json_response(['ok' => false, 'error' => $verified['error'], 'runtime' => $verified['runtime'] ?? null], (int) ($verified['status'] ?? 401));
        }

        if (empty($verified['identity']['emailVerified'])) {
            api_json_response(['ok' => false, 'error' => 'Email verification is required.'], 403);
        }

        try {
            $user = sync_firebase_identity_to_local($verified['identity']);
            $_SESSION['firebase_uid'] = (string) ($user['uid'] ?? $user['id'] ?? '');
            return $user;
        } catch (Throwable $error) {
            api_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
        }
    }

    $user = current_user();
    return $user;
}

function api_require_login_json(): array
{
    $user = api_authenticated_user_json();
    if (!$user) {
        api_json_response(['ok' => false, 'error' => 'Authentication required.'], 401);
    }

    return $user;
}

if ($action === 'get_public') {
    $id = trim((string) ($_GET['id'] ?? ''));
    $file = app_find_public_file($id);
    if (!$file) {
        api_json_response(['ok' => false, 'error' => 'Published file not found.'], 404);
    }
    api_json_response(['ok' => true, 'file' => $file, 'backend' => $file['backend'] ?? app_file_backend_label()]);
}

if ($action === 'get') {
    $user = api_require_login_json();
    $id = trim((string) ($_GET['id'] ?? ''));
    $file = app_find_user_file($id, $user);
    if (!$file) {
        api_json_response(['ok' => false, 'error' => 'File not found.'], 404);
    }
    api_json_response(['ok' => true, 'file' => $file, 'backend' => $file['backend'] ?? app_file_backend_label($user)]);
}

$user = api_require_login_json();
if (firebase_extract_bearer_token() === '') {
    verify_csrf();
}
$body = json_body();

if ($action === 'save') {
    $id = isset($body['file_id']) && $body['file_id'] !== null ? trim((string) $body['file_id']) : (isset($body['id']) && $body['id'] !== null ? trim((string) $body['id']) : null);
    $title = (string) ($body['title'] ?? 'Untitled grammar');
    $content = (string) ($body['content'] ?? '');
    if ($content === '') {
        api_json_response(['ok' => false, 'error' => 'Grammar content is empty.'], 422);
    }
    $file = app_upsert_file_record($user, $id, $title, $content, false);
    api_json_response(['ok' => true, 'file' => ['id' => (string) $file['id'], 'title' => $file['title']], 'backend' => $file['backend'] ?? app_file_backend_label($user)]);
}

if ($action === 'publish') {
    $id = isset($body['file_id']) && $body['file_id'] !== null ? trim((string) $body['file_id']) : (isset($body['id']) && $body['id'] !== null ? trim((string) $body['id']) : null);
    $title = (string) ($body['title'] ?? 'Untitled grammar');
    $content = (string) ($body['content'] ?? '');
    if ($content === '') {
        api_json_response(['ok' => false, 'error' => 'Grammar content is empty.'], 422);
    }
    $file = app_upsert_file_record($user, $id, $title, $content, true);
    api_json_response(['ok' => true, 'file' => ['id' => (string) $file['id'], 'title' => $file['title'], 'is_published' => 1], 'backend' => $file['backend'] ?? app_file_backend_label($user)]);
}

if ($action === 'unpublish') {
    $id = trim((string) ($body['file_id'] ?? ($body['id'] ?? '')));
    if (!app_set_file_published($id, $user, false)) {
        api_json_response(['ok' => false, 'error' => 'File not found or not editable.'], 404);
    }
    api_json_response(['ok' => true, 'backend' => app_file_backend_label($user)]);
}

api_json_response(['ok' => false, 'error' => 'Unknown action.'], 400);
