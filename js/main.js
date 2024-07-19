// Add all scripts to the JS folder

var attrArray = ["Grand Total","Amphibians", "Arachnids", "Birds",	"Clams", "Conifers and Cycads", "Crustaceans", "Ferns and Allies", "Fishes", "Flowering Plants", "Insects", "Lichens", "Mammals", "Reptiles", "Snails"];
var attrArraySpecies = ["Scientific Name","Common Name", "Where Listed", "Region",	"ESA Listing Status", "Group", "State"];

var expressed = attrArray[0]; //initial attribute
var expressedSpecies = attrArraySpecies[0];

//chart frame dimensions
var chartWidth = window.innerWidth * 0.26,
    chartHeight = 300;
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame
var yScale = d3.scaleLinear()
   .range([290, 0])
   .domain([0, 500]);

// function addToolDescription() {
//     var descContainer = document.getElementById("toolDescriptionContainer");
//     descContainer.innerHTML = '<p>This map designed by Zhiyi Li and Xun Gong</p>';
//     descContainer.classList.add("tool-description"); // Add a class for CSS styling
// }

// Call this function in your window.onload or wherever it makes sense in your existing code
window.onload = function() {
    setMap();
    //addToolDescription();
};

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = 680;

    //create new svg container for the map
    var map = d3.select(".map-container")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);
    
    // Create the title element
    var pageTitle = document.createElement("h1");
    pageTitle.innerHTML = "Madison Crime Incident Map";
    pageTitle.classList.add("page-title"); // Add a class for styling

    // Create the introduction panel
    var introductionPanel = document.createElement("div");
    introductionPanel.innerHTML = "<p>Description Panel</p>";
    introductionPanel.classList.add("introduction-panel"); // Add a class for styling

   

    
    // Append the title and introduction panel to the document body
    document.body.insertBefore(introductionPanel, document.body.firstChild);
    document.body.insertBefore(pageTitle, introductionPanel);

    var zoom = d3.zoom()
        .scaleExtent([1,3])
        .on("zoom", function(event) {
            map.selectAll("path, circle") // Now includes circles
                .attr("transform", event.transform);
        });


    map.call(zoom);



    function resetMap() {
        map.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity);  // Reset to original scale and translation
    }
    
    // Add event listener to the reset button
    document.getElementById('resetMap').addEventListener('click', resetMap);

    var chartContainer = document.querySelector(".chart-container");

    // Create a search input for states
    var stateSearch = document.createElement("input");
    stateSearch.setAttribute("type", "text");
    stateSearch.setAttribute("id", "stateSearch");
    stateSearch.setAttribute("placeholder", "Search for a state");
    chartContainer.appendChild(stateSearch);

    // Create a search button for the search input
    var searchButton = document.createElement("button");
    searchButton.innerHTML = "Search";
    searchButton.setAttribute("id", "searchButton");
    chartContainer.appendChild(searchButton);



    //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
        .center([12.64, 42])
        .rotate([102, 0, 0])
        .parallels([40, 75])
        .scale(3000)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];    
    promises.push(d3.csv("data/Species.csv")); //load attributes from csv    
    promises.push(d3.json("data/countries.topojson")); //load background spatial data    
    promises.push(d3.json("data/Neighborhood_Associations.topojson")); //load choropleth spatial data    
    promises.push(d3.csv("data/species_az.csv")); //load attributes from csv 
    Promise.all(promises).then(callback);

    function callback(data){    
        csvData = data[0];    
        countries = data[1];   
        states = data[2]; 
        csvSpecies = data[3];

        console.log(csvData);
        //console.log(countries.objects);
        //console.log(states);

        //place graticule on the map
        setGraticule(map, path);

        // Translate TopoJSON to GeoJSON
        var worldCountries = topojson.feature(countries, countries.objects.world_administrative_boundaries),
            usStates = topojson.feature(states, states.objects.Neighborhood_Associations).features;

        console.log(worldCountries);
       
        //join csv data to GeoJSON enumeration units
        usStates = joinData(usStates, csvData);

        console.log(usStates);
        
            
        //add Europe countries to map
        var country = map.append("path")
            .datum(worldCountries)
            .attr("class", "countries")
            .attr("d", path);

        //create the color scale
        var colorScale = makeColorScale(csvData);
        
        //add enumeration units to the map
        setEnumerationUnits(usStates, map, path);

        var sizeScale = getSizeScale(csvData); // Get the size scale based on your data
        setProportionalSymbols(usStates, map, path, sizeScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);

        createDropdown(csvData);

        // Event listener for the Hawaii button
        searchButton.addEventListener("click", function() {
            SearchBar(usStates);
        });
        


        // Function to zoom the map to Hawaii
        function SearchBar(usStates) {

            var stateName = document.getElementById('stateSearch').value;
            // Assuming Hawaii is in the `usStates` dataset
            var state = usStates.find(function(d) {
                return d.properties.name.toLowerCase() === stateName.toLowerCase();
            });

            if (state) {
                var bounds = path.bounds(state),
                    dx = bounds[1][0] - bounds[0][0],
                    dy = bounds[1][1] - bounds[0][1],
                    x = (bounds[0][0] + bounds[1][0]) / 2,
                    y = (bounds[0][1] + bounds[1][1]) / 2,
                    scale=2,//scale = 0.9 / Math.max(dx / width, dy / height),
                    translate = [width / 2 - scale * x, height / 2 - scale * y];
            
                map.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
            } else {
                alert("State not found.");
            }
        }
   


    };
};

