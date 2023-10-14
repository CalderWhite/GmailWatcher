const Imap = require('imap');
const { simpleParser } = require('mailparser');

/**
 * Generic interface to process emails from GMail using IMAP filters & body regex parsing.
 * Once messages are processed, they are marked as read and moved to a designated folder
 * 
 * Calls `parseFunc` to turn emails into objects and `insertCallback` on successful parsing.
 * Example settings object:
 *  {
 *       username: 'test@example.com',
 *       password: 'password123',
 *       outputFolder: 'myEmails',
 *       imapFilters: [
 *           ['FROM', '@mydomain.com'],
 *           ['SUBJECT', 'Daily Mail']
 *       ],
 *  }
 * 
 */
class GmailProcessor {
    constructor(settings, parseFunc, insertCallback) {
        this.imap = new Imap({
            user: settings.username,
            password: settings.password,
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });
        this.settings = settings;
        this.parseFunc = parseFunc;
        this.insertCallback = insertCallback;
    }

    moveMsgOutOfInbox(uid) {
        this.imap.move(uid, this.settings.outputFolder, err => {
            if (err) {
                throw err;
            }
            this.imap.end();
        })
        this.imap.addFlags(uid, ['\\Seen'], err => {
            if (err) {
                throw err;
            }
        });
    }

    processIMAPSearchResults(searchErr, results) {
        if (searchErr) {
            throw searchErr;
        }

        let f;
        try {
            f = this.imap.fetch(results, { bodies: '' });
        } catch (err) {
            if (err.message != "Nothing to fetch") {
                throw err;
            }
        }

        // if there are no results, return
        if (!f) {
            this.imap.end();
            return;
        }

        f.on('message', msg => {
            let stream;
            let uid;
            msg.on('body', stream_in => {
                stream = stream_in;
            });
            msg.once('attributes', attrs => {
                uid = attrs.uid;
            });

            msg.once('end', () => {
                // we only move the email out of the inbox if we parse
                // it succesfully (both as an email and a transaction)
                simpleParser(stream, async (err, parsed) => {
                    const { txn, parseErr } = this.parseFunc(parsed);
                    if (!parseErr) {
                        this.insertCallback(txn);
                        // this.mongoDBCollection.insertOne(txn);
                        // moveMsgOutOfInbox(uid);
                    }
                });
            });
        });

        f.once('error', ex => {
            return Promise.reject(ex);
        });

        f.once('end', () => {
            this.imap.end();
        });
    }

    run() {
        this.imap.once('ready', () => {
            this.imap.openBox('INBOX', false, () => {
                this.imap.search(
                    this.settings.imapFilters,
                    (err, results) => this.processIMAPSearchResults(err, results)
                );
            });
        });

        this.imap.once('error', err => {
            throw err;
        });

        this.imap.connect();
    }
}
