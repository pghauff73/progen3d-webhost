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
        'credit_balance' => max(0, (int) ($user['credit_balance'] ?? 0)),
        'credit_granted_lifetime' => max(0, (int) ($user['credit_granted_lifetime'] ?? 0)),
        'credit_spent_lifetime' => max(0, (int) ($user['credit_spent_lifetime'] ?? 0)),
        'credit_reserved' => max(0, (int) ($user['credit_reserved'] ?? 0)),
        'credit_plan' => (string) ($user['credit_plan'] ?? 'free'),
        'credit_updated_at' => $user['credit_updated_at'] ?? null,
        'ai_model_preference' => trim((string) ($user['ai_model_preference'] ?? '')),
        'ai_model_updated_at' => $user['ai_model_updated_at'] ?? null,
        'ai_image_model_preference' => trim((string) ($user['ai_image_model_preference'] ?? '')),
        'ai_image_model_updated_at' => $user['ai_image_model_updated_at'] ?? null,
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
        'credit_balance' => max(0, (int) ($data['credit_balance'] ?? 0)),
        'credit_granted_lifetime' => max(0, (int) ($data['credit_granted_lifetime'] ?? 0)),
        'credit_spent_lifetime' => max(0, (int) ($data['credit_spent_lifetime'] ?? 0)),
        'credit_reserved' => max(0, (int) ($data['credit_reserved'] ?? 0)),
        'credit_plan' => (string) ($data['credit_plan'] ?? 'free'),
        'credit_updated_at' => $data['credit_updated_at'] ?? null,
        'ai_model_preference' => trim((string) ($data['ai_model_preference'] ?? '')),
        'ai_model_updated_at' => $data['ai_model_updated_at'] ?? null,
        'ai_image_model_preference' => trim((string) ($data['ai_image_model_preference'] ?? '')),
        'ai_image_model_updated_at' => $data['ai_image_model_updated_at'] ?? null,
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

function firebase_ai_usage_id_prefix(): string
{
    return 'aiu_';
}

function firebase_credit_ledger_id_prefix(): string
{
    return 'clg_';
}

function firebase_generate_ai_thread_id(): string
{
    return firebase_ai_thread_id_prefix() . bin2hex(random_bytes(12));
}

function firebase_generate_ai_message_id(): string
{
    return firebase_ai_message_id_prefix() . bin2hex(random_bytes(12));
}

function firebase_generate_ai_usage_id(): string
{
    return firebase_ai_usage_id_prefix() . bin2hex(random_bytes(12));
}

function firebase_generate_credit_ledger_id(): string
{
    return firebase_credit_ledger_id_prefix() . bin2hex(random_bytes(12));
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

function firebase_ai_usage_collection()
{
    if (firebase_firestore_prefer_rest()) {
        return null;
    }

    $database = firebase_firestore_database();
    if (!$database || !method_exists($database, 'collection')) {
        return null;
    }

    return $database->collection('ai_usage');
}

function firebase_credit_ledger_collection()
{
    if (firebase_firestore_prefer_rest()) {
        return null;
    }

    $database = firebase_firestore_database();
    if (!$database || !method_exists($database, 'collection')) {
        return null;
    }

    return $database->collection('credit_ledger');
}

function firebase_user_textures_collection()
{
    if (firebase_firestore_prefer_rest()) {
        return null;
    }

    $database = firebase_firestore_database();
    if (!$database || !method_exists($database, 'collection')) {
        return null;
    }

    return $database->collection('user_textures');
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

function firebase_ai_usage_document(string $usageId)
{
    $collection = firebase_ai_usage_collection();
    $usageId = trim($usageId);
    if (!$collection || !method_exists($collection, 'document') || $usageId === '') {
        return null;
    }

    return $collection->document($usageId);
}

function firebase_credit_ledger_document(string $entryId)
{
    $collection = firebase_credit_ledger_collection();
    $entryId = trim($entryId);
    if (!$collection || !method_exists($collection, 'document') || $entryId === '') {
        return null;
    }

    return $collection->document($entryId);
}

function firebase_user_texture_slot_pattern(): string
{
    return '/^usertexture(?:[1-9]|1[0-9]|20)$/';
}

function firebase_normalize_texture_slot(string $slot): string
{
    $slot = strtolower(trim($slot));
    if (!preg_match(firebase_user_texture_slot_pattern(), $slot)) {
        throw new RuntimeException('Texture slot must be usertexture1 through usertexture20.');
    }

    return $slot;
}

function firebase_user_texture_document_id(string $ownerUid, string $slot): string
{
    $ownerUid = trim($ownerUid);
    $slot = firebase_normalize_texture_slot($slot);
    if ($ownerUid === '') {
        throw new RuntimeException('Texture owner uid is required.');
    }

    return $ownerUid . '__' . $slot;
}

function firebase_user_texture_document(string $ownerUid, string $slot)
{
    $collection = firebase_user_textures_collection();
    $ownerUid = trim($ownerUid);
    if (!$collection || !method_exists($collection, 'document') || $ownerUid === '') {
        return null;
    }

    return $collection->document(firebase_user_texture_document_id($ownerUid, $slot));
}

function firebase_user_texture_storage_path(string $ownerUid, string $slot): string
{
    $ownerUid = trim($ownerUid);
    $slot = firebase_normalize_texture_slot($slot);
    if ($ownerUid === '') {
        throw new RuntimeException('Texture owner uid is required.');
    }

    return 'user-textures/' . $ownerUid . '/' . $slot . '.png';
}

function firebase_user_texture_record_to_document(array $texture): array
{
    $ownerUid = trim((string) ($texture['owner_uid'] ?? ''));
    $slot = firebase_normalize_texture_slot((string) ($texture['slot'] ?? ''));
    $id = trim((string) ($texture['id'] ?? ''));
    if ($id === '') {
        $id = firebase_user_texture_document_id($ownerUid, $slot);
    }

    return [
        'id' => $id,
        'ownerUid' => $ownerUid,
        'slot' => $slot,
        'displayName' => trim((string) ($texture['display_name'] ?? $slot)),
        'storagePath' => trim((string) ($texture['storage_path'] ?? firebase_user_texture_storage_path($ownerUid, $slot))),
        'mimeType' => trim((string) ($texture['mime_type'] ?? 'image/png')),
        'width' => max(1, (int) ($texture['width'] ?? 512)),
        'height' => max(1, (int) ($texture['height'] ?? 512)),
        'alpha' => max(0.0, min(1.0, (float) ($texture['alpha'] ?? 1.0))),
        'source' => trim((string) ($texture['source'] ?? 'upload')),
        'prompt' => trim((string) ($texture['prompt'] ?? '')),
        'active' => array_key_exists('active', $texture) ? !empty($texture['active']) : true,
        'createdAt' => (string) ($texture['created_at'] ?? ''),
        'updatedAt' => (string) ($texture['updated_at'] ?? ''),
    ];
}

function firebase_user_texture_document_to_record($snapshot): ?array
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

    $ownerUid = trim((string) ($data['ownerUid'] ?? ''));
    $slot = trim((string) ($data['slot'] ?? ''));
    if ($ownerUid === '' || $slot === '') {
        return null;
    }

    try {
        $slot = firebase_normalize_texture_slot($slot);
    } catch (\Throwable $error) {
        return null;
    }

    return [
        'id' => trim((string) ($data['id'] ?? (method_exists($snapshot, 'id') ? $snapshot->id() : ''))),
        'owner_uid' => $ownerUid,
        'slot' => $slot,
        'display_name' => trim((string) ($data['displayName'] ?? $slot)),
        'storage_path' => trim((string) ($data['storagePath'] ?? firebase_user_texture_storage_path($ownerUid, $slot))),
        'mime_type' => trim((string) ($data['mimeType'] ?? 'image/png')),
        'width' => max(1, (int) ($data['width'] ?? 512)),
        'height' => max(1, (int) ($data['height'] ?? 512)),
        'alpha' => max(0.0, min(1.0, (float) ($data['alpha'] ?? 1.0))),
        'source' => trim((string) ($data['source'] ?? 'upload')),
        'prompt' => trim((string) ($data['prompt'] ?? '')),
        'active' => array_key_exists('active', $data) ? !empty($data['active']) : true,
        'created_at' => (string) ($data['createdAt'] ?? ''),
        'updated_at' => (string) ($data['updatedAt'] ?? ''),
    ];
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

function firebase_ai_usage_record_to_document(array $usage): array
{
    $id = trim((string) ($usage['id'] ?? ''));

    return [
        'id' => $id,
        'ownerUid' => trim((string) ($usage['owner_uid'] ?? '')),
        'threadId' => trim((string) ($usage['thread_id'] ?? '')),
        'mode' => trim((string) ($usage['mode'] ?? 'active_helper_chat')),
        'model' => trim((string) ($usage['model'] ?? '')),
        'status' => trim((string) ($usage['status'] ?? 'reserved')),
        'promptTokens' => max(0, (int) ($usage['prompt_tokens'] ?? 0)),
        'completionTokens' => max(0, (int) ($usage['completion_tokens'] ?? 0)),
        'totalTokens' => max(0, (int) ($usage['total_tokens'] ?? 0)),
        'estimatedCredits' => max(0, (int) ($usage['estimated_credits'] ?? 0)),
        'finalCredits' => max(0, (int) ($usage['final_credits'] ?? 0)),
        'requestPreview' => trim((string) ($usage['request_preview'] ?? '')),
        'errorMessage' => trim((string) ($usage['error_message'] ?? '')),
        'createdAt' => (string) ($usage['created_at'] ?? ''),
        'completedAt' => $usage['completed_at'] ?? null,
        'metadata' => is_array($usage['metadata'] ?? null) ? $usage['metadata'] : [],
    ];
}

function firebase_ai_usage_document_to_record($snapshot): ?array
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
        'thread_id' => trim((string) ($data['threadId'] ?? '')),
        'mode' => trim((string) ($data['mode'] ?? 'active_helper_chat')),
        'model' => trim((string) ($data['model'] ?? '')),
        'status' => trim((string) ($data['status'] ?? 'reserved')),
        'prompt_tokens' => max(0, (int) ($data['promptTokens'] ?? 0)),
        'completion_tokens' => max(0, (int) ($data['completionTokens'] ?? 0)),
        'total_tokens' => max(0, (int) ($data['totalTokens'] ?? 0)),
        'estimated_credits' => max(0, (int) ($data['estimatedCredits'] ?? 0)),
        'final_credits' => max(0, (int) ($data['finalCredits'] ?? 0)),
        'request_preview' => trim((string) ($data['requestPreview'] ?? '')),
        'error_message' => trim((string) ($data['errorMessage'] ?? '')),
        'created_at' => (string) ($data['createdAt'] ?? ''),
        'completed_at' => $data['completedAt'] ?? null,
        'metadata' => is_array($data['metadata'] ?? null) ? $data['metadata'] : [],
    ];
}

