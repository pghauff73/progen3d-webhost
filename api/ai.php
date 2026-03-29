<?php
require __DIR__ . '/../includes/bootstrap.php';
header('Content-Type: application/json; charset=UTF-8');

function ai_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function ai_json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ai_authenticated_user_json(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }

    $bearer = firebase_extract_bearer_token();
    if ($bearer !== '') {
        $verified = firebase_verify_id_token($bearer);
        if (!$verified['ok']) {
            ai_json_response(['ok' => false, 'error' => $verified['error'], 'runtime' => $verified['runtime'] ?? null], (int) ($verified['status'] ?? 401));
        }

        if (empty($verified['identity']['emailVerified'])) {
            ai_json_response(['ok' => false, 'error' => 'Email verification is required.'], 403);
        }

        try {
            $user = sync_firebase_identity_to_local($verified['identity']);
            $_SESSION['firebase_uid'] = (string) ($user['uid'] ?? $user['id'] ?? '');
            return $user;
        } catch (Throwable $error) {
            ai_json_response(['ok' => false, 'error' => $error->getMessage()], 500);
        }
    }

    $user = current_user();
    return $user;
}

function ai_require_login_json(): array
{
    $user = ai_authenticated_user_json();
    if (!$user) {
        ai_json_response(['ok' => false, 'error' => 'Authentication required.'], 401);
    }

    return $user;
}

function ai_string_list($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $items = [];
    foreach ($value as $item) {
        $text = trim((string) $item);
        if ($text !== '') {
            $items[] = $text;
        }
    }

    return array_values($items);
}

function ai_trim_block($value, int $limit = 12000): string
{
    $text = trim((string) $value);
    if ($text === '') {
        return '';
    }

    return mb_substr($text, 0, $limit);
}

function ai_openai_request(array $payload): array
{
    if (!function_exists('curl_init')) {
        ai_json_response(['ok' => false, 'error' => 'PHP cURL is required for AI requests.'], 500);
    }

    $apiKey = getenv('OPENAI_API_KEY') ?: ($_ENV['OPENAI_API_KEY'] ?? '');
    if (!$apiKey) {
        ai_json_response(['ok' => false, 'error' => 'OPENAI_API_KEY is not configured on the server.'], 503);
    }

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    if (!$ch) {
        ai_json_response(['ok' => false, 'error' => 'Could not initialize the AI request.'], 500);
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 180,
    ]);

    $response = curl_exec($ch);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($errno) {
        ai_json_response(['ok' => false, 'error' => 'AI request failed: ' . $error], 502);
    }

    $data = json_decode((string) $response, true);
    if (!is_array($data)) {
        ai_json_response(['ok' => false, 'error' => 'AI provider returned a non-JSON response.'], 502);
    }

    if ($status >= 400) {
        $message = $data['error']['message'] ?? 'AI provider returned an error.';
        ai_json_response(['ok' => false, 'error' => $message], $status);
    }

    return $data;
}

function ai_response_schema(string $name, array $schema): array
{
    return [
        'type' => 'json_schema',
        'json_schema' => [
            'name' => $name,
            'strict' => true,
            'schema' => $schema,
        ],
    ];
}

function ai_request_structured(string $model, array $messages, string $schemaName, array $schema, float $temperature = 0.4): array
{
    $payload = [
        'model' => $model,
        'messages' => $messages,
        'temperature' => $temperature,
        'response_format' => ai_response_schema($schemaName, $schema),
    ];

    $data = ai_openai_request($payload);
    $content = $data['choices'][0]['message']['content'] ?? '';
    if (!is_string($content) || trim($content) === '') {
        ai_json_response(['ok' => false, 'error' => 'AI provider returned an empty completion.'], 502);
    }

    $result = json_decode($content, true);
    if (!is_array($result)) {
        ai_json_response(['ok' => false, 'error' => 'AI provider returned invalid structured output.'], 502);
    }

    return $result;
}

function ai_reference_text(): string
{
    static $text = null;
    if ($text !== null) {
        return $text;
    }

    $text = site_ai_reference_text();
    return $text;
}

