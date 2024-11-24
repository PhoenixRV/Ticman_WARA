var express = require("express");
var router = express.Router();
const multer = require("multer");
const upload = require("../multer_configs/ticketAttachmentUploadConfig.js");
const Database = require("../DatabaseService.js");
const dbService = new Database();
const MailService = require("../mailService.js");
const mailer = new MailService();

/**
 * Displays the main ticket dashboard.
 * @route GET /
 * @returns {HTML} Rendered page with user data, tickets, and department data.
 */
router.get("/", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");

    const user = await dbService.GetUserModelById(session.user_id);
    const ticketAmounts = await getTicketAmount();
    const tickets = await getTickets();
    const userDepartments = await getUserDepartments(user.id);

    res.render("tickets", {
        name: user.username,
        ticketAmounts: ticketAmounts,
        tickets: tickets,
        user_id: user.id,
        profileImageUrl: user.profile_picture,
        departments: userDepartments,
        permission: await dbService.GetPermissionOfClient(user.id)
    });
});

/**
 * Tickets nach Abteilung anzeigen.
 * @route GET /department/:department_Id
 * @param {string} department_Id - Die ID der Abteilung, nach der gefiltert wird.
 * @returns {HTML} Gerenderte Seite mit den gefilterten Tickets.
 */
router.get("/department/:department_Id", async function (req, res, next) {
    let session = req.session;
    const departmentId = req.params.department_Id;
    if (!session.isLoggedIn) return res.redirect("/login");
    const user = await dbService.GetUserModelById(parseInt(session.user_id));
    const ticketAmounts = await getTicketAmount();
    const tickets = await getTicketsByDepartment(departmentId);
    const userDepartments = await getUserDepartments(user.id);

    res.render("tickets", {
        name: session.name,
        ticketAmounts: ticketAmounts,
        tickets: tickets,
        user_id: user.id,
        profileImageUrl: user.profile_picture,
        departments: userDepartments,
        permission: await dbService.GetPermissionOfClient(session.user_id)
    });
});

/**
 * Zeigt Tickets an, die dem aktuellen Benutzer zugewiesen sind.
 * @route GET /self
 * @returns {HTML} Gerenderte Seite mit den Tickets des Benutzers.
 */
router.get("/self", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");
    const user = await dbService.GetUserModelById(parseInt(session.user_id));
    const userDepartments = await getUserDepartments(user.id)
    const ticketAmounts = await getTicketAmount();
    const userTickets = await getUserTickets(user.id);

    res.render("tickets", {
        name: user.username,
        ticketAmounts: ticketAmounts,
        tickets: userTickets,
        user_id: user.id,
        profileImageUrl: user.profile_picture,
        departments: userDepartments,
        permission: await dbService.GetPermissionOfClient(session.user_id)
    });
});

/**
 * Formular zur Ticket-Erstellung anzeigen.
 * @route GET /createTicket
 * @returns {HTML} Gerenderte Seite für das Ticket-Erstellungsformular.
 */
router.get("/createTicket", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");

    const user = await dbService.GetUserModelById(parseInt(session.user_id));
    const ticketAmounts = await getTicketAmount();
    res.render("createTicket", {
        name: session.name,
        user_id: user.id,
        ticketAmounts: ticketAmounts,
        profileImageUrl: user.profile_picture,
        permission: await dbService.GetPermissionOfClient(session.user_id)
    });
});

/**
 * Ticket erstellen mit optionalen Dateianhängen.
 * @route POST /createTicket
 * @param {object} req - Express Request-Objekt mit Ticketdetails und Dateien.
 * @param {object} res - Express Response-Objekt.
 * @returns {JSON} Erfolgs- oder Fehlermeldung.
 */
router.post("/createTicket", (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({message: err});
        }

        const {title, description, priority, status} = req.body;
        const userId = req.session.user_id;

        try {
            const newTicket = await createTicket({
                title,
                description,
                status,
                priority,
                user_id: userId,
            });

            await saveAttachments(req.files, newTicket.id);
            await handleRedirect(userId, res);

        } catch (error) {
            console.error("Error creating ticket:", error);
            res.status(500).json({message: "An error occurred while creating the ticket."});
        }
    });
});

