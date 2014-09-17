// Set the web site's base URL
require.config({
    baseUrl: "static/"
});

// Enable <enter> keypress for login form
require(['jquery'], function($) {
    $("input").keypress(function (e) {
        if ((e.which && e.which == 13) || (e.keyCode && e.keyCode == 13)) {
            $('button.default').click();
            return false;
        } else {
            return true;
        }
    });
});

// Log In button function
function onLogin() {
    require([
        "jquery",
        "splunkjs/splunk",
    ], function($, jssdk) {

        // Get the username and passwords
        var username = $("#usernamebox").val();
        var password = $("#pwbox").val();

        // Use the Splunk SDK for JavaScript to log in to Splunk

        // Create a Service object
        var http =  new jssdk.ProxyHttp("/proxy");
        var service = new jssdk.Service(http, {
            username: username,
            password: password,
            scheme: "https",
            host: "localhost", 
            port: 8089,
        });
    
        // Log in to Splunk
        service.login(function(err) {
            // The session key and username are required for logging in
            if (!err) {
                var key = service.sessionKey;
                // Save the session key and username in cookies
                $.cookie("splunk_sessionkey", key);
                $.cookie("splunk_username", username);
                // Redirect to another page
                window.location.href = "/";  
            }
            else {
                $("#errorText").empty().append("<p class='fail'><br>Login failed! See the console for error info.</p>");
                console.error("Login failed: ", err);
            }              
        });
    });
}