var express = require("express");
var router = express.Router();
const Bcrypt = require("bcrypt");
const Database = require("../DatabaseService.js");
const {log} = require("debug");
const dbService = new Database();

/* GET tickets listing. */

router.post("/ticboy_notifications/:userId", async function (req, res, next) {
    try {
        const userId = req.params.userId;
        const secret = req.body.secret;

        const user = await dbService.GetUserModelById(userId);
        const secretVal = userId + user.username;

        Bcrypt.compare(secretVal, secret, async function (err, result) {
            if (err) {
                res.json({});
            } else if (result) {
                const notification = await dbService.TicBoy_Notification.findOne({
                    where: {user_id: userId, isRead: false}
                });

                if (notification) {
                    const notificationJson = notification.toJSON();

                    await dbService.TicBoy_Notification.update(
                        {isRead: true},
                        {where: {id: notificationJson.id}}
                    );

                    res.json(notificationJson);
                } else {
                    res.json({});
                }
            } else {
                res.json({});
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/ticboy/claimTicket/:ticketId', async function (req, res, next) {
    try {
        const userId = req.body.userId;
        const ticketId = req.params.ticketId;
        const secret = req.params.secret;

        const user = await dbService.GetUserModelById(userId);
        const secretVal = userId + user.username;

        Bcrypt.compare(secretVal, secret, async function (err, result) {
            if (err) {
                res.json({});
            } else if (result) {
                const ticket = await dbService.Tickets.findOne({
                    where: {id: ticketId}
                });
                if (ticket) {
                    const ticketAssignment = await dbService.Ticket_Assignments.findOne({
                        where: {ticket_Id: ticketId, user_Id: userId}
                    });
                    if (!ticketAssignment) {
                        const newAssignment = await this.Ticket_Assignments.create({
                            user_id: userId,
                            ticket_Id: ticketId
                        });
                        newAssignment.save();
                        res.json({"response": 1, "message": "Successful"})
                    } else {
                        res.json({
                            "response": 2,
                            "message": "There is already a ticket assignment to this user and ticket"
                        })
                    }
                } else {
                    res.json({"response": 2, "message": "Ticket does not exist"})
                }
            } else {
                res.json({});
            }
        });
    } catch (error) {
        res.json({"response": 2, "message": error})
        next(error);
    }
});

router.post('/ticboy/authentificate', async function (req, res, next) {
    try {
        const userId = req.body.userId;
        const userPin = req.body.userPin;
        const user = await dbService.User.findOne({
            where: {id: userId, userpin: userPin}
        });
        if (user) {
            let secret = await Bcrypt.hash(userId + user.username, 12)
            console.log("Secret: " + secret);
            res.json({"response": 1, "hash": secret})
        } else {
            res.json({"response": 2, "hash": "None"})
        }
    } catch (error) {
        next(error)
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