function setGraticule(map, path){
    //create graticule generator
    var graticule = d3.geoGraticule()
        .step([10, 10]); //place graticule lines every 5 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    //create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
};

function joinData(usStates, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvRegion = csvData[i]; //the current region
        var csvKey = csvRegion.adm1_code; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<usStates.length; a++){

            var geojsonProps = usStates[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.adm1_code; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    };
    return usStates;
};

function setEnumerationUnits(usStates, map, path){
    //add France regions to map
    var state = map.selectAll(".regions")
        .data(usStates)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "regions " + d.properties.adm1_code;
        })
        .attr("d", path)        
        .style("fill", "#D3D3D3")
        .style("stroke", "#FFFFFF") // Optional: add a stroke around states
        .style("stroke-width", "1px")
        .on("click", function(event, d) {
            var currentStateCode = d.properties.adm1_code; // Assuming 'adm1_code' is how states are identified in your data
            var speciesInState = csvSpecies.filter(function(row) {
                return row.adm1_code === currentStateCode;
            });
            var clickedStateName = d.properties.name;  // Adjust based on your data structure
            updatePanel(speciesInState, clickedStateName); // Update the panel with filtered species data
        })
        .on("mouseover", function(event, d){
            console.log(d);
            highlight(d.properties);
        })
        .on("mouseout", function(event, d){

            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);
    var desc = state.append("desc")
        .text('{"stroke": "#FFF", "stroke-width": "0.5px"}')

    console.log(state);
};
 
// //function to create color scale generator


function makeColorScale(data){
    var colorClasses = ["#0da982"]; //#006d2c

    //create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //assign array of expressed values as scale domain
    colorScale.domain(domainArray);

    return colorScale;
};

// First, create a size scale for the symbols
function getSizeScale(csvData) {
    // Create a scale for circle radius
    var size = d3.scaleSqrt()
        .range([0, 50]) // Max circle radius in pixels
        .domain([0, d3.max(csvData, function(d) { return +d[expressed]; })]); // Dynamically calculate max data value
    return size;
}

// Function to add proportional symbols
function setProportionalSymbols(usStates, map, path, sizeScale) {
    // Calculate centroids for each state for placing circles
    usStates.forEach(function(d) {
        d.properties.centroid = path.centroid(d);
    });

    var symbols = map.selectAll(".symbol")
        .data(usStates)
        .enter()
        .append("circle")
        .attr("class", "symbol")
        .attr("cx", function(d) { return d.properties.centroid[0]; })
        .attr("cy", function(d) { return d.properties.centroid[1]; })
        .attr("r", function(d) {
            var value = d.properties[expressed];
            return value ? sizeScale(value) : 0; // Avoid creating a circle for undefined values
        })
        .style("fill", "#008866") // You can keep color static or scale it as well
        .style("opacity", 0.6);

    // Optional: Add interactions or additional styles here
}

