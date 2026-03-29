<?php
require __DIR__ . '/../includes/bootstrap.php';

function textures_json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function textures_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function textures_authenticated_user_json(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }

    $bearer = firebase_extract_bearer_token();
    if ($bearer !== '') {
        $verified = firebase_verify_id_token($bearer);
        if (!$verified['ok']) {
            textures_json_response(['ok' => false, 'error' => $verified['error'], 'runtime' => $verified['runtime'] ?? null], (int) ($verified['status'] ?? 401));
        }

        if (empty($verified['identity']['emailVerified'])) {
            textures_json_response(['ok' => false, 'error' => 'Email verification is required.'], 403);
        }

        try {
            $user = sync_firebase_identity_to_local($verified['identity']);
            $_SESSION['firebase_uid'] = (string) ($user['uid'] ?? $user['id'] ?? '');
            return $user;
        } catch (Throwable $error) {
            textures_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
        }
    }

    $user = current_user();
    return $user;
}

function textures_require_login_json(): array
{
    $user = textures_authenticated_user_json();
    if (!$user) {
        textures_json_response(['ok' => false, 'error' => 'Authentication required.'], 401);
    }

    return $user;
}

function textures_current_owner_uid(array $user): string
{
    return trim((string) ($user['uid'] ?? $user['firebase_uid'] ?? $user['id'] ?? ''));
}

function textures_request_slot(array $body = []): string
{
    $slot = (string) ($body['slot'] ?? $_POST['slot'] ?? $_GET['slot'] ?? '');
    return firebase_normalize_texture_slot($slot);
}

function textures_request_alpha(array $body = []): float
{
    $raw = $body['alpha'] ?? $_POST['alpha'] ?? 1;
    if ($raw === '' || $raw === null) {
        $raw = 1;
    }

    return max(0.0, min(1.0, (float) $raw));
}

function textures_request_display_name(string $slot, array $body = []): string
{
    $displayName = trim((string) ($body['display_name'] ?? $_POST['display_name'] ?? ''));
    return $displayName !== '' ? mb_substr($displayName, 0, 120) : $slot;
}

function textures_texture_payload(?array $record): ?array
{
    if (!$record) {
        return null;
    }

    return [
        'slot' => (string) ($record['slot'] ?? ''),
        'display_name' => (string) ($record['display_name'] ?? ''),
        'active' => !empty($record['active']),
        'alpha' => (float) ($record['alpha'] ?? 1.0),
        'width' => (int) ($record['width'] ?? 512),
        'height' => (int) ($record['height'] ?? 512),
        'source' => (string) ($record['source'] ?? ''),
        'prompt' => (string) ($record['prompt'] ?? ''),
        'updated_at' => $record['updated_at'] ?? null,
        'image_url' => !empty($record['active']) ? app_url('api/textures.php?action=image&slot=' . rawurlencode((string) ($record['slot'] ?? ''))) : null,
    ];
}

function textures_openai_api_key(): string
{
    return trim((string) (getenv('OPENAI_API_KEY') ?: ($_ENV['OPENAI_API_KEY'] ?? '')));
}

function textures_image_model_quality(): string
{
    return 'medium';
}

function textures_image_model_size(): string
{
    return '1024x1024';
}

function textures_image_model(array $user): string
{
    return firebase_user_ai_image_model($user);
}

function textures_generate_prompt(string $prompt): string
{
    $prompt = trim($prompt);
    if ($prompt === '') {
        throw new RuntimeException('Describe the texture you want to generate.');
    }

    return trim(implode("\n", [
        'Create a seamless, tileable square material texture for a 3D grammar renderer.',
        'Output only the texture itself.',
        'No lighting rig, no shadow cast, no perspective, no frame, no object silhouette, no text, no icons, no labels.',
        'Flat top-down texture only.',
        'Edges must tile cleanly on all sides.',
        'Use transparency only when it helps the material read correctly.',
        'Requested material: ' . $prompt,
    ]));
}

