<?php
function app_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if ((int) ($_SERVER['SERVER_PORT'] ?? 0) === 443) {
        return true;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        $forwarded = explode(',', (string) $_SERVER['HTTP_X_FORWARDED_PROTO']);
        $proto = strtolower(trim((string) ($forwarded[0] ?? '')));
        if ($proto === 'https') {
            return true;
        }
    }
    if (!empty($_SERVER['REQUEST_SCHEME']) && strtolower((string) $_SERVER['REQUEST_SCHEME']) === 'https') {
        return true;
    }
    return false;
}

function app_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = app_is_https();
    $params = [
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ];

    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params($params);
    } else {
        session_set_cookie_params(
            $params['lifetime'],
            $params['path'] . '; samesite=' . $params['samesite'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }

    session_start();
}

function csrf_regenerate_token(): string
{
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf_token'];
}

app_session_start();

define('APP_ROOT', dirname(__DIR__));
define('ADMIN_NOTIFY_EMAIL', 'pamela.hauff@gmail.com');

require_once APP_ROOT . '/includes/firebase.php';
require_once APP_ROOT . '/includes/site_content.php';

auto_init_storage();

function app_storage_dir(): string
{
    $configured = trim((string) getenv('APP_STORAGE_DIR'));
    if ($configured !== '') {
        return $configured;
    }

    return dirname(APP_ROOT) . '/progen3d-storage';
}

function auto_init_storage(): void
{
    $storageDir = app_storage_dir();
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0770, true);
    }
    @chmod($storageDir, 0770);

    $mailLogPath = $storageDir . '/mail-debug.log';
    if (!file_exists($mailLogPath)) {
        @file_put_contents($mailLogPath, '');
    }
    @chmod($mailLogPath, 0660);
}

function storage_path(string $name): string
{
    return app_storage_dir() . '/' . ltrim($name, '/');
}

function storage_read(string $name, $default)
{
    $path = storage_path($name);
    if (!file_exists($path)) {
        return $default;
    }
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') {
        return $default;
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $default;
}

function storage_write(string $name, array $data): void
{
    $path = storage_path($name);
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $ok = file_put_contents($path, $json, LOCK_EX);
    if ($ok === false) {
        throw new RuntimeException('Failed to write storage file: ' . $path);
    }
    @chmod($path, 0666);
}

function normalize_user_role(?string $role): string
{
    $role = strtolower(trim((string) $role));
    return $role === 'admin' ? 'admin' : 'user';
}

function normalize_user_record(array $user): array
{
    $uid = trim((string) ($user['uid'] ?? ($user['id'] ?? ($user['firebase_uid'] ?? ''))));
    $user['uid'] = $uid;
    $user['id'] = $uid;
    $user['username'] = trim((string) ($user['username'] ?? ''));
    $user['role'] = normalize_user_role($user['role'] ?? 'user');
    $user['email'] = strtolower(trim((string) ($user['email'] ?? '')));
    $user['email_verified'] = !empty($user['email_verified']);
    $user['email_verified_at'] = $user['email_verified_at'] ?? null;
    $user['created_at'] = (string) ($user['created_at'] ?? '');
    $user['updated_at'] = (string) ($user['updated_at'] ?? ($user['created_at'] ?? ''));
    $user['firebase_uid'] = $uid;
    $user['firebase_provider'] = (string) ($user['firebase_provider'] ?? '');
    $user['firebase_last_login_at'] = $user['firebase_last_login_at'] ?? null;
    $user['firebase_claims'] = is_array($user['firebase_claims'] ?? null) ? $user['firebase_claims'] : [];
    $user['legacy_user_id'] = isset($user['legacy_user_id']) && (int) $user['legacy_user_id'] > 0 ? (int) $user['legacy_user_id'] : null;
    return $user;
}

function all_users(): array
{
    return firebase_all_users();
}

function save_users(array $users): void
{
    foreach ($users as $user) {
        firebase_write_user_record($user);
    }
}

function can_assign_admin_role(?array $actor = null): bool
{
    return is_admin($actor);
}

function find_user_by_username(string $username): ?array
{
    foreach (all_users() as $user) {
        if (($user['username'] ?? '') === $username) {
            return $user;
        }
    }
    return null;
}

