// Bundled to public/dashboard/auth.js at deploy time (npm run build:dashboard).
// Exposes the few @netlify/identity calls the dashboard needs as window.AscAuth,
// so public/dashboard/app.js stays a plain script like the rest of the site.
import {
  getUser,
  login,
  logout,
  handleAuthCallback,
  acceptInvite,
  recoverPassword,
  requestPasswordRecovery,
  updateUser,
  AuthError,
  MissingIdentityError,
} from '@netlify/identity'

// One plain-English message for every failure the sign-in screens can show.
function explain(error) {
  if (error instanceof MissingIdentityError) return 'Sign-in isn’t switched on for this site yet.'
  if (error instanceof AuthError) {
    if (error.status === 401 || error.status === 400) return 'That email and password don’t match.'
    if (error.status === 422) return 'Use a longer password (8+ characters) and a real email.'
    if (error.status === 404) return 'That link has expired. Ask for a new one.'
    if (error.status === 429) return 'Too many tries. Wait a minute, then try again.'
    return error.message || 'Something went wrong. Try again.'
  }
  return 'Something went wrong. Check your connection and try again.'
}

window.AscAuth = {
  getUser,
  login,
  logout,
  handleAuthCallback,
  acceptInvite,
  recoverPassword,
  requestPasswordRecovery,
  updateUser,
  explain,
}
