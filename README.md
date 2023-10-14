# GmailWatcher
A simple yet functional email processor written in NodeJS!

NOTE: You will need to use an "app password" for gmail. [\[More info\]](https://support.google.com/accounts/answer/185833?hl=en)

# Usage

```javascript
const GmailWatcher = require('cwhite-gmail-watcher');
```

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
 *       keepEmail: true,               // optional. If true, the emails will not be moved upon succesful processing
 *       targetDomain: 'example.com',   // the domain you should be receiving these emails from. This is used to verify certificates
 *       outputFolder: 'myEmails',
 *       imapFilters: [
 *           ['FROM', '@mydomain.com'],
 *           ['SUBJECT', 'Daily Mail']
 *       ],
 *  }
 */
```

# Example

This is how I save my Credit Card transactions in AWS Lambda!    
(Anything marked as `HIDDEN` has been removed as I consider it sensitive)    
(I wish I could have used Mongo Atlas Functions, but they ran into issues with IMAP)

```javascript
import GmailWatcher from "cwhite-gmail-watcher";
import { MongoClient, ServerApiVersion } from 'mongodb';

const txnRegex = RegExp("[HIDDEN]);
const uri = `[HIDDEN]`;

function parseTxn({ messageId, text, date }) {
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
      _id: messageId,
      cardName,
      cardNumberSuffix,
      timestamp: date,
      amount,
      merchant
    },
    parseErr: false
  };
}

export const handler = event => {
  const mongoClient = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  const g = new GmailWatcher(
    {
      username: '[HIDDEN]',
      password: process.env.GOOGLE_APP_PASSWORD,
      targetDomain: "[HIDDEN]",
      keepEmail: true,
      outputFolder: "[HIDDEN]",
      imapFilters: [
        ['FROM', '@[HIDDEN]'],
        ['SUBJECT', '[HIDDEN]']
      ],
    },
    parseTxn,
    txn => {
      return mongoClient
        .db("[HIDDEN]")
        .collection("[HIDDEN]")
        .insertOne(txn)
    },
  );

  mongoClient.connect().then(() => {
    try {
      g.run(async () => {
        await mongoClient.close();
      });
    } catch (err) {
      console.log("cwhite: General Error");
      console.log(err.stack)
      throw err;
    }

  }).catch(err => {
    console.log("cwhite: Error connecting to MongoDB");
    console.log(err.stack)
    throw err;
  });
}
```
