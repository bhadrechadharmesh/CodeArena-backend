import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

export const configurePassport = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';

  if (!clientId || !clientSecret) {
    console.warn('WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not defined in environment. Google OAuth will not function.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: clientId,
        clientSecret: clientSecret,
        callbackURL: callbackURL,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            // Check if user exists with the same email
            const email = profile.emails?.[0]?.value;
            if (email) {
              user = await User.findOne({ email });
            }

            if (user) {
              // Update existing user with googleId
              user.googleId = profile.id;
              if (!user.avatar) {
                user.avatar = profile.photos?.[0]?.value || '';
              }
              await user.save();
            } else {
              // Create new user
              user = await User.create({
                name: profile.displayName || profile.name?.givenName || 'Google User',
                email: email || `${profile.id}@google.com`,
                googleId: profile.id,
                avatar: profile.photos?.[0]?.value || '',
                role: 'student',
              });
            }
          }

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