function firebase_credit_ledger_record_to_document(array $entry): array
{
    $id = trim((string) ($entry['id'] ?? ''));

    return [
        'id' => $id,
        'ownerUid' => trim((string) ($entry['owner_uid'] ?? '')),
        'type' => trim((string) ($entry['type'] ?? 'adjustment')),
        'amount' => (int) ($entry['amount'] ?? 0),
        'balanceAfter' => max(0, (int) ($entry['balance_after'] ?? 0)),
        'source' => trim((string) ($entry['source'] ?? 'manual')),
        'referenceType' => trim((string) ($entry['reference_type'] ?? '')),
        'referenceId' => trim((string) ($entry['reference_id'] ?? '')),
        'metadata' => is_array($entry['metadata'] ?? null) ? $entry['metadata'] : [],
        'createdAt' => (string) ($entry['created_at'] ?? ''),
    ];
}

function firebase_credit_ledger_document_to_record($snapshot): ?array
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
        'type' => trim((string) ($data['type'] ?? 'adjustment')),
        'amount' => (int) ($data['amount'] ?? 0),
        'balance_after' => max(0, (int) ($data['balanceAfter'] ?? 0)),
        'source' => trim((string) ($data['source'] ?? 'manual')),
        'reference_type' => trim((string) ($data['referenceType'] ?? '')),
        'reference_id' => trim((string) ($data['referenceId'] ?? '')),
        'metadata' => is_array($data['metadata'] ?? null) ? $data['metadata'] : [],
        'created_at' => (string) ($data['createdAt'] ?? ''),
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

function firebase_write_ai_usage_record(array $usage): array
{
    $usageId = trim((string) ($usage['id'] ?? ''));
    if ($usageId === '') {
        throw new RuntimeException('AI usage record requires an id.');
    }

    if (firebase_firestore_prefer_rest()) {
        try {
            firebase_firestore_rest_upsert_document('ai_usage', $usageId, firebase_ai_usage_record_to_document($usage));
            return firebase_ai_usage_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('ai_usage', $usageId))) ?? $usage;
        } catch (\Throwable $error) {
            throw new RuntimeException('Could not save the AI usage record: ' . $error->getMessage());
        }
    }

    $doc = firebase_ai_usage_document($usageId);
    if (!$doc || !method_exists($doc, 'set')) {
        try {
            firebase_firestore_rest_upsert_document('ai_usage', $usageId, firebase_ai_usage_record_to_document($usage));
            return firebase_ai_usage_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('ai_usage', $usageId))) ?? $usage;
        } catch (\Throwable $error) {
            throw new RuntimeException('Could not save the AI usage record: ' . $error->getMessage());
        }
    }

    try {
        $doc->set(firebase_ai_usage_record_to_document($usage));
        return firebase_ai_usage_document_to_record($doc->snapshot()) ?? $usage;
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            throw new RuntimeException('Could not save the AI usage record: ' . $error->getMessage());
        }

        try {
            firebase_firestore_rest_upsert_document('ai_usage', $usageId, firebase_ai_usage_record_to_document($usage));
            return firebase_ai_usage_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('ai_usage', $usageId))) ?? $usage;
        } catch (\Throwable $restError) {
            throw new RuntimeException('Could not save the AI usage record: ' . $restError->getMessage());
        }
    }
}

function firebase_fetch_ai_usage_record(string $usageId): ?array
{
    $usageId = trim($usageId);
    if ($usageId === '') {
        return null;
    }

    if (firebase_firestore_prefer_rest()) {
        try {
            $document = firebase_firestore_rest_get_document('ai_usage', $usageId);
            return $document ? firebase_ai_usage_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $error) {
            error_log('firebase ai usage fetch failed: ' . $error->getMessage());
            return null;
        }
    }

    $doc = firebase_ai_usage_document($usageId);
    if (!$doc || !method_exists($doc, 'snapshot')) {
        try {
            $document = firebase_firestore_rest_get_document('ai_usage', $usageId);
            return $document ? firebase_ai_usage_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $error) {
            error_log('firebase ai usage fetch failed: ' . $error->getMessage());
            return null;
        }
    }

    try {
        return firebase_ai_usage_document_to_record($doc->snapshot());
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            error_log('firebase ai usage fetch failed: ' . $error->getMessage());
            return null;
        }

        try {
            $document = firebase_firestore_rest_get_document('ai_usage', $usageId);
            return $document ? firebase_ai_usage_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $restError) {
            error_log('firebase ai usage fetch failed: ' . $restError->getMessage());
            return null;
        }
    }
}

function firebase_all_ai_usage(): array
{
    $items = [];

    if (firebase_firestore_prefer_rest()) {
        try {
            foreach (firebase_firestore_rest_list_collection('ai_usage') as $document) {
                $record = firebase_ai_usage_document_to_record(firebase_firestore_rest_snapshot($document));
                if ($record) {
                    $items[] = $record;
                }
            }
        } catch (\Throwable $error) {
            error_log('firebase ai usage query failed: ' . $error->getMessage());
            return [];
        }
    } else {
        $collection = firebase_ai_usage_collection();
        if ($collection && method_exists($collection, 'documents')) {
            try {
                foreach ($collection->documents() as $snapshot) {
                    $record = firebase_ai_usage_document_to_record($snapshot);
                    if ($record) {
                        $items[] = $record;
                    }
                }
            } catch (\Throwable $error) {
                if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
                    error_log('firebase ai usage query failed: ' . $error->getMessage());
                    return [];
                }
            }
        }

        if ($items === []) {
            try {
                foreach (firebase_firestore_rest_list_collection('ai_usage') as $document) {
                    $record = firebase_ai_usage_document_to_record(firebase_firestore_rest_snapshot($document));
                    if ($record) {
                        $items[] = $record;
                    }
                }
            } catch (\Throwable $error) {
                error_log('firebase ai usage query failed: ' . $error->getMessage());
                return [];
            }
        }
    }

    usort($items, fn($a, $b) => strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? '')));
    return array_values($items);
}