function textures_openai_generate_image(string $model, string $prompt): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP cURL is required for AI texture generation.');
    }

    $apiKey = textures_openai_api_key();
    if ($apiKey === '') {
        throw new RuntimeException('OPENAI_API_KEY is not configured on the server.');
    }

    $payload = [
        'model' => $model,
        'prompt' => textures_generate_prompt($prompt),
        'size' => textures_image_model_size(),
        'quality' => textures_image_model_quality(),
        'background' => 'transparent',
        'output_format' => 'png',
        'response_format' => 'b64_json',
    ];

    $ch = curl_init('https://api.openai.com/v1/images/generations');
    if (!$ch) {
        throw new RuntimeException('Could not initialize the AI texture request.');
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 300,
    ]);

    $response = curl_exec($ch);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($errno) {
        throw new RuntimeException('AI texture request failed: ' . $error);
    }

    $data = json_decode((string) $response, true);
    if (!is_array($data)) {
        throw new RuntimeException('AI texture provider returned a non-JSON response.');
    }
    if ($status >= 400) {
        throw new RuntimeException((string) ($data['error']['message'] ?? 'AI texture provider returned an error.'));
    }

    $imageB64 = '';
    if (isset($data['data'][0]['b64_json']) && is_string($data['data'][0]['b64_json'])) {
        $imageB64 = $data['data'][0]['b64_json'];
    }
    if ($imageB64 === '') {
        throw new RuntimeException('AI texture provider returned an empty image.');
    }

    $bytes = base64_decode($imageB64, true);
    if (!is_string($bytes) || $bytes === '') {
        throw new RuntimeException('AI texture provider returned invalid image data.');
    }

    return [
        'bytes' => $bytes,
        'model' => $model,
        'prompt' => $payload['prompt'],
        'quality' => (string) $payload['quality'],
        'size' => (string) $payload['size'],
    ];
}

$action = (string) ($_GET['action'] ?? 'list');

if ($action === 'image') {
    $user = textures_require_login_json();
    $ownerUid = textures_current_owner_uid($user);
    $slot = textures_request_slot();
    $record = firebase_fetch_user_texture_record($ownerUid, $slot);
    if (!$record || empty($record['active'])) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Texture not found.';
        exit;
    }

    $bytes = firebase_load_user_texture_bytes($ownerUid, $slot);
    if ($bytes === '') {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Texture not found.';
        exit;
    }

    header('Content-Type: image/png');
    header('Content-Length: ' . strlen($bytes));
    header('Cache-Control: private, max-age=0, no-store');
    echo $bytes;
    exit;
}

$user = textures_require_login_json();
$ownerUid = textures_current_owner_uid($user);
if ($ownerUid === '') {
    textures_json_response(['ok' => false, 'error' => 'Authenticated user is missing a Firebase uid.'], 500);
}

if ($action === 'list') {
    textures_json_response([
        'ok' => true,
        'textures' => firebase_user_texture_manifest($ownerUid),
        'limits' => [
            'slots' => 20,
            'width' => 512,
            'height' => 512,
            'mime_type' => 'image/png',
        ],
    ]);
}

if (firebase_extract_bearer_token() === '') {
    verify_csrf();
}

$body = textures_json_body();

if ($action === 'delete') {
    $slot = textures_request_slot($body);
    $record = firebase_fetch_user_texture_record($ownerUid, $slot);
    if ($record) {
        firebase_delete_user_texture($ownerUid, $slot);
        firebase_delete_user_texture_record($ownerUid, $slot);
    }

    textures_json_response([
        'ok' => true,
        'slot' => $slot,
        'textures' => firebase_user_texture_manifest($ownerUid),
    ]);
}