function find_user_by_email(string $email): ?array
{
    $email = strtolower(trim($email));
    foreach (all_users() as $user) {
        if (($user['email'] ?? '') === $email) {
            return $user;
        }
    }
    return null;
}

function find_user_by_id(string $id): ?array
{
    foreach (all_users() as $user) {
        if ((string) ($user['uid'] ?? $user['id'] ?? '') === $id) {
            return $user;
        }
    }
    return null;
}

function find_user_by_firebase_uid(string $uid): ?array
{
    $uid = trim($uid);
    if ($uid === '') {
        return null;
    }

    foreach (all_users() as $user) {
        if (trim((string) ($user['firebase_uid'] ?? '')) === $uid) {
            return $user;
        }
    }

    return null;
}

function find_user_by_legacy_id(int $legacyUserId): ?array
{
    if ($legacyUserId < 1) {
        return null;
    }

    foreach (all_users() as $user) {
        if ((int) ($user['legacy_user_id'] ?? 0) === $legacyUserId) {
            return $user;
        }
    }

    return null;
}

function legacy_users(): array
{
    return array_values(array_map('normalize_user_record', storage_read('users.json', [])));
}

function legacy_find_user_by_email(string $email): ?array
{
    $email = strtolower(trim($email));
    if ($email === '') {
        return null;
    }

    foreach (legacy_users() as $user) {
        if (($user['email'] ?? '') === $email) {
            return $user;
        }
    }

    return null;
}

function legacy_find_user_by_id(int $id): ?array
{
    if ($id < 1) {
        return null;
    }

    foreach (legacy_users() as $user) {
        if ((int) ($user['legacy_user_id'] ?? $user['id'] ?? 0) === $id) {
            return $user;
        }
    }

    return null;
}

function create_user_record(string $uid, string $username, string $role = 'user', bool $bypassRoleGuard = false, string $email = '', ?int $legacyUserId = null): array
{
    $actor = current_user();
    $requestedRole = normalize_user_role($role);
    $assignedRole = ($requestedRole === 'admin' && !$bypassRoleGuard && !can_assign_admin_role($actor)) ? 'user' : $requestedRole;
    $record = [
        'uid' => $uid,
        'id' => $uid,
        'username' => $username,
        'role' => $assignedRole,
        'email' => strtolower(trim($email)),
        'email_verified' => false,
        'email_verified_at' => null,
        'created_at' => gmdate('c'),
        'updated_at' => gmdate('c'),
        'firebase_uid' => $uid,
        'legacy_user_id' => $legacyUserId,
    ];

    return firebase_write_user_record($record);
}

function update_user_record(string $uid, callable $updater): ?array
{
    $user = find_user_by_id($uid);
    if (!$user) {
        return null;
    }

    $updated = $updater($user);
    if (!is_array($updated)) {
        return null;
    }

    $updated['uid'] = $uid;
    $updated['id'] = $uid;
    $updated['updated_at'] = gmdate('c');
    return firebase_write_user_record($updated);
}

function delete_user_record(string $uid): bool
{
    return firebase_delete_user_record($uid);
}

function app_mail_from(): string
{
    $from = trim((string) getenv('APP_MAIL_FROM'));
    if ($from !== '') {
        return $from;
    }
    $host = preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost'));
    if ($host === '') {
        $host = 'localhost';
    }
    return 'no-reply@' . $host;
}

function app_mail_debug_log(array $entry): void
{
    $path = storage_path('mail-debug.log');
    $record = [
        'timestamp' => gmdate('c'),
        'request_method' => (string) ($_SERVER['REQUEST_METHOD'] ?? 'CLI'),
        'request_uri' => (string) ($_SERVER['REQUEST_URI'] ?? ''),
        'remote_addr' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
        'entry' => $entry,
    ];
    $line = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($line)) {
        return;
    }
    @file_put_contents($path, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    @chmod($path, 0666);
}