function firebase_write_credit_ledger_record(array $entry): array
{
    $entryId = trim((string) ($entry['id'] ?? ''));
    if ($entryId === '') {
        throw new RuntimeException('Credit ledger record requires an id.');
    }

    if (firebase_firestore_prefer_rest()) {
        try {
            firebase_firestore_rest_upsert_document('credit_ledger', $entryId, firebase_credit_ledger_record_to_document($entry));
            return firebase_credit_ledger_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('credit_ledger', $entryId))) ?? $entry;
        } catch (\Throwable $error) {
            throw new RuntimeException('Could not save the credit ledger record: ' . $error->getMessage());
        }
    }

    $doc = firebase_credit_ledger_document($entryId);
    if (!$doc || !method_exists($doc, 'set')) {
        try {
            firebase_firestore_rest_upsert_document('credit_ledger', $entryId, firebase_credit_ledger_record_to_document($entry));
            return firebase_credit_ledger_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('credit_ledger', $entryId))) ?? $entry;
        } catch (\Throwable $error) {
            throw new RuntimeException('Could not save the credit ledger record: ' . $error->getMessage());
        }
    }

    try {
        $doc->set(firebase_credit_ledger_record_to_document($entry));
        return firebase_credit_ledger_document_to_record($doc->snapshot()) ?? $entry;
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            throw new RuntimeException('Could not save the credit ledger record: ' . $error->getMessage());
        }

        try {
            firebase_firestore_rest_upsert_document('credit_ledger', $entryId, firebase_credit_ledger_record_to_document($entry));
            return firebase_credit_ledger_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('credit_ledger', $entryId))) ?? $entry;
        } catch (\Throwable $restError) {
            throw new RuntimeException('Could not save the credit ledger record: ' . $restError->getMessage());
        }
    }
}

function firebase_all_credit_ledger(): array
{
    $items = [];

    if (firebase_firestore_prefer_rest()) {
        try {
            foreach (firebase_firestore_rest_list_collection('credit_ledger') as $document) {
                $record = firebase_credit_ledger_document_to_record(firebase_firestore_rest_snapshot($document));
                if ($record) {
                    $items[] = $record;
                }
            }
        } catch (\Throwable $error) {
            error_log('firebase credit ledger query failed: ' . $error->getMessage());
            return [];
        }
    } else {
        $collection = firebase_credit_ledger_collection();
        if ($collection && method_exists($collection, 'documents')) {
            try {
                foreach ($collection->documents() as $snapshot) {
                    $record = firebase_credit_ledger_document_to_record($snapshot);
                    if ($record) {
                        $items[] = $record;
                    }
                }
            } catch (\Throwable $error) {
                if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
                    error_log('firebase credit ledger query failed: ' . $error->getMessage());
                    return [];
                }
            }
        }

        if ($items === []) {
            try {
                foreach (firebase_firestore_rest_list_collection('credit_ledger') as $document) {
                    $record = firebase_credit_ledger_document_to_record(firebase_firestore_rest_snapshot($document));
                    if ($record) {
                        $items[] = $record;
                    }
                }
            } catch (\Throwable $error) {
                error_log('firebase credit ledger query failed: ' . $error->getMessage());
                return [];
            }
        }
    }

    usort($items, fn($a, $b) => strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? '')));
    return array_values($items);
}

function firebase_write_user_texture_record(array $texture): array
{
    $ownerUid = trim((string) ($texture['owner_uid'] ?? ''));
    $slot = firebase_normalize_texture_slot((string) ($texture['slot'] ?? ''));
    $documentId = firebase_user_texture_document_id($ownerUid, $slot);

    if (firebase_firestore_prefer_rest()) {
        try {
            firebase_firestore_rest_upsert_document('user_textures', $documentId, firebase_user_texture_record_to_document($texture));
            return firebase_user_texture_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('user_textures', $documentId))) ?? $texture;
        } catch (\Throwable $error) {
            throw new RuntimeException('Could not save the user texture record: ' . $error->getMessage());
        }
    }

    $doc = firebase_user_texture_document($ownerUid, $slot);
    if (!$doc || !method_exists($doc, 'set')) {
        throw new RuntimeException('Firebase Firestore is not ready for user textures.');
    }

    try {
        $doc->set(firebase_user_texture_record_to_document($texture));
        return firebase_user_texture_document_to_record($doc->snapshot()) ?? $texture;
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            throw new RuntimeException('Could not save the user texture record: ' . $error->getMessage());
        }

        try {
            firebase_firestore_rest_upsert_document('user_textures', $documentId, firebase_user_texture_record_to_document($texture));
            return firebase_user_texture_document_to_record(firebase_firestore_rest_snapshot(firebase_firestore_rest_get_document('user_textures', $documentId))) ?? $texture;
        } catch (\Throwable $restError) {
            throw new RuntimeException('Could not save the user texture record: ' . $restError->getMessage());
        }
    }
}

function firebase_fetch_user_texture_record(string $ownerUid, string $slot): ?array
{
    $ownerUid = trim($ownerUid);
    if ($ownerUid === '') {
        return null;
    }
    $slot = firebase_normalize_texture_slot($slot);
    $documentId = firebase_user_texture_document_id($ownerUid, $slot);

    if (firebase_firestore_prefer_rest()) {
        try {
            $document = firebase_firestore_rest_get_document('user_textures', $documentId);
            return $document ? firebase_user_texture_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $error) {
            error_log('firebase user texture fetch failed: ' . $error->getMessage());
            return null;
        }
    }

    $doc = firebase_user_texture_document($ownerUid, $slot);
    if (!$doc || !method_exists($doc, 'snapshot')) {
        try {
            $document = firebase_firestore_rest_get_document('user_textures', $documentId);
            return $document ? firebase_user_texture_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $error) {
            error_log('firebase user texture fetch failed: ' . $error->getMessage());
            return null;
        }
    }

    try {
        return firebase_user_texture_document_to_record($doc->snapshot());
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            error_log('firebase user texture fetch failed: ' . $error->getMessage());
            return null;
        }

        try {
            $document = firebase_firestore_rest_get_document('user_textures', $documentId);
            return $document ? firebase_user_texture_document_to_record(firebase_firestore_rest_snapshot($document)) : null;
        } catch (\Throwable $restError) {
            error_log('firebase user texture fetch failed: ' . $restError->getMessage());
            return null;
        }
    }
}

function firebase_list_user_texture_records(string $ownerUid, bool $includeInactive = true): array
{
    $ownerUid = trim($ownerUid);
    if ($ownerUid === '') {
        return [];
    }

    $items = [];

    if (firebase_firestore_prefer_rest()) {
        try {
            foreach (firebase_firestore_rest_list_collection('user_textures') as $document) {
                $record = firebase_user_texture_document_to_record(firebase_firestore_rest_snapshot($document));
                if ($record && (string) ($record['owner_uid'] ?? '') === $ownerUid) {
                    $items[] = $record;
                }
            }
        } catch (\Throwable $error) {
            error_log('firebase user texture query failed: ' . $error->getMessage());
            return [];
        }
    } else {
        $collection = firebase_user_textures_collection();
        if ($collection && method_exists($collection, 'where')) {
            try {
                foreach ($collection->where('ownerUid', '=', $ownerUid)->documents() as $snapshot) {
                    $record = firebase_user_texture_document_to_record($snapshot);
                    if ($record) {
                        $items[] = $record;
                    }
                }
            } catch (\Throwable $error) {
                if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
                    error_log('firebase user texture query failed: ' . $error->getMessage());
                    return [];
                }
            }
        }

        if ($items === []) {
            try {
                foreach (firebase_firestore_rest_list_collection('user_textures') as $document) {
                    $record = firebase_user_texture_document_to_record(firebase_firestore_rest_snapshot($document));
                    if ($record && (string) ($record['owner_uid'] ?? '') === $ownerUid) {
                        $items[] = $record;
                    }
                }
            } catch (\Throwable $error) {
                error_log('firebase user texture query failed: ' . $error->getMessage());
                return [];
            }
        }
    }

    if (!$includeInactive) {
        $items = array_values(array_filter($items, static fn(array $item): bool => !empty($item['active'])));
    }

    usort($items, function (array $a, array $b): int {
        return strcmp((string) ($a['slot'] ?? ''), (string) ($b['slot'] ?? ''));
    });

    return array_values($items);
}

