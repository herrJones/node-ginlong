const http = require('http');
const parser = require('binary-parser').Parser;
//const buffer = require('buffer').Buffer;

//var csv = require('csvtojson');
//const loki = require('lokijs');

const influxPort = 8086;
const influxIP = '10.81.20.55';
const influxUser = "nodejs";
const influxPass = "Node.JS";

//var lokiDB = new loki("ginlong_data.json");
//let ginlongDB = lokiDB.addCollection('ginlong');

var bunyan = require("bunyan");
var splunkBunyan = require("splunk-bunyan-logger");

var config = {
  token: "ae2206ec-594c-4b18-b61b-564cd87119c3",
  url: "https://splunk.vanbelle.local:8088"
};
var splunkStream = splunkBunyan.createStream(config);
var splunkLogger = bunyan.createLogger({
  name: "ginlong_dev",
  streams: [
      splunkStream
  ]
});


var influxData = function (callback) {
  let database = 'ginlong_db';
  let query = 'SELECT%20time,serial,log%20FROM%20monitoring%20WHERE%20kind=1%20or%20kind=77'; //%20ORDER%20BY%20time%20DESC';
  let options = {
    host: influxIP, 
    port: influxPort,
    path: "/query?pretty=true&db=" + database + "&u=" + influxUser + "&p=" + influxPass + "&epoch=ns&q=" + query,
    method: "GET"
  }

  // example:
  //http://10.81.20.55:8086/query?u=nodejs&p=Node.JS&epoch=ns&db=ginlong_db&q=SELECT%20*%20FROM%20monitoring%20WHERE%20time%20%3E%20now()-10m
  //http://10.81.20.55:8086/query?u=nodejs&p=Node.JS&epoch=ns&db=ginlong_db&q=SELECT%20e_total%2Ce_today%20FROM%20pv_data%20WHERE%20serial%3D"110A8017A2201040"%20order%20by%20time%20desc%20limit%201
  let req = http.request(options, function(res) {
    let result = '';

    res.on('data', (chunk) => {
      result += chunk;
    }).on('error', (err) => {
     
     // console.log('error querying data: ' + err);
      callback(err, null);
    }).on('end', () => {
      callback(null, result);
    });
  });

  req.on('error', (err) => {
    console.error(data.item + "(ERROR) :" + err.stack);
  });

  req.end();
}

/*
var influxData = function (csvFile, collectionName, callback) {
  csv({
    delimiter:','
  })
  .fromFile(csvFile)
  .then((jsonObj)=>{
      collectionName.insert(jsonObj);
      callback(null, "OK");
  })
}*/

