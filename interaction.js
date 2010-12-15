/* -*- Mode: Javascript; -*- */

var sbooks_gestures_id="$Id$";
var sbooks_gestures_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2010 beingmeta, inc.
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

/* New body interaction model:
   With mouse:
   mouseup: 
   if non-empty selection, save, set target, raise hud
   otherwise toggle hud

   With touch:
   touchstart: after 0.5s: set target, raise hud, set context mode (after ~0.5s)
   touchmove: clear context mode (or timer)
   touchend: clear context mode, if scrolled, 
   if non-empty selection, save, otherwise lower hud
*/

/*

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

    var unhold=false;
    var hold_timer=false;
    var hold_interval=1500;
    var start_x=-1; var start_y=-1; var last_x=-1; var last_y=-1;
    
    function sbicon(base){return sbook.graphics+base;}

    /* Setup for gesture handling */

    function addHandlers(node,type){
	var mode=sbook.ui;
	fdjtDOM.addListeners(node,sbook.UI.handlers[mode][type]);}
    sbook.UI.addHandlers=addHandlers;

    function setupGestures(){
	var mode=sbook.ui;
	if (!(mode)) sbook.ui=mode="mouse";
	addHandlers(false,'window');
	addHandlers(sbook.body,'content');
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

    sbook.UI.updateLogin=function(){
	if (fdjtID("SBOOKREGISTER").checked) {
	    fdjtDOM.addClass(fdjtID("SBOOKNATIVELOGIN"),"registering");
	    fdjtDOM.addClass(fdjtID("SBOOKNATIVELOGIN"),"expanded");}
	else {
	    fdjtDOM.dropClass(fdjtID("SBOOKNATIVELOGIN"),"registering");
	    fdjtDOM.dropClass(fdjtID("SBOOKNATIVELOGIN"),"expanded");}}
    sbook.UI.checkLogin=function(evt){
	if (fdjtID("SBOOKREGISTER").checked) {
	    var tbody=fdjtID("SBOOKNATIVELOGIN");
	    var passin=fdjtDOM.getInput(tbody,"PASSWD");
	    var xpassin=fdjtDOM.getInput(tbody,"XPASSWD");
	    if (passin.value!==xpassin.value) {
		alert("Passwords don't match!");
		return fdjtUI.cancel(evt);}}};




    /* New simpler UI */

    function inUI(node){
	while (node)
	    if (!(node)) return false;
	else if (node.sbookui) return true;
	else node=node.parentNode;
	return false;}

    /* Adding a gloss button */

    function addGlossButton(target){
	var passage=sbook.getTarget(target);
	if (!(passage)) return;
	var img=fdjtDOM.getChild(passage,".sbookglossbutton");
	if (img) return;
	img=fdjtDOM.Image(sbicon("remarkballoon32x32.png"),".sbookglossbutton",
			  "+","click to add a gloss to this passage");
	sbook.UI.addHandlers(img,"glossbutton");
	fdjtDOM.prepend(passage,img);}
    
    function glossbutton_onclick(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var passage=sbook.getTarget(target);
	if ((sbook.mode==="addgloss")&&
	    (sbook.glosstarget===passage))
	    sbookMode(true);
	else if (passage) {
	    fdjtUI.cancel(evt);
	    sbook.glossTarget(passage);
	    sbookMode("addgloss");}}

    var excerpts=[];

    /* New handlers */

    function emptySelection(sel){
	return ((!(sel))||
		(!(sel.focusNode))||
		(!(sel.anchorNode))||
		((sel.anchorNode===sel.focusNode)&&
		 (sel.anchorOffset===sel.focusOffset)));}

    /* Functionality:
       on selection:
       save but keep selection,
       set target (if available)
       if hud is down, raise it
       on tap: (no selection)
       if hud is down, set target and raise it
       if no target, raise hud
       if tapping target, lower HUD
       if tapping other, set target, drop mode, and raise hud
       (simpler) on tap:
       if hudup, drop it
       otherwise, set target and raise HUD
    */

    /* Core functions */

    function tapTarget(target){
	if (sbook.Trace.gestures)
	    fdjtLog("[%fs] Tap on target %o mode=%o",
		    fdjtET(),target,sbook.mode);
	sbook.setTarget(target);
	addGlossButton(target);
	sbookMode(true);}

    function xtapTarget(target){
	if (sbook.Trace.gestures)
	    fdjtLog("[%fs] Tap (gloss) on target %o mode=%o",
		    fdjtET(),target,sbook.mode);
	sbook.setTarget(target);
	addGlossButton(target);
	sbook.glossTarget(target);
	sbookMode("addgloss");}

    /* Mouse handlers */

    function content_tapped(evt,target){
	if (!(target)) target=fdjtUI.T(evt);
	var anchor=fdjtDOM.getParent(target,"A");
	if ((anchor)&&(anchor.href)&&(anchor.href[0]==='#')&&
	    (document.getElementById(anchor.href.slice(1)))) {
	    var goto=document.getElementById(anchor.href.slice(1));
	    // Provide smarts for asides/notes/etc
	    sbook.JumpTo(goto);
	    fdjtUI.cancel(evt);
	    return;}
	var passage=sbook.getTarget(target);
	if (sbook.Trace.gestures)
	    fdjtLog("[%fs] content_tapped (%o) on %o passage=%o mode=%o",
		    fdjtET(),evt,target,passage,sbook.mode);
	if ((fdjtDOM.isClickable(target))||
	    (fdjtDOM.hasParent(target,".sbookglossbutton"))||
	    (fdjtDOM.hasParent(target,".sbookglossmark")))
	    return;
	else fdjtUI.cancel(evt); 
	if (edgeTap(evt)) return;
	var sel=window.getSelection();
	if ((sel)&&(sel.anchorNode)&&(!(emptySelection(sel)))) {
	    sbook.selection=sel;
	    var p=sbook.getTarget(sel.anchorNode)||
		sbook.getTarget(sel.focusNode)||
		passage;
	    if (p) {
		sbook.excerpt=sel;
		return tapTarget(p);}
	    else sbookMode(false);}
	if (!(sbook.hudup)) {
	    if ((passage)&&((evt.shiftKey)||(n_touches>1)))
		xtapTarget(passage);
	    else if (passage) tapTarget(passage);
	    else sbookMode(true);}
	else if (!(sbook.target)) sbookMode(false);
	else if (!(passage)) {
	    if (sbook.hudup) sbookMode(false);
	    else sbookMode(true);}
	else if (passage===sbook.target) sbookMode(false);
	else if ((evt.shiftKey)||(n_touches>1))
	    xtapTarget(passage);
	else tapTarget(passage);}

    function hud_tap(evt,target){
	if (!(target)) target=fdjtUI.T(evt);
	if (fdjtDOM.isClickable(target)) return;
	else if (fdjtDOM.hasParent(target,".helphud")) {
	    var mode=fdjtDOM.findAttrib(target,"data-hudmode")||
		fdjtDOM.findAttrib(target,"hudmode");
	    if (mode) sbookMode(mode)
	    else sbookMode(false);
	    return fdjtUI.cancel(evt);}
	while (target) {
	    if (target.about) {
		sbook.Scan(fdjtID(target.about),target);
		return fdjtUI.cancel(evt);}
	    else if (target.frag) {
		sbook.tocJump(evt,fdjtID(target.about));
		return fdjtUI.cancel(evt);}
	    else target=target.parentNode;}}
    
    /* Mouse handlers */

    function edgeTap(evt,x){
	if (!(evt)) evt=event||false;
	if (typeof x !== 'number') x=((evt)&&(evt.clientX));
	if (typeof x !== 'number') x=last_x;
	if (typeof x === 'number') {
	    if (sbook.Trace.gestures)
		fdjtLog("[%fs] edgeTap %o x=%o w=%o",
			fdjtET(),evt,x,fdjtDOM.viewHeight());
	    if (x<50) {Backward(evt); return true;}
	    else if (x>(fdjtDOM.viewWidth()-50)) {
		Forward(evt); return true;}
	    else return false;}
	else return false;}
    sbook.edgeTap=edgeTap;
    function edgeTap_onclick(evt) {
	var target=fdjtUI.T(evt);
	if ((fdjtDOM.isClickable(target))||
	    (fdjtDOM.hasParent(target,".sbookglossbutton"))||
	    (fdjtDOM.hasParent(target,".sbookglossmark")))
	    return;
	if (edgeTap(evt)) fdjtUI.cancel(evt);}

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
		sbook.setTarget(false);
		fdjtID("SBOOKSEARCHINPUT").blur();}
	    else if (sbook.last_mode) sbookMode(sbook.last_mode);
	    else {}
	    return;}
	else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
	else if (kc===34) sbook.Forward(evt);   /* page down */
	else if (kc===33) sbook.Backward(evt);  /* page up */
	// Don't interrupt text input for space, etc
	else if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	else if (kc===32) sbook.Forward(evt); // Space
	// backspace or delete
	else if ((kc===8)||(kc===45)) sbook.Backward();
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
	63: "searching",102: "searching",
	65: "flyleaf", 97: "flyleaf",
	83: "searching",115: "searching",
	70: "searching",
	100: "device",68: "device",
	110: "toc",78: "toc",
	116: "flytoc",84: "flytoc",
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
	if (modearg==="flyleaf") modearg=sbook.last_flyleaf||"about";
	var mode=sbookMode();
	if (modearg) {
	    if (mode===modearg) {
		sbookMode(false); mode=false;}
	    else {
		sbookMode(modearg); mode=modearg;}}
	else {}
	if (mode==="searching")
	    fdjtID("SBOOKSEARCHINPUT").focus();
	else fdjtID("SBOOKSEARCHINPUT").blur();
	fdjtDOM.cancel(evt);}
    sbook.UI.handlers.onkeypress=onkeypress;

    /* HUD button handling */

    var mode_hud_map={
	"toc": "SBOOKTOC",
	"searching": "SBOOKSEARCH",
	"allglosses": "SBOOKSOURCES",
	"flyleaf": "SBOOKFLYHEAD"};
    
    function hudbutton(evt){
	var target=fdjtUI.T(evt);
	var mode=target.getAttribute("hudmode");
	if ((sbook.Trace.gestures)&&
	    ((evt.type==='click')||(sbook.Trace.gestures>1)))
	    fdjtLog("[%fs] hudbutton() %o mode=%o cl=%o scan=%o sbh=%o mode=%o",
		    fdjtET(),evt,mode,(fdjtDOM.isClickable(target)),
		    sbook.scanning,sbook.hudup,sbookMode());
	fdjtUI.cancel(evt);
	if (!(mode)) return;
	var hudid=((mode)&&(mode_hud_map[mode]));
	var hud=fdjtID(hudid);
	if (mode==='flyleaf') mode=sbook.last_flyleaf||"help";
	if (evt.type==='click') {
	    if (hud) fdjtDOM.dropClass(hud,"hover");
	    if (fdjtDOM.hasClass(sbook.HUD,mode)) sbookMode(false);
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
    var page_x=-1; var page_y=-1; var sample_t=-1;
    var touch_moves=0;
    var touch_timer=false;
    var touch_held=false;
    var touch_moved=false;
    var touch_scrolled=false;
    var n_touches=0;

    var doubletap=false, tripletap=false;

    function cleartouch(){
	touch_started=false; touch_ref=false;
	start_x=start_y=last_x=last_y=-1;
	page_x=page_y=sample_t=-1; touch_moves=0;
	touch_timer=false; touch_held=false;
	touch_moved=false; touch_scrolled=false;
	doubletap=false; tripletap=false;}

    function tracetouch(handler,evt){
	var touches=evt.touches;
	var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
	var target=fdjtUI.T(evt); var ref=sbook.getRef(target);
	if (touch_started)
	    fdjtLog("[%fs] %s() n=%o %sts=%o %s@%o\n\t+%o %s%s%s%s%s%s%s s=%o,%o l=%o,%o p=%o,%o d=%o,%o ref=%o tt=%o tm=%o",
		    fdjtET(),handler,((touches)&&(touches.length)),
		    ((!(touch))?(""):
		     ("c="+touch.clientX+","+touch.clientY+";s="+touch.screenX+","+touch.screenY+" ")),
		    touch_started,evt.type,target,
		    fdjtTime()-touch_started,
		    ((sbook.mode)?(sbook.mode+" "):""),
		    ((sbook.scanning)?"scanning ":""),
		    ((touch_held)?("held "):("")),
		    ((touch_moved)?("moved "):("")),
		    ((touch_scrolled)?("scrolled "):("")),
		    ((fdjtDOM.isClickable(target))?("clickable "):("")),
		    ((touch)?"":"notouch "),
		    start_x,start_y,last_x,last_y,page_x,page_y,
		    (((touch)&&(touch.screenX))?(touch.screenX-page_x):0),
		    (((touch)&&(touch.screenY))?(touch.screenY-page_y):0),
		    touch_ref,touch_timer,touch_moves);
	else fdjtLog("[%fs] %s() n=%o %s%s c=%o,%o p=%o,%o ts=%o %s@%o ref=%o",
		     fdjtET(),handler,((touches)&&(touches.length)),
		     ((sbook.mode)?(sbook.mode+" "):""),
		     ((sbook.scanning)?"scanning ":""),
		     touch.clientX,touch.clientY,touch.screenX,touch.screenY,
		     touch_started,evt.type,target,ref);
	if (ref) fdjtLog("[%fs] %s() ref=%o from %o",fdjtET(),handler,ref,target);}

    /* Touch handling */

    function generic_touchstart(evt){
	var target=fdjtUI.T(evt);
	if (fdjtDOM.isClickable(target)) return;
	fdjtUI.cancel(evt);
	if (sbook.Trace.gestures) tracetouch("touchstart",evt);
	touch_started=fdjtTime();
	var touches=evt.touches;
	var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
	if (touches) n_touches=touches.length;
	else if (evt.shiftKey) n_touches=2;
	else n_touches=1;
	if (touch) {
	    start_x=last_x=touch.clientX;
	    start_y=last_y=touch.clientY;
	    page_x=touch.screenX; page_y=touch.screenY;}
	else if (evt.clientX) { /* faketouch */
	    if (evt.shiftKey) n_touches=2; else n_touches=1;
	    start_x=last_x=evt.clientX;
	    start_y=last_y=evt.clientY;
	    page_x=touch.screenX; page_y=evt.screenY;}
	touch_held=false; touch_moved=false; touch_scrolled=false;}

    var mouseisdown=false;

    function content_touchmove(evt){
	// When faking touch, moves only get counted if the mouse is down.
	if ((evt.type==="mousemove")&&(!(mouseisdown))) return;
	// When selecting, don't do anything
	if (!(emptySelection(window.getSelection()))) return;
	evt.preventDefault();
	// fdjtUI.cancel(evt);
	touch_moves++;
	var touches=evt.touches;
	var touch=
	    (((evt.touches)&&(evt.touches.length))?(evt.touches[0]):(evt));
	if (page_x<0) page_x=touch.screenX;
	if (page_y<0) page_y=touch.screenY;
	if ((touches)&&(touches.length>n_touches)) n_touches=touches.length;
	var dx=touch.screenX-page_x; var dy=touch.screenY-page_y;
	var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	// if (sbook.Trace.gestures) tracetouch("touchmove",evt);
	if ((hold_timer)&&((adx+ady)>4)) {
	    clearTimeout(hold_timer); hold_timer=false;}
	if (sbook.Trace.gestures>1)
	    fdjtLog("[%fs] body_touchmove d=%o,%o a=%o,%o p=%o,%o l=%o,%o n=%o scan=%o ",
		    fdjtET(),dx,dy,adx,ady,
		    touch.clientX,touch.clientY,last_x,last_y,
		    touch_moves,sbook.scanning);
	last_x=touch.clientX; last_y=touch.clientY;
	touch_moved=true;
	return;
	if (!(sbook.preview)) return;
	if (ady>(adx*4)) {
	    scrollBody(dx,dy); touch_scrolled=true;
	    page_x=touch.screenX; page_y=touch.screenY;
	    touch_scrolled=true;}}

    function content_touchend(evt,tap){
	if (sbook.Trace.gestures) tracetouch("touchend",evt);
	var target=fdjtUI.T(evt);
	mouseisdown=false; // For faketouch
	if (fdjtDOM.isClickable(target)) return;
	if (touch_moved) {
	    var dx=last_x-start_x; var dy=last_y-start_y;
	    var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	    var ad=((adx<ady)?(ady-adx):(adx-ady));
	    if (sbook.Trace.gestures)
		fdjtLog("[%fs] touchend/gesture l=%o,%o s=%o,%o d=%o,%o |d|=%o,%o",
			fdjtET(),last_x,last_y,start_x,start_y,dx,dy,adx,ady);
	    if (adx>(ady*3)) { /* horizontal */
		if (n_touches===1) {
		    if (dx<0) sbook.Forward(evt);
		    else sbook.Backward(evt);}
		else {
		    if (dx<0) sbook.scanForward(evt);
		    else sbook.scanBackward(evt);}}
	    else {}
	    return;}
	else if (touch_scrolled) return;  // Gesture already intepreted
	else if (touch_moved) return;  // Gesture already intepreted
	else return content_tapped(evt,target);}

    function hud_touchmove(evt){
	// When faking touch, moves only get counted if the mouse is down.
	if ((evt.type==="mousemove")&&(!(mouseisdown))) return;
	var target=fdjtUI.T(evt);
	if (fdjtDOM.isClickable(target)) return;
	fdjtUI.cancel(evt);
	touch_moves++;
	var touch=
	    (((evt.touches)&&(evt.touches.length))?(evt.touches[0]):(evt));
	var dx=touch.screenX-page_x; var dy=touch.screenY-page_y;
	var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	if (page_x<0) page_x=touch.screenX;
	if (page_y<0) page_y=touch.screenY;
	if (sbook.Trace.gestures>1) tracetouch("hud_touchmove",evt);
	if ((hold_timer)&&((adx+ady)>4)) {
	    clearTimeout(hold_timer); hold_timer=false;}
	last_x=touch.clientX; last_y=touch.clientY;
	touch_moved=true;
	page_x=touch.screenX; page_y=touch.screenY;
	touch_scrolled=true;}

    function scrollBody(dx,dy){
	var curpos=sbook.scrollPos();
	var curx=curpos.x; var cury=curpos.y;
	if (sbook.Trace.gestures)
	    fdjtLog("[%fs] scrollBody(%o,%o)",fdjtET(),dx,dy);
	var newx=curx-dx; var newy=cury-dy;
	fdjtDOM.addClass(sbookHUD,"hidebuttons");
	sbook.scrollTo(newx,newy);}

    function hud_touchend(evt){
	if (sbook.Trace.gestures) tracetouch("hud_touchend",evt);
	var target=fdjtUI.T(evt);
	mouseisdown=false; // For faketouch
	var scroller=((sbook.scrolling)&&(sbook.scrollers)&&
		      (sbook.scrollers[sbook.scrolling]));
	// fdjtLog("[%f] hud_touchend scroller=%o(%o) moved=%o",fdjtET(),scroller,scroller.element,scroller.moved);
	if ((scroller)&&(scroller.motion)&&(scroller.motion>10)) return;
	else if (fdjtDOM.isClickable(target)) {
	    if (sbook.ui==="faketouch") {
		// This happens automatically when faking touch
		fdjtUI.cancel(evt);
		return;}
	    else {
		if (sbook.Trace.gestures)
		    fdjtLog("[%fs] Synthesizing click on %o",fdjtET(),target);
		var click_evt = document.createEvent("MouseEvents");
		click_evt.initMouseEvent("click", true, true, window,
					 1,page_x,page_y,last_x, last_y,
					 false, false, false, false, 0, null);
		fdjtUI.cancel(evt);
		target.dispatchEvent(click_evt);
		return;}}
	/*
	else if (touch_scrolled) return;  // Gesture already intepreted
	else if (touch_moved) return;  // Gesture already intepreted
	*/
	else return hud_tap(evt);}

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
	    fdjtLog("[%fs] glossmark_clicked() %o to %o for %o",fdjtET(),evt,glossmark,target);
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

    /* Moving forward and backward */

    var last_motion=false;

    function Forward(evt){
	var now=fdjtTime();
	if (!(evt)) evt=event||false;
	if (evt) fdjtUI.cancel(evt);
	if ((last_motion)&&((now-last_motion)<100)) return;
	else last_motion=now;
	if (sbook.Trace.nav)
	    fdjtLog("[%fs] Forward e=%o h=%o t=%o",fdjtET(),evt,sbook.head,sbook.target);
	if (((evt)&&(evt.shiftKey))||(n_touches>1))
	    scanForward();
	else pageForward();}
    sbook.Forward=Forward;
    function Backward(evt){
	var now=fdjtTime();
	if (!(evt)) evt=event||false;
	if (evt) fdjtUI.cancel(evt);
	if ((last_motion)&&((now-last_motion)<100)) return;
	else last_motion=now;
	if (sbook.Trace.nav)
	    fdjtLog("[%fs] Backward e=%o h=%o t=%o",fdjtET(),evt,sbook.head,sbook.target);
	if (((evt)&&(evt.shiftKey))||(n_touches>1))
	    scanBackward();
	else pageBackward();}
    sbook.Backward=Backward;

    function pageForward(){
	if (sbook.Trace.gestures)
	    fdjtLog("[%fs] pageForward c=%o n=%o",
		    fdjtET(),sbook.curpage,sbook.pages.length);
	if ((sbook.paginate)&&(sbook.pageinfo)) {
	    var newpage=false;
	    if (sbook.mode==="glosses") sbookMode(true);
	    if ((sbook.curpage<0)||(sbook.curpage>=sbook.pages.length)) {
		// If there isn't a valid page number, figure one out
		//  (if possible) and advance from there.
		var pagenum=sbook.getPage(sbook.viewTop());
		if ((pagenum>=0)&&(pagenum<(sbook.pages.length-2)))
		    sbook.FadeToPage(newpage=pagenum+1);}
	    else {
		var pagescroll=sbook.pagescroll;
		var info=sbook.pageinfo[sbook.curpage];
		// This is where the display bottom is
		var pagebottom=pagescroll+(fdjtDOM.viewHeight())-sbook.pageBottom();
		if (pagebottom<info.bottom)
		    // This handles oversize pages
		    sbook.FadeToPage(newpage=sbook.curpage,pagebottom);
		else if (sbook.curpage===sbook.pages.length) {}
		else sbook.FadeToPage(newpage=sbook.curpage+1);}
	    if ((newpage)&&(sbook.mode==='allglosses'))
		sbook.UI.scrollGlosses(
		    sbook.pageinfo[newpage].first,fdjtID("SBOOKALLGLOSSES"),true);}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()+delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    sbook.pageForward=pageForward;

    function pageBackward(){
	if (sbook.Trace.gestures)
	    fdjtLog("[%fs] pageBackward c=%o n=%o",
		    fdjtET(),sbook.curpage,sbook.pages.length);
	if ((sbook.paginate)&&(sbook.pageinfo)) {
	    var newpage=false;
	    if (sbook.mode==="glosses") sbookMode(true);
	    if ((sbook.curpage<0)||(sbook.curpage>=sbook.pages.length)) {
		// If there isn't a valid page number, figure one out
		//  (if possible) and go back from there.
		var pagenum=sbook.getPage(fdjtDOM.viewTop());
		if ((pagenum<=(sbook.pages.length-1))&&(pagenum>0))
		    sbook.FadeToPage(newpage=pagenum-1);}
	    else {
		var pagescroll=sbook.pagescroll;
		var info=sbook.pageinfo[sbook.curpage];
		var pagetop=pagescroll+sbook.pageTop();
		if (pagetop>info.top)
		    // Move within oversize page
		    sbook.FadeToPage(newpage=sbook.curpage,pagetop-sbook.pageSize());
		else if (sbook.curpage===0) {}
		else {
		    sbook.FadeToPage(newpage=sbook.curpage-1);}}
	    if ((newpage)&&(sbook.mode==='allglosses'))
		sbook.UI.scrollGlosses(
		    sbook.pageinfo[newpage].first,fdjtID("SBOOKALLGLOSSES"),true);}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()-delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    sbook.pageBackward=pageBackward;

    function scanForward(){
	if (sbook.mode==="scanning") {}
	else if (sbook.mode==="tocscan") {}
	else if (sbook.scanning) sbookMode("scanning");
	else sbookMode("tocscan");
	if (sbook.mode==="tocscan") {
	    var head=sbook.head; var headinfo=sbook.docinfo[head.id];
	    if (sbook.Trace.nav) 
		fdjtLog("[%fs] scanForward/toc() head=%o info=%o n=%o h=%o",
			fdjtET(),head,headinfo,headinfo.next,headinfo.head);
	    if (headinfo.next) sbook.GoTo(headinfo.next.elt);
	    else if ((headinfo.head)&&(headinfo.head.next)) {
		sbook.GoTo(headinfo.head.next.elt); sbookMode("toc");}
	    else if ((headinfo.head)&&(headinfo.head.head)&&(headinfo.head.head.next)) {
		sbook.GoTo(headinfo.head.head.next.elt); sbookMode("toc");}
	    else sbookMode(false);
	    return;}
	var start=sbook.scanning;
	var scan=sbook.nextSlice(start);
	var ref=((scan)&&(sbook.getRef(scan)));
	if (sbook.Trace.nav) 
	    fdjtLog("[%fs] scanForward() from %o/%o to %o/%o under %o",
		    fdjtET(),start,sbook.getRef(start),scan,ref,slice);
	if ((ref)&&(scan)) sbook.Scan(ref,scan);
	return scan;}
    sbook.scanForward=scanForward;
    function scanBackward(){
	if (sbook.mode==="scanning") {}
	else if (sbook.mode==="tocscan") {}
	else if (sbook.scanning) sbookMode("scanning");
	else sbookMode("tocscan");
	if (sbook.mode==="tocscan") {
	    var head=sbook.head; var headinfo=sbook.docinfo[head.id];
	    if (sbook.Trace.nav) 
		fdjtLog("[%fs] scanBackward/toc() head=%o info=%o p=%o h=%o",
			fdjtET(),head,headinfo,headinfo.prev,headinfo.head);
	    if (headinfo.prev) sbook.GoTo(headinfo.prev.elt);
	    else if (headinfo.head) {
		sbook.GoTo(headinfo.head.elt); sbookMode("toc");}
	    else sbookMode(false);
	    return;}
	var scan=sbook.prevSlice(sbook.scanning);
	var ref=((scan)&&(sbook.getRef(scan)));
	if (sbook.Trace.nav) 
	    fdjtLog("[%fs] scanBackward() from %o/%o to %o/%o under %o",
		    fdjtET(),start,sbook.getRef(start),scan,ref,slice);
	if ((ref)&&(scan)) sbook.Scan(ref,scan);
	return scan;}
    sbook.scanBackward=scanBackward;

    /* Rules */

    var nobubble=fdjtUI.cancelBubble;
    var cancel=fdjtUI.cancel;

    sbook.UI.handlers.mouse=
	{window: {
	    keyup:onkeyup,
	    keydown:onkeydown,
	    keypress:onkeypress,
	    click:edgeTap_onclick},
	 content: {
	     mouseup:content_tapped},
	 hud: {click: hud_tap},
	 glossmark: {
	     onclick: glossmark_onclick,
	     mouseup: cancel,
	     mousedown: cancel},
	 glossbutton: {
	     mouseup: glossbutton_onclick,
	     mousedown: cancel},
	 ".sbookmargin": {click: content_tapped},
	 "#SBOOKPAGERIGHT": {click: Forward},
	 "#SBOOKPAGELEFT": {click: Backward},
	 ".hudbutton": {mouseover:hudbutton,mouseout:hudbutton},
	 toc: {mouseover: fdjtUI.CoHi.onmouseover,
	       mouseout: fdjtUI.CoHi.onmouseout}};

    sbook.UI.handlers.webtouch=
	{window: {keyup:onkeyup,keydown:onkeydown,keypress:onkeypress},
	 content: {touchstart: generic_touchstart,
		   touchmove: content_touchmove,
		   touchend: content_touchend},
	 hud: {touchstart: generic_touchstart,
	       touchmove: hud_touchmove,
	       touchend: hud_touchend},
	 ".sbookmargin": {touchstart: generic_touchstart,
			  touchend: content_touchend,
			  touchmove: content_touchmove},
	 ".hudbutton": {touchstart: dont,touchmove: dont, touchend: dont},
	 "#SBOOKTABS": {touchstart: dont,touchmove: dont, touchend: dont},
	 glossmark: {touchend: glossmark_onclick,touchstart: cancel,touchmove: cancel},
	 glossbutton: {
	     touchend: glossbutton_onclick,
	     touchstart: cancel,
	     touchmove: cancel}
	};
    
})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/

