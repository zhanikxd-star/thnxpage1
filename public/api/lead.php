<?php
// Принимает заявки с лендинга и создаёт сделку с контактом в amoCRM (API v4).
// PHP 7.4+, расширения curl и json. Токен лежит в конфиге вне public_html, см. README.

declare(strict_types=1);

const LEAD_MAX_BODY = 16384;
const LEAD_UNSORTED_TYPE = 1;
const LEAD_WON_STATUS = 142;
const LEAD_LOST_STATUS = 143;

const LEAD_AUDIENCE = ['parent' => 'Родитель', 'student' => 'Ученик'];
const LEAD_GRADES_CLASS = ['8 класс', '9 класс', '10 класс', '11 класс', 'Другое'];
const LEAD_ENGLISH = [
    'basic' => 'Знает основы',
    'conversation' => 'Может поддержать разговор',
    'movies' => 'Может смотреть фильмы',
    'fluent' => 'Свободно владеет',
];
const LEAD_SCHOOL_MARKS = [
    'excellent' => 'Почти все пятёрки',
    'good' => 'В основном 4 и 5',
    'average' => 'Бывают тройки',
    'below' => 'Оценки слабые',
];
const LEAD_FORMS = [
    'video' => 'Пошаговая форма перед видео',
    'consult' => 'Запись на бесплатную консультацию',
];
const LEAD_PLACEMENTS = ['page' => 'форма внизу страницы', 'popup' => 'всплывающее окно'];
const LEAD_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function lead_respond(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function lead_config(): array
{
    $candidates = [];
    $fromEnv = getenv('AMO_CONFIG');
    if ($fromEnv) $candidates[] = $fromEnv;
    $candidates[] = dirname(__DIR__, 2) . '/amocrm-config.php';
    $candidates[] = dirname(__DIR__, 3) . '/amocrm-config.php';

    $config = [];
    $configDir = null;
    foreach ($candidates as $path) {
        if (is_file($path) && is_readable($path)) {
            $loaded = require $path;
            if (is_array($loaded)) {
                $config = $loaded;
                $configDir = dirname($path);
            }
            break;
        }
    }

    $env = [
        'subdomain' => getenv('AMO_SUBDOMAIN'),
        'token' => getenv('AMO_TOKEN'),
        'pipeline_id' => getenv('AMO_PIPELINE_ID'),
        'status_id' => getenv('AMO_STATUS_ID'),
        'responsible_user_id' => getenv('AMO_RESPONSIBLE_USER_ID'),
    ];
    foreach ($env as $key => $value) {
        if ($value !== false && $value !== '' && !isset($config[$key])) $config[$key] = $value;
    }

    $config += [
        'subdomain' => '',
        'token' => '',
        'base_url' => '',
        'pipeline_name' => 'ПС (МЕНЕДЖЕРЫ)',
        'pipeline_id' => null,
        'status_id' => null,
        'responsible_user_id' => null,
        'tag' => 'VSL',
        'lead_name_prefix' => 'VSL',
        'timezone' => 'Asia/Almaty',
        'storage_dir' => $configDir ? $configDir . '/vls-lead-data' : sys_get_temp_dir() . '/vls-lead-data',
        'rate_limit' => 5,
        'rate_window' => 600,
        'allowed_origins' => [],
    ];
    if ($config['base_url'] === '' && $config['subdomain'] !== '') {
        $config['base_url'] = 'https://' . $config['subdomain'] . '.amocrm.ru';
    }
    $config['base_url'] = rtrim((string) $config['base_url'], '/');
    return $config;
}

function lead_storage(array $config): ?string
{
    $dir = (string) $config['storage_dir'];
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return null;
    return is_writable($dir) ? $dir : null;
}

function lead_rate_limited(array $config, ?string $storage): bool
{
    $limit = (int) $config['rate_limit'];
    if ($limit <= 0 || $storage === null) return false;
    $window = max(1, (int) $config['rate_window']);
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $storage . '/rate-limit.json';
    $handle = @fopen($file, 'c+');
    if (!$handle) return false;
    flock($handle, LOCK_EX);
    $raw = stream_get_contents($handle);
    $hits = $raw ? json_decode($raw, true) : [];
    if (!is_array($hits)) $hits = [];
    $now = time();
    foreach ($hits as $key => $times) {
        $hits[$key] = array_values(array_filter((array) $times, function ($t) use ($now, $window) {
            return $now - (int) $t < $window;
        }));
        if (!$hits[$key]) unset($hits[$key]);
    }
    $key = hash('sha256', $ip);
    $limited = count($hits[$key] ?? []) >= $limit;
    if (!$limited) $hits[$key][] = $now;
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($hits));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $limited;
}

