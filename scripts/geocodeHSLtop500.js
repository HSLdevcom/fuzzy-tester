var http = require('http');
var sleep = require('sleep');
var csv_parse = require('csv-parse');
var fs = require('fs');
var through = require('through2');
var importTestCases = require('./testCaseImporter');
var csv_parser = csv_parse({ delimiter: ',', columns: true});
var filename = process.argv[2];
var read_stream = fs.createReadStream(filename);

// number of tests to generate
var testName = 'HSLTop500';


var user = process.env.GEOCODEUSER; // init these to valid reittiopas API crendentials
var pass = process.env.GEOCODEPASSWORD;

var count = 0;

var test_file_json = {
  name: 'reittiopas top 500 test',
  description: 'Test if most frequent reittiopas searches can be found',
  priorityThresh: 1,
  distanceThresh: 300, // meters
  normalizers: {
    name:['toUpperCase']
  }
};

function geocodeDoc(str, callback) {
  str=
  http.get({
    host: 'api.reittiopas.fi',
    path: '/hsl/prod/?user='+user+'&pass='+pass+'&request=geocode&epsg_out=4326&key='+
           encodeURIComponent(str)
  },
  function(response) {
    // Continuously update stream with data
    var body = '';
    response.on('data', function(d) {
      body += d;
    });
    response.on('end', function() {
      var reply = null;
      if (body !== '') {
	var doc = JSON.parse(body);
	if (Array.isArray(doc) && doc.length>0 && doc[0].coords) {
	  reply = doc[0];
	  reply.lonlat = reply.coords.split(',');
	}
      }
      if(reply) {
	callback(reply); // Success!
      } else {
	geocodeDoc(str, callback); // try again ?
      }
    });
  });
}

var testCaseStream = through({objectMode: true}, function(record, encoding, callback) {
  sleep.sleep(1);
  var label = record.NAME;
  if(record.CITY && record.CITY.length>0) {
    label = label + ', ' + record.CITY;
  }
  geocodeDoc(label, function (doc) {
    var test = {
      id: count,
      status: 'pass',
      user: 'hsldevcom',
      type: 'acceptance',
	in: {
          text: label,
	},
      expected: {
	properties: [
          {
	    name: record.NAME,
	  }
	],
	coordinates: [
          doc.lonlat[0], doc.lonlat[1]
	]
      }
    };
    if(record.CITY && record.CITY.length>0) {
      test.expected.properties[0].localadmin = record.CITY;
    }
    testCaseStream.push(test);
    count = count+1;
    process.stdout.write('Done ' + count +'\033[0G');
    callback();
  });
});

var full_stream = read_stream.pipe(csv_parser).pipe(testCaseStream);

importTestCases(testName, test_file_json, full_stream);
