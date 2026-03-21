// File: src/middleware/logger.js
const morgan = require('morgan');

// This prints logs in a professional format: [Time] "Method URL" Status - Time taken
const logger = morgan(
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms'
);

module.exports = logger;