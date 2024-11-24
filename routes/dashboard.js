var express = require("express");
var router = express.Router();
const Database = require("../DatabaseService.js");
const dbService = new Database();

/* GET home page. */
router.get("/", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        if (await dbService.GetRoleOfClient(session.user_id) === "user") {
            await openUserDashboard(req, res);
        } else {
            const user = await dbService.GetUserModelById(parseInt(session.user_id));
            const ticketAmounts = {
                all: await dbService.Tickets.count(),
                open: await dbService.Tickets.count({where: {status: 1}}),
                closed: await dbService.Tickets.count({where: {status: 2}}),
                inProgress: await dbService.Tickets.count({where: {status: 3}}),
            };

            const tickets = await dbService.Tickets.findAll();
            const ticketArray = [];
            for (const ticket of tickets) {
                if (await dbService.IsClientEditorOfTicket(ticket.id, session.user_id)) {
                    ticketArray.push({
                        id: ticket.id,
                        creator: await GetUsernameById(ticket.user_id),
                        title: ticket.title,
                        status: parseStatus(ticket.status),
                        priority: parsePriority(ticket.priority),
                        createdAt: "",
                    });
                }
            }
            ticketArray.sort((a, b) => a.id - b.id);

            res.render("dashboard", {
                name: session.name,
                user_id: session.user_id,
                ticketAmounts: ticketAmounts,
                selfTickets: ticketArray,
                profileImageUrl: user.profile_picture,
                permission: await dbService.GetPermissionOfClient(session.user_id)
            });
        }
    } else {
        res.redirect("/login");
    }
});

async function openUserDashboard(req, res) {
    let session = req.session;
    if (session.isLoggedIn) {
        const user = await dbService.GetUserModelById(parseInt(session.user_id));
        const tickets = await dbService.Tickets.findAll({where: {user_id: session.user_id}});
        const ticketAmounts = {
            all: await dbService.Tickets.count(),
            open: await dbService.Tickets.count({where: {status: 1}}),
            closed: await dbService.Tickets.count({where: {status: 2}}),
            inProgress: await dbService.Tickets.count({where: {status: 3}}),
        };

        const ticketArray = [];
        for (const ticket of tickets) {
            ticketArray.push({
                id: ticket.id,
                creator: await GetUsernameById(ticket.user_id),
                editor: await GetUsernameById(ticket.editor),
                title: ticket.title,
                status: parseStatus(ticket.status),
                priority: parsePriority(ticket.priority),
                createdAt: "",
            });
        }
        ticketArray.sort((a, b) => a.id - b.id);

        res.render("userTickets", {
            name: session.name,
            ticketAmounts: ticketAmounts,
            tickets: ticketArray,
            user_id: session.user_id,
            profileImageUrl: user.profile_picture,
            permission: await dbService.GetPermissionOfClient(session.user_id)
        });
    } else {
        res.redirect("/login");
    }
}

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

module.exports = router;
