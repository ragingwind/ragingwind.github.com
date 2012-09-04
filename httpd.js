#!/usr/bin/env node

var port = Number(process.argv.PORT || 8082)
	, express = require('express')
	, http = require('http');
	
var app = express();

app.configure(function() {
	app.use(express.methodOverride());
	app.use(express.bodyParser());
	app.use(app.router);
	app.use("images", express.static(__dirname + '/images'));
	app.use("/", express.static(__dirname + '/'));
});

app.configure('development', function(){
	app.use(express.static(__dirname + '/public'));
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
}).listen(port);

console.log("Started daemon with port:" + port);

