#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { startServer, cleanup } from './server/index.js';

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startServer().catch((error) => {
    console.error("Fatal error in main execution:", error);
    process.exit(1);
});