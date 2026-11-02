<?php
/**
 * Дополнительные каналы для заявок и параметры защиты. Этот файл НЕ виден посетителям.
 * Основной канал — CRM Oktell, он настраивается в src/content/config.json → "lead".
 *
 * Совет по безопасности: скопируйте этот файл на уровень ВЫШЕ публичной папки сайта
 * под именем aster-li-config.php (например /home/USER/aster-li-config.php рядом с public_html) —
 * send.php подхватит его автоматически, и токены не будут лежать в публичной папке.
 *
 * Telegram (необязательно — уведомления менеджерам):
 *  1. Создайте бота у @BotFather → получите токен.
 *  2. Добавьте бота в группу менеджеров, узнайте chat_id: https://api.telegram.org/bot<ТОКЕН>/getUpdates
 */
return [
    'telegram_token'     => '',          // 123456:ABC-DEF...
    'telegram_chat_id'   => '',          // -1001234567890 (можно несколько через запятую)

    'email_to'           => '',          // sales@... (необязательно)
    'email_from'         => 'no-reply@li-aster.uz',

    'save_csv'           => true,        // копия заявок в CSV (в папке хранения, см. ниже)
    'storage_dir'        => '',          // '' = автоматически: ../aster-li-private (вне публичной папки), если можно
    'rate_limit_sec'     => 30,          // не чаще 1 заявки с одного IP за N секунд
    'global_limit_10min' => 40,          // не больше N заявок за 10 минут со всех адресов (защита CRM от флуда)
    'behind_cloudflare'  => false,       // true — только если сайт реально за Cloudflare (иначе IP можно подделать)
    'allow_http_endpoint'=> false,       // CRM только по HTTPS
];