function lead_origin_allowed(array $config): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return true;
    $allowed = (array) $config['allowed_origins'];
    if ($allowed) return in_array(rtrim($origin, '/'), array_map(function ($o) { return rtrim((string) $o, '/'); }, $allowed), true);
    $host = parse_url($origin, PHP_URL_HOST);
    $self = preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
    return $host !== null && strcasecmp((string) $host, (string) $self) === 0;
}

function lead_text($value, int $max): string
{
    if (!is_string($value)) return '';
    $value = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value);
    if ($value === null) return '';
    $value = trim(preg_replace('/\s+/u', ' ', $value));
    if (function_exists('mb_substr')) return mb_substr($value, 0, $max, 'UTF-8');
    return substr($value, 0, $max);
}

function lead_validate(array $input): array
{
    $errors = [];
    $form = lead_text($input['form'] ?? '', 20);
    if (!isset(LEAD_FORMS[$form])) $errors['form'] = 'unknown';

    $name = lead_text($input['name'] ?? '', 150);
    if ($name === '') $errors['name'] = 'required';

    $phone = lead_text($input['phone'] ?? '', 40);
    $digits = preg_replace('/\D/', '', $phone);
    if ($phone === '' || !preg_match('/^[0-9+()\-\s.]+$/', $phone) || strlen($digits) < 6 || strlen($digits) > 20) {
        $errors['phone'] = 'invalid';
    }

    $pick = function (string $key, array $allowed) use ($input, &$errors): string {
        $value = lead_text($input[$key] ?? '', 40);
        if ($value === '') return '';
        if (!in_array($value, $allowed, true)) $errors[$key] = 'unknown';
        return $value;
    };
    $audience = $pick('audience', array_keys(LEAD_AUDIENCE));
    $grade = $pick('grade', LEAD_GRADES_CLASS);
    $english = $pick('english', array_keys(LEAD_ENGLISH));
    $grades = $pick('grades', array_keys(LEAD_SCHOOL_MARKS));
    $placement = $pick('placement', array_keys(LEAD_PLACEMENTS));
    if ($form === 'video' && $audience === '') $errors['audience'] = 'required';

    $page = lead_text($input['page'] ?? '', 500);
    if ($page !== '' && !preg_match('#^https?://#i', $page)) $page = '';
    $referrer = lead_text($input['referrer'] ?? '', 500);
    if ($referrer !== '' && !preg_match('#^https?://#i', $referrer)) $referrer = '';

    $utm = [];
    $rawUtm = is_array($input['utm'] ?? null) ? $input['utm'] : [];
    foreach (LEAD_UTM_KEYS as $key) {
        $value = lead_text($rawUtm[$key] ?? '', 200);
        if ($value !== '') $utm[$key] = $value;
    }

    return [$errors, compact('form', 'name', 'phone', 'audience', 'grade', 'english', 'grades', 'placement', 'page', 'referrer', 'utm')];
}