function parseSolarman_1(data) {
 
 // 687941b05cef64715cef64718103050305c8cbcc009b2100004e5d2c5b010092b400003131304138303137413232303130343019017d0e1a0008000000000000000c0000000000410985131c0100000a0000006c75000000000000030000000000be21045800db0000000000000000001027200100e90100380200fb0100000000000ba8091616
 // 687941b05cef64715cef64718103050305c6d3cc00992900004e5d2c5b010099b40000313130413830313741323230313034302d01a50e1b000e0000000000000014000000000059098713de010000280000007675000000000000030000000000be21045800db0000000000000000001027fe0100280300bc0300150200000000000ba8093716
 // 687941b05cef64715cef6471810305030588d3cc005b2900004e5d2c5b010098b40000313130413830313741323230313034302c01a50e1b000f0000000000000015000000000059098813f60100001e0000006c75000000000000030000000000be21045800db0000000000000000001027230200490300ec0300200200000000000ba8094216
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
 .uint16le('e_tod',{formatter: function(field) { return field / 100; }})
 .skip(2)
 .uint32le('e_tot',{formatter: function(field) { return field / 10; }})
 .skip(10)
 //.string('debug1', {length:10, encoding:'hex'})
 .uint8('p_status')
 //.skip(2)
 //.string('debug1', {
 //  // type: 'string',
 //   length: 6,
 //   encoding: 'hex'
 // //  0300 0000 0000 be21 04c7 00dd 00000000
 // })
 //.string('debug2', {length:4, encoding:'hex'})
   .skip(4)
 /* .array('debug2', {
    type: 'uint16le',
    length: 3,
    formatter: function(arr) { 
      let newArr = [];
      arr.forEach(function(element) {
        newArr.push(element / 10);
      });
      return newArr; 
    }
  })*/
  .uint16le('e_prev')
  .skip(8)
  .uint16le('p_limit')
  //.string('debug3', {length:9, encoding:'hex'})
  .uint16le('e_cur',{formatter: function(field) { return field / 1000; }})
    .skip(3)
  //.skip(9)
  .uint16le('g_pfc')
  .string('debug4', {length:5, encoding:'hex'});
 /* .array('debug3'
    type: 'uint32le',
    length: 4,
    formatter: function(arr) { 
      let newArr = [];
      arr.forEach(function(element) {
        newArr.push(element / 10);
      });
      return newArr; 
    }
  */

let parseUndefined = new parser()
 .string('payload', {encoding: 'hex', length: 30});

let parseHdr = new parser()
 .skip(1)
 .uint8('lenType')
 .skip(2)
 .array('logger1', {
   type: 'uint8',
   length: 4,
   formatter: function(arr) {
     return arr[3] << 24 | arr[2] << 16 | arr[1] << 8 | arr[0];
   }
 })
 .array('logger2', {
   type: 'uint8',
   length: 4,
   formatter: function(arr) {
     return arr[3] << 24 | arr[2] << 16 | arr[1] << 8 | arr[0];
   }
 })
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
     
     let testData='pv_data,serial=' + lineData.payload.serial + ' temp=' + lineData.payload.temp.toFixed(1) 
                    + ',vpv1=' + lineData.payload.v_pv[0].toFixed(1) + ',vpv2=' + lineData.payload.v_pv[1].toFixed(1)
                    + ',ipv1=' + lineData.payload.i_pv[0].toFixed(1) + ',ipv2=' + lineData.payload.i_pv[1].toFixed(1)
                    + ',iac1=' + lineData.payload.i_ac[0].toFixed(1) + ',iac2=' + lineData.payload.i_ac[1].toFixed(1) + ',iac3=' +lineData.payload.i_ac[2].toFixed(1)
                    + ',vac1=' + lineData.payload.v_ac[0].toFixed(1) + ',vac2=' + lineData.payload.v_ac[1].toFixed(1) + ',vac3=' +lineData.payload.v_ac[2].toFixed(1)
                    + ',fac=' + lineData.payload.f_ac.toFixed(2) + ',pac=' + lineData.payload.p_ac.toFixed(1)
                    + ',e_today=' + lineData.payload.e_tod.toFixed(1) + ',e_total=' + lineData.payload.e_tot + ',e_cur=' + lineData.payload.e_cur
                    + ',e_prev=' + lineData.payload.e_prev + ',p_status=' + lineData.payload.p_status + ',p_limit=' + lineData.payload.p_limit
                   // + ',debug2=' + lineData.payload.debug2 +',debug3=' + lineData.payload.debug3
                    + ',g_factor=' + lineData.payload.g_pfc; // +',debug3=' + lineData.payload.debug3;
     //               + ',ppv=' + ((lineData.payload.v_pv[0] * lineData.payload.i_pv[0]) + (lineData.payload.v_pv[1] * lineData.payload.i_pv[1])).toFixed(1);
    
    //let testData=/*'pv_data,serial=' + lineData.payload.serial + ' logger=' + lineData.logger1 + 't_inv=' +lineData.payload.temp +*/ 
    //   'e_total=' + lineData.payload.E_tot + ',e_prev=' + lineData.payload.e_prev + ',p_status=' + lineData.payload.p_status +
    //   ',debug1=' + lineData.payload.debug1 +',debug2=' + lineData.payload.debug2 +',debug3=' + lineData.payload.debug3 +
    //   'e_today=' + lineData.payload.E_tod;
    
    console.log(testData);   
    //splunkLogger.info(testData, "this logging result");
    //splunkLogger.info(testData);
    //   sendInfluxUpdate('ginlong_db', influxData);
    // return lineData;
   } else {
     let testData = 'pv_hdr,lenType=' + lineData.lenType + ' data=' + lineData.payload.payload;
     console.log(testData);  
   }
 }
 catch (err) {
   console.log('ERROR (S_1): ' + err);
 }
  
 }

 function parseSolarman_Ethernet(data) {
  // a5010010470b055cef6471008815
  // a5770010020b065cef6471010305b7d3cc000e000000795d2c5b01009ab40000313130413830313741323230313034302c01ba0e1b000e000000000000001400000000004f098913dc010000280000007675000000000000030000000000be21045800db0000000000000000001027010200210300b803001a0200000000000ba8093015
  // a5010010470c085cef6471008c15
  // a5770010020d0c5cef647101030532d4cc0089000000795d2c5b01009cb40000313130413830313741323230313034302d01910e1b000c000000000000001100000000005909861396010000280000007675000000000000030000000000be21045800db0000000000000000001027b30100ad02002c0300170200000000000ba8097215
    let parseShort_01 = new parser()
      .uint32le('test1')
      .uint32le('test2')
      .uint8('checksum');

    let parseLong_77 = new parser()
    .skip(28)
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
    .uint16le('e_tod',{formatter: function(field) { return field / 100; }})
    .skip(2)
    .uint32le('e_tot',{formatter: function(field) { return field / 10; }})
    .skip(10)
    //.string('debug1', {length:10, encoding:'hex'})
    .uint8('p_status')
      .skip(4)
     .uint16le('e_prev')
     .skip(8)
     .uint16le('p_limit')
     //.string('debug3', {length:9, encoding:'hex'})
     .uint16le('e_cur',{formatter: function(field) { return field / 1000; }})
       .skip(3)
     //.skip(9)
     .uint16le('g_pfc')
     .string('debug4', {length:5, encoding:'hex'});
      

    let parseUndefined = new parser()
      .string('payload', {encoding: 'hex', length: 30});

    let parseHdr = new parser()
      .skip(1)
      .uint8('pkgType')
      .skip(2)
      //.uint32le('test')
      //.string('test1', {encoding: 'hex', length: 3})
      //.uint16le('pkgNumber')
      //.array('logger', {
      //  type: 'uint8',
      //  length: 4,
      //  formatter: function(arr) {
      //    return arr[3] << 24 | arr[2] << 16 | arr[1] << 8 | arr[0];
      //  }
      //})
      .choice('payload', {
        tag: 'pkgType',
        choices: {
          0x01: parseShort_01,
          0x77: parseLong_77
        },
        defaultChoice: parseUndefined
      });


      try {
        let lineData = parseHdr.parse(data);
        
        //if (lineData.pkgType == 0x77)
          console.log(JSON.stringify(lineData.payload));
      }
      catch (err) {
        console.log('ERROR (S_ETH): ' + err);
      }
  }

