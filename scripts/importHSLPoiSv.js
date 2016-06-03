var csv_parse = require('csv-parse');
var fs = require('fs');
var through = require('through2');

var importTestCases = require('./testCaseImporter');

var csv_parser = csv_parse({ delimiter: '|', columns: true});
var filename = process.argv[2];
var read_stream = fs.createReadStream(filename);

var proj4 = require('proj4');
proj4.defs([
  [
    'EPSG:2392', //# KKJ / Finland zone 2
    '+proj=tmerc +lat_0=0 +lon_0=24 +k=1 +x_0=2500000 +y_0=0 +ellps=intl ' +
    '+towgs84=-96.0617,-82.4278,-121.7535,4.80107,0.34543,-1.37646,1.4964 +units=m +no_defs'
  ]
]);

var test_file_json = {
  name: 'HSL poi tests for swedish names',
  description: 'A swedish poi list in Helsinki region',
  source: 'digitransit@195.255.176.166/ftproot/rnj/poi.zip',
  priorityThresh: 3,
  distanceThresh: 300, // meters
  normalizers: {
    name: [ 'toUpperCase', 'removeNumbers']
  },
};


var count = 0;

var testCaseStream = through({objectMode: true}, function(record, encoding, callback) {
  var test = {
    id: count,
    status: 'pass',
    user: 'hsldevcom',
    type: 'localization',

      in: {
	text: record.name_sv + ', ' + record.locality
      },
    expected: {
      properties: [
	        { // enable name property for strict name comparison
		  // name: record.name,
		  // locality: record.locality
		}
      ],
      coordinates: [
	proj4('EPSG:2392','WGS84',[record.xpos, record.ypos])
      ]
    }
  };
  if(record.name_sv !== '' && record.name_sv !== record.name) {
    count++;
    this.push(test);
  }
  callback();
});

var full_stream = read_stream.pipe(csv_parser).pipe(testCaseStream);

var prefix = 'HslPoiTestSv';

importTestCases(prefix, test_file_json, full_stream, 5000);
