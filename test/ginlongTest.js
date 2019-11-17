'use strict'

const csv = require('csvtojson');
const loki = require('lokijs');
const readline = require("readline");
const net = require('net');
//const buff = require('buffer');


const trmnl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var solar = new loki();
var solarData = null;
solar.addCollection('data');

function importCsvData(csvFile, collectionName, update = false) {

  csv({
      delimiter:','
    })
    .fromFile(csvFile)
    .then((jsonObj)=>{
      if (update) {
        collectionName.clear();  
      } 
      collectionName.insert(jsonObj);    
    })

}


var settings = {
  host: '127.0.0.1',
  port: 9999
};
var client = null;
function openConnection() {
  let sock = new net.Socket();
  
  
  sock.connect(settings.port);
  sock.on('connect', () => {
    console.log('\n  new connection opened');
    console.log('  %s:%s -> %s:%s', sock.localAddress, sock.localPort, sock.remoteAddress, sock.remotePort);
    sock.setTimeout(1000*30);    
  })
  sock.on('data', (data) => {
    console.log('  HEY, we received something : %s', data);
  });
  sock.on('end', () => {
    console.log('  connection ended');
  });
  sock.on('close', (had_error) => {
    console.log('  closing the connection');
  });
  sock.on('error', (err) => {
    console.error('  error encountered : %s', err);
  });
  sock.on('timeout', () => {
    console.error('  TIMEOUT !!');
    sock.end();
  });

  
  return sock;
}

var waitForCommand = function () {
  trmnl.question("ginlong command to test (? for help)  ", function(answer) {
    if (answer == "?") {
        console.log("?     -- this help function\n" +
                    "open  -- try to open a connection towards the 'ginlong server'\n" +
                    "send  -- send a line of data\n" +
                    "close -- close the connection to the 'ginlong server'\n" +
                    "batch -- send a group of data to the 'ginlong server'\n" +
                    "quit  -- close this application\n" );

    } else if (answer == "open") {
      console.log('command: OPEN CONNECTION');
      client = openConnection();
      if (solarData == null) {
        solarData = solar.getCollection('data');

        if (solarData.data.length == 0) {
          importCsvData(__dirname + "/solarData.csv", solarData);
        }
      }
    } else if (answer == "send") {
      console.log('command: SEND DATA\n');
      if (client  == null) {
        console.warn('  Please open a connection first\n');
        waitForCommand();
      }
      
      let newData = solarData.find({ 'time' : { '$eq' : '0' }});
      try {
        let toSend = newData[0];
        toSend.time = new Date();
        console.log(toSend.data);
        client.write(Buffer.from(toSend.data, "hex"));

        solarData.update(toSend);
      }
      catch (err) {
        console.error(err);
      }
      
    } else if (answer == "close") {
      console.log('command: CLOSE CONNECTION');
      client.end('', () => {
        console.log('  is this closed now?');
      });
      //client.close();
     // client = null;
    } else if (answer == "batch") {
      console.log('command: SEND BATCH DATA'); 
      console.log('  STILL TO IMPLEMENT'); 
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