/*
influxData(function (err, data) {

  let ginlongDB = JSON.parse(data);
  
  let ginlongArray = ginlongDB.results[0].series[0].values;

  ginlongArray.forEach(element => {
    let thisLog = buffer.from(element[2], 'hex');

    parseSolarman_Ethernet(thisLog);
    //if (thisLog.length > 80) {
    //  parseSolarman_1(thisLog);
    //}
    
  });

})
*/

/*
influxData(__dirname + "\\influxdb\\influxdb_2018-11-04-16-01.csv", ginlongDB, function() {
  let ginlongArray = ginlongDB.find();
  
  ginlongArray.forEach(element => {
    let thisLog = buffer.from(element.logdata, 'hex');
    if ((thisLog.length > 100) && (thisLog[0] == 0x68)) {
      parseSolarman_1(thisLog);
    }
  
  });
});*/

function parseSolarman_checksum(byteArray) {
  
  let checksum = 0x00
  for(let i = 1; i < byteArray.length - 2; i++) {
    //checksum ^= byteArray[i];
    checksum = (checksum + byteArray[i]) % 256;
    //checksum %= 256;
  }
    
  return checksum; 
}
function createByteArray(input) {
  let result = [];
  
  for (var i = 0; i < input.length; i += 2) {
    result.push(parseInt("0x" + input.substr(i, 2)));
  }

  return result;
}
function ascii_to_hexa(str) {
	var arr1 = [];
	for (var n = 0, l = str.length; n < l; n ++) 
     {
		var hex = Number(str.charCodeAt(n)).toString(16);
		arr1.push(hex);
	 }
	return arr1.join('');
}
function ascii_to_serial(str) {
  //let data = createByteArray(str);
  let data = parseInt(str, 32);
  let serial = [];
  serial.push(data[0]);
  serial.push(data[1]);
  serial.push(data[2]);
  serial.push(data[3]);


  
//  return arr[3] << 24 | arr[2] << 16 | arr[1] << 8 | arr[0];
  return serial;
}

