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

    //use Promise.all to parallelize asynchronous data loading
    var promises = []; 
    //promises.push(d3.csv("data/species_az.csv")); //load attributes from csv      
    promises.push(d3.json("data/Neighborhood_Associations.topojson")); //load choropleth spatial data    
    promises.push(d3.json("data/Incidents.topojson"));
    Promise.all(promises).then(callback);

    function callback(data){    
        nbhs = data[0];    
        incd = data[1];   
        //csvData = data[2];

        //console.log(csvData);
        console.log(nbhs.objects);

        // Translate TopoJSON to GeoJSON
        var neighborhoodAssociations = topojson.feature(nbhs, nbhs.objects.Neighborhood_Associations).features;
        var incidents = topojson.feature(incd, incd.objects.collection).features;
        console.log("Neighborhood Associations GeoJSON:", neighborhoodAssociations);
        console.log("Incidents GeoJSON:", incidents);


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

        // Add neighborhood paths
        var neighborhoodPaths = g.selectAll(".neighborhood")
            .data(neighborhoodAssociations)
            .enter().append("path")
            .attr("class", "neighborhood")
            .style("fill", "none")
            .style("stroke", "black");

        // Add incident points
        var incidentPoints = g.selectAll(".incident")
            .data(incidents)
            .enter().append("circle")
            .attr("class", "incident")
            .attr("r", 3) // Adjust the radius as needed
            .style("fill", "red")
            .style("stroke", "none");

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

            neighborhoodPaths.attr("d", path);

            incidentPoints.attr("transform", function(d) {
                var point = path.centroid(d);
                return "translate(" + point[0] + "," + point[1] + ")";
            });
            }

        console.log("Neighborhood paths added to map.");
    }
}

function continueToMap() {
    var initialPage = document.getElementById('initialPage');

    // Hide the initial page
    initialPage.style.display = 'none';
}