function send_app_email(string $to, string $subject, string $body, ?string $replyTo = null): bool
{
    $to = trim($to);
    if ($to === '') {
        app_mail_debug_log([
            'status' => 'skipped',
            'reason' => 'empty_recipient',
            'subject' => $subject,
        ]);
        return false;
    }
    $from = app_mail_from();
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . $from,
    ];
    if ($replyTo) {
        $headers[] = 'Reply-To: ' . trim($replyTo);
    }
    app_mail_debug_log([
        'status' => 'attempt',
        'to' => $to,
        'subject' => $subject,
        'from' => $from,
        'reply_to' => $replyTo ? trim($replyTo) : '',
        'body_length' => strlen($body),
    ]);
    $ok = @mail($to, $subject, $body, implode("\r\n", $headers));
    app_mail_debug_log([
        'status' => $ok ? 'sent_to_mail_transport' : 'mail_failed',
        'to' => $to,
        'subject' => $subject,
        'from' => $from,
        'reply_to' => $replyTo ? trim($replyTo) : '',
        'body_length' => strlen($body),
        'mail_return' => $ok,
    ]);
    if (!$ok) {
        error_log(sprintf('mail delivery failed [to=%s subject=%s]', $to, $subject));
    }
    return $ok;
}

function generate_email_verification_code(): string
{
    return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function issue_email_verification_code(int $userId): ?array
{
    return null;
}

function send_verification_email(array $user, string $code): bool
{
    $email = (string) ($user['email'] ?? '');
    if ($email === '') {
        return false;
    }
    $subject = 'Verify your ProGen3D account';
    $body = implode("\n", [
        'Welcome to ProGen3D.',
        '',
        'Your verification code is: ' . $code,
        'This code expires in 15 minutes.',
        '',
        'Username: ' . (string) ($user['username'] ?? ''),
    ]);
    return send_app_email($email, $subject, $body);
}

function issue_password_reset_code(int $userId): ?array
{
    return null;
}

function send_password_reset_email(array $user, string $code): bool
{
    $email = (string) ($user['email'] ?? '');
    if ($email === '') {
        return false;
    }
    $subject = 'Reset your ProGen3D password';
    $body = implode("\n", [
        'We received a password reset request for your ProGen3D account.',
        '',
        'Your login code is: ' . $code,
        'This code expires in 15 minutes.',
        '',
        'Username: ' . (string) ($user['username'] ?? ''),
    ]);
    return send_app_email($email, $subject, $body);
}

function send_registration_admin_notification(array $user): bool
{
    $subject = 'New ProGen3D user registration';
    $body = implode("\n", [
        'A new user account was created.',
        '',
        'Username: ' . (string) ($user['username'] ?? ''),
        'Email: ' . (string) ($user['email'] ?? ''),
        'Role: ' . (string) ($user['role'] ?? 'user'),
        'Created: ' . (string) ($user['created_at'] ?? ''),
        'Email verified: ' . (!empty($user['email_verified']) ? 'yes' : 'no'),
    ]);
    return send_app_email(ADMIN_NOTIFY_EMAIL, $subject, $body, (string) ($user['email'] ?? ''));
}

function send_publish_admin_notification(array $file): bool
{
    $subject = 'ProGen3D grammar published';
    $body = implode("\n", [
        'A grammar was published to the site.',
        '',
        'Title: ' . (string) ($file['title'] ?? ''),
        'File ID: ' . (string) ($file['id'] ?? ''),
        'Author: ' . (string) ($file['username'] ?? 'unknown'),
        'Author email: ' . (string) ($file['email'] ?? ''),
        'Published at: ' . (string) ($file['published_at'] ?? ''),
        '',
        'Preview:',
        preview_excerpt((string) ($file['content'] ?? ''), 600),
    ]);
    return send_app_email(ADMIN_NOTIFY_EMAIL, $subject, $body, (string) ($file['email'] ?? ''));
}

function verify_user_email_code(int $userId, string $code): ?array
{
    return null;
}

function reset_user_password_with_code(int $userId, string $code, string $newPassword): ?array
{
    return null;
}

function all_files(): array
{
    $files = storage_read('files.json', []);
    return array_values(array_map('normalize_legacy_file_record', is_array($files) ? $files : []));
}

function save_files(array $files): void
{
    $files = array_values(array_map('normalize_legacy_file_record', $files));
    usort($files, function ($a, $b) {
        return strcmp((string) ($b['updated_at'] ?? ''), (string) ($a['updated_at'] ?? ''));
    });
    storage_write('files.json', array_values($files));
}

function normalize_legacy_file_record(array $file): array
{
    $file['id'] = (int) ($file['id'] ?? 0);
    $file['user_id'] = (int) ($file['user_id'] ?? 0);
    $file['title'] = (string) ($file['title'] ?? 'Untitled grammar');
    $file['content'] = (string) ($file['content'] ?? '');
    $file['is_published'] = !empty($file['is_published']) ? 1 : 0;
    $file['created_at'] = (string) ($file['created_at'] ?? '');
    $file['updated_at'] = (string) ($file['updated_at'] ?? '');
    $file['published_at'] = $file['published_at'] ?? null;
    $file['migrated_to_firebase_id'] = trim((string) ($file['migrated_to_firebase_id'] ?? ''));
    $file['migrated_at'] = $file['migrated_at'] ?? null;
    return $file;
}

function is_admin(?array $user = null): bool
{
    return normalize_user_role($user['role'] ?? '') === 'admin';
}

function file_owner_map(): array
{
    $owners = [];
    foreach (all_users() as $user) {
        $owners[(int) ($user['id'] ?? 0)] = [
            'username' => (string) ($user['username'] ?? 'unknown'),
            'role' => normalize_user_role($user['role'] ?? 'user'),
            'email' => (string) ($user['email'] ?? ''),
        ];
    }
    return $owners;
}

function decorate_file_owner(array $file, ?array $owners = null): array
{
    $owners = $owners ?? file_owner_map();
    $owner = $owners[(int) ($file['user_id'] ?? 0)] ?? ['username' => 'unknown', 'role' => 'user', 'email' => ''];
    $file['username'] = $owner['username'];
    $file['owner_role'] = $owner['role'];
    $file['email'] = $owner['email'];
    return $file;
}

function get_user_files(int $userId): array
{
    $current = current_user();
    $files = is_admin($current)
        ? all_files()
        : array_values(array_filter(all_files(), fn($file) => (int) ($file['user_id'] ?? 0) === $userId));
    $owners = file_owner_map();
    return array_values(array_map(fn($file) => decorate_file_owner($file, $owners), $files));
}

function get_public_files(): array
{
    $owners = file_owner_map();
    $files = array_values(array_filter(all_files(), fn($file) => !empty($file['is_published'])));
    foreach ($files as &$file) {
        $file = decorate_file_owner($file, $owners);
    }
    unset($file);
    usort($files, function ($a, $b) {
        $aDate = (string) ($a['published_at'] ?? $a['updated_at'] ?? '');
        $bDate = (string) ($b['published_at'] ?? $b['updated_at'] ?? '');
        return strcmp($bDate, $aDate);
    });
    return $files;
}

function find_user_file(int $id, int $userId): ?array
{
    $current = current_user();
    $owners = file_owner_map();
    foreach (all_files() as $file) {
        if ((int) ($file['id'] ?? 0) !== $id) {
            continue;
        }
        if (is_admin($current) || (int) ($file['user_id'] ?? 0) === $userId) {
            return decorate_file_owner($file, $owners);
        }
    }
    return null;
}

function find_public_file(int $id): ?array
{
    $owners = file_owner_map();
    foreach (all_files() as $file) {
        if ((int) ($file['id'] ?? 0) === $id && !empty($file['is_published'])) {
            return decorate_file_owner($file, $owners);
        }
    }
    return null;
}

function mark_legacy_file_migrated(int $id, string $firebaseId): ?array
{
    $firebaseId = trim($firebaseId);
    if ($id < 1 || $firebaseId === '') {
        return null;
    }

    $files = all_files();
    foreach ($files as $index => $file) {
        if ((int) ($file['id'] ?? 0) !== $id) {
            continue;
        }
        $files[$index]['migrated_to_firebase_id'] = $firebaseId;
        $files[$index]['migrated_at'] = gmdate('c');
        save_files($files);
        return $files[$index];
    }

    return null;
}

function upsert_file_record(int $userId, ?int $id, string $title, string $content, bool $publish = false): array
{
    $files = all_files();
    $now = gmdate('c');
    $title = trim($title) !== '' ? trim($title) : 'Untitled grammar';
    $current = current_user();

    if ($id) {
        foreach ($files as &$file) {
            if ((int) ($file['id'] ?? 0) === $id && (is_admin($current) || (int) ($file['user_id'] ?? 0) === $userId)) {
                $wasPublished = !empty($file['is_published']);
                $file['title'] = $title;
                $file['content'] = $content;
                $file['updated_at'] = $now;
                if ($publish) {
                    $file['is_published'] = 1;
                    if (empty($file['published_at'])) {
                        $file['published_at'] = $now;
                    }
                }
                save_files($files);
                $decorated = decorate_file_owner($file);
                if ($publish && !$wasPublished) {
                    send_publish_admin_notification($decorated);
                }
                return $decorated;
            }
        }
        unset($file);
    }

    $record = [
        'id' => next_id('files'),
        'user_id' => $userId,
        'title' => $title,
        'content' => $content,
        'is_published' => $publish ? 1 : 0,
        'created_at' => $now,
        'updated_at' => $now,
        'published_at' => $publish ? $now : null,
    ];
    $files[] = $record;
    save_files($files);
    $decorated = decorate_file_owner($record);
    if ($publish) {
        send_publish_admin_notification($decorated);
    }
    return $decorated;
}

function set_file_published(int $id, int $userId, bool $published): bool
{
    $files = all_files();
    $current = current_user();
    foreach ($files as &$file) {
        if ((int) ($file['id'] ?? 0) === $id && (is_admin($current) || (int) ($file['user_id'] ?? 0) === $userId)) {
            $wasPublished = !empty($file['is_published']);
            $file['is_published'] = $published ? 1 : 0;
            $file['updated_at'] = gmdate('c');
            if ($published && empty($file['published_at'])) {
                $file['published_at'] = gmdate('c');
            }
            save_files($files);
            if ($published && !$wasPublished) {
                send_publish_admin_notification(decorate_file_owner($file));
            }
            return true;
        }
    }
    unset($file);
    return false;
}

function delete_file_record(int $id, int $userId): bool
{
    $files = all_files();
    $originalCount = count($files);
    $current = current_user();
    $files = array_values(array_filter($files, function ($file) use ($id, $userId, $current) {
        if ((int) ($file['id'] ?? 0) !== $id) {
            return true;
        }
        if (is_admin($current)) {
            return false;
        }
        return (int) ($file['user_id'] ?? 0) !== $userId;
    }));
    if (count($files) !== $originalCount) {
        save_files($files);
        return true;
    }
    return false;
}

function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function preview_excerpt(?string $value, int $width = 280): string
{
    $text = (string) $value;
    if ($width < 1) {
        return '';
    }
    if (function_exists('mb_strimwidth')) {
        return mb_strimwidth($text, 0, $width, '…', 'UTF-8');
    }
    if (strlen($text) <= $width) {
        return $text;
    }
    return rtrim(substr($text, 0, max(0, $width - 3))) . '...';
}

function current_user(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }
    $user = empty($_SESSION['firebase_uid']) ? null : find_user_by_id((string) $_SESSION['firebase_uid']);
    return $user;
}

