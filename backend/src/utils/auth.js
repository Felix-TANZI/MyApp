const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Fonction pour exécuter des requêtes
async function query(sql, params = []) {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } finally {
    await connection.end();
  }
}

// Hacher un mot de passe
async function hashPassword(password) {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  return await bcrypt.hash(password, saltRounds);
}

// Vérifier un mot de passe
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Générer un token JWT
function generateTokens(payload) {
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
  
  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
  
  return { accessToken, refreshToken };
}

// Vérifier un token JWT
function verifyToken(token, secret = process.env.JWT_SECRET) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Token invalide ou expiré');
  }
}

// Créer une session en base
async function createSession(userId, userType, tokenHash, refreshToken, req) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24h
  
  const sessionData = {
    user_id: userType === 'user' ? userId : null,
    client_id: userType === 'client' ? userId : null,
    user_type: userType,
    token_hash: tokenHash,
    refresh_token: refreshToken,
    ip_address: req.ip || req.connection.remoteAddress,
    user_agent: req.get('User-Agent') || '',
    expires_at: expiresAt
  };
  
// Ici, il est question de retracer toutes les connexions et l'inserer dans la bd (table sessions)

  const result = await query(
    `INSERT INTO sessions (user_id, client_id, user_type, token_hash, refresh_token, 
     ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionData.user_id,
      sessionData.client_id,
      sessionData.user_type,
      sessionData.token_hash,
      sessionData.refresh_token,
      sessionData.ip_address,
      sessionData.user_agent,
      sessionData.expires_at
    ]
  );
  
  return result.insertId;
}

// Vérifier si une session existe
async function getSession(tokenHash) {
  const sessions = await query(
    'SELECT * FROM sessions WHERE token_hash = ? AND revoked = FALSE AND expires_at > NOW()',
    [tokenHash]
  );
  
  return sessions.length > 0 ? sessions[0] : null;
}

// Révoquer une session
async function revokeSession(tokenHash) {
  return await query(
    'UPDATE sessions SET revoked = TRUE WHERE token_hash = ?',
    [tokenHash]
  );
}

// Nettoyer les sessions expirées
async function cleanExpiredSessions() {
  return await query('DELETE FROM sessions WHERE expires_at < NOW() OR revoked = TRUE');
}

module.exports = {
  query,
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyToken,
  createSession,
  getSession,
  revokeSession,
  cleanExpiredSessions
};