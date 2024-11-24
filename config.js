// config.js
require("dotenv").config();

module.exports = {
  database: {
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    port: process.env.DB_PORT,
  },
  imap: {
    host: process.env.IMAP_HOST,
    port: process.env.IMAP_PORT,
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASSWORD
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD
  }
};
