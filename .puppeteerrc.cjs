const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to a directory inside the project
  // so that Render carries the downloaded Chrome executable to the runtime image.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
