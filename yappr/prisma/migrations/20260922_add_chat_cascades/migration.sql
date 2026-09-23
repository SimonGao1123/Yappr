-- Adds ON DELETE CASCADE to the four chat-ownership foreign keys.
--
-- Once applied, deleting a row from `allchats` removes the chat, its members
-- and its messages in one statement, which is what lets the ordered multi-step
-- deletes in chatRoutes/randomChatRoutes eventually collapse.
--
-- ============================ BEFORE RUNNING ============================
--
-- 1. The constraint name on `chat_users` below is a GUESS.
--    The project DDL names the chat_id FK `fk_chat_id` on BOTH `chats` and
--    `chat_users`, which MySQL cannot accept (constraint names are unique per
--    database), so one of them is actually named something else. Confirm with:
--
--      SELECT TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME
--      FROM information_schema.KEY_COLUMN_USAGE
--      WHERE TABLE_SCHEMA = DATABASE()
--        AND REFERENCED_TABLE_NAME IS NOT NULL
--        AND COLUMN_NAME = 'chat_id';
--
--    Then substitute the real names into the DROP statements below.
--
-- 2. Check for orphans first — either of these returning > 0 will block the
--    corresponding ADD CONSTRAINT:
--
--      SELECT COUNT(*) FROM messages m
--        LEFT JOIN allchats a ON m.chat_id = a.chat_id WHERE a.chat_id IS NULL;
--      SELECT COUNT(*) FROM chat_users c
--        LEFT JOIN chats t ON c.chat_id = t.chat_id WHERE t.chat_id IS NULL;
--
-- 3. Deploy this on its own, before the application code. The code uses
--    explicit ordered deletes and is correct with or without these cascades.
--
-- =======================================================================

-- DropForeignKey
ALTER TABLE `chats` DROP FOREIGN KEY `fk_chat_id`;

-- DropForeignKey
-- VERIFY THIS NAME FIRST (see note 1 above)
ALTER TABLE `chat_users` DROP FOREIGN KEY `chat_users_chat_id_fkey`;

-- DropForeignKey
ALTER TABLE `messages` DROP FOREIGN KEY `fk_msgs_chat_id`;

-- DropForeignKey
ALTER TABLE `randomchats` DROP FOREIGN KEY `fk_random_chat_id`;

-- AddForeignKey
ALTER TABLE `chats` ADD CONSTRAINT `fk_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `allchats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_users` ADD CONSTRAINT `chat_users_chat_id_fkey` FOREIGN KEY (`chat_id`) REFERENCES `chats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `fk_msgs_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `allchats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `randomchats` ADD CONSTRAINT `fk_random_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `allchats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;
