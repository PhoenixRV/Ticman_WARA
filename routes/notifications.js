var express = require("express");
var router = express.Router();
const Bcrypt = require("bcrypt");
const Database = require("../DatabaseService.js");
const {log} = require("debug");
const dbService = new Database();

/* GET tickets listing. */

router.get("/user_notification/:userId", async function (req, res, next) {
    const userId = req.params.userId;
    const notifications = await dbService.User_Notification.findAll({where: {user_id: userId}})

    const notificationsJsonArray = notifications.map((notify) => notify.toJSON());
    res.json(notificationsJsonArray);
});
router.get("/read_notification/:notificationId", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const user = await dbService.GetUserModelById(parseInt(session.user_id));
        const notificationId = req.params.notificationId;
        const notifications = await dbService.User_Notification.findOne({where: {id: notificationId}})
        await dbService.User_Notification.update(
            {isRead: true},
            {where: {id: notifications.id}}
        );

        res.render("readNotification", {
            name: session.name,
            user_id: session.user_id,
            profileImageUrl: user.profile_picture,
            permission: await dbService.GetPermissionOfClient(session.user_id),
            notificationTitle: notifications.title,
            notificationText: notifications.notification
        });
    } else {
        res.redirect("/login");
    }
});

const parseStatus = function (status) {
    switch (status) {
        case 1:
            return "Open";
        case 2:
            return "Closed";
        case 3:
            return "In Progress";
    }
};

const parsePriority = function (priority) {
    switch (priority) {
        case 0:
            return "Low";
        case 1:
            return "Middle";
        case 2:
            return "High";
    }
};

const GetUsernameById = async function (id) {
    const user = await dbService.User.findOne({where: {id: id}});
    if (user) {
        return user.name;
    } else {
        return "Unknown";
    }
};

const GetCategoryById = async function (id) {
    const category = await dbService.Server_Categories.findOne({
        where: {id: id},
    });
    if (category) {
        return category.category;
    } else {
        return "Unknown";
    }
};

const GetDepartmentById = async function (id) {
    const department = await dbService.Server_Departments.findOne({
        where: {id: id},
    });
    if (department) {
        return department.department;
    } else {
        return "Unknown";
    }
};

module.exports = router;
