import { Router } from 'express';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { oauth2Client, getAuthUrl, syncGmailInbox } from '../services/gmail';
import { supabase } from '../config/db';
import { config } from '../config/env';
import { seedMockData } from '../db/seed';

const router = Router();

/**
 * GET /api/auth/google
 * Redirects user to Google OAuth consent screen
 */
router.get('/google', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth redirect, exchanges code for tokens, saves account info, and runs sync
 */
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Google Authorization code is missing.');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      config.GOOGLE_REDIRECT_URI
    );
    client.setCredentials(tokens);

    // Fetch user details
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfoResponse = await oauth2.userinfo.get();
    const email = userInfoResponse.data.email;
    const userId = userInfoResponse.data.id;

    if (!email || !userId) {
      return res.status(400).send('Google profile info is incomplete.');
    }

    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingAccount) {
      const updateData: any = {
        access_token: tokens.access_token || '',
        updated_at: new Date()
      };
      if (tokens.refresh_token) {
        updateData.refresh_token = tokens.refresh_token;
      }
      if (tokenExpiry) {
        updateData.token_expiry = tokenExpiry;
      }
      await supabase.from('accounts').update(updateData).eq('id', userId);
    } else {
      await supabase.from('accounts').insert({
        id: userId,
        email,
        access_token: tokens.access_token || '',
        refresh_token: tokens.refresh_token || '',
        token_expiry: tokenExpiry
      });
    }

    // Trigger initial background sync
    syncGmailInbox(userId).catch(err => {
      console.error(`[Initial Sync Background Error] for user ${userId}:`, err);
    });

    // Generate JWT token for dashboard auth
    const appToken = jwt.sign({ userId, email }, config.JWT_SECRET, { expiresIn: '7d' });

    // Send successful auth script which logs the user in and closes the popup window
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Success</title>
        </head>
        <body style="font-family: sans-serif; text-align: center; margin-top: 50px; background: #0b0d19; color: #fff;">
          <h2 style="color: #6366f1;">Gmail Connection Successful!</h2>
          <p>Syncing your emails in the background. You can close this window now.</p>
          <script>
            try {
              window.opener.postMessage({
                type: 'AUTH_SUCCESS',
                token: '${appToken}',
                userId: '${userId}',
                email: '${email}'
              }, '*');
            } catch (err) {
              console.error('Failed to postMessage back to app window:', err);
            }
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Google OAuth Callback Error:', err);
    res.status(500).send('Google login callback processing failed.');
  }
});

/**
 * POST /api/auth/mock-login
 * Creates a mock dashboard session seeding sandbox emails and threads
 */
router.post('/mock-login', async (req, res) => {
  const mockUserId = 'mock-user-123';
  const mockEmail = 'demo-user@repeatless.in';

  try {
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', mockUserId)
      .single();

    if (!existingAccount) {
      await supabase.from('accounts').insert({
        id: mockUserId,
        email: mockEmail,
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        last_sync_time: new Date()
      });
    }

    // Always re-seed mock emails if not present, to ensure DB is hydrated
    await seedMockData(mockUserId);

    const appToken = jwt.sign({ userId: mockUserId, email: mockEmail }, config.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token: appToken,
      userId: mockUserId,
      email: mockEmail
    });
  } catch (err) {
    console.error('Mock login processing failed:', err);
    res.status(500).json({ error: 'Failed to complete mock dashboard authorization.' });
  }
});

export default router;
