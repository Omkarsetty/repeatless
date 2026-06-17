import express from 'express';
import cors from 'cors';
import { config, isConfigReady } from './config/env';
import authRouter from './controllers/auth';
import emailsRouter from './controllers/emails';
import chatRouter from './controllers/chat';
import newslettersRouter from './controllers/newsletters';
import { authenticateToken } from './middleware/auth';

const app = express();
const port = parseInt(config.PORT, 10) || 3001;

// Setup CORS middleware for frontend queries
app.use(cors({
  origin: '*', // For local development flexibility
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Unprotected Auth routes
app.use('/api/auth', authRouter);

// Protected application routes
app.use('/api/emails', authenticateToken, emailsRouter);
app.use('/api/chat', authenticateToken, chatRouter);
app.use('/api/newsletters', authenticateToken, newslettersRouter);

// Health check and connection statuses
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    configReady: isConfigReady(),
    timestamp: new Date()
  });
});

// Start listening
app.listen(port, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` Gmail Intelligence Platform Backend running on port ${port}`);
  console.log(` Mode: ${isConfigReady() ? 'Production (Connected)' : 'Offline (Demo Sandbox)'}`);
  console.log(`=======================================================`);
});
