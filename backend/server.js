import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import authRoutes from './src/routes/auth.routes.js';
import voterRoutes from './src/routes/voters.routes.js';
import boothRoutes from './src/routes/booths.routes.js';
import schemeRoutes from './src/routes/schemes.routes.js';
import analyticsRoutes from './src/routes/analytics.routes.js';
import staffRoutes from './src/routes/staff.routes.js';
import wardsRoutes from './src/routes/wards.routes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Make io available to routes if they want to emit events (e.g. voter updated live)
app.set('io', io);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/voters', voterRoutes);
app.use('/api/booths', boothRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/wards', wardsRoutes);

// Real-time sync: rooms per ward so an MLA's dashboard live-updates when
// their team edits the register from another device.
io.on('connection', (socket) => {
  socket.on('join-ward', (wardId) => {
    if (wardId) socket.join(`ward-${wardId}`);
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Booth Management API listening on http://localhost:${PORT}`);
});