//            687941b05cef64715cef6471810305030555b72601690000007e1ca15b0100df00010031313041383031374132323031303430de001c060e0000000000000000000200000000007d09851330000000 6806 0000 c297 000000000000020000000000be2104 7e01 dd00 0000000000000000 1027 0000 00 0000 00 0000 00000000000000000ba809e416
//            687941b05cef64715cef6471810305030508b82601a4000000bc1ca15b0100e000010031313041383031374132323031303430df00ed021500000000000000000007000000000080098513aa000000 6806 0000 c297 000000000000030000000000be2104 7e01 dd00 0000000000000000 1027 0000 00 5401 00 5401 00000000000000000ba8091416
//            687941b05cef64715cef647181030503053977270151170000f81ca15b010069010100313130413830313741323230313034303301ee02170000000000000000000800000000008a098913c3000000 9204 0000 3a98 000000000000030000000000be2104 8a01 dd00 0000000000000000 1027 0000 00 8601 00 8601 00000000000000000ba8092016
//            687941b05cef64715cef6471810305030593842701ab240000f81ca15b010074010100313130413830313741323230313034302b01b305150000000000000000000800000000006c098813c0000000 9204 0000 3a98 000000000000030000000000be2104 8a01 dd00 0000000000000000 1027 0000 00 8001 00 8001 00000000000000000ba8098916
//            687941b05cef64715cef64718103050305078627011f260000f81ca15b010075010100313130413830313741323230313034302901c8021400000000000000000008000000000087098813c3000000 9204 0000 3a98 000000000000030000000000be2104 8a01 dd00 0000000000000000 1027 0000 00 8601 00 8601 00000000000000000ba809af16

// 06:30:41 : 687941b05cef64715cef64718103050305f487270170000000fc98a15b01007c01010031313041383031374132323031303430dd00df091600000000000000000008000000000080098813c2000000 9204 0000 3a98 000000000000030000000000be2104 8a01 dd00 0000000000000000 1027 0000 00 8401 00 8401 00000000000000000ba8091616
// 06:31:42 : 687941b05cef64715cef6471810305030531882701ad000000fc98a15b01007c01010031313041383031374132323031303430de001a051800000000000000000007000000000084098613aa000000 9204 0000 3a98 000000000000030000000000be2104 8a01 dd00 0000000000000000 1027 0000 00 5401 00 5401 00000000000000000ba8095416
// 06:38:49 : 687941b05cef64715cef64718103050305dc89270158020000fc98a15b01007d01010031313041383031374132323031303430e600b30c160000000000000000000700000000008a098613aa000000 9204 0000 3a98 000000000000030000000000be2104 8a01 dd00 0000000000000000 1027 0000 00 5401 00 5401 00000000000000000ba8095a16
// 06:40:51 : 687941b05cef64715cef64718103050305568a2701d2020000fc98a15b01007e01010031313041383031374132323031303430e900b30c160001000000000000000600000000008a09881392000000 0000 0000 3a98 000000000000030000000000be2104 0000 8a01 0000000000000000 1027 1f00 00 2201 00 2401 006a0000000000000ba809f116
// 07:43:06 : 687941b05cef64715cef64718103050305ee9827016a110000fb98a15b01008a010100313130413830313741323230313034302901f50e1b0011000000000000001800000000008709881349020000 1e00 0000 3a98 000000000000030000000000be2104 0000 8a01 0000000000000000 1027 7902 00 d703 00 9204 001d0200000000000ba8090216
// 08:00:24 : 687941b05cef64715cef64718103050305fb9c270177150000fc98a15b01008d0101003131304138303137413232303130343038010a0f1c0017000000000000002100000000008e09891327030000 3200 0000 3a98 000000000000030000000000be2104 0000 8a01 0000000000000000 1027 5e03 00 5405 00 4e06 00160200000000000ba8097416
// XX:XX:XX : 687941b05cef64715cef64718103050305c8cbcc009b2100004e5d2c5b010092b400003131304138303137413232303130343019017d0e1a0008000000000000000c0000000000410985131c010000 0a00 0000 6c75 000000000000030000000000be2104 5800 db00 0000000000000000 1027 2001 00 e901 00 3802 00fb0100000000000ba8091616
// YY:YY:YY : 687900005cef64715cef647100000000000000000000000000000000000000000000003131304138303137413232303130343000000000000000000000000000000c0000000000410985131c010000 0a00 0000 6c75 000000000000030000000000be2104 5800 db00 0000000000000000 1027 2001 00 e901 00 3802 00fb0100000000000ba8090016
function createSolarman_1 (serial, inverter, E_total) {
 
  // serial = 5cef6471
  //let serData = ascii_to_serial(serial);
  // invert = 3131304138303137413232303130343
  //let invData = ascii_to_hexa(inverter);
  //let solarData = createByteArray(result);
  //let checksum = parseSolarman_checksum(solarData);

  let solarInput = [
    '682051b15cef64715cef647180014d452d3132313030312d56312e302e362832303137303430313230303829e716',
    '687941b05cef64715cef6471810305030582595d01d23a0000b72dbb5b0100352c010031313041383031374132323031303430a201910d2400260000000000000033000000000087098813db0400003002000084bc000000000000030000000000be2104e501bb01000000000000000010270605004f0800b60900050200000000000ba809f716',
    '682051b15cef64715cef647180014d452d3132313030312d56312e302e362832303137303430313230303829e716',
    '687941b05cef64715cef64718103050305a1595d01f13a0000b72dbb5b0100352c010031313041383031374132323031303430a2019e0d23002400000000000000300000000000800988138f0400003002000084bc000000000000030000000000be2104e501bb0100000000000000001027c60400c407001e09000b0200000000000ba8098a16',
    '687941b05cef64715cef6471810305030500735d01a40000000c2ebb5b0100442c010031313041383031374132323031303430ce01950f24000c00000000000000120000000000a5098913bc010000a2030000a2bc000000000000030000000000be2104e901bb0100000000000000001027d20100f302007803000c0200000000000ba8093e16',
    '687c41b05cef64715cef64718103053131304138303137413232303130343001e010240025000000010000000000000000000009ab0000000013890000000000000009089803a20000bca20000000000000000bea8042101e9000001bb0000000000000000000000000000000010270000000000000000000000000000000000000000000000000b1d16'
  ];

  solarInput.forEach(function(solarData) {
    bufData = Buffer.from(solarData, 'hex');
    result = parseSolarman_1(bufData);
  })
  
  return result;
}

