const bcrypt = require('bcryptjs');
const { pool } = require('./pool');


async function addUser(username,firstName, lastName, plainPassword, roleName = 'spectator') {
  const hash = await bcrypt.hash(plainPassword, 10);
  const result = await pool.query(
    `INSERT INTO users (firstName, lastName, password, roleName)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, firstName, lastName, roleName`,
    [username,firstName, lastName, hash, roleName]
  );

  return result.rows[0];
}

// 2. Add a message
async function addMessage(content) {
  const result = await pool.query(
    `INSERT INTO messages (content)
     VALUES ($1)
     RETURNING message_id, creationDate, content`,
    [content]
  );

  return result.rows[0];
}

// 3. Delete a message
async function deleteMessage(messageId) {
  await pool.query(
    `DELETE FROM messages WHERE message_id = $1`,
    [messageId]
  );

  return { deleted: true };
}

// 4. View all message content
async function getAllMessageContent() {
  const result = await pool.query(
    `SELECT content FROM messages ORDER BY message_id ASC`
  );

  return result.rows;
}

// 5. View all message content *and date*
async function getAllMessages() {
  const result = await pool.query(
    `SELECT content, creationDate
       FROM messages
       ORDER BY creationDate DESC`
  );

  return result.rows;
}

// 6. Upgrade role (spectator → user)
async function upgradeRole(userId) {
  const result = await pool.query(
    `UPDATE users
       SET roleName = 'user'
       WHERE id = $1 AND roleName = 'spectator'
       RETURNING id,username, firstName, lastName, roleName`,
    [userId]
  );

  return result.rows[0];
}

module.exports = {
  addUser,
  addMessage,
  deleteMessage,
  getAllMessageContent,
  getAllMessages,
  upgradeRole,
};
