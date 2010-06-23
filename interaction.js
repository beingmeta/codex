/* -*- Mode: Javascript; -*- */

var sbooks_gestures_id="$Id$";
var sbooks_gestures_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.

   This program comes with absolutely NO WARRANTY, including implied
   warranties of merchantability or fitness for any particular
   purpose.

    Use and redistribution (especially embedding in other
      CC licensed content) is permitted under the terms of the
      Creative Commons "Attribution-NonCommercial" license:

          http://creativecommons.org/licenses/by-nc/3.0/ 

    Other uses may be allowed based on prior agreement with
      beingmeta, inc.  Inquiries can be addressed to:

       licensing@beingmeta.com

   Enjoy!

*/

/*

  Preview behavior:
   click enables/disables preview mode, hold/release enables/disables
     preview mode
   clicking on the preview target while in preview mode jumps to the target
   shift acts just like the mouse button
  Body behavior:
   hold either temporarily hides the HUD or temporarily engages context mode
    (this might also be selecting some text)
   click when sbook.mode is non-context just drops the HUD
   click on a non-target makes it the target and enters context mode
   click on a target opens the mark HUD
  Marginal behavior:
   click on top or bottom margin, either hides HUD or engages last relevant
    mode
   click on left or right margin goes forward or backward
   hold on left or right margin auto-advances, springs back on release,
    stops on mouseout/touchout
     
  Handling hold with mouse:
   onmousedown enters mode, sets tick
   onmouseup leaves mode (unless shift is down)
   onmouseout leaves mode (unless shift or mouse is down)
     clears mouse_focus
   onmouseover shifts mode target when mode is live, sets mouse_focus on move
   shiftkey down enters mode on mouse_focus
   shiftkey up leaves mode (unless mousedown tick is set)

  Hold-free mode:
   click enters/leaves mode

*/

