require.config({
    baseUrl: 'static/'
});

splunkjs.config({
    proxyPath: '/proxy',
    scheme: 'https',
    host: config.splunkHost,
    port: config.splunkRESTPort,

    authenticate: function(done) {
        require([
            "jquery",
            "jquery.cookie"
        ], function($) {
            // Retrieve the session key and username from cookies
            var splunkSessionKey = $.cookie("splunk_sessionkey");
            var splunkCurrentUser = $.cookie("splunk_username");

            // Log in using the session key and username
            if (splunkSessionKey) {
                done(null, {sessionKey: splunkSessionKey, username: splunkCurrentUser}); 
            }
            else {
                // send user to login page
                window.location.href = "/login";
            }
        });
    },
    onSessionExpired: function (authenticate, done) {
        // send user to login page
        window.location.href = "/login";
    },
    onDrilldown: function(drilldown) {
        console.log('drilldown',drilldown)
    }
});