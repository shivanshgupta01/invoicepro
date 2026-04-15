const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy    = require('passport-jwt').Strategy;
const ExtractJwt     = require('passport-jwt').ExtractJwt;
const { pool }       = require('./db');
require('dotenv').config();

// ── JWT Strategy — checks the token on protected routes ──
passport.use(new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
  },
  async (payload, done) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, first_name, last_name, email, business_name FROM users WHERE id = ? AND is_active = 1',
        [payload.id]
      );
      if (!rows.length) return done(null, false);
      return done(null, rows[0]);
    } catch (err) {
      return done(err, false);
    }
  }
));

// ── Google OAuth Strategy ──
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email      = profile.emails[0].value;
      const googleId   = profile.id;
      const firstName  = profile.name.givenName  || '';
      const lastName   = profile.name.familyName || '';
      const avatarUrl  = profile.photos?.[0]?.value || null;

      const [existing] = await pool.execute(
        'SELECT * FROM users WHERE google_id = ? OR email = ?',
        [googleId, email]
      );

      if (existing.length) {
        await pool.execute(
          'UPDATE users SET google_id = ?, avatar_url = ?, updated_at = datetime(\'now\') WHERE id = ?',
          [googleId, avatarUrl, existing[0].id]
        );
        return done(null, existing[0]);
      }

      await pool.execute(
        `INSERT INTO users (first_name, last_name, email, google_id, avatar_url, is_verified)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [firstName, lastName, email, googleId, avatarUrl]
      );

      const [newUser] = await pool.execute(
        'SELECT * FROM users WHERE email = ?', [email]
      );
      return done(null, newUser[0]);
    } catch (err) {
      return done(err, false);
    }
  }
));

module.exports = passport;
