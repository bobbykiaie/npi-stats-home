import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import apiRoutes from './routes/api.js';
import path from 'path'; // <-- Import path
import { fileURLToPath } from 'url'; // <-- Import fileURLToPath


// import aiRoutes from './routes/ai.js'; // Import AI routes if needed

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set('trust proxy', 1);

// Middleware
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    // This line will print the exact origin of every request to your backend console
    console.log('CORS Check - Incoming Origin:', origin); 

    const allowedOrigins = [
      "http://localhost:5173",
      "https://ashy-moss-0cf69b40f.6.azurestaticapps.net"
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
// Connect to database
connectDB();

// Routes
app.use('/api', apiRoutes);
// app.use('/api/ai', aiRoutes); // Use AI routes if needed

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

