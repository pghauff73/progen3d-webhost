<?php

if (getenv('GRPC_VERBOSITY') === false || getenv('GRPC_VERBOSITY') === '') {
    putenv('GRPC_VERBOSITY=ERROR');
}
if (getenv('GRPC_TRACE') === false) {
    putenv('GRPC_TRACE=');
}

function firebase_bootstrap_admin_email(): string
{
    return 'admin@progen3d.com';
}

function firebase_client_config(): array
{
    return [
        'apiKey' => 'AIzaSyB3t5vavlj54LJQhPV4Z0L-mq-eBTYFX3E',
        'authDomain' => 'progen3d-f0dfa.firebaseapp.com',
        'projectId' => 'progen3d-f0dfa',
        'storageBucket' => 'progen3d-f0dfa.firebasestorage.app',
        'messagingSenderId' => '1094336092525',
        'appId' => '1:1094336092525:web:5dd70adcddd925f546a264',
        'measurementId' => 'G-G61HG9K7YY',
    ];
}

function firebase_is_enabled(): bool
{
    return true;
}

function firebase_vendor_autoload_path(): string
{
    return dirname(__DIR__) . '/vendor/autoload.php';
}

function firebase_default_adc_path(): string
{
    $home = trim((string) getenv('HOME'));
    if ($home === '') {
        $home = '/root';
    }

    return rtrim($home, '/') . '/.config/gcloud/application_default_credentials.json';
}

function firebase_legacy_service_account_path(): string
{
    return '/var/progen3d-firebase-service-account.json';
}

function firebase_service_account_path(): string
{
    $path = trim((string) getenv('FIREBASE_SERVICE_ACCOUNT_PATH'));
    if ($path !== '' && is_file($path)) {
        return $path;
    }

    $googleCredentials = trim((string) getenv('GOOGLE_APPLICATION_CREDENTIALS'));
    if ($googleCredentials !== '' && is_file($googleCredentials)) {
        return $googleCredentials;
    }

    $defaultAdc = firebase_default_adc_path();
    if (is_file($defaultAdc)) {
        return $defaultAdc;
    }

    $legacy = firebase_legacy_service_account_path();
    if (is_file($legacy)) {
        return $legacy;
    }

    return $path !== '' ? $path : $defaultAdc;
}

function firebase_admin_runtime_status(): array
{
    $autoload = firebase_vendor_autoload_path();
    $serviceAccount = firebase_service_account_path();
    $googleApplicationCredentials = trim((string) getenv('GOOGLE_APPLICATION_CREDENTIALS'));
    $fireBaseServiceAccount = trim((string) getenv('FIREBASE_SERVICE_ACCOUNT_PATH'));
    $defaultAdcPath = firebase_default_adc_path();
    $legacyServiceAccountPath = firebase_legacy_service_account_path();

    return [
        'enabled' => firebase_is_enabled(),
        'vendorAutoloadExists' => is_file($autoload),
        'firebaseServiceAccountEnv' => $fireBaseServiceAccount,
        'googleApplicationCredentialsEnv' => $googleApplicationCredentials,
        'serviceAccountPath' => $serviceAccount,
        'serviceAccountExists' => is_file($serviceAccount),
        'defaultApplicationCredentialsPath' => $defaultAdcPath,
        'defaultApplicationCredentialsExist' => is_file($defaultAdcPath),
        'legacyServiceAccountPath' => $legacyServiceAccountPath,
        'legacyServiceAccountExists' => is_file($legacyServiceAccountPath),
        'bootstrapAdminEmail' => firebase_bootstrap_admin_email(),
    ];
}

