window.onload = function() { 
    setMap(); 
};



function setMap() {
    // Initialize Leaflet map
    var map = L.map('map').setView([43.1, -89.4], 12); // Adjust the center and zoom level as needed

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Load and display the neighborhood associations data
    d3.json("data/Neighborhood_Associations.topojson").then(function(states) {
        console.log("States TopoJSON:", states);

        // Translate TopoJSON to GeoJSON
        var neighborhoodAssociations = topojson.feature(states, states.objects.Neighborhood_Associations).features;

        console.log("Neighborhood Associations GeoJSON:", neighborhoodAssociations);

        // Create an SVG layer for D3 overlay
        var svg = d3.select(map.getPanes().overlayPane).append("svg");
        var g = svg.append("g").attr("class", "leaflet-zoom-hide");

        // Create a project function to convert latitude and longitude to map positions
        function projectPoint(x, y) {
            var point = map.latLngToLayerPoint(new L.LatLng(y, x));
            this.stream.point(point.x, point.y);
        }

        var transform = d3.geoTransform({point: projectPoint});
        var path = d3.geoPath().projection(transform);

        var feature = g.selectAll("path")
            .data(neighborhoodAssociations)
            .enter().append("path");

        map.on("viewreset", reset);
        map.on("zoom", reset); // Added event listener for zoom (highlighted)
        reset();

        // Function to reset and reposition the SVG layer
        function reset() {
            var bounds = path.bounds({type: "FeatureCollection", features: neighborhoodAssociations}),
                topLeft = bounds[0],
                bottomRight = bounds[1];

            svg.attr("width", bottomRight[0] - topLeft[0])
                .attr("height", bottomRight[1] - topLeft[1])
                .style("left", topLeft[0] + "px")
                .style("top", topLeft[1] + "px");

            g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

            feature.attr("d", path)
                .style("fill", "none")
                .style("stroke", "black");
        }

        console.log("Neighborhood paths added to map.");
    })
}

function continueToMap() {
    var initialPage = document.getElementById('initialPage');

    // Hide the initial page
    initialPage.style.display = 'none';
}