(function(){

    // Imports (kind of )
    var hasClass=fdjtDOM.hasClass;

    var holding=false; var hold_timer=false;
    
    var sbook_mousedown=false;
    var sbook_hold_threshold=750;
    var default_hud_flash=3000;

    /* Setup for gesture handling */

    function addHandlers(node,type){
	var mode=sbook.ui;
	fdjtDOM.addListeners(node,sbook.UI.handlers[mode][type]);}
    sbook.UI.addHandlers=addHandlers;

    function setupGestures(){
	var mode=sbook.ui;
	if (!(mode)) sbook.ui=mode="mouse";
	addHandlers(false,'window');
	addHandlers(document.body,'body');
	addHandlers(sbook.HUD,'hud');
	var handlers=sbook.UI.handlers[mode];
	if (mode)
	    for (key in handlers)
		if ((key[0]==='.')||(key[0]==='#')) {
		    var nodes=fdjtDOM.$(key); var h=handlers[key];
		    fdjtDOM.addListeners(nodes,h);}}
    sbook.setupGestures=setupGestures;

    var dont=fdjtUI.nobubble;
    function passmultitouch(evt){
	if ((evt.touches)&&(evt.touches.length>1)) return;
	else fdjtUI.nobubble(evt);}

    /* New simpler UI */

    function inUI(node){
	while (node)
	    if (!(node)) return false;
	else if (node.sbookui) return true;
	else node=node.parentNode;
	return false;}

    /* Onclick handlers */

    function body_onclick(evt){
	var target=fdjtUI.T(evt);
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] body_onclick() %o ui=%o cl=%o sbp=%o sbh=%o mode=%o",
		    fdjtET(),evt,(inUI(target)),(fdjtDOM.isClickable(target)),
		    sbook.preview,sbook.hudup,sbookMode());
	if (fdjtDOM.isClickable(target)) return;
	if (evt.clientX) {
	    var x=evt.clientX, y=evt.clientY;
	    fdjtLog("[%f] clientX=%o clientY=%o width=%o",fdjtET(),x,y,fdjtDOM.viewWidth());
	    if (evt.clientX<50)
		return pageBackward();
	    else if (evt.clientX>(fdjtDOM.viewWidth()-50))
		return pageForward();}
	if (inUI(target)) return;
	/* Three cases: preview, hudup, and plain */
	else if (sbook.preview) {
	    if (fdjtDOM.hasParent(target,sbook.preview)) 
		sbook.JumpTo(sbook.preview);
	    else sbook.Preview(false);}
	else if (sbook.mode) {
	    if (sbook.mode==='mark') {
		var tomark=sbook.getTarget(target);
		var selection=window.getSelection();
		var string=((selection)&&(selection.toString()));
		if ((string)&&(string.length))
		    sbookMark(tomark,false,string);
		else sbookMode(false);}
	    else sbookMode(false);}
	else {
	    var glosstarget=sbook.getTarget(target);
	    if (glosstarget) sbookMark(glosstarget);
	    else if (sbook.hudup) sbookMode(false);
	    else sbookMode(true);}}
    
    function hud_onclick(evt){
	var target=fdjtUI.T(evt);
	if (sbook.Trace.gestures) 
	  fdjtLog("[%f] hud_onclick() %o cl=%o sbp=%o sbh=%o mode=%o",
		  fdjtET(),evt,(fdjtDOM.isClickable(target)),
		  sbook.preview,sbook.hudup,sbookMode());
	if (fdjtDOM.isClickable(target)) return;
	else fdjtUI.cancel(evt);
	var ref=sbook.getRef(target);
	if (ref) {
	    if ((sbook.preview)&&(sbook.preview===ref)) 
		sbook.JumpTo(ref);
	    else sbook.Preview(ref,sbook.getRefElt(target));}}
    
    function margin_onclick(evt){
	var target=fdjtUI.T(evt);
	if (sbook.Trace.gestures) 
	  fdjtLog("[%f] margin_onclick() %o cl=%o sbp=%o sbh=%o mode=%o",
		  fdjtET(),evt,(fdjtDOM.isClickable(target)),
		  sbook.preview,sbook.hudup,sbookMode());
	if (fdjtDOM.hasParent(target,".glossmark")) return;
	var x=evt.clientX||touch_x;
	var y=evt.clientY||touch_y;
	var left=fdjtDOM.viewLeft();
	var width=fdjtDOM.viewWidth();
	var leftwidth=fdjtDOM.getGeometry("SBOOKPAGELEFT").width;
	var rightwidth=fdjtDOM.getGeometry("SBOOKPAGERIGHT").width;
	if (sbook.preview) sbook.Preview(false);
	else if ((sbook.edgeclick)&&((x-left)<leftwidth))
	    pageBackward();
	else if ((sbook.edgeclick)&&(((left+width)-x)<rightwidth))
	    pageForward();
	else if ((sbook.mode)||(sbook.hudup)) sbookMode(false);
	else sbookMode(true);
	fdjtUI.cancel(evt);}

    /* This does paging forward and backwards */
    sbook.UI.margin_onclick=margin_onclick;
    
    /* Keyboard handlers */

    // We use keydown to handle navigation functions and keypress
    //  to handle mode changes
    function onkeydown(evt){
	evt=evt||event||null;
	var kc=evt.keyCode;
	// sbook.trace("sbook_onkeydown",evt);
	if (evt.keyCode===27) { /* Escape works anywhere */
	    if (sbook.mode) {
		sbook.last_mode=sbook.mode;
		sbookMode(false);
		sbook.Preview(false);
		sbook.setTarget(false);
		fdjtID("SBOOKSEARCHTEXT").blur();}
	    else if (sbook.last_mode) sbookMode(sbook.last_mode);
	    else {
		if ((sbook.mark_target)&&
		    (fdjtDOM.isVisible(sbook.mark_target)))
		    sbookMode("mark");
		else sbookMode("context");}
	    return;}
	else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
	else if (kc===34) sbook.Forward();   /* page down */
	else if (kc===33) sbook.Backward();  /* page up */
	// Don't interrupt text input for space, etc
	else if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	else if (kc===32) {  // Space
	  if (sbook.preview) previewForward();
	  else sbook.Forward();}
	// backspace or delete
	else if ((kc===8)||(kc===45)) {
	    if (sbook.preview) previewBackward();
	    else sbook.Backward();}
	// Home goes to the current head.
	else if (kc===36) sbook.JumpTo(sbook.head);
	else return;}

    // At one point, we had the shift key temporarily raise/lower the HUD.
    //  We might do it again, so we keep this definition around
    function onkeyup(evt){
	evt=evt||event||null;
	var kc=evt.keyCode;
	// sbook.trace("sbook_onkeyup",evt);
	if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	else if ((evt.ctrlKey)||(evt.altKey)||(evt.metaKey)) return true;
	else {}}
    sbook.UI.handlers.onkeyup=onkeyup;

    /* Keypress handling */

    // We have a big table of command characters which lead to modes
    var modechars={
	43: "mark",13: "mark",
	63: "searching",102: "searching",
	65: "dash", 97: "dash",
	83: "searching",115: "searching",
	70: "searching",
	100: "device",68: "device",
	110: "toc",78: "toc",
	116: "dashtoc",84: "dashtoc",
	104: "help",72: "help",
	103: "allglosses",71: "allglosses",
	67: "console", 99: "console"};

    // Handle mode changes
    function onkeypress(evt){
	var modearg=false; 
	evt=evt||event||null;
	var ch=evt.charCode||evt.keyCode;
	// sbook.trace("sbook_onkeypress",evt);
	if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
	else modearg=modechars[ch];
	if (modearg==="dash") modearg=sbook.last_dash||"help";
	var mode=sbookMode();
	if (modearg) 
	    if (mode===modearg) {
		sbookMode(false); mode=false;}
	else {
	    sbookMode(modearg); mode=modearg;}
	else {}
	if (mode==="searching")
	    fdjtID("SBOOKSEARCHTEXT").focus();
	else if (mode==="mark") {
	    sbookMark.setup(false);
	    fdjtID("SBOOKMARKINPUT").focus();}
	else fdjtID("SBOOKSEARCHTEXT").blur();
	fdjtDOM.cancel(evt);}
    sbook.UI.handlers.onkeypress=onkeypress;

    /* HUD button handling */

    var mode_hud_map={
	"toc": "SBOOKTOC",
	"search": "SBOOKSEARCH",
	"allglosses": "SBOOKALLGLOSSES",
	"dash": "SBOOKDASH"};
    
    function hudbutton(evt){
	var target=fdjtUI.T(evt);
	var mode=target.getAttribute("hudmode");
	if (sbook.Trace.gestures) 
	  fdjtLog("[%f] hudbutton() %o mode=%o cl=%o sbp=%o sbh=%o mode=%o",
		  fdjtET(),evt,mode,(fdjtDOM.isClickable(target)),
		  sbook.preview,sbook.hudup,sbookMode());
	fdjtUI.cancel(evt);
	if (!(mode)) return;
	var hudid=((mode)&&(mode_hud_map[mode]));
	var hud=fdjtID(hudid);
	if (mode==='dash') mode=sbook.last_dash||"help";
	if (evt.type==='click') {
	    if (hud) fdjtDOM.dropClass(hud,"hover");
	    if (fdjtDOM.hasClass(sbook.HUD,mode)) {
		sbookMode(false); sbookMode(true);}
	    else sbookMode(mode);}
	else if ((evt.type==='mouseover')&&(sbook.mode))
	    return;
	else {
	    if (!(hud)) {}
	    else if (evt.type==='mouseover')
		fdjtDOM.addClass(hud,"hover");
	    else if (evt.type==='mouseout')
		fdjtDOM.dropClass(hud,"hover");
	    else {}}}
    sbook.UI.hudbutton=hudbutton;

    /* Mouse handlers */

    function hud_mousedown(evt){
	var target=fdjtUI.T(evt);
	var ref=sbook.getRef(target);
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] hud_mousedown() %o ref=%o cl=%o sbp=%o sbh=%o mode=%o",
		    fdjtET(),evt,ref,(fdjtDOM.isClickable(target)),
		    sbook.preview,sbook.hudup,sbookMode());
	if (!(ref)) return;
	if (fdjtDOM.isClickable(target)) return;
	fdjtUI.cancel(evt);
	if ((sbook.preview)&&(sbook.preview!==ref)) sbook.Preview(false);
	var src=sbook.getRefElt(target);
	if (hold_timer) {
	    clearTimeout(hold_timer);
	    hold_timer=false;}
	holding=false;
	if (!(sbook.preview)) {
	    hold_timer=setTimeout
	    (function(){holding=true; sbook.Preview(ref,src); hold_timer=false;},
	     sbook.holdmsecs||500);}}
    function hud_mouseup(evt){
	var target=fdjtUI.T(evt);
	var ref=sbook.getRef(target);
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] hud_mouseup() %o ref=%o holding=%o, ht=%o, cl=%o sbp=%o sbh=%o mode=%o",
		    fdjtET(),evt,ref,holding,hold_timer,
		    (fdjtDOM.isClickable(target)),
		    sbook.preview,sbook.hudup,sbookMode());
	if (!(ref)) return;
	if (fdjtDOM.isClickable(target)) return;
	fdjtUI.cancel(evt);
	if (holding) {sbook.Preview(false); return;}
	else if (sbook.preview) sbook.Preview(false);
	else {
	    if (!(ref)) return;
	    var src=sbook.getRefElt(target);
	    sbook.Preview(ref,src);}}

    /* Touch handlers */

    var start_x=-1; var start_y=-1;
    var touch_x=-1; var touch_y=-1;
    var start_time=-1; var moved=false; var scrolled=false;

    function body_touchstart(evt){
	var target=fdjtUI.T(evt);
	if (fdjtDOM.isClickable(target)) return;
	else if ((evt.touches)&&(evt.touches.length>1)) return;
	// Ok, we'll handle it
	touch_x=start_x=((evt.touches)&&(evt.touches[0].clientX))||evt.clientX;
	touch_y=start_y=((evt.touches)&&(evt.touches[0].clientY))||evt.clientY;
	var width=fdjtDOM.viewWidth();
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] body_touchstart() %o @%o,%o, w=%o",
		    fdjtET(),evt,touch_x,touch_y,width);
	start_time=fdjtTime(); moved=false; scrolled=false;}
    function body_touchmove(evt){
	if ((evt.touches)&&(evt.touches.length>1)) {
	    scrolled=true; return;}
	touch_x=((evt.touches)&&(evt.touches[0].clientX))||evt.clientX;
	touch_y=((evt.touches)&&(evt.touches[0].clientY))||evt.clientY;
	moved=true;
	fdjtUI.cancel(evt);}
    function body_touchend(evt){
	var target=fdjtUI.T(evt);
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] body_touchend() %o moved=%o cl=%o ui=%o cur=%o,%o start=%o,%o",
		    fdjtET(),evt,moved,fdjtDOM.isClickable(target),inUI(target),
		    touch_x,touch_y,start_x,start_y);
	if ((scrolled)||((evt.touches)&&(evt.touches.length>1))) return;
	if (sbook.preview)
	    if (fdjtDOM.hasParent(target,sbook.preview))
		sbook.JumpTo(sbook.preview);
	else {
	    fdjtUI.cancel(evt); sbook.Preview(false); return;}
	var width=fdjtDOM.viewWidth();
	if (!(moved)) {
	    if (fdjtDOM.hasClass(target,"sbookmargin")) return;
	    else if (!(inUI(target))) body_onclick(evt);
	    return;}
	else {
	    var dx=touch_x-start_x; var dy=touch_y-start_y;
	    var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	    if (sbook.Trace.gestures) 
		fdjtLog("moved=%o, dx=%o dy=%o start=%o,%o end=%o,%o",
			moved,dx,dy,start_x,start_y,touch_x,touch_y);
	    // Minimum gesture threshold
	    if ((adx+ady)<10) {
		// Treat it as a click
		if (fdjtDOM.hasClass(target,"sbookmargin")) return;
		else if (!(inUI(target))) body_onclick(evt);
		return;}
	    if ((adx+ady)<100)
		// Just ignore it
		return;
	    else if (adx>(ady*4)) { /* horizontal swipe */
		if (dx>0) {
		    if (sbook.preview) previewBackward();
		    else pageBackward();}
		else {
		    if (sbook.preview) previewForward();
		    else pageForward();}}
	    else if (ady>(adx*4)) { /* vertical swipe */
		if (sbook.preview) {}
		else if (sbook.hudup) {
		    if (dy<0) sbookMode(false);
		    else sbookMode(sbook.last_dash);}
		else if (dy>0) sbookMode(sbook.last_mode);
		else sbookMode(true);}
	    else {}}
	fdjtUI.cancel(evt);}


    /* HUD touch handlers */

    function hud_touchstart(evt){
	var target=fdjtUI.T(evt);
	var ref=sbook.getRef(target);
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] hud_touchstart() %o ref=%o cl=%o sbp=%o sbh=%o mode=%o",
		    fdjtET(),evt,ref,(fdjtDOM.isClickable(target)),
		    sbook.preview,sbook.hudup,sbookMode());
	if (!(ref)) return;
	if (fdjtDOM.isClickable(target)) return;
	fdjtUI.cancel(evt);
	var stop_preview=false;
	if (sbook.preview) {
	    if (sbook.preview!==ref) sbook.Preview(false);
	    else stop_preview=true;}
	var src=sbook.getRefElt(target);
	if (hold_timer) {
	    clearTimeout(hold_timer);
	    hold_timer=false;}
	touch_x=start_x=((evt.touches)&&(evt.touches[0].clientX))||evt.clientX;
	touch_y=start_y=((evt.touches)&&(evt.touches[0].clientY))||evt.clientY;
	holding=false; moved=false; scrolled=false;
	if (!(stop_preview)) {
	    hold_timer=setTimeout
	    (function(){
		if ((sbook.Trace.preview)||(sbook.Trace.gestures))
		    fdjtLog("[%f] Activating previewing for %o from %o",
			    fdjtET(),ref,src);
		holding=true; hold_timer=false;
		sbook.Preview(ref,src);},
	     sbook.holdmsecs||500);}}
    function hud_touchend(evt){
	var target=fdjtUI.T(evt);
	var ref=sbook.getRef(target);
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] hud_touchend() %o ref=%o holding=%o, ht=%o, cl=%o sbp=%o sbh=%o mode=%o",
		    fdjtET(),evt,ref,holding,hold_timer,
		    (fdjtDOM.isClickable(target)),
		    sbook.preview,sbook.hudup,sbookMode());
	if (!(holding)) {
	    clearTimeout(hold_timer); hold_timer=false;}
	if (scrolled) return;
	if (!(ref)) return;
	if (fdjtDOM.isClickable(target)) return;
	if (moved) {
	    var dx=touch_x-start_x; var dy=touch_y-start_y;
	    var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	    if ((adx+ady)>20) return;}
	fdjtUI.cancel(evt);
	if (holding) {sbook.Preview(false); return;}
	else if (sbook.preview) sbook.Preview(false);
	else {
	    if (!(ref)) return;
	    var src=sbook.getRefElt(target);
	    sbook.Preview(ref,src);}}
    
    /* Glossmarks */
    
    function glossmark_onclick(evt){
	evt=evt||event||null;
	var target=sbook.getRef(fdjtUI.T(evt));
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] glossmark_onclick() %o for %o",fdjtET(),evt,target);
	fdjtUI.cancel(evt);
	if ((sbook.mode==='glosses')&&(sbook.target===target)) {
	    sbookMode(false);
	    return;}
	else sbook.openGlossmark(target);}
    function glossmark_onmouseover(evt){
	evt=evt||event||null;
	var target=sbook.getRef(fdjtUI.T(evt))
	fdjtDOM.addClass(target,"sbooklivespot");}
    function glossmark_onmouseout(evt){
	evt=evt||event||null;
	var target=sbook.getRef(fdjtUI.T(evt))||sbook.getFocus(fdjtUI.T(evt));
	fdjtDOM.dropClass(target,"sbooklivespot");}

    /* Rules */
    
    sbook.UI.handlers.mouse=
	{window: {mouseup: body_onclick,
		  keyup:onkeyup,keydown:onkeydown,keypress:onkeypress},
	 hud: {mouseup:hud_mouseup,mousedown: hud_mousedown,
	       click: fdjtUI.cancel},
	 glossmark: {click: glossmark_onclick,
		     mousedown: fdjtDOM.cancel,
		     mouseover: glossmark_onmouseover,
		     nmouseout: glossmark_onmouseout},
	 ".hudbutton": {mouseover:hudbutton,mouseout:hudbutton},
	 ".sbookmargin": {mouseup: margin_onclick}};
    
    // A mouse pretending to be a touch screen
    sbook.UI.handlers.touchmouse=
	{window: {mousedown: body_touchstart,
		  mousemove: body_touchmove,
		  mouseup: body_touchend,
		  keyup:onkeyup,keydown:onkeydown,keypress:onkeypress,
		  scroll:function(evt){sbook.syncHUD();}},
	 ".sbookmargin": {click: margin_onclick},
	 hud: {onclick: fdjtUI.cancel,
	       mousedown: hud_touchstart,
	       mousemove: body_touchmove,
	       mouseup: hud_touchend},
	 ".hudbutton": {mousedown: dont,touchmove: dont, touchend: dont},
	 "#SBOOKTABS": {mousedown: dont,touchmove: dont, touchend: dont},
	 glossmark: {click: glossmark_onclick}};

    sbook.UI.handlers.ios=
	{window: {touchstart: body_touchstart,
		  touchmove: body_touchmove,
		  touchend: body_touchend,
		  keyup:onkeyup,keydown:onkeydown,keypress:onkeypress,
		  onscroll:function(evt){sbook.syncHUD();}},
	 ".sbookmargin": {click: margin_onclick},
	 hud: {onclick: fdjtUI.cancel,
	       touchstart: hud_touchstart,
	       touchmove: body_touchmove,
	       touchend: hud_touchend},
	 ".hudbutton": {touchstart: dont,touchmove: dont, touchend: dont},
	 "#SBOOKTABS": {touchstart: dont,touchmove: dont, touchend: dont},
	 glossmark: {click: glossmark_onclick}};

    
    sbook.UI.handlers.oneclick=
	{window: {"mouseup": onclick,"dblclick": ondblclick,
		  "keyup":onkeyup,"keydown":onkeydown,"keypress":onkeypress},
	 hud: {//"click":hud_onclick,
	     "mouseover":fdjtUI.CoHi.onmouseover,
	     "mouseout":fdjtUI.CoHi.onmouseout}};

    /* Other stuff */

    function pageForward(){
	if (sbook.paginate) {
	    var goto=-1;
	    if ((sbook.curpage<0)||(sbook.curpage>=sbook.pages.length)) {
		var pagenum=sbook.getPage(fdjtDOM.viewTop());
		if (pagenum<(sbook.pages.length-1)) sbook.curpage=pagenum+1;
		sbook.GoToPage(sbook.curpage);}
	    else {
		// Synchronize if neccessary
		if (sbook.pagescroll!==fdjtDOM.viewTop())
		    sbook.GoToPage(sbook.curpage,sbook.curoff);
		var info=sbook.pageinfo[sbook.curpage];
		var pagebottom=fdjtDOM.viewTop()+(fdjtDOM.viewHeight());
		if (pagebottom<info.bottom)
		    sbook.GoToPage(sbook.curpage,pagebottom-info.top);
		else if (sbook.curpage===sbook.pages.length) {}
		else {
		    sbook.curpage++;
		    sbook.GoToPage(sbook.curpage);
		    if ((sbook.curinfo.focus)&&(sbook.curinfo.focus.id))
			sbook.setHashID(sbook.curinfo.focus);}}}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()+delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    sbook.Forward=pageForward;

    function pageBackward(){
	if (sbook.paginate) {
	    var goto=-1;
	    if ((sbook.curpage<0)||(sbook.curpage>=sbook.pages.length)) {
		var pagenum=sbook.getPage(fdjtDOM.viewTop());
		if (pagenum<(sbook.pages.length-1)) sbook.curpage=pagenum+1;
		sbook.GoToPage(sbook.curpage);}
	    else {
		// Synchronize if neccessary
		if (sbook.pagescroll!==fdjtDOM.viewTop())
		    sbook.GoToPage(sbook.curpage,sbook.curoff);
		var info=sbook.pageinfo[sbook.curpage];
		var pagetop=fdjtDOM.viewTop()+sbook.pageTop();
		if (pagetop>info.top)
		    sbook.GoToPage(sbook.curpage,
				   (info.top-pagetop)-sbook.pageSize());
		else if (sbook.curpage===0) {}
		else {
		    sbook.curpage--;
		    sbook.GoToPage(sbook.curpage);
		    if (sbook.curinfo.focus)
			sbook.setHashID(sbook.curinfo.focus);}}}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()-delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    sbook.Backward=pageBackward;

    /* Moving forward and backward in preview mode */

    function previewForward(){
	var start=sbook.previewelt;
	var slice=fdjtDOM.getParent(start,".sbookslice");
	var scan=fdjtDOM.forwardElt(start); var ref=false;
	while (scan) {
	    if (((scan.about)||
		 ((scan.getAttribute)&&(scan.getAttribute("about"))))&&
		(fdjtDOM.hasClass(scan,"sbooknote")))
		break;
	    else scan=fdjtDOM.forwardElt(scan);}
	if (sbook.Trace.preview) 
	    fdjtLog("[%f] previewForward() from %o to %o under %o",
		    fdjtET(),start,scan,slice);
	if (!(fdjtDOM.hasParent(scan,slice))) scan=false;
	var ref=((scan)&&(sbook.getRef(scan)));
	if ((ref)&&(scan)) sbook.Preview(ref,scan);
	else if (ref) sbook.Preview(ref);
	else sbook.Preview(false);
	if (scan) {} // scroll into view
	return scan;}
    function previewBackward(){
	var start=sbook.previewelt;
	var slice=fdjtDOM.getParent(start,".sbookslice");
	var scan=fdjtDOM.backwardElt(start); var ref=false;
	while (scan) {
	    if (((scan.about)||
		 ((scan.getAttribute)&&(scan.getAttribute("about"))))&&
		(fdjtDOM.hasClass(scan,"sbooknote")))
		break;
	    else scan=fdjtDOM.backwardElt(scan);}
	if (sbook.Trace.preview) 
	    fdjtLog("[%f] previewBackward() from %o to %o under %o",
		    fdjtET(),start,scan,slice);
	if (!(fdjtDOM.hasParent(scan,slice))) scan=false;
	var ref=((scan)&&(sbook.getRef(scan)));
	if ((ref)&&(scan)) sbook.Preview(ref,scan);
	else if (ref) sbook.Preview(ref);
	else sbook.Preview(false);
	if (scan) {} // scroll into view
	return scan;}


})();

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