function app_url(string $path = ''): string
{
    $path = ltrim($path, '/');

    $scheme = app_is_https() ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost');

    $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    $baseDir = trim(str_replace('\\', '/', dirname($scriptName)), '/');

    if ($baseDir === '.' || $baseDir === '/') {
        $baseDir = '';
    }

    if ($baseDir !== '') {
        $parts = explode('/', $baseDir);
        if (!empty($parts) && end($parts) === 'api') {
            array_pop($parts);
            $baseDir = trim(implode('/', $parts), '/');
        }
    }

    $url = $scheme . '://' . $host;
    if ($baseDir !== '') {
        $url .= '/' . $baseDir;
    }
    if ($path !== '') {
        $url .= '/' . $path;
    }
    return $url;
}

function app_redirect(string $path, int $status = 302): void
{
    header('Location: ' . app_url($path), true, $status);
    exit;
}

function require_login(): void
{
    if (!current_user()) {
        app_redirect('login.php');
    }
}

function require_admin(): void
{
    $user = current_user();
    if (!$user) {
        app_redirect('login.php');
    }
    if (!is_admin($user)) {
        flash_set('error', 'Admin access required.');
        app_redirect('index.php');
    }
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        return csrf_regenerate_token();
    }
    return (string) $_SESSION['csrf_token'];
}