function firebase_client_config_json(): string
{
    return json_encode(firebase_client_config(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function firebase_admin_factory(): ?object
{
    static $factory = false;
    if ($factory !== false) {
        return $factory;
    }

    $autoload = firebase_vendor_autoload_path();
    if (!is_file($autoload)) {
        $factory = null;
        return $factory;
    }

    require_once $autoload;
    if (!class_exists(\Kreait\Firebase\Factory::class)) {
        $factory = null;
        return $factory;
    }

    try {
        $config = firebase_client_config();
        $factory = (new \Kreait\Firebase\Factory())
            ->withProjectId((string) $config['projectId'])
            ->withDefaultStorageBucket((string) $config['storageBucket']);

        $serviceAccount = firebase_service_account_path();
        if (is_file($serviceAccount)) {
            $factory = $factory->withServiceAccount($serviceAccount);
        }
    } catch (\Throwable $error) {
        error_log('firebase factory init failed: ' . $error->getMessage());
        $factory = null;
    }

    return $factory;
}

function firebase_auth_service()
{
    static $auth = false;
    if ($auth !== false) {
        return $auth;
    }

    $factory = firebase_admin_factory();
    if (!$factory) {
        $auth = null;
        return $auth;
    }

    try {
        $auth = $factory->createAuth();
    } catch (\Throwable $error) {
        error_log('firebase auth init failed: ' . $error->getMessage());
        $auth = null;
    }

    return $auth;
}

function firebase_admin_ready(): bool
{
    return firebase_auth_service() !== null;
}

function firebase_token_claim($claims, string $name, $default = null)
{
    if (is_object($claims) && method_exists($claims, 'get')) {
        try {
            return $claims->get($name, $default);
        } catch (\Throwable $error) {
            return $default;
        }
    }

    if (is_array($claims)) {
        return $claims[$name] ?? $default;
    }

    return $default;
}

function firebase_extract_bearer_token(): string
{
    $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            $header = (string) ($headers['Authorization'] ?? $headers['authorization'] ?? '');
        }
    }

    if (preg_match('/Bearer\s+(.+)/i', $header, $matches)) {
        return trim((string) $matches[1]);
    }

    return '';
}

function firebase_custom_claims_for_user($user): array
{
    if (is_object($user)) {
        if (method_exists($user, 'customClaims')) {
            try {
                $claims = $user->customClaims();
                return is_array($claims) ? $claims : [];
            } catch (\Throwable $error) {
            }
        }
        if (property_exists($user, 'customClaims') && is_array($user->customClaims)) {
            return $user->customClaims;
        }
    }

    return [];
}

function firebase_promote_bootstrap_admin_if_needed(array $identity): array
{
    $email = strtolower(trim((string) ($identity['email'] ?? '')));
    $emailVerified = !empty($identity['emailVerified']);
    $currentClaims = is_array($identity['customClaims'] ?? null) ? $identity['customClaims'] : [];
    $isAdmin = !empty($currentClaims['admin']);

    if ($isAdmin || !$emailVerified || $email !== firebase_bootstrap_admin_email()) {
        $identity['isAdmin'] = $isAdmin;
        return $identity;
    }

    $auth = firebase_auth_service();
    $uid = (string) ($identity['uid'] ?? '');
    if (!$auth || $uid === '') {
        $identity['isAdmin'] = false;
        return $identity;
    }

    try {
        $user = $auth->getUser($uid);
        $claims = firebase_custom_claims_for_user($user);
        $claims['admin'] = true;
        $auth->setCustomUserClaims($uid, $claims);
        $identity['customClaims'] = $claims;
        $identity['isAdmin'] = true;
        $identity['bootstrapAdminGranted'] = true;
    } catch (\Throwable $error) {
        error_log('firebase admin bootstrap failed: ' . $error->getMessage());
        $identity['isAdmin'] = false;
    }

    return $identity;
}

function firebase_verify_id_token(string $idToken): array
{
    if ($idToken === '') {
        return ['ok' => false, 'status' => 422, 'error' => 'Missing Firebase ID token.'];
    }

    $auth = firebase_auth_service();
    if (!$auth) {
        return [
            'ok' => false,
            'status' => 503,
            'error' => 'Firebase Admin is not ready. Install Composer dependencies and set FIREBASE_SERVICE_ACCOUNT_PATH.',
            'runtime' => firebase_admin_runtime_status(),
        ];
    }

    try {
        $verifiedToken = $auth->verifyIdToken($idToken);
        $claims = method_exists($verifiedToken, 'claims') ? $verifiedToken->claims() : null;
        $uid = (string) firebase_token_claim($claims, 'sub', '');
        $email = strtolower(trim((string) firebase_token_claim($claims, 'email', '')));
        $name = trim((string) firebase_token_claim($claims, 'name', ''));
        $emailVerified = (bool) firebase_token_claim($claims, 'email_verified', false);
        $customClaims = [];

        try {
            $user = $auth->getUser($uid);
            $customClaims = firebase_custom_claims_for_user($user);
        } catch (\Throwable $error) {
            error_log('firebase getUser failed: ' . $error->getMessage());
        }

        $identity = [
            'uid' => $uid,
            'email' => $email,
            'name' => $name,
            'emailVerified' => $emailVerified,
            'customClaims' => $customClaims,
            'isAdmin' => !empty($customClaims['admin']),
        ];
        $identity = firebase_promote_bootstrap_admin_if_needed($identity);

        return ['ok' => true, 'identity' => $identity];
    } catch (\Throwable $error) {
        return ['ok' => false, 'status' => 401, 'error' => 'Firebase token verification failed: ' . $error->getMessage()];
    }
}

function firebase_username_slug(string $value): string
{
    $value = preg_replace('/[^A-Za-z0-9_-]+/', '-', trim($value));
    $value = trim((string) $value, '-_');
    return substr((string) $value, 0, 32);
}

function firebase_username_candidate(string $displayName, string $email): string
{
    $candidate = firebase_username_slug($displayName);
    if ($candidate !== '' && strlen($candidate) >= 3) {
        return $candidate;
    }

    $localPart = strtolower(trim((string) strstr($email, '@', true)));
    $candidate = firebase_username_slug($localPart !== '' ? $localPart : 'user');
    if (strlen($candidate) < 3) {
        $candidate = str_pad($candidate, 3, 'x');
    }

    return $candidate;
}

function firebase_unique_username(string $displayName, string $email, ?array $existingUser = null): string
{
    $base = firebase_username_candidate($displayName, $email);
    if ($existingUser && (string) ($existingUser['username'] ?? '') !== '') {
        return (string) $existingUser['username'];
    }

    $candidate = $base;
    $suffix = 1;
    while (true) {
        $conflict = find_user_by_username($candidate);
        if (!$conflict || ($existingUser && (int) ($conflict['id'] ?? 0) === (int) ($existingUser['id'] ?? 0))) {
            return $candidate;
        }
        $suffixText = (string) $suffix;
        $trimmed = substr($base, 0, max(1, 32 - strlen($suffixText) - 1));
        $candidate = $trimmed . '-' . $suffixText;
        $suffix++;
    }
}

function sync_firebase_identity_to_local(array $identity, string $displayName = ''): array
{
    $email = strtolower(trim((string) ($identity['email'] ?? '')));
    if ($email === '') {
        throw new RuntimeException('Firebase account email is required for this site.');
    }

    $displayName = trim($displayName);
    if ($displayName === '') {
        $displayName = trim((string) ($identity['name'] ?? ''));
    }

    $emailVerified = !empty($identity['emailVerified']);
    $isAdmin = !empty($identity['isAdmin']);
    $role = $isAdmin ? 'admin' : 'user';
    $uid = trim((string) ($identity['uid'] ?? ''));
    if ($uid === '') {
        throw new RuntimeException('Firebase account UID is required for this site.');
    }

    $legacyUser = legacy_find_user_by_email($email);
    $existing = find_user_by_firebase_uid($uid);
    if (!$existing) {
        $existing = find_user_by_email($email);
    }

    if ($existing) {
        $updated = update_user_record((string) ($existing['uid'] ?? $uid), function (array $user) use ($email, $emailVerified, $displayName, $identity, $role, $legacyUser) {
            $user['email'] = $email;
            $user['email_verified'] = $emailVerified;
            $user['email_verified_at'] = $emailVerified ? ($user['email_verified_at'] ?? gmdate('c')) : null;
            $user['firebase_uid'] = (string) ($identity['uid'] ?? '');
            $user['uid'] = (string) ($identity['uid'] ?? '');
            $user['id'] = (string) ($identity['uid'] ?? '');
            $user['firebase_provider'] = 'firebase';
            $user['firebase_last_login_at'] = gmdate('c');
            $user['firebase_claims'] = is_array($identity['customClaims'] ?? null) ? $identity['customClaims'] : [];
            $user['role'] = $role;
            if ((int) ($user['legacy_user_id'] ?? 0) < 1 && $legacyUser) {
                $user['legacy_user_id'] = (int) ($legacyUser['id'] ?? 0);
            }
            if (trim((string) ($user['username'] ?? '')) === '') {
                $user['username'] = firebase_unique_username($displayName, $email, $user);
            }
            return $user;
        });

        if (!$updated) {
            throw new RuntimeException('Could not update the Firebase user profile.');
        }

        return $updated;
    }

    $username = $legacyUser && trim((string) ($legacyUser['username'] ?? '')) !== ''
        ? firebase_unique_username((string) $legacyUser['username'], $email)
        : firebase_unique_username($displayName, $email);
    $user = create_user_record(
        $uid,
        $username,
        $role,
        true,
        $email,
        $legacyUser ? (int) ($legacyUser['id'] ?? 0) : null
    );
    $updated = update_user_record((string) ($user['uid'] ?? $uid), function (array $user) use ($identity, $emailVerified) {
        $user['email_verified'] = $emailVerified;
        $user['email_verified_at'] = $emailVerified ? gmdate('c') : null;
        $user['firebase_uid'] = (string) ($identity['uid'] ?? '');
        $user['uid'] = (string) ($identity['uid'] ?? '');
        $user['id'] = (string) ($identity['uid'] ?? '');
        $user['firebase_provider'] = 'firebase';
        $user['firebase_last_login_at'] = gmdate('c');
        $user['firebase_claims'] = is_array($identity['customClaims'] ?? null) ? $identity['customClaims'] : [];
        return $user;
    });

    if (!$updated) {
        throw new RuntimeException('Could not finalize the Firebase user profile.');
    }

    return $updated;
}

function firebase_firestore_database()
{
    static $database = false;
    if ($database !== false) {
        return $database;
    }

    $factory = firebase_admin_factory();
    if (!$factory) {
        $database = null;
        return $database;
    }

    try {
        $firestore = $factory->createFirestore();
        $database = is_object($firestore) && method_exists($firestore, 'database') ? $firestore->database() : $firestore;
    } catch (\Throwable $error) {
        error_log('firebase firestore init failed: ' . $error->getMessage());
        $database = null;
    }

    return $database;
}

function firebase_firestore_stack_overflow_message(string $message): bool
{
    return str_contains($message, 'Maximum call stack size') || str_contains($message, 'Infinite recursion');
}

function firebase_firestore_transport(): string
{
    $transport = strtolower(trim((string) getenv('FIREBASE_FIRESTORE_TRANSPORT')));
    if (in_array($transport, ['grpc', 'rest'], true)) {
        return $transport;
    }

    return 'auto';
}

function firebase_firestore_prefer_rest(): bool
{
    return firebase_firestore_transport() === 'rest';
}

function firebase_firestore_rest_scopes(): array
{
    return [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/datastore',
    ];
}

function firebase_firestore_rest_database_path(): string
{
    $projectId = (string) (firebase_client_config()['projectId'] ?? '');
    return 'projects/' . $projectId . '/databases/(default)';
}

function firebase_firestore_rest_documents_base_url(): string
{
    return 'https://firestore.googleapis.com/v1/' . firebase_firestore_rest_database_path() . '/documents';
}

function firebase_firestore_rest_service_account_credentials()
{
    static $credentials = false;
    if ($credentials !== false) {
        return $credentials;
    }

    $autoload = firebase_vendor_autoload_path();
    if (!is_file($autoload)) {
        $credentials = null;
        return $credentials;
    }

    require_once $autoload;
    if (!class_exists(\Google\Auth\Credentials\ServiceAccountCredentials::class)) {
        $credentials = null;
        return $credentials;
    }

    $serviceAccountPath = firebase_service_account_path();
    if (!is_file($serviceAccountPath)) {
        $credentials = null;
        return $credentials;
    }

    $json = json_decode((string) file_get_contents($serviceAccountPath), true);
    if (!is_array($json)) {
        $credentials = null;
        return $credentials;
    }

    $credentials = new \Google\Auth\Credentials\ServiceAccountCredentials(firebase_firestore_rest_scopes(), $json);
    return $credentials;
}

function firebase_firestore_rest_access_token(): string
{
    static $cache = null;
    $now = time();
    if (is_array($cache) && !empty($cache['token']) && ($cache['expires_at'] ?? 0) > ($now + 30)) {
        return (string) $cache['token'];
    }

    $credentials = firebase_firestore_rest_service_account_credentials();
    if (!$credentials || !method_exists($credentials, 'fetchAuthToken')) {
        throw new RuntimeException('Firestore REST credentials are not available.');
    }

    $tokenData = $credentials->fetchAuthToken();
    $token = (string) ($tokenData['access_token'] ?? '');
    if ($token === '') {
        throw new RuntimeException('Could not fetch a Firestore REST access token.');
    }

    $cache = [
        'token' => $token,
        'expires_at' => $now + (int) ($tokenData['expires_in'] ?? 3000),
    ];

    return $token;
}

function firebase_firestore_rest_request(string $method, string $path, ?array $body = null, array $query = []): array
{
    $url = rtrim(firebase_firestore_rest_documents_base_url(), '/') . '/' . ltrim($path, '/');
    if ($query !== []) {
        $url .= '?' . http_build_query($query);
    }

    $headers = [
        'Authorization: Bearer ' . firebase_firestore_rest_access_token(),
        'Content-Type: application/json',
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 60,
    ]);

    if ($body !== null) {
        $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json === false ? '{}' : $json);
    }

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('Firestore REST transport failed: ' . $error);
    }

    $decoded = json_decode($raw, true);
    if ($status >= 400) {
        $message = (string) ($decoded['error']['message'] ?? ('HTTP ' . $status));
        throw new RuntimeException('Firestore REST request failed: ' . $message);
    }

    return is_array($decoded) ? $decoded : [];
}

function firebase_firestore_rest_encode_value($value): array
{
    if ($value === null) {
        return ['nullValue' => null];
    }
    if (is_bool($value)) {
        return ['booleanValue' => $value];
    }
    if (is_int($value)) {
        return ['integerValue' => (string) $value];
    }
    if (is_float($value)) {
        return ['doubleValue' => $value];
    }
    if (is_string($value)) {
        return ['stringValue' => $value];
    }
    if (is_array($value)) {
        if ($value === []) {
            return ['mapValue' => ['fields' => (object) []]];
        }
        $isList = array_keys($value) === range(0, count($value) - 1);
        if ($isList) {
            return [
                'arrayValue' => [
                    'values' => array_values(array_map('firebase_firestore_rest_encode_value', $value)),
                ],
            ];
        }

        $fields = [];
        foreach ($value as $key => $item) {
            $fields[(string) $key] = firebase_firestore_rest_encode_value($item);
        }
        return ['mapValue' => ['fields' => $fields]];
    }

    return ['stringValue' => (string) $value];
}

function firebase_firestore_rest_decode_value(array $value)
{
    if (array_key_exists('nullValue', $value)) {
        return null;
    }
    if (array_key_exists('booleanValue', $value)) {
        return (bool) $value['booleanValue'];
    }
    if (array_key_exists('integerValue', $value)) {
        return (int) $value['integerValue'];
    }
    if (array_key_exists('doubleValue', $value)) {
        return (float) $value['doubleValue'];
    }
    if (array_key_exists('stringValue', $value)) {
        return (string) $value['stringValue'];
    }
    if (array_key_exists('arrayValue', $value)) {
        $values = $value['arrayValue']['values'] ?? [];
        return is_array($values) ? array_values(array_map('firebase_firestore_rest_decode_value', $values)) : [];
    }
    if (array_key_exists('mapValue', $value)) {
        $fields = $value['mapValue']['fields'] ?? [];
        $decoded = [];
        if (is_array($fields)) {
            foreach ($fields as $key => $item) {
                if (is_array($item)) {
                    $decoded[(string) $key] = firebase_firestore_rest_decode_value($item);
                }
            }
        }
        return $decoded;
    }

    return null;
}

