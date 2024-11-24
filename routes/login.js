var express = require("express");
var router = express.Router();
const Bcrypt = require("bcrypt");
const Database = require("../DatabaseService.js");
const {log} = require("debug");
const dbService = new Database();

/* GET users listing. */
router.get("/", async function (req, res, next) {
    res.render("login", {haveError: false, error: ""});
});

router.post("/", async function (req, res, next) {
    let session = req.session;
    var username = req.body.username;
    var password = req.body.password;
    dbService.UsernameExists(username).then((result) => {
        if (!result) {
            res.render("login", {
                haveError: true,
                error: "Invalid username or password.",
            });
        } else {
            try {
                dbService.GetUserModelByUsername(username).then((user) => {
                    if (!user.isActive) {
                        res.render("login", {haveError: true, error: "Deactivated user"});
                        return;
                    }
                    Bcrypt.compare(password, user.password, function (err, result) {
                        if (err) {
                            res.render("login", {
                                haveError: true,
                                error: "Invalid username or password.",
                            });
                        } else if (result) {
                            session.isLoggedIn = true;
                            session.username = user.username;
                            session.name = user.name;
                            session.user_id = user.id;
                            res.redirect("/");
                        } else {
                            res.render("login", {
                                haveError: true,
                                error: "Invalid username or password.",
                            });
                        }
                    });
                });
            } catch (e) {
                console.error(e);
                throw e;
            }
        }
    });
});

router.get("/logout", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        session.isLoggedIn = false;
        session.username = "";
        session.name = "";
        session.user_id = "";
        res.redirect("/");
    } else {
        res.redirect("/");
    }
});

module.exports = router;
