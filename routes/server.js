var express = require("express");
var router = express.Router();
const Database = require("../DatabaseService.js");
const dbService = new Database();

/* GET home page. */
router.get("/", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const user = await dbService.GetUserModelById(parseInt(session.user_id));
        const categories = await dbService.Server_Categories.findAll();
        const departments = await dbService.Server_Departments.findAll();
        const departmentsArray = await Promise.all(
            departments.map(async (department) => ({
                id: department.id,
                name: await GetDepartmentById(department.id),
            }))
        );
        const categoriesArray = await Promise.all(
            categories.map(async (category) => ({
                id: category.id,
                name: await GetCategoryById(category.id),
            }))
        );
        res.render("server", {
            name: session.name,
            categories: categoriesArray,
            departments: departmentsArray,
            user_id: session.user_id,
            profileImageUrl: user.profile_picture,
            permission: await dbService.GetPermissionOfClient(session.user_id)
        });
    } else {
        res.redirect("/login");
    }
});

router.post("/addDepartment", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const departmentName = req.body.department;
        await dbService.Server_Departments.create({
            department: departmentName,
        });
        res.redirect("/server/#departments");
    } else {
        res.redirect("/login");
    }
});

router.get("/removeDepartment/:departmentId", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const {departmentId} = req.params;
        await dbService.Ticket_Department.destroy({
            where: {
                department_id: departmentId,
            },
        });
        await dbService.Server_Departments.destroy({
            where: {
                id: departmentId,
            },
        });
        res.redirect("/server/#departments");
    } else {
        res.redirect("/login");
    }
});

router.post("/addCategory", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const categoryName = req.body.category;
        await dbService.Server_Categories.create({
            category: categoryName,
        });
        res.redirect("/server/#categories");
    } else {
        res.redirect("/login");
    }
});

router.get("/removeCategory/:categoryId", async function (req, res, next) {
    let session = req.session;
    if (session.isLoggedIn) {
        const {categoryId} = req.params;
        await dbService.Ticket_Category.destroy({
            where: {
                category_id: categoryId,
            },
        });
        await dbService.Server_Categories.destroy({
            where: {
                id: categoryId,
            },
        });
        res.redirect("/server/#categories");
    } else {
        res.redirect("/login");
    }
});

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