/**
 * Formular zur Ticket-Bearbeitung anzeigen.
 * @route GET /editTicket/:ticket_Id
 * @param {string} ticket_Id - ID des Tickets, das bearbeitet werden soll.
 * @returns {HTML} Gerenderte Seite für die Ticket-Bearbeitung.
 */
router.get("/editTicket/:ticket_Id", async function (req, res, next) {
    let session = req.session;

    if (!session.isLoggedIn) return res.redirect("/login");

    const ticket_Id = req.params.ticket_Id;
    const user = await dbService.GetUserModelById(parseInt(session.user_id));

    const userData = await getTicketUserData(ticket_Id);
    const departmentData = await getDepartments(ticket_Id);
    const categoriesData = await getCategoryData(ticket_Id);
    const ticketData = await getTicketData(ticket_Id);
    const ticketCommentData = await getTicketComments(ticket_Id);
    const ticketAttachmentData = await getTicketAttachmentData(ticket_Id);
    const userPermission = await dbService.GetPermissionOfClient(session.user_id);

    res.render("editTicket", {
        name: session.name,
        ticket: ticketData,
        users: userData.users,
        categories: categoriesData.categories,
        departments: departmentData.departments,
        comments: ticketCommentData,
        attachments: ticketAttachmentData,
        user_id: session.user_id,
        assignUser: userData.assignUsers,
        assignCategories: categoriesData.assignCategories,
        assignDepartments: departmentData.assignDepartments,
        profileImageUrl: user.profile_picture,
        permission: userPermission
    });
});

/**
 * Bearbeitet ein vorhandenes Ticket.
 * @route POST /editTicket/:ticket_Id
 * @param {string} ticket_Id - ID des zu bearbeitenden Tickets.
 * @param {object} req - Express Request-Objekt mit den aktualisierten Ticketdaten.
 * @param {object} res - Express Response-Objekt.
 */
router.post("/editTicket/:ticket_Id", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");

    const ticket_Id = req.params.ticket_Id;
    const {title, description, assignedTo, priority, status} = req.body;
    const [updated] = await dbService.Tickets.update(
        {
            title: title,
            description: description,
            status: status,
            priority: priority,
            editor: assignedTo,
        },
        {where: {id: ticket_Id}}
    );
    await dbService.CreateNotification(session.user_id, "Ticket" + ticket_Id + "was edited", "The Ticket with the ID: " + ticket_Id + " was edited")
    res.redirect("/tickets/editTicket/" + ticket_Id);
});

/**
 * Fügt eine Abteilung zu einem Ticket hinzu.
 * @route POST /addDepartment/:ticket_Id
 * @param {string} ticket_Id - ID des Tickets, dem die Abteilung hinzugefügt wird.
 * @param {object} req - Express Request-Objekt mit den Abteilungsdetails.
 * @param {object} res - Express Response-Objekt.
 */
router.post("/addDepartment/:ticket_Id", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");

    const ticket_Id = req.params.ticket_Id;
    const department = req.body.department;
    await dbService.Ticket_Department.create({
        ticket_id: ticket_Id,
        department_id: department,
    });
    const users = await dbService.Ticket_Assignments.findAll({where: {ticket_id: ticket_Id}});
    for (const x of users) {
        await dbService.CreateNotification(x.user_id, "Changed department for ticket #" + ticket_Id, "The department for Ticket" + ticket_Id + "has changed")
    }
    res.redirect("/tickets/editTicket/" + ticket_Id + "#settings");
});

/**
 * Entfernt eine Abteilung von einem Ticket.
 * @route GET /removeDepartment/:category_id/:ticketId
 * @param {string} category_id - ID der zu entfernenden Abteilung.
 * @param {string} ticketId - ID des Tickets.
 * @param {object} res - Express Response-Objekt.
 * @returns {JSON} Erfolgs- oder Fehlermeldung.
 */
router.get("/removeDepartment/:category_id/:ticketId", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");
    const {category_id, ticketId} = req.params;

    try {
        await dbService.Ticket_Department.destroy({
            where: {
                id: category_id,
                ticket_id: ticketId,
            },
        });

        const users = await dbService.Ticket_Assignments.findAll({where: {ticket_id: ticketId}});
        for (const x of users) {
            await dbService.CreateNotification(x.user_id, "Removed department for ticket #" + ticketId, "The department for Ticket: #" + ticketId + "has removed")
        }
        res.redirect("/tickets/editTicket/" + ticketId + "#settings");
    } catch (error) {
        console.error("Error deleting user permission:", error);
        res.status(500).json({message: "Error deleting user permission", error});
    }
});