function firebase_firestore_rest_document_payload(array $data, string $documentName): array
{
    $fields = [];
    foreach ($data as $key => $value) {
        $fields[(string) $key] = firebase_firestore_rest_encode_value($value);
    }

    return [
        'name' => firebase_firestore_rest_database_path() . '/documents/' . $documentName,
        'fields' => $fields,
    ];
}

function firebase_firestore_rest_document_to_data(array $document): array
{
    $fields = $document['fields'] ?? [];
    $data = [];
    if (!is_array($fields)) {
        return $data;
    }

    foreach ($fields as $key => $value) {
        if (is_array($value)) {
            $data[(string) $key] = firebase_firestore_rest_decode_value($value);
        }
    }

    return $data;
}

function firebase_firestore_rest_snapshot(array $document)
{
    $data = firebase_firestore_rest_document_to_data($document);
    $id = basename((string) ($document['name'] ?? ''));

    return new class($data, $id) {
        public function __construct(private array $data, private string $id)
        {
        }

        public function exists(): bool
        {
            return true;
        }

        public function data(): array
        {
            return $this->data;
        }

        public function id(): string
        {
            return $this->id;
        }
    };
}

function firebase_firestore_rest_upsert_document(string $collection, string $documentId, array $data): array
{
    $documentName = trim($collection, '/') . '/' . trim($documentId, '/');
    return firebase_firestore_rest_request(
        'PATCH',
        $documentName,
        firebase_firestore_rest_document_payload($data, $documentName)
    );
}

function firebase_firestore_rest_get_document(string $collection, string $documentId): ?array
{
    $documentName = trim($collection, '/') . '/' . trim($documentId, '/');
    try {
        return firebase_firestore_rest_request('GET', $documentName);
    } catch (\Throwable $error) {
        if (str_contains($error->getMessage(), '404')) {
            return null;
        }
        throw $error;
    }
}

function firebase_firestore_rest_delete_document(string $collection, string $documentId): bool
{
    $documentName = trim($collection, '/') . '/' . trim($documentId, '/');
    firebase_firestore_rest_request('DELETE', $documentName);
    return true;
}

function firebase_firestore_rest_list_collection(string $collection): array
{
    $documents = [];
    $query = ['pageSize' => 1000];

    do {
        $response = firebase_firestore_rest_request('GET', trim($collection, '/'), null, $query);
        foreach (($response['documents'] ?? []) as $document) {
            if (is_array($document)) {
                $documents[] = $document;
            }
        }
        $query['pageToken'] = (string) ($response['nextPageToken'] ?? '');
    } while (($query['pageToken'] ?? '') !== '');

    return $documents;
}

function firebase_users_collection()
{
    if (firebase_firestore_prefer_rest()) {
        return null;
    }

    $database = firebase_firestore_database();
    if (!$database || !method_exists($database, 'collection')) {
        return null;
    }

    return $database->collection('users');
}

function firebase_user_document_id(string $uid): string
{
    return trim($uid);
}

function firebase_user_document(string $uid)
{
    $collection = firebase_users_collection();
    $uid = trim($uid);
    if (!$collection || !method_exists($collection, 'document') || $uid === '') {
        return null;
    }

    return $collection->document(firebase_user_document_id($uid));
}

function firebase_user_record_to_document(array $user): array
{
    $user = normalize_user_record($user);

    return [
        'uid' => (string) ($user['uid'] ?? $user['id'] ?? ''),
        'id' => (string) ($user['uid'] ?? $user['id'] ?? ''),
        'username' => (string) ($user['username'] ?? ''),
        'role' => normalize_user_role((string) ($user['role'] ?? 'user')),
        'email' => strtolower(trim((string) ($user['email'] ?? ''))),
        'email_verified' => !empty($user['email_verified']),
        'email_verified_at' => $user['email_verified_at'] ?? null,
        'created_at' => (string) ($user['created_at'] ?? ''),
        'updated_at' => (string) ($user['updated_at'] ?? ''),
        'firebase_uid' => (string) ($user['firebase_uid'] ?? ''),
        'firebase_provider' => (string) ($user['firebase_provider'] ?? ''),
        'firebase_last_login_at' => $user['firebase_last_login_at'] ?? null,
        'firebase_claims' => is_array($user['firebase_claims'] ?? null) ? $user['firebase_claims'] : [],
        'legacy_user_id' => isset($user['legacy_user_id']) ? (int) $user['legacy_user_id'] : null,
    ];
}

function firebase_user_document_to_record($snapshot): ?array
{
    if (!$snapshot) {
        return null;
    }
    if (method_exists($snapshot, 'exists') && !$snapshot->exists()) {
        return null;
    }

    $data = method_exists($snapshot, 'data') ? $snapshot->data() : null;
    if (!is_array($data)) {
        return null;
    }

    $uid = trim((string) ($data['uid'] ?? $data['id'] ?? (method_exists($snapshot, 'id') ? $snapshot->id() : '')));
    if ($uid === '') {
        return null;
    }

    return normalize_user_record([
        'uid' => $uid,
        'id' => $uid,
        'username' => (string) ($data['username'] ?? ''),
        'role' => (string) ($data['role'] ?? 'user'),
        'email' => (string) ($data['email'] ?? ''),
        'email_verified' => !empty($data['email_verified']),
        'email_verified_at' => $data['email_verified_at'] ?? null,
        'created_at' => (string) ($data['created_at'] ?? ''),
        'updated_at' => (string) ($data['updated_at'] ?? ''),
        'firebase_uid' => (string) ($data['firebase_uid'] ?? ''),
        'firebase_provider' => (string) ($data['firebase_provider'] ?? ''),
        'firebase_last_login_at' => $data['firebase_last_login_at'] ?? null,
        'firebase_claims' => is_array($data['firebase_claims'] ?? null) ? $data['firebase_claims'] : [],
        'legacy_user_id' => isset($data['legacy_user_id']) ? (int) $data['legacy_user_id'] : null,
    ]);
}

function firebase_write_user_record(array $user): array
{
    $user = normalize_user_record($user);
    $uid = trim((string) ($user['uid'] ?? $user['id'] ?? ''));
    if ($uid === '') {
        throw new RuntimeException('A Firestore user record requires a Firebase UID.');
    }

    if (firebase_firestore_prefer_rest()) {
        try {
            firebase_firestore_rest_upsert_document('users', $uid, firebase_user_record_to_document($user));
            return $user;
        } catch (\Throwable $error) {
            throw new RuntimeException('Could not save the Firebase user record: ' . $error->getMessage());
        }
    }

    $doc = firebase_user_document($uid);
    if (!$doc || !method_exists($doc, 'set')) {
        try {
            firebase_firestore_rest_upsert_document('users', $uid, firebase_user_record_to_document($user));
            return $user;
        } catch (\Throwable $error) {
            throw new RuntimeException('Could not save the Firebase user record: ' . $error->getMessage());
        }
    }

    try {
        $doc->set(firebase_user_record_to_document($user));
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            throw new RuntimeException('Could not save the Firebase user record: ' . $error->getMessage());
        }

        try {
            firebase_firestore_rest_upsert_document('users', $uid, firebase_user_record_to_document($user));
        } catch (\Throwable $restError) {
            throw new RuntimeException('Could not save the Firebase user record: ' . $restError->getMessage());
        }
    }

    return $user;
}

function firebase_fetch_user_by_id(string $uid): ?array
{
    if (trim($uid) === '') {
        return null;
    }

    if (firebase_firestore_prefer_rest()) {
        try {
            $document = firebase_firestore_rest_get_document('users', $uid);
            return $document ? firebase_user_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $error) {
            error_log('firebase user fetch failed: ' . $error->getMessage());
            return null;
        }
    }

    $doc = firebase_user_document($uid);
    if (!$doc || !method_exists($doc, 'snapshot')) {
        try {
            $document = firebase_firestore_rest_get_document('users', $uid);
            return $document ? firebase_user_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $error) {
            error_log('firebase user fetch failed: ' . $error->getMessage());
            return null;
        }
    }

    try {
        return firebase_user_document_to_record($doc->snapshot());
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            error_log('firebase user fetch failed: ' . $error->getMessage());
            return null;
        }

        try {
            $document = firebase_firestore_rest_get_document('users', $uid);
            return $document ? firebase_user_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $restError) {
            error_log('firebase user fetch failed: ' . $restError->getMessage());
            return null;
        }
    }
}

function firebase_query_users($query): array
{
    if (!$query || !method_exists($query, 'documents')) {
        return [];
    }

    $users = [];
    try {
        foreach ($query->documents() as $snapshot) {
            $record = firebase_user_document_to_record($snapshot);
            if ($record) {
                $users[] = $record;
            }
        }
    } catch (\Throwable $error) {
        error_log('firebase user query failed: ' . $error->getMessage());
        return [];
    }

    usort($users, function ($a, $b) {
        return strcmp((string) ($a['created_at'] ?? ''), (string) ($b['created_at'] ?? ''));
    });

    return array_values($users);
}

function firebase_all_users(): array
{
    if (firebase_firestore_prefer_rest()) {
        try {
            return array_values(array_filter(array_map(function (array $document): ?array {
                return firebase_user_document_to_record(firebase_firestore_rest_snapshot($document));
            }, firebase_firestore_rest_list_collection('users'))));
        } catch (\Throwable $error) {
            error_log('firebase user query failed: ' . $error->getMessage());
            return [];
        }
    }

    $collection = firebase_users_collection();
    if (!$collection) {
        try {
            return array_values(array_filter(array_map(function (array $document): ?array {
                return firebase_user_document_to_record(firebase_firestore_rest_snapshot($document));
            }, firebase_firestore_rest_list_collection('users'))));
        } catch (\Throwable $error) {
            error_log('firebase user query failed: ' . $error->getMessage());
            return [];
        }
    }

    $users = firebase_query_users($collection);
    if ($users !== []) {
        return $users;
    }

    try {
        return array_values(array_filter(array_map(function (array $document): ?array {
            return firebase_user_document_to_record(firebase_firestore_rest_snapshot($document));
        }, firebase_firestore_rest_list_collection('users'))));
    } catch (\Throwable $error) {
        error_log('firebase user query failed: ' . $error->getMessage());
        return [];
    }
}

