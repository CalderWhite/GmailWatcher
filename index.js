const Imap = require('imap');
const { simpleParser } = require('mailparser');
const WaitGroup = require('waitgroup');

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

    async moveMsgOutOfInbox(uid) {
        await this.imap.move(uid, this.settings.outputFolder, err => {
            if (err) {
                throw err;
            }
            this.imap.end();
        })
        await this.imap.addFlags(uid, ['\\Seen'], err => {
            if (err) {
                throw err;
            }
        });
    }

    verifyEmailSignature(headerLines) {
        // verify the signature of the sender
        let foundDKIM = false;
        let foundDMARC = false;
        let foundSPF = false;
        for (let i = 0; i < headerLines.length; i++) {
            const { key, line } = headerLines[i];
            if (key === "arc-authentication-results" || key === "authentication-results") {
                // only trust google's certs
                if (!line.includes("Authentication-Results: mx.google.com;")) {
                    continue;
                }

                if (line.includes(`dkim=pass header.i=@${this.settings.targetDomain}`)) {
                    foundDKIM = true;
                }
                if (line.includes("dmarc=pass") && line.includes(`header.from=${this.settings.targetDomain}`)) {
                    foundDMARC = true;
                }
                if (line.includes("spf=pass")) {
                    foundSPF = true;
                }
            }

            if (foundDKIM && foundDMARC && foundSPF) {
                break;
            }
        }

        return foundDKIM && foundDMARC;
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

        let wg = new WaitGroup();
        f.on('message', msg => {
            wg.add();
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
                    if (!this.verifyEmailSignature(parsed.headerLines)) {
                        console.log("WARNING: SPOOFED EMAIL: ");
                        console.log(parsed);
                    }
                    const { txn, parseErr } = this.parseFunc(parsed);
                    if (!parseErr) {
                        let err = false;
                        try {
                            await this.insertCallback(txn);
                        } catch (e) {
                            console.log(e);
                            err = true;
                        }

                        if (!err) {
                            await this.moveMsgOutOfInbox(uid);
                        }
                    }

                    wg.done();
                });
            });
        });

        f.once('error', ex => {
            return Promise.reject(ex);
        });

        f.once('end', () => {
            wg.wait(() => this.imap.end());
        });
    }

    run(callback) {
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

        this.imap.once('end', () => {
            callback();
        })
    }
}

module.exports = GmailProcessor;