var csv_parse = require('csv-parse');
var fs = require('fs');
var through = require('through2');
var path = require('path');
var importTestCases = require('./testCaseImporter');
var csv_parser = csv_parse({ delimiter: ',', columns: true});
var filename = process.argv[2];
var read_stream = fs.createReadStream(filename);

// import only % of test addresses.
// set key value to variate the test: for example 'node importAddr.js helsinki.csv 31'
// include street name + number into expected props

var key = process.argv[3] || 1;
key = parseInt(key);

var test_file_json = {
  name: 'HSL address tests',
  description: 'Address list from an old OpenAddresses entry for Helsinki region',
  priorityThresh: 3,
  distanceThresh: 300, // meters
  normalizers: {
    name: [ 'toUpperCase']
  },
};

function getRandomInt() {
  return Math.floor(Math.random() * 100);
}

var count = 0;

var testCaseStream = through({objectMode: true}, function(record, encoding, callback) {
  var test = {
    id: count,
    status: 'pass',
    user: 'hsldevcom',
    type: 'streetname',
    in: {
      text: record.STREET + ' ' + record.NUMBER + ', ' + record.CITY
    },
    expected: {
      properties: [
        {
          // enable name property for strict name comparison
          name: record.STREET + ' ' + record.NUMBER,
          locality: record.CITY
        }
      ],
      coordinates: [
        record.LON, record.LAT
      ]
    }
  };
  if(key === getRandomInt()) {
    count++;
    this.push(test);
  }
  callback();
});

var full_stream = read_stream.pipe(csv_parser).pipe(testCaseStream);

var prefix = path.basename(filename).split('.')[0] + 'AddressTest'; // output name from param file name

importTestCases(prefix, test_file_json, full_stream, 200000);