function firebase_find_user_by_field(string $field, $value): ?array
{
    if (firebase_firestore_prefer_rest()) {
        foreach (firebase_all_users() as $user) {
            if (($user[$field] ?? null) === $value) {
                return $user;
            }
        }
        return null;
    }

    $collection = firebase_users_collection();
    if (!$collection) {
        foreach (firebase_all_users() as $user) {
            if (($user[$field] ?? null) === $value) {
                return $user;
            }
        }
        return null;
    }
    if ($value === '' || $value === null) {
        return null;
    }

    try {
        $query = $collection->where($field, '=', $value);
        $users = firebase_query_users($query);
        return $users[0] ?? null;
    } catch (\Throwable $error) {
        error_log('firebase user lookup failed: ' . $error->getMessage());
        return null;
    }
}

function firebase_delete_user_record(string $uid): bool
{
    if (firebase_firestore_prefer_rest()) {
        try {
            return firebase_firestore_rest_delete_document('users', $uid);
        } catch (\Throwable $error) {
            error_log('firebase user delete failed: ' . $error->getMessage());
            return false;
        }
    }

    $doc = firebase_user_document($uid);
    if (!$doc || !method_exists($doc, 'delete')) {
        try {
            return firebase_firestore_rest_delete_document('users', $uid);
        } catch (\Throwable $error) {
            error_log('firebase user delete failed: ' . $error->getMessage());
            return false;
        }
    }

    try {
        $doc->delete();
        return true;
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            error_log('firebase user delete failed: ' . $error->getMessage());
            return false;
        }

        try {
            return firebase_firestore_rest_delete_document('users', $uid);
        } catch (\Throwable $restError) {
            error_log('firebase user delete failed: ' . $restError->getMessage());
            return false;
        }
    }
}

function firebase_ai_thread_id_prefix(): string
{
    return 'ait_';
}

function firebase_ai_message_id_prefix(): string
{
    return 'aim_';
}

function firebase_generate_ai_thread_id(): string
{
    return firebase_ai_thread_id_prefix() . bin2hex(random_bytes(12));
}

function firebase_generate_ai_message_id(): string
{
    return firebase_ai_message_id_prefix() . bin2hex(random_bytes(12));
}

function firebase_ai_threads_collection()
{
    if (firebase_firestore_prefer_rest()) {
        return null;
    }

    $database = firebase_firestore_database();
    if (!$database || !method_exists($database, 'collection')) {
        return null;
    }

    return $database->collection('ai_threads');
}

function firebase_ai_messages_collection()
{
    if (firebase_firestore_prefer_rest()) {
        return null;
    }

    $database = firebase_firestore_database();
    if (!$database || !method_exists($database, 'collection')) {
        return null;
    }

    return $database->collection('ai_messages');
}

function firebase_ai_thread_document(string $threadId)
{
    $collection = firebase_ai_threads_collection();
    $threadId = trim($threadId);
    if (!$collection || !method_exists($collection, 'document') || $threadId === '') {
        return null;
    }

    return $collection->document($threadId);
}

function firebase_ai_message_document(string $messageId)
{
    $collection = firebase_ai_messages_collection();
    $messageId = trim($messageId);
    if (!$collection || !method_exists($collection, 'document') || $messageId === '') {
        return null;
    }

    return $collection->document($messageId);
}

function firebase_ai_thread_record_to_document(array $thread): array
{
    $id = trim((string) ($thread['id'] ?? ''));
    return [
        'id' => $id,
        'ownerUid' => trim((string) ($thread['owner_uid'] ?? '')),
        'ownerUsername' => trim((string) ($thread['owner_username'] ?? '')),
        'ownerRole' => normalize_user_role((string) ($thread['owner_role'] ?? 'user')),
        'title' => trim((string) ($thread['title'] ?? 'AI thread')),
        'mode' => trim((string) ($thread['mode'] ?? 'active_helper_chat')),
        'fileId' => trim((string) ($thread['file_id'] ?? '')),
        'fileTitle' => trim((string) ($thread['file_title'] ?? '')),
        'createdAt' => (string) ($thread['created_at'] ?? ''),
        'updatedAt' => (string) ($thread['updated_at'] ?? ''),
        'lastMessageAt' => $thread['last_message_at'] ?? null,
        'lastMessagePreview' => trim((string) ($thread['last_message_preview'] ?? '')),
        'messageCount' => (int) ($thread['message_count'] ?? 0),
    ];
}

function firebase_ai_thread_document_to_record($snapshot): ?array
{
    if (!$snapshot) {
        return null;
    }
    if (method_exists($snapshot, 'exists') && !$snapshot->exists()) {
        return null;
    }

    $data = method_exists($snapshot, 'data') ? $snapshot->data() : null;
    if (!is_array($data)) {
        return null;
    }

    $id = trim((string) ($data['id'] ?? (method_exists($snapshot, 'id') ? $snapshot->id() : '')));
    if ($id === '') {
        return null;
    }

    return [
        'id' => $id,
        'owner_uid' => trim((string) ($data['ownerUid'] ?? '')),
        'owner_username' => trim((string) ($data['ownerUsername'] ?? '')),
        'owner_role' => normalize_user_role((string) ($data['ownerRole'] ?? 'user')),
        'title' => trim((string) ($data['title'] ?? 'AI thread')),
        'mode' => trim((string) ($data['mode'] ?? 'active_helper_chat')),
        'file_id' => trim((string) ($data['fileId'] ?? '')),
        'file_title' => trim((string) ($data['fileTitle'] ?? '')),
        'created_at' => (string) ($data['createdAt'] ?? ''),
        'updated_at' => (string) ($data['updatedAt'] ?? ''),
        'last_message_at' => $data['lastMessageAt'] ?? null,
        'last_message_preview' => trim((string) ($data['lastMessagePreview'] ?? '')),
        'message_count' => (int) ($data['messageCount'] ?? 0),
    ];
}

function firebase_ai_message_record_to_document(array $message): array
{
    $id = trim((string) ($message['id'] ?? ''));
    return [
        'id' => $id,
        'threadId' => trim((string) ($message['thread_id'] ?? '')),
        'ownerUid' => trim((string) ($message['owner_uid'] ?? '')),
        'role' => trim((string) ($message['role'] ?? 'assistant')),
        'mode' => trim((string) ($message['mode'] ?? 'active_helper_chat')),
        'content' => trim((string) ($message['content'] ?? '')),
        'createdAt' => (string) ($message['created_at'] ?? ''),
        'payload' => is_array($message['payload'] ?? null) ? $message['payload'] : [],
    ];
}

function firebase_ai_message_document_to_record($snapshot): ?array
{
    if (!$snapshot) {
        return null;
    }
    if (method_exists($snapshot, 'exists') && !$snapshot->exists()) {
        return null;
    }

    $data = method_exists($snapshot, 'data') ? $snapshot->data() : null;
    if (!is_array($data)) {
        return null;
    }

    $id = trim((string) ($data['id'] ?? (method_exists($snapshot, 'id') ? $snapshot->id() : '')));
    if ($id === '') {
        return null;
    }

    return [
        'id' => $id,
        'thread_id' => trim((string) ($data['threadId'] ?? '')),
        'owner_uid' => trim((string) ($data['ownerUid'] ?? '')),
        'role' => trim((string) ($data['role'] ?? 'assistant')),
        'mode' => trim((string) ($data['mode'] ?? 'active_helper_chat')),
        'content' => trim((string) ($data['content'] ?? '')),
        'created_at' => (string) ($data['createdAt'] ?? ''),
        'payload' => is_array($data['payload'] ?? null) ? $data['payload'] : [],
    ];
}

function firebase_write_ai_thread_record(array $thread): array
{
    $threadId = trim((string) ($thread['id'] ?? ''));
    if ($threadId === '') {
        throw new RuntimeException('AI thread record requires an id.');
    }

    if (firebase_firestore_prefer_rest()) {
        try {
            firebase_firestore_rest_upsert_document('ai_threads', $threadId, firebase_ai_thread_record_to_document($thread));
            return firebase_ai_thread_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('ai_threads', $threadId)));
        } catch (\Throwable $error) {
            throw new RuntimeException('Could not save the AI thread record: ' . $error->getMessage());
        }
    }

    $doc = firebase_ai_thread_document($threadId);
    if (!$doc || !method_exists($doc, 'set')) {
        throw new RuntimeException('Firebase Firestore is not ready for AI threads.');
    }

    try {
        $doc->set(firebase_ai_thread_record_to_document($thread));
        return firebase_ai_thread_document_to_record($doc->snapshot()) ?? $thread;
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            throw new RuntimeException('Could not save the AI thread record: ' . $error->getMessage());
        }

        try {
            firebase_firestore_rest_upsert_document('ai_threads', $threadId, firebase_ai_thread_record_to_document($thread));
            return firebase_ai_thread_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('ai_threads', $threadId)));
        } catch (\Throwable $restError) {
            throw new RuntimeException('Could not save the AI thread record: ' . $restError->getMessage());
        }
    }
}