//function to create coordinated bar chart
function setChart(csvData, colorScale){

    // Positioning variables
    /*var chartRight = 10,
        chartTop = 260;*/

    //create a second svg element to hold the bar chart
    var chart = d3.select(".chart-container")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart")
        .style("position", "absolute")
        /*.style("right", chartRight + "px")
        .style("top", chartTop + "px");*/

    //set bars for each state
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bars " + d.adm1_code;
        })
        .attr("width", chartWidth / csvData.length - 1)
        .on("mouseover", function(event, d){
            
            highlight(d);
        })
        .on("mouseout", function(event, d){
            dehighlight(d);
        })
        .on("mousemove", moveLabel);
    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
    
    //CHARTTITLE, YAXIS, AXIS, AND CHARTFRAME BLOCKS
    
    var chartTitle = chart.append("text")
        .attr("x", 60)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Number of " + expressed + " in each state");

    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    //set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale);
}; //end of setChart()


//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select(".dropdown-container")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};

//dropdown change event handler
function changeAttribute(attribute, csvData) {
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    var sizeScale = getSizeScale(csvData);

    var maxVal = d3.max(csvData, function(d) { return parseFloat(d[expressed]); });

    // Recreate the yScale based on the selected attribute
    var yDomain;
    yDomain=[0,500]
    if (expressed === 'Amphibians') {
        yDomain = [0, 20];
    } else if (expressed === 'Arachnids') {
        yDomain = [0, 10];
    } else if (expressed === 'Birds') {
        yDomain = [0, 30];
    } else if (expressed === 'Clams') {
        yDomain = [0, 80];
    } else if (expressed === 'Conifers and Cycads') {
        yDomain = [0, 5];
    } else if (expressed === 'Crustaceans') {
        yDomain = [0, 10];
    } else if (expressed === 'Ferns and Allies') {
        yDomain = [0, 30];
    } else if (expressed === 'Fishes') {
        yDomain = [0, 40];
    } else if (expressed === 'Flowering Plants') {
        yDomain = [0, 420];
    } else if (expressed === 'Insects') {
        yDomain = [0, 40];
    } else if (expressed === 'Lichens') {
        yDomain = [0, 3];
    } else if (expressed === 'Mammals') {
        yDomain = [0, 30];
    } else if (expressed === 'Reptiles') {
        yDomain = [0, 20];
    } else if (expressed === 'Snails') {
        yDomain = [0, 20];
    } 


    // Update the yScale domain
    yScale.domain(yDomain);

    // Update the y-axis
    var yAxis = d3.axisLeft().scale(yScale);
    d3.select(".axis").call(yAxis);

    // //recolor enumeration units
    // var regions = d3.selectAll(".regions")
    //     .transition()
    //     .duration(1000)
    //     .style("fill", function (d) {
    //         var value = d.properties[expressed];
    //         if (value) {
    //             return colorScale(d.properties[expressed]);
    //         } else {
    //             return "#ccc";
    //         }
    //     });

    // Resize proportional symbols

    d3.selectAll(".symbol")
        .transition()
        .duration(1000)
        .attr("r", function(d) {
            var value = d.properties[expressed];
            return value ? sizeScale(value) : 0;
        });
    
    //Sort, resize, and recolor bars
    var bars = d3.selectAll(".bars")
        //Sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);


    updateChart(bars, csvData.length, colorScale);
}; //end of changeAttribute()


//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i) {
            var parsedValue = parseFloat(d[expressed]);  // Assumes data has been cleaned
            if (!isNaN(parsedValue)) {
                var scaledValue = yScale(parsedValue);
                return Math.max(0, 290 - scaledValue);  // Use Math.max to avoid negative heights
            } else {
                console.log("Invalid data for element:", d);  // Log the problematic data
                return 0;  // Provides a fallback height (e.g., 0) for invalid data cases
            }
        })
        .attr("y", function(d) {
            var value = parseFloat(d[expressed]);
            if (!isNaN(value)) {
              return yScale(value);
            } else {
              console.log("Invalid data for element:", d);
              return 0; // or set to a default position if 0 is not suitable
            }
        })
        //color/recolor bars
        .style("fill", function(d){            
            var value = d[expressed];            
            if(value) {                
                return colorScale(value);            
            } else {                
                return "#ccc";            
            }
        });
        
    var chartTitle = d3.select(".chartTitle")
        .text("Number of " + expressed + " in each state");
    

};


//function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.adm1_code)
        .style("stroke", "black")
        .style("stroke-width", "2");

    setLabel(props)
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.adm1_code)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };

    d3.select(".infolabel")
        .remove();
};

//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.adm1_code + "_label")
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.name);
};

