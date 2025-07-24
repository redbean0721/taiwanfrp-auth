-- 刪除舊表 (如果存在)
DROP TABLE IF EXISTS `users`;

-- 建立新表
CREATE TABLE IF NOT EXISTS `users` (
    `id` INTEGER PRIMARY KEY AUTOINCREMENT,
    `username` TEXT NOT NULL UNIQUE,
    `email` TEXT DEFAULT NULL,
    `password` TEXT NOT NULL,
    `discord_user_id` TEXT NOT NULL UNIQUE,
    -- `discord_username` TEXT NOT NULL UNIQUE,
    `create_max_proxy_count` INTEGER NOT NULL DEFAULT 5,
    `speed_limit` REAL NOT NULL DEFAULT 3096,
    `is_admin` INTEGER NOT NULL DEFAULT 0,
    `use_totp` INTEGER NOT NULL DEFAULT 0,
    `totp_secret` TEXT DEFAULT NULL,
    `created_at` INTEGER NOT NULL DEFAULT strftime('%s', 'now'),
    `updated_at` INTEGER NOT NULL DEFAULT strftime('%s', 'now')
)

-- 建立觸發器以自動更新 updated_at 欄位
DROP TRIGGER IF EXISTS `update_users_timestamp`;
CREATE TRIGGER IF NOT EXISTS `update_users_timestamp`
AFTER UPDATE ON `users`
FOR EACH ROW
BEGIN
    UPDATE `users` SET updated_at = strftime('%s', 'now') WHERE id = OLD.id;
END;