if ($action === 'update') {
    $slot = textures_request_slot($body);
    $record = firebase_fetch_user_texture_record($ownerUid, $slot);
    if (!$record) {
        textures_json_response(['ok' => false, 'error' => 'Texture slot is empty.'], 404);
    }

    try {
        $updated = firebase_write_user_texture_record([
            'id' => (string) ($record['id'] ?? firebase_user_texture_document_id($ownerUid, $slot)),
            'owner_uid' => $ownerUid,
            'slot' => $slot,
            'display_name' => textures_request_display_name($slot, $body),
            'storage_path' => (string) ($record['storage_path'] ?? firebase_user_texture_storage_path($ownerUid, $slot)),
            'mime_type' => (string) ($record['mime_type'] ?? 'image/png'),
            'width' => (int) ($record['width'] ?? 512),
            'height' => (int) ($record['height'] ?? 512),
            'alpha' => textures_request_alpha($body),
            'source' => (string) ($record['source'] ?? 'upload'),
            'prompt' => (string) ($record['prompt'] ?? ''),
            'active' => !empty($record['active']),
            'created_at' => (string) ($record['created_at'] ?? gmdate('c')),
            'updated_at' => gmdate('c'),
        ]);
    } catch (Throwable $error) {
        textures_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
    }

    textures_json_response([
        'ok' => true,
        'texture' => textures_texture_payload($updated),
        'textures' => firebase_user_texture_manifest($ownerUid),
    ]);
}