function firebase_delete_user_texture_record(string $ownerUid, string $slot): bool
{
    $ownerUid = trim($ownerUid);
    if ($ownerUid === '') {
        return false;
    }
    $slot = firebase_normalize_texture_slot($slot);
    $documentId = firebase_user_texture_document_id($ownerUid, $slot);

    if (firebase_firestore_prefer_rest()) {
        try {
            return firebase_firestore_rest_delete_document('user_textures', $documentId);
        } catch (\Throwable $error) {
            error_log('firebase user texture delete failed: ' . $error->getMessage());
            return false;
        }
    }

    $doc = firebase_user_texture_document($ownerUid, $slot);
    if (!$doc || !method_exists($doc, 'delete')) {
        try {
            return firebase_firestore_rest_delete_document('user_textures', $documentId);
        } catch (\Throwable $error) {
            error_log('firebase user texture delete failed: ' . $error->getMessage());
            return false;
        }
    }

    try {
        $doc->delete();
        return true;
    } catch (\Throwable $error) {
        if (!firebase_firestore_stack_overflow_message($error->getMessage())) {
            error_log('firebase user texture delete failed: ' . $error->getMessage());
            return false;
        }

        try {
            return firebase_firestore_rest_delete_document('user_textures', $documentId);
        } catch (\Throwable $restError) {
            error_log('firebase user texture delete failed: ' . $restError->getMessage());
            return false;
        }
    }
}

function firebase_user_texture_manifest(string $ownerUid): array
{
    $ownerUid = trim($ownerUid);
    $records = firebase_list_user_texture_records($ownerUid, true);
    $bySlot = [];
    foreach ($records as $record) {
        $bySlot[(string) ($record['slot'] ?? '')] = $record;
    }

    $items = [];
    for ($index = 1; $index <= 20; $index += 1) {
        $slot = 'usertexture' . $index;
        $record = $bySlot[$slot] ?? null;
        $items[] = [
            'slot' => $slot,
            'display_name' => $record['display_name'] ?? $slot,
            'active' => $record ? !empty($record['active']) : false,
            'alpha' => $record ? (float) ($record['alpha'] ?? 1.0) : 1.0,
            'width' => $record ? (int) ($record['width'] ?? 512) : 512,
            'height' => $record ? (int) ($record['height'] ?? 512) : 512,
            'source' => $record['source'] ?? '',
            'prompt' => $record['prompt'] ?? '',
            'updated_at' => $record['updated_at'] ?? null,
            'image_url' => $record && !empty($record['active']) ? app_url('api/textures.php?action=image&slot=' . rawurlencode($slot)) : null,
        ];
    }

    return $items;
}

function firebase_ai_mode_base_credits(string $mode): int
{
    return match ($mode) {
        'draft_grammar' => 4,
        'repair_grammar' => 3,
        'explain_grammar' => 2,
        'tutor_next_step' => 2,
        default => 1,
    };
}

function firebase_ai_usage_token_counts(array $usage): array
{
    $promptTokens = max(0, (int) ($usage['prompt_tokens'] ?? $usage['promptTokens'] ?? 0));
    $completionTokens = max(0, (int) ($usage['completion_tokens'] ?? $usage['completionTokens'] ?? 0));
    $totalTokens = max(0, (int) ($usage['total_tokens'] ?? $usage['totalTokens'] ?? ($promptTokens + $completionTokens)));

    return [
        'prompt_tokens' => $promptTokens,
        'completion_tokens' => $completionTokens,
        'total_tokens' => $totalTokens,
    ];
}

function firebase_ai_credit_value_usd(): float
{
    return 0.01;
}

function firebase_ai_image_model_catalog(): array
{
    return [
        'gpt-image-1.5' => [
            'label' => 'GPT Image 1.5',
            'description' => 'Latest image generation model with the strongest prompt adherence.',
            'generation_costs_usd' => [
                'low' => ['1024x1024' => 0.009, '1024x1536' => 0.013, '1536x1024' => 0.013],
                'medium' => ['1024x1024' => 0.034, '1024x1536' => 0.050, '1536x1024' => 0.050],
                'high' => ['1024x1024' => 0.133, '1024x1536' => 0.200, '1536x1024' => 0.200],
            ],
            'source' => 'https://platform.openai.com/docs/models/gpt-image-1.5',
            'updated_at' => '2026-03-29',
        ],
        'gpt-image-1' => [
            'label' => 'GPT Image 1',
            'description' => 'Previous high-fidelity image model.',
            'generation_costs_usd' => [
                'low' => ['1024x1024' => 0.011, '1024x1536' => 0.016, '1536x1024' => 0.016],
                'medium' => ['1024x1024' => 0.042, '1024x1536' => 0.063, '1536x1024' => 0.063],
                'high' => ['1024x1024' => 0.167, '1024x1536' => 0.250, '1536x1024' => 0.250],
            ],
            'source' => 'https://platform.openai.com/docs/models/gpt-image-1',
            'updated_at' => '2026-03-29',
        ],
        'gpt-image-1-mini' => [
            'label' => 'GPT Image 1 mini',
            'description' => 'Lower-cost image model for faster texture generation.',
            'generation_costs_usd' => [
                'low' => ['1024x1024' => 0.005, '1024x1536' => 0.006, '1536x1024' => 0.006],
                'medium' => ['1024x1024' => 0.011, '1024x1536' => 0.015, '1536x1024' => 0.015],
                'high' => ['1024x1024' => 0.036, '1024x1536' => 0.052, '1536x1024' => 0.052],
            ],
            'source' => 'https://platform.openai.com/docs/models/gpt-image-1-mini',
            'updated_at' => '2026-03-29',
        ],
    ];
}

function firebase_ai_model_catalog(): array
{
    return [
        'gpt-5.4' => [
            'label' => 'GPT-5.4',
            'description' => 'Most capable model for professional work.',
            'input_per_million_usd' => 2.50,
            'cached_input_per_million_usd' => 0.25,
            'output_per_million_usd' => 15.00,
            'source' => 'https://openai.com/api/pricing/',
            'updated_at' => '2026-03-29',
        ],
        'gpt-5-mini' => [
            'label' => 'GPT-5 mini',
            'description' => 'Lower-cost GPT-5 model for everyday AI help.',
            'input_per_million_usd' => 0.25,
            'cached_input_per_million_usd' => 0.025,
            'output_per_million_usd' => 2.00,
            'source' => 'https://developers.openai.com/api/docs/models/gpt-5-mini',
            'updated_at' => '2026-03-29',
        ],
        'gpt-5.4-nano' => [
            'label' => 'GPT-5.4 nano',
            'description' => 'Cheapest GPT-5.4-class model for simple requests.',
            'input_per_million_usd' => 0.20,
            'cached_input_per_million_usd' => 0.02,
            'output_per_million_usd' => 1.25,
            'source' => 'https://openai.com/api/pricing/',
            'updated_at' => '2026-03-29',
        ],
    ];
}

function firebase_default_ai_model(): string
{
    $configured = trim((string) (getenv('OPENAI_MODEL') ?: ($_ENV['OPENAI_MODEL'] ?? 'gpt-5.4')));
    $catalog = firebase_ai_model_catalog();
    return array_key_exists($configured, $catalog) ? $configured : 'gpt-5.4';
}

