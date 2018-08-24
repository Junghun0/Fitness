var oauth2 = require('oauth2');
var {google} = require('googleapis');

var oauth2Client = new google.auth.OAuth2(
    "1047825588884-i4pj5on6ob34gmbotg6pb93fo1or44ja.apps.googleusercontent.com", // CLIENT_ID
    "tTo9LQ7b_n4XmkjoKm0wcmqI", // CLIENT_SECRET
    "https://localhost:5000/oauth2callback"); // Callback URL

var fitness = google.fitness('v1');

var dataSource = "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm";

var express = require('express');
var app = express();
var async = require('async');
var moment = require('moment');
var _ = require('lodash');
var request = require('request');

app.get('/', function(req, res) {
    if (checkCredentials(oauth2Client)) {
        // We have credentials.
        console.log('Credentials are present!');
        getBPMFromGoogle(res);
    } else {
        console.log('No credentials present');
        // No credentials
        var scopes = [
            'https://www.googleapis.com/auth/fitness.activity.read',
            'https://www.googleapis.com/auth/fitness.activity.write'
        ];

        // Need to generate an authentication URL in order to get a an endpoint.
        var url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Offline, otherwise we won't get a token
            scope: scopes // Fitness SCcope
        });

        // Redirect browser to URL, which in turn will redirect to the callback URL once OAuth2 has been performed.
        res.redirect(url);
        console.log("url->",url);
    }
})

app.get('/oauth2callback', function(req, res) {
    // The appropriate code gets returned by OAuth2
    var code = req.query.code;
    console.log("code@@",code);

    oauth2Client.getToken(code, function(err, token) {
        oauth2Client.setCredentials(token);
        console.log("get token ->",token.access_token);
        if(token != null){
            res.redirect('https://www.googleapis.com/fitness/v1/users/me/dataSources/derived%3Acom.google.heart_rate.bpm%3Acom.google.android.gms%3Amerge_heart_rate_bpm/datasets/0-8446744073709551616?access_token='+token.access_token);
            sendresponse(token.access_token);
        }

        console.log("refresh token->",token.refresh_token);
        console.log('Token set, redirecting to /');
        res.redirect('/');
    });
})

function getBPMFromGoogle(res) {

    // use the google-nodejs API for Fitness, include these params.
    fitness.users.dataSources.datasets.get({ userId: "me", auth: oauth2Client, dataSourceId: dataSource, datasetId: 0 + "-" + 84467440737}, function(err, _fitness) {
        if (err) {
            console.log("An error occured", err);
            return;
        }

        console.log("Fitness data received!");
        // Create the object we'll return to the user, creating some additional fields to fill in.
        var newDates = {
            minStartTimeNs: 0,
            maxEndTimeNs: 8446744073709551616,
            dataSourceId: 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm',
            point: []
        };

        console.log("_fitness",_fitness.data);

        // Begin the async, I usually find it's a good idea to make use of async whenever we're making requests
        // due to the nature of Javascript. It also gives me a bit more control.
        async.each(_fitness.point, function(item, callback) {

            // Some variables to make it more readable, could be included and chained with moment.
            var start = moment.unix(item.startTimeNanos / 1000000000);
            var end = moment.unix(item.endTimeNanos / 1000000000);

            console.log("item->",item);

            // Push each activity selgment from google into our data array.
            newDates.data.push({
                "name": item.dataTypeName,
                "value": item.value[0].intVal,
                "start": moment(start).format('YYYY-MM-DD HH:mm:ss'),
                "end": moment(end).format('YYYY-MM-DD HH:mm:ss')
            });

            //totalSteps += item.value[0].intVal;

            // Start with next item.
            callback();
        }, function(err) {
            if (!err) {

                //res.json(_fitness.data);
                //res.redirect('https://www.googleapis.com/fitness/v1/users/me/dataSources/derived%3Acom.google.heart_rate.bpm%3Acom.google.android.gms%3Amerge_heart_rate_bpm/datasets/0-8446744073709551616?access_token='+token);

            } else {
                console.log("Error");
            }
        })
    })
}

function sendresponse(token){

    var headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    var options = {
        url: 'https://www.googleapis.com/fitness/v1/users/me/dataSources/derived%3Acom.google.heart_rate.bpm%3Acom.google.android.gms%3Amerge_heart_rate_bpm/datasets/0-8446744073709551616?access_token='+token,
        method: 'GET',
        headers: headers
    };

    request(options, function(err, response, body){
        if(!err && response.statusCode === 200){
            console.log(body);

            app.get('/bpms',function (req,res) {
                console.log("/bpm 요청옴");
               res.send(JSON.parse(body));
            });
        }
    })
}

function checkCredentials(client) {
    // Check if credentials object is empty.
    if (!_.isEmpty(client.credentials)) {
        return true;
    } else {
        return false;
    }
}


var server = app.listen(5000, function () {

    var host = server.address().address;
    var port = server.address().port;

    console.log('This app is listening at http://%s:%s', host, port)

});