function createSolarman_Ethernet (serial, inverter, E_total) {
  // a501 00 1047 0b05 5cef 6471008815
  // a501 00 1047 2705 5cef 647100a415
  // a501 00 1047 2808 5cef 647100a815
  // a501 00 1047 290b 5cef 647100ac15
  // a501 00 1047 2a0e 5cef 647100b015
  // a501 00 1047 2c14 5cef 647100b815

  // 001 : 68 79 41b0 5cef64715cef64718103050305187c5e01200100009a93bb5b0100152d0100 31313041383031374132323031303430b601010d220016000000000000001c00000000009b098713b00200008606000088bd000000000000030000000000be21041000ee0100000000000000001027c90200980400600500060200000000000ba8099916
  // ETH : a5 77 0010 02e5065cef6471010305337c5e010f000000c793bb5b0100162d0100       31313041383031374132323031303430b301510d220016000000000000001d00000000008e098713c50200008606000088bd000000000000030000000000be21041000ee0100000000000000001027da0200bf04008a0500020200000000000ba809e615
  // TRA : 

  let ethernetInput = [
    'a50100104727055cef647100a415',
    'a57700100227065cef64710103054b745d010f000000172ebb5b0100462c010031313041383031374132323031303430c6015b0b2b005100000000000000590000000000b5098913a3080000ac030000a2bc000000000000030000000000be2104e901bb0100000000000000001027f70800c30e00461100060200000000000ba809d915',
    'a50100104728085cef647100a815',
    'a57700100228095cef647101030589745d014d000000172ebb5b0100472c010031313041383031374132323031303430c801680b290038000000000000003d0000000000ab098913e5050000ac030000a2bc000000000000030000000000be2104e901bb01000000000000000010273a0600020a00ca0b00100200000000000ba8096b15',
    'a501001047290b5cef647100ac15',
    'a577001002290c5cef6471010305c7745d018b000000172ebb5b0100482c010031313041383031374132323031303430ca019d0b240027000000000000002b0000000000a109891323040000b6030000acbc000000000000030000000000be2104e901bb01000000000000000010276a0400ff0600460800150200000000000ba809e715',
    'a5010010472a0e5cef647100b015',
    'a5770010022a0f5cef647101030505755d01c9000000172ebb5b0100492c010031313041383031374132323031303430ca01420c2a004d000000000000005c0000000000b9098913f1080000b6030000acbc000000000000030000000000be2104e901bb0100000000000000001027330900550f00e21100020200000000000ba8091515',
    'a5010010472c145cef647100b815',
    'a5770010022d165cef647101030581755d0145010000172ebb5b01004c2c010031313041383031374132323031303430cc01530d2a0048000000000000005e0000000000af0989131a090000c0030000acbc000000000000030000000000be2104e901bb01000000000000000010275909009e0f00341200010200000000000ba8091715'
  ];

  ethernetInput.forEach(function(solarData) {
    bufData = Buffer.from(solarData, 'hex');
    result = parseSolarman_Ethernet(bufData);
  })
}

