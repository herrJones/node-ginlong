var http = require('http');
var net = require('net');
var buffer = require('buffer').Buffer;
var parser = require('binary-parser').Parser;

var server = net.createServer(onClientConnected);

const ginglongPort = 9999;
const influxPort = 8086;
const influxIP = "127.0.0.1";
const influxUser = "influxUser";
const influxPass = "influxPass";

function sendInfluxUpdate(database, data) {

  let options = {
    host: influxIP, 
    port: influxPort,
    path: "/write?db=" + database + "&u=" + influxUser + "&p=" + influxPass,
    method: "POST",
    headers:  {
      'Content-Type': 'application/x-binary',
      'Content-Length': data.length
    }
  }

  let req = http.request(options, function(res) {
    let result = '';

    res.on('data', (chunk) => {
      result += chunk;
    }).on('error', (err) => {
      console.log(data.item + "(ERROR) :" + err.stack);
    }).on('end', () => {
      if (result != "") {
        console.log(data.item + " : " + result);
      }
    });
  });
  
  req.write(data);

  req.on('error', (err) => {
    console.error(data.item + "(ERROR) :" + err.stack);
  });

  req.end();
}

function parseSolarman_1(data) {

  let parseShort_20 = new parser()
    .string('payload', {encoding: 'hex', length: 30});

  let parseLong_79 = new parser()
    .skip(14)
    .string('serial', {encoding: 'ascii', length : 16 })                    // offset = 15 - 30
    .uint16le('temp', {formatter: function(field) { return field / 10; }})  // offset = 31
    .array('v_pv', {
      type: 'uint16le',
      length: 2,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .array('i_pv', {
      type: 'uint16le',
      length: 2,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .array('i_ac', {
      type: 'uint16le',
      length: 3,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .array('v_ac', {
      type: 'uint16le',
      length: 3,
      formatter: function(arr) { 
        let newArr = [];
        arr.forEach(function(element) {
          newArr.push(element / 10);
        });
        return newArr; 
      }
    })
    .uint16le('f_ac', {formatter: function(field) { return field / 100; }})
    .uint16le('p_ac', {formatter: function(field) { return field / 10; }})
    .skip(2)
    .uint16le('E_tod',{formatter: function(field) { return field / 100; }})
    .skip(2)
    .uint32le('E_tot',{formatter: function(field) { return field / 10; }});

  let parseUndefined = new parser()
    .string('payload', {encoding: 'hex', length: 30});

  let parseHdr = new parser()
    .skip(1)
    .uint8('lenType')
    .skip(2)
    .string('rev1', {encoding: 'hex', length:4})
    .string('rev2', {encoding: 'hex', length:4})
    .skip(1)
    .string('header', {encoding: 'hex', length:8})
    .choice('payload', {
      tag: 'lenType',
      choices: {
        0x20: parseShort_20,
        0x79: parseLong_79
      },
      defaultChoice: parseUndefined
    });

try {
  let lineData = parseHdr.parse(data);
  if(lineData.lenType == 121) {
    //console.log(lineData);
    let influxData='pv_data,serial=' + lineData.payload.serial + ' temp=' + lineData.payload.temp.toFixed(1) 
                   + ',vpv1=' + lineData.payload.v_pv[0].toFixed(1) + ',vpv2=' + lineData.payload.v_pv[1].toFixed(1)
                   + ',ipv1=' + lineData.payload.i_pv[0].toFixed(1) + ',ipv2=' + lineData.payload.i_pv[1].toFixed(1)
                   + ',iac1=' + lineData.payload.i_ac[0].toFixed(1) + ',iac2=' + lineData.payload.i_ac[1].toFixed(1) + ',iac3=' +lineData.payload.i_ac[2].toFixed(1)
                   + ',vac1=' + lineData.payload.v_ac[0].toFixed(1) + ',vac2=' + lineData.payload.v_ac[1].toFixed(1) + ',vac3=' +lineData.payload.v_ac[2].toFixed(1)
                   + ',fac=' + lineData.payload.f_ac.toFixed(2) + ',pac=' + lineData.payload.p_ac.toFixed(1)
                   + ',e_today=' + lineData.payload.E_tod.toFixed(1) + ',e_total=' + lineData.payload.E_tot
                   + ',ppv=' + ((lineData.payload.v_pv[0] * lineData.payload.i_pv[0]) + (lineData.payload.v_pv[1] * lineData.payload.i_pv[1])).toFixed(1);
        
      sendInfluxUpdate('ginlong_db', influxData);
   // return lineData;
  }
}
catch (err) {
  console.log('ERROR (S_1): ' + err);
}
 
}

function parseSolarman_Ethernet(data) {
// a5010010470b055cef6471008815.
// a5770010020b065cef6471010305b7d3cc000e000000795d2c5b01009ab40000313130413830313741323230313034302c01ba0e1b000e000000000000001400000000004f098913dc010000280000007675000000000000030000000000be21045800db0000000000000000001027010200210300b803001a0200000000000ba8093015
// a5010010470c085cef6471008c15
// a5770010020d0c5cef647101030532d4cc0089000000795d2c5b01009cb40000313130413830313741323230313034302d01910e1b000c000000000000001100000000005909861396010000280000007675000000000000030000000000be21045800db0000000000000000001027b30100ad02002c0300170200000000000ba8097215
}
}

function parseSolarman_checksum(byteArray) {
  
  let checksum = 0x00
  for(let i = 1; i < byteArray.length - 2; i++) {
    //checksum ^= byteArray[i];
    checksum = (checksum + byteArray[i]) % 256;
    //checksum %= 256;
  }
    
  return checksum; 
}

function parseSolarman_toHexString(byteArray) {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('')
}

server.listen(ginglongPort, '', () => {
	console.log('server is listening on ' + ginglongPort);
});

function onClientConnected(sock) {  
  let remoteAddress = sock.remoteAddress + ':' + sock.remotePort;
  console.log( ' : new client connected: %s', remoteAddress);
//  let binTemp = null;
  let binData = [];
  let hexData = [];

  sock.on('data', function(data) {
    
    try {
      //console.log(data);
      //console.log(data + ' --> CHECK<' + parseSolarman_checksum(data).toString(16) + '> : ');
      //let binTemp = data.toString('binary'); 
      let hexTemp = parseSolarman_toHexString(data);
      
      //console.log('CHECK<' + parseSolarman_checksum(data).toString(16) + '> : ' + hexTemp);
      binData.push(data);
      hexData.push(hexTemp);

    }
    catch (err) {
      console.log('ERROR on data : ' + err);
    }
  
  });
  sock.on('close',  function () {
    console.log( ' : connection from %s closed', remoteAddress);

    // temporary : store received data in influxDB
    try {
      hexData.forEach(function(element) {  
        let influxData= 'monitoring,serial=XXXXXXXXXX kind=' + element.substr(2, 2) + ',len=' + element.length.toString() +',log="' + element + '"';
        sendInfluxUpdate('ginlong_db', influxData);
      })   
    }
    catch (err) {
      console.log('ERROR on storing received data : ' + err);
    }
    
    try {
      binData.forEach(function(element) {

        if ((element[0] == 0x68) && (element[element.length - 1] == 0x16)) {
          
          protoData = parseSolarman_1(element);
          console.log("Solarman-1 detected -> len : " + element.length + "(" + parseInt(element[1]) + ")");
        } else {
         // console.log("len : " + hexTemp.length + "(" + binArray[hexTemp.length - 2].toString('hex') + ")(" + binArray[hexTemp.length - 1].toString('hex') + ")");
         // console.log("len : " + element.length + "(" + binArray[element.length].toString('hex') + ")");

        }

      })
    
    }
    catch (err) {
      console.log('ERROR parsing received data : ' + err);
    }
  });
  sock.on('error', function (err) {
      console.log('Connection %s error: %s', remoteAddress, err.message);
  });
};
