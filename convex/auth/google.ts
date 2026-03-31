import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const getGoogleAuthUrl = action({
  args: {},
  returns: v.string(),
  handler: async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      state,
      prompt: "consent",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },
});

export const handleGoogleCallback = internalAction({
  args: { code: v.string() },
  returns: v.object({
    sessionToken: v.string(),
    redirectTo: v.string(),
  }),
  handler: async (ctx, { code }) => {
    // 1. Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange authorization code");
    }

    const tokens = await tokenResponse.json();

    // 2. Verify ID token and extract user info
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch user info from Google");
    }

    const googleUser = await userInfoResponse.json();
    // googleUser: { sub, email, name, picture, email_verified }

    // 3. Find or create user + tenant via internal mutation
    const { userId, tenantId, role } = await ctx.runMutation(
      internal.auth.helpers.findOrCreateUser,
      {
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name || googleUser.email,
      }
    );

    // 4. Create session via internal mutation
    const sessionToken = await ctx.runMutation(
      internal.auth.helpers.createSession,
      {
        userId,
        tenantId,
        role,
        deviceInfo: "web-browser",
      }
    );

    return {
      sessionToken,
      redirectTo: "/",
    };
  },
});