function firebase_fetch_ai_thread_record(string $threadId): ?array
{
    $threadId = trim($threadId);
    if ($threadId === '') {
        return null;
    }

    if (firebase_firestore_prefer_rest()) {
        try {
            $document = firebase_firestore_rest_get_document('ai_threads', $threadId);
            return $document ? firebase_ai_thread_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $error) {
            error_log('firebase ai thread fetch failed: ' . $error->getMessage());
            return null;
        }
    }

    $doc = firebase_ai_thread_document($threadId);
    if (!$doc || !method_exists($doc, 'snapshot')) {
        return null;
    }

    try {
        return firebase_ai_thread_document_to_record($doc->snapshot());
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            error_log('firebase ai thread fetch failed: ' . $error->getMessage());
            return null;
        }

        try {
            $document = firebase_firestore_rest_get_document('ai_threads', $threadId);
            return $document ? firebase_ai_thread_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $restError) {
            error_log('firebase ai thread fetch failed: ' . $restError->getMessage());
            return null;
        }
    }
}

function firebase_all_ai_threads(): array
{
    $threads = [];

    if (firebase_firestore_prefer_rest()) {
        try {
            foreach (firebase_firestore_rest_list_collection('ai_threads') as $document) {
                $record = firebase_ai_thread_document_to_record(firebase_firestore_rest_snapshot($document));
                if ($record) {
                    $threads[] = $record;
                }
            }
            usort($threads, fn($a, $b) => strcmp((string) ($b['updated_at'] ?? ''), (string) ($a['updated_at'] ?? '')));
            return array_values($threads);
        } catch (\Throwable $error) {
            error_log('firebase ai thread query failed: ' . $error->getMessage());
            return [];
        }
    }

    $collection = firebase_ai_threads_collection();
    if ($collection && method_exists($collection, 'documents')) {
        try {
            foreach ($collection->documents() as $snapshot) {
                $record = firebase_ai_thread_document_to_record($snapshot);
                if ($record) {
                    $threads[] = $record;
                }
            }
        } catch (\Throwable $error) {
            if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
                error_log('firebase ai thread query failed: ' . $error->getMessage());
                return [];
            }
        }
    }

    if ($threads === []) {
        try {
            foreach (firebase_firestore_rest_list_collection('ai_threads') as $document) {
                $record = firebase_ai_thread_document_to_record(firebase_firestore_rest_snapshot($document));
                if ($record) {
                    $threads[] = $record;
                }
            }
        } catch (\Throwable $error) {
            error_log('firebase ai thread query failed: ' . $error->getMessage());
            return [];
        }
    }

    usort($threads, fn($a, $b) => strcmp((string) ($b['updated_at'] ?? ''), (string) ($a['updated_at'] ?? '')));
    return array_values($threads);
}

function firebase_user_ai_threads(array $user): array
{
    $uid = trim((string) ($user['firebase_uid'] ?? $user['uid'] ?? $user['id'] ?? ''));
    if ($uid === '') {
        return [];
    }

    return array_values(array_filter(firebase_all_ai_threads(), function (array $thread) use ($uid): bool {
        return (string) ($thread['owner_uid'] ?? '') === $uid;
    }));
}

function firebase_write_ai_message_record(array $message): array
{
    $messageId = trim((string) ($message['id'] ?? ''));
    if ($messageId === '') {
        throw new RuntimeException('AI message record requires an id.');
    }

    if (firebase_firestore_prefer_rest()) {
        try {
            firebase_firestore_rest_upsert_document('ai_messages', $messageId, firebase_ai_message_record_to_document($message));
            return firebase_ai_message_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('ai_messages', $messageId)));
        } catch (\Throwable $error) {
            throw new RuntimeException('Could not save the AI message record: ' . $error->getMessage());
        }
    }

    $doc = firebase_ai_message_document($messageId);
    if (!$doc || !method_exists($doc, 'set')) {
        throw new RuntimeException('Firebase Firestore is not ready for AI messages.');
    }

    try {
        $doc->set(firebase_ai_message_record_to_document($message));
        return firebase_ai_message_document_to_record($doc->snapshot()) ?? $message;
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            throw new RuntimeException('Could not save the AI message record: ' . $error->getMessage());
        }

        try {
            firebase_firestore_rest_upsert_document('ai_messages', $messageId, firebase_ai_message_record_to_document($message));
            return firebase_ai_message_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('ai_messages', $messageId)));
        } catch (\Throwable $restError) {
            throw new RuntimeException('Could not save the AI message record: ' . $restError->getMessage());
        }
    }
}

function firebase_thread_ai_messages(string $threadId, ?array $user = null): array
{
    $threadId = trim($threadId);
    if ($threadId === '') {
        return [];
    }

    $messages = [];
    if (firebase_firestore_prefer_rest()) {
        try {
            foreach (firebase_firestore_rest_list_collection('ai_messages') as $document) {
                $record = firebase_ai_message_document_to_record(firebase_firestore_rest_snapshot($document));
                if ($record && (string) ($record['thread_id'] ?? '') === $threadId) {
                    $messages[] = $record;
                }
            }
        } catch (\Throwable $error) {
            error_log('firebase ai message query failed: ' . $error->getMessage());
            return [];
        }
    } else {
        $collection = firebase_ai_messages_collection();
        if ($collection) {
            try {
                $query = $collection->where('threadId', '=', $threadId);
                foreach ($query->documents() as $snapshot) {
                    $record = firebase_ai_message_document_to_record($snapshot);
                    if ($record) {
                        $messages[] = $record;
                    }
                }
            } catch (\Throwable $error) {
                if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
                    error_log('firebase ai message query failed: ' . $error->getMessage());
                    return [];
                }
            }
        }

        if ($messages === []) {
            try {
                foreach (firebase_firestore_rest_list_collection('ai_messages') as $document) {
                    $record = firebase_ai_message_document_to_record(firebase_firestore_rest_snapshot($document));
                    if ($record && (string) ($record['thread_id'] ?? '') === $threadId) {
                        $messages[] = $record;
                    }
                }
            } catch (\Throwable $error) {
                error_log('firebase ai message query failed: ' . $error->getMessage());
                return [];
            }
        }
    }

    if ($user) {
        $uid = trim((string) ($user['firebase_uid'] ?? $user['uid'] ?? $user['id'] ?? ''));
        if ($uid !== '' && normalize_user_role((string) ($user['role'] ?? 'user')) !== 'admin') {
            $messages = array_values(array_filter($messages, function (array $message) use ($uid): bool {
                return (string) ($message['owner_uid'] ?? '') === $uid;
            }));
        }
    }

    usort($messages, fn($a, $b) => strcmp((string) ($a['created_at'] ?? ''), (string) ($b['created_at'] ?? '')));
    return array_values($messages);
}

function firebase_storage_bucket()
{
    static $bucket = false;
    if ($bucket !== false) {
        return $bucket;
    }

    $factory = firebase_admin_factory();
    if (!$factory) {
        $bucket = null;
        return $bucket;
    }

    try {
        $storage = $factory->createStorage();
        if (is_object($storage) && method_exists($storage, 'getBucket')) {
            $bucket = $storage->getBucket();
        } elseif (is_object($storage) && method_exists($storage, 'bucket')) {
            $bucket = $storage->bucket();
        } else {
            $bucket = null;
        }
    } catch (\Throwable $error) {
        error_log('firebase storage init failed: ' . $error->getMessage());
        $bucket = null;
    }

    return $bucket;
}

function firebase_file_id_prefix(): string
{
    return 'fb_';
}

function firebase_is_file_id(string $id): bool
{
    return str_starts_with($id, firebase_file_id_prefix());
}

function firebase_file_owner_uid(?array $user = null): string
{
    $user = $user ?? current_user();
    return trim((string) ($user['firebase_uid'] ?? ''));
}

function firebase_file_backend_enabled(?array $user = null): bool
{
    return firebase_admin_ready() && firebase_file_owner_uid($user) !== '';
}

function app_file_backend_label(?array $user = null): string
{
    return 'Firestore + Cloud Storage';
}

function firebase_files_collection()
{
    if (firebase_firestore_prefer_rest()) {
        return null;
    }

    $database = firebase_firestore_database();
    if (!$database || !method_exists($database, 'collection')) {
        return null;
    }

    return $database->collection('files');
}

function firebase_file_document(string $fileId)
{
    $collection = firebase_files_collection();
    if (!$collection || !method_exists($collection, 'document')) {
        return null;
    }

    return $collection->document($fileId);
}

function firebase_load_storage_text(string $path): string
{
    $bucket = firebase_storage_bucket();
    if (!$bucket || $path === '' || !method_exists($bucket, 'object')) {
        return '';
    }

    try {
        $object = $bucket->object($path);
        if (!$object || (method_exists($object, 'exists') && !$object->exists())) {
            return '';
        }
        if (method_exists($object, 'downloadAsString')) {
            return (string) $object->downloadAsString();
        }
        if (method_exists($object, 'downloadAsStream')) {
            $stream = $object->downloadAsStream();
            if (is_resource($stream)) {
                return (string) stream_get_contents($stream);
            }
        }
    } catch (\Throwable $error) {
        error_log('firebase storage read failed: ' . $error->getMessage());
    }

    return '';
}

function firebase_store_storage_text(string $path, string $content): void
{
    $bucket = firebase_storage_bucket();
    if (!$bucket || $path === '' || !method_exists($bucket, 'upload')) {
        throw new RuntimeException('Firebase Storage bucket is not ready.');
    }

    $options = [
        'name' => $path,
        'metadata' => [
            'contentType' => 'text/plain; charset=UTF-8',
        ],
    ];

    $bucket->upload($content, $options);
}

function firebase_delete_storage_text(string $path): void
{
    $bucket = firebase_storage_bucket();
    if (!$bucket || $path === '' || !method_exists($bucket, 'object')) {
        return;
    }

    try {
        $object = $bucket->object($path);
        if ($object && (!method_exists($object, 'exists') || $object->exists()) && method_exists($object, 'delete')) {
            $object->delete();
        }
    } catch (\Throwable $error) {
        error_log('firebase storage delete failed: ' . $error->getMessage());
    }
}

function firebase_builtin_rules_manifest_path(): string
{
    return 'builtin-rules/library.json';
}

function firebase_builtin_rule_storage_path(string $id): string
{
    return 'builtin-rules/grammars/' . $id . '.txt';
}

function firebase_builtin_rules_runtime_ready(): bool
{
    return firebase_storage_bucket() !== null;
}