function createSolarman_Customer (serial, inverter, E_total) {

  // a50100104736055cef647100b315
  // a50100104737085cef647100b715
  // a501001047380b5cef647100bb15
  // a501001047390e5cef647100bf15
  // a5010010473a115cef647100c315

  let ethernetInput = [
    'a57700100236065cef6471010305b3755d010f000000752ebb5b01004d2c010031313041383031374132323031303430cd01120d25002800000000000000340000000000a1098a1301050000c0030000acbc000000000000030000000000be2104e901bb01000000000000000010271805009d0800020a00fc0100000000000ba8092415',
    'a57700100237095cef6471010305f1755d014d000000752ebb5b01004e2c010031313041383031374132323031303430cc019e0d2b0045000000000000005b0000000000b5098813d5080000ca030000acbc000000000000030000000000be2104e901bb01000000000000000010272809001b0f00aa1100060200000000000ba809c015',
    'a577001002380c5cef64710103052e765d018a000000752ebb5b01004f2c010031313041383031374132323031303430cd01400d2c004d00000000000000630000000000bf098813a6090000ca030000acbc000000000000030000000000be2104e901bb0100000000000000001027f109008910004c1300030200000000000ba809a915',
    'a577001002390f5cef64710103056c765d01c8000000752ebb5b0100502c010031313041383031374132323031303430cf01060d300057000000000000006d0000000000bf0988139f0a0000ca030000acbc000000000000030000000000be2104e901bb01000000000000000010270b0b002512003e1500070200000000000ba809b615',
    'a5770010023a125cef6471010305aa765d0106010000752ebb5b0100512c010031313041383031374132323031303430d401d70c2b004300000000000000530000000000af09891309080000d4030000acbc000000000000030000000000be2104e901bb0100000000000000001027620800b50d00121000090200000000000ba809ed15'
  ];

ethernetInput.forEach(function(solarData) {
    bufData = Buffer.from(solarData, 'hex');
    result = parseSolarman_Ethernet(bufData);
  })
}

function createSolarman_Transparent (serial, inverter, E_total) {

  // a50100104727055cef647100a415
  // a50100104728085cef647100a815
  // a501001047290b5cef647100ac15
  // a5010010472a0e5cef647100b015
  // a5010010472c145cef647100b815

  let ethernetInput = [
    'a57700100227065cef64710103054b745d010f000000172ebb5b0100462c010031313041383031374132323031303430c6015b0b2b005100000000000000590000000000b5098913a3080000ac030000a2bc000000000000030000000000be2104e901bb0100000000000000001027f70800c30e00461100060200000000000ba809d915',
    'a57700100228095cef647101030589745d014d000000172ebb5b0100472c010031313041383031374132323031303430c801680b290038000000000000003d0000000000ab098913e5050000ac030000a2bc000000000000030000000000be2104e901bb01000000000000000010273a0600020a00ca0b00100200000000000ba8096b15',
    'a577001002290c5cef6471010305c7745d018b000000172ebb5b0100482c010031313041383031374132323031303430ca019d0b240027000000000000002b0000000000a109891323040000b6030000acbc000000000000030000000000be2104e901bb01000000000000000010276a0400ff0600460800150200000000000ba809e715',
    'a5770010022a0f5cef647101030505755d01c9000000172ebb5b0100492c010031313041383031374132323031303430ca01420c2a004d000000000000005c0000000000b9098913f1080000b6030000acbc000000000000030000000000be2104e901bb0100000000000000001027330900550f00e21100020200000000000ba8091515',
    'a5770010022d165cef647101030581755d0145010000172ebb5b01004c2c010031313041383031374132323031303430cc01530d2a0048000000000000005e0000000000af0989131a090000c0030000acbc000000000000030000000000be2104e901bb01000000000000000010275909009e0f00341200010200000000000ba8091715'
  ];

ethernetInput.forEach(function(solarData) {
    bufData = Buffer.from(solarData, 'hex');
    result = parseSolarman_Ethernet(bufData);
  })
}

//createSolarman_1('1902440284', '110A8017A2201040', 3500);
createSolarman_Ethernet('1902440284', '110A8017A2201040', 3500);




