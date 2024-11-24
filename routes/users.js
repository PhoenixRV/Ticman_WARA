var express = require("express");
var router = express.Router();
const Database = require("../DatabaseService.js");
const Bcrypt = require("bcrypt");
const dbService = new Database();

/* GET users listing. */
router.get("/", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const user = await dbService.GetUserModelById(parseInt(session.user_id));
        const users = await dbService.User.findAll();
        const userJsonArray = users.map((user) => user.toJSON());
        userJsonArray.sort((a, b) => a.id - b.id);

        const ticketAmounts = {
            all: await dbService.Tickets.count(),
            open: await dbService.Tickets.count({where: {status: 1}}),
            closed: await dbService.Tickets.count({where: {status: 2}}),
            inProgress: await dbService.Tickets.count({where: {status: 3}}),
        };
        res.render("users", {
            name: session.name,
            userArray: userJsonArray,
            user_id: session.user_id,
            ticketAmounts: ticketAmounts,
            profileImageUrl: user.profile_picture,
            permission: await dbService.GetPermissionOfClient(session.user_id)
        });
    } else {
        res.redirect("/login");
    }
});
router.get("/editUser/:userid", async function (req, res, next) {
    try {
        const userid = req.params.userid;
        let session = req.session;
        if (session.isLoggedIn) {
            const user = await dbService.GetUserModelById(parseInt(userid));
            const permissions = await dbService.Server_Permission.findAll();
            const permissionsJsonArray = permissions.map((user) => user.toJSON());
            const departments = await dbService.Server_Departments.findAll();
            const departmentsJsonArray = departments.map((x) => x.toJSON());
            const assignDepartments = await dbService.User_Department.findAll({
                where: {user_id: user.id},
            });
            const assignDepartmentsArray = await Promise.all(
                assignDepartments.map(async (department) => ({
                    id: department.id,
                    name: await GetDepartmentById(department.department_id),
                }))
            );
            const userPermission = await dbService.User_Permission.findAll({
                where: {
                    userId: userid,
                },
                attributes: ["permissionId"], // Nur die Spalte 'permissionId' abrufen
            });

            const userPermissionArray = userPermission.map(
                (user) => user.permissionId
            );
            if (user != null) {
                res.render("editUser", {
                    name: session.name,
                    user: user.toJSON(),
                    serverPermissions: permissionsJsonArray,
                    userPermission: userPermissionArray,
                    profileImageUrl: user.profile_picture,
                    user_id: session.user_id,
                    departments: departmentsJsonArray,
                    assignDepartments: assignDepartmentsArray,
                    permission: await dbService.GetPermissionOfClient(session.user_id)
                });
            } else {
                res.redirect("/users");
            }
        } else {
            res.redirect("/login");
        }
    } catch (e) {
        console.error(e);
        throw e;
    }
});

router.post("/updatePermission/:userid", async function (req, res, next) {
    try {
        const userid = req.params.userid;
        const {permissions} = req.body;
        let session = req.session;
        if (session.isLoggedIn) {
            dbService.User_Permission.destroy({
                where: {
                    userId: userid,
                },
            });

            for (const e of permissions) {
                const newUser = await dbService.User_Permission.create({
                    userId: userid,
                    permissionId: parseInt(e),
                });
                newUser.save();
            }
            res.redirect("/users");
        } else {
            res.redirect('/login');
        }
    } catch (e) {
        console.error(e);
        throw e;
    }
});

router.post("/editUser/:userid", async function (req, res, next) {
    try {
        const userid = req.params.userid;
        const {username, name, email, password, role} = req.body;
        let session = req.session;
        if (session.isLoggedIn) {
            const user = dbService.GetUserModelById(parseInt(userid));
            if (user != null) {
                if (password.length === 0) {
                    await dbService.User.update(
                        {username: username, name: name, mail: email, role: role},
                        {where: {id: userid}}
                    );
                } else {
                    const hashedPassword = await Bcrypt.hash(req.body.password, 12);
                    await dbService.User.update(
                        {
                            username: username,
                            name: name,
                            mail: email,
                            role: role,
                            password: hashedPassword,
                        },
                        {where: {id: userid}}
                    );
                }
                res.redirect("/users");
            } else {
                res.redirect("/users");
            }
        } else {
            res.redirect("/login");
        }
    } catch (e) {
        console.error(e);
        throw e;
    }
});

router.get("/createUser", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const user = await dbService.GetUserModelById(parseInt(session.user_id));
        res.render("createUser", {
            name: session.name,
            haveError: false,
            error: "",
            user_id: session.user_id,
            profileImageUrl: user.profile_picture,
            permission: await dbService.GetPermissionOfClient(session.user_id)
        });
    } else {
        res.redirect("/login");
    }
});

router.post("/createUser", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const defaultUser = await dbService.User.findOne({
            where: {username: req.body.username},
        });
        if (!defaultUser) {
            const hashedPassword = await Bcrypt.hash(req.body.password, 12);
            const newUser = await dbService.User.create({
                username: req.body.username,
                name: req.body.name,
                mail: req.body.email,
                role: req.body.role,
                password: hashedPassword,
                profile_picture: "uploads/profile_uploads/default_profilepicture.jpg",
                isActive: true,
                userpin: await dbService.generatePin()
            });
            newUser.save();
            res.redirect("/users");
        } else {
            res.render("createUser", {
                name: session.name,
                haveError: true,
                error: "Account already exist!",
                permission: await dbService.GetPermissionOfClient(session.user_id)
            });
        }
    } else {
        res.redirect("/login");
    }
});

router.post("/addDepartment/:user_Id", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const userId = req.params.user_Id;
        const department = req.body.department;
        await dbService.User_Department.create({
            user_id: userId,
            department_id: department
        });
        res.redirect("/users/editUser/" + userId + "#departments");
    } else {
        res.redirect("/login");
    }
});

router.get("/removeDepartment/:category_id/:userId", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const {category_id, userId} = req.params;

        try {
            await dbService.User_Department.destroy({
                where: {
                    id: category_id,
                    user_id: userId,
                },
            });
            res.redirect("/users/editUser/" + userId + "#departments");
        } catch (error) {
            console.error("Error deleting user permission:", error);
            res
                .status(500)
                .json({message: "Error deleting user permission", error});
        }
    } else {
        res.redirect("/login");
    }
});


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