function firebase_default_ai_image_model(): string
{
    $configured = trim((string) (getenv('OPENAI_IMAGE_MODEL') ?: ($_ENV['OPENAI_IMAGE_MODEL'] ?? 'gpt-image-1.5')));
    $catalog = firebase_ai_image_model_catalog();
    return array_key_exists($configured, $catalog) ? $configured : 'gpt-image-1.5';
}

function firebase_normalize_ai_model(string $model): string
{
    $model = trim($model);
    $catalog = firebase_ai_model_catalog();
    return array_key_exists($model, $catalog) ? $model : firebase_default_ai_model();
}

function firebase_normalize_ai_image_model(string $model): string
{
    $model = trim($model);
    $catalog = firebase_ai_image_model_catalog();
    return array_key_exists($model, $catalog) ? $model : firebase_default_ai_image_model();
}

function firebase_user_ai_model(array $user): string
{
    return firebase_normalize_ai_model((string) ($user['ai_model_preference'] ?? firebase_default_ai_model()));
}

function firebase_user_ai_image_model(array $user): string
{
    return firebase_normalize_ai_image_model((string) ($user['ai_image_model_preference'] ?? firebase_default_ai_image_model()));
}

function firebase_ai_model_costs(string $model): array
{
    $catalog = firebase_ai_model_catalog();
    $model = firebase_normalize_ai_model($model);
    return $catalog[$model] ?? $catalog[firebase_default_ai_model()];
}

function firebase_ai_image_model_costs(string $model): array
{
    $catalog = firebase_ai_image_model_catalog();
    $model = firebase_normalize_ai_image_model($model);
    return $catalog[$model] ?? $catalog[firebase_default_ai_image_model()];
}

function firebase_ai_estimated_completion_tokens(string $mode): int
{
    return match ($mode) {
        'draft_grammar' => 1800,
        'repair_grammar' => 1000,
        'explain_grammar' => 700,
        'tutor_next_step' => 700,
        default => 600,
    };
}

function firebase_ai_cost_usd(string $model, int $promptTokens, int $completionTokens): float
{
    $pricing = firebase_ai_model_costs($model);
    $promptCost = (max(0, $promptTokens) / 1000000) * (float) ($pricing['input_per_million_usd'] ?? 0.0);
    $completionCost = (max(0, $completionTokens) / 1000000) * (float) ($pricing['output_per_million_usd'] ?? 0.0);
    return max(0.0, $promptCost + $completionCost);
}

function firebase_ai_cost_to_credits(float $usdCost): int
{
    return max(1, (int) ceil($usdCost / firebase_ai_credit_value_usd()));
}

function firebase_ai_image_generation_cost_usd(string $model, string $quality = 'medium', string $size = '1024x1024'): float
{
    $pricing = firebase_ai_image_model_costs($model);
    $quality = strtolower(trim($quality));
    $size = trim($size);
    $costs = is_array($pricing['generation_costs_usd'] ?? null) ? $pricing['generation_costs_usd'] : [];
    $qualityCosts = is_array($costs[$quality] ?? null) ? $costs[$quality] : [];
    if (isset($qualityCosts[$size])) {
        return max(0.0, (float) $qualityCosts[$size]);
    }

    $defaultPricing = firebase_ai_image_model_costs(firebase_default_ai_image_model());
    return max(0.0, (float) ($defaultPricing['generation_costs_usd']['medium']['1024x1024'] ?? 0.034));
}

function firebase_ai_image_generation_credits(string $model, string $quality = 'medium', string $size = '1024x1024'): int
{
    return firebase_ai_cost_to_credits(firebase_ai_image_generation_cost_usd($model, $quality, $size));
}

function firebase_ai_estimate_credit_cost(string $model, string $mode, string $promptText, string $grammar = '', string $selection = '', string $parserError = ''): int
{
    $chars = mb_strlen($promptText) + mb_strlen($grammar) + mb_strlen($selection) + mb_strlen($parserError);
    $estimatedPromptTokens = (int) ceil($chars / 4) + 1200;
    $estimatedCompletionTokens = firebase_ai_estimated_completion_tokens($mode);
    return firebase_ai_cost_to_credits(firebase_ai_cost_usd($model, $estimatedPromptTokens, $estimatedCompletionTokens));
}

function firebase_credit_summary(array $user): array
{
    $user = normalize_user_record($user);
    $balance = max(0, (int) ($user['credit_balance'] ?? 0));
    $reserved = max(0, (int) ($user['credit_reserved'] ?? 0));

    return [
        'balance' => $balance,
        'available' => max(0, $balance - $reserved),
        'granted_lifetime' => max(0, (int) ($user['credit_granted_lifetime'] ?? 0)),
        'spent_lifetime' => max(0, (int) ($user['credit_spent_lifetime'] ?? 0)),
        'reserved' => $reserved,
        'plan' => (string) ($user['credit_plan'] ?? 'free'),
        'updated_at' => $user['credit_updated_at'] ?? null,
    ];
}

function firebase_credit_firestore()
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
        $database = is_object($firestore) && method_exists($firestore, 'database') ? $firestore->database() : null;
    } catch (\Throwable $error) {
        error_log('firebase credit firestore init failed: ' . $error->getMessage());
        $database = null;
    }

    return $database;
}

function firebase_credit_transactions_available(): bool
{
    $database = firebase_credit_firestore();
    return $database !== null && method_exists($database, 'runTransaction') && method_exists($database, 'document');
}

function firebase_credit_document(string $collection, string $documentId)
{
    $database = firebase_credit_firestore();
    $documentId = trim($documentId);
    if (!$database || !method_exists($database, 'document') || $documentId === '') {
        return null;
    }

    return $database->document(trim($collection, '/') . '/' . $documentId);
}

function firebase_run_credit_transaction(callable $callback)
{
    $database = firebase_credit_firestore();
    if (!$database || !method_exists($database, 'runTransaction')) {
        throw new RuntimeException('AI credits require Firestore transaction support. Disable REST-only credit operations and configure the Firestore SDK.');
    }

    return $database->runTransaction($callback);
}

function firebase_credit_available(array $user): int
{
    $user = normalize_user_record($user);
    return max(0, (int) ($user['credit_balance'] ?? 0) - (int) ($user['credit_reserved'] ?? 0));
}

