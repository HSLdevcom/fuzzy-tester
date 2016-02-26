var haversine = require( 'haversine' );

/**
 * Calculate the score of an api result against given expectations by iterating
 * through all the keys, calculating the subscores, and aggregating them
 */
function scoreCoordinates(expected, actual, threshold, weight) {
  if (threshold === undefined) {
    threshold = 100; // metres
  }
  weight = weight || 1;
  var coords = actual.geometry.coordinates;
  var p1 = { longitude: expected[0], latitude: expected[1] };
  var p2 = { longitude: coords[0], latitude: coords[1] };
  var dist = Math.floor(haversine(p1, p2)*1000); // to metres
  var pass = dist<threshold;

  return {
    score: pass ? weight : 0,
    max_score: weight,
    diff: pass ? '' : 'Nearest match ' +  actual.properties.name +
      ',' + actual.properties.locality +
      ' is not close enough, distance=' + dist + ' m'
  };
}

module.exports = scoreCoordinates;