function firebase_normalize_builtin_rule_record(array $record): array
{
    $record['id'] = trim((string) ($record['id'] ?? ''));
    $record['title'] = trim((string) ($record['title'] ?? 'Untitled builtin rule'));
    $record['entry_rule'] = trim((string) ($record['entry_rule'] ?? ''));
    $record['group'] = trim((string) ($record['group'] ?? 'General'));
    $record['summary'] = trim((string) ($record['summary'] ?? ''));
    $record['storage_path'] = trim((string) ($record['storage_path'] ?? ''));
    $record['created_at'] = (string) ($record['created_at'] ?? '');
    $record['updated_at'] = (string) ($record['updated_at'] ?? '');
    $record['published_by_uid'] = trim((string) ($record['published_by_uid'] ?? ''));
    $record['published_by_username'] = trim((string) ($record['published_by_username'] ?? ''));
    $record['is_active'] = array_key_exists('is_active', $record) ? !empty($record['is_active']) : true;
    return $record;
}

function firebase_builtin_rule_slug(string $entryRule): string
{
    $value = strtolower(trim($entryRule));
    $value = preg_replace('/[^a-z0-9_]+/', '-', $value);
    $value = trim((string) $value, '-');
    return $value !== '' ? $value : 'builtin-rule';
}

function firebase_load_builtin_rules_manifest(): array
{
    if (!firebase_builtin_rules_runtime_ready()) {
        return [];
    }

    $raw = firebase_load_storage_text(firebase_builtin_rules_manifest_path());
    if ($raw === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return [];
    }

    return array_values(array_map('firebase_normalize_builtin_rule_record', $data));
}

function firebase_write_builtin_rules_manifest(array $records): void
{
    if (!firebase_builtin_rules_runtime_ready()) {
        throw new RuntimeException('Firebase Storage is not ready for builtin rules.');
    }

    $records = array_values(array_map('firebase_normalize_builtin_rule_record', $records));
    usort($records, function ($a, $b) {
        $groupCompare = strcmp((string) ($a['group'] ?? ''), (string) ($b['group'] ?? ''));
        if ($groupCompare !== 0) {
            return $groupCompare;
        }
        return strcmp((string) ($a['entry_rule'] ?? ''), (string) ($b['entry_rule'] ?? ''));
    });

    firebase_store_storage_text(
        firebase_builtin_rules_manifest_path(),
        json_encode($records, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );
}

function firebase_all_builtin_rules(bool $activeOnly = false, bool $includeGrammar = false): array
{
    $records = firebase_load_builtin_rules_manifest();
    if ($activeOnly) {
        $records = array_values(array_filter($records, fn($record) => !empty($record['is_active'])));
    }

    if ($includeGrammar) {
        foreach ($records as $index => $record) {
            $records[$index]['grammar'] = firebase_load_storage_text((string) ($record['storage_path'] ?? ''));
        }
    }

    return $records;
}

function firebase_builtin_rule_find_by_id(string $id): ?array
{
    $id = trim($id);
    if ($id === '') {
        return null;
    }

    foreach (firebase_load_builtin_rules_manifest() as $record) {
        if ((string) ($record['id'] ?? '') === $id) {
            return $record;
        }
    }

    return null;
}

function firebase_builtin_rule_find_by_entry_rule(string $entryRule, bool $includeGrammar = false): ?array
{
    $entryRule = trim($entryRule);
    if ($entryRule === '') {
        return null;
    }

    foreach (firebase_load_builtin_rules_manifest() as $record) {
        if ((string) ($record['entry_rule'] ?? '') !== $entryRule) {
            continue;
        }
        if ($includeGrammar) {
            $record['grammar'] = firebase_load_storage_text((string) ($record['storage_path'] ?? ''));
        }
        return $record;
    }

    return null;
}

function firebase_builtin_rule_contains_entry_rule(string $grammar, string $entryRule): bool
{
    $entryRule = trim($entryRule);
    if ($entryRule === '') {
        return false;
    }

    $pattern = '/^\s*' . preg_quote($entryRule, '/') . '\s*(?:\([^)]*\))?(?:\s+[^-\r\n][^\r\n]*)?\s*->/m';
    return (bool) preg_match($pattern, $grammar);
}

function firebase_builtin_rule_has_start_rule(string $grammar): bool
{
    return (bool) preg_match('/^\s*Start\s*(?:\([^)]*\))?(?:\s+[^-\r\n][^\r\n]*)?\s*->/m', $grammar);
}

function firebase_publish_builtin_rule(array $actor, array $payload): array
{
    if (!is_admin($actor)) {
        throw new RuntimeException('Admin access required.');
    }
    if (!firebase_builtin_rules_runtime_ready()) {
        throw new RuntimeException('Firebase Storage is not ready for builtin rules.');
    }

    $title = trim((string) ($payload['title'] ?? ''));
    $entryRule = trim((string) ($payload['entry_rule'] ?? ''));
    $group = trim((string) ($payload['group'] ?? 'General'));
    $summary = trim((string) ($payload['summary'] ?? ''));
    $grammar = trim((string) ($payload['grammar'] ?? ''));

    if ($title === '') {
        $title = 'Untitled builtin rule';
    }
    if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]{0,63}$/', $entryRule)) {
        throw new RuntimeException('Builtin rule name must start with a letter or underscore and use only letters, numbers, or underscores.');
    }
    if (in_array($entryRule, ['T', 'S', 'A', 'R', 'I', 'Cube', 'CubeX', 'CubeY', 'CubeZ', 'sin', 'cos', 'min', 'max', 'int', 'float', 'rand', 'Start'], true)) {
        throw new RuntimeException('Choose a builtin rule name that does not collide with reserved grammar keywords or built-in functions.');
    }
    if ($grammar === '') {
        throw new RuntimeException('Builtin grammar content is empty.');
    }
    if (!firebase_builtin_rule_contains_entry_rule($grammar, $entryRule) && !firebase_builtin_rule_has_start_rule($grammar)) {
        throw new RuntimeException('The grammar must define either the requested builtin entry rule or Start -> so it can be remapped during injection.');
    }

    $records = firebase_load_builtin_rules_manifest();
    $id = 'builtin-' . firebase_builtin_rule_slug($entryRule);
    $now = gmdate('c');
    $storagePath = firebase_builtin_rule_storage_path($id);

    foreach ($records as $index => $record) {
        if ((string) ($record['id'] ?? '') !== $id) {
            continue;
        }

        $records[$index] = firebase_normalize_builtin_rule_record([
            'id' => $id,
            'title' => $title,
            'entry_rule' => $entryRule,
            'group' => $group,
            'summary' => $summary,
            'storage_path' => $storagePath,
            'created_at' => (string) ($record['created_at'] ?? $now),
            'updated_at' => $now,
            'published_by_uid' => (string) ($actor['firebase_uid'] ?? ''),
            'published_by_username' => (string) ($actor['username'] ?? ''),
            'is_active' => true,
        ]);
        firebase_store_storage_text($storagePath, $grammar);
        firebase_write_builtin_rules_manifest($records);
        $updated = $records[$index];
        $updated['grammar'] = $grammar;
        $updated['was_update'] = true;
        return $updated;
    }

    $record = firebase_normalize_builtin_rule_record([
        'id' => $id,
        'title' => $title,
        'entry_rule' => $entryRule,
        'group' => $group,
        'summary' => $summary,
        'storage_path' => $storagePath,
        'created_at' => $now,
        'updated_at' => $now,
        'published_by_uid' => (string) ($actor['firebase_uid'] ?? ''),
        'published_by_username' => (string) ($actor['username'] ?? ''),
        'is_active' => true,
    ]);
    $records[] = $record;
    firebase_store_storage_text($storagePath, $grammar);
    firebase_write_builtin_rules_manifest($records);
    $record['grammar'] = $grammar;
    $record['was_update'] = false;
    return $record;
}

function firebase_delete_builtin_rule(string $id, ?array $actor = null): bool
{
    $actor = $actor ?? current_user();
    if (!is_admin($actor)) {
        throw new RuntimeException('Admin access required.');
    }

    $records = firebase_load_builtin_rules_manifest();
    $kept = [];
    $deleted = null;

    foreach ($records as $record) {
        if ((string) ($record['id'] ?? '') === $id) {
            $deleted = $record;
            continue;
        }
        $kept[] = $record;
    }

    if (!$deleted) {
        return false;
    }

    firebase_write_builtin_rules_manifest($kept);
    firebase_delete_storage_text((string) ($deleted['storage_path'] ?? ''));
    return true;
}

function firebase_builtin_rules_combined_grammar(): string
{
    $parts = [];
    foreach (firebase_all_builtin_rules(true, true) as $record) {
        $entryRule = (string) ($record['entry_rule'] ?? '');
        $group = (string) ($record['group'] ?? 'General');
        $grammar = trim((string) ($record['grammar'] ?? ''));
        if ($entryRule === '' || $grammar === '') {
            continue;
        }

        $parts[] = '/* BUILTIN RULE: ' . $entryRule . ' · group=' . $group . ' */';
        $parts[] = $grammar;
    }

    return implode("\n\n", $parts);
}

function firebase_builtin_rule_library_payload(bool $includeGrammar = false): array
{
    $items = firebase_all_builtin_rules(true, $includeGrammar);
    $rulesByEntryRule = [];
    foreach ($items as $item) {
        $entryRule = (string) ($item['entry_rule'] ?? '');
        if ($entryRule === '') {
            continue;
        }
        $rulesByEntryRule[$entryRule] = [
            'id' => (string) ($item['id'] ?? ''),
            'title' => (string) ($item['title'] ?? ''),
            'entry_rule' => $entryRule,
            'group' => (string) ($item['group'] ?? 'General'),
            'summary' => (string) ($item['summary'] ?? ''),
            'updated_at' => (string) ($item['updated_at'] ?? ''),
        ];
        if ($includeGrammar) {
            $rulesByEntryRule[$entryRule]['grammar'] = (string) ($item['grammar'] ?? '');
        }
    }

    return [
        'items' => array_values(array_map(function ($item) {
            unset($item['grammar'], $item['storage_path']);
            return $item;
        }, $items)),
        'rulesByEntryRule' => $rulesByEntryRule,
        'isHydrated' => $includeGrammar,
    ];
}

