/*
 * Copyright (c) 2010 devnight.net. All rights reserved.  Use of this
 * source code is governed by a MIT license that can be found at
 * http://ragingwind.github.com/LICENSE/MIT
 *
 * Image processing example for iOS
 * http://github.com/ragingwind/image-processing.cc
 *
 * @version 0.1
 * @author ragingwind@gmail.com
 * @note Code is draft, for testing.
 */
(function($){
	$.mobile.simplerouter = function(routes) {
		var routes = routes;
		$(document).bind("pagechange", function(e, data) {
			if (routes["pagechange"] !== undefined)
				routes["pagechange"](data);
		});
		
		$(document).bind("pagebeforechange", function(e, data) {
			if (routes["pagebeforechange"] !== undefined)
				routes["pagebeforechange"](data);
		});
		
		$(document).bind( "pagebeforechange", function( e, data ) {
			if ( typeof data.toPage === "string" ) {
				var u = $.mobile.path.parseUrl( data.toPage ),			
				url = $.url( u.hash.replace( /^#/, "" ) ),
				target = url.attr("host"),
				fn = routes[target];
				if (fn !== undefined) {
					fn({target:target, url:u.href, options:data.options, e:e});
				}
				else 
					console.error("hash router has no hander about " + data.toPage);
					
				e.preventDefault();
			}
		});
		
	}
})(jQuery);