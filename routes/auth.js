import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";

import authenticate from "../middleware/authenticate.js";

const router = express.Router();

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

function requireSetting(name) {
  const value = process.env[name];

  if (!value) {
    const error = new Error(`${name} is not configured`);
    error.status = 500;
    throw error;
  }

  return value;
}

router.get("/login", (req, res) => {
  const clientId = requireSetting("GITHUB_CLIENT_ID");
  const callbackUrl = requireSetting("GITHUB_CALLBACK_URL");
  const state = crypto.randomBytes(24).toString("hex");

  // The state cookie stops another site from sneaking in its own OAuth callback.
  res.cookie("oauth_state", state, {
    ...cookieOptions(),
    maxAge: 10 * 60 * 1000,
  });

  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: "read:user",
    state,
  }).toString();

  res.redirect(githubUrl.toString());
});

router.get("/auth/github/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || state !== req.cookies.oauth_state) {
    return res.status(400).json({ error: "Invalid OAuth callback" });
  }

  res.clearCookie("oauth_state", cookieOptions());

  const clientId = requireSetting("GITHUB_CLIENT_ID");
  const clientSecret = requireSetting("GITHUB_CLIENT_SECRET");
  const callbackUrl = requireSetting("GITHUB_CALLBACK_URL");
  const jwtSecret = requireSetting("JWT_SECRET");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: String(code),
      redirect_uri: callbackUrl,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.access_token) {
    const error = new Error("GitHub did not accept the OAuth code");
    error.status = 401;
    throw error;
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userResponse.ok) {
    const error = new Error("Could not load the GitHub user");
    error.status = 401;
    throw error;
  }

  const githubUser = await userResponse.json();

  // This is our app's JWT, not the GitHub access token.
  const appToken = jwt.sign(
    {
      username: githubUser.login,
      avatarUrl: githubUser.avatar_url,
    },
    jwtSecret,
    {
      subject: String(githubUser.id),
      expiresIn: "7d",
    },
  );

  res.cookie("token", appToken, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  res.redirect(`${frontendUrl}/dashboard`);
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOptions());
  res.status(204).end();
});

router.get("/api/auth/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;
