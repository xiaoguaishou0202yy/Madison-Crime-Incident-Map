var map, neighborhoodAssociations, incidents, incidentMarkers = [];

window.onload = function() { 
    setMap(); 
};

function setMap() {
    // Initialize Leaflet map
    map = L.map('map').setView([43.0831, -89.4012], 11.5);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
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

    // Sort incidents by occurrence time
    incidents.sort((a, b) => new Date(a.properties.IncidentDate) - new Date(b.properties.IncidentDate));

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
        .style("fill", "rgba(0, 0, 0, 0.3)") // Transparent fill color
        .style("stroke", "black");


    // Add incident points
    incidents.forEach(function(incident) { //capture index
        var incidentType = incident.properties.IncidentType;
        var coords = incident.geometry.coordinates;
        var iconUrl = "img/"+incidentType+".png"; // Assuming 'icon' property contains the URL to the icon


        var markerIcon = L.icon({
            iconUrl: iconUrl,
            iconSize: [25, 25], // size of the icon
            iconAnchor: [12, 12], // point of the icon which will correspond to marker's location
            popupAnchor: [0, -12] // point from which the popup should open relative to the iconAnchor
        });
        

        var popupContent = setPopup(incident);

        // Delay the addition of each marker
        //setTimeout(function() {
            var marker = L.marker([coords[1], coords[0]], { icon: markerIcon })
                .bindPopup(popupContent)
                .on('click', function() {
                    showIncidentDetails(incident);
                });
            if (marker) {
                marker.addTo(map);
                incidentMarkers.push({marker: marker, type: incidentType});
            }
        //}, index * 500); // 500ms delay between each marker
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


    var chartContainer = document.querySelector(".chart-container");

    console.log("Neighborhood paths added to map.");
}


function continueToMap() {
    var initialPage = document.getElementById('initialPage');
    initialPage.style.display = 'none';
}


// Function to update the right container with incident details
function showIncidentDetails(incident) {
    var details = `
        <h3>${incident.properties.IncidentType}</h3>
        <p>${incident.properties.Details}</p>
    `;
    document.getElementById('right-container').innerHTML = details;
}

// Utility function to conditionally display fields
function displayField(label, value) {
    return value ? `<strong>${label}:</strong> ${value}<br>` : '';
}


// Function to create popup content
function setPopup(incident) {
    var popupContent = `
        <b>Incident Type: </b>${incident.properties.IncidentType}<br>
        <strong>Address:</strong> ${incident.properties.address}<br>
        <strong>Case Number:</strong> ${incident.properties.CaseNumber}<br>
        <strong>Incident Date:</strong> ${incident.properties.IncidentDate}<br>
        ${displayField('Victim', incident.properties.Victim)}
        ${displayField('Arrested', incident.properties.Arrested)}
        ${displayField('Suspect', incident.properties.Suspect)}
    `;
    return popupContent;
}

function applyFilters() {
    var selectedType = document.getElementById('incidentTypeFilter').value;
    var selectedMonth = document.getElementById('monthFilter').value;

    // Clear existing markers from the map
    incidentMarkers.forEach(function(entry) {
        map.removeLayer(entry.marker);
    });

    // Filter incidents based on the selected type and month
    var filteredIncidents = incidents.filter(function(incident) {
        var incidentDate = new Date(incident.properties.IncidentDate);
        var incidentMonth = ("0" + (incidentDate.getMonth() + 1)).slice(-2); // Get month in MM format
        var matchesType = selectedType === "All" || incident.properties.IncidentType === selectedType;
        var matchesMonth = selectedMonth === "all" || incidentMonth === selectedMonth;
        return matchesType && matchesMonth;
    });

    // Add filtered incidents to the map
    filteredIncidents.forEach(function(incident,i) {
        var incidentType = incident.properties.IncidentType;
        var coords = incident.geometry.coordinates;
        var iconUrl = "img/" + incidentType + ".png"; // Assuming 'icon' property contains the URL to the icon

        var markerIcon = L.icon({
            iconUrl: iconUrl,
            iconSize: [25, 25], // size of the icon
            iconAnchor: [12, 12], // point of the icon which will correspond to marker's location
            popupAnchor: [0, -12] // point from which the popup should open relative to the iconAnchor
        });

        var popupContent = setPopup(incident);

        setTimeout(function() {
            var marker = L.marker([coords[1], coords[0]], { icon: markerIcon })
                .bindPopup(popupContent)
                .on('click', function() {
                    showIncidentDetails(incident);
                });

            if (marker) {
                marker.addTo(map);
                incidentMarkers.push({ marker: marker, type: incidentType });
            }
        }, i * 500); // 500ms delay between each marker
    });
}


// Function to toggle the sidebar visibility
function toggleSidebar() {
    var sidebar = document.getElementById("right-container");
    var mapContainer = document.querySelector(".map-container");
    var toggleButton = document.getElementById("toggleSidebar");

    if (sidebar.classList.contains("collapsed")) {
        sidebar.classList.remove("collapsed");
        mapContainer.style.flex = "3";
        toggleButton.innerHTML = "&#10094;"; // Change button to "close" symbol
    } else {
        sidebar.classList.add("collapsed");
        mapContainer.style.flex = "4"; // Expand map when sidebar is collapsed
        toggleButton.innerHTML = "&#10095;"; // Change button to "open" symbol
    }

    // Trigger map resize
    setTimeout(function() {
        map.invalidateSize(); // Ensure the map redraws itself
    }, 300); // Timeout to match the CSS transition duration
}

// Function to show the sidebar when a point is clicked
function showSidebarWithContent(content) {
    var sidebar = document.getElementById("right-container");
    var mapContainer = document.querySelector(".map-container");
    var toggleButton = document.getElementById("toggleSidebar");
    var sidebarContent = document.getElementById("sidebarContent");

    sidebarContent.innerHTML = content; // Set the content
    sidebar.classList.remove("collapsed");
    mapContainer.style.flex = "3";
    toggleButton.innerHTML = "&#10094;"; // Change button to "close" symbol

    // Trigger map resize
    setTimeout(function() {
        map.invalidateSize(); // Ensure the map redraws itself
    }, 300); // Timeout to match the CSS transition duration
}