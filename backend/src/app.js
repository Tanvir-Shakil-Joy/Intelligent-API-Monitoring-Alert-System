const express = require('express');
const cors = require('cors');
const requestIdMiddleware = require('./middleware/requestId');
const requestLogger = require('./middleware/requestLogger');
const notFoundHandler = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Attach Request ID & Structured HTTP Request Logger
app.use(requestIdMiddleware);
app.use(requestLogger);

// Mount Application Routes
app.use('/api', routes);
app.use('/', routes);

// 404 Undefined Route Handler
app.use(notFoundHandler);

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
