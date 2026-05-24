/**
 * Google OAuth 2.0 Helper
 * Handles token exchange and user info retrieval
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export async function exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Token exchange failed: ${err.error_description || err.error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      idToken: data.id_token,
    };
  } catch (error) {
    console.error('Google token exchange error:', error);
    throw error;
  }
}

export async function getUserInfo(accessToken) {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const data = await response.json();
    return {
      googleId: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture,
      verified: data.verified_email,
    };
  } catch (error) {
    console.error('Google userinfo fetch error:', error);
    throw error;
  }
}

/**
 * Build Google OAuth authorization URL
 */
export function buildGoogleAuthUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline', // Request refresh token
    prompt: 'consent', // Force consent screen for refresh token
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