function ai_editor_context(array $body): string
{
    $parts = [];

    $title = ai_trim_block($body['title'] ?? '', 160);
    $goal = ai_trim_block($body['prompt'] ?? '', 4000);
    $grammar = ai_trim_block($body['grammar'] ?? '', 12000);
    $selection = ai_trim_block($body['selection'] ?? '', 4000);
    $parserError = ai_trim_block($body['parserError'] ?? '', 4000);
    $question = ai_trim_block($body['question'] ?? '', 2000);
    $history = ai_string_list($body['history'] ?? []);

    if ($title !== '') {
        $parts[] = "FILE TITLE:\n{$title}";
    }
    if ($goal !== '') {
        $parts[] = "USER GOAL:\n{$goal}";
    }
    if ($question !== '') {
        $parts[] = "USER QUESTION:\n{$question}";
    }
    if ($selection !== '') {
        $parts[] = "SELECTED GRAMMAR SNIPPET:\n{$selection}";
    }
    if ($parserError !== '') {
        $parts[] = "PARSER OR RUNTIME ERROR:\n{$parserError}";
    }
    if ($grammar !== '') {
        $parts[] = "CURRENT GRAMMAR:\n{$grammar}";
    }
    if ($history !== []) {
        $parts[] = "RECENT CONVERSATION:\n- " . implode("\n- ", $history);
    }

    return implode("\n\n", $parts);
}

function ai_mode_schema(string $mode): array
{
    if ($mode === 'draft_grammar') {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'properties' => [
                'title' => ['type' => 'string'],
                'grammar' => ['type' => 'string'],
                'summary' => ['type' => 'string'],
                'motifs' => ['type' => 'array', 'items' => ['type' => 'string']],
                'next_steps' => ['type' => 'array', 'items' => ['type' => 'string']],
            ],
            'required' => ['title', 'grammar', 'summary', 'motifs', 'next_steps'],
        ];
    }

    if ($mode === 'repair_grammar') {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'properties' => [
                'title' => ['type' => 'string'],
                'grammar' => ['type' => 'string'],
                'repair_summary' => ['type' => 'string'],
                'changes' => ['type' => 'array', 'items' => ['type' => 'string']],
            ],
            'required' => ['title', 'grammar', 'repair_summary', 'changes'],
        ];
    }

    if ($mode === 'explain_grammar') {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'properties' => [
                'answer' => ['type' => 'string'],
                'observations' => ['type' => 'array', 'items' => ['type' => 'string']],
                'suggested_edits' => ['type' => 'array', 'items' => ['type' => 'string']],
            ],
            'required' => ['answer', 'observations', 'suggested_edits'],
        ];
    }

    if ($mode === 'tutor_next_step') {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'properties' => [
                'lesson' => ['type' => 'string'],
                'diagnosis' => ['type' => 'string'],
                'next_steps' => ['type' => 'array', 'items' => ['type' => 'string']],
                'practice_prompt' => ['type' => 'string'],
            ],
            'required' => ['lesson', 'diagnosis', 'next_steps', 'practice_prompt'],
        ];
    }

    return [
        'type' => 'object',
        'additionalProperties' => false,
        'properties' => [
            'answer' => ['type' => 'string'],
            'actions' => ['type' => 'array', 'items' => ['type' => 'string']],
            'warnings' => ['type' => 'array', 'items' => ['type' => 'string']],
        ],
        'required' => ['answer', 'actions', 'warnings'],
    ];
}

function ai_mode_prompts(string $mode, string $context): array
{
    $reference = ai_reference_text();

    $commonRules = <<<TXT
You are the ProGen3D AI assistant working inside the authenticated site editor.

Core rules:
- Follow the live ProGen3D grammar surface described in the supplied reference.
- Do not invent unsupported syntax or pseudocode operators.
- Prefer practical, parser-safe answers over ambitious but invalid ones.
- Keep grammar readable with explicit helper rules.
- Use only Cube, CubeX, CubeY, and CubeZ for geometry.
- When returning grammar, return grammar text only in the grammar field.
- If the user supplied an error, address that failure directly.

LIVE REFERENCE
{$reference}

EDITOR CONTEXT
{$context}
TXT;

    if ($mode === 'draft_grammar') {
        return [
            'system' => $commonRules . "\n\nGenerate one executable ProGen3D grammar draft with a concise title, a short summary, motifs, and concrete next steps.",
            'user' => "Create a fresh grammar draft that fits the goal and current editor context.",
        ];
    }

    if ($mode === 'repair_grammar') {
        return [
            'system' => $commonRules . "\n\nRepair the supplied grammar. Preserve the design intent, fix the concrete failure, and explain the main changes succinctly.",
            'user' => "Repair the current grammar and return the corrected version.",
        ];
    }

    if ($mode === 'explain_grammar') {
        return [
            'system' => $commonRules . "\n\nExplain the grammar and answer the user's question in a precise, instructional way.",
            'user' => "Explain the current grammar, focusing on the user's question and the most important structural observations.",
        ];
    }

    if ($mode === 'tutor_next_step') {
        return [
            'system' => $commonRules . "\n\nAct as a tutor. Diagnose the user's current state, teach one useful concept, and propose the next practical exercise.",
            'user' => "Teach the user the next step they should take in this grammar.",
        ];
    }

    return [
        'system' => $commonRules . "\n\nAct as an active helper in the editor. Answer directly, propose concrete actions, and call out real risks.",
        'user' => "Help with the current editor state and user request.",
    ];
}

