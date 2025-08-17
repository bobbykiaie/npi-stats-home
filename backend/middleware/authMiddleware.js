import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';

const SECRET_KEY = process.env.SECRET_KEY || 'f2352172c9170e139cc3e16eaee9b85f0ad88d869121fa350d3c39b4d55acdee';

export const protectRoute = (allowedRoles) => {
  return async (req, res, next) => {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      
      // --- THIS IS THE FIX ---
      // Verify that the user from the token still exists in the database.
      const user = await prisma.users.findUnique({ where: { username: decoded.username } });
      if (!user) {
        // If the user doesn't exist, clear the invalid cookie and deny access.
        res.clearCookie("auth_token");
        return res.status(401).json({ error: 'Unauthorized: User not found. Please log in again.' });
      }
      // --- END OF FIX ---

      req.user = decoded;

      if (allowedRoles && allowedRoles.length > 0) {
        if (!req.user.role || !allowedRoles.includes(req.user.role)) {
          return res.status(403).json({ error: 'Forbidden: You do not have the required permissions.' });
        }
      }
      
      next();
    } catch (error) {
      res.clearCookie("auth_token");
      res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
  };
};
