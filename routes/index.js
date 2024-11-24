var express = require("express");
var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        res.redirect("/dashboard");
    } else {
        res.redirect("/login");
    }
});

module.exports = router;