function firebase_file_document_to_record($snapshot, bool $includeContent = true): ?array
{
    if (!$snapshot) {
        return null;
    }
    if (method_exists($snapshot, 'exists') && !$snapshot->exists()) {
        return null;
    }

    $data = method_exists($snapshot, 'data') ? $snapshot->data() : null;
    if (!is_array($data)) {
        return null;
    }

    $fileId = (string) ($data['id'] ?? (method_exists($snapshot, 'id') ? $snapshot->id() : ''));
    if ($fileId === '') {
        return null;
    }

    $record = [
        'id' => $fileId,
        'title' => (string) ($data['title'] ?? 'Untitled grammar'),
        'content' => '',
        'is_published' => !empty($data['isPublished']) ? 1 : 0,
        'created_at' => (string) ($data['createdAt'] ?? ''),
        'updated_at' => (string) ($data['updatedAt'] ?? ''),
        'published_at' => $data['publishedAt'] ?? null,
        'username' => (string) ($data['ownerUsername'] ?? 'unknown'),
        'owner_role' => (string) ($data['ownerRole'] ?? 'user'),
        'email' => (string) ($data['ownerEmail'] ?? ''),
        'owner_uid' => (string) ($data['ownerUid'] ?? ''),
        'storage_path' => (string) ($data['storagePath'] ?? ''),
        'legacy_source_id' => isset($data['legacySourceId']) ? (int) $data['legacySourceId'] : null,
        'backend' => 'firebase',
    ];

    if ($includeContent) {
        $record['content'] = firebase_load_storage_text((string) $record['storage_path']);
    }

    return $record;
}

function firebase_fetch_file_record(string $fileId, bool $includeContent = true): ?array
{
    if (firebase_firestore_prefer_rest()) {
        try {
            $document = firebase_firestore_rest_get_document('files', $fileId);
            if (!$document) {
                return null;
            }
            return firebase_file_document_to_record(firebase_firestore_rest_snapshot($document), $includeContent);
        } catch (\Throwable $error) {
            error_log('firebase file fetch failed: ' . $error->getMessage());
            return null;
        }
    }

    $doc = firebase_file_document($fileId);
    if (!$doc || !method_exists($doc, 'snapshot')) {
        return null;
    }

    try {
        return firebase_file_document_to_record($doc->snapshot(), $includeContent);
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            error_log('firebase file fetch failed: ' . $error->getMessage());
            return null;
        }

        try {
            $document = firebase_firestore_rest_get_document('files', $fileId);
            if (!$document) {
                return null;
            }
            return firebase_file_document_to_record(firebase_firestore_rest_snapshot($document), $includeContent);
        } catch (\Throwable $restError) {
            error_log('firebase file fetch failed: ' . $restError->getMessage());
            return null;
        }
    }
}

function firebase_file_access_allowed(array $file, ?array $user = null): bool
{
    $user = $user ?? current_user();
    if (!$user) {
        return false;
    }
    if (!empty($user['role']) && normalize_user_role((string) $user['role']) === 'admin') {
        return true;
    }

    return firebase_file_owner_uid($user) !== '' && firebase_file_owner_uid($user) === (string) ($file['owner_uid'] ?? '');
}

function firebase_sort_files(array $files, string $field = 'updated_at'): array
{
    usort($files, function ($a, $b) use ($field) {
        $aValue = (string) ($a[$field] ?? '');
        $bValue = (string) ($b[$field] ?? '');
        return strcmp($bValue, $aValue);
    });

    return array_values($files);
}

function firebase_query_files($query, bool $includeContent = true): array
{
    if (!$query || !method_exists($query, 'documents')) {
        return [];
    }

    $files = [];
    try {
        foreach ($query->documents() as $snapshot) {
            $record = firebase_file_document_to_record($snapshot, $includeContent);
            if ($record) {
                $files[] = $record;
            }
        }
    } catch (\Throwable $error) {
        error_log('firebase file query failed: ' . $error->getMessage());
        return [];
    }

    return $files;
}

function firebase_all_files(bool $includeContent = true): array
{
    if (firebase_firestore_prefer_rest()) {
        try {
            $files = [];
            foreach (firebase_firestore_rest_list_collection('files') as $document) {
                $record = firebase_file_document_to_record(firebase_firestore_rest_snapshot($document), $includeContent);
                if ($record) {
                    $files[] = $record;
                }
            }
            return firebase_sort_files($files);
        } catch (\Throwable $error) {
            error_log('firebase file query failed: ' . $error->getMessage());
            return [];
        }
    }

    $collection = firebase_files_collection();
    if (!$collection) {
        try {
            $files = [];
            foreach (firebase_firestore_rest_list_collection('files') as $document) {
                $record = firebase_file_document_to_record(firebase_firestore_rest_snapshot($document), $includeContent);
                if ($record) {
                    $files[] = $record;
                }
            }
            return firebase_sort_files($files);
        } catch (\Throwable $error) {
            error_log('firebase file query failed: ' . $error->getMessage());
            return [];
        }
    }

    $files = firebase_query_files($collection, $includeContent);
    if ($files !== []) {
        return firebase_sort_files($files);
    }

    try {
        $restFiles = [];
        foreach (firebase_firestore_rest_list_collection('files') as $document) {
            $record = firebase_file_document_to_record(firebase_firestore_rest_snapshot($document), $includeContent);
            if ($record) {
                $restFiles[] = $record;
            }
        }
        return firebase_sort_files($restFiles);
    } catch (\Throwable $error) {
        error_log('firebase file query failed: ' . $error->getMessage());
        return [];
    }
}

function firebase_user_files(array $user, bool $includeContent = true): array
{
    if (firebase_firestore_prefer_rest()) {
        $files = firebase_all_files($includeContent);
        if (normalize_user_role((string) ($user['role'] ?? 'user')) === 'admin') {
            return firebase_sort_files($files);
        }

        $uid = firebase_file_owner_uid($user);
        if ($uid === '') {
            return [];
        }

        return firebase_sort_files(array_values(array_filter($files, function (array $file) use ($uid): bool {
            return (string) ($file['owner_uid'] ?? '') === $uid;
        })));
    }

    $collection = firebase_files_collection();
    $uid = firebase_file_owner_uid($user);
    if (!$collection || $uid === '') {
        return [];
    }

    try {
        $query = normalize_user_role((string) ($user['role'] ?? 'user')) === 'admin'
            ? $collection
            : $collection->where('ownerUid', '=', $uid);
        return firebase_sort_files(firebase_query_files($query, $includeContent));
    } catch (\Throwable $error) {
        error_log('firebase user files query failed: ' . $error->getMessage());
        return [];
    }
}

function firebase_public_files(bool $includeContent = true): array
{
    if (firebase_firestore_prefer_rest()) {
        return firebase_sort_files(array_values(array_filter(firebase_all_files($includeContent), function (array $file): bool {
            return !empty($file['is_published']);
        })), 'published_at');
    }

    $collection = firebase_files_collection();
    if (!$collection) {
        return [];
    }

    try {
        $query = $collection->where('isPublished', '=', true);
        return firebase_sort_files(firebase_query_files($query, $includeContent), 'published_at');
    } catch (\Throwable $error) {
        error_log('firebase public files query failed: ' . $error->getMessage());
        return [];
    }
}

function firebase_generate_file_id(): string
{
    return firebase_file_id_prefix() . bin2hex(random_bytes(12));
}

function firebase_legacy_source_id(?array $file): int
{
    return (int) ($file['legacy_source_id'] ?? 0);
}

function firebase_legacy_source_map(array $firebaseFiles): array
{
    $map = [];
    foreach ($firebaseFiles as $file) {
        $legacyId = firebase_legacy_source_id($file);
        if ($legacyId > 0) {
            $map[$legacyId] = (string) ($file['id'] ?? '');
        }
    }
    return $map;
}

function app_filter_legacy_duplicates(array $legacyFiles, array $firebaseFiles): array
{
    $firebaseLegacyMap = firebase_legacy_source_map($firebaseFiles);
    return array_values(array_filter($legacyFiles, function ($file) use ($firebaseLegacyMap) {
        $legacyId = (int) ($file['id'] ?? 0);
        $migratedTo = trim((string) ($file['migrated_to_firebase_id'] ?? ''));
        if ($migratedTo !== '') {
            return false;
        }
        if ($legacyId > 0 && isset($firebaseLegacyMap[$legacyId])) {
            return false;
        }
        return true;
    }));
}

function app_merge_hybrid_files(array $firebaseFiles, array $legacyFiles, string $field = 'updated_at'): array
{
    return firebase_sort_files(array_merge($firebaseFiles, app_filter_legacy_duplicates($legacyFiles, $firebaseFiles)), $field);
}

function app_resolve_migrated_legacy_file_id(string $id, ?array $user = null): ?string
{
    if ($id === '' || firebase_is_file_id($id)) {
        return null;
    }

    $legacy = app_find_legacy_user_file((int) $id, $user);
    $firebaseId = trim((string) ($legacy['migrated_to_firebase_id'] ?? ''));
    return $firebaseId !== '' ? $firebaseId : null;
}

function firebase_build_file_storage_path(array $user, string $fileId): string
{
    return 'users/' . firebase_file_owner_uid($user) . '/files/' . $fileId . '.txt';
}

