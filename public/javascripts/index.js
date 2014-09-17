var deps = [
    "splunkjs/ready!",
    "splunkjs/mvc/searchmanager",
    "splunkjs/mvc/postprocessmanager",
    "splunkjs/mvc/eventsviewerview",
    "splunkjs/mvc/splunkmapview",
    "splunkjs/mvc/chartview",
    "splunkjs/mvc/tableview"
];

require(deps, function(mvc) {
    // Load individual components
    var SearchManager = require("splunkjs/mvc/searchmanager");
    var PostProcessManager = require("splunkjs/mvc/postprocessmanager");
    var EventsViewer = require("splunkjs/mvc/eventsviewerview");
    var ChartView = require("splunkjs/mvc/chartview");
    var TableView = require("splunkjs/mvc/tableview");
    var SplunkMapView = require("splunkjs/mvc/splunkmapview");

    // Define search managers
    // ... for the events viewer
    var searchmain = new SearchManager({
        id: "main-search",
        search: "index=_internal | head 1000 | fields *",
        preview: true,
        cache: true
    });

    // ... for the chart
    var searchsub1 = new PostProcessManager({
        id: "subsearch1",
        managerid: "main-search",
        search: " | stats count by sourcetype"
    });

    // ... for the table
    var searchsub2 = new PostProcessManager({
        id: "subsearch2",
        managerid: "main-search",
        search: " | fields sourcetype, source, host"
    });

    // ... for the map
    var searchmap = new SearchManager({
        id: "map-search",
        search: "| inputlookup earthquakes.csv | rename Lat as lat Lon as lon | geostats count",
        preview: true,
        cache: true
    });

    // Set up an events viewer
    myeventsviewer = new EventsViewer({
        id: "example-eventsviewer",
        managerid: "main-search",
        type: "raw",
        "raw.drilldown": "inner",
        drilldownRedirect: true, 
        count: 3,
        el: $("#myeventsviewer"),
        pagerPosition: 'top',
    }).render();

    // Set up a Splunk map
    mymap = new SplunkMapView({
        id: "example-splunkmap",
        managerid: "map-search",
        drilldown: true, 
        drilldownRedirect: true, 
        el: $("#mymap")
    }).render();

    // Set up a chart
    mychart = new ChartView({
        id: "example-chart",
        managerid: "subsearch1",
        type: "bar",
        drilldown: "all", 
        drilldownRedirect: false, // Disable global drilldown
        el: $("#mychart")
    }).render();

    // Set up a table
    mytable = new TableView({
        id: "example-table",
        managerid: "subsearch2",
        pageSize: 3,
        wrap: true,
        drilldown: "cell",
        // drilldownRedirect: false, // Use the preventDefault() method instead
        el: $("#mytable"),
        pagerPosition: 'top',
    }).render();


    // Create a click event handler for the map
    mymap.on("click:marker", function(f) {
        // Display a data object in the console
        var clickdata = f.data;
        console.log("Map click event: ", clickdata["row.count"], "instances at lat: ", clickdata["click.lat.value"], ", long:", clickdata["click.lon.value"]);
    });

    // Create click event handlers for the chart and its legend
    mychart.on("click:legend", function(f) {
        // Displays a data object in the console--the legend text
        console.log("Legend click event: ", f.name2);
    });
    mychart.on("click:chart", function(f) {
        // Displays a data object in the console
        console.log("Chart click event: ", f.value);
    });

    // Create a click event handler for the table
    mytable.on("click", function(f) {
        // Bypass the global drilldown function
        f.preventDefault();

        // Display a data object in the console
        console.log("Table data object:", f.data);
    });

});