if ($action === 'upload') {
    if (!firebase_storage_bucket()) {
        textures_json_response(['ok' => false, 'error' => 'Firebase Storage is not ready.'], 503);
    }
    if (!firebase_texture_normalizer_ready()) {
        textures_json_response(['ok' => false, 'error' => 'Texture normalization backend is not ready.'], 503);
    }
    if (empty($_FILES['texture']) || !is_array($_FILES['texture'])) {
        textures_json_response(['ok' => false, 'error' => 'Texture upload is required.'], 422);
    }

    $slot = textures_request_slot($body);
    $displayName = textures_request_display_name($slot, $body);
    $alpha = textures_request_alpha($body);
    $upload = $_FILES['texture'];
    $errorCode = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($errorCode !== UPLOAD_ERR_OK) {
        textures_json_response(['ok' => false, 'error' => 'Texture upload failed.'], 422);
    }

    $tmpName = (string) ($upload['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        textures_json_response(['ok' => false, 'error' => 'Uploaded texture file is not available.'], 422);
    }

    $size = (int) ($upload['size'] ?? 0);
    if ($size <= 0 || $size > 10 * 1024 * 1024) {
        textures_json_response(['ok' => false, 'error' => 'Texture uploads must be between 1 byte and 10 MB.'], 422);
    }

    try {
        $normalized = firebase_texture_normalize_upload($tmpName);
        $storagePath = firebase_store_user_texture($ownerUid, $slot, (string) ($normalized['bytes'] ?? ''));
        $now = gmdate('c');
        $existing = firebase_fetch_user_texture_record($ownerUid, $slot);
        $record = firebase_write_user_texture_record([
            'id' => firebase_user_texture_document_id($ownerUid, $slot),
            'owner_uid' => $ownerUid,
            'slot' => $slot,
            'display_name' => $displayName,
            'storage_path' => $storagePath,
            'mime_type' => 'image/png',
            'width' => (int) ($normalized['width'] ?? 512),
            'height' => (int) ($normalized['height'] ?? 512),
            'alpha' => $alpha,
            'source' => 'upload',
            'prompt' => '',
            'active' => true,
            'created_at' => (string) ($existing['created_at'] ?? $now),
            'updated_at' => $now,
        ]);
    } catch (Throwable $error) {
        textures_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
    }

    textures_json_response([
        'ok' => true,
        'texture' => textures_texture_payload($record),
        'textures' => firebase_user_texture_manifest($ownerUid),
    ]);
}

if ($action === 'generate') {
    if (!firebase_storage_bucket()) {
        textures_json_response(['ok' => false, 'error' => 'Firebase Storage is not ready.'], 503);
    }
    if (!firebase_texture_normalizer_ready()) {
        textures_json_response(['ok' => false, 'error' => 'Texture normalization backend is not ready.'], 503);
    }

    $slot = textures_request_slot($body);
    $displayName = textures_request_display_name($slot, $body);
    $alpha = textures_request_alpha($body);
    $prompt = trim((string) ($body['prompt'] ?? ''));
    $imageModel = textures_image_model($user);
    $quality = textures_image_model_quality();
    $size = textures_image_model_size();
    if ($prompt === '') {
        textures_json_response(['ok' => false, 'error' => 'Describe the texture you want to generate.'], 422);
    }

    $usageId = firebase_generate_ai_usage_id();
    $estimatedCredits = firebase_ai_image_generation_credits($imageModel, $quality, $size);
    $reservation = null;
    $generated = null;
    $record = null;
    try {
        $reservation = firebase_ai_reserve_credits($user, [
            'usage_id' => $usageId,
            'mode' => 'texture_generation',
            'model' => $imageModel,
            'request_preview' => $prompt,
            'estimated_credits' => $estimatedCredits,
            'metadata' => [
                'slot' => $slot,
                'display_name' => $displayName,
                'quality' => $quality,
                'size' => $size,
                'generation_kind' => 'image_texture',
            ],
        ]);
        $user = $reservation['user'] ?? $user;

        $generated = textures_openai_generate_image($imageModel, $prompt);
        $normalized = firebase_texture_normalize_bytes((string) ($generated['bytes'] ?? ''), '.png');
        $storagePath = firebase_store_user_texture($ownerUid, $slot, (string) ($normalized['bytes'] ?? ''));
        $now = gmdate('c');
        $existing = firebase_fetch_user_texture_record($ownerUid, $slot);
        $record = firebase_write_user_texture_record([
            'id' => firebase_user_texture_document_id($ownerUid, $slot),
            'owner_uid' => $ownerUid,
            'slot' => $slot,
            'display_name' => $displayName,
            'storage_path' => $storagePath,
            'mime_type' => 'image/png',
            'width' => (int) ($normalized['width'] ?? 512),
            'height' => (int) ($normalized['height'] ?? 512),
            'alpha' => $alpha,
            'source' => 'ai',
            'prompt' => $prompt,
            'active' => true,
            'created_at' => (string) ($existing['created_at'] ?? $now),
            'updated_at' => $now,
        ]);

        $finalized = firebase_ai_finalize_fixed_credits($usageId, firebase_ai_image_generation_credits($imageModel, $quality, $size), [
            'billing_type' => 'image_generation',
            'slot' => $slot,
            'display_name' => $displayName,
            'quality' => $quality,
            'size' => $size,
            'prompt' => $prompt,
        ], $user);
        $user = $finalized['user'] ?? $user;
    } catch (Throwable $error) {
        if ($record) {
            try {
                firebase_delete_user_texture($ownerUid, $slot);
                firebase_delete_user_texture_record($ownerUid, $slot);
            } catch (Throwable $cleanupError) {
                error_log('texture ai cleanup failed: ' . $cleanupError->getMessage());
            }
        }
        if ($reservation) {
            try {
                $released = firebase_ai_release_reserved_credits($usageId, $error->getMessage(), $user);
                $user = $released['user'] ?? $user;
            } catch (Throwable $releaseError) {
                error_log('texture ai credit release failed: ' . $releaseError->getMessage());
            }
        }
        textures_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
    }

    textures_json_response([
        'ok' => true,
        'texture' => textures_texture_payload($record),
        'textures' => firebase_user_texture_manifest($ownerUid),
        'generation' => [
            'model' => (string) ($generated['model'] ?? $imageModel),
            'prompt' => $prompt,
            'quality' => $quality,
            'size' => $size,
            'estimated_credits' => $estimatedCredits,
            'final_credits' => firebase_ai_image_generation_credits($imageModel, $quality, $size),
        ],
        'credits' => firebase_credit_summary($user),
    ]);
}

textures_json_response(['ok' => false, 'error' => 'Unknown action.'], 400);