function lead_note(array $lead, array $config): string
{
    try {
        $now = new DateTime('now', new DateTimeZone((string) $config['timezone']));
    } catch (Exception $error) {
        $now = new DateTime('now');
    }
    $formLabel = LEAD_FORMS[$lead['form']];
    if ($lead['placement'] !== '') $formLabel .= ' (' . LEAD_PLACEMENTS[$lead['placement']] . ')';

    $lines = ['Заявка с лендинга VSL', 'Форма: ' . $formLabel];
    if ($lead['audience'] !== '') $lines[] = 'Кто заполнил: ' . LEAD_AUDIENCE[$lead['audience']];
    if ($lead['grade'] !== '') $lines[] = 'Класс: ' . $lead['grade'];
    if ($lead['english'] !== '') $lines[] = 'Английский: ' . LEAD_ENGLISH[$lead['english']];
    if ($lead['grades'] !== '') $lines[] = 'Оценки в школе: ' . LEAD_SCHOOL_MARKS[$lead['grades']];
    if ($lead['page'] !== '') $lines[] = 'Страница: ' . $lead['page'];
    if ($lead['referrer'] !== '') $lines[] = 'Откуда пришёл: ' . $lead['referrer'];
    foreach ($lead['utm'] as $key => $value) $lines[] = $key . ': ' . $value;
    $lines[] = 'Отправлено: ' . $now->format('d.m.Y H:i') . ' (UTC' . $now->format('P') . ')';
    return implode("\n", $lines);
}

function lead_amo(array $config, string $method, string $path, ?array $body = null): array
{
    $attempt = 0;
    while (true) {
        $curl = curl_init($config['base_url'] . $path);
        $headers = ['Authorization: Bearer ' . $config['token'], 'Accept: application/json'];
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_USERAGENT => 'impact-vsl-landing/1.0',
        ];
        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            $options[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
        }
        $options[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($curl, $options);
        $raw = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);
        curl_close($curl);

        if ($status === 429 && $attempt === 0) {
            $attempt++;
            sleep(1);
            continue;
        }
        if ($raw === false) throw new RuntimeException('amoCRM недоступна: ' . $error);
        $data = $raw === '' ? [] : json_decode((string) $raw, true);
        if ($status < 200 || $status >= 300) {
            throw new RuntimeException('amoCRM ответила ' . $status . ' на ' . $method . ' ' . $path . ': ' . substr((string) $raw, 0, 500));
        }
        return is_array($data) ? $data : [];
    }
}

function lead_same_name(string $a, string $b): bool
{
    $clean = function (string $s): string {
        $s = trim(preg_replace('/\s+/u', ' ', $s));
        return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : $s;
    };
    return $clean($a) === $clean($b);
}

function lead_first_stage(array $pipeline): ?int
{
    $statuses = $pipeline['_embedded']['statuses'] ?? [];
    usort($statuses, function ($a, $b) {
        return ((int) ($a['sort'] ?? 0)) <=> ((int) ($b['sort'] ?? 0));
    });
    foreach ($statuses as $status) {
        $id = (int) ($status['id'] ?? 0);
        if ((int) ($status['type'] ?? 0) === LEAD_UNSORTED_TYPE) continue;
        if ($id === LEAD_WON_STATUS || $id === LEAD_LOST_STATUS || $id === 0) continue;
        return $id;
    }
    return null;
}

function lead_target(array $config, ?string $storage): array
{
    $pipelineId = (int) ($config['pipeline_id'] ?? 0);
    $statusId = (int) ($config['status_id'] ?? 0);
    if ($pipelineId && $statusId) return [$pipelineId, $statusId];

    $cacheKey = $pipelineId ? 'id:' . $pipelineId : 'name:' . $config['pipeline_name'];
    $cacheFile = $storage ? $storage . '/pipeline-cache.json' : null;
    if ($cacheFile && is_file($cacheFile)) {
        $cached = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($cached) && ($cached['key'] ?? '') === $cacheKey && time() - (int) ($cached['at'] ?? 0) < 21600) {
            return [(int) $cached['pipeline_id'], $statusId ?: (int) $cached['status_id']];
        }
    }

    $data = lead_amo($config, 'GET', '/api/v4/leads/pipelines');
    $found = null;
    foreach ($data['_embedded']['pipelines'] ?? [] as $pipeline) {
        $matches = $pipelineId ? (int) $pipeline['id'] === $pipelineId : lead_same_name((string) ($pipeline['name'] ?? ''), (string) $config['pipeline_name']);
        if ($matches) {
            $found = $pipeline;
            break;
        }
    }
    if (!$found) throw new RuntimeException('Воронка «' . $config['pipeline_name'] . '» не найдена в amoCRM');
    $firstStage = lead_first_stage($found);
    if (!$firstStage) throw new RuntimeException('В воронке «' . ($found['name'] ?? '') . '» нет этапа после «Неразобранного»');

    if ($cacheFile) {
        @file_put_contents($cacheFile, json_encode(['key' => $cacheKey, 'at' => time(), 'pipeline_id' => (int) $found['id'], 'status_id' => $firstStage]), LOCK_EX);
    }
    return [(int) $found['id'], $statusId ?: $firstStage];
}

