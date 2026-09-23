-- Full schema rebuild for `chityapp`.
--
-- WHY THIS EXISTS: on 2026-09-22 the scratch DROP/TRUNCATE statements at the
-- bottom of the working DDL file were executed against the live TiDB database.
-- Every table except `AllChats` and the legacy `sessions` table was dropped.
--
-- This script is IDEMPOTENT and NON-DESTRUCTIVE. It creates only what is
-- missing and drops nothing, so it is safe to run more than once and safe to
-- re-run after a partial failure. The existing `AllChats` is left alone.
--
-- HOW TO RUN IT: the TiDB Cloud web editor executes only the statement under
-- the cursor, so pasting the whole file and pressing Run applies just the first
-- line. Either select the entire text before running, or run one section at a
-- time. To bypass the console completely, from the `yappr` directory:
--
--   DB_HOST=<host> DB_USER=<user> DB_PASSWORD='<pass>' \
--   DB_NAME=chityapp DB_PORT=4000 DB_SSL=true \
--     ./node_modules/.bin/prisma db execute \
--       --file prisma/migrations/20260922_init_schema/migration.sql
--
-- Use ./node_modules/.bin/prisma, NOT `npx prisma`: npx resolves the registry
-- `latest` tag, which is an 8.0.0-rc where `db execute` no longer exists.
-- Prisma 7's `db execute` also has no --url flag; it reads the datasource from
-- prisma.config.ts, which builds it from the DB_* vars above and appends
-- sslaccept=strict when DB_SSL=true.
--
-- Verify afterwards -- this should list 10 tables plus `sessions`:
--
--   SELECT TABLE_NAME FROM information_schema.TABLES
--   WHERE TABLE_SCHEMA = 'chityapp' ORDER BY TABLE_NAME;
--
-- ================================ SECTION 1 ================================
-- Tables. Safe to re-run.

-- CreateTable
CREATE TABLE IF NOT EXISTS `Users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(30) NOT NULL,
    `password` VARCHAR(225) NOT NULL,
    `email` VARCHAR(225) NOT NULL,
    `joined_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `description` TEXT NULL,
    `last_updated_username` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uniq_username`(`username`),
    UNIQUE INDEX `uniq_email`(`email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Friends` (
    `friend_id` INTEGER NOT NULL AUTO_INCREMENT,
    `sender_id` INTEGER NOT NULL,
    `receiver_id` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_friends_sender`(`sender_id`),
    INDEX `fk_friends_receiver`(`receiver_id`),
    PRIMARY KEY (`friend_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `AllChats` (
    `chat_id` INTEGER NOT NULL AUTO_INCREMENT,
    `if_random` TINYINT NULL DEFAULT 0,

    PRIMARY KEY (`chat_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Chats` (
    `chat_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `creator_id` INTEGER NOT NULL,
    `chat_name` VARCHAR(30) NOT NULL,

    INDEX `fk_chat_creator`(`creator_id`),
    PRIMARY KEY (`chat_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Chat_Users` (
    `chat_user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `chat_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `joined_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `last_seen_message_id` INTEGER NOT NULL DEFAULT 0,

    INDEX `fk_chat_id`(`chat_id`),
    INDEX `fk_chat_user_id`(`user_id`),
    PRIMARY KEY (`chat_user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Messages` (
    `message_id` INTEGER NOT NULL AUTO_INCREMENT,
    `chat_id` INTEGER NOT NULL,
    `sender_id` INTEGER NOT NULL,
    `message` TEXT NOT NULL,
    `sent_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted` TINYINT NULL DEFAULT 0,
    `askGemini` TINYINT NULL DEFAULT 0,
    `random_chat` TINYINT NULL DEFAULT 0,

    INDEX `fk_msgs_chat_id`(`chat_id`),
    INDEX `fk_sender_id`(`sender_id`),
    PRIMARY KEY (`message_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Settings` (
    `user_id` INTEGER NOT NULL,
    `light_mode` TINYINT NULL DEFAULT 1,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `RandomChats` (
    `chat_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `user_id_1` INTEGER NOT NULL,
    `user_id_2` INTEGER NOT NULL,

    UNIQUE INDEX `RandomChats_user_id_1_key`(`user_id_1`),
    UNIQUE INDEX `RandomChats_user_id_2_key`(`user_id_2`),
    PRIMARY KEY (`chat_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `RandomChatPool` (
    `random_chat_user` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `available` TINYINT NULL DEFAULT 1,
    `time_joined` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `RandomChatPool_user_id_key`(`user_id`),
    PRIMARY KEY (`random_chat_user`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Session` (
    `id` VARCHAR(191) NOT NULL,
    `sid` VARCHAR(191) NOT NULL,
    `data` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sid_key`(`sid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- ================================ SECTION 2 ================================
-- Required seed row. Safe to re-run.
--
-- sender_id -1 is the "server" account behind every system message (chat
-- created, user joined, start of random chat). Messages.sender_id has a foreign
-- key to Users, so without this row those inserts fail.

INSERT IGNORE INTO `Users` (`user_id`, `username`, `password`, `email`)
VALUES (-1, 'server', '0', 'TEMPLATE');

-- ================================ SECTION 3 ================================
-- Foreign keys. RUN ONCE -- re-running errors with "Duplicate foreign key
-- constraint name", which is harmless but noisy.
--
-- The four chat-ownership keys are ON DELETE CASCADE, so removing an AllChats
-- row clears the chat, its members and its messages. The routes still issue
-- explicit ordered deletes and stay correct either way.
--
-- If TiDB rejects these with "Unsupported add foreign key", skip this section.
-- The app does not depend on the constraints existing; they are integrity
-- guards, and every delete path already handles ordering itself.

-- AddForeignKey
ALTER TABLE `Friends` ADD CONSTRAINT `fk_friends_sender` FOREIGN KEY (`sender_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Friends` ADD CONSTRAINT `fk_friends_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chats` ADD CONSTRAINT `fk_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `AllChats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chats` ADD CONSTRAINT `fk_chat_creator` FOREIGN KEY (`creator_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chat_Users` ADD CONSTRAINT `fk_chat_users_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `Chats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chat_Users` ADD CONSTRAINT `fk_chat_user_id` FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Messages` ADD CONSTRAINT `fk_msgs_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `AllChats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Messages` ADD CONSTRAINT `fk_sender_id` FOREIGN KEY (`sender_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Settings` ADD CONSTRAINT `fk_settings_user_id` FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RandomChats` ADD CONSTRAINT `fk_random_chat_id` FOREIGN KEY (`chat_id`) REFERENCES `AllChats`(`chat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RandomChats` ADD CONSTRAINT `fk_random_user_1` FOREIGN KEY (`user_id_1`) REFERENCES `RandomChatPool`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RandomChats` ADD CONSTRAINT `fk_random_user_2` FOREIGN KEY (`user_id_2`) REFERENCES `RandomChatPool`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RandomChatPool` ADD CONSTRAINT `fk_random_pool_id` FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