$action = trim((string) ($_GET['action'] ?? 'generate'));

function ai_assistant_content(array $result, string $mode): string
{
    $parts = [];
    foreach (['summary', 'answer', 'repair_summary', 'lesson', 'diagnosis'] as $field) {
        $value = trim((string) ($result[$field] ?? ''));
        if ($value !== '') {
            $parts[] = $value;
        }
    }
    $grammar = trim((string) ($result['grammar'] ?? ''));
    if ($grammar !== '' && $mode !== 'explain_grammar') {
        $parts[] = $grammar;
    }

    $content = trim(implode("\n\n", $parts));
    return $content !== '' ? $content : 'AI response';
}

function ai_thread_title(array $body, array $result, string $mode): string
{
    $title = trim((string) ($result['title'] ?? ''));
    if ($title !== '') {
        return mb_substr($title, 0, 160);
    }

    $prompt = trim((string) ($body['prompt'] ?? $body['question'] ?? ''));
    if ($prompt !== '') {
        return mb_substr($prompt, 0, 160);
    }

    return ucwords(str_replace('_', ' ', $mode));
}

function ai_thread_owner_uid(array $user): string
{
    return trim((string) ($user['firebase_uid'] ?? $user['uid'] ?? $user['id'] ?? ''));
}

$readActions = ['list_threads', 'get_thread'];
if (in_array($action, $readActions, true)) {
    $user = ai_require_login_json();

    if ($action === 'list_threads') {
        ai_json_response([
            'ok' => true,
            'threads' => firebase_user_ai_threads($user),
        ]);
    }

    $threadId = trim((string) ($_GET['thread_id'] ?? ''));
    if ($threadId === '') {
        ai_json_response(['ok' => false, 'error' => 'thread_id is required.'], 422);
    }

    $thread = firebase_fetch_ai_thread_record($threadId);
    if (!$thread) {
        ai_json_response(['ok' => false, 'error' => 'AI thread not found.'], 404);
    }

    if ((string) ($thread['owner_uid'] ?? '') !== ai_thread_owner_uid($user) && normalize_user_role((string) ($user['role'] ?? 'user')) !== 'admin') {
        ai_json_response(['ok' => false, 'error' => 'AI thread not found.'], 404);
    }

    ai_json_response([
        'ok' => true,
        'thread' => $thread,
        'messages' => firebase_thread_ai_messages($threadId, $user),
    ]);
}

$body = ai_json_body();
$mode = trim((string) ($body['mode'] ?? 'active_helper_chat'));
$allowedModes = ['active_helper_chat', 'draft_grammar', 'repair_grammar', 'explain_grammar', 'tutor_next_step'];
if (!in_array($mode, $allowedModes, true)) {
    ai_json_response(['ok' => false, 'error' => 'Unsupported AI mode.'], 422);
}

$user = ai_require_login_json();
if (firebase_extract_bearer_token() === '') {
    verify_csrf();
}

$prompt = ai_trim_block($body['prompt'] ?? '', 4000);
$question = ai_trim_block($body['question'] ?? '', 2000);
$grammar = ai_trim_block($body['grammar'] ?? '', 12000);
if ($mode === 'draft_grammar' && $prompt === '') {
    ai_json_response(['ok' => false, 'error' => 'Prompt text is required for draft generation.'], 422);
}
if (in_array($mode, ['repair_grammar', 'explain_grammar', 'tutor_next_step'], true) && $grammar === '' && $prompt === '' && $question === '') {
    ai_json_response(['ok' => false, 'error' => 'Grammar or prompt context is required for this AI mode.'], 422);
}