function firebase_ai_reserve_credits(array $user, array $request): array
{
    $uid = trim((string) ($user['uid'] ?? $user['id'] ?? $user['firebase_uid'] ?? ''));
    if ($uid === '') {
        throw new RuntimeException('AI credit reservation requires an authenticated Firebase user.');
    }

    $estimatedCredits = max(1, (int) ($request['estimated_credits'] ?? 1));
    $usageId = trim((string) ($request['usage_id'] ?? firebase_generate_ai_usage_id()));
    $threadId = trim((string) ($request['thread_id'] ?? ''));
    $mode = trim((string) ($request['mode'] ?? 'active_helper_chat'));
    $model = trim((string) ($request['model'] ?? ''));
    $requestPreview = mb_substr(trim((string) ($request['request_preview'] ?? '')), 0, 280);
    $metadata = is_array($request['metadata'] ?? null) ? $request['metadata'] : [];

    return firebase_run_credit_transaction(function ($transaction) use ($uid, $estimatedCredits, $usageId, $threadId, $mode, $model, $requestPreview, $metadata) {
        $now = gmdate('c');
        $ledgerId = firebase_generate_credit_ledger_id();
        $userDoc = firebase_credit_document('users', $uid);
        $usageDoc = firebase_credit_document('ai_usage', $usageId);
        $ledgerDoc = firebase_credit_document('credit_ledger', $ledgerId);
        if (!$userDoc || !$usageDoc || !$ledgerDoc) {
            throw new RuntimeException('Could not prepare the Firestore credit documents.');
        }

        $userSnapshot = $transaction->snapshot($userDoc);
        $currentUser = firebase_user_document_to_record($userSnapshot);
        if (!$currentUser) {
            throw new RuntimeException('Could not load the AI credit owner.');
        }

        $existingUsage = firebase_ai_usage_document_to_record($transaction->snapshot($usageDoc));
        if ($existingUsage) {
            if ((string) ($existingUsage['status'] ?? '') === 'reserved' || (string) ($existingUsage['status'] ?? '') === 'completed') {
                return [
                    'user' => $currentUser,
                    'usage' => $existingUsage,
                    'estimated_credits' => (int) ($existingUsage['estimated_credits'] ?? $estimatedCredits),
                ];
            }

            throw new RuntimeException('AI usage id is already in a terminal state.');
        }

        if (firebase_credit_available($currentUser) < $estimatedCredits) {
            throw new RuntimeException('Not enough AI credits remaining for this request.');
        }

        $updatedUser = $currentUser;
        $updatedUser['credit_reserved'] = max(0, (int) ($updatedUser['credit_reserved'] ?? 0)) + $estimatedCredits;
        $updatedUser['credit_updated_at'] = $now;

        $usage = [
            'id' => $usageId,
            'owner_uid' => $uid,
            'thread_id' => $threadId,
            'mode' => $mode,
            'model' => $model,
            'status' => 'reserved',
            'prompt_tokens' => 0,
            'completion_tokens' => 0,
            'total_tokens' => 0,
            'estimated_credits' => $estimatedCredits,
            'final_credits' => 0,
            'request_preview' => $requestPreview,
            'error_message' => '',
            'created_at' => $now,
            'completed_at' => null,
            'metadata' => $metadata,
        ];

        $ledger = [
            'id' => $ledgerId,
            'owner_uid' => $uid,
            'type' => 'reservation',
            'amount' => 0,
            'balance_after' => (int) ($updatedUser['credit_balance'] ?? 0),
            'source' => 'ai_request',
            'reference_type' => 'ai_usage',
            'reference_id' => $usageId,
            'metadata' => [
                'mode' => $mode,
                'model' => $model,
                'estimated_credits' => $estimatedCredits,
                'reserved_after' => (int) ($updatedUser['credit_reserved'] ?? 0),
                'available_after' => firebase_credit_available($updatedUser),
            ],
            'created_at' => $now,
        ];

        $transaction->set($userDoc, firebase_user_record_to_document($updatedUser));
        $transaction->set($usageDoc, firebase_ai_usage_record_to_document($usage));
        $transaction->set($ledgerDoc, firebase_credit_ledger_record_to_document($ledger));

        return [
            'user' => $updatedUser,
            'usage' => $usage,
            'estimated_credits' => $estimatedCredits,
        ];
    });
}

function firebase_ai_finalize_credits(string $usageId, array $providerUsage, ?array $user = null): array
{
    $initialUsage = firebase_fetch_ai_usage_record($usageId);
    if (!$initialUsage) {
        throw new RuntimeException('AI usage reservation not found.');
    }

    $uid = trim((string) ($initialUsage['owner_uid'] ?? ($user['uid'] ?? $user['id'] ?? $user['firebase_uid'] ?? '')));
    if ($uid === '') {
        throw new RuntimeException('AI usage owner is missing.');
    }

    return firebase_run_credit_transaction(function ($transaction) use ($uid, $usageId, $providerUsage) {
        $ledgerId = firebase_generate_credit_ledger_id();
        $userDoc = firebase_credit_document('users', $uid);
        $usageDoc = firebase_credit_document('ai_usage', $usageId);
        $ledgerDoc = firebase_credit_document('credit_ledger', $ledgerId);
        if (!$userDoc || !$usageDoc || !$ledgerDoc) {
            throw new RuntimeException('Could not prepare the Firestore credit documents.');
        }

        $currentUser = firebase_user_document_to_record($transaction->snapshot($userDoc));
        $usage = firebase_ai_usage_document_to_record($transaction->snapshot($usageDoc));
        if (!$currentUser || !$usage) {
            throw new RuntimeException('AI usage reservation not found.');
        }

        $status = (string) ($usage['status'] ?? '');
        if ($status === 'completed') {
            return [
                'user' => $currentUser,
                'usage' => $usage,
                'final_credits' => (int) ($usage['final_credits'] ?? 0),
            ];
        }
        if ($status === 'refunded') {
            throw new RuntimeException('This AI usage was already released and cannot be finalized.');
        }
        if ($status !== 'reserved') {
            throw new RuntimeException('AI usage is not in a reservable state.');
        }

        $counts = firebase_ai_usage_token_counts($providerUsage);
        $finalCredits = firebase_ai_cost_to_credits(firebase_ai_cost_usd(
            (string) ($usage['model'] ?? firebase_default_ai_model()),
            $counts['prompt_tokens'],
            $counts['completion_tokens']
        ));
        $reserved = max(0, (int) ($usage['estimated_credits'] ?? 0));
        $settlementAmount = $reserved - $finalCredits;
        $now = gmdate('c');

        $reservedNow = max(0, (int) ($currentUser['credit_reserved'] ?? 0));
        if ($reservedNow < $reserved) {
            throw new RuntimeException('Reserved AI credit balance is inconsistent.');
        }
        $newBalance = max(0, (int) ($currentUser['credit_balance'] ?? 0)) + $settlementAmount;
        if ($newBalance < 0) {
            throw new RuntimeException('Not enough AI credits remaining to finalize this request.');
        }

        $updatedUser = $currentUser;
        $updatedUser['credit_balance'] = $newBalance;
        $updatedUser['credit_reserved'] = $reservedNow - $reserved;
        $updatedUser['credit_spent_lifetime'] = max(0, (int) ($updatedUser['credit_spent_lifetime'] ?? 0)) + $finalCredits;
        $updatedUser['credit_updated_at'] = $now;

        $usage['status'] = 'completed';
        $usage['prompt_tokens'] = $counts['prompt_tokens'];
        $usage['completion_tokens'] = $counts['completion_tokens'];
        $usage['total_tokens'] = $counts['total_tokens'];
        $usage['final_credits'] = $finalCredits;
        $usage['completed_at'] = $now;
        $usage['error_message'] = '';
        $usage['metadata'] = array_merge(
            is_array($usage['metadata'] ?? null) ? $usage['metadata'] : [],
            ['settlement_amount' => $settlementAmount]
        );

        $ledger = [
            'id' => $ledgerId,
            'owner_uid' => $uid,
            'type' => 'settlement',
            'amount' => $settlementAmount,
            'balance_after' => (int) ($updatedUser['credit_balance'] ?? 0),
            'source' => 'ai_request',
            'reference_type' => 'ai_usage',
            'reference_id' => $usageId,
            'metadata' => [
                'mode' => (string) ($usage['mode'] ?? ''),
                'model' => (string) ($usage['model'] ?? ''),
                'prompt_tokens' => $counts['prompt_tokens'],
                'completion_tokens' => $counts['completion_tokens'],
                'total_tokens' => $counts['total_tokens'],
                'reserved_credits' => $reserved,
                'final_credits' => $finalCredits,
            ],
            'created_at' => $now,
        ];

        $transaction->set($userDoc, firebase_user_record_to_document($updatedUser));
        $transaction->set($usageDoc, firebase_ai_usage_record_to_document($usage));
        $transaction->set($ledgerDoc, firebase_credit_ledger_record_to_document($ledger));

        return [
            'user' => $updatedUser,
            'usage' => $usage,
            'final_credits' => $finalCredits,
        ];
    });
}

