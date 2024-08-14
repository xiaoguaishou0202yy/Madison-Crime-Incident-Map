var map, neighborhoodAssociations, incidents, incidentMarkers = [];

window.onload = function() { 
    setMap(); 

    // Add event listeners for the layer toggle checkboxes
    document.getElementById('toggleNeighborhoods').addEventListener('change', toggleNeighborhoodsLayer);
    document.getElementById('toggleIncidents').addEventListener('change', toggleIncidentsLayer);
};

var neighborhoodLayerGroup, incidentLayerGroup;

function setMap() {
    // Initialize Leaflet map
    map = L.map('map').setView([43.0831, -89.4012], 11.5);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Initialize layer groups for neighborhoods and incidents
    neighborhoodLayerGroup = L.layerGroup().addTo(map);
    incidentLayerGroup = L.layerGroup().addTo(map);

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

    // Count incidents in each neighborhood
    countIncidentsInNeighborhoods(neighborhoodAssociations, incidents);

    // Add neighborhood paths to the layer group
    addNeighborhoodPaths();

    // Add incidents to the layer group
    addIncidentMarkers();


    var chartContainer = document.querySelector(".chart-container");

    console.log("Neighborhood paths added to map.");
}


function continueToMap() {
    var initialPage = document.getElementById('initialPage');
    initialPage.style.display = 'none';
}


// Function to update the right container with incident details and show the sidebar if collapsed
function showIncidentDetails(incident) {
    var details = `
        <h3>${incident.properties.IncidentType}</h3>
        <p>${incident.properties.Details}</p>
    `;

    // Get the sidebar element
    var sidebar = document.getElementById('right-container');
    var mapContainer = document.querySelector(".map-container");
    var toggleButton = document.getElementById("toggleSidebar");

    // Check if the sidebar is collapsed
    if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        mapContainer.style.flex = "3";
        toggleButton.innerHTML = "&#10094;"; // Change button to "close" symbol

        // Trigger map resize
        setTimeout(function() {
            map.invalidateSize(); // Ensure the map redraws itself
        }, 300); // Timeout to match the CSS transition duration
    }

    // Update the sidebar content with the incident details
    document.getElementById('sidebarContent').innerHTML = details;
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

var isFilterApplied = false; // Track if a filter is applied
var filteredIncidents = [];  // Store filtered incidents separately

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

    addFilteredIncidentsToMap();

    // Set the filter state to true
    isFilterApplied = true;

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

    // Recount incidents in neighborhoods based on the filtered incidents
    countIncidentsInNeighborhoods(neighborhoodAssociations, filteredIncidents);

    // Update neighborhood colors based on the new counts
    updateNeighborhoodColors();
}

function addFilteredIncidentsToMap() {
    // Clear existing markers from the incident layer group
    incidentLayerGroup.clearLayers();

    filteredIncidents.forEach(function(incident, i) {
        var incidentType = incident.properties.IncidentType;
        var coords = incident.geometry.coordinates;
        var iconUrl = "img/" + incidentType + ".png"; // Assuming 'icon' property contains the URL to the icon

        var markerIcon = L.icon({
            iconUrl: iconUrl,
            iconSize: [25, 25],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });

        var popupContent = setPopup(incident);

        var marker = L.marker([coords[1], coords[0]], { icon: markerIcon })
            .bindPopup(popupContent)
            .on('click', function() {
                showIncidentDetails(incident);
            });

        if (marker) {
            marker.addTo(incidentLayerGroup);
            incidentMarkers.push({ marker: marker, type: incidentType });
        }
    });

    // Add the filtered incidents to the map
    incidentLayerGroup.addTo(map);
}


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
    toggleButton.style.display = "block"; // Ensure the toggle button is visible
    toggleButton.innerHTML = "&#10094;"; // Change button to "close" symbol

    // Trigger map resize
    setTimeout(function() {
        map.invalidateSize(); // Ensure the map redraws itself
    }, 300); // Timeout to match the CSS transition duration
}


// Function to count incidents within each neighborhood
function countIncidentsInNeighborhoods(neighborhoods, incidents) {
    neighborhoods.forEach(function(neighborhood) {
        var count = 0;

        incidents.forEach(function(incident) {
            var incidentPoint = [incident.geometry.coordinates[0], incident.geometry.coordinates[1]];
            var polygonCoords = neighborhood.geometry.coordinates[0]; // Assumes simple polygon

            if (pointInPolygon(incidentPoint, polygonCoords)) {
                count++;
            }
        });

        // Store the count in the neighborhood's properties
        neighborhood.properties.incidentCount = count;
        console.log(neighborhood.properties.incidentCount); // Debugging line
    });
}

