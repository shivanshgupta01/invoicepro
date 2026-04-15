const passport = require('passport');

const protect = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err)   return res.status(500).json({ message: 'Auth error' });
    if (!user) return res.status(401).json({ message: 'Please log in first.', code: 'UNAUTHORIZED' });
    req.user = user;
    next();
  })(req, res, next);
};

module.exports = { protect };
