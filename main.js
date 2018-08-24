/****************************
 SETTING MODULES AND VARIABLES
 ****************************/

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const opn = require('opn');
const request = require('request');
const express = require('express');
const querystring = require('querystring');
const destroyer = require('server-destroy');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
//require('console-stamp')(console, '[yyyy-mm-dd HH:MM:ss.l]');
const {google} = require('googleapis');
const fitness = google.fitness('v1');
var async = require('async');
var app = express();
var port = 5000;
app.set('port', port);
//app.set('view engine', 'jade');
//app.use(cookieParser());
//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({
//  extended: true
//}));

// create oauth key variable using oauth key file
const keyPath = path.join(__dirname, 'oauth2.keys.json');
let keys = {
    redirect_uris: ['https://localhost:5000/oauth2callback']
};
if (fs.existsSync(keyPath)) {
    keys = require(keyPath).web;
}



// create oauth2Client
const oauth2Client = new google.auth.OAuth2(
    keys.client_id,
    keys.client_secret,
    keys.redirect_uris[0]
);

google.options({
    auth: oauth2Client
});

const scopes = [
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.body.write'
];


/*****************
 IMPLEMENT FUNCTION
 1. get - authorization code
 2. post - code, client id, client secret
 3. get - access token, refresh token
 ******************/
function authenticate(scopes) {
    return new Promise((resolve, reject) => {
        console.log("1");

    const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        //scope: scopes.join(' ')
        scope: scopes
    });

    console.log("authorizeUrl:" + authorizeUrl);
    console.log("2");

    const server = http.createServer(async (req, res) => {
        console.log("3");
    try {
        console.log("4");
        // 1. get - authorization code
        if (req.url.indexOf('/oauth2callback') > -1) {
            //  if (req.url.indexOf('/__/auth/handler') > -1) {
            console.log("5");
            const qs = querystring.parse(url.parse(req.url).query);
            console.log("req.url:" + req.url);

            console.log("qs:" + qs.code);
            const {tokens} = oauth2Client.getToken(qs.code);

            oauth2Client.credentials = tokens;
            console.log("authorization code: " + qs.code);

            console.log("token_uri",keys.token_uri);
            console.log("client_id->",keys.client_id);
            console.log("client_secret->",keys.client_secret);


            // 2. post - code, client id, client secret
            var options = {
                method: 'POST',
                url: keys.token_uri,
                headers: {
                    'content-type': 'application/json'
                },
                body: {
                    grant_type: 'authorization_code',
                    client_id: keys.client_id,
                    client_secret: keys.client_secret,
                    code: qs.code,
                    redirect_uri: keys.redirect_uris[0]
                },
                json: true
            };

            request(options, function(error, response, body) {
                if (error) throw new Error(error);

                console.log(body.refresh_token);
                console.log(body.username);
                //REFRESH_TOKEN = body.refresh_token;
            });
            //res.send("authorization code : " + qs.code);

            resolve(oauth2Client);
        }
    } catch (e) {
        reject(e);
    }
}).listen(5000, () => {
        opn(authorizeUrl, {
            wait: false
        }).then(cp => cp.unref());
});
    destroyer(server);
});
}
async function runSample() {
    fitness.users.dataSources.datasets.get({
        userId: 'me',
        dataSourceId: 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm',
        datasetId: '0-84467440737'
    }, function(err, response) {
        console.log("Error: " + JSON.stringify(err, null, 2));
    });
}

/**************
 RUN THE PROGRAM
 ***************/

authenticate(scopes)
    .then(client => runSample(client))
.catch(console.error);