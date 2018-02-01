/*
 * Wire
 * Copyright (C) 2017 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

//const service = require('wire-bot-sdk-node');

const service = require('../lib/service');
const config = require('./configs/config')

var opts = config.getBotOptions();


service.createService(opts, (bot) => {
  console.log(`Bot instance created ${bot.botID}`);

  bot.on('message', (from, message) => {
    var msg = message.text.content;
    console.log(`Got message from ${from} text: ${msg}`);
    reply = "";

    if (msg.toLowerCase() == "help") {
      reply = "```";
      reply += "\n+ get gitlab hook # return the webhook URL, unique per chat";
      reply += "\n+ get gitlab token # return the webhook's secret token, unique per chat.";
      reply += "\n+ reset gitlab token # reset the webhook's secret token. Old hooks will break!";
      reply += "\n+ jira help # get JIRA integration related help message";
      reply += "\n```"
    }
    else if (msg.toLowerCase() == "get gitlab hook") {
      var exec = require('child_process').exec;
      var cmd = 'dig +short myip.opendns.com @resolver1.opendns.com';

      exec(cmd, function(error, stdout, stderr) {
        bot.sendMessage(`https://${stdout.trim()}:${opts.port}/bots/${bot.botID}/gitlab`, (sendStatus) => {
          console.log(`message successfully sent with status ${sendStatus}`);
        });
      });
    }
    else if (msg.toLowerCase() == "get gitlab token") {
      reply = bot.getGitlabToken();
    }
    else if (msg.toLowerCase() == "reset gitlab token") {
      reply = bot.getGitlabToken(true);
    }
    else if (msg.toLowerCase() == "jira help") {
      reply = "```";
      reply += "\n+ set jira <api URL> # e.g. jira.example.com, jira.example.com:8443/rest/api/latest";
      reply += "\n\t1. only support https, port default 443, api root path default /rest/api/latest";
      reply += "\n+ set jira auth <basic_auth_token> # e.g. dXNlcm5hbWU6cGFzc3dvcmQ=";
      reply += "\n+ set jira alias <alias>=<key> # set up to 10 jira command aliases";
      reply += "\n\t1. set jira alias note=PROJ would allow you to do \"note: <value>\" in the future ";
      reply += "\n\t\tto create an issue under project PROJ with description = value";
      reply += "\n\t2. set jira alias note=PROJ-10 would allow you to do \"note: <value>\" in the future ";
      reply += "\n\t\tto append <value> to the issue PROJ-10";
      reply += "\n+ remove jira alias <alias> - remove that jira aliases";
      reply += "\n+ jira config # show current configs and aliases. SHA256 value of auth token is shown";
      reply += "\n+ jira alias # show current aliases.";
      reply += "\n```";
    }
    else if (msg.toLowerCase().startsWith("set jira")) {
      var cmdArray = msg.split(/ +/);
      if (cmdArray.length == 3) {
        bot.configJira(cmdArray[2]);
      }
      else if (cmdArray.length == 4 && cmdArray[2] == "auth") {
        bot.configJira(null, cmdArray[3]);
      }
      else if (cmdArray.length >= 4 && cmdArray[2] == "alias") {
        if (cmdArray.length > 4) {
          reply = "Please make sure it's in alias=key format. No space, one pair per command. "
            +"alias is letters only, and key is alphanumeric plus dash";
        }
        else {
          var pair = cmdArray[3].split("=");
          if (pair.length == 2 && pair[0].match(/^[a-zA-Z]+$/) && pair[1].match(/^[a-zA-Z]+-?\d*$/)) {
            var newAlias = {};
            newAlias[pair[0]] = pair[1];
            bot.configJira(null, null, newAlias);
          }
          else {
            reply = "Please make sure it's in alias=key format. No space, one pair per command";
              +"alias is letters only, and key is alphanumeric plus dash";
          }
        }
      }
      else {
        reply = "Invalid format. Type \"jira help\" for more info";
      }
    }
    else if (msg.toLowerCase() == "jira config") {
      reply = bot.jiraConfig();
    }
    else if (msg.toLowerCase() == "jira alias") {
      reply = JSON.stringify(bot.jiraConfig(1).aliases);
    }
    else if (msg.toLowerCase().startsWith("loot:")) {
      // get the caller's name from Wire API
      bot.sendApiCall("GET", `/bot/users?ids=${from}`, null, null, (respData, statusCode) => {
          console.log(`API call got status ${statusCode}`);
          var name = 'Unknown';
          try {
            var data = JSON.parse(respData);
            name = data[0].name;
          } catch (e) {
            console.log("Not JSON parsable");
          }

          // compile data for jira
          var content = {
              "loot": msg.substring(5, msg.length),
              "summary": msg.substring(5, Math.min(60, msg.length)).replace(/\n/g, " "),
              "reporter": name
          };
          bot.jira("create", content);
      });
    }
    else if (msg.toLowerCase().match(/^[a-z]+:/)) {
      var cmd = msg.toLowerCase().match(/^[a-z]+:/)[0];
      cmd = cmd.substring(0, cmd.length - 1);
      if (bot.aliases != null && bot.aliases[cmd]) {
        reply = bot.aliases[cmd];
      }
      else {
        bot.jiraConfig(); // this will sync bot.aliases object with what's in persistent storage;
        reply = "no match";
      }
    }

    if (reply != "") {
      bot.sendMessage(reply, (sendStatus) => {
        console.log(`message successfully sent with status ${sendStatus}`);
      });
    }

    var atNotation = /@[a-z0-9]*/ig;
    var results = msg.match(atNotation);

    if (results != null) {
      bot.pushover(results);
    }
  });


  bot.on('gitlabPush', (data) => {
    console.log("Got push event from gitlab")
    var msg = `${data['user_name']} pushed to project ${data.project.name} (url: ${data.project.homepage})`;
    bot.sendMessage(msg, (sendStatus) => {
      console.log(`message successfully sent with status ${sendStatus}`);
    });
  });

  bot.on('send', (text) => {
    bot.sendMessage(text, (sendStatus) => {
      console.log(`message successfully sent with status ${sendStatus}`);
    });
  });


  bot.on('join', (members, conversation) => {
    console.log(`New members ${members} joined conversation ${conversation.id}`);
  });
  bot.on('leave', (members, conversation) => {
    console.log(`Members ${members} have left conversation ${conversation.id}`);
  });
  bot.on('rename', (name, conversation) => {
    console.log(`Conversation ${conversation.id} renamed to ${name}`);
  });
  bot.on('image', (from, asset) => {
    /*
    console.log(asset);

    { message_id: 'f277ba7b-0d3a-46b6-9cd6-16e08de5c1aa',
    asset: 
    {original: { mime_type: 'image/png', size: 355, name: '', image: [Object] },
     uploaded: 
      { otr_key: <Buffer 21 1b aa e0 7a b5 ed 0a 3d 89 27 73 e5 af 7e f5 56 0d 7c b3 9f c6 5b f7 a3 42 93 00 6d a3 e3 26>,
        sha256: <Buffer 4d 5b 51 5e 48 d6 ac d7 71 26 12 59 10 23 12 23 b6 99 ac 3b 38 30 9e 49 14 28 53 36 42 6e 2b c6>,
        asset_id: '3-2-cbcad9b9-19b4-406c-b560-aeb6de1418fe',
        asset_token: 'r5gfiW-wlLDXBed5_3M4kg==' },
     preview: null } }
     */
    /*
    bot.getAsset?
    bot.sendImage(asset.asset.original.image, asset.asset.original.mime_type, asset.asset.original.image, (sendStatus) => {
      console.log(`message successfully sent with status ${sendStatus}`);
    });
    */
  });
});
