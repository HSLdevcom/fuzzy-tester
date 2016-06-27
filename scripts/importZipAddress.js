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
// include street name, number and zipcode into expected props

var key = process.argv[3] || 1;
key = parseInt(key);

var test_file_json = {
  name: 'OpenAddress data test for street address with a zipcode',
  description: 'Address list from an OpenAddresses entry',
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
  if(record.STREET !== '' && record.POSTCODE !== '') {
    var test = {
      id: count,
      status: 'pass',
      user: 'hsldevcom',
      type: 'postalcode',
        in: {
          text: record.STREET + ' ' + record.NUMBER + ', '  + record.POSTCODE + ' Finland'
        },
      expected: {
        properties: [
          {
            name: record.STREET + ' ' + record.NUMBER,
            postalcode: record.POSTCODE
          }
        ],
        coordinates: [
          record.LON, record.LAT
        ]
      }
    };
    if(count < 1000 && key === getRandomInt()) {
      count++;
      this.push(test);
    }
  }
  callback();
});

var full_stream = read_stream.pipe(csv_parser).pipe(testCaseStream);

var prefix = path.basename(filename).split('.')[0] + 'AddressTest'; // output name from param file name

importTestCases(prefix, test_file_json, full_stream, 200000);