// Example color function with more emphasis on red tones
function getColor(count) {
    return count > 50 ? 'rgba(102, 0, 0, 0.8)' :      // Dark Red with less brightness
           count > 20 ? 'rgba(153, 0, 0, 0.7)' :      // Darker Red
           count > 10 ? 'rgba(178, 34, 34, 0.6)' :    // Firebrick Red
           count > 5  ? 'rgba(205, 92, 92, 0.5)' :    // Indian Red
           count > 1  ? 'rgba(196, 196, 196, 0.3)' :  // Dim Grey (Darker)
                        'rgba(107, 111, 114, 0.5)';      // Very Dark Grey
}

// Function to check if a point is inside a polygon
function pointInPolygon(point, vs) {
    var x = point[0], y = point[1];

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i][0], yi = vs[i][1];
        var xj = vs[j][0], yj = vs[j][1];

        var intersect = ((yi > y) != (yj > y)) && 
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

function updateNeighborhoodColors() {
    d3.selectAll(".neighborhood")
        .style("fill", function(d) {
            return getColor(d.properties.incidentCount);
        });
}

function addNeighborhoodPaths() {
    // Clear existing paths by removing the SVG
    d3.select(map.getPanes().overlayPane).select("svg").remove();

    var svg = d3.select(map.getPanes().overlayPane).append("svg");
    var g = svg.append("g").attr("class", "leaflet-zoom-hide");

    function projectPoint(x, y) {
        var point = map.latLngToLayerPoint(new L.LatLng(y, x));
        this.stream.point(point.x, point.y);
    }

    var transform = d3.geoTransform({ point: projectPoint });
    var path = d3.geoPath().projection(transform);

    g.selectAll(".neighborhood")
        .data(neighborhoodAssociations)
        .enter().append("path")
        .attr("class", "neighborhood")
        .style("fill", function(d) {
            return getColor(d.properties.incidentCount);
        })
        .style("stroke", "black")
        .on('mouseover', function(d) {
            L.popup()
                .setLatLng([d.geometry.coordinates[0][0][1], d.geometry.coordinates[0][0][0]])
                .setContent("Incidents: " + d.properties.incidentCount)
                .openOn(map);
        });

    // Ensure D3 paths are in sync with Leaflet map
    map.on("viewreset", reset);
    map.on("zoom", reset);
    reset();

    function reset() {
        var bounds = path.bounds({ type: "FeatureCollection", features: neighborhoodAssociations }),
            topLeft = bounds[0],
            bottomRight = bounds[1];

        svg.attr("width", bottomRight[0] - topLeft[0])
            .attr("height", bottomRight[1] - topLeft[1])
            .style("left", topLeft[0] + "px")
            .style("top", topLeft[1] + "px");

        g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

        g.selectAll("path").attr("d", path);
    }
}

function addIncidentMarkers() {
    // Clear existing markers from the layer group
    incidentLayerGroup.clearLayers();

    incidents.forEach(function(incident, i) {
        var incidentType = incident.properties.IncidentType;
        var coords = incident.geometry.coordinates;
        var iconUrl = "img/" + incidentType + ".png";

        var markerIcon = L.icon({
            iconUrl: iconUrl,
            iconSize: [25, 25],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });

        var popupContent = setPopup(incident);

        var marker = L.marker([coords[1], coords[0]], { icon: markerIcon })
            .bindPopup(popupContent)
            .on('click', function() {
                showIncidentDetails(incident);
            });

        if (marker) {
            marker.addTo(incidentLayerGroup);
        }
    });

    incidentLayerGroup.addTo(map);
}

function toggleNeighborhoodsLayer() {
    var isChecked = document.getElementById('toggleNeighborhoods').checked;
    d3.selectAll(".neighborhood").style("display", isChecked ? "block" : "none");
}

function toggleIncidentsLayer() {
    var isChecked = document.getElementById('toggleIncidents').checked;
    if (isChecked) {
        map.addLayer(incidentLayerGroup);
    } else {
        map.removeLayer(incidentLayerGroup);
    }
}