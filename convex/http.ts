import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/auth/google/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    const appUrl = process.env.SITE_URL || "http://localhost:3000";

    if (error || !code) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}/login?error=auth_failed`,
        },
      });
    }

    try {
      const result = await ctx.runAction(
        internal.auth.google.handleGoogleCallback,
        { code }
      );

      // Set session token as httpOnly cookie and redirect
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}${result.redirectTo}`,
          "Set-Cookie": `session_token=${result.sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24}`,
        },
      });
    } catch (e) {
      console.error("OAuth callback error:", e);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}/login?error=auth_failed`,
        },
      });
    }
  }),
});

export default http;
