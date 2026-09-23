-- Required by @quixo3/prisma-session-store, which replaces express-mysql-session.
--
-- Unlike express-mysql-session (createDatabaseTable: true), the Prisma session
-- store does NOT create this table at runtime. Without it, every session write
-- fails and nobody can stay logged in.
--
-- RUN THIS BEFORE DEPLOYING THE APPLICATION CODE.
--
-- Additive and safe: it does not touch the old `sessions` table. Drop that one
-- only after the deploy is confirmed healthy.

CREATE TABLE `Session` (
  `id`        VARCHAR(191) NOT NULL,
  `sid`       VARCHAR(191) NOT NULL,
  `data`      TEXT         NOT NULL,
  `expiresAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Session_sid_key` (`sid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
