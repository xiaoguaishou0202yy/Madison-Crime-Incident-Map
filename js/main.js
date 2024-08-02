var map, neighborhoodAssociations, incidents, incidentMarkers = [];

window.onload = function() { 
    setMap(); 
};

function setMap() {
    // Initialize Leaflet map
    map = L.map('map').setView([43.1, -89.4], 12);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Use Promise.all to parallelize asynchronous data loading
    var promises = []; 
    promises.push(d3.json("data/Neighborhood_Associations.topojson"));    
    promises.push(d3.json("data/Incidents.topojson"));
    Promise.all(promises).then(callback);
}

function callback(data) {    
    var nbhs = data[0];    
    var incd = data[1];   
    // Translate TopoJSON to GeoJSON
    neighborhoodAssociations = topojson.feature(nbhs, nbhs.objects.Neighborhood_Associations).features;
    incidents = topojson.feature(incd, incd.objects.collection).features;

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
        .style("fill", "rgba(0, 0, 0, 0.1)") // Transparent fill color
        .style("stroke", "black");

    // Define styles for different incident types
    var styleTypes = {
        "Intoxicated/Impaired Driver": {radius: 3, fillColor: "yellow", color: "yellow", shape: "circle"},
        "Traffic Incident": {radius: 3, fillColor: "cyan", color: "cyan", shape: "circle"},
        "Weapons Violation": {radius: 3, fillColor: "orange", color: "orange", shape: "circle"},
    };

    // Add incident points
    incidents.forEach(function(incident) {
        var incidentType = incident.properties.IncidentType;
        var coords = incident.geometry.coordinates;
        var iconUrl = "img/"+incidentType+".png"; // Assuming 'icon' property contains the URL to the icon


        var markerIcon = L.icon({
            iconUrl: iconUrl,
            iconSize: [25, 25], // size of the icon
            iconAnchor: [12, 12], // point of the icon which will correspond to marker's location
            popupAnchor: [0, -12] // point from which the popup should open relative to the iconAnchor
        });

        var marker = L.marker([coords[1], coords[0]], { icon: markerIcon })
            .bindPopup('<b>' + incidentType + '</b><br>' + incident.properties.Details);

        if (marker) {
            marker.addTo(map);
            incidentMarkers.push({marker: marker, type: incidentType});
        }
    });

    map.on("viewreset", reset);
    map.on("zoom", reset); 
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
    }

    console.log("Neighborhood paths added to map.");
}

function filterIncidents() {
    var selectedType = document.getElementById('incidentTypeFilter').value;
    incidentMarkers.forEach(function(entry) {
        if (selectedType === "All" || entry.type === selectedType) {
            entry.marker.addTo(map);
        } else {
            map.removeLayer(entry.marker);
        }
    });
}

function continueToMap() {
    var initialPage = document.getElementById('initialPage');
    initialPage.style.display = 'none';
}
