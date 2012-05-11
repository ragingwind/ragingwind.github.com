/**
 * WarpZoom
 *
 * by Nicolas Ramz <nicolas.ramz@gmail.com>
 * http://www.warpdesign.fr
 *
 * version: 1.0 - 14.05.2009
 *
 * History:
 *
 * 1.0: FIXED: crash if no images could be found (no need to bind the startEvent in this case)
 * 0.9: ADDED: cross-browser drag cursors (tested in IE/FF/Safari, not working with Opera)
 * 0.8: FIXED: keep zoom
 * 0.7: ADDED: zoom track (only works in d&d for now)
 * 0.6: ADDED: loading image, only displayed at first load (seems to be showing only in FF, need to fix that)
 * 0.5: FIXED: image size defered (need to find a better way, maybe preload image when thumb is displayed ?)
 *      FIXED: initial image position in d&d mode
 * 0.4: FIXED: loupe in d&d
 *      FIXED: problems retrieving image size
 * 0.3: ADDED: drag&drop
        ADDED: loupe parameter
 *      FIXED: initial mouse position
 *      FIXED: using pageX instead of clientX to avoid problems when scrolling viewport
 * 0.2: FIXED: using get(0).nodeName instead of attr('tagName') (the tagName isn't an attribute anyway)
 * 0.1: initial release
 *
 * TODO: FIX calculations which include borders in FF/Opera/IE, and not in FF (this explains the extra pixels in zoomtrack & magnify zone in these browsers)
 * TODO: automatically add magnified div if it isn't present in the DOM
 * TODO: check for not present attributes (href, rel,...) and provide defaults value
 * TODO: add an option to automatically go to magnify mode when clicking a thumbnail and
 * the zoom view is being magnified
 * TODO: implement mouseout dezoom mode
 *
 *
 * Licence
 * -------
 * 
 * WarpZoom is distributed under the MIT licence.
 * 
 * Copyright (c) 2009 Nicolas Ramz.
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

 (function($) {
        $.fn.zoom = function(settings) {
            
            options = {
                 divName:           '#zoom',        // div that will hold the zoomed (magnified) pictured
                 delay:             1,              // delay in ms between each mousemove poll
                 cursor:            'crosshair',    // cursor pointer
                 grabCursor:        'move',    // cursor when zoomed
                 grabbingCursor:    'move',         // cursor when grabbing
                 movingCursor:      'move',
                 selected:          0,              // initially selected file
                 startEvent:        'dblclick',     // event that will run the magnify, must be a valid bindable jQuery event
                 loupe:             'loupe.gif',    // loop overlay, set to false to disable
                 loupeInfo:         {normal: 'Click here to zoom', zoomed: 'Click here to go to normal size'},
                 drag:              false,          // drag&drop mode
                 debug:             false,          // Enable debug (needs console object)
                 keepZoom:          false,          // If zoom mode is activated and a thumbnail is selected, it goes to zoom mode
                 zoomTrack:         false,          // keep track of zoom in the thumbnail
                 loaderImg:         'loader.gif'    // Loading image displayed before we get img size
            };

            var options = $.extend(options, settings);

            return this.each(function() {
                var $$ = $(this);

                var interval = null;
                var listen = false;
                var selected = options.selected;

                var $magnifiedElt  = $(options.divName);   // Magnified element
                var pictures = new Array();                 // array that will hold all detected pics
                var defaultFile = '';
                var dragged = !options.drag;                // if dnd mode isn't activated it's like we're always dragging (ie: no need to mousedown)
                var dnd = options.drag;
                var oldx = 0;
                var oldy = 0;
                var imageW = 0;
                var imageH = 0;
                var posx = 0;
                var posy = 0;
                var undrag = false;
                var $selected = null;
                var hover = false;

                // set magnifier css stuff
                $magnifiedElt.css('background-color', '#ffffff');
                // css('cursor', options.cursor).

                if (options.debug && typeof (console) !== 'undefined')
                {
                    console.log(options);
                }

                timeIntervalFunc = function(){
                    this.checkListen();
                };
               
                checkListen = function()
                {
                    listen = true;
                };

                if (options.loaderImg != false)
                    var loaderImg = $('<img/>').attr('src', options.loaderImg).css({position:'absolute', left: '50%', top: '50%', zIndex: 2 }).load(function(){$(this).css({marginLeft: ($(this).width()/2), marginTop: ($(this).height()/2)});}).appendTo($magnifiedElt).hide();
                else
                    var loaderImg = $('<img/>');

                if (options.loupe != false)
                {
                    var loupeImg = $('<img/>').attr('src', options.loupe).css({position:'absolute', left:0, bottom:0, opacity:.7, cursor:"pointer"}).click(function(event) { toggleZoom(event); return false; }).appendTo($magnifiedElt).hide();
                    loupeImg.attr('alt', options.loupeInfo.normal).hover(function() { $(this).css("opacity", .8); $(this).attr('alt', options.loupeInfo.zoomed)}, function() { $(this).css("opacity", .7); $(this).attr('alt', options.loupeInfo.normal) });

                    if (options.stickyLoupe)
                        loupeImg.fadeIn();
                }
                else 
                    var loupeImg = $('<img/>');

                // test zoom track
                //** $('<div/>').css({width:'100px', height:'50px', border:'1px solid #aaaaaa', backgroundColor:'#ffffff', opacity:.3, position:'absolute'}).appendTo();
                // /test zoom track

                toggleZoom = function(event)
                {
                    // Already zoomed in, by default, we dezoom (in drag & drop mode only magnify can exit zoom)
                    if ($magnifiedElt.hasClass('zoomed')) //  && !dnd
                    {
                        endZoom();
                    }
                    else // ok, here is the big part
                    {
                        startZoom(event);
                    } // else
                }

                moveBackground = function(event, firstPos)
                {                  
                    if (!dnd)
                    {   
                        if (hover)
                        {
                            var offset = $magnifiedElt.offset();
                            var left_percent = (100 * (event.pageX - offset.left)) / $magnifiedElt.width();
                            var top_percent = (100 * (event.pageY - offset.top)) / $magnifiedElt.height();
                            newPos = left_percent + '% ' + top_percent + '%';

                            // movetrack (shouldn't be there, but well...
                            // test
                            ratiox = $selected.width()/$magnifiedElt.width();
                            ratioy = $selected.height()/$magnifiedElt.height();
                            // /test
                            trackx = left_percent*ratiox + '%';
                            tracky = top_percent*ratioy + '%';
                        }
                        else
                        {
                            newPos = '0 0';
                            trackx = '0';
                            tracky = '0';
                        }
                    }
                    else
                    {
                        if (firstPos)
                        {
                            posx = 0;
                            posy = 0;
                            $magnifiedElt.css('background-position', '0 0');
                            return;
                        }

                        var deltax = event.pageX - oldx;
                        var deltay = event.pageY - oldy;

                        /*
                        if (options.debug && typeof (console) !== 'undefined')
                            console.log('Zoom: moving bg: deltax=' + deltax + ', deltay=' + deltay);
                        */

                        if ((deltax) || (deltay))
                        {
                            if (((posx + deltax) <= 0) && ((posx + deltax) >= -(imageW - $magnifiedElt.width())))
                                posx += deltax;

                            if (((posy + deltay) <= 0) && ((posy + deltay) >= -(imageH - $magnifiedElt.height())))
                                posy += deltay;

                            newPos = posx + 'px ' + posy + 'px';
                        }

                        oldx = event.pageX;
                        oldy = event.pageY;

                        // movetrack (shouldn't be there, but well...
                        trackx = Math.abs(parseInt(($selected.width() * posx) / imageW)) + 'px';
                        tracky = Math.abs(parseInt(($selected.height() * posy) / imageH)) + 'px';
                    }
                    
                    $magnifiedElt.css('background-position', newPos);
                    
                    if (options.zoomTrack)
                        $selected.find('.zoomtrack').css({top: tracky, left: trackx});
                }

                installTrack = function(event)
                {
                    // calculates size of track elt (guess we should do that only once, but thing is we won't have image size
                    // maybe we really should cache it...
                    // Problem: will only work in d&d mode, FIX IT !!
                    var width = parseInt(($magnifiedElt.width() * $selected.width()) / imageW);
                    var height = parseInt(($magnifiedElt.height() * $selected.height()) / imageH);
                    $selected.find('.zoomtrack').css({width: width + 'px', height: height  + 'px'}).fadeIn('fast');

                    if (options.debug && typeof (console) !== 'undefined')
                    {
                        console.log('installing track: ' + width + ', ' + height);
                        $('.debugzoom').prepend('installing track: ' + width + ', ' + height);
                    }
                }

                removeTrack = function(event)
                {
                    $selected.find('.zoomtrack').fadeOut('fast');
                }

                // Zoom installation: we need to pass in event to get mouse coords and correctly position the background
                startZoom = function(event)
                {
                    if (options.debug && typeof (console) !== 'undefined')
                    {
                        console.log('Zoom: magnify');
                    }

                    if (options.stickyLoupe)
                        loupeImg.fadeOut();
                    else
                        loupeImg.fadeIn();

                    // first let's set the state of the magnified area
                    $magnifiedElt.addClass('zoomed');
                    var imgName = pictures[selected].huge;
                    // defer background display in dnd mode to prevent ugly refresh problems in Opera
                    if (!dnd)
                        $magnifiedElt.css('background-image', 'url(' + imgName + ')');//.css('background-position', '0% 0%');
                    else
                        $magnifiedElt.css('background-image', 'none');

                    moveBackground(event, true);

                    // todo: install zoomtrack here for no d&d

                    // small tip to call a local method in setInterval
                    interval = window.setInterval(timeIntervalFunc, options.delay);
                    
                    if (options.debug  && typeof (console) !== 'undefined')
                    {
                        console.log('Zoom: setinterval = ' + interval);
                    }

                    $magnifiedElt.mousemove(function(e) {
                        if (listen && dragged)
                        {
                            moveBackground(e);
                            listen = false;
                        }
                    });

                    // get background size
                    // need to do something here, to defer drag start until we got image size
                    var $img = $('<img/>').attr('src', pictures[selected].huge).load(function() { loaderImg.hide(); imageW = $(this).width(); imageH = $(this).height(); $(this).remove(); $magnifiedElt.css('background-image', 'url(' + pictures[selected].huge +')'); if (options.zoomTrack) installTrack(); }).hide();
                    $img.appendTo('body');
                    
                    // do not display loader if we already got image in the cache to prevent ugly blinking
                    if (!(imageW = $img.width()) || !(imageH = $img.height()))                         
                    {
                        loaderImg.show();
                    }

                    if (dnd == true)
                    {
                        if (options.debug && typeof (console) !== 'undefined')
                        {
                            console.log('Zoom: image: ' + pictures[selected].huge + '(size: ' + imageW + ' x ' + imageH + ')');
                            console.log('Zoom: oldx = ' + oldx + ', oldy ' + oldy + ')');
                        }

                        // set hand pointer
                        /****
                        $magnifiedElt.css('cursor', ($.browser.mozilla ? '-moz-grab' : 'move'));
                        *****/
                        $magnifiedElt.css('cursor', options.grabCursor);

                        $magnifiedElt.mousedown(function(event){
                            // test
                            oldx = event.pageX;
                            oldy = event.pageY;
                            // /test

                            /*
                            if (options.debug && typeof (console) !== 'undefined')
                            {
                                console.log('Zoom: dragging (size: ' + imageW + ' x ' + imageH + ')');
                            }
                            */

                            dragged = true;
                            $magnifiedElt.css('cursor', options.grabbingCursor);
                            /***
                            if ($.browser.mozilla)
                                $magnifiedElt.css('cursor', ($.browser.mozilla ? '-moz-grabbing' : 'move'));
                            ***/
                        });

                        $magnifiedElt.mouseup(function(){
                            dragged = false;
                            $magnifiedElt.css('cursor', options.grabCursor);
                            /****
                            $magnifiedElt.css('cursor', ($.browser.mozilla ? '-moz-grab' : 'move'));
                            *****/
                            /*
                            if (options.debug && typeof (console) !== 'undefined')
                                console.log('Zoom: stopped dragging');
                            */

                            undrag = true;
                        });
                    }
                    else
                    {
                        $magnifiedElt.css('cursor', options.movingCursor);
                    }
                };

                endZoom = function()
                {
                    $magnifiedElt.unbind('mousemove').unbind('mousedown').unbind('mouseup');

                    $magnifiedElt.removeClass('zoomed');
                    var bgName = pictures[selected].big;
                    
                    if (options.debug && typeof (console) !== 'undefined')
                    {
                        console.log('Zoom: un-magnify: ' + bgName);
                    }
                    
                    $magnifiedElt.css('background', 'url(' + bgName + ') no-repeat center center');
                    
                    // resets cursor
                    // ** $magnifiedElt.css('cursor', options.cursor);

                    if (options.debug  && typeof (console) !== 'undefined')
                    {
                        console.log('Zoom: clearing interval: ' + interval);
                    }
                    
                    clearInterval(interval);

                    if (options.stickyLoupe)
                        loupeImg.fadeIn();
                    else
                        loupeImg.fadeOut();

                    // resets dragged 
                    dragged = !options.drag;
                    undrag = false;

                    if (options.zoomTrack)
                        removeTrack();

                    if (!dnd)
                        $magnifiedElt.css('cursor', options.cursor);
                }

                // Here we setup everything
                if ($$.get(0).nodeName.toLowerCase() == 'ul')
                {
                    if (options.debug  && typeof (console) !== 'undefined')
                    {
                        console.log('Zoom: found element' + $$.html());
                        console.log('children: ' + $$.children('li').length);
                    }

                    $$.children('li').css('display', 'inline');

                    // build the list of pics & sets selected pic
                    $$.children('li').children('a').children('img').each(function(i){
                        if (options.debug && typeof (console) !== 'undefined')
                        {
                            console.log('Zoom: adding element ' + i);
                        }

                        pictures[i] = { thumb: $(this).attr('src'), big: $(this).parent().attr('href'),
                            huge: $(this).parent().attr('rel') };

                        if (i == options.selected)
                        {
                            $selected = $(this).parent();
                            $selected.addClass('selected');
                            defaultFile = $selected.attr('href');
                        }

                        $(this).parent().css({position:'relative', display:'inline-block'});
                        // test zoom track
                        $('<div class="zoomtrack"/>').css({border:'1px solid #aaaaaa', backgroundColor:'#ffffff', opacity:.5, position:'absolute', top:0, left:0}).appendTo($(this).parent()).hide();
                        // /test zoom track

                        $(this).parent().click(function(event){

                            zoomed = $magnifiedElt.hasClass('zoomed');

                            // be sure zoom is stopped
                            endZoom();

                            // change selected elt
                            var $li = $(this).parent();
                            selected = $li.parent().children().index($li);
                            $selected = $(this);
                            $magnifiedElt.css('background', 'url(' + pictures[selected].big + ') no-repeat');
                            
                            if (options.debug && typeof (console) !== 'undefined')
                            {
                                console.log('Zoom: adding thumbnail: ' + pictures[selected].huge + ' (' + $magnifiedElt.attr('id') + ')');
                            }
                            
                            /*$magnifiedElt.html('<img style="display:none;" src="' + pictures[selected].huge + '" />');*/
                            $magnifiedElt.unbind('mousemove').removeClass('zoomed');
                            $$.children('li a').removeClass('selected');
                            $(this).addClass('selected');

                            if (options.keepZoom && zoomed)
                            {
                                startZoom(event, true);
                            }

                            return false;
                        });
                    });

                    $magnifiedElt.hover(function(event)
                    {
                        if (!options.stickyLoupe)
                            loupeImg.fadeIn('fast');
                        hover = true;
                    },
                    function(event)
                    {
                        hover = false;

                        if ($(this).hasClass('zoomed'))
                            return;
                        if (!options.stickyLoupe)
                            loupeImg.fadeOut('fast');
                    });

                    // Here we check for the magnify event to start magnifying
                    if (pictures.length)
                    {
                        $magnifiedElt.bind(options.startEvent, function(event){

                            if (dnd & undrag)
                            {
                                undrag = false;
                                return;
                            }

                            if (options.debug && typeof (console) !== 'undefined')
                            {
                                console.log('Zoom: clicked on magnify');
                            }

                            toggleZoom(event);
                            
                            return false;
                        }); // if click()...
                    }

                    // sets cursor
                    $magnifiedElt.css('cursor', options.cursor);

                    if (options.debug && typeof (console) !== 'undefined')
                    {
                        console.log('Zoom: elements array: ');
                        console.log(pictures);
                    }

                } // if (tagName...)
                else
                {
                    if (options.debug && typeof (console) !== 'undefined')
                    {
                        console.log('Zoom: WARNING: called on element of type ' + $$.attr('tagName').toLowerCase());
                    }
                }
            });
        }; // / $.fn.zoom
 })(jQuery);