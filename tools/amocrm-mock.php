<?php
// Заглушка amoCRM API v4 для локальной проверки lead.php:
//   php -S 127.0.0.1:8090 tools/amocrm-mock.php
// Пишет каждый запрос в $AMO_MOCK_LOG (по умолчанию /tmp/amocrm-mock.log).
// Пока существует файл $AMO_MOCK_FAIL (по умолчанию /tmp/amocrm-mock.fail), отвечает 500;
// файл с суффиксом -notes ломает только добавление примечания.

$log = getenv('AMO_MOCK_LOG') ?: sys_get_temp_dir() . '/amocrm-mock.log';
$failFlag = getenv('AMO_MOCK_FAIL') ?: sys_get_temp_dir() . '/amocrm-mock.fail';
$token = getenv('AMO_MOCK_TOKEN') ?: 'test-token';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$body = file_get_contents('php://input');
file_put_contents($log, json_encode([
    'method' => $method,
    'path' => $path,
    'auth' => $_SERVER['HTTP_AUTHORIZATION'] ?? '',
    'body' => $body === '' ? null : json_decode($body, true),
], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND);

function reply(int $status, $data): void
{
    http_response_code($status);
    header('Content-Type: application/hal+json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['HTTP_AUTHORIZATION'] ?? '') !== 'Bearer ' . $token) reply(401, ['title' => 'Unauthorized']);
if (is_file($failFlag)) reply(500, ['title' => 'Internal Server Error']);

if ($method === 'GET' && $path === '/api/v4/leads/pipelines') {
    reply(200, ['_embedded' => ['pipelines' => [
        ['id' => 1001, 'name' => 'Основная', '_embedded' => ['statuses' => [
            ['id' => 2001, 'name' => 'Неразобранное', 'sort' => 10, 'type' => 1],
            ['id' => 2002, 'name' => 'Первичный контакт', 'sort' => 20, 'type' => 0],
        ]]],
        ['id' => 7777, 'name' => 'ПС (МЕНЕДЖЕРЫ)', '_embedded' => ['statuses' => [
            ['id' => 143, 'name' => 'Закрыто и не реализовано', 'sort' => 10000, 'type' => 0],
            ['id' => 8802, 'name' => 'Взят в работу', 'sort' => 20, 'type' => 0],
            ['id' => 8801, 'name' => 'Неразобранное', 'sort' => 10, 'type' => 1],
            ['id' => 142, 'name' => 'Успешно реализовано', 'sort' => 10000, 'type' => 0],
            ['id' => 8803, 'name' => 'Консультация назначена', 'sort' => 30, 'type' => 0],
        ]]],
    ]]]);
}

if ($method === 'POST' && $path === '/api/v4/leads/complex') {
    $leads = json_decode($body, true);
    $out = [];
    foreach ((array) $leads as $i => $lead) {
        $out[] = ['id' => 50000 + $i + random_int(1, 999), 'contact_id' => 60000 + $i, 'company_id' => null, 'request_id' => [(string) $i], 'merged' => false];
    }
    reply(200, $out);
}

if ($method === 'POST' && preg_match('#^/api/v4/leads/(\d+)/notes$#', $path, $m)) {
    if (is_file($failFlag . '-notes')) reply(500, ['title' => 'Internal Server Error']);
    reply(200, ['_embedded' => ['notes' => [['id' => 90001, 'entity_id' => (int) $m[1]]]]]);
}

reply(404, ['title' => 'Not Found', 'path' => $path]);
