var express = require('express');
var router = express.Router();
var request = require('request');

router.all('/*', function(req, res) {
    var error = {d: { __messages: [{ type: "ERROR", text: "Proxy Error", code: "PROXY"}] }};
     
    var writeError = function() {
        res.writeHead(500, {});
        res.write(JSON.stringify(error));
        res.end();
    };

    var serialize = function(obj) {
        var str = [];
        for(var p in obj)
            if (obj.hasOwnProperty(p)) {
                str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
            }
        return str.join("&");
    };

    try {
        var body = req.body;
        var destination = req.headers["X-ProxyDestination".toLowerCase()];
        var options = {
            url: destination,
            method: req.method,
            headers: {
                "Content-Length": req.headers["content-length"] || 0,
                "Content-Type": req.headers["content-type"],
                "Authorization": req.headers["authorization"]
            },
            followAllRedirects: true,
            body: serialize(body),
            jar: false,
            strictSSL: false,
        };

        try {
            request(options, function(err, response, data) {
                try {
                    var statusCode = (response ? response.statusCode : 500) || 500;
                    var headers = (response ? response.headers : {}) || {};
                    
                    res.writeHead(statusCode, headers);
                    res.write(data || JSON.stringify(err));
                    res.end();
                }
                catch (ex) {
                    console.log(ex);
                    writeError();
                }
            });
        }
        catch (ex) {
            console.log(ex);
            writeError();
        }
    }
    catch (ex) {
        console.log(ex);
        writeError();
    }
});

module.exports = router;