/**
 * Fügt eine Kategorie zu einem Ticket hinzu.
 * @route POST /addCategory/:ticket_Id
 * @param {string} ticket_Id - ID des Tickets, dem die Kategorie hinzugefügt wird.
 * @param {object} req - Express Request-Objekt mit den Kategoriedetails.
 * @param {object} res - Express Response-Objekt.
 */
router.post("/addCategory/:ticket_Id", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");

    const ticket_Id = req.params.ticket_Id;
    const category = req.body.category;
    await dbService.Ticket_Category.create({
        ticket_id: ticket_Id,
        category_id: category,
    });
    const users = await dbService.Ticket_Assignments.findAll({where: {ticket_id: ticket_Id}});
    for (const x of users) {
        await dbService.CreateNotification(x.user_id, "Added categories for ticket #" + ticket_Id, "The categories for ticket: #" + ticket_Id + " has updated \n newcategory: " + await getCategoryName(category))
    }
    res.redirect("/tickets/editTicket/" + ticket_Id + "#settings");
});

/**
 * Entfernt eine Kategorie von einem Ticket.
 * @route GET /removeCategory/:category_id/:ticketId
 * @param {string} category_id - ID der zu entfernenden Kategorie.
 * @param {string} ticketId - ID des Tickets.
 * @param {object} res - Express Response-Objekt.
 * @returns {JSON} Erfolgs- oder Fehlermeldung.
 */
router.get("/removeCategory/:category_id/:ticketId", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");
    const {category_id, ticketId} = req.params;

    try {
        await dbService.Ticket_Category.destroy({
            where: {
                id: category_id,
                ticket_id: ticketId,
            }
        });

        const users = await dbService.Ticket_Assignments.findAll({where: {ticket_id: ticketId}});
        for (const x of users) {
            await dbService.CreateNotification(x.user_id, "Removed categories for ticket #" + ticketId, "The categories for Ticket: #" + ticketId + " has removed")
        }
        res.redirect("/tickets/editTicket/" + ticketId + "#settings");
    } catch (error) {
        console.error("Error deleting user permission:", error);
        res.status(500).json({message: "Error deleting user permission", error});
    }
});

/**
 * Fügt eine Benutzer-Zuweisung zu einem Ticket hinzu.
 * @route POST /addUser/:ticket_Id
 * @param {string} ticket_Id - ID des Tickets, dem die Benutzerzuweisung hinzugefügt wird.
 * @param {object} req - Express Request-Objekt mit der Benutzer-ID.
 * @param {object} res - Express Response-Objekt.
 */
router.post("/addUser/:ticket_Id", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");

    const ticket_Id = req.params.ticket_Id;
    const userId = req.body.assignedTo;
    await dbService.Ticket_Assignments.create({
        ticket_id: ticket_Id,
        user_id: userId,
    });
    const users = await dbService.Ticket_Assignments.findAll({where: {ticket_id: ticket_Id}});
    let assignedUser = await dbService.GetNameByUserId(userId);
    for (const x of users) {
        await dbService.CreateNotification(x.user_id, "Assign " + assignedUser + " for ticket #" + ticket_Id, "The user " + assignedUser + " has been assigned to ticket #" + ticket_Id)
    }
    res.redirect("/tickets/editTicket/" + ticket_Id + "#settings");
});

/**
 * Entfernt eine Benutzer-Zuweisung von einem Ticket.
 * @route GET /removeUser/:user_id/:ticketId
 * @param {string} user_id - ID des zu entfernenden Benutzers.
 * @param {string} ticketId - ID des Tickets.
 * @param {object} res - Express Response-Objekt.
 * @returns {JSON} Erfolgs- oder Fehlermeldung.
 */