$threadId = trim((string) ($body['thread_id'] ?? ''));
$existingThread = null;
if ($threadId !== '') {
    $existingThread = firebase_fetch_ai_thread_record($threadId);
    if (!$existingThread) {
        ai_json_response(['ok' => false, 'error' => 'AI thread not found.'], 404);
    }
    if ((string) ($existingThread['owner_uid'] ?? '') !== ai_thread_owner_uid($user) && normalize_user_role((string) ($user['role'] ?? 'user')) !== 'admin') {
        ai_json_response(['ok' => false, 'error' => 'AI thread not found.'], 404);
    }
}

$model = trim((string) (getenv('OPENAI_MODEL') ?: ($_ENV['OPENAI_MODEL'] ?? 'gpt-5.4')));
$context = ai_editor_context($body);
$prompts = ai_mode_prompts($mode, $context);
$schema = ai_mode_schema($mode);

$result = ai_request_structured(
    $model,
    [
        ['role' => 'system', 'content' => $prompts['system']],
        ['role' => 'user', 'content' => $prompts['user']],
    ],
    'progen3d_' . $mode,
    $schema,
    $mode === 'draft_grammar' ? 0.8 : 0.35
);

if (isset($result['grammar']) && is_string($result['grammar'])) {
    $result['grammar'] = trim((string) preg_replace('/^```(?:[A-Za-z0-9_-]+)?\s*|\s*```$/m', '', $result['grammar']));
}
foreach (['motifs', 'next_steps', 'changes', 'observations', 'suggested_edits', 'actions', 'warnings'] as $listField) {
    if (array_key_exists($listField, $result)) {
        $result[$listField] = ai_string_list($result[$listField]);
    }
}

$now = gmdate('c');
$ownerUid = ai_thread_owner_uid($user);
$threadId = $threadId !== '' ? $threadId : firebase_generate_ai_thread_id();
$existingMessages = firebase_thread_ai_messages($threadId, $user);
$thread = firebase_write_ai_thread_record([
    'id' => $threadId,
    'owner_uid' => $ownerUid,
    'owner_username' => (string) ($user['username'] ?? ''),
    'owner_role' => (string) ($user['role'] ?? 'user'),
    'title' => ai_thread_title($body, $result, $mode),
    'mode' => $mode,
    'file_id' => trim((string) ($body['file_id'] ?? '')),
    'file_title' => trim((string) ($body['title'] ?? '')),
    'created_at' => (string) ($existingThread['created_at'] ?? $now),
    'updated_at' => $now,
    'last_message_at' => $now,
    'last_message_preview' => mb_substr(ai_assistant_content($result, $mode), 0, 280),
    'message_count' => count($existingMessages) + 2,
]);

$userMessageText = trim((string) ($body['question'] ?? $body['prompt'] ?? ''));
if ($userMessageText === '') {
    $userMessageText = 'AI request: ' . str_replace('_', ' ', $mode);
}

firebase_write_ai_message_record([
    'id' => firebase_generate_ai_message_id(),
    'thread_id' => $threadId,
    'owner_uid' => $ownerUid,
    'role' => 'user',
    'mode' => $mode,
    'content' => $userMessageText,
    'created_at' => $now,
    'payload' => [
        'title' => trim((string) ($body['title'] ?? '')),
        'selection' => ai_trim_block($body['selection'] ?? '', 4000),
        'parserError' => ai_trim_block($body['parserError'] ?? '', 4000),
    ],
]);

firebase_write_ai_message_record([
    'id' => firebase_generate_ai_message_id(),
    'thread_id' => $threadId,
    'owner_uid' => $ownerUid,
    'role' => 'assistant',
    'mode' => $mode,
    'content' => ai_assistant_content($result, $mode),
    'created_at' => $now,
    'payload' => $result,
]);

ai_json_response([
    'ok' => true,
    'mode' => $mode,
    'model' => $model,
    'thread' => $thread,
    'messages' => firebase_thread_ai_messages($threadId, $user),
    'user' => [
        'id' => (string) ($user['uid'] ?? $user['id'] ?? ''),
        'username' => (string) ($user['username'] ?? ''),
        'role' => (string) ($user['role'] ?? 'user'),
    ],
    'result' => $result,
]);
