
var http = require('http');
var importTestCases = require('./testCaseImporter');
var Readable = require('stream').Readable;
var sleep = require('sleep');

// number of tests to generate
var testCount = parseInt(process.argv[2]) || 1000;
var testName = 'CompareOldReittiopas';

var user = process.env.GEOCODEUSER; // init these to valid reittiopas API crendentials
var pass = process.env.GEOCODEPASSWORD;

console.log('Generating ' + testCount + ' tests');

var count = 0;

var test_file_json = {
  name: 'reittiopas geocoding comparison test',
  description: 'Test if random reverse geocoding results from reittiopas.fi API can be found',
  priorityThresh: 3,
  distanceThresh: 300, // meters
  normalizers: {
    name:['toUpperCase']
  }
};

function revGeocodeDoc(callback) {
  var lat = 60.2939 + 2*(Math.random()-0.5)*0.14;
  var lon = 24.8593 + 2*(Math.random()-0.5)*0.4;
  var coordinate = '&coordinate=' + lon + ',' + lat;
  var type = '&result_contains=';
  if (Math.random()<0.4) {
    type = type + 'poi';
  }
  /*  else if (type>0.9) {
      type = type + 'stop';
      } */
  else {
    type = type + 'address';
  }
  http.get({
    host: 'api.reittiopas.fi',
    path: '/hsl/prod/?user='+user+'pass='+pass+'&request=reverse_geocode&'+
      'epsg_in=4326&epsg_out=4326' + type + coordinate
  }, function(response) {
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
	revGeocodeDoc(callback); // try again
      }
    });
  });
}

var revGeocoder = new Readable({objectMode: true});

revGeocoder._read = function () {
  if (count === testCount) {
    revGeocoder.push(null); // done
    console.log('Test written to ' + testName + '.json');
  } else {
    sleep.sleep(2);
    revGeocodeDoc( function (doc) {
      var test = {
	id: count,
	status: 'pass',
	user: 'hsldevcom',
	type: 'hsl',
	  in: {
	    text: doc.name,
	  },
	expected: {
	  properties: [
            {
	      // name: doc.name.replace(doc.city, '').replace(',', '').trim();
	      localadmin: doc.city
	    }
	  ],
	  coordinates: [
            doc.lonlat[0], doc.lonlat[1]
	  ]
	}
      };
      revGeocoder.push(test);
      count = count+1;
      process.stdout.write('Done ' + count +'\033[0G');
    });
  }
};

importTestCases(testName, test_file_json, revGeocoder);

