
var request = require('request');
var importTestCases = require('./testCaseImporter');
var Readable = require('stream').Readable;
var parseString = require('xml2js').parseString;
var iconv = require('iconv-lite');
var through = require('through2');

// number of tests to generate
var testCount = parseInt(process.argv[2]) || 1000;
var testName = 'CompareMatkaFi';

var baseURL = 'http://api.matka.fi/?user=vesameskanen&pass=Soj9vjkl';

var proj4 = require('proj4'); // for transforming source data into wgs84
proj4.defs([
  [
    'EPSG:2393', //# KKJ / Finland zone 3
    '+proj=tmerc +lat_0=0 +lon_0=27 +k=1 +x_0=3500000 +y_0=0 +ellps=intl ' +
    '+towgs84=-96.0617,-82.4278,-121.7535,4.80107,0.34543,-1.37646,1.4964 +units=m +no_defs'
  ]
]);

console.log('Generating ' + testCount + ' tests');

var count = 0;

var test_file_json = {
  name: 'matka.fi geocoding comparison test',
  description: 'Test if random reverse geocoding results from matka.fi API can be found',
  priorityThresh: 3,
  distanceThresh: 200, // meters
  normalizers: {
    name:['toUpperCase']
  }
};

// look for a value wrapped in a deep object hierarchy
function getValue(doc, tags) {
  for(var i=0; i<tags.length; i++) {
    var tag = tags[i];
    doc = doc[tag];
    if (Array.isArray(doc)) {
      doc = doc[0]; // take 1st entry
    }
    if (!doc) {
      return  null;
    }
  }
  return doc;
}

function encodeURI(str, encoding) {
  if (!encoding || encoding === 'utf8' || encoding === 'utf-8') {
    return encodeURIComponent(str);
  }
  var buf = iconv.encode(str, encoding);
  var encoded = [];

  for (var i=0; i<buf.length; i++) {
    var value = buf[i];
    // Test if value is unreserved = ALPHA / DIGIT / '-' / '.' / '_' / '~'
    // https://tools.ietf.org/html/rfc3986#section-2.3
    if ((value >= 65 && value <= 90) || // A-Z
	(value >= 97 && value <= 122) || // a-z
	(value >= 48 && value <= 57) || // 0-9
	value === 45 || value === 46 ||  // '-' / '.'
	value === 95 || value === 126   // '_' / '~'
       ) {
      encoded.push(String.fromCharCode(value));
    } else {
      var hex = value.toString(16).toUpperCase();
      encoded.push('%' + (hex.length === 1 ? '0' + hex : hex));
    }
  }
  return encoded.join('');
}

// generic request send and parse wrapper with utf8 encoding
function doRequest(url, parseResponse) {
  var data = '';
  var sink = through.obj(function(chunk, encoding, callback) {
    data += chunk;
    callback();
  }, function(callback) {
    parseResponse(data);
    callback();
  });
  request(url).pipe(iconv.decodeStream('latin1')).pipe(sink);
}

// matka.fi api does not return coordinates of a reverse geocoded location.
// Therefore, we have to geocode the reverse geocoded item to get its coordinates.
function geocodeDoc(name, sendDoc) {
  var parseResponse = function(body) {
    var reply = null;
    if (body !== '') {
      parseString(body, function(err,doc) { // xml to js obj
	if(!err && doc) {
	  doc = getValue(doc, ['MTRXML', 'GEOCODE', 'LOC', '$']);
	  if (doc && doc.name1 && doc.x && doc.y) {
	    reply = doc;
	    reply.name = reply.name1;
	    if (reply.number) {
	      reply.name = reply.name + ' ' + reply.number;
	    }
	    if (reply.city) {
	      reply.name = reply.name + ', ' + reply.city;
	    }
	  }
	}
      });
    }
    if(reply) {
      sendDoc(reply); // Success!
    } else {
      revGeocodeDoc(sendDoc); // try again from beginning
    }
  };

  var url = baseURL + '&key=' + encodeURI(name, 'latin1');
  doRequest(url, parseResponse);
}

function revGeocodeDoc(sendDoc) {
  var parseResponse = function(body) {
    var name = null;
    if (body !== '') {
      parseString(body, function(err,doc) {
	if(!err && doc) {
	  doc = getValue(doc, ['MTRXML', 'REVERSE', 'LOC', '$']);
	  if (doc && doc.name1) {
	    name = doc.name1;
	    if (doc.number) {
	      name = name + ' ' + doc.number;
	    }
	    if (doc.city) {
	      name = name + ',' + doc.city;
	    }
	  }
	}
      });
    }
    if(name) {
      geocodeDoc(name, sendDoc); // Success, proceed to geocoding
    } else {
      revGeocodeDoc(sendDoc); // try again
    }
  };

  var x = Math.floor(3085000 + Math.random()*658000);
  var y = Math.floor(6640000 + Math.random()*1158000);

  doRequest(baseURL + '&x='+x + '&y='+y, parseResponse);
}

var revGeocoder = new Readable({objectMode: true});

revGeocoder._read = function () {
  if (count === testCount) {
    revGeocoder.push(null); // done
    console.log('Test written to ' + testName + '.json');
  } else {
    revGeocodeDoc( function (doc) {
      var test = {
	id: count,
	status: 'pass',
	user: 'hsldevcom',
	  in: {
	    text: doc.name,
	  },
	expected: {
	  properties: [
            {
	      // name: doc.name.replace(doc.city, '').replace(',', '').trim();
	      locality: doc.city
	    }
	  ],
	  coordinates: [
	    proj4('EPSG:2393','WGS84',[doc.x, doc.y])
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