function firebase_ai_finalize_fixed_credits(string $usageId, int $finalCredits, array $metadata = [], ?array $user = null): array
{
    $initialUsage = firebase_fetch_ai_usage_record($usageId);
    if (!$initialUsage) {
        throw new RuntimeException('AI usage reservation not found.');
    }

    $uid = trim((string) ($initialUsage['owner_uid'] ?? ($user['uid'] ?? $user['id'] ?? $user['firebase_uid'] ?? '')));
    if ($uid === '') {
        throw new RuntimeException('AI usage owner is missing.');
    }

    return firebase_run_credit_transaction(function ($transaction) use ($uid, $usageId, $finalCredits, $metadata) {
        $ledgerId = firebase_generate_credit_ledger_id();
        $userDoc = firebase_credit_document('users', $uid);
        $usageDoc = firebase_credit_document('ai_usage', $usageId);
        $ledgerDoc = firebase_credit_document('credit_ledger', $ledgerId);
        if (!$userDoc || !$usageDoc || !$ledgerDoc) {
            throw new RuntimeException('Could not prepare the Firestore credit documents.');
        }

        $currentUser = firebase_user_document_to_record($transaction->snapshot($userDoc));
        $usage = firebase_ai_usage_document_to_record($transaction->snapshot($usageDoc));
        if (!$currentUser || !$usage) {
            throw new RuntimeException('AI usage reservation not found.');
        }

        $status = (string) ($usage['status'] ?? '');
        if ($status === 'completed') {
            return [
                'user' => $currentUser,
                'usage' => $usage,
                'final_credits' => (int) ($usage['final_credits'] ?? 0),
            ];
        }
        if ($status === 'refunded') {
            throw new RuntimeException('This AI usage was already released and cannot be finalized.');
        }
        if ($status !== 'reserved') {
            throw new RuntimeException('AI usage is not in a reservable state.');
        }

        $finalCredits = max(1, $finalCredits);
        $reserved = max(0, (int) ($usage['estimated_credits'] ?? 0));
        $settlementAmount = $reserved - $finalCredits;
        $now = gmdate('c');

        $reservedNow = max(0, (int) ($currentUser['credit_reserved'] ?? 0));
        if ($reservedNow < $reserved) {
            throw new RuntimeException('Reserved AI credit balance is inconsistent.');
        }

        $newBalance = max(0, (int) ($currentUser['credit_balance'] ?? 0)) + $settlementAmount;
        if ($newBalance < 0) {
            throw new RuntimeException('Not enough AI credits remaining to finalize this request.');
        }

        $updatedUser = $currentUser;
        $updatedUser['credit_balance'] = $newBalance;
        $updatedUser['credit_reserved'] = $reservedNow - $reserved;
        $updatedUser['credit_spent_lifetime'] = max(0, (int) ($updatedUser['credit_spent_lifetime'] ?? 0)) + $finalCredits;
        $updatedUser['credit_updated_at'] = $now;

        $usage['status'] = 'completed';
        $usage['prompt_tokens'] = 0;
        $usage['completion_tokens'] = 0;
        $usage['total_tokens'] = 0;
        $usage['final_credits'] = $finalCredits;
        $usage['completed_at'] = $now;
        $usage['error_message'] = '';
        $usage['metadata'] = array_merge(
            is_array($usage['metadata'] ?? null) ? $usage['metadata'] : [],
            $metadata,
            ['settlement_amount' => $settlementAmount, 'billing_type' => 'fixed']
        );

        $ledger = [
            'id' => $ledgerId,
            'owner_uid' => $uid,
            'type' => 'settlement',
            'amount' => $settlementAmount,
            'balance_after' => (int) ($updatedUser['credit_balance'] ?? 0),
            'source' => 'ai_request',
            'reference_type' => 'ai_usage',
            'reference_id' => $usageId,
            'metadata' => array_merge([
                'mode' => (string) ($usage['mode'] ?? ''),
                'model' => (string) ($usage['model'] ?? ''),
                'reserved_credits' => $reserved,
                'final_credits' => $finalCredits,
                'billing_type' => 'fixed',
            ], $metadata),
            'created_at' => $now,
        ];

        $transaction->set($userDoc, firebase_user_record_to_document($updatedUser));
        $transaction->set($usageDoc, firebase_ai_usage_record_to_document($usage));
        $transaction->set($ledgerDoc, firebase_credit_ledger_record_to_document($ledger));

        return [
            'user' => $updatedUser,
            'usage' => $usage,
            'final_credits' => $finalCredits,
        ];
    });
}

function firebase_ai_release_reserved_credits(string $usageId, string $errorMessage = '', ?array $user = null): array
{
    $initialUsage = firebase_fetch_ai_usage_record($usageId);
    if (!$initialUsage) {
        throw new RuntimeException('AI usage reservation not found.');
    }

    $uid = trim((string) ($initialUsage['owner_uid'] ?? ($user['uid'] ?? $user['id'] ?? $user['firebase_uid'] ?? '')));
    if ($uid === '') {
        throw new RuntimeException('AI usage owner is missing.');
    }

    return firebase_run_credit_transaction(function ($transaction) use ($uid, $usageId, $errorMessage) {
        $ledgerId = firebase_generate_credit_ledger_id();
        $userDoc = firebase_credit_document('users', $uid);
        $usageDoc = firebase_credit_document('ai_usage', $usageId);
        $ledgerDoc = firebase_credit_document('credit_ledger', $ledgerId);
        if (!$userDoc || !$usageDoc || !$ledgerDoc) {
            throw new RuntimeException('Could not prepare the Firestore credit documents.');
        }

        $currentUser = firebase_user_document_to_record($transaction->snapshot($userDoc));
        $usage = firebase_ai_usage_document_to_record($transaction->snapshot($usageDoc));
        if (!$currentUser || !$usage) {
            throw new RuntimeException('AI usage reservation not found.');
        }

        $status = (string) ($usage['status'] ?? '');
        if ($status === 'refunded') {
            return [
                'user' => $currentUser,
                'usage' => $usage,
            ];
        }
        if ($status === 'completed') {
            return [
                'user' => $currentUser,
                'usage' => $usage,
            ];
        }
        if ($status !== 'reserved') {
            throw new RuntimeException('AI usage is not in a releasable state.');
        }

        $reserved = max(0, (int) ($usage['estimated_credits'] ?? 0));
        $now = gmdate('c');

        $reservedNow = max(0, (int) ($currentUser['credit_reserved'] ?? 0));
        if ($reservedNow < $reserved) {
            throw new RuntimeException('Reserved AI credit balance is inconsistent.');
        }

        $updatedUser = $currentUser;
        $updatedUser['credit_reserved'] = $reservedNow - $reserved;
        $updatedUser['credit_updated_at'] = $now;

        $usage['status'] = 'refunded';
        $usage['error_message'] = trim($errorMessage);
        $usage['completed_at'] = $now;
        $usage['metadata'] = array_merge(
            is_array($usage['metadata'] ?? null) ? $usage['metadata'] : [],
            ['released_reserved_credits' => $reserved]
        );

        $ledger = [
            'id' => $ledgerId,
            'owner_uid' => $uid,
            'type' => 'reservation_release',
            'amount' => 0,
            'balance_after' => (int) ($updatedUser['credit_balance'] ?? 0),
            'source' => 'failed_request',
            'reference_type' => 'ai_usage',
            'reference_id' => $usageId,
            'metadata' => [
                'error' => trim($errorMessage),
                'released_reserved_credits' => $reserved,
                'reserved_after' => (int) ($updatedUser['credit_reserved'] ?? 0),
                'available_after' => firebase_credit_available($updatedUser),
            ],
            'created_at' => $now,
        ];

        $transaction->set($userDoc, firebase_user_record_to_document($updatedUser));
        $transaction->set($usageDoc, firebase_ai_usage_record_to_document($usage));
        $transaction->set($ledgerDoc, firebase_credit_ledger_record_to_document($ledger));

        return [
            'user' => $updatedUser,
            'usage' => $usage,
        ];
    });
}

