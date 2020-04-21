const GeoJSON = require('geojson-geometry-objects');
console.log(GeoJSON);
const point = GeoJSON.Point.from([5.9117305, 51.9748942]);
const same = GeoJSON.Point.from({
    latitude: 51.9748942,
    longitude: 5.9117305
});
console.log(same);