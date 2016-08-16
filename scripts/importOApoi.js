var csv_parse = require('csv-parse');
var fs = require('fs');
var through = require('through2');
var path = require('path');
var importTestCases = require('./testCaseImporter');
var csv_parser = csv_parse({ delimiter: ',', columns: true});
var filename = process.argv[2];
var read_stream = fs.createReadStream(filename);

var key = process.argv[3] || 1;
key = parseInt(key);

var test_file_json = {
  name: 'OpenAddress data test for poi entries with a zipcode',
  description: 'Address list from an OpenAddresses entry',
  priorityThresh: 3,
  distanceThresh: 1000, // meters
  normalizers: {
    name: [ 'toUpperCase']
  },
};

function getRandomInt() {
  return Math.floor(Math.random() * 100);
}


function isRoad(name) {
  if (name.indexOf('katu')!== -1 || name.indexOf('tie')!== -1 ||
      name.indexOf('kuja')!== -1 || name.indexOf('polku')!== -1 ||
      name.indexOf('vägen')!== -1 || name.indexOf('gatan')!== -1
     ) {
    return true;
  }

  return false;
}

var count = 0;

var testCaseStream = through({objectMode: true}, function(record, encoding, callback) {
  if(record.STREET !== '' && record.POSTCODE !== '') {
    var test = {
      id: count,
      status: 'pass',
      user: 'hsldevcom',
      type: 'poiwithpostalcode',
        in: {
          text: record.STREET + ', '  + record.POSTCODE + ' Finland'
        },
      expected: {
        properties: [
          {
            name: record.STREET,
            postalcode: record.POSTCODE
          }
        ],
        coordinates: [
          record.LON, record.LAT
        ]
      }
    };
    if(record.STREET.length && !isRoad(record.STREET) &&
     (record.NUMBER === '' || record.NUMBER === '0') && getRandomInt()<key) {
      count++;
      this.push(test);
    }
  }
  callback();
});

var full_stream = read_stream.pipe(csv_parser).pipe(testCaseStream);

var prefix = path.basename(filename).split('.')[0] + 'PoiTest'; // output name from param file name

importTestCases(prefix, test_file_json, full_stream, 200000);