function verify_csrf(): void
{
    $requestToken = (string) ($_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $sessionToken = (string) ($_SESSION['csrf_token'] ?? '');

    if ($requestToken === '' || $sessionToken === '' || !hash_equals($sessionToken, $requestToken)) {
        error_log(sprintf(
            'csrf failure [method=%s uri=%s sid=%s session_token=%s request_token=%s]',
            (string) ($_SERVER['REQUEST_METHOD'] ?? 'CLI'),
            (string) ($_SERVER['REQUEST_URI'] ?? ''),
            session_id(),
            $sessionToken !== '' ? 'present' : 'missing',
            $requestToken !== '' ? 'present' : 'missing'
        ));
        http_response_code(419);
        echo 'Session expired or CSRF token mismatch.';
        exit;
    }
}


function flash_set(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function flash_get(): ?array
{
    if (empty($_SESSION['flash'])) {
        return null;
    }
    $flash = $_SESSION['flash'];
    unset($_SESSION['flash']);
    return $flash;
}

function render_header(string $title, string $active = '', array $options = []): void
{
    $user = current_user();
    $flash = flash_get();
    $hasPendingVerification = !empty($_SESSION['pending_verification_user_id']);
    $hasPendingPasswordReset = !empty($_SESSION['pending_password_reset_user_id']);
    $bodyClass = trim((string) ($options['body_class'] ?? ''));
    $extraHead = $options['extra_head'] ?? '';
    if (is_array($extraHead)) {
        $extraHead = implode("\n", array_map('strval', $extraHead));
    }
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title><?= e($title) ?> | ProGen3D Live Site</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="assets/site.css">
      <?php if ($extraHead !== ''): ?>
        <?= $extraHead ?>
      <?php endif; ?>
    </head>
    <body<?= $bodyClass !== '' ? ' class="' . e($bodyClass) . '"' : '' ?> data-page="<?= e($active !== '' ? $active : 'page') ?>" data-auth="<?= $user ? '1' : '0' ?>">
      <div class="site-backdrop" aria-hidden="true">
        <div class="site-backdrop__orb site-backdrop__orb--a"></div>
        <div class="site-backdrop__orb site-backdrop__orb--b"></div>
        <div class="site-backdrop__glow"></div>
        <div class="site-backdrop__grid"></div>
      </div>
      <header class="site-header">
        <div class="site-shell header-shell">
          <a class="brand" href="index.php">
            <span class="brand-mark">P3D</span>
            <span>
              <strong>ProGen3D</strong>
              <small>Live grammar studio</small>
            </span>
          </a>
          <nav class="site-nav" aria-label="Primary navigation">
            <a class="<?= $active === 'home' ? 'active' : '' ?>" href="index.php">Home</a>
            <a class="<?= $active === 'docs' ? 'active' : '' ?>" href="docs.php">Docs</a>
            <a class="<?= $active === 'reference' ? 'active' : '' ?>" href="reference.php">Reference</a>
            <a class="<?= $active === 'examples' ? 'active' : '' ?>" href="examples.php">Examples</a>
            <a class="<?= $active === 'gallery' ? 'active' : '' ?>" href="gallery.php">Gallery</a>
            <button class="site-tour-launch js-site-tour-launch" type="button" title="Start the guided interactive site tour">Interactive site tour</button>
            <?php if ($user): ?>
              <a class="<?= $active === 'editor' ? 'active' : '' ?>" href="editor.php">Editor</a>
              <a class="<?= $active === 'files' ? 'active' : '' ?>" href="files.php"><?= is_admin($user) ? 'All Files' : 'My Files' ?></a>
              <?php if (is_admin($user)): ?>
                <a class="<?= $active === 'builtin-rules' ? 'active' : '' ?>" href="BuiltinRuleLibrary.php">Builtin Rules</a>
                <a class="<?= $active === 'admin' ? 'active' : '' ?>" href="admin.php">Admin</a>
              <?php endif; ?>
              <a class="nav-pill" href="logout.php">Logout · <?= e($user['username']) ?></a>
            <?php else: ?>
              <a class="<?= $active === 'login' ? 'active' : '' ?>" href="login.php">Login</a>
              <a class="<?= $active === 'forgot-password' ? 'active' : '' ?>" href="forgot-password.php">Forgot Password</a>
              <?php if ($hasPendingVerification): ?>
                <a class="<?= $active === 'verify-email' ? 'active' : '' ?>" href="verify-email.php">Verify Email</a>
              <?php endif; ?>
              <?php if ($hasPendingPasswordReset): ?>
                <a class="<?= $active === 'reset-password' ? 'active' : '' ?>" href="reset-password.php">Reset Password</a>
              <?php endif; ?>
              <a class="nav-pill" href="register.php">Create account</a>
            <?php endif; ?>
          </nav>
        </div>
      </header>
      <?php if ($flash): ?>
        <div class="site-shell flash-wrap">
          <div class="flash flash-<?= e($flash['type']) ?>"><?= e($flash['message']) ?></div>
        </div>
      <?php endif; ?>
    <?php
}

function render_footer(): void
{
    $examples = site_examples();
    $user = current_user();
    $hasPendingVerification = !empty($_SESSION['pending_verification_user_id']);
    $hasPendingPasswordReset = !empty($_SESSION['pending_password_reset_user_id']);
    ?>
      <footer class="site-footer">
        <div class="site-shell footer-shell">
          <div class="footer-brand-block">
            <span class="eyebrow">ProGen3D live site</span>
            <h2>Procedural grammar authoring, live scene viewing, and publishable workflow in one site shell.</h2>
            <p>Use the editor for live grammar work, the file library for private organisation, the gallery for public browsing, and the docs stack when you need syntax or examples close to the runtime.</p>
          </div>
          <div class="footer-link-columns">
            <div class="footer-link-group">
              <strong>Explore</strong>
              <a href="editor.php">Editor</a>
              <a href="files.php">My files</a>
              <a href="gallery.php">Gallery</a>
            </div>
            <div class="footer-link-group">
              <strong>Learn</strong>
              <a href="docs.php">Documentation</a>
              <a href="reference.php">Reference</a>
              <a href="examples.php">Examples</a>
            </div>
            <div class="footer-link-group">
              <strong>Account</strong>
              <?php if ($user): ?>
                <a href="editor.php">Editor workspace</a>
                <a href="files.php"><?= is_admin($user) ? 'All files' : 'My files' ?></a>
                <?php if (is_admin($user)): ?><a href="BuiltinRuleLibrary.php">Builtin rules</a><?php endif; ?>
                <?php if (is_admin($user)): ?><a href="admin.php">Admin dashboard</a><?php endif; ?>
                <a href="logout.php">Logout</a>
              <?php else: ?>
                <a href="login.php">Login</a>
                <a href="register.php">Create account</a>
                <a href="forgot-password.php">Forgot password</a>
                <?php if ($hasPendingVerification): ?><a href="verify-email.php">Verify email</a><?php endif; ?>
                <?php if ($hasPendingPasswordReset): ?><a href="reset-password.php">Reset password</a><?php endif; ?>
              <?php endif; ?>
            </div>
            <div class="footer-link-group footer-link-group--note">
              <strong>Fast start</strong>
              <p>Paste one of the <?= count($examples) ?> examples into the editor, run it, then save or publish when the scene reads clearly.</p>
            </div>
          </div>
        </div>
      </footer>
      <script>
        window.P3D_FIREBASE_CONFIG = <?= firebase_client_config_json() ?>;
        window.P3D_FIREBASE_RUNTIME = <?= json_encode(firebase_admin_runtime_status(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
      </script>
      <script type="module" src="assets/firebase-client.js"></script>
      <script type="module" src="assets/firebase-auth-pages.js"></script>
      <script src="assets/site.js"></script>
    </body>
    </html>
    <?php
}
