const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../db/database');
const User = require('../models/User');

const TOKEN_ISSUER = 'the-dream-server';
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

class AuthService {
  static register(username, password) {
    const normalizedUsername = String(username || '').trim();
    const validUsername = /^[a-zA-Z0-9_ -]{3,24}$/.test(normalizedUsername);

    if (!validUsername) {
      throw Object.assign(
        new Error('Username must be 3–24 characters (letters, numbers, spaces, _ or -).'),
        { status: 400 },
      );
    }

    if (
      typeof password !== 'string' ||
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      throw Object.assign(new Error('Password must be 8–72 characters.'), { status: 400 });
    }

    const existingUser = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(normalizedUsername);

    if (existingUser) {
      throw Object.assign(new Error('That username is already taken.'), { status: 409 });
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const result = db
      .prepare('INSERT INTO users (username, password_hash, credits) VALUES (?, ?, 500)')
      .run(normalizedUsername, passwordHash);

    db.prepare(
      "INSERT INTO transactions (user_id, type, amount) VALUES (?, 'welcome_credit', 500)",
    ).run(result.lastInsertRowid);

    return AuthService.issue(result.lastInsertRowid);
  }

  static login(username, password) {
    const normalizedUsername = String(username || '').trim();
    const userRow = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(normalizedUsername);

    if (!userRow || !bcrypt.compareSync(String(password || ''), userRow.password_hash)) {
      throw Object.assign(new Error('Invalid username or password.'), { status: 401 });
    }

    return AuthService.issue(userRow.id);
  }

  static issue(userId) {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET must be set to a random string of at least 32 characters. Copy .env.example to .env and change it.',
      );
    }

    const token = jwt.sign({ sub: userId }, secret, {
      expiresIn: '7d',
      issuer: TOKEN_ISSUER,
    });
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    return {
      token,
      user: new User(userRow).toJSON(),
    };
  }

  static authenticate(token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: TOKEN_ISSUER,
      });
      const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);

      return userRow ? new User(userRow).toJSON() : null;
    } catch {
      return null;
    }
  }
}

module.exports = AuthService;