//function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = event.clientX + 10,
        y1 = event.clientY - 75,
        x2 = event.clientX - labelWidth - 10,
        y2 = event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};


function updatePanel(speciesInState,stateName) {
    var panel = d3.select("#right-panel");
    panel.html("");  // Clear the panel first

    // Append a header
    panel.append("h3").text("Species Groups in "+stateName);

    // Collect unique groups
    let groups = new Map();

    speciesInState.forEach(species => {
        if (species.Group && species["Scientific Name"]) {
            if (!groups.has(species.Group)) {
                groups.set(species.Group, []);
            }
            groups.get(species.Group).push(species);
        }
    });

    if (groups.size > 0) {
        groups.forEach((speciesList, group) => {
            let groupContainer = panel.append("div").attr("class", "group-container");
            let header = groupContainer.append("p")
                .text(group)
                .attr("class", "group-header")
                .style("cursor", "pointer");
            let list = groupContainer.append("ul")
                .style("display", "none")
                .attr("class", "species-list");

            speciesList.forEach(species => {
                list.append("li")
                    .text(species["Scientific Name"])
                    .attr("class", "species-name")
                    .on("mouseover", function(event) {
                        showTooltip(event, species);
                    })
                    .on("mouseout", function() {
                        hideTooltip();
                    });
            });

            header.on("click", function() {
                let isVisible = list.style("display") === "none";
                list.style("display", isVisible ? "block" : "none");
            });
        });
    } else {
        panel.append("p").text("No groups available for this state.");
    }
}

function showTooltip(event, species) {
    let tooltip = d3.select("#tooltip");

    tooltip.html(`<strong>Scientific Name:</strong> ${species["Scientific Name"]}<br>
                  <strong>Common Name:</strong> ${species["Common Name"]}<br>
                  <strong>Where Listed:</strong> ${species["Where Listed"]}<br>
                  <strong>ESA Listing Status:</strong> ${species["ESA Listing Status "]}`)
    
           .style("visibility", "visible")
           .style("opacity", 0); // Temporarily make it invisible to measure

    // Ensure the DOM has updated to reflect the new content
    setTimeout(() => {
        const tooltipWidth = tooltip.node().offsetWidth;
        const viewportWidth = window.innerWidth;
        const leftPosition = 0.8 * viewportWidth - tooltipWidth; // Calculate the left position

        tooltip.style("left", `${leftPosition}px`)
               .style("top", (event.pageY + 10) + "px")
               .style("opacity", 1); // Make it visible again
    }, 10);
}

function hideTooltip() {
    d3.select("#tooltip").style("visibility", "hidden");
}

function setupEventListeners() {
    var resetButton = document.getElementById('resetMap');
    if (resetButton) {
        resetButton.addEventListener('mouseover', function() {
            document.getElementById('resetTooltip').style.display = 'block';
        });

        resetButton.addEventListener('mouseout', function() {
            document.getElementById('resetTooltip').style.display = 'none';
        });
    }

    // Additional event listeners can be added here
    document.addEventListener('DOMContentLoaded', function() {
        var dropdown = document.querySelector('.dropdown-container select'); // update this selector as necessary
        var tooltip = document.getElementById('dropdownTooltip');
        console.log(dropdown, tooltip);  // Check if elements are correctly selected
    
        dropdown.addEventListener('mouseover', function() {
            console.log("Mouseover triggered");  // Check if this triggers
            tooltip.style.display = 'block';
        });
    
        dropdown.addEventListener('mouseout', function() {
            console.log("Mouseout triggered");  // Check if this triggers
            tooltip.style.display = 'none';
        });
    });
       
}

function continueToMap() {
    var initialPage = document.getElementById('initialPage');

    // Hide the initial page
    initialPage.style.display = 'none';
}

function calculatePercentages(data) {
    console.log("Sample data for verification:", data.slice(0, 1));  // Check the structure of input data

    // Correctly access the properties, make sure 'S_Group' matches your CSV header
    const grouped = d3.group(data, d => d.State, d => d.Group);

    const percentages = [];
    grouped.forEach((groups, state) => {
        let total = 0;
        groups.forEach((species, group) => {
            total += species.length;
        });

        groups.forEach((species, group) => {
            percentages.push({
                State: state,
                Group: group,
                Percentage: (species.length / total) * 100
            });
        });
    });

    console.log("Computed Percentages:", percentages);  // Check the output here
    return percentages;
}