router.get("/removeUser/:user_id/:ticketId", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");
    const {user_id, ticketId} = req.params;
    let assignedUser = await dbService.GetNameByUserId(user_id);
    try {
        await dbService.Ticket_Assignments.destroy({
            where: {
                id: user_id,
                ticket_id: ticketId,
            }
        });
        const users = await dbService.Ticket_Assignments.findAll({where: {ticket_id: ticketId}});
        for (const x of users) {
            await dbService.CreateNotification(x.user_id, "Assigned user has changed for ticket #" + ticketId, "The user assignment has changed to " + assignedUser + " for ticket #" + ticketId)
        }
        res.redirect("/tickets/editTicket/" + ticketId + "#settings");
    } catch (error) {
        console.error("Error deleting user permission:", error);
        res.status(500).json({message: "Error deleting user permission", error});
    }
});

/**
 * Kommentar zu einem Ticket hinzufügen.
 * @route POST /comments/:ticket_Id
 * @param {string} ticket_Id - ID des Tickets.
 * @param {object} req - Express Request-Objekt mit dem Kommentarinhalt.
 * @param {object} res - Express Response-Objekt.
 */
router.post("/comments/:ticket_Id", async function (req, res, next) {
    let session = req.session;
    if (!session.isLoggedIn) return res.redirect("/login");

    const ticket_Id = req.params.ticket_Id;
    await dbService.Ticket_Comments.create({
        ticket_id: ticket_Id,
        user_id: session.user_id,
        comment: req.body.content,
    });
    const userId = await dbService.GetUserIdByTicketId(req.params.ticket_Id);
    const userMail = await dbService.GetMailByUserId(userId);
    await mailer.sendEmailUpdate(userMail, req.params.ticket_Id, "comment", req.body.content)
    const users = await dbService.Ticket_Assignments.findAll({where: {ticket_id: ticket_Id}});
    let commentUser = await dbService.GetNameByUserId(session.user_id);
    for (const x of users) {
        await dbService.CreateNotification(x.user_id, "New comment for ticket #" + ticket_Id + " from " + commentUser, "There is a new comment for ticket: #" + ticket_Id + " from IT-Employee: " + commentUser)
    }
    res.redirect("/tickets/editTicket/" + ticket_Id + "#comments");
});

/**
 * Datei-Anhang zu einem Ticket hochladen.
 * @route POST /attachment/upload/:ticket_id
 * @param {string} ticket_id - ID des Tickets.
 * @param {object} req - Express Request-Objekt mit dem Anhang.
 * @param {object} res - Express Response-Objekt.
 * @returns {JSON} Erfolgs- oder Fehlermeldung.
 */
router.post("/attachment/upload/:ticket_id", (req, res) => {
    const session = req.session;

    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({message: err});
        }

        const ticket_id = req.params.ticket_id;

        try {
            // Anhänge speichern
            await saveAttachments(req.files, ticket_id);

            // Benachrichtigen der zugewiesenen Benutzer
            await notifyAssignedUsers(ticket_id, session.user_id);

            // Weiterleitung zur Ticketbearbeitung
            res.redirect(`/tickets/editTicket/${ticket_id}#files`);
        } catch (error) {
            console.error("Error uploading attachment:", error);
            res.status(500).json({message: "An error occurred while uploading the attachment."});
        }
    });
});

/**
 * Lädt einen Anhang für ein Ticket herunter.
 * @route GET /attachment/download/:attachmentId
 * @param {string} attachmentId - ID des Anhangs.
 * @param {object} res - Express Response-Objekt.
 * @returns {File} Der heruntergeladene Anhang.
 */
router.get("/attachment/download/:attachmentId", async (req, res) => {
    const session = req.session;

    // Login-Prüfung
    if (!session.isLoggedIn) return res.redirect("/login");

    try {
        // Dateipfad und -namen abrufen
        const {filePath} = await getAttachmentPath(req.params.attachmentId);

        // Datei herunterladen
        res.download(filePath, (err) => {
            if (err) {
                console.error("Error during file download:", err);
                return res.status(500).json({message: "Error during file download", error: err});
            }
        });
    } catch (error) {
        console.error("Error downloading attachment:", error);
        res.status(404).json({message: "Attachment not found"});
    }
});

/**
 * Startet ein Worklog für einen Benutzer zu einem Ticket.
 * @route POST /worklog/start
 * @param {object} req - Express Request-Objekt mit Ticket- und Benutzer-ID.
 * @param {object} res - Express Response-Objekt mit den Worklog-Details.
 */
