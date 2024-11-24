const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
const Database = require("./DatabaseService.js");
const MailService = require("./mailService.js");

const indexRouter = require("./routes/index.js");
const usersRouter = require("./routes/users.js");
const loginRouter = require("./routes/login.js");
const dashboardRouter = require("./routes/dashboard.js");
const ticketRouter = require("./routes/ticket.js");
const serverRouter = require("./routes/server.js");
const profileRouter = require("./routes/profile.js");
const apiRouter = require("./routes/api.js");
const notificationRouter = require("./routes/notifications.js");

const app = express();
const dbService = new Database();
const mailer = new MailService();

// Asynchronous Initialization for Database and Mail Service
(async () => {
    await dbService.connect();
    await dbService.createDefaultUserIfNotExist();
    await dbService.createDefaultPermissionsIfNotExist();
    await mailer.configureImap();
})().catch((err) => console.error("Initialization error:", err));

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Middleware setup
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(
    session({
        secret: process.env.SESSION_SECRET || "defaultSecret", // Environment variable for enhanced security
        resave: false, // Avoids saving session on every request if not modified
        saveUninitialized: false, // Prevents storing empty sessions
        cookie: {
            secure: app.get("env") === "production", // Use secure cookies in production
            httpOnly: true, // Prevents client-side JavaScript access to cookies
            maxAge: 24 * 60 * 60 * 1000, // 1 day for session expiry
        },
    })
);

// Routes setup
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/login", loginRouter);
app.use("/dashboard", dashboardRouter);
app.use("/tickets", ticketRouter);
app.use("/server", serverRouter);
app.use("/profile", profileRouter);
app.use("/api", apiRouter);
app.use("/notifications", notificationRouter);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
    next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    res.status(err.status || 500);
    res.render("error");
});

module.exports = app;