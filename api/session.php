<?php
require __DIR__ . '/../includes/bootstrap.php';
header('Content-Type: application/json; charset=UTF-8');

function session_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function session_json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$action = (string) ($_GET['action'] ?? '');

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    session_id('');
    app_session_start();
    csrf_regenerate_token();
    session_json_response(['ok' => true]);
}

if ($action !== 'login') {
    session_json_response(['ok' => false, 'error' => 'Unknown action.'], 400);
}

$body = session_json_body();
$idToken = trim((string) ($body['idToken'] ?? firebase_extract_bearer_token()));
$displayName = trim((string) ($body['displayName'] ?? ''));
$verified = firebase_verify_id_token($idToken);
if (!$verified['ok']) {
    session_json_response(['ok' => false, 'error' => $verified['error'], 'runtime' => $verified['runtime'] ?? null], (int) ($verified['status'] ?? 401));
}

$identity = $verified['identity'];
if (empty($identity['emailVerified'])) {
    session_json_response(['ok' => false, 'error' => 'Email verification is required before opening the site workspace.'], 403);
}

try {
    $user = sync_firebase_identity_to_local($identity, $displayName);
    session_regenerate_id(true);
    $_SESSION['firebase_uid'] = (string) ($user['uid'] ?? $user['id'] ?? '');
    unset($_SESSION['pending_verification_user_id'], $_SESSION['pending_password_reset_user_id']);
    csrf_regenerate_token();

    session_json_response([
        'ok' => true,
        'user' => [
            'id' => (string) ($user['uid'] ?? $user['id'] ?? ''),
            'username' => (string) ($user['username'] ?? ''),
            'email' => (string) ($user['email'] ?? ''),
            'role' => (string) ($user['role'] ?? 'user'),
        ],
    ]);
} catch (Throwable $error) {
    session_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
}
