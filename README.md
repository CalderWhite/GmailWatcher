# GmailWatcher
A simple yet functional email processor written in NodeJS!

NOTE: You will need to use an "app password" for gmail. [\[More info\]](https://support.google.com/accounts/answer/185833?hl=en)

# Documentation

The inline doc from the class:
```javascript
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
```

# Example

This is how I save my Credit Card transactions in MongoDB!    
(Anything marked as `HIDDEN` has been removed as I consider it sensitive)

```javascript
const txnRegex = RegExp("[HIDDEN]");

let g = new GmailProcessor(
    {
        username: '[HIDDEN]',
        password: '[HIDDEN]',
        outputFolder: '[HIDDEN]',
        imapFilters: [
            ['FROM', '[HIDDEN]'],
            ['SUBJECT', '[HIDDEN]']
        ],
    },
    ({ text, date }) => {
        let res = txnRegex.exec(text);
        if (!res) {
            return { txn: null, parseErr: true };
        }

        const cardName = res[1];
        const cardNumberSuffix = res[2];
        const dollars = res[3] === '' ? 0 : Number(res[3]);
        const cents = Number(res[4]);
        const merchant = res[5];

        const amount = dollars + (cents / 100);

        return {
            txn: {
                date,
                cardName,
                cardNumberSuffix,
                amount,
                merchant
            },
            parseErr: false
        };
    },
    txn => {
        // databaseName: '[HIDDEN]',
        // collectionName: '[HIDDEN]',
        console.log(txn);
    },
);

g.run();
```