function firebase_grant_ai_credits(string $uid, int $amount, string $source = 'admin_grant', string $referenceType = 'admin_action', string $referenceId = '', array $metadata = []): array
{
    $uid = trim($uid);
    if ($uid === '') {
        throw new RuntimeException('Granting AI credits requires a user id.');
    }
    if ($amount === 0) {
        throw new RuntimeException('Grant amount must not be zero.');
    }

    return firebase_run_credit_transaction(function ($transaction) use ($uid, $amount, $source, $referenceType, $referenceId, $metadata) {
        $now = gmdate('c');
        $ledgerId = firebase_generate_credit_ledger_id();
        $userDoc = firebase_credit_document('users', $uid);
        $ledgerDoc = firebase_credit_document('credit_ledger', $ledgerId);
        if (!$userDoc || !$ledgerDoc) {
            throw new RuntimeException('Could not prepare the Firestore credit documents.');
        }

        $currentUser = firebase_user_document_to_record($transaction->snapshot($userDoc));
        if (!$currentUser) {
            throw new RuntimeException('Could not load the AI credit owner.');
        }

        $balance = max(0, (int) ($currentUser['credit_balance'] ?? 0));
        $newBalance = $balance + $amount;
        if ($newBalance < 0) {
            throw new RuntimeException('Credit adjustment would make the balance negative.');
        }

        $updatedUser = $currentUser;
        $updatedUser['credit_balance'] = $newBalance;
        if ($amount > 0) {
            $updatedUser['credit_granted_lifetime'] = max(0, (int) ($updatedUser['credit_granted_lifetime'] ?? 0)) + $amount;
        }
        $updatedUser['credit_updated_at'] = $now;

        $ledger = [
            'id' => $ledgerId,
            'owner_uid' => $uid,
            'type' => $amount > 0 ? 'grant' : 'adjustment',
            'amount' => $amount,
            'balance_after' => (int) ($updatedUser['credit_balance'] ?? 0),
            'source' => $source,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'metadata' => $metadata,
            'created_at' => $now,
        ];

        $transaction->set($userDoc, firebase_user_record_to_document($updatedUser));
        $transaction->set($ledgerDoc, firebase_credit_ledger_record_to_document($ledger));

        return $updatedUser;
    });
}

function firebase_credit_ledger_exists(string $uid, string $source, string $referenceType, string $referenceId): bool
{
    $uid = trim($uid);
    if ($uid === '' || $referenceId === '') {
        return false;
    }

    $database = firebase_credit_firestore();
    if (!$database || !method_exists($database, 'collection')) {
        return false;
    }

    try {
        $query = $database->collection('credit_ledger')
            ->where('ownerUid', '=', $uid)
            ->where('source', '=', $source)
            ->where('referenceType', '=', $referenceType)
            ->where('referenceId', '=', $referenceId);

        foreach ($query->documents() as $snapshot) {
            if ($snapshot && (!method_exists($snapshot, 'exists') || $snapshot->exists())) {
                return true;
            }
        }
    } catch (\Throwable $error) {
        error_log('firebase credit ledger lookup failed: ' . $error->getMessage());
    }

    return false;
}

function firebase_backfill_ai_credits(int $defaultCredits, bool $onlyZeroBalance = true, string $referenceId = 'initial_ai_credit_backfill_v1'): array
{
    $defaultCredits = max(0, $defaultCredits);
    $referenceId = trim($referenceId);
    $updated = 0;
    $skipped = 0;

    foreach (all_users() as $user) {
        $uid = trim((string) ($user['uid'] ?? $user['id'] ?? ''));
        if ($uid === '') {
            $skipped++;
            continue;
        }

        if ($referenceId !== '' && firebase_credit_ledger_exists($uid, 'backfill', 'backfill', $referenceId)) {
            $skipped++;
            continue;
        }

        $summary = firebase_credit_summary($user);
        $shouldGrant = $onlyZeroBalance
            ? ((int) $summary['balance'] === 0 && (int) $summary['granted_lifetime'] === 0 && (int) $summary['spent_lifetime'] === 0 && (int) $summary['reserved'] === 0)
            : true;

        if (!$shouldGrant) {
            $skipped++;
            continue;
        }

        firebase_grant_ai_credits(
            $uid,
            $defaultCredits,
            'backfill',
            'backfill',
            $referenceId,
            ['reason' => 'initial_ai_credit_backfill', 'only_zero_balance' => $onlyZeroBalance, 'user_uid' => $uid]
        );
        $updated++;
    }

    return ['updated' => $updated, 'skipped' => $skipped];
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

function firebase_load_storage_bytes(string $path): string
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

function firebase_store_storage_bytes(string $path, string $content, string $contentType = 'application/octet-stream', array $metadata = []): void
{
    $bucket = firebase_storage_bucket();
    if (!$bucket || $path === '' || !method_exists($bucket, 'upload')) {
        throw new RuntimeException('Firebase Storage bucket is not ready.');
    }

    $options = [
        'name' => $path,
        'metadata' => array_merge([
            'contentType' => $contentType,
        ], $metadata),
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

function firebase_texture_normalizer_script_path(): string
{
    return dirname(__DIR__) . '/bin/normalize_texture.py';
}

function firebase_texture_normalizer_ready(): bool
{
    return is_file(firebase_texture_normalizer_script_path()) && trim((string) shell_exec('command -v python3 2>/dev/null')) !== '';
}

function firebase_texture_normalize_upload(string $sourcePath): array
{
    $sourcePath = trim($sourcePath);
    if ($sourcePath === '' || !is_file($sourcePath)) {
        throw new RuntimeException('Uploaded texture file is missing.');
    }
    if (!firebase_texture_normalizer_ready()) {
        throw new RuntimeException('Texture normalization backend is not ready.');
    }

    $tempOutput = tempnam(sys_get_temp_dir(), 'p3d_texture_');
    if ($tempOutput === false) {
        throw new RuntimeException('Could not prepare a texture output file.');
    }

    $stderrFile = tempnam(sys_get_temp_dir(), 'p3d_texture_err_');
    if ($stderrFile === false) {
        @unlink($tempOutput);
        throw new RuntimeException('Could not prepare a texture error file.');
    }

    $command = escapeshellcmd('python3') . ' '
        . escapeshellarg(firebase_texture_normalizer_script_path()) . ' '
        . escapeshellarg($sourcePath) . ' '
        . escapeshellarg($tempOutput)
        . ' 2>' . escapeshellarg($stderrFile);

    $exitCode = 0;
    exec($command, $commandOutput, $exitCode);
    $stderr = is_file($stderrFile) ? trim((string) file_get_contents($stderrFile)) : '';
    @unlink($stderrFile);

    if ($exitCode !== 0 || !is_file($tempOutput)) {
        @unlink($tempOutput);
        throw new RuntimeException($stderr !== '' ? $stderr : 'Could not normalize the texture upload.');
    }

    $bytes = (string) file_get_contents($tempOutput);
    @unlink($tempOutput);
    if ($bytes === '') {
        throw new RuntimeException('Normalized texture output was empty.');
    }

    $decoded = json_decode($stderr, true);
    if (!is_array($decoded)) {
        $decoded = [];
    }

    return [
        'bytes' => $bytes,
        'mime_type' => 'image/png',
        'width' => max(1, (int) ($decoded['width'] ?? 512)),
        'height' => max(1, (int) ($decoded['height'] ?? 512)),
    ];
}

function firebase_texture_normalize_bytes(string $bytes, string $extension = '.png'): array
{
    if ($bytes === '') {
        throw new RuntimeException('Texture source bytes were empty.');
    }

    $tempInput = tempnam(sys_get_temp_dir(), 'p3d_texture_src_');
    if ($tempInput === false) {
        throw new RuntimeException('Could not prepare texture source file.');
    }

    $tempPath = $tempInput;
    if ($extension !== '' && !str_ends_with($tempInput, $extension)) {
        $nextPath = $tempInput . $extension;
        if (!@rename($tempInput, $nextPath)) {
            @unlink($tempInput);
            throw new RuntimeException('Could not prepare texture source file.');
        }
        $tempPath = $nextPath;
    }

    file_put_contents($tempPath, $bytes);

    try {
        return firebase_texture_normalize_upload($tempPath);
    } finally {
        @unlink($tempPath);
    }
}

function firebase_store_user_texture(string $ownerUid, string $slot, string $pngBytes): string
{
    $path = firebase_user_texture_storage_path($ownerUid, $slot);
    firebase_store_storage_bytes($path, $pngBytes, 'image/png', [
        'cacheControl' => 'private, max-age=0, no-store',
    ]);
    return $path;
}

function firebase_load_user_texture_bytes(string $ownerUid, string $slot): string
{
    return firebase_load_storage_bytes(firebase_user_texture_storage_path($ownerUid, $slot));
}

function firebase_delete_user_texture(string $ownerUid, string $slot): void
{
    firebase_delete_storage_text(firebase_user_texture_storage_path($ownerUid, $slot));
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
