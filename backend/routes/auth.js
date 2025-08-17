import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import axios from 'axios';
import jwkToPem from 'jwk-to-pem';
import { protectRoute } from '../middleware/authMiddleware.js';

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || "your_default_secret";

// Helper to verify the Microsoft ID token
async function verifyMsToken(idToken) {
  const decodedHeader = jwt.decode(idToken, { complete: true });
  const kid = decodedHeader?.header?.kid;
  if (!kid) throw new Error('Invalid token header');

  // Use the tenant ID from environment variables for a more secure endpoint
  const discoveryUrl = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/v2.0/.well-known/openid-configuration`;
  const { data: openidConfig } = await axios.get(discoveryUrl);
  const { data: jwks } = await axios.get(openidConfig.jwks_uri);
  
  const jwk = jwks.keys.find(key => key.kid === kid);
  if (!jwk) throw new Error('JWK not found for token validation');

  const pem = jwkToPem(jwk);
  

  return jwt.verify(idToken, pem, {
    algorithms: ['RS256'],
    audience: process.env.MS_CLIENT_ID, 
    issuer: `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/v2.0`
  });
}

// Common cookie settings
const cookieSettings = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 3600000, // 1 hour
};

// ✅ Traditional User Registration
router.post('/register', async (req, res) => {
  const { username, password, role, secretKey } = req.body;
  if (!username || !password || !role || secretKey !== 'TN35') {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  if (!['engineer', 'inspector'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const existingUser = await prisma.users.findUnique({ where: { username } });
  if (existingUser) return res.status(409).json({ error: 'User exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.users.create({ data: { username, password: hashedPassword, role } });

  res.json({ message: '✅ User registered!' });
});

// ✅ Traditional User Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.users.findUnique({ where: { username } });
  
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ user_id: user.user_id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: "1h" });
  res.cookie("auth_token", token, cookieSettings);
  
  res.json({ message: "✅ Login successful!", role: user.role });
});

// ✅ Logout
router.post('/logout', (req, res) => {
  res.clearCookie("auth_token", cookieSettings);
  res.json({ message: "✅ Logged out!" });
});

// ✅ Get current authenticated user
router.get('/current_user', (req, res) => {
  const token = req.cookies.auth_token;
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    res.json(decoded);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ✅ Microsoft Login
router.post('/microsoft', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token missing' });

  try {
    const verified = await verifyMsToken(token);
    const email = verified.preferred_username || verified.email;
    if (!email) return res.status(400).json({ error: 'Email not found in token' });

    let user = await prisma.users.findUnique({ where: { username: email } });

    if (!user) {
      // If the user doesn't exist in your DB, signal the frontend to complete registration
      return res.status(200).json({ newUser: true, email });
    }

    // If user exists, create your app's session token and send it back
    const appToken = jwt.sign({ user_id: user.user_id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
    res.cookie('auth_token', appToken, cookieSettings);
    res.json({ message: '✅ MS login success!', role: user.role });
  } catch (error) {
    console.error('MS Token Verification Error:', error);
    res.status(401).json({ error: 'Microsoft token verification failed' });
  }
});

// Complete Microsoft Registration Route
router.post('/register-ms', async (req, res) => {
  const { email, idToken, role, secretKey } = req.body;
  if (!email || !idToken || !role || secretKey !== 'TN35') {
    return res.status(400).json({ error: 'Invalid fields' });
  }
  if (!['engineer', 'inspector'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const verified = await verifyMsToken(idToken);
    const tokenEmail = verified.preferred_username || verified.email;
    if (tokenEmail.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: 'Email mismatch between token and form.' });
    }

    let user = await prisma.users.findUnique({ where: { username: email } });
    if (user) return res.status(409).json({ error: 'User already exists' });

    user = await prisma.users.create({
      // Microsoft-based accounts don't need a local password
      data: { username: email, password: "N/A_MS_AUTH", role },
    });

    const appToken = jwt.sign({ user_id: user.user_id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
    res.cookie("auth_token", appToken, cookieSettings);
    res.json({ message: "✅ MS user registered & logged in!", role });
  } catch (error) {
    console.error('MS Registration Error:', error);
    res.status(401).json({ error: 'Token verification failed' });
  }
});

router.post('/verify-password', protectRoute(), async (req, res) => {
    const { password } = req.body;
    const { username } = req.user; // from protectRoute middleware

    if (!password) {
        return res.status(400).json({ error: 'Password is required.' });
    }

    try {
        const user = await prisma.users.findUnique({ where: { username } });
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            // Use a generic error message for security
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        res.json({ success: true, message: 'Password verified.' });

    } catch (error) {
        console.error("Password verification error:", error);
        res.status(500).json({ error: 'Server error during password verification.' });
    }
});

export default router;


