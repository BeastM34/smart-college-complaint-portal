import express, { Application } from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors';
import apiRouter from './routes';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware';

const app: Application = express();

// Security & Parsing Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount Primary API Router
app.use('/api', apiRouter);

// 404 Not Found Handling
app.use(notFoundHandler);

// Centralized Error Handling
app.use(errorHandler);

export default app;
