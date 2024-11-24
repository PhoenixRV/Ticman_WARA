// DatabaseService.js

const {Sequelize, DataTypes} = require('sequelize');
const Bcrypt = require('bcrypt');
const config = require('./config.js');
const {all} = require("express/lib/application");

class DatabaseService {
    constructor() {
        this.sequelize = new Sequelize(config.database.database, config.database.user, config.database.password, {
            host: config.database.host,
            dialect: config.database.dialect,
            port: config.database.port,
        });

        this.User = this.sequelize.define('TM_Users', {
            username: {
                type: DataTypes.STRING,
                allowNull: false
            },
            name: {
                type: DataTypes.STRING,
                allowNull: true
            },
            mail: {
                type: DataTypes.STRING,
                allowNull: true
            },
            role: {
                type: DataTypes.STRING,
                allowNull: true
            },
            password: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            profile_picture: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                default: true
            },
            userpin: {
                type: DataTypes.INTEGER,
                allowNull: false,
                default: 0
            }
        });
        this.Server_Permission = this.sequelize.define('TM_Server_Permission', {
            permission: {
                type: DataTypes.STRING,
                allowNull: false
            },
            displayname: {
                type: DataTypes.STRING,
                allowNull: false
            },
            type: {
                type: DataTypes.STRING,
                allowNull: false
            }
        });
        this.Server_Categories = this.sequelize.define('TM_Server_Categories', {
            category: {
                type: DataTypes.STRING,
                allowNull: false
            }
        });
        this.Server_Departments = this.sequelize.define('TM_Server_Departments', {
            department: {
                type: DataTypes.STRING,
                allowNull: false
            }
        });
        this.User_Permission = this.sequelize.define('TM_Users_Permission', {
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.User,
                    key: 'id'
                }
            },
            permissionId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.Server_Permission,
                    key: 'id'
                }
            }
        });
        this.Tickets = this.sequelize.define('TM_Tickets', {
            title: {
                type: DataTypes.STRING,
                allowNull: false
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            status: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            priority: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.User,
                    key: 'id'
                }
            },
            editor: {
                type: DataTypes.INTEGER,
                allowNull: true,
                default: 0,
                references: {
                    model: this.User,
                    key: 'id'
                }
            },
            attachment: {
                type: DataTypes.TEXT,
                allowNull: true
            }
        });
        this.Ticket_Comments = this.sequelize.define('TM_Tickets_Comment', {
            ticket_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.Tickets,
                    key: 'id'
                }
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.User,
                    key: 'id'
                }
            },
            comment: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            time: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
        });
        this.Ticket_Assignments = this.sequelize.define('TM_Tickets_Assignments', {
            ticket_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.Tickets,
                    key: 'id'
                }
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.User,
                    key: 'id'
                }
            }
        });
        this.Ticket_Department = this.sequelize.define('TM_Tickets_Department', {
            ticket_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.Tickets,
                    key: 'id'
                }
            },
            department_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.Server_Departments,
                    key: 'id'
                }
            }
        });
        this.Ticket_Category = this.sequelize.define('TM_Tickets_Category', {
            ticket_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.Tickets,
                    key: 'id'
                }
            },
            category_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.Server_Categories,
                    key: 'id'
                }
            }
        });
        this.Ticket_WorkLog = this.sequelize.define('TM_Tickets_WorkLog', {
            ticketId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.Tickets,
                    key: 'id'
                }
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.User,
                    key: 'id'
                }
            },
            startTime: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            endTime: {
                type: DataTypes.DATE,
                allowNull: true
            }
        });
        this.Ticket_Attachments = this.sequelize.define('TM_Tickets_Attachments', {
            ticket_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.Tickets,
                    key: 'id'
                }
            },
            filePath: {
                type: DataTypes.STRING,
                allowNull: false
            },
            fileName: {
                type: DataTypes.STRING,
                allowNull: false
            },
        });
        this.Server_Settings = this.sequelize.define('TM_Server_Settings', {
            key: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            value: {
                type: DataTypes.TEXT,
                allowNull: false
            }
        });
        this.User_Department = this.sequelize.define('TM_User_Department', {
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.User,
                    key: 'id'
                }
            },
            department_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.Server_Departments,
                    key: 'id'
                }
            }
        });
        this.TicBoy_Notification = this.sequelize.define('TM_TicBoy_Notification', {
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.User,
                    key: 'id'
                }
            },
            notification: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            isRead: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                default: false
            }
        });
        this.User_Notification = this.sequelize.define('TM_User_Notification', {
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: this.User,
                    key: 'id'
                }
            },
            title: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            notification: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            isRead: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                default: false
            }
        });
    }

    async connect() {
        try {
            await this.sequelize.authenticate();
            console.log('Verbindung zur Datenbank erfolgreich hergestellt.');
            await this.syncDatabaseModels();
            console.log('Modelle synchronisiert.');
        } catch (error) {
            console.error('Fehler beim Herstellen der Verbindung zur Datenbank:', error);
            throw error;
        }
    }

    async syncDatabaseModels() {
        await this.User.sync();                 // Synchronisiere das Modell mit der Datenbank
        await this.Server_Permission.sync();    // Synchronisiere das Modell mit der Datenbank
        await this.Server_Categories.sync();    // Synchronisiere das Modell mit der Datenbank
        await this.Server_Departments.sync();   // Synchronisiere das Modell mit der Datenbank
        await this.User_Permission.sync();      // Synchronisiere das Modell mit der Datenbank
        await this.Tickets.sync();              // Synchronisiere das Modell mit der Datenbank
        await this.Ticket_Comments.sync();      // Synchronisiere das Modell mit der Datenbank
        await this.Ticket_Assignments.sync();   // Synchronisiere das Modell mit der Datenbank
        await this.Ticket_Department.sync();    // Synchronisiere das Modell mit der Datenbank
        await this.Ticket_Category.sync();      // Synchronisiere das Modell mit der Datenbank
        await this.Ticket_WorkLog.sync();       // Synchronisiere das Modell mit der Datenbank
        await this.Ticket_Attachments.sync();   // Synchronisiere das Modell mit der Datenbank
        await this.User_Department.sync();      // Synchronisiere das Modell mit der Datenbank
        await this.TicBoy_Notification.sync();   // Synchronisiere das Modell mit der Datenbank
        await this.User_Notification.sync();     // Synchronisiere das Modell mit der Datenbank
    }

    async createUser(firstName, lastName) {
        try {
            const newUser = await this.User.create({firstName, lastName});
            newUser.save();
            console.log('Neuer Benutzer wurde erstellt:', newUser.toJSON());
            return newUser;
        } catch (error) {
            console.error('Fehler beim Erstellen des Benutzers:', error);
            throw error;
        }
    }

    async createDefaultUserIfNotExist() {
        try {
            const defaultUser = await this.User.findOne({where: {username: "admin"}})
            if (!defaultUser) {
                const hashedPassword = await Bcrypt.hash("password", 12);
                const newUser = await this.User.create({
                    username: "admin",
                    name: "Administrator",
                    mail: "postmaster@ticman.com",
                    role: "superadmin",
                    password: hashedPassword,
                    profile_picture: "uploads/profile_uploads/default_profilepicture.jpg",
                    isActive: true,
                    userpin: 1234
                });
                newUser.save();
            }
        } catch (error) {
            console.error('Fehler beim Checken des Benutzers:', error);
            throw error;
        }
    }

    async getTicketAmountByStatus(status) {
        const statusMapping = {
            open: 1,
            closed: 2,
            inProgress: 3,
            all: 0
        };

        const ticketStatus = statusMapping[status] ?? 0;

        try {
            if (ticketStatus === 0) {
                return await this.Tickets.count();
            } else {
                return await this.Tickets.count({
                    where: {
                        status: ticketStatus
                    }
                });
            }
        } catch (err) {
            console.error('Error getting ticket count:', err);
            throw err;
        }
    }

    async createDefaultPermissionsIfNotExist() {
        try {
            await this.createPermissionIfNotExist("createuser", "Create new User", "user");
            await this.createPermissionIfNotExist("edituser", "Edit a User", "user");
            await this.createPermissionIfNotExist("showuser", "Edit all Users", "user");
            await this.createPermissionIfNotExist("edituserpermission", "Edit a User Permission", "user");
            await this.createPermissionIfNotExist("edituserdepartment", "Edit a User Department", "user");
            await this.createPermissionIfNotExist("createticketforuser", "Create a Ticket for User", "user");
            await this.createPermissionIfNotExist("editticket", "Edit a Ticket", "ticket");
            await this.createPermissionIfNotExist("editticketdepartment", "Edit a Ticket Department", "ticket");
            await this.createPermissionIfNotExist("editticketcategory", "Edit a Ticket Category", "ticket");
            await this.createPermissionIfNotExist("editticketassignment", "Edit a Ticket Assignment", "ticket");
            await this.createPermissionIfNotExist("createserverdepartment", "Create Server Department", "server");
            await this.createPermissionIfNotExist("createservercategory", "Create Server Category", "server");
        } catch (ex) {
            console.error('Fehler beim erstellen der Default permissions:', ex);
            throw ex;
        }
    }

    async IsClientEditorOfTicket(ticketId, userId) {
        const ticketEditor = await this.Ticket_Assignments.findOne({where: {ticket_id: ticketId, user_id: userId}})
        if (ticketEditor != null) return true;
        return false;
    }

    async GetRoleOfClient(userId) {
        const user = await this.User.findOne({where: {id: userId}});
        if (user != null) return user.role;
        return "user";
    }

    async GetPermissionOfClient(userId) {
        const userPermissions = await this.User_Permission.findAll({where: {userId: userId}});
        const user = await this.User.findOne({where: {id: userId}});
        let allPermissions = [];
        for (const permission of userPermissions) {
            allPermissions.push(await this.GetPermissionNameById(permission.permissionId))
        }

        return {
            userId: userId,
            role: user.role,
            permissions: allPermissions
        }
    }

    // {"userId": 0, "role": "helpdesk", "permissions": ["permission1","permission2"]}

    async GetPermissionById(permissionId) {
        return await this.Server_Permission.findOne({where: {id: permissionId}});
    }
    async GetPermissionNameById(permissionId) {
        const permission = await this.Server_Permission.findOne({where: {id: permissionId}});
        return permission.permission;
    }

    async createPermissionIfNotExist(permission, displayname, type) {
        const defaultDefineTicketHelpdeskPermission = await this.Server_Permission.findOne({where: {permission: permission}})
        if (!defaultDefineTicketHelpdeskPermission) {
            const newPermission = await this.Server_Permission.create({
                permission: permission,
                displayname: displayname,
                type: type
            });
            newPermission.save();
        }
    }

    async UsernameExists(searchedUsername) {
        try {
            const user = await this.User.findOne({where: {username: searchedUsername}})
            if (user) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            throw error;
        }
    }

    async GetUserModelByUsername(searchedUsername) {
        const user = await this.User.findOne({where: {username: searchedUsername}})
        if (user) {
            return user;
        } else {
            return null;
        }
    }

    async GetMailByUserId(userId) {
        const user = await this.User.findOne({where: {id: userId}})
        if (user) {
            return user.mail;
        } else {
            return null;
        }
    }

    async GetNameByUserId(userId) {
        const user = await this.User.findOne({where: {id: userId}})
        if (user) {
            return user.name;
        } else {
            return null;
        }
    }

    async GetUserIdByTicketId(ticketId) {
        const user = await this.Tickets.findOne({where: {id: ticketId}})
        if (user) {
            return user.user_id;
        } else {
            return 0;
        }
    }

    async GetUserModelById(Id) {
        const userId = parseInt(Id, 10);
        const user = await this.User.findOne({where: {id: userId}})
        if (user) {
            return user;
        } else {
            return null;
        }
    }

    async GetDepartmentIdOfTicket(ticketId) {
        const department = await this.Ticket_Department.findOne({where: {ticket_id: ticketId}})
        if (department != null) {
            return department.department_id;
        } else {
            return 0;
        }
    }

    async GetDepartmentNameById(departmentId) {
        const department = await this.Server_Departments.findOne({where: {id: departmentId}});
        if(department != null) {
            return department.department
        } else {
            return "None";
        }
    }

    async CreateTicBoyNotification(userId, notification) {
        const newNotification = await this.TicBoy_Notification.create({
            user_id: userId,
            notification: notification,
            isRead: false
        });
        newNotification.save();
    }

    async CreateNotification(userId, title, notification) {
        const newNotification = await this.User_Notification.create({
            user_id: userId,
            title: title,
            notification: notification,
            isRead: false
        });
        newNotification.save();
        await this.CreateTicBoyNotification(userId, title);
    }

    async generatePin() {
        return Math.floor(1000 + Math.random() * 9000);
    }

}

module.exports = DatabaseService;
