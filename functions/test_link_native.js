
const https = require('https');

const url = "https://us-central1-musa-link.cloudfunctions.net/createStripeAccountLink";
const data = JSON.stringify({
    data: {
        accountId: "acct_1Sn1ToGh1ifwJu9c" // The "Broken" Account ID
    }
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(url, options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