function lead_save_failed(?string $storage, array $lead, string $reason, string $timezone): void
{
    error_log('[vsl-lead] ' . $reason);
    if ($storage === null) return;
    try {
        $at = (new DateTime('now', new DateTimeZone($timezone)))->format('c');
    } catch (Exception $error) {
        $at = date('c');
    }
    $row = ['at' => $at, 'reason' => $reason, 'lead' => $lead];
    @file_put_contents($storage . '/failed-leads.log', json_encode($row, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    lead_respond(405, ['ok' => false, 'error' => 'method']);
}

$config = lead_config();
if (!lead_origin_allowed($config)) lead_respond(403, ['ok' => false, 'error' => 'origin']);

$raw = file_get_contents('php://input', false, null, 0, LEAD_MAX_BODY + 1);
if ($raw === false || strlen($raw) > LEAD_MAX_BODY) lead_respond(413, ['ok' => false, 'error' => 'too_large']);
$input = json_decode($raw, true);
if (!is_array($input)) $input = $_POST;
if (!is_array($input) || !$input) lead_respond(400, ['ok' => false, 'error' => 'bad_request']);

if (lead_text($input['website'] ?? '', 200) !== '') lead_respond(200, ['ok' => true]);

[$errors, $lead] = lead_validate($input);
if ($errors) lead_respond(422, ['ok' => false, 'error' => 'validation', 'fields' => $errors]);

$storage = lead_storage($config);
if (lead_rate_limited($config, $storage)) lead_respond(429, ['ok' => false, 'error' => 'rate_limited']);

if ($config['base_url'] === '' || $config['token'] === '') {
    lead_save_failed($storage, $lead, 'Нет subdomain или token в конфиге amoCRM', (string) $config['timezone']);
    lead_respond(500, ['ok' => false, 'error' => 'not_configured']);
}

try {
    [$pipelineId, $statusId] = lead_target($config, $storage);

    $contact = [
        'name' => $lead['name'],
        'custom_fields_values' => [[
            'field_code' => 'PHONE',
            'values' => [['value' => $lead['phone'], 'enum_code' => 'WORK']],
        ]],
    ];
    $deal = [
        'name' => trim($config['lead_name_prefix'] . ': ' . $lead['name']),
        'pipeline_id' => $pipelineId,
        'status_id' => $statusId,
        '_embedded' => [
            'tags' => [['name' => (string) $config['tag']]],
            'contacts' => [$contact],
        ],
    ];
    $responsible = (int) ($config['responsible_user_id'] ?? 0);
    if ($responsible) {
        $deal['responsible_user_id'] = $responsible;
        $deal['_embedded']['contacts'][0]['responsible_user_id'] = $responsible;
    }

    $created = lead_amo($config, 'POST', '/api/v4/leads/complex', [$deal]);
    $leadId = (int) ($created[0]['id'] ?? 0);
    if (!$leadId) throw new RuntimeException('amoCRM не вернула id сделки');
} catch (Throwable $error) {
    lead_save_failed($storage, $lead, $error->getMessage(), (string) $config['timezone']);
    lead_respond(502, ['ok' => false, 'error' => 'crm']);
}

try {
    lead_amo($config, 'POST', '/api/v4/leads/' . $leadId . '/notes', [[
        'note_type' => 'common',
        'params' => ['text' => lead_note($lead, $config)],
    ]]);
} catch (Throwable $error) {
    lead_save_failed($storage, $lead + ['lead_id' => $leadId], 'Сделка создана, примечание не добавлено: ' . $error->getMessage(), (string) $config['timezone']);
}

lead_respond(200, ['ok' => true, 'lead_id' => $leadId]);