router.post("/worklog/start", async (req, res) => {
    try {
        const {ticketId, userId} = req.body;
        const workLog = await dbService.Ticket_WorkLog.create({ticketId, userId});
        res.status(201).json(workLog);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

/**
 * Beendet ein laufendes Worklog, indem die Endzeit gesetzt wird.
 * @route POST /worklog/stop
 * @param {object} req - Express Request-Objekt mit der Worklog-ID.
 * @param {object} res - Express Response-Objekt mit den aktualisierten Worklog-Details.
 */
router.post("/worklog/stop", async (req, res) => {
    try {
        const {workLogId} = req.body;
        const workLog = await dbService.Ticket_WorkLog.findByPk(workLogId);
        if (!workLog) return res.status(404).json({error: "WorkLog not found"});

        workLog.endTime = new Date();
        await workLog.save();
        res.status(200).json(workLog);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

/**
 * Ruft die Worklogs für ein bestimmtes Ticket ab.
 * @route GET /worklog/:ticketId
 * @param {string} ticketId - ID des Tickets.
 * @param {object} res - Express Response-Objekt mit den Worklogs.
 */
router.get("/worklog/:ticketId", async (req, res) => {
    try {
        const {ticketId} = req.params;
        const workLogs = await dbService.Ticket_WorkLog.findAll({
            where: {ticketId},
        });
        const workLogArray = [];
        for (const worklog of workLogs) {
            workLogArray.push({
                id: worklog.id,
                startTime: worklog.startTime,
                endTime: worklog.endTime,
                editor: await GetUsernameById(worklog.userId),
            });
        }
        res.status(200).json(workLogArray);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

/**
 * Parses ticket status from a numeric value to a string.
 * @param {number} status - Numeric status code of the ticket.
 * @returns {string} Status as a string ("Open", "Closed", "In Progress").
 */
const parseStatus = function (status) {
    switch (status) {
        case 1:
            return "Open";
        case 2:
            return "Closed";
        case 3:
            return "In Progress";
        default:
            return "Unknown";
    }
};

/**
 * Parses ticket priority from a numeric value to a string.
 * @param {number} priority - Numeric priority code of the ticket.
 * @returns {string} Priority as a string ("Low", "Middle", "High").
 */
const parsePriority = function (priority) {
    switch (priority) {
        case 0:
            return "Low";
        case 1:
            return "Middle";
        case 2:
            return "High";
        default:
            return "Unknown";
    }
};

/**
 * Retrieves the username by user ID.
 * @param {number} id - ID of the user.
 * @returns {Promise<string>} Username associated with the provided ID.
 */
const GetUsernameById = async function (id) {
    const user = await dbService.User.findOne({ where: { id: id } });
    return user ? user.name : "Unknown";
};

/**
 * Retrieves the category name by category ID.
 * @param {number} id - ID of the category.
 * @returns {Promise<string>} Category name associated with the provided ID.
 */
const GetCategoryById = async function (id) {
    const category = await dbService.Server_Categories.findOne({ where: { id: id } });
    return category ? category.category : "Unknown";
};

/**
 * Retrieves the department name by department ID.
 * @param {number} id - ID of the department.
 * @returns {Promise<string>} Department name associated with the provided ID.
 */
const GetDepartmentById = async function (id) {
    const department = await dbService.Server_Departments.findOne({ where: { id: id } });
    return department ? department.department : "Unknown";
};

/**
 * Retrieves the main ticket data by ticket ID.
 * @param {number} ticket_Id - ID of the ticket.
 * @returns {Promise<object>} Ticket data including title, description, priority, and status.
 */
const getTicketData = async function (ticket_Id) {
    const ticket = await dbService.Tickets.findOne({ where: { id: ticket_Id } });
    return {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        assignedTo: ticket.editor,
        priority: ticket.priority,
        status: ticket.status,
    };
};

/**
 * Retrieves comments for a specific ticket.
 * @param {number} ticket_Id - ID of the ticket.
 * @returns {Promise<Array<object>>} List of comments with user, comment text, and timestamp.
 */
const getTicketComments = async function (ticket_Id) {
    const comments = await dbService.Ticket_Comments.findAll({ where: { ticket_id: ticket_Id } });
    return await Promise.all(comments.map(async (comment) => ({
        id: comment.id,
        user: await GetUsernameById(comment.user_id),
        comment: comment.comment,
        time: comment.time,
    })));
};

/**
 * Retrieves attachment data for a specific ticket.
 * @param {number} ticket_Id - ID of the ticket.
 * @returns {Promise<Array<object>>} List of attachments with file path and name.
 */
const getTicketAttachmentData = async function (ticket_Id) {
    const attachments = await dbService.Ticket_Attachments.findAll({ where: { ticket_id: ticket_Id } });
    return attachments.map(attachment => ({
        id: attachment.id,
        filePath: attachment.filePath,
        fileName: attachment.fileName,
    }));
};

/**
 * Retrieves user and assignment data for a specific ticket.
 * @param {number} ticket_Id - ID of the ticket.
 * @returns {Promise<object>} User data and assigned users for the ticket.
 */
const getTicketUserData = async function (ticket_Id) {
    const users = await dbService.User.findAll();
    const userJsonArray = users.map(user => user.toJSON());
    const assignUsers = await dbService.Ticket_Assignments.findAll({ where: { ticket_id: ticket_Id } });
    const assignUserArray = await Promise.all(assignUsers.map(async (user) => ({
        id: user.id,
        name: await GetUsernameById(user.user_id),
    })));
    return { users: userJsonArray, assignUsers: assignUserArray };
};

/**
 * Retrieves category data and assigned categories for a ticket.
 * @param {number} ticket_Id - ID of the ticket.
 * @returns {Promise<object>} List of categories and assigned categories for the ticket.
 */
const getCategoryData = async function (ticket_Id) {
    const categories = await dbService.Server_Categories.findAll();
    const categoriesJsonArray = categories.map(category => category.toJSON());
    const assignCategories = await dbService.Ticket_Category.findAll({ where: { ticket_id: ticket_Id } });
    const assignCategoriesArray = await Promise.all(assignCategories.map(async (category) => ({
        id: category.id,
        name: await GetCategoryById(category.category_id),
    })));
    return { categories: categoriesJsonArray, assignCategories: assignCategoriesArray };
};

/**
 * Retrieves department data and assigned departments for a ticket.
 * @param {number} ticket_Id - ID of the ticket.
 * @returns {Promise<object>} List of departments and assigned departments for the ticket.
 */
const getDepartments = async function (ticket_Id) {
    const departments = await dbService.Server_Departments.findAll();
    const departmentsJsonArray = departments.map(department => department.toJSON());
    const assignDepartments = await dbService.Ticket_Department.findAll({ where: { ticket_id: ticket_Id } });
    const assignDepartmentsArray = await Promise.all(assignDepartments.map(async (department) => ({
        id: department.id,
        name: await GetDepartmentById(department.department_id),
    })));
    return { departments: departmentsJsonArray, assignDepartments: assignDepartmentsArray };
};

/**
 * Retrieves the total amount and status counts of tickets.
 * @returns {Promise<object>} Ticket counts categorized by status.
 */
const getTicketAmount = async function () {
    return {
        all: await dbService.Tickets.count(),
        open: await dbService.Tickets.count({ where: { status: 1 } }),
        closed: await dbService.Tickets.count({ where: { status: 2 } }),
        inProgress: await dbService.Tickets.count({ where: { status: 3 } }),
    };
};

/**
 * Retrieves and formats all tickets.
 * @returns {Promise<Array<object>>} List of tickets with details including title, creator, and status.
 */
const getTickets = async function () {
    const tickets = await dbService.Tickets.findAll();
    const ticketArray = await Promise.all(tickets.map(async (ticket) => ({
        id: ticket.id,
        creator: await GetUsernameById(ticket.user_id),
        editor: await GetUsernameById(ticket.editor),
        title: ticket.title,
        status: parseStatus(ticket.status),
        priority: parsePriority(ticket.priority),
        createdAt: "",
    })));
    return ticketArray.sort((a, b) => a.id - b.id);
};

/**
 * Retrieves tickets specifically assigned to a user.
 * @param {number} userId - ID of the user.
 * @returns {Promise<Array<object>>} List of tickets assigned to the user.
 */
const getUserTickets = async function (userId) {
    const tickets = await dbService.Tickets.findAll();
    const ticketArray = await Promise.all(tickets.filter(async (ticket) => await dbService.IsClientEditorOfTicket(ticket.id, userId))
        .map(async (ticket) => ({
            id: ticket.id,
            creator: await GetUsernameById(ticket.user_id),
            editor: await GetUsernameById(ticket.editor),
            title: ticket.title,
            status: parseStatus(ticket.status),
            priority: parsePriority(ticket.priority),
            createdAt: "",
        })));
    return ticketArray.sort((a, b) => a.id - b.id);
};

/**
 * Retrieves departments assigned to a specific user.
 * @param {number} userId - ID of the user.
 * @returns {Promise<Array<object>>} List of departments the user belongs to.
 */
const getUserDepartments = async function (userId) {
    const user_departments = await dbService.User_Department.findAll({ where: { user_id: userId } });
    return await Promise.all(user_departments.map(async (department) => ({
        id: department.department_id,
        departmentName: await dbService.GetDepartmentNameById(department.department_id),
    })));
};

/**
 * Retrieves tickets assigned to a specific department.
 * @param {number} departmentId - ID of the department.
 * @returns {Promise<Array<object>>} List of tickets in the department.
 */
const getTicketsByDepartment = async function (departmentId) {
    const tickets = await dbService.Tickets.findAll();
    const ticketArray = await Promise.all(tickets.filter(async (ticket) => await dbService.GetDepartmentIdOfTicket(ticket.id) === departmentId)
        .map(async (ticket) => ({
            id: ticket.id,
            creator: await GetUsernameById(ticket.user_id),
            editor: await GetUsernameById(ticket.editor),
            title: ticket.title,
            status: parseStatus(ticket.status),
            priority: parsePriority(ticket.priority),
            createdAt: "",
        })));
    return ticketArray.sort((a, b) => a.id - b.id);
};

/**
 * Creates a new ticket in the database.
 * @param {object} data - Data for the new ticket.
 * @returns {Promise<object>} Created ticket.
 */
async function createTicket(data) {
    return dbService.Tickets.create(data);
}

/**
 * Saves attachments for a specific ticket.
 * @param {Array<object>} files - Array of file objects to save as attachments.
 * @param {number} ticketId - ID of the ticket to associate attachments with.
 */
async function saveAttachments(files, ticketId) {
    if (files?.length > 0) {
        const attachments = files.map(file => ({
            ticket_id: ticketId,
            filePath: file.path,
            fileName: file.originalname,
        }));
        await dbService.Ticket_Attachments.bulkCreate(attachments);
    }
}

/**
 * Redirects user based on their role after creating a ticket.
 * @param {number} userId - ID of the user to check role for.
 * @param {object} res - Express response object.
 */
async function handleRedirect(userId, res) {
    const userRole = await dbService.GetRoleOfClient(userId);
    const redirectUrl = userRole === "user" ? "/dashboard" : "/tickets";
    res.redirect(redirectUrl);
}

/**
 * Retrieves category name by ID.
 * @param {number} categoryId - ID of the category.
 * @returns {Promise<string>} Name of the category.
 */
const getCategoryName = async function (categoryId) {
    const category = await dbService.Server_Categories.findOne({ where: { id: categoryId } });
    return category ? category.category : "N/A";
}

/**
 * Notifies assigned users of a new attachment.
 * @param {number} ticket_id - ID of the ticket.
 * @param {number} sessionUserId - ID of the user uploading the attachment.
 */
async function notifyAssignedUsers(ticket_id, sessionUserId) {
    const users = await dbService.Ticket_Assignments.findAll({ where: { ticket_id } });
    const commentUser = await dbService.GetNameByUserId(sessionUserId);
    const notificationTitle = `Attachment has been uploaded for ticket: #${ticket_id}`;
    const notificationMessage = `An attachment for ticket: #${ticket_id} was uploaded by: ${commentUser}`;

    for (const user of users) {
        await dbService.CreateNotification(user.user_id, notificationTitle, notificationMessage);
    }
}

/**
 * Retrieves the file path of an attachment by ID.
 * @param {number} attachmentId - ID of the attachment.
 * @returns {Promise<object>} File path and ticket ID of the attachment.
 * @throws {Error} If attachment is not found.
 */
async function getAttachmentPath(attachmentId) {
    const attachment = await dbService.Ticket_Attachments.findByPk(attachmentId);
    if (!attachment) {
        throw new Error("Attachment not found");
    }
    return { filePath: attachment.filePath, ticketId: attachment.ticket_id };
}

module.exports = router;

