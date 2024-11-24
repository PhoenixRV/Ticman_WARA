const Imap = require('imap');
const {simpleParser} = require('mailparser');
const nodemailer = require('nodemailer');
const DatabaseService = require("./DatabaseService.js");
const {where} = require("sequelize");
const dbService = new DatabaseService();
const config = require('./config.js');

class MailService {
    constructor() {
        this.imap = null;
    }

    openInbox(cb) {
        this.imap.openBox('INBOX', true, cb);
    }

    async configureImap() {
        this.imap = new Imap({
            user: config.imap.user,
            password: config.imap.password,
            host: config.imap.host,
            port: parseInt(config.imap.port),
            tls: true,
            /*tlsOptions: {
                rejectUnauthorized: false // UNSICHER: Akzeptiert alle Zertifikate
            }*/
        });

        this.imap.once('ready', () => {
            this.openInbox((err, box) => {
                if (err) throw err;
                this.imap.on('mail', () => {
                    this.imap.search(['UNSEEN'], (err, results) => {
                        if (err) throw err;
                        if (!results || results.length === 0) return;

                        // Holen Sie sich nur die letzte E-Mail
                        const latestEmailUid = results[results.length - 1];

                        const mail = this.imap.fetch(latestEmailUid, {
                            bodies: ""
                        });
                        mail.on("message", (message, seq) => {
                            message.on("body", stream => {
                                let buffer = "";
                                simpleParser(stream, async (err, parsed) => {
                                    if (err) throw err;
                                    const {from, subject, text} = parsed;
                                    const senderEmail = from.value[0].address;

                                    const ticketIdMatch = subject.match(/\[TicID: #(\d+)\]/);
                                    if (ticketIdMatch) {
                                        const ticketId = ticketIdMatch[1];
                                        const ticket = await dbService.Tickets.findOne({where: {id: ticketId}});
                                        if (ticket) {
                                            const user = await dbService.User.findOne({where: {mail: senderEmail}})
                                            if (user) {
                                                await dbService.Ticket_Comments.create({
                                                    ticket_id: ticketId,
                                                    user_id: user.id,
                                                    comment: text,
                                                });
                                            } else {
                                                await dbService.Ticket_Comments.create({
                                                    ticket_id: ticketId,
                                                    user_id: 0,
                                                    comment: text,
                                                });
                                            }
                                        } else {
                                            await this.sendRejectionTicketId(senderEmail, subject, ticketId);
                                        }
                                    } else {
                                        const user = await dbService.User.findOne({where: {mail: senderEmail}})
                                        if (user) {
                                            const newTicket = await dbService.Tickets.create({
                                                title: subject,
                                                description: text,
                                                status: 1,
                                                priority: 1,
                                                user_id: user.id,
                                            });
                                            await this.sendTicketConfirmationEmail(newTicket.id, subject, senderEmail);
                                        } else {
                                            await this.sendRejectionEmail(senderEmail, subject);
                                        }
                                    }
                                    // Hier können Sie den Code einfügen, um die E-Mail-Daten zu verarbeiten

                                    // E-Mail direkt löschen
                                    this.imap.addFlags(latestEmailUid, 'Deleted', (err) => {
                                        if (err) {
                                            console.error(`Error marking email as deleted: ${err}`);
                                        } else {
                                            //console.log(`Email ${seq} marked as deleted`);
                                            this.imap.expunge((err) => {
                                                if (err) {
                                                    console.error(`Error expunging emails: ${err}`);
                                                } else {
                                                    //console.log('Expunge completed');
                                                }
                                            });
                                        }
                                    });
                                });
                                stream.on("data", chunk => (buffer += chunk.toString("utf8")));
                                stream.once("end", () => {
                                });
                            });
                        });
                        mail.once('error', (err) => {
                            console.log('Fetch error: ' + err);
                        });
                    });
                });
            });
        });

        this.imap.once('error', function (err) {
            console.log(err);
        });

        this.imap.connect();
    }

    async sendTicketConfirmationEmail(ticketId, subject, recipientEmail) {
        let transporter = nodemailer.createTransport({
            host: config.smtp.host, // SMTP-Server Ihres E-Mail-Providers
            port: parseInt(config.smtp.port), // Port für den SMTP-Server
            secure: false, // true für Port 465, false für andere Ports
            auth: {
                user: config.smtp.user, // Ihre E-Mail-Adresse
                pass: config.smtp.password // Ihr E-Mail-Passwort
            }/*,
            tls: {
                rejectUnauthorized: false // UNSICHER: Akzeptiert alle Zertifikate
            }*/
        });

        // E-Mail-Inhalt
        let mailOptions = {
            from: `"Support Team" <${config.smtp.user}>`, // Absender-Adresse
            to: recipientEmail, // Empfänger-Adresse
            subject: `AW: [TicID: #${ticketId}] ${subject}`, // Betreffzeile
            text: `Sehr geehrte/r Kunde/in,

Ihr Ticket mit der ID ${ticketId} ist erfolgreich in unser TicketSystem eingegangen.

Unser Support-Team wird sich so schnell wie möglich mit Ihnen in Verbindung setzen.

Wenn Sie weitere Informationen haben, antworten Sie auf diese Mail, andernfalls wird ein neues Ticket erstellt.

Mit freundlichen Grüßen,
Ihr Support-Team`,
            html: `<p>Sehr geehrte/r Kunde/in,</p>
               <p>Ihr Ticket mit der ID <strong>${ticketId}</strong> ist erfolgreich in unser TicketSystem eingegangen.</p>
               <p>Unser Support-Team wird sich so schnell wie möglich mit Ihnen in Verbindung setzen.</p>
               <p>Wenn Sie weitere Informationen haben, antworten Sie auf diese Mail, andernfalls wird ein neues Ticket erstellt.</p>
               <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>`
        };

        // E-Mail senden
        try {
            let info = await transporter.sendMail(mailOptions);
            console.log('Message sent: %s', info.messageId);
        } catch (error) {
            console.error('Error sending email:', error);
        }
    }

    async sendRejectionEmail(recipientEmail, subject) {
        let transporter = nodemailer.createTransport({
            host: config.smtp.host, // SMTP-Server Ihres E-Mail-Providers
            port: parseInt(config.smtp.port), // Port für den SMTP-Server
            secure: false, // true für Port 465, false für andere Ports
            auth: {
                user: config.smtp.user, // Ihre E-Mail-Adresse
                pass: config.smtp.password // Ihr E-Mail-Passwort
            }/*,
            tls: {
                rejectUnauthorized: false // UNSICHER: Akzeptiert alle Zertifikate
            }*/
        });

        // E-Mail-Inhalt
        let mailOptions = {
            from: `"Support Team" <${config.smtp.user}>`, // Absender-Adresse
            to: recipientEmail, // Empfänger-Adresse
            subject: `Re: ${subject}`, // Betreffzeile
            text: `Sehr geehrte/r Kunde/in,

leider konnten wir Ihre E-Mail nicht in unserem System finden.

Bitte überprüfen Sie Ihre Angaben und senden Sie uns gegebenenfalls Ihre Anfrage erneut.

Mit freundlichen Grüßen,
Ihr Support-Team`,
            html: `<p>Sehr geehrte/r Kunde/in,</p>
               <p>leider konnten wir Ihre E-Mail nicht in unserem System finden.</p>
               <p>Bitte überprüfen Sie Ihre Angaben und senden Sie uns gegebenenfalls Ihre Anfrage erneut.</p>
               <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>`
        };

        // E-Mail senden
        try {
            let info = await transporter.sendMail(mailOptions);
            console.log('Message sent: %s', info.messageId);
        } catch (error) {
            console.error('Error sending email:', error);
        }
    }

    async sendRejectionTicketId(recipientEmail, subject, ticketId) {
        let transporter = nodemailer.createTransport({
            host: config.smtp.host, // SMTP-Server Ihres E-Mail-Providers
            port: parseInt(config.smtp.port), // Port für den SMTP-Server
            secure: false, // true für Port 465, false für andere Ports
            auth: {
                user: config.smtp.user, // Ihre E-Mail-Adresse
                pass: config.smtp.password // Ihr E-Mail-Passwort
            }/*,
            tls: {
                rejectUnauthorized: false // UNSICHER: Akzeptiert alle Zertifikate
            }*/
        });

        // E-Mail-Inhalt
        let mailOptions = {
            from: `"Support Team" <${config.smtp.user}>`, // Absender-Adresse
            to: recipientEmail, // Empfänger-Adresse
            subject: `Re: ${subject}`, // Betreffzeile
            text: `Sehr geehrte/r Kunde/in,

leider konnten wir Ihre TicketID nicht in unserem System finden.

Bitte überprüfen Sie Ihre Angaben und senden Sie uns gegebenenfalls Ihre Anfrage erneut.

Mit freundlichen Grüßen,
Ihr Support-Team`,
            html: `<p>Sehr geehrte/r Kunde/in,</p>
               <p>leider konnten wir Ihre TicketID nicht in unserem System finden.</p>
               <p>Bitte überprüfen Sie Ihre Angaben und senden Sie uns gegebenenfalls Ihre Anfrage erneut.</p>
               <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>`
        };

        // E-Mail senden
        try {
            let info = await transporter.sendMail(mailOptions);
            console.log('Message sent: %s', info.messageId);
        } catch (error) {
            console.error('Error sending email:', error);
        }
    }

    async sendEmailUpdate(recipientEmail, ticketId, updateType, updateDetails) {
        let transporter = nodemailer.createTransport({
            host: config.smtp.host, // SMTP-Server Ihres E-Mail-Providers
            port: parseInt(config.smtp.port), // Port für den SMTP-Server
            secure: false, // true für Port 465, false für andere Ports
            auth: {
                user: config.smtp.user, // Ihre E-Mail-Adresse
                pass: config.smtp.password // Ihr E-Mail-Passwort
            }/*,
            tls: {
                rejectUnauthorized: false // UNSICHER: Akzeptiert alle Zertifikate
            }*/
        });
        let mailOptions = {};

        switch (updateType) {
            case 'status':
                mailOptions = {
                    from: `"Support Team" <${config.smtp.user}>`, // Absender-Adresse
                    to: recipientEmail, // Empfänger-Adresse
                    subject: `Ticket-Update [TicID: #${ticketId}]: Statusänderung für Ticket`, // Betreffzeile
                    text: `Sehr geehrte/r Kunde/in,

Ihr Ticket mit der ID ${ticketId} wurde in unserem System aktualisiert.

Der neue Status des Tickets ist nun: ${updateDetails}

Bitte antworten Sie auf diese E-Mail, wenn Sie weitere Fragen haben.

Mit freundlichen Grüßen,
Ihr Support-Team`,
                    html: `<p>Sehr geehrte/r Kunde/in,</p>
               <p>Ihr Ticket mit der ID <strong>${ticketId}</strong> wurde in unserem System aktualisiert.</p>
               <p>Der neue Status des Tickets ist nun: ${updateDetails}</p>
               <p>Bitte antworten Sie auf diese E-Mail, wenn Sie weitere Fragen haben.</p>
               <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>`
                };
                break;
            case 'comment':
                mailOptions = {
                    from: `"Support Team" <${config.smtp.user}>`, // Absender-Adresse
                    to: recipientEmail, // Empfänger-Adresse
                    subject: `Ticket-Update [TicID: #${ticketId}]: Neuer Kommentar für Ticket`, // Betreffzeile
                    text: `Sehr geehrte/r Kunde/in,

Ihr Ticket mit der ID ${ticketId} hat einen neuen Kommentar.

Der Kommentar lautet: ${updateDetails}

Bitte antworten Sie auf diese E-Mail, wenn Sie weitere Fragen haben.

Mit freundlichen Grüßen,
Ihr Support-Team`,
                    html: `<p>Sehr geehrte/r Kunde/in,</p>
               <p>Ihr Ticket mit der ID <strong>${ticketId}</strong> hat einen neuen Kommentar.</p>
               <p>Der Kommentar lautet: ${updateDetails}</p>
               <p>Bitte antworten Sie auf diese E-Mail, wenn Sie weitere Fragen haben.</p>
               <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>`
                };
                break;
            default:
                mailOptions = {
                    from: `"Support Team" <${config.smtp.user}>`, // Absender-Adresse
                    to: recipientEmail, // Empfänger-Adresse
                    subject: `Ticket-Update [TicID: #${ticketId}]: Das Ticket wurde Aktualisiert`, // Betreffzeile
                    text: `Sehr geehrte/r Kunde/in,

Ihr Ticket mit der ID ${ticketId} wurde aktualisiert.

Details: ${updateDetails}

Bitte antworten Sie auf diese E-Mail, wenn Sie weitere Fragen haben.

Mit freundlichen Grüßen,
Ihr Support-Team`,
                    html: `<p>Sehr geehrte/r Kunde/in,</p>
               <p>Ihr Ticket mit der ID <strong>${ticketId}</strong> wurde aktualisiert.</p>
               <p>Details: ${updateDetails}</p>
               <p>Bitte antworten Sie auf diese E-Mail, wenn Sie weitere Fragen haben.</p>
               <p>Mit freundlichen Grüßen,<br>Ihr Support-Team</p>`
                };
                break;
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
        });
    }
}

module.exports = MailService;
