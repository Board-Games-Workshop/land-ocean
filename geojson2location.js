var fs = require('fs');
const process = require('process');
var data = fs.readFileSync('./airport_board_game.geojson');
var data = JSON.parse(data);
// ES5
var geojson2svg = require('geojson-to-svg'); // factory
// if you want to re-use the renderer
var Renderer    = geojson2svg.Renderer;

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

var locations = [];

var language = process.argv[2];

if (data['features'][0]['properties'].hasOwnProperty('name_' + language.toLowerCase())) {
    language = "name_" + language.toLowerCase();
} else {
    process.exit();
}

class Haversine {

    static get R() {
        return 6371;
    };
    static get km2miles() {
        return 0.621371;
    };
    
    static deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    static square(x) { 
        return Math.pow(x, 2);
    }

    /* Distance between two lat/lng coordinates in km using the Haversine formula */

    static getDistanceFromLatLng(lat1, lng1, lat2, lng2, miles) { // miles optional

        if (typeof miles === "undefined"){miles=false;}

        var r=Haversine.R; // radius of the earth in km

        lat1=Haversine.deg2rad(lat1);
        lat2=Haversine.deg2rad(lat2);
        
        var lat_dif=lat2-lat1;
        var lng_dif=Haversine.deg2rad(lng2-lng1);
        var a=Haversine.square(Math.sin(lat_dif/2))+Math.cos(lat1)*Math.cos(lat2)*Haversine.square(Math.sin(lng_dif/2));
        var d=2*r*Math.asin(Math.sqrt(a));
        
        if (miles){ return d * Haversine.km2miles; } //return miles

        else{ return d; } //return km
    }

/* Copyright 2016, Chris Youderian, SimpleMaps, http://simplemaps.com/resources/location-distance
Released under MIT license - https://opensource.org/licenses/MIT */ 

    static get eccentricity() {
        return 0.006694380023;
    }

    static get eccentricityXY() {
        // return 0.006694380023;
        return {'ex': 0.009, 'ey': 0.006};
    }

    static getCoordinatesFromLatLng(lat, lng) {
        return {
            'cex': Haversine.getMercatorXFromOrigin(lat, lng),
            'cey': Haversine.getMercatorYFromOrigin(lat)
        };
    }

    static getMercatorXFromOrigin(lat, lng) {
        
        lat=Haversine.deg2rad(lat);
        lng=Haversine.deg2rad(lng);

        return BlankSVGMap.MAP['height'] / Math.PI * (0 - lng);
    }

    static getMercatorYFromOrigin(lat) {
        
        lat=Haversine.deg2rad(lat);

        return BlankSVGMap.MAP['height'] / Math.PI * Math.log((Math.tan(Haversine.deg2rad(45) + lat/2)) * 
        Math.pow((1 - Haversine.eccentricity * Math.sin(lat)) / (1 + Haversine.eccentricity * Math.sin(lat)), 0.5 * Haversine.eccentricity))
    }

}

class BlankSVGMap {

    static get getMarkerColours() { return [ '#2641D8', '#358427', '#D62B2B', '#000000', '#7E726F', '#396b63', '#30CFD0', '#7DCC27', '#C68327', '#7F27CA', '#7E8DD5', 
            '#268B8F', '#C72882', '#7DD58E', '#7E2D2D', '#D58D8D', '#26D744', '#362782', '#D542D7', '#D5D843' ]; }

    static get getDistanceColourWheel() { return [ 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20 ]; }

}

data['features'].forEach(element => {
    const {properties, geometry} = element;
    const {coordinates} = geometry;
    const {iata_code, className, id} = properties;

    locations.push({
        'Dest': properties[language],
        'ID': iata_code,
        'Latitude': coordinates[1],
        'Longitude': coordinates[0],
        'Distances': null,
        'Scale': null,
        'Hex': null,
        'Sort_Order': null
    });
});

var distances = locations.map((location, index) => {
    var markers = locations.slice();

    var net_distance = 0.0;
    
    markers.map((marker, j) => {
        var dist = Haversine.getDistanceFromLatLng(location['Latitude'], location['Longitude'], marker['Latitude'], marker['Longitude']);
        net_distance += dist;
    });

    location['Distances'] = net_distance;
    
    return location;
});

function MinMaxScaler(distances) {
    var min_dist = Math.min.apply(null, distances);
    var max_dist = Math.max.apply(null, distances);

    var scale = distances.map((dist) => {
        return Math.round((dist - min_dist) / (max_dist - min_dist) * (19 - 0));
    });

    return scale;
}

var distances_array = distances.map((distance) => {
    return distance['Distances'];
});

var scales_array = MinMaxScaler(distances_array);

var scales = distances.map((distance, index) => {
    distance['Scale'] = scales_array[index];

    return distance;
});

var hex = scales.map((scale) => {
    scale['Hex'] = BlankSVGMap.getMarkerColours[scale['Scale']];

    return scale;
});

var svgString = geojson2svg()
  .styles({ 'Point' : { fill: '#000000', stroke: '#000000', weight: 0.3 } })
  .projection(function(coord) {
    return [(coord[0] + 180.3)*3.697541135, (-coord[1] + 83.9)*3.878341728];
  })
  .data(data)
  .render();

fs.writeFileSync('./svg/airport_board_game.svg', svgString);

const dom = new JSDOM(svgString);

var svg_circle = dom.window.document.querySelectorAll('svg circle');
var points = {};

svg_circle.forEach(function(element, i) {
    var className = element.className.baseVal, id = element.id.baseVal;
    points[className.replace("point ", "")] = {
        'id': id ? id : className.replace("point ", ""),
        'className': className.replace("point ", ""),
        'key': id ? id : className.replace("point ", ""),
        'cx': parseFloat(element.getAttribute('cx').toString()),
        'cy': parseFloat(element.getAttribute('cy').toString())
    };
})

var scaled_data = {};

hex.map((location) => {
    location['xcoord'] = points[location['ID']]['cx'];
    location['ycoord'] = points[location['ID']]['cy'];

    if (!scaled_data.hasOwnProperty(location['Scale'])) {
        scaled_data[location['Scale']] = [];
    }

    scaled_data[location['Scale']].push(location);
});

fs.writeFileSync('coordinate_map_distances.js', 
"export default {\n\
    data: " + JSON.stringify(Object.values(scaled_data)) + "\n\
}");

console.log("`coordinate_map_distances.js` file has been created");
