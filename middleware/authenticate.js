import jwt from "jsonwebtoken";

function authenticate(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET is not configured" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload.sub) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }

    // Routes use this ID instead of trusting anything sent by the browser.
    req.user = {
      id: String(payload.sub),
      username: payload.username,
      avatarUrl: payload.avatarUrl,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired authentication token" });
  }
}

export default authenticate;
