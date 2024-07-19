window.onload = function() { 
    setMap(); 
};

function setMap() {
    //map frame dimensions
    var width = window.innerWidth * 0.5,
    height = 680;

    //create new svg container for the map
    var map = d3.select(".map-container")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection
    var projection = d3.geoAlbers()
        .center([12.64, 43])
        .rotate([102, 0, 0])
        .parallels([40, 75])
        .scale(100000)
        .translate([width / 2, height / 2]);
    
    var path = d3.geoPath()
        .projection(projection);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];    
    promises.push(d3.csv("data/Species.csv")); //load attributes from csv    
    promises.push(d3.json("data/Neighborhood_Associations.topojson")); //load choropleth spatial data    
    promises.push(d3.csv("data/species_az.csv")); //load attributes from csv 

    Promise.all(promises).then(callback);

    function callback(data) {    
        var csvData = data[0];   
        var states = data[1]; 
        var csvSpecies = data[2];

        console.log("CSV Data:", csvData);
        console.log("States TopoJSON:", states);
        console.log("CSV Species Data:", csvSpecies);

        // Translate TopoJSON to GeoJSON
        var neighborhoodAssociations = topojson.feature(states, states.objects.Neighborhood_Associations).features;

        console.log("Neighborhood Associations GeoJSON:", neighborhoodAssociations);

        //add Neighborhood Associations to map
        var neighborhoods = map.selectAll(".neighborhood")
            .data(neighborhoodAssociations)
            .enter()
            .append("path")
            .attr("class", "neighborhood")
            .attr("d", path)
            .style("fill", "none")
            .style("stroke", "black");

        console.log("Neighborhood paths added:", neighborhoods);
    }
}

function continueToMap() {
    var initialPage = document.getElementById('initialPage');

    // Hide the initial page
    initialPage.style.display = 'none';
}