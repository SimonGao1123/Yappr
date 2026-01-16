import type { ResultSetHeader } from "mysql2";
import type { QueueUsersPool } from "../../definitions/randomChatTypes.js";
import db from '../database.js';

export function startChatMatcher() {
  async function loop() {
    try {
      await createChat();
    } catch (err) {
      console.error("createChat failed:", err);
    } finally {
      setTimeout(loop, 5000); // wait 5s AFTER it finishes
    }
  }

  loop(); // start once (constantly loops)
}

// function that constantly runs and creates chats based on people in the queue
async function createChat() {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction(); // not permanent database queries yet

    // Lock rows so no other matcher can grab them
    const [userPool] = await conn.query<QueueUsersPool[]>(
      `
      SELECT random_chat_user, user_id
      FROM RandomChatPool
      WHERE available = TRUE
      FOR UPDATE
      `
    ); // for means no changes can be made to table before this is completed

    for (let i = 0; i + 1 < userPool.length; i += 2) {
      const u1 = userPool[i];
      const u2 = userPool[i + 1];

      // create chat
      const [chatId] = await conn.execute<ResultSetHeader>(
        'INSERT INTO AllChats (if_random) VALUES (TRUE)'
      ); // insert a random chat
      await conn.query(
        'INSERT INTO RandomChats (chat_id, user_id_1, user_id_2) VALUES (?, ?, ?)',
        [chatId.insertId, u1!.user_id, u2!.user_id]
      );

      // mark both users unavailable
      await conn.query(
        `
        UPDATE RandomChatPool
        SET available = FALSE
        WHERE random_chat_user=? OR random_chat_user=?
        `,
        [u1!.random_chat_user, u2!.random_chat_user]
      );
    }

    await conn.commit(); // commit when its all passed (makes it permenant)
  } catch (err) {
    await conn.rollback(); // if something fails rollback the changes!!!
    throw err;
  } finally {
    conn.release();
  }
}