function firebase_build_migrated_file_record(array $existing, array $user, string $fileId, string $title, string $content, bool $publish): array
{
    $now = gmdate('c');
    $publishedAt = $publish
        ? (!empty($existing['published_at']) ? $existing['published_at'] : $now)
        : ($existing['published_at'] ?? null);

    return [
        'id' => $fileId,
        'ownerUid' => firebase_file_owner_uid($user),
        'ownerUsername' => (string) ($user['username'] ?? 'unknown'),
        'ownerEmail' => (string) ($user['email'] ?? ''),
        'ownerRole' => normalize_user_role((string) ($user['role'] ?? 'user')),
        'title' => $title,
        'storagePath' => firebase_build_file_storage_path($user, $fileId),
        'isPublished' => $publish,
        'createdAt' => (string) ($existing['created_at'] ?? $now),
        'updatedAt' => (string) ($existing['updated_at'] ?? $now),
        'publishedAt' => $publishedAt,
        'legacySourceId' => (int) ($existing['id'] ?? 0),
        'legacyMigratedAt' => $now,
        'content' => $content,
    ];
}

function firebase_write_file_record(array $record): array
{
    $fileId = (string) ($record['id'] ?? '');
    $storagePath = (string) ($record['storagePath'] ?? '');
    $content = (string) ($record['content'] ?? '');
    unset($record['content']);

    firebase_store_storage_text($storagePath, $content);

    if (firebase_firestore_prefer_rest()) {
        try {
            firebase_firestore_rest_upsert_document('files', $fileId, $record);
        } catch (\Throwable $error) {
            throw new RuntimeException('Could not save the Firebase file metadata: ' . $error->getMessage());
        }

        return [
            'id' => $fileId,
            'title' => (string) ($record['title'] ?? 'Untitled grammar'),
            'content' => $content,
            'is_published' => !empty($record['isPublished']) ? 1 : 0,
            'created_at' => (string) ($record['createdAt'] ?? ''),
            'updated_at' => (string) ($record['updatedAt'] ?? ''),
            'published_at' => $record['publishedAt'] ?? null,
            'username' => (string) ($record['ownerUsername'] ?? 'unknown'),
            'owner_role' => (string) ($record['ownerRole'] ?? 'user'),
            'email' => (string) ($record['ownerEmail'] ?? ''),
            'owner_uid' => (string) ($record['ownerUid'] ?? ''),
            'storage_path' => $storagePath,
            'legacy_source_id' => isset($record['legacySourceId']) ? (int) $record['legacySourceId'] : null,
            'backend' => 'firebase',
        ];
    }

    $doc = firebase_file_document($fileId);
    if (!$doc || !method_exists($doc, 'set')) {
        throw new RuntimeException('Firebase Firestore is not ready.');
    }

    try {
        $doc->set($record);
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            throw new RuntimeException('Could not save the Firebase file metadata: ' . $error->getMessage());
        }

        try {
            firebase_firestore_rest_upsert_document('files', $fileId, $record);
        } catch (\Throwable $restError) {
            throw new RuntimeException('Could not save the Firebase file metadata: ' . $restError->getMessage());
        }
    }

    return [
        'id' => $fileId,
        'title' => (string) ($record['title'] ?? 'Untitled grammar'),
        'content' => $content,
        'is_published' => !empty($record['isPublished']) ? 1 : 0,
        'created_at' => (string) ($record['createdAt'] ?? ''),
        'updated_at' => (string) ($record['updatedAt'] ?? ''),
        'published_at' => $record['publishedAt'] ?? null,
        'username' => (string) ($record['ownerUsername'] ?? 'unknown'),
        'owner_role' => (string) ($record['ownerRole'] ?? 'user'),
        'email' => (string) ($record['ownerEmail'] ?? ''),
        'owner_uid' => (string) ($record['ownerUid'] ?? ''),
        'storage_path' => $storagePath,
        'legacy_source_id' => isset($record['legacySourceId']) ? (int) $record['legacySourceId'] : null,
        'backend' => 'firebase',
    ];
}

function firebase_migrate_legacy_file_record(array $legacyFile, array $user): array
{
    if (!firebase_file_backend_enabled($user)) {
        throw new RuntimeException('Firebase file backend is not ready for this owner.');
    }

    $existingFirebaseId = trim((string) ($legacyFile['migrated_to_firebase_id'] ?? ''));
    if ($existingFirebaseId !== '') {
        $existing = firebase_fetch_file_record($existingFirebaseId, true);
        if ($existing) {
            return $existing;
        }
    }

    $fileId = firebase_generate_file_id();
    $record = firebase_build_migrated_file_record(
        $legacyFile,
        $user,
        $fileId,
        (string) ($legacyFile['title'] ?? 'Untitled grammar'),
        (string) ($legacyFile['content'] ?? ''),
        !empty($legacyFile['is_published'])
    );
    $result = firebase_write_file_record($record);
    mark_legacy_file_migrated((int) ($legacyFile['id'] ?? 0), $fileId);
    return $result;
}

function app_all_files(): array
{
    return firebase_admin_ready() ? firebase_all_files(true) : [];
}

function app_get_user_files(?array $user = null): array
{
    $user = $user ?? current_user();
    if (!$user) {
        return [];
    }

    return firebase_file_backend_enabled($user) ? firebase_user_files($user, true) : [];
}

function app_get_public_files(): array
{
    return firebase_admin_ready() ? firebase_public_files(true) : [];
}

function app_find_user_file(string $id, ?array $user = null): ?array
{
    $user = $user ?? current_user();
    if ($id === '') {
        return null;
    }

    if (firebase_is_file_id($id)) {
        $file = firebase_fetch_file_record($id, true);
        return ($file && firebase_file_access_allowed($file, $user)) ? $file : null;
    }
    return null;
}

function app_find_public_file(string $id): ?array
{
    if ($id === '') {
        return null;
    }

    if (firebase_is_file_id($id)) {
        $file = firebase_fetch_file_record($id, true);
        return ($file && !empty($file['is_published'])) ? $file : null;
    }
    return null;
}

function app_upsert_file_record(?array $user, ?string $id, string $title, string $content, bool $publish = false): array
{
    if (!$user) {
        throw new RuntimeException('Authentication required.');
    }

    $id = $id !== null ? trim($id) : null;
    if ($id !== null && $id !== '' && !firebase_is_file_id($id)) {
        throw new RuntimeException('Legacy file ids are no longer supported by the live app. Run the migration script first.');
    }

    if (!firebase_file_backend_enabled($user)) {
        throw new RuntimeException('Firebase file backend is not ready.');
    }

    $existing = $id ? firebase_fetch_file_record($id, false) : null;
    if ($existing && !firebase_file_access_allowed($existing, $user)) {
        throw new RuntimeException('File not found or not editable.');
    }

    $fileId = $existing ? (string) $existing['id'] : firebase_generate_file_id();
    $now = gmdate('c');
    $title = trim($title) !== '' ? trim($title) : 'Untitled grammar';
    $storagePath = $existing ? (string) ($existing['storage_path'] ?? '') : firebase_build_file_storage_path($user, $fileId);
    $wasPublished = $existing ? !empty($existing['is_published']) : false;
    $publishedAt = $publish ? (($existing && !empty($existing['published_at'])) ? $existing['published_at'] : $now) : ($existing['published_at'] ?? null);

    $record = [
        'id' => $fileId,
        'ownerUid' => firebase_file_owner_uid($user),
        'ownerUsername' => (string) ($user['username'] ?? 'unknown'),
        'ownerEmail' => (string) ($user['email'] ?? ''),
        'ownerRole' => normalize_user_role((string) ($user['role'] ?? 'user')),
        'title' => $title,
        'storagePath' => $storagePath,
        'isPublished' => $publish,
        'createdAt' => $existing['created_at'] ?? $now,
        'updatedAt' => $now,
        'publishedAt' => $publishedAt,
        'content' => $content,
    ];

    $result = firebase_write_file_record($record);

    if ($publish && !$wasPublished) {
        send_publish_admin_notification($result);
    }

    return $result;
}

function app_set_file_published(string $id, ?array $user, bool $published): bool
{
    if ($id === '' || !firebase_is_file_id($id)) {
        return false;
    }

    $file = firebase_fetch_file_record($id, false);
    if (!$file || !firebase_file_access_allowed($file, $user)) {
        return false;
    }

    $doc = firebase_file_document($id);
    if (!$doc || !method_exists($doc, 'set')) {
        return false;
    }

    $now = gmdate('c');
    $wasPublished = !empty($file['is_published']);
    $updated = [
        'id' => (string) $file['id'],
        'ownerUid' => (string) ($file['owner_uid'] ?? ''),
        'ownerUsername' => (string) ($file['username'] ?? 'unknown'),
        'ownerEmail' => (string) ($file['email'] ?? ''),
        'ownerRole' => (string) ($file['owner_role'] ?? 'user'),
        'title' => (string) ($file['title'] ?? 'Untitled grammar'),
        'storagePath' => (string) ($file['storage_path'] ?? ''),
        'isPublished' => $published,
        'createdAt' => (string) ($file['created_at'] ?? $now),
        'updatedAt' => $now,
        'publishedAt' => $published ? ((string) ($file['published_at'] ?? '') !== '' ? $file['published_at'] : $now) : null,
    ];

    try {
        $doc->set($updated);
    } catch (\Throwable $error) {
        error_log('firebase publish toggle failed: ' . $error->getMessage());
        return false;
    }

    if ($published && !$wasPublished) {
        send_publish_admin_notification([
            'id' => (string) $file['id'],
            'title' => (string) ($file['title'] ?? ''),
            'content' => firebase_load_storage_text((string) ($file['storage_path'] ?? '')),
            'published_at' => $updated['publishedAt'],
            'username' => (string) ($file['username'] ?? 'unknown'),
            'email' => (string) ($file['email'] ?? ''),
        ]);
    }

    return true;
}

function app_delete_file_record(string $id, ?array $user): bool
{
    if ($id === '' || !firebase_is_file_id($id)) {
        return false;
    }

    $file = firebase_fetch_file_record($id, false);
    if (!$file || !firebase_file_access_allowed($file, $user)) {
        return false;
    }

    $doc = firebase_file_document($id);
    if (!$doc || !method_exists($doc, 'delete')) {
        return false;
    }

    try {
        $doc->delete();
        firebase_delete_storage_text((string) ($file['storage_path'] ?? ''));
        return true;
    } catch (\Throwable $error) {
        error_log('firebase delete failed: ' . $error->getMessage());
        return false;
    }
}
