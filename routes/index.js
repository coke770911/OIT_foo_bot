var express = require('express');
var router = express.Router();
var request = require('request');

/* GET home page. */
router.get('/', function(req, res, next) {
    //res.render('index', { title: 'Express' });
    res.json("OK")
});


/* Sequelize ORM */
const Sequelize = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite'
});
const Model = Sequelize.Model;

class Foos extends Model {}

Foos.init({
    foo_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    foo_store: Sequelize.STRING,
    foo_time: Sequelize.STRING,
    foo_keyword: Sequelize.TEXT,
    foo_url: Sequelize.STRING,
    foo_del: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    }

}, { sequelize, modelName: 'Foos' });


/* goole API*/
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = 'token.json';

fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content), foodbLoad);
});

function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

function foodbLoad(auth) {
    const sheets = google.sheets({ version: 'v4', auth });
    sheets.spreadsheets.values.get({
        spreadsheetId: '1hQa_IUd5vQzFk-e_k-9O0S_AIV2zh6rooe6gqP-vr4E',
        range: '工作表1!A2:E',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const rows = res.data.values;
        if (rows.length) {
            console.log('Name, Major:');
            Foos.sync({ force: true }).then(() => {
                rows.map((row) => {
                    Foos.create({
                        foo_store: row[0],
                        foo_time: row[1],
                        foo_keyword: row[2],
                        foo_url: row[3],
                    });
                });
            });
            console.log('Load data OK.');
        } else {
            console.log('No data found.');
        }
    });
}


router.get('/load', function(req, res) {
    request({
        uri: "https://sheetdb.io/api/v1/ryt19gjxt8ph8",
        json: true
    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            if (body.length > 0) {
                Foos.sync({ force: true }).then(() => {
                    for (var i = 0; i < body.length; i++) {
                        Foos.create({
                            foo_store: body[i].foo_store,
                            foo_time: body[i].foo_time,
                            foo_keyword: body[i].foo_keyword,
                            foo_url: body[i].foo_url,
                        });
                    }
                });
            }
            res.json("load data ok");
        } else {
            console.log("[google sheet] failed");
        }
    });
});

router.get('/webhook', function(req, res) {
    var foo_keyword = req.query.foo_keyword ? req.query.foo_keyword : 1;
    var foo_time = req.query.foo_time ? req.query.foo_time : 1;
    var Op = Sequelize.Op

    Foos.findAll({
            where: {
                [Op.or]: [{
                        foo_keyword: {
                            [Op.substring]: foo_keyword
                        }
                    },
                    {
                        '': {
                            [Op.eq]: foo_keyword
                        }
                    }
                ],
                [Op.and]: {
                    [Op.or]: [{
                            foo_time: {
                                [Op.substring]: foo_time
                            }
                        },
                        {
                            '': {
                                [Op.eq]: foo_time
                            }
                        }
                    ]
                }
            }
        })
        .then(function(result) {
            res.json(result);
        });
});

router.post('/webhook', function(req, res) {
    var data = req.body;
    var foo_keyword = data.queryResult.parameters["foo_keyword"];
    var foo_time = data.queryResult.parameters["foo_time"];
    foo_time = foo_time === '' ? foo_time : 1;
    var Op = Sequelize.Op

    Foos.findAll({
            where: {
                foo_keyword: {
                    [Op.substring]: foo_keyword
                },
                [Op.or]: [{
                        foo_time: {
                            [Op.substring]: foo_time
                        }
                    },
                    {
                        '': {
                            [Op.eq]: foo_time
                        }
                    }
                ]
            }
        })
        .then(function(result) {
            var index_num = Math.floor(Math.random() * result.length);
            if (result.length > 0) {
                res.json({ fulfillmentText: "推薦您吃 " + result[index_num].foo_store + result[index_num].foo_url});
            } else {
                res.json({ fulfillmentText: "找不到您想吃的東西，請再試試看別的關鍵字。" });
            }
        });
});

module.exports = router;