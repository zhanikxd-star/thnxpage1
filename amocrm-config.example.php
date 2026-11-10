<?php
// Скопируйте в amocrm-config.php и положите на хостинге НАД public_html
// (рядом с ней, а не внутри). Этот файл с токеном в git не попадает.

return [
    // Поддомен аккаунта: impact.amocrm.ru → impact
    'subdomain' => 'impact',

    // Долгосрочный токен из amoCRM → Настройки → Интеграции → ваша интеграция → «Ключи и доступы».
    'token' => 'ВСТАВЬТЕ_ДОЛГОСРОЧНЫЙ_ТОКЕН',

    // Воронка ищется по названию; заявка встаёт на первый этап после «Неразобранного».
    'pipeline_name' => 'ПС (МЕНЕДЖЕРЫ)',

    // Необязательно: точные id воронки и этапа, если нужно обойти поиск по названию.
    'pipeline_id' => null,
    'status_id' => null,

    // Необязательно: id ответственного. По умолчанию — владелец токена.
    'responsible_user_id' => null,

    'tag' => 'VSL',
    'lead_name_prefix' => 'VSL',
    'timezone' => 'Asia/Almaty',

    // Не больше rate_limit заявок с одного IP за rate_window секунд.
    'rate_limit' => 5,
    'rate_window' => 600,

    // Папка для лимитов, кэша воронки и заявок, которые не дошли до amoCRM.
    // По умолчанию: vls-lead-data рядом с этим файлом.
    // 'storage_dir' => __DIR__ . '/vls-lead-data',

    // Необязательно: разрешённые адреса сайта. Пусто — только тот же домен, что у lead.php.
    // 'allowed_origins' => ['https://example.kz', 'https://www.example.kz'],
];
