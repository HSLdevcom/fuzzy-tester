
var csv_parse = require('csv-parse');
var fs = require('fs');
var through = require('through2');
var path = require('path');
var importTestCases = require('./testCaseImporter');
var csv_parser = csv_parse({ delimiter: ',', columns: true});
var filename = process.argv[2];
var read_stream = fs.createReadStream(filename);

// import only given % of test addresses.
// include poi name + city into expected props

var key = process.argv[3] || 100;
key = parseInt(key);

var test_file_json = {
  name: 'HSL address tests',
  description: 'POI list from an old OpenAddresses entry for Helsinki region',
  priorityThresh: 3,
  distanceThresh: 500, // meters
  normalizers: {
    name: [ 'toUpperCase']
  },
};

function getRandomInt() {
  return Math.floor(Math.random() * 100);
}

function isRoad(name) {
  if (name.indexOf('katu')!== -1 || name.indexOf('tie')!== -1 ||
      name.indexOf('kuja')!== -1 || name.indexOf('polku')!== -1) {
    return true;
  }
  return false;
}

var count = 0;

var testCaseStream = through({objectMode: true}, function(record, encoding, callback) {
  var test = {
    id: count,
    status: 'pass',
    user: 'hsldevcom',
    type: 'poi',
    in: {
      text: record.STREET + ', ' + record.CITY
    },
    expected: {
      properties: [
        {
          // enable name property for strict name comparison
          name: record.STREET,
          localadmin: record.CITY
        }
      ],
      coordinates: [
        record.LON, record.LAT
      ]
    }
  };
  if(record.STREET.length && record.CITY.length && !isRoad(record.STREET) &&
     (record.NUMBER === '' || record.NUMBER === '0') && getRandomInt()<key) {
    count++;
    this.push(test);
  }
  callback();
});

var full_stream = read_stream.pipe(csv_parser).pipe(testCaseStream);

var prefix = path.basename(filename).split('.')[0] + 'PoiTest'; // output name from param file name

importTestCases(prefix, test_file_json, full_stream, 200000);
