import express from 'express';
import { setupApp } from '../src/main';

const server = express();
let isInitialized = false;

export default async (req: any, res: any) => {
  try {
    if (!isInitialized) {
      await setupApp(server);
      isInitialized = true;
    }
    return server(req, res);
  } catch (error) {
    console.error('Initialization error:', error);
    res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error during initialization',
      error: error.message,
      stack: error.stack,
    });
  }
};
