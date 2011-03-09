/* -*- Mode: Javascript; -*- */

var codex_interaction_id="$Id$";
var codex_interaction_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2011 beingmeta, inc.
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
	addHandlers(fdjtID("CODEXPAGE"),'content');
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
	    CodexMode(true);
	else if (passage) {
	    fdjtUI.cancel(evt);
	    sbook.glossTarget(passage);
	    CodexMode("addgloss");}}

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

    /* Holding */

    var held=false; var handled=false;

    function clear_hold(caller){
	if (held) {
	    clearTimeout(held); held=false;
	    //alert("clear_hold "+(caller||"someone"));
	}}

    /* Generic content handler */

    function content_tapped(evt,target){
	if (!(target)) target=fdjtUI.T(evt);
	var anchor=fdjtDOM.getParent(target,"A");
	// If you tap on a relative anchor, move there using Codex
	// rather than the browser default
	if ((anchor)&&(anchor.href)&&(anchor.href[0]==='#')&&
	    (document.getElementById(anchor.href.slice(1)))) {
	    var goto=document.getElementById(anchor.href.slice(1));
	    // This would be the place to provide smarts for
	    // asides/notes/etc, so they (for example) pop up
	    sbook.JumpTo(goto);
	    fdjtUI.cancel(evt);
	    return;}
	var passage=sbook.getTarget(target);
	// We get the passage here so we can include it in the trace message
	if (sbook.Trace.gestures)
	    fdjtLog("content_tapped (%o) on %o passage=%o mode=%o",
		    evt,target,passage,sbook.mode);
	// These should have their own handlers
	if ((fdjtUI.isClickable(target))||
	    (fdjtDOM.hasParent(target,".sbookglossbutton"))||
	    (fdjtDOM.hasParent(target,".sbookglossmark"))) {
	    if (sbook.Trace.gestures)
		fdjtLog("deferring content_tapped (%o) on %o",
			evt,target,passage,sbook.mode);
	    return;}
	else fdjtUI.cancel(evt); 
	// If you tap an edge, page forward or backward
	if (edgeTap(evt)) return;
	var sel=window.getSelection();
	// If there's a selection, store it as an excerpt.
	if ((sel)&&(sel.anchorNode)&&(!(emptySelection(sel)))) {
	    sbook.selection=sel;
	    var p=sbook.getTarget(sel.anchorNode)||
		sbook.getTarget(sel.focusNode)||
		passage;
	    if (p) {
		sbook.excerpt=sel;
		return xtapTarget(p);}
	    else CodexMode(false);}
	if (passage) {
	    if (sbook.target===passage) {
		if (sbook.hudup) CodexMode(false);
		else CodexMode(true);}
	    else if ((evt.ctrlKey)||(evt.shiftKey)||(n_touches>1))
		xtapTarget(passage);
	    else if (fdjtDOM.hasClass(document.body,"sbookscanning"))
		CodexMode(false);
	    else tapTarget(passage);}
	else if (sbook.hudup||sbook.mode) {
	    if (sbook.Trace.gestures) fdjtLog("Dropping HUD");
	    CodexMode(false);
	    return;}
	else CodexMode(true);}

    function glossExcerpt(passage){
	sbook.setTarget(passage);
	addGlossButton(passage);
	var text=fdjtDOM.textify(passage);
	sbook.selection=fdjtString.oneline(text);
	sbook.glossTarget(passage);
	CodexMode("addgloss");
	return;}

    /* Tap actions */

    function tapTarget(target){
	if (sbook.Trace.gestures)
	    fdjtLog("Tap on target %o mode=%o",target,sbook.mode);
	addGlossButton(target);
	if ((sbook.mode==='glosses')&&(sbook.target===target)) {
	    // If you're already showing glosses, hide them
	    CodexMode(false);
	    return;}
	else {
	    sbook.setTarget(target);
	    CodexMode(true);}}

    function xtapTarget(target){
	if (sbook.Trace.gestures)
	    fdjtLog("Tap (extended) on target %o mode=%o",target,sbook.mode);
	sbook.setTarget(target);
	addGlossButton(target);
	sbook.glossTarget(target);
	CodexMode("addgloss");}

    function edgeTap(evt,x){
	if (!(evt)) evt=event||false;
	if (typeof x !== 'number') x=((evt)&&(evt.clientX));
	if (typeof x !== 'number') x=last_x;
	if (typeof x === 'number') {
	    if (sbook.Trace.gestures)
		fdjtLog("edgeTap %o x=%o w=%o",evt,x,fdjtDOM.viewHeight());
	    if (x<50) {Backward(evt); return true;}
	    else if (x>(fdjtDOM.viewWidth()-50)) {
		Forward(evt); return true;}
	    else return false}
	else return false;}
    sbook.edgeTap=edgeTap;
    
    function edge_click(evt) {
	var target=fdjtUI.T(evt);
	if ((fdjtUI.isClickable(target))||
	    (fdjtDOM.hasParent(target,".sbookglossbutton"))||
	    (fdjtDOM.hasParent(target,".sbookglossmark")))
	    return;
	if (edgeTap(evt)) fdjtUI.cancel(evt);}

    /* HUD handlers */

    function hud_tapped(evt,target){
	if (!(target)) target=fdjtUI.T(evt);
	if (fdjtUI.isClickable(target)) return;
	else if (fdjtDOM.hasParent(target,".helphud")) {
	    var mode=fdjtDOM.findAttrib(target,"data-hudmode")||
		fdjtDOM.findAttrib(target,"hudmode");
	    if (mode) CodexMode(mode)
	    else CodexMode(false);
	    return fdjtUI.cancel(evt);}
	while (target) {
	    if (target.about) {
		sbook.Scan(fdjtID(target.about),target);
		return fdjtUI.cancel(evt);}
	    else if (target.frag) {
		sbook.tocJump(evt,target);
		return fdjtUI.cancel(evt);}
	    else target=target.parentNode;}}
    
    /* Mouse handlers */

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
		CodexMode(false);
		sbook.setTarget(false);
		fdjtID("CODEXSEARCHINPUT").blur();}
	    else if (sbook.last_mode) CodexMode(sbook.last_mode);
	    else {}
	    return;}
	else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
	else if (kc===34) sbook.Forward(evt);   /* page down */
	else if (kc===33) sbook.Backward(evt);  /* page up */
	else if (kc===37) sbook.scanBackward(evt); /* arrow left */
	else if (kc===39) sbook.scanForward(evt); /* arrow right */
	// Don't interrupt text input for space, etc
	else if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	else if (kc===32) sbook.Forward(evt); // Space
	// backspace or delete
	else if ((kc===8)||(kc===45)) sbook.Backward(evt);
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
	80: "gotopage",112: "gotopage",
	76: "gotoloc",108: "gotoloc",
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
	var mode=CodexMode();
	if (modearg) {
	    if (mode===modearg) {
		CodexMode(false); mode=false;}
	    else {
		CodexMode(modearg); mode=modearg;}}
	else {}
	if (mode==="searching")
	    fdjtID("CODEXSEARCHINPUT").focus();
	else fdjtID("CODEXSEARCHINPUT").blur();
	fdjtDOM.cancel(evt);}
    sbook.UI.handlers.onkeypress=onkeypress;

    function goto_keypress(evt){
	evt=evt||event||null;
	var target=fdjtUI.T(evt);
	var ch=evt.charCode||evt.keyCode;
	var max=false; var min=false;
	if (target.name==='GOTOLOC') {
	    min=0; max=Math.floor(sbook.ends_at/128);}
	else if (target.name==='GOTOPAGE') {
	    min=1; max=sbook.pages.length;}
	else if (ch===13) fdjtUI.cancel(evt);
	if (ch===13) {
	    var num=parseInt(target.value);
	    fdjtUI.cancel(evt);
	    if ((typeof num !== 'number')||(num<min)||(num>max)) {
		alert("Enter a number between "+min+" and "+max+" (inclusive)");
		return;}
	    if (target.name==='GOTOLOC') sbook.JumpTo(128*num);
	    else if (target.name==='GOTOPAGE') sbook.FadeToPage(num-1);
	    else {}
	    target.value="";
	    CodexMode(false);}}
    sbook.UI.goto_keypress=goto_keypress;

    /* HUD button handling */

    var mode_hud_map={
	"toc": "CODEXTOC",
	"searching": "CODEXSEARCH",
	"allglosses": "SBOOKSOURCES",
	"flyleaf": "CODEXFLYHEAD"};
    
    function hudbutton(evt){
	var target=fdjtUI.T(evt);
	var mode=target.getAttribute("hudmode");
	if ((sbook.Trace.gestures)&&
	    ((evt.type==='click')||(sbook.Trace.gestures>1)))
	    fdjtLog("hudbutton() %o mode=%o cl=%o scan=%o sbh=%o mode=%o",
		    evt,mode,(fdjtUI.isClickable(target)),
		    sbook.scanning,sbook.hudup,CodexMode());
	fdjtUI.cancel(evt);
	if (!(mode)) return;
	var hudid=((mode)&&(mode_hud_map[mode]));
	var hud=fdjtID(hudid);
	if (mode==='flyleaf') mode=sbook.last_flyleaf||"help";
	if (evt.type==='click') {
	    if (hud) fdjtDOM.dropClass(hud,"hover");
	    if (fdjtDOM.hasClass(sbook.HUD,mode)) CodexMode(false);
	    else CodexMode(mode);}
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

    sbook.UI.dropHUD=function(evt){
	if (sbook.Trace.gestures) fdjtLog("dropHUD %o",evt);
	fdjtUI.cancel(evt); CodexMode(false);};

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
	    fdjtLog("%s() n=%o %sts=%o %s@%o\n\t+%o %s%s%s%s%s%s%s s=%o,%o l=%o,%o p=%o,%o d=%o,%o ref=%o tt=%o tm=%o",
		    handler,((touches)&&(touches.length)),
		    ((!(touch))?(""):
		     ("c="+touch.clientX+","+touch.clientY+";s="+touch.screenX+","+touch.screenY+" ")),
		    touch_started,evt.type,target,
		    fdjtTime()-touch_started,
		    ((sbook.mode)?(sbook.mode+" "):""),
		    ((sbook.scanning)?"scanning ":""),
		    ((touch_held)?("held "):("")),
		    ((touch_moved)?("moved "):("")),
		    ((touch_scrolled)?("scrolled "):("")),
		    ((fdjtUI.isClickable(target))?("clickable "):("")),
		    ((touch)?"":"notouch "),
		    start_x,start_y,last_x,last_y,page_x,page_y,
		    (((touch)&&(touch.screenX))?(touch.screenX-page_x):0),
		    (((touch)&&(touch.screenY))?(touch.screenY-page_y):0),
		    touch_ref,touch_timer,touch_moves);
	else fdjtLog("%s() n=%o %s%s c=%o,%o p=%o,%o ts=%o %s@%o ref=%o",
		     handler,((touches)&&(touches.length)),
		     ((sbook.mode)?(sbook.mode+" "):""),
		     ((sbook.scanning)?"scanning ":""),
		     touch.clientX,touch.clientY,touch.screenX,touch.screenY,
		     touch_started,evt.type,target,ref);
	if (ref) fdjtLog("%s() ref=%o from %o",handler,ref,target);}

    /* Touch handling */

    function shared_touchstart(evt){
	evt=evt||event||false;
	var target=fdjtUI.T(evt);
	if (fdjtUI.isClickable(target)) return;
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
    function content_touchstart(evt){
	evt=evt||event||false;
	handled=false;
	var target=fdjtUI.T(evt);
	shared_touchstart(evt);
	var passage;
	if ((!((fdjtUI.isClickable(target))||(n_touches>1)))&&
	    (passage=sbook.getTarget(target)))
	    held=setTimeout(function(evt){
		glossExcerpt(passage);
		held=false; handled=true;},
			    500);}

    var mouseisdown=false;

    function content_touchmove(evt){
	// When faking touch, moves only get counted if the mouse is down.
	if ((evt.type==="mousemove")&&(!(mouseisdown))) return;
	fdjtUI.cancel(evt);
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
	if ((held)&&((adx+ady)>10)) {
	    clear_hold("touchmove"+(adx+ady)); handled=false;}
	if (sbook.Trace.gestures>1)
	    fdjtLog("body_touchmove d=%o,%o a=%o,%o p=%o,%o l=%o,%o n=%o scan=%o ",
		    dx,dy,adx,ady,
		    touch.clientX,touch.clientY,last_x,last_y,
		    touch_moves,sbook.scanning);
	last_x=touch.clientX; last_y=touch.clientY;
	touch_moved=true;
	return;}

    function content_touchend(evt,tap){
	var target=fdjtUI.T(evt);
	if (held) clear_hold("touchend");
	if (sbook.Trace.gestures) tracetouch("touchend",evt);
	mouseisdown=false; // For faketouch
	if (fdjtUI.isClickable(target)) return;
	if (handled) return;
	else if (touch_moved) {
	    var dx=last_x-start_x; var dy=last_y-start_y;
	    var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	    var ad=((adx<ady)?(ady-adx):(adx-ady));
	    if (sbook.Trace.gestures)
		fdjtLog("touchend/gesture l=%o,%o s=%o,%o d=%o,%o |d|=%o,%o",
			last_x,last_y,start_x,start_y,dx,dy,adx,ady);
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
	else return content_tapped(evt,target);}

    /* HUD touch */

    function hud_touchmove(evt){
	// When faking touch, moves only get counted if the mouse is down.
	if ((evt.type==="mousemove")&&(!(mouseisdown))) return;
	var target=fdjtUI.T(evt);
	if (fdjtUI.isClickable(target)) return;
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
	    fdjtLog("scrollBody(%o,%o)",dx,dy);
	var newx=curx-dx; var newy=cury-dy;
	fdjtDOM.addClass(CodexHUD,"hidebuttons");
	sbook.scrollTo(newx,newy);}

    function hud_touchend(evt){
	if (sbook.Trace.gestures) tracetouch("hud_touchend",evt);
	var target=fdjtUI.T(evt);
	mouseisdown=false; // For faketouch
	var scroller=((sbook.scrolling)&&(sbook.scrollers)&&
		      (sbook.scrollers[sbook.scrolling]));
	// fdjtLog("hud_touchend scroller=%o(%o) moved=%o",scroller,scroller.element,scroller.moved);
	if ((scroller)&&(scroller.motion)&&(scroller.motion>10)) return;
	else if (fdjtUI.isClickable(target)) {
	    if (sbook.ui==="faketouch") {
		// This happens automatically when faking touch
		fdjtUI.cancel(evt);
		return;}
	    else {
		var click_evt = document.createEvent("MouseEvents");
		while (target)
		    if (target.nodeType===1) break;
		else target=target.parentNode;
		if (!(target)) return;
		if (sbook.Trace.gestures)
		    fdjtLog("Synthesizing click on %o",target);
		click_evt.initMouseEvent("click", true, true, window,
					 1,page_x,page_y,last_x, last_y,
					 false, false, false, false, 0, null);
		fdjtUI.cancel(evt);
		target.dispatchEvent(click_evt);
		return;}}
	else return hud_tapped(evt);}

    /* Glossmarks */
    
    function glossmark_tapped(evt){
	evt=evt||event||null;
	if (held) clear_hold("glossmark_tapped");
	var target=fdjtUI.T(evt);
	var glossmark=fdjtDOM.getParent(target,".sbookglossmark");
	var passage=sbook.getTarget(glossmark.parentNode,true);
	if (sbook.Trace.gestures)
	    fdjtLog("glossmark_tapped (%o) on %o gmark=%o passage=%o mode=%o target=%o",
		    evt,target,glossmark,passage,sbook.mode,sbook.target);
	if (!(glossmark)) return false;
	fdjtUI.cancel(evt);
	if ((sbook.mode==='glosses')&&(sbook.target===passage)) {
	    CodexMode(true);
	    return;}
	else sbook.openGlossmark(passage);}
    function glossmark_onmouseover(evt){
	evt=evt||event||null;
	var target=sbook.getTarget(fdjtUI.T(evt))
	fdjtDOM.addClass(target,"sbooklivespot");}
    function glossmark_onmouseout(evt){
	evt=evt||event||null;
	var target=sbook.getTarget(fdjtUI.T(evt));
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
	    fdjtLog("Forward e=%o h=%o t=%o",evt,sbook.head,sbook.target);
	if ((sbook.mode==="glosses")||(sbook.mode==="addgloss"))
	    CodexMode(true);
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
	if ((sbook.mode==="glosses")||(sbook.mode==="addgloss"))
	    CodexMode(true);
	if (sbook.Trace.nav)
	    fdjtLog("Backward e=%o h=%o t=%o",evt,sbook.head,sbook.target);
	if (((evt)&&(evt.shiftKey))||(n_touches>1))
	    scanBackward();
	else pageBackward();}
    sbook.Backward=Backward;

    function pageForward(){
	if (sbook.Trace.gestures)
	    fdjtLog("pageForward c=%o n=%o",sbook.curpage,sbook.pages.length);
	if ((sbook.mode==="scanning")||(sbook.mode==="tocscan"))
	    CodexMode(false);
	if ((sbook.paginate)&&(sbook.colpage)) {
	    if (sbook.curpage===sbook.pages.length) {}
	    else sbook.GoToPage(sbook.curpage=(sbook.curpage+1));}
	else if ((sbook.paginate)&&(sbook.pageinfo)) {
	    var newpage=false;
	    if (sbook.mode==="glosses") CodexMode(true);
	    if ((sbook.curpage<0)||(sbook.curpage>=sbook.pages.length)) {
		// If there isn't a valid page number, figure one out
		//  (if possible) and advance from there.
		var pagenum=sbook.getPage(sbook.viewTop());
		if ((pagenum>=0)&&(pagenum<(sbook.pages.length-2)))
		    sbook.FadeToPage(newpage=pagenum+1);}
	    else {
		var pagescroll=sbook.pagescroll;
		var info=sbook.pageinfo[sbook.curpage];
		if (sbook.page_bottom<info.bottom) 
		    // This handles oversize pages
		    sbook.FadeToPage(newpage=sbook.curpage,
				     sbook.page_bottom-info.top);
		else if (sbook.curpage===sbook.pages.length) {}
		else sbook.FadeToPage(newpage=sbook.curpage+1);}
	    if ((newpage)&&(sbook.mode==='allglosses'))
		sbook.UI.scrollGlosses(
		    sbook.pageinfo[newpage].first,
		    fdjtID("CODEXALLGLOSSES"),true);}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()+delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    sbook.pageForward=pageForward;

    function pageBackward(){
	if (sbook.Trace.gestures)
	    fdjtLog("pageBackward c=%o n=%o",sbook.curpage,sbook.pages.length);
	if ((sbook.mode==="scanning")||(sbook.mode==="tocscan"))
	    CodexMode(false);
	if ((sbook.paginate)&&(sbook.colpage)) {
	    if (sbook.curpage===0) {}
	    else sbook.GoToPage(sbook.curpage=(sbook.curpage-1));}
	else if ((sbook.paginate)&&(sbook.pageinfo)) {
	    var newpage=false;
	    if (sbook.mode==="glosses") CodexMode(true);
	    if ((sbook.curpage<0)||(sbook.curpage>=sbook.pages.length)) {
		// If there isn't a valid page number, figure one out
		//  (if possible) and go back from there.
		var pagenum=sbook.getPage(fdjtDOM.viewTop());
		if ((pagenum<=(sbook.pages.length-1))&&(pagenum>0))
		    sbook.FadeToPage(newpage=pagenum-1);}
	    else {
		var pagescroll=sbook.pagescroll;
		var info=sbook.pageinfo[sbook.curpage];
		if (sbook.page_top>info.top)
		    // Move within oversize page
		    sbook.FadeToPage(
			newpage=sbook.curpage,
			(sbook.page_top-info.top)-sbook.pageSize());
		else if (sbook.curpage===0) {}
		else {
		    sbook.FadeToPage(newpage=sbook.curpage-1);}}
	    if ((newpage)&&(sbook.mode==='allglosses'))
		sbook.UI.scrollGlosses(
		    sbook.pageinfo[newpage].first,
		    fdjtID("CODEXALLGLOSSES"),true);}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()-delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    sbook.pageBackward=pageBackward;

    function scanForward(){
	if (sbook.mode==="scanning") {}
	else if (sbook.mode==="tocscan") {}
	else if (sbook.scanning) CodexMode("scanning");
	else CodexMode("tocscan");
	if (sbook.mode==="tocscan") {
	    var head=sbook.head; var headinfo=sbook.docinfo[head.id];
	    if (sbook.Trace.nav) 
		fdjtLog("scanForward/toc() head=%o info=%o n=%o h=%o",
			head,headinfo,headinfo.next,headinfo.head);
	    if (headinfo.next) sbook.GoTo(headinfo.next.elt);
	    else if ((headinfo.head)&&(headinfo.head.next)) {
		sbook.GoTo(headinfo.head.next.elt); CodexMode("toc");}
	    else if ((headinfo.head)&&(headinfo.head.head)&&
		     (headinfo.head.head.next)) {
		sbook.GoTo(headinfo.head.head.next.elt);
		CodexMode("toc");}
	    else CodexMode(false);
	    return;}
	var start=sbook.scanning;
	var scan=sbook.nextSlice(start);
	var ref=((scan)&&(sbook.getRef(scan)));
	if (sbook.Trace.nav) 
	    fdjtLog("scanForward() from %o/%o to %o/%o under %o",
		    start,sbook.getRef(start),scan,ref,slice);
	if ((ref)&&(scan)) sbook.Scan(ref,scan);
	return scan;}
    sbook.scanForward=scanForward;

    function scanBackward(){
	if (sbook.mode==="scanning") {}
	else if (sbook.mode==="tocscan") {}
	else if (sbook.scanning) CodexMode("scanning");
	else CodexMode("tocscan");
	if (sbook.mode==="tocscan") {
	    var head=sbook.head; var headinfo=sbook.docinfo[head.id];
	    if (sbook.Trace.nav) 
		fdjtLog("scanBackward/toc() head=%o info=%o p=%o h=%o",
			head,headinfo,headinfo.prev,headinfo.head);
	    if (headinfo.prev) sbook.GoTo(headinfo.prev.elt);
	    else if (headinfo.head) {
		sbook.GoTo(headinfo.head.elt); CodexMode("toc");}
	    else CodexMode(false);
	    return;}
	var scan=sbook.prevSlice(sbook.scanning);
	var ref=((scan)&&(sbook.getRef(scan)));
	if (sbook.Trace.nav) 
	    fdjtLog("scanBackward() from %o/%o to %o/%o under %o",
		    start,sbook.getRef(start),scan,ref,slice);
	if ((ref)&&(scan)) sbook.Scan(ref,scan);
	return scan;}
    sbook.scanBackward=scanBackward;

    function scanner_click(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	if (fdjtUI.isClickable(target)) return;
	var scanning=sbook.scanning;
	if (!(scanning)) return;
	var hudparent=fdjtDOM.getParent(scanning,".hudpanel");
	if (!(hudparent)) return;
	else if (hudparent===fdjtID("CODEXBROWSEGLOSSES"))
	    CodexMode("allglosses");
	else if (hudparent===fdjtID("CODEXSEARCH"))
	    CodexMode("searchresults");
	else {}};

    /* Entering page numbers and locations */

    function enterPageNum(evt) {
	evt=evt||event;
	fdjtUI.cancel(evt);
	if (sbook.hudup) {CodexMode(false); return;}
	
	CodexMode.toggle("gotopage");}
    function enterLocation(evt) {
	evt=evt||event;
	fdjtUI.cancel(evt);
	if (sbook.hudup) {CodexMode(false); return;}
	CodexMode.toggle("gotoloc");}
    
    /* Other handlers */

    function flyleaf_tap(evt){
	if (fdjtUI.isClickable(evt)) return;
	else CodexMode(false);}

    function getOffX(evt){
	if (typeof evt.offsetX === "number") return evt.offsetX;
	else if ((evt.touches)&&(evt.touches.length)) {
	    var touch=evt.touches[0];
	    var pinfo=fdjtID("CODEXPAGEINFO");
	    var target=touch.target;
	    while ((target)&&(target.nodeType!==1)) target=target.parentNode;
	    var geom=fdjtDOM.getGeometry(target,pinfo);
	    var tx=geom.left;
	    return touch.clientX-(tx+pinfo.offsetLeft);}
	else return false;}

    function head_click(evt){
	if (sbook.Trace.gestures) fdjtLog("head_click %o",evt);
	if (fdjtUI.isClickable(evt)) return;
	else if ((sbook.mode==='help')||(sbook.mode==='splash')) {
	    fdjtUI.cancel(evt);
	    CodexMode(true);}
	else if (sbook.mode) return;
	else {
	    fdjtUI.cancel(evt);
	    CodexMode(true);}}
    function foot_click(evt){
	if (sbook.Trace.gestures) fdjtLog("foot_click %o",evt);
	if (fdjtUI.isClickable(evt)) return;
	else if (sbook.mode) {
	    fdjtUI.cancel(evt);
	    CodexMode(false);
	    return;}}

    function pageinfo_click(evt){
	var pageinfo=fdjtID("CODEXPAGEINFO"); var offx;
	if ((sbook.hudup)||(sbook.mode)) {
	    fdjtUI.cancel(evt);
	    CodexMode(false);
	    return;}
	if (evt.offsetX) {
	    // This is the case where we're passed an actual node
	    //  rather than a real event
	    var tx=fdjtDOM.getGeometry(fdjtUI.T(evt),pageinfo).left;
	    offx=evt.offsetX+tx;}
	else if (evt.pageX) {
	    var geom=fdjtDOM.getGeometry(pageinfo);
	    offx=evt.pageX-geom.left;}
	else if (evt.clientX) {
	    var geom=fdjtDOM.getGeometry(pageinfo);
	    offx=evt.clientX-geom.left;}
	else offx=getOffX(evt);
	var offwidth=pageinfo.offsetWidth;
	var goloc=Math.round((offx/offwidth)*sbook.ends_at);
	if (sbook.Trace.gestures)
	    fdjtLog("pageinfo_click %o off=%o/%o goloc=%o/%o",
		    evt,offx,offwidth,goloc,sbook.ends_at);
	if (!(offx)) return;
	fdjtUI.cancel(evt);
	sbook.GoTo(goloc);
	if ((sbook.mode==="gotoloc")||(sbook.mode==="gotopage"))
	    CodexMode(false);}
    /* This doesn't quite work on the iPad, so we're not currently
       using it. */
    function pageinfo_move(evt){
	var pageinfo=fdjtID("CODEXPAGEINFO"); var offx;
	if (evt.offsetX) {
	    var tx=fdjtDOM.getGeometry(fdjtUI.T(evt),pageinfo).left;
	    offx=evt.offsetX+tx;}
	else offx=getOffX(evt);
	var offwidth=fdjtID("CODEXPAGEINFO").offsetWidth;
	var goloc=Math.floor((offx/offwidth)*sbook.ends_at);
	var page=((sbook.paginate)&&sbook.getPageAt(goloc));
	fdjtUI.cancel(evt);
	fdjtLog("%o type=%o ox=%o ow=%o gl=%o p=%o",
		evt,evt.type,offx,offwidth,goloc,page);
	if ((evt.type==='touchmove')||
	    ((evt.type==='mousemove')&&((evt.button)||(evt.shiftKey)))) {
	    if ((typeof page === 'number')&&(page!==sbook.curpage))
		sbook.GoToPage(page);}}

    /* Rules */

    var nobubble=fdjtUI.nobubble;
    var cancel=fdjtUI.cancel;

    sbook.UI.handlers.mouse=
	{window: {
	    keyup: onkeyup,
	    keydown: onkeydown,
	    keypress: onkeypress,
	    click: edge_click},
	 content: {mouseup: content_tapped},
	 hud: {click: hud_tapped},
	 glossmark: {mouseup: glossmark_tapped},
	 glossbutton: {mouseup: glossbutton_onclick,mousedown: cancel},
	 ".sbookmargin": {click: edge_click},
	 "#CODEXSPLASH": {click: sbook.dropHUD},
	 "#CODEXHELP": {click: sbook.dropHUD},
	 "#CODEXFLYLEAF": {click: flyleaf_tap},
	 "#CODEXPAGEINFO": {click: pageinfo_click},
	 "#CODEXPAGENOTEXT": {click: enterPageNum},
	 "#CODEXLOCOFF": {click: enterLocation},
	 "#CODEXSCANNER": {click: scanner_click},
	 "#SBOOKPAGEHEAD": {click: head_click},
	 "#CODEXHEAD": {click: head_click},	 
	 "#SBOOKPAGEFOOT": {click: foot_click},
	 ".hudbutton": {mouseover:hudbutton,mouseout:hudbutton},
	 toc: {mouseover: fdjtUI.CoHi.onmouseover,
	       mouseout: fdjtUI.CoHi.onmouseout}};

    sbook.UI.handlers.webtouch=
	{window: {keyup:onkeyup,keydown:onkeydown,keypress:onkeypress,
		  touchstart: cancel, touchmove: cancel, touchend: cancel},
	 content: {touchstart: content_touchstart,
		   touchmove: content_touchmove,
		   touchend: content_touchend},
	 hud: {touchstart: shared_touchstart,
	       touchmove: hud_touchmove,
	       touchend: hud_touchend},
	 "#SBOOKPAGEHEAD": {
	     touchstart: cancel,
	     touchmove: cancel,
	     touchend: head_click},
	 "#SBOOKPAGEFOOT": {
	     touchstart: cancel,
	     touchmove: cancel,
	     touchend: foot_click},
	 "#CODEXSPLASH": {touchstart: sbook.dropHUD,
			  touchmove: cancel,
			  touchend: cancel},
	 "#CODEXHELP": {touchstart: sbook.dropHUD,
			  touchmove: cancel,
			  touchend: cancel},
	 "#CODEXMASK": {touchstart: shared_touchstart,
			touchmove: content_touchmove,
			touchend: content_touchend},
	 "#CODEXFLYLEAF": {touchend: flyleaf_tap},
	 "#CODEXPAGEINFO": {touchstart: pageinfo_click,
			    touchmove: cancel,touchend: cancel},
	 "#CODEXPAGENOTEXT": {touchstart: enterPageNum,
			      touchmove: cancel,touchend: cancel},
	 "#CODEXLOCOFF": {touchstart: enterLocation,
			  touchmove: cancel,touchend: cancel},
	 ".hudbutton": {touchstart: dont,touchmove: dont, touchend: dont},
	 "#CODEXTABS": {touchstart: dont,touchmove: dont, touchend: dont},
	 glossmark: {touchend: glossmark_tapped,
		     touchstart: cancel,
		     touchmove: cancel},
	 glossbutton: {touchend: glossbutton_onclick,
		       touchstart: cancel,
		       touchmove: cancel}
	};
    
})();

fdjt_versions.decl("codex",codex_interaction_version);
fdjt_versions.decl("codex/interaction",codex_interaction_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/

