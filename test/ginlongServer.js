'use strict'

const ginlongSrv = require('../lib/ginlong');
const fs = require('fs');
const readline = require("readline");

const trmnl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var ginlong = new ginlongSrv();

var waitForCommand = function () {
  trmnl.question("ginlong server command to test (? for help)  ", function(answer) {
    if (answer == "?") {
        console.log("?    -- this help function\n" +
                    "gets -- get the current settings and store into JSON file\n" +
                    "sets -- upload new configuration from JSON file\n" +
                    "conn -- start listening for ginlong data\n" +
                    "disc -- stop listening for ginlong data\n" +
                    "quit -- close this application\n\n" );

    } else if (answer == "gets") {
      console.log('command: GET SETTINGS');
      let tmpSettings = ginlong.settings;
      console.log('cursettings : ' + JSON.stringify(tmpSettings) + '\n');
      fs.writeFileSync('./settings.json', tmpSettings);
    }else if (answer == "sets") {
      console.log('command: SET SETTINGS\n');
      let tmpSettings = fs.readFileSync('./settings.json');
      console.log('newsettings : ' + JSON.stringify(tmpSettings) + '\n');
      ginlong.settings = tmpSettings;
    } else if (answer == "conn") {
      console.log('command: START LISTENING');
      ginlong.create();
    } else if (answer == "disc") {
      console.log('command: STOP LISTENING'); 
      ginlong.destroy(); 
    } else if (answer == "quit") {
      console.log('closing down');
      trmnl.close();
    } 
        
    waitForCommand();   
  });
}

waitForCommand();

trmnl.on("close", function() {
    console.log("\nBYE BYE !!!");
    process.exit(0);
});
