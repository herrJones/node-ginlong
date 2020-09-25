'use strict';

//const debug = require('debug');
//const Buffer = require('safe-buffer').Buffer;
//const udp = require('dgram');
//const tcp = require('net');
//const events = require('events');
const parser = require('binary-parser').Parser;

/*
 * parse received binary data in Solarman-1 format
 */
function analyze_Solarman_1 (data) {
  let result = {};

  const parseShort_20 = new parser()
    .string('payload', {encoding: 'hex', length: 30});

  const parseLong_79 = new parser()
    .skip(14)
    .string('serial', {encoding: 'utf-8', length : 15 })                    // offset = 15 - 30
    .skip(1)
    .uint16le('temp', {formatter: function(field) { return field / 10; }})  // offset = 31
    .array('v_pv', {
      type: 'uint16le',
      length: 2,
      formatter: function(arr) { 
        const newArr = [];
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
        const newArr = [];
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
        const newArr = [];
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
        const newArr = [];
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
    .uint8('p_status')
    .skip(4)
    .uint16le('e_prev')
    .skip(8)
    .uint16le('p_limit')
    .uint16le('e_cur',{formatter: function(field) { return field / 1000; }});
    //.skip(3)
    //.uint16le('g_pfc');

  const parseUndefined = new parser()
    .string('payload', {encoding: 'hex', length: 30});

  const parseHdr = new parser()
    .skip(1)
    .uint8('pkgType')
    .skip(2)
    .string('rev1', {encoding: 'hex', length:4})
    .string('rev2', {encoding: 'hex', length:4})
    .skip(1)
    .string('header', {encoding: 'hex', length:8})
    .choice('payload', {
      tag: 'pkgType',
      choices: {
        0x20: parseShort_20,
        0x79: parseLong_79
      },
      defaultChoice: parseUndefined
    });

  try {
    result = parseHdr.parse(data);
    if(result.pkgType != 121) {
      result = null;
    }
  }
  catch (err) {
    console.log('ERROR (S_1): ' + err);
    //log.error('ERROR (S_1): ' + err);
  }

  return result;
}

/*
 * parse received binary data in Solarman-Ethernet format
 */
function analyze_Solarman_Ethernet (data) {
  let result = {};

  const parseShort_01 = new parser()
    .array('unixepoch', {                     // unix epoch UTC timestamp
      type: 'uint32le',
      length: 2
    })
    //.uint64le('unixepoch')                  // node.js v12 version
    .uint8('checksum');
  
  const parseLong_77 = new parser()
    .array('unixepoch', {                     // unix epoch UTC timestamp
      type: 'uint32le',
      length: 2
    })
    //.uint64le('unixepoch')                  // node.js v12 version
    .skip(20)
    .string('serial', {encoding: 'utf-8', length : 15 })                    // offset = 15 - 30
    .skip(1)
    .uint16le('temp', {formatter: function(field) { return field / 10; }})  // offset = 31
    .array('v_pv', {
      type: 'uint16le',
      length: 2,
      formatter: function(arr) { 
        const newArr = [];
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
        const newArr = [];
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
        const newArr = [];
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
        const newArr = [];
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
    .uint8('p_status')
    .skip(4)
    .uint16le('e_prev')
    .skip(8)
    .uint16le('p_limit')
    .uint16le('e_cur',{formatter: function(field) { return field / 1000; }});
    
  
  const parseUndefined = new parser()
    .string('payload', {encoding: 'hex', length: 30});
  
  const parseHdr = new parser()
    .skip(1)
    .uint8('pkgType')
    .skip(2)
    .choice('payload', {
      tag: 'pkgType',
      choices: {
        0x01: parseShort_01,
        0x77: parseLong_77
      },
      defaultChoice: parseUndefined
    });
  
  try {
    result = parseHdr.parse(data);
    //console.log(JSON.stringify(lineData));
    if(result.pkgType != 119) {
      result = null;
    }    
  }
  catch (err) {
    console.log('ERROR (S_E): ' + err);
    //log.error('ERROR (S_E): ' + err);
  }
  
  return result;
}

/*
 * convert the binary received data to hex-string
 */
function buffer_toHexString (byteArray) {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/*
 * calculate the checksum for the received data
 */
function analyze_checksum (byteArray) {
  
  let checksum = 0x00;
  for(let i = 1; i < byteArray.length - 2; i++) {
    //checksum ^= byteArray[i];
    checksum = (checksum + byteArray[i]) % 256;
    //checksum %= 256;
  }
      
  return checksum; 
}

module.exports = {
  analyze_Solarman_1,
  analyze_Solarman_Ethernet,
  buffer_toHexString,
  analyze_checksum
};