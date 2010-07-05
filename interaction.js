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

    function body_onclick(evt,x,y){
	var target=fdjtUI.T(evt);
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] body_onclick() %o ui=%o cl=%o sbp=%o sbh=%o mode=%o",
		    fdjtET(),evt,(inUI(target)),(fdjtDOM.isClickable(target)),
		    sbook.preview,sbook.hudup,sbookMode());
	if (fdjtDOM.isClickable(target)) return;
	if (inUI(target)) return;
	if (!(x)) x=((evt.touches)&&(evt.touches[0].clientX))||evt.clientX;
	if (!(y)) y=((evt.touches)&&(evt.touches[0].clientY))||evt.clientY;
	if (x) {
	    var width=fdjtDOM.viewWidth()
	    // fdjtLog("[%f] xpos=%o width=%o",fdjtET(),x,y,width);
	    if (x<50) {
		if (sbook.preview) previewBackward();
		else if (typeof sbook.mode === 'string') sbookMode(false);
		else pageBackward();
		fdjtUI.cancel(evt);
		return;}
	    else if (x>(width-50)) {
		if (sbook.preview) previewForward();
		else if (typeof sbook.mode === 'string') sbookMode(false);
		else pageForward();
	    	fdjtUI.cancel(evt);
		return;}}
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
	else if (sbook.hudup) {
	    var glosstarget=sbook.getTarget(target);
	    if (glosstarget) sbookMark(glosstarget);
	    else sbookMode(false);}
	else sbookMode(true);}
    
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
	if ((sbook.edgeclick)&&((x-left)<leftwidth)) {
	    if (sbook.preview) previewBackward();
	    else {
		if (sbook.mode) sbookMode(false);
		pageBackward();}}
	else if ((sbook.edgeclick)&&(((left+width)-x)<rightwidth)) {
	    if (sbook.preview) previewBackward();
	    else {
		if (sbook.mode) sbookMode(false);
		pageForward();}}
	else if (sbook.preview) sbook.Preview(false);
	else if (sbook.mode) sbookMode(false);
	else if (sbook.hudup) sbookMode(false);
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
	else return;
	fdjtUI.cancel(evt);}

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
	if (modearg==="dash") modearg=sbook.last_dash||"about";
	var mode=sbookMode();
	if (modearg) {
	    if (mode===modearg) {
		sbookMode(false); mode=false;}
	    else {
		sbookMode(modearg); mode=modearg;}}
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
	"searching": "SBOOKSEARCH",
	"allglosses": "SBOOKSOURCES",
	"dash": "SBOOKDASHTOP"};
    
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
		if (sbook.preview) sbook.Preview(false);
		else {
		    sbookMode(false); sbookMode(true);}}
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

    /* Gesture state */

    var touch_started=false; var touch_ref=false;
    var start_x=-1; var start_y=-1; var last_x=-1; var last_y=-1;
    var page_x=-1; var page_y=-1; var sample_t=-1;
    var touch_timer=false;
    var touch_held=false;
    var touch_moved=false;
    var touch_scrolled=false;

    var doubletap=false, tripletap=false;

    function cleartouch(){
	touch_started=false; touch_ref=false;
	start_x=start_y=last_x=last_y=-1;
	page_x=page_y=sample_t=-1;
	touch_timer=false; touch_held=false;
	touch_moved=false; touch_scrolled=false;
	doubletap=false; tripletap=false;}

    function tracetouch(handler,evt){
	var touches=evt.touches;
	var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
	var target=fdjtUI.T(evt); var ref=sbook.getRef(target);
	if (touch_started)
	    fdjtLog("[%f] %s() n=%o %sts=%o %s@%o\n\t+%o %s%s%s%s%s%s%s s=%o,%o l=%o,%o p=%o,%o d=%o,%o ref=%o tt=%o",
		    fdjtET(),handler,((touches)&&(touches.length)),
		    ((!(touch))?(""):
		     ("c="+touch.clientX+","+touch.clientY+";s="+touch.screenX+","+touch.screenY+" ")),
		    touch_started,evt.type,target,
		    fdjtTime()-touch_started,
		    ((sbook.mode)?(sbook.mode+" "):""),
		    ((sbook.preview)?"preview ":""),
		    ((touch_held)?("held "):("")),
		    ((touch_moved)?("moved "):("")),
		    ((touch_scrolled)?("scrolled "):("")),
		    ((fdjtDOM.isClickable(target))?("clickable "):("")),
		    ((touch)?"":"notouch "),
		    start_x,start_y,last_x,last_y,page_x,page_y,
		    ((touch)?(touch.screenX-page_x):0),((touch)?(touch.screenY-page_y):0),
		    touch_ref,touch_timer);
	else fdjtLog("[%f] %s() n=%o %s%s c=%o,%o p=%o,%o ts=%o %s@%o ref=%o",
		     fdjtET(),handler,((touches)&&(touches.length)),
		     ((sbook.mode)?(sbook.mode+" "):""),
		     ((sbook.preview)?"preview ":""),
		     touch.clientX,touch.clientY,touch.screenX,touch.screenY,
		     touch_started,evt.type,target,ref);
	if (ref) fdjtLog("[%f] %s() ref=%o from %o",fdjtET(),handler,ref,target);}

    /* Consolidated mouse */

    function mousedown(evt){
	var target=fdjtUI.T(evt); var ref;
	fdjtUI.cancel(evt);
	if (sbook.Trace.gestures) tracetouch("mousedown",evt);
	if (touch_timer) {
	    clearTimeout(touch_timer); touch_timer=false;}
	touch_started=fdjtTime();
	var touch=evt;
	if (touch) {
	    start_x=last_x=touch.clientX;
	    start_y=last_y=touch.clientY;}
	touch_held=false; touch_moved=false; touch_scrolled=false;
	if (fdjtDOM.isClickable(target)) return;
	else if (touch_ref=ref=sbook.getRef(target)) {
	    var refelt=((ref)&&(sbook.getRefElt(target)));
	    // If you're already previewing, just switch
	    if (sbook.preview) sbook.Preview(ref,refelt);
	    else {
		sbook.Preview(ref,refelt);
		touch_timer=setTimeout(
		    // Otherwise, set a timer to figure out if you're
		    // doing a preview hold or a preview tap
		    function(){
			if (sbook.Trace.gestures)
			    fdjtLog("Hold preview of %o from %o",ref,refelt);
			touch_held=true; touch_timer=false;},
		    sbook.holdmsecs);}}
	else if (sbook.hudup) {}
	// Option: start timer to bring the HUD up during hold
	else {}}

    function mouseup(evt){
	fdjtUI.cancel(evt);
	if (sbook.Trace.gestures) tracetouch("mouseup",evt);
	var target=fdjtUI.T(evt); var ref=sbook.getRef(target);
	if (touch_timer) {
	    clearTimeout(touch_timer); touch_timer=false;
	    if (ref) sbook.Preview(ref,sbook.getRefElt(target));
	    return cleartouch();}
	if (touch_held) {
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] Clearing preview hold on %o",fdjtET(),sbook.preview);
	    sbook.Preview(false);
	    return cleartouch();}
	var dx=evt.clientX-start_x; var dy=evt.clientY-start_y;
	var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
 	if ((!(touch_moved))||((adx+ady)<20)) {
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] Tap at %o,%o %s%s%s%s%s%s/ target=%o ref=%o",
			fdjtET(),last_x,last_y,
			(((sbook.preview)&&(fdjtDOM.hasParent(target,sbook.preview)))?"/preview":""),
			((fdjtDOM.isClickable(target))?"/clickable":""),
			((fdjtDOM.hasParent(target,".hudbutton"))?"/hudbutton":""),
			((fdjtDOM.hasParent(target,".glossmark"))?"/glossmark":""),
			((last_x<50)?"/leftedge":""),
			(((fdjtDOM.viewWidth()-last_x)<50)?"/rightedge":""),
			target,ref);
	    if (fdjtDOM.hasParent(target,".hudbutton")) hudbutton(evt);
	    else if (fdjtDOM.hasParent(target,".glossmark")) {}
	    // If it's clickable, let it's click handler take it
	    else if (fdjtDOM.isClickable(target)) {}
	    /*
	      var ev=document.createEvent("MouseEvents");
	      ev.initMouseEvent("click",true,true,window,0,
	      page_x,page_y,last_x,last_y);
	      if (sbook.Trace.gestures)
	      fdjtLog("Dispatching click event %o to %o",ev,target);
	      if (target.dispatchEvent)
	      target.dispatchEvent(ev);
	      else if (target.fireEvent)
	      target.fireEvent(ev);
	      else {}
	    */
	    else if (last_x<50) {
		if (sbook.preview) previewBackward();
		else pageBackward();}
	    else if ((fdjtDOM.viewWidth()-last_x)<50) {
		if (sbook.preview) previewForward();
		else pageForward();}
	    else if (sbook.preview) {
		if (touch_held) sbook.Preview(false);
		else if ((ref)&&(ref===sbook.preview)) sbook.Preview(false);
		else if (ref) sbook.Preview(ref);
		else if (touch_ref) {/* simple click */}
		else if (fdjtDOM.hasParent(target,sbook.preview))
		    sbook.JumpTo(sbook.preview);
		else sbook.Preview(false);}
	    else if (sbook.mode) {
		if (fdjtDOM.hasParent(target,sbook.HUD)) {}
		else sbookMode(false);}
	    else if (sbook.mode==='mark')
		sbookMode(true);
	    else if (sbook.hudup) {
		var marked=sbook.getTarget(target);
		if (marked) sbookMark(marked);
		else sbookMode(false);}
	    else sbookMode(true);}
	else if (ady>(adx*4)) { /* Vertical swipe */
	    if (dy>0) { /* Downward swipe */
		if (sbook.Trace.gestures) fdjtLog("[%f] touchend() swipe down");
		if (sbook.preview) { /* did a body scroll */ }
		else if (sbook.scrolling) { /* did a HUD scroll */}
		else if (sbook.hudup) sbookMode(false);
		else sbookMode(sbook.last_mode);}
	    else { /* Upward swipe */
		if (sbook.Trace.gestures) fdjtLog("[%f] touchend() swipe up");
		if (sbook.preview) { /* did a body scroll */ }
		else if (sbook.scrolling) { /* did a HUD scroll */}
		else if (sbook.hudup) sbookMode(sbook.last_mode);
		else sbookMode(sbook.last_mode);}}
	else if (adx>(ady*4)) { /* Horizontal swipe */
	    if (dx>0) { /* right to  left */
		if (sbook.Trace.gestures) fdjtLog("[%f] touchend() swipe right to left");
		if (sbook.preview)
		    previewBackward();
		else pageBackward();}
	    else  { /* left to right */
		if (sbook.Trace.gestures) fdjtLog("[%f] touchend() swipe left to right");
		if (sbook.preview)
		    previewForward();
		else pageForward();}}
	else if (sbook.Trace.gestures) fdjtLog("[%f] touchend() unclear swipe");
	else {}
	return cleartouch();}

    /* Consolidated touch */

    function touchstart(evt){
	fdjtUI.cancel(evt);
	if (touch_started) {
	    /* Do something clever? */}
	if (sbook.Trace.gestures) tracetouch("touchstart",evt);
	if (touch_timer) {
	    clearTimeout(touch_timer); touch_timer=false;}
	var target=fdjtUI.T(evt);
	var ref=sbook.getRef(target);
	var refelt=sbook.getRefElt(target);
	touch_started=fdjtTime();
	var touches=evt.touches;
	var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
	if (touch) {
	    start_x=last_x=touch.clientX;
	    start_y=last_y=touch.clientY;
	    page_x=touch.screenX; page_y=touch.screenY;}
	else if (evt.clientX) { /* touchmouse */
	    start_x=last_x=evt.clientX;
	    start_y=last_y=evt.clientY;
	    page_x=touch.screenX; page_y=evt.screenY;}
	touch_held=false; touch_moved=false; touch_scrolled=false;
	if ((ref)&&(!(fdjtDOM.isClickable(target)))) {
	    if (sbook.preview) sbook.Preview(ref,refelt);
	    else touch_timer=setTimeout(
		function(){
		    if (sbook.Trace.gestures)
			fdjtLog("Hold preview of %o from %o",ref,refelt);
		    touch_held=true; touch_timer=false;
		    sbook.Preview(ref,refelt);},
		sbook.holdmsecs);}}

    function touchmove(evt){
	fdjtUI.cancel(evt);
	if (touch_held) return;
	var touch=(((evt.touches)&&(evt.touches.length))?(evt.touches[0]):(evt));
	if (page_x<0) page_x=touch.screenX;
	if (page_y<0) page_y=touch.screenY;
	var dx=touch.screenX-page_x; var dy=touch.screenY-page_y;
	var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	if (sbook.Trace.gestures)
	    fdjtLog("[%f] touchmove() new=%o,%o cur=%o,%o d=%o,%o ad=%o,%o",
		    fdjtET(),touch.screenX,touch.screenY,page_x,page_y,dx,dy,adx,ady);
	if (sbook.Trace.gestures) tracetouch("touchmove",evt);
	if ((touch_timer)&&((adx+ady)>4)) {clearTimeout(touch_timer); touch_timer=false;}
	var target=fdjtUI.T(evt);
	touch_moved=true;
	last_x=touch.clientX; last_y=touch.clientY;
	if (ady>(adx*4)) {
	    if (sbook.preview) {
		scrollBody(dx,dy); touch_scrolled=true;
		page_x=touch.screenX; page_y=touch.screenY;}
	    else if (fdjtDOM.hasParent(target,fdjtID("SBOOKCONTENT"))) {
		scrollHUD(dx,dy);
		page_x=touch.screenX; page_y=touch.screenY;
		touch_scrolled=true;}}
	else {}}
    function scrollBody(dx,dy){
	var curx=window.scrollX; var cury=window.scrollY;
	if (sbook.Trace.gestures)  fdjtLog("[%f] scrollBody(%o,%o)",fdjtET(),dx,dy);
	var newx=curx-dx; var newy=cury-dy;
	fdjtDOM.addClass(sbookHUD,"hidebuttons");
	window.scrollTo(newx,newy);}
    function scrollHUD(dx,dy){
	var content=((sbook.scrolling)&&(fdjtID(sbook.scrolling)));
	if (!(content)) return;
	var curtop=parseInt(fdjtDOM.getStyle(content).top.slice(0,-2));
	var geom=fdjtDOM.getGeometry(content);
	var newtop=curtop+dy; 
	var mintop=-(geom.height);
	if (newtop>0) newtop=0; else if (newtop<mintop) newtop=mintop; else {}
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] scrollHUD() %o,%o: cur=%o new=%o min=%o=-(%o): %o",
		    fdjtET(),dx,dy,curtop,newtop,mintop,geom.height,
		    content);
	if (newtop!==curtop) content.style.top=newtop+'px';
    }

    function touchend(evt){
	fdjtUI.cancel(evt);
	if (sbook.Trace.gestures) tracetouch("touchend",evt);
	var target=fdjtUI.T(evt);
	if (touch_timer) {
	    var ref=sbook.getRef(target);
	    clearTimeout(touch_timer); touch_timer=false;
	    if (ref) sbook.Preview(ref,sbook.getRefElt(target));
	    return cleartouch();}
	if (touch_held) {
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] Clearing preview hold on %o",fdjtET(),sbook.preview);
	    sbook.Preview(false);
	    return cleartouch();}
	if (touch_scrolled) {
	    fdjtDOM.dropClass(sbookHUD,"hidebuttons");
	    return cleartouch();}
	var dx=last_x-start_x; var dy=last_y-start_y;
	var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
 	if ((!(touch_moved))||((adx+ady)<20)) {
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] Tap at %o,%o %s%s%s%s%s%s/ target=%o ref=%o",
			fdjtET(),last_x,last_y,
			(((sbook.preview)&&(fdjtDOM.hasParent(target,sbook.preview)))?"/preview":""),
			((fdjtDOM.isClickable(target))?"/clickable":""),
			((fdjtDOM.hasParent(target,".hudbutton"))?"/hudbutton":""),
			((fdjtDOM.hasParent(target,".glossmark"))?"/glossmark":""),
			((last_x<50)?"/leftedge":""),
			(((fdjtDOM.viewWidth()-last_x)<50)?"/rightedge":""),
			target,ref);
	    if (fdjtDOM.hasParent(target,".hudbutton")) hudbutton(evt);
	    else if (fdjtDOM.hasParent(target,".glossmark")) {}
	    else if (fdjtDOM.isClickable(target)) {
		var ev=document.createEvent("MouseEvents");
		ev.initMouseEvent("click",true,true,window,0,
				  page_x,page_y,last_x,last_y);
		if (target.dispatchEvent)
		    target.dispatchEvent(ev);
		else if (target.fireEvent)
		    target.fireEvent(ev);
		else {}}
	    else if (last_x<50) {
		if (sbook.preview) previewBackward();
		else pageBackward();}
	    else if ((fdjtDOM.viewWidth()-last_x)<50) {
		if (sbook.preview) previewForward();
		else pageForward();}
	    else if (sbook.preview) {
		if (ref) sbook.Preview(false);
		else if (fdjtDOM.hasParent(target,sbook.preview))
		    sbook.JumpTo(sbook.preview);
		else sbook.Preview(false);}
	    else if (sbook.mode==='mark')
		sbookMode(true);
	    else if (sbook.mode)
		sbookMode(false);
	    else if (sbook.hudup) {
		var marked=sbook.getTarget(target);
		sbookMark(marked);}
	    else sbookMode(true);}
	else if (ady>(adx*4)) { /* Vertical swipe */
	    if (dy>0) { /* Downward swipe */
		if (sbook.Trace.gestures) fdjtLog("[%f] touchend() swipe down");
		if (sbook.preview) { /* did a body scroll */ }
		else if (sbook.scrolling) { /* did a HUD scroll */}
		else if (sbook.hudup) sbookMode(false);
		else sbookMode(sbook.last_mode);}
	    else { /* Upward swipe */
		if (sbook.Trace.gestures) fdjtLog("[%f] touchend() swipe up");
		if (sbook.preview) { /* did a body scroll */ }
		else if (sbook.scrolling) { /* did a HUD scroll */}
		else if (sbook.hudup) sbookMode(sbook.last_mode);
		else sbookMode(sbook.last_mode);}}
	else if (adx>(ady*4)) { /* Horizontal swipe */
	    if (dx>0) { /* right to  left */
		if (sbook.Trace.gestures) fdjtLog("[%f] touchend() swipe right to left");
		if (sbook.preview)
		    previewBackward();
		else pageBackward();}
	    else  { /* left to right */
		if (sbook.Trace.gestures) fdjtLog("[%f] touchend() swipe left to right");
		if (sbook.preview)
		    previewForward();
		else pageForward();}}
	else if (sbook.Trace.gestures) fdjtLog("[%f] touchend() unclear swipe");
	else {}
	return cleartouch();}

    /* Glossmarks */
    
    function glossmark_onclick(evt){
	evt=evt||event||null;
	var glossmark=fdjtDOM.getParent(fdjtUI.T(evt),".glossmark");
	if (glossmark) return glossmark_clicked(glossmark,evt);
	else return false;}
    function glossmark_clicked(glossmark,evt){
	var target=sbook.getTarget(glossmark.parentNode);
	fdjtUI.cancel(evt);
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] glossmark_clicked() %o to %o for %o",fdjtET(),evt,glossmark,target);
	fdjtUI.cancel(evt);
	if ((sbook.mode==='glosses')&&(sbook.target===target)) {
	    sbookMode(true);
	    return;}
	else sbook.openGlossmark(target);}
    function glossmark_onmouseover(evt){
	evt=evt||event||null;
	var target=sbook.getTarget(fdjtUI.T(evt))
	fdjtDOM.addClass(target,"sbooklivespot");}
    function glossmark_onmouseout(evt){
	evt=evt||event||null;
	var target=sbook.getTarget(fdjtUI.T(evt))||sbook.getFocus(fdjtUI.T(evt));
	fdjtDOM.dropClass(target,"sbooklivespot");}

    /* Rules */
    
    sbook.UI.handlers.mouse=
	{window: {mousedown: mousedown,mouseup: mouseup,
		  keyup:onkeyup,keydown:onkeydown,keypress:onkeypress},
	 hud: {},
	 glossmark: {},
	 ".hudbutton": {mouseover:hudbutton,
			mouseout:hudbutton},
	 ".sbookmargin": {}};
    
    // A mouse pretending to be a touch screen
    sbook.UI.handlers.touchmouse=
	{window: {mousedown: touchstart,
		  mousemove: touchmove,
		  mouseup: touchend,
		  keyup:onkeyup,keydown:onkeydown,keypress:onkeypress,
		  scroll:function(evt){sbook.syncHUD();}},
	 ".sbookmargin": {},
	 "#SBOOKFOOT": {click: margin_onclick},
	 hud: {},
	 ".hudbutton": {},
	 "#SBOOKTABS": {},
	 glossmark: {}};

    sbook.UI.handlers.ios=
	{window: {touchstart: touchstart,
		  touchmove: touchmove,
		  touchend: touchend,
		  keyup:onkeyup,keydown:onkeydown,
		  keypress:onkeypress,
		  onscroll:function(evt){sbook.syncHUD();}},
	 ".sbookmargin": {click: margin_onclick},
	 "#SBOOKFOOT": {click: margin_onclick},
	 hud: {},
	 ".hudbutton": {touchstart: dont,touchmove: dont, touchend: dont},
	 "#SBOOKTABS": {touchstart: dont,touchmove: dont, touchend: dont},
	 glossmark: {click: glossmark_onclick}};

    sbook.UI.handlers.oneclick=
	{window: {mouseup: body_onclick,
		  "keyup":onkeyup,"keydown":onkeydown,"keypress":onkeypress},
	 hud: {click:hud_onclick,
	       mouseover:fdjtUI.CoHi.onmouseover,
	       mouseout:fdjtUI.CoHi.onmouseout}};
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
			sbook.setHashID(sbook.curinfo.focus);}}
	    if (sbook.mode==='allglosses')
		sbook.UI.scrollGlosses(sbook.curinfo.first,fdjtID("SBOOKALLGLOSSES"),true);}
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
			sbook.setHashID(sbook.curinfo.focus);}}
	    if (sbook.mode==='allglosses')
		sbook.UI.scrollGlosses(sbook.curinfo.first,fdjtID("SBOOKALLGLOSSES"),true);}
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
	if (sbook.Trace.mode) 
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
	if (sbook.Trace.mode) 
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

