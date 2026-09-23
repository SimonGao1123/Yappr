import type { QueueUsersPool } from "../../definitions/randomChatTypes.js";
import prisma from '../prisma.js';

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
  // Interactive transaction: the row lock below must be held across every write
  // in the loop. The default 5s timeout is too tight once several pairs are
  // matched in one tick, so it is raised explicitly.
  await prisma.$transaction(async (tx) => {
    // Lock rows so no other matcher can grab them. Prisma's query API cannot
    // express FOR UPDATE, so this stays raw — and it must run on `tx`, not the
    // root client, or it would take a different connection and lock nothing.
    const userPool = await tx.$queryRaw<QueueUsersPool[]>`
      SELECT r.random_chat_user, r.user_id, u.username
      FROM RandomChatPool r JOIN Users u ON r.user_id = u.user_id
      WHERE available = TRUE
      FOR UPDATE
    `; // for means no changes can be made to table before this is completed

    for (let i = 0; i + 1 < userPool.length; i += 2) {
      const u1 = userPool[i];
      const u2 = userPool[i + 1];
      if (!u1 || !u2) {
        continue;
      }
      // create chat
      const allChat = await tx.allChats.create({
        data: {if_random: 1}
      }); // insert a random chat
      await tx.randomChats.create({
        data: {chat_id: allChat.chat_id, user_id_1: u1.user_id, user_id_2: u2.user_id}
      });
      // send beginning message
      await tx.messages.create({
        data: {
          chat_id: allChat.chat_id,
          sender_id: -1,
          message: `Start of chat with ${u1.username} and ${u2.username}`,
          random_chat: 1
        }
      });

      // mark both users unavailable
      await tx.randomChatPool.updateMany({
        where: {random_chat_user: {in: [u1.random_chat_user, u2.random_chat_user]}},
        data: {available: 0}
      });
    }
  }, {timeout: 20000, maxWait: 5000});
}
