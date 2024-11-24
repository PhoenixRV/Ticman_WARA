var express = require("express");
var router = express.Router();
const Database = require("../DatabaseService.js");
const Bcrypt = require("bcrypt");
const dbService = new Database();
const upload = require("../multer_configs/profileUploadConfig.js");

/* GET home page. */
router.get("/", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        let userid = session.user_id;
        const user = await dbService.GetUserModelById(parseInt(userid));
        res.render("profile", {
            name: session.name,
            user_id: session.user_id,
            user: (await user).toJSON(),
            profileImageUrl: user.profile_picture,
            permission: await dbService.GetPermissionOfClient(session.user_id),
            haveError: false,
            error: ""
        });
    } else {
        res.redirect("/login");
    }
});

router.post("/", async function (req, res, next) {
    try {
        let session = req.session;
        if (session.isLoggedIn) {
            let userid = session.user_id;
            const {username, name, email, password} = req.body;
            if (password.length === 0) {
                await dbService.User.update(
                    {username: username, name: name, mail: email},
                    {where: {id: userid}}
                );
            } else {
                const hashedPassword = await Bcrypt.hash(req.body.password, 12);
                await dbService.User.update(
                    {
                        username: username,
                        name: name,
                        mail: email,
                        password: hashedPassword,
                    },
                    {where: {id: userid}}
                );
            }
            session.username = username;
            session.name = name;
            res.redirect("/profile");
        } else {
            res.redirect("/login");
        }
    } catch (e) {
        console.error(e);
        throw e;
    }
});

router.post("/profile_picture/upload", (req, res) => {
    let session = req.session;
    upload(req, res, async (err) => {
        if (err) {
            return res.redirect("/profile");
        }
        try {
            const user_id = session.user_id;
            // Anhänge speichern
            if (req.file) {
                let filePath = req.file.path.replace(/\\/g, "/").replace("public/", "");
                await dbService.User.update(
                    {profile_picture: filePath},
                    {where: {id: user_id}}
                );
                res.redirect("/profile");
            }
        } catch (error) {
            console.error("Fehler beim Hochladen und Speichern der Datei:", error);
            res.redirect("/profile");
        }
    });
});

router.post("/updatePin", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const userId = req.body.userid;
        const newPin = req.body.newPin;
        const password = req.body.password;
        dbService.GetUserModelById(userId).then((user) => {
            Bcrypt.compare(password, user.password, async function (err, result) {
                if (err) {
                    let userid = session.user_id;
                    const user = await dbService.GetUserModelById(parseInt(userid));
                    res.render("profile", {
                        name: session.name,
                        user_id: session.user_id,
                        user: (await user).toJSON(),
                        profileImageUrl: user.profile_picture,
                        permission: await dbService.GetPermissionOfClient(session.user_id),
                        haveError: true,
                        error: "Unknown Error!"
                    });
                } else if (result) {
                    await dbService.User.update(
                        {userpin: newPin},
                        {where: {id: userId}}
                    );
                    res.redirect("/profile");
                } else {
                    let userid = session.user_id;
                    const user = await dbService.GetUserModelById(parseInt(userid));
                    res.render("profile", {
                        name: session.name,
                        user_id: session.user_id,
                        user: (await user).toJSON(),
                        profileImageUrl: user.profile_picture,
                        permission: await dbService.GetPermissionOfClient(session.user_id),
                        haveError: true,
                        error: "Wrong password!"
                    });
                }
            });
        });
    } else {
        res.redirect("/login");
    }
});

module.exports = router;
