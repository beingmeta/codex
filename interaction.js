/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

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
  click when Codex.mode is non-context just drops the HUD
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
    var start_t=-1; var last_t=-1;
    function sbicon(base){return Codex.graphics+base;}
    function cxicon(base) {return Codex.graphics+"codex/"+base;}

    /* Setup for gesture handling */

    function addHandlers(node,type){
	var mode=Codex.ui;
	fdjtDOM.addListeners(node,Codex.UI.handlers[mode][type]);}
    Codex.UI.addHandlers=addHandlers;

    function setupGestures(){
	var mode=Codex.ui;
	if (!(mode)) Codex.ui=mode="mouse";
	addHandlers(false,'window');
	addHandlers(fdjtID("CODEXPAGE"),'content');
	addHandlers(Codex.HUD,'hud');
	var handlers=Codex.UI.handlers[mode];
	if (mode)
	    for (key in handlers)
		if ((key[0]==='.')||(key[0]==='#')) {
		    var nodes=fdjtDOM.$(key); var h=handlers[key];
		    fdjtDOM.addListeners(nodes,h);}}
    Codex.setupGestures=setupGestures;

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

    /* Adding a gloss button */

    function addGlossButton(target){
	var passage=Codex.getTarget(target);
	if (!(passage)) return;
	var img=fdjtDOM.getChild(passage,".codexglossbutton");
	if (img) return;
	img=fdjtDOM.Image(cxicon("remarkballoon32x32.png"),".codexglossbutton",
			  "+","click to add a gloss to this passage");
	Codex.UI.addHandlers(img,"glossbutton");
	fdjtDOM.prepend(passage,img);}
    
    function glossbutton_ontap(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var passage=Codex.getTarget(target);
	if ((Codex.mode==="addgloss")&&
	    (Codex.glosstarget===passage))
	    CodexMode(true);
	else if (passage) {
	    fdjtUI.cancel(evt);
	    Codex.setGlossTarget(passage);
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
	    if (Codex.Trace.gestures)
		fdjtLog("clear_hold from %s",(caller||"somewhere"));}}

    /* Generic content handler */

    function content_tapped(evt,target){
	if (!(target)) target=fdjtUI.T(evt);
	var anchor=fdjtDOM.getParent(target,"A"), href;
	// If you tap on a relative anchor, move there using Codex
	// rather than the browser default
	if ((anchor)&&(anchor.href)&&
	    (href=anchor.getAttribute("href"))&&(href[0]==='#')&&
	    (document.getElementById(href.slice(1)))) {
	    var elt=document.getElementById(href.slice(1));
	    // This would be the place to provide smarts for
	    // asides/notes/etc, so they (for example) pop up
	    Codex.JumpTo(elt);
	    fdjtUI.cancel(evt);
	    return;}
	var passage=Codex.getTarget(target);
	// We get the passage here so we can include it in the trace message
	if (Codex.Trace.gestures)
	    fdjtLog("content_tapped (%o) on %o passage=%o mode=%o",
		    evt,target,passage,Codex.mode);
	// These should have their own handlers
	if ((fdjtUI.isClickable(target))||
	    // (fdjtDOM.hasParent(target,".codexglossbutton"))||
	    (fdjtDOM.hasParent(target,".codexglossmark"))) {
	    if (Codex.Trace.gestures)
		fdjtLog("deferring content_tapped (%o) on %o",
			evt,target,passage,Codex.mode);
	    return;}
	// else fdjtUI.cancel(evt); 
	// If you tap an edge, page forward or backward
	if (edgeTap(evt)) return;
	var sel=window.getSelection();
	// If there's a selection, store it as an excerpt.
	if ((sel)&&(sel.anchorNode)&&(!(emptySelection(sel)))) {
	    var p=Codex.getTarget(sel.anchorNode)||
		Codex.getTarget(sel.focusNode)||
		passage;
	    if (p) {
		if ((Codex.mode==="addgloss")&&
		    (fdjtID("CODEXLIVEGLOSS"))) {
		    Codex.addExcerpt(fdjtID("CODEXLIVEGLOSgit S"),
				     sel.toString(),
				     ((Codex.glosstarget!==p)&&
				      ((p.id)||p.getAttribute("data-baseid"))));}
		else Codex.excerpt=sel.toString();
		return;}
	    else CodexMode(false);}
	if ((passage)&&(Codex.mode==='addgloss')) {
	    if (passage===Codex.target) CodexMode(false);
	    else tapTarget(passage);}
	else if ((Codex.mode)||(Codex.hudup))
	    CodexMode(false);
	else if (passage) tapTarget(passage);
	else CodexMode(true);}

    /* Tap actions */

    function tapTarget(target){
	if (Codex.Trace.gestures)
	    fdjtLog("Tap on target %o mode=%o",target,Codex.mode);
	Codex.setTarget(target);
	Codex.setGlossTarget(target);
	CodexMode("addgloss");}

    function edgeTap(evt,x){
	if (!(evt)) evt=event||false;
	if (typeof x !== 'number') x=((evt)&&(evt.clientX));
	if (typeof x !== 'number') x=last_x;
	if (typeof x === 'number') {
	    if (Codex.Trace.gestures)
		fdjtLog("edgeTap %o x=%o w=%o",evt,x,fdjtDOM.viewHeight());
	    if (x<50) {Backward(evt); return true;}
	    else if (x>(fdjtDOM.viewWidth()-50)) {
		Forward(evt); return true;}
	    else return false}
	else return false;}
    Codex.edgeTap=edgeTap;
    
    function edge_click(evt) {
	var target=fdjtUI.T(evt);
	if ((fdjtUI.isClickable(target))||
	    (fdjtDOM.hasParent(target,".codexglossbutton"))||
	    (fdjtDOM.hasParent(target,".codexglossmark")))
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
		Codex.Scan(fdjtID(target.about),target);
		return fdjtUI.cancel(evt);}
	    else if (target.frag) {
		Codex.tocJump(evt,target);
		return fdjtUI.cancel(evt);}
	    else target=target.parentNode;}}
    
    /* Mouse handlers */

    /* Keyboard handlers */

    // We use keydown to handle navigation functions and keypress
    //  to handle mode changes
    function onkeydown(evt){
	evt=evt||event||null;
	var kc=evt.keyCode;
	// Codex.trace("sbook_onkeydown",evt);
	if (evt.keyCode===27) { /* Escape works anywhere */
	    if (Codex.mode) {
		Codex.last_mode=Codex.mode;
		CodexMode(false);
		Codex.setTarget(false);
		fdjtID("CODEXSEARCHINPUT").blur();}
	    else if (Codex.last_mode) CodexMode(Codex.last_mode);
	    else {}
	    return;}
	else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
	else if (kc===34) Codex.Forward(evt);   /* page down */
	else if (kc===33) Codex.Backward(evt);  /* page up */
	else if (kc===37) Codex.scanBackward(evt); /* arrow left */
	else if (kc===39) Codex.scanForward(evt); /* arrow right */
	// Don't interrupt text input for space, etc
	else if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	else if (kc===32) Codex.Forward(evt); // Space
	// backspace or delete
	else if ((kc===8)||(kc===45)) Codex.Backward(evt);
	// Home goes to the current head.
	else if (kc===36) Codex.JumpTo(Codex.head);
	else return;
	fdjtUI.cancel(evt);}

    // At one point, we had the shift key temporarily raise/lower the HUD.
    //  We might do it again, so we keep this definition around
    function onkeyup(evt){
	evt=evt||event||null;
	var kc=evt.keyCode;
	// Codex.trace("sbook_onkeyup",evt);
	if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	else if ((evt.ctrlKey)||(evt.altKey)||(evt.metaKey)) return true;
	else {}}
    Codex.UI.handlers.onkeyup=onkeyup;

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
	72: "help", 104: "humane",
	103: "allglosses",71: "allglosses",
	67: "console", 99: "console"};

    // Handle mode changes
    function onkeypress(evt){
	var modearg=false; 
	evt=evt||event||null;
	var ch=evt.charCode||evt.keyCode;
	// Codex.trace("sbook_onkeypress",evt);
	if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
	else modearg=modechars[ch];
	if (modearg==="flyleaf")
	    modearg=Codex.last_flyleaf||"about";
	if (modearg==="humane") {
	    fdjtLog.Humane();
	    return;}
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
    Codex.UI.handlers.onkeypress=onkeypress;

    function goto_keypress(evt){
	evt=evt||event||null;
	var target=fdjtUI.T(evt);
	var ch=evt.charCode||evt.keyCode;
	var max=false; var min=false;
	if (target.name==='GOTOLOC') {
	    min=0; max=Math.floor(Codex.ends_at/128);}
	else if (target.name==='GOTOPAGE') {
	    min=1; max=Codex.pagecount;}
	else if (ch===13) fdjtUI.cancel(evt);
	if (ch===13) {
	    var num=parseInt(target.value);
	    fdjtUI.cancel(evt);
	    if ((typeof num !== 'number')||(num<min)||(num>max)) {
		alert("Enter a number between "+min+" and "+max+" (inclusive)");
		return;}
	    if (target.name==='GOTOLOC') Codex.JumpTo(128*num);
	    else if (target.name==='GOTOPAGE') Codex.GoToPage(num);
	    else {}
	    target.value="";
	    CodexMode(false);}}
    Codex.UI.goto_keypress=goto_keypress;

    /* HUD button handling */

    var mode_hud_map={
	"toc": "CODEXTOC",
	"searching": "CODEXSEARCH",
	"allglosses": "CODEXSOURCES",
	"flyleaf": "CODEXFLYHEAD"};
    
    function hudbutton(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var mode=target.getAttribute("hudmode");
	if ((Codex.Trace.gestures)&&
	    ((evt.type==='click')||(Codex.Trace.gestures>1)))
	    fdjtLog("hudbutton() %o mode=%o cl=%o scan=%o sbh=%o mode=%o",
		    evt,mode,(fdjtUI.isClickable(target)),
		    Codex.scanning,Codex.hudup,CodexMode());
	fdjtUI.cancel(evt);
	if (!(mode)) return;
	var hudid=((mode)&&(mode_hud_map[mode]));
	var hud=fdjtID(hudid);
	if (mode==='flyleaf') mode=Codex.last_flyleaf||"help";
	if ((evt.type==='click')||(evt.type==='touchend')) {
	    if (hud) fdjtDOM.dropClass(hud,"hover");
	    if (fdjtDOM.hasClass(Codex.HUD,mode)) CodexMode(false);
	    else CodexMode(mode);}
	else if ((evt.type==='mouseover')&&(Codex.mode))
	    return;
	else {
	    if (!(hud)) {}
	    else if (evt.type==='mouseover')
		fdjtDOM.addClass(hud,"hover");
	    else if (evt.type==='mouseout')
		fdjtDOM.dropClass(hud,"hover");
	    else {}}}
    Codex.UI.hudbutton=hudbutton;

    Codex.UI.dropHUD=function(evt){
	var target=fdjtUI.T(evt);
	if (fdjtUI.isClickable(target)) {
	    if (Codex.Trace.gestures)
		fdjtLog("Clickable: don't dropHUD %o",evt);
	    return;}
	if (Codex.Trace.gestures) fdjtLog("dropHUD %o",evt);
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
	var target=fdjtUI.T(evt); var ref=Codex.getRef(target);
	if (touch_started)
	    fdjtLog("%s() n=%o %sts=%o %s@%o\n\t+%o %s%s%s%s%s%s%s s=%o,%o l=%o,%o p=%o,%o d=%o,%o ref=%o tt=%o tm=%o",
		    handler,((touches)&&(touches.length)),
		    ((!(touch))?(""):
		     ("c="+touch.clientX+","+touch.clientY+";s="+touch.screenX+","+touch.screenY+" ")),
		    touch_started,evt.type,target,
		    fdjtTime()-touch_started,
		    ((Codex.mode)?(Codex.mode+" "):""),
		    ((Codex.scanning)?"scanning ":""),
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
		     ((Codex.mode)?(Codex.mode+" "):""),
		     ((Codex.scanning)?"scanning ":""),
		     touch.clientX,touch.clientY,touch.screenX,touch.screenY,
		     touch_started,evt.type,target,ref);
	if (ref) fdjtLog("%s() ref=%o from %o",handler,ref,target);}

    /* Touch handling */

    function shared_touchstart(evt){
	evt=evt||event||false;
	var target=fdjtUI.T(evt);
	if (fdjtUI.isClickable(target)) return;
	// fdjtUI.cancel(evt);
	if (Codex.Trace.gestures) tracetouch("touchstart",evt);
	touch_started=fdjtTime();
	var touches=evt.touches;
	var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
	if (touches) n_touches=touches.length;
	else if (evt.shiftKey) n_touches=2;
	else n_touches=1;
	if (touch) {
	    start_t=fdjtTime();
	    start_x=last_x=touch.clientX;
	    start_y=last_y=touch.clientY;
	    page_x=touch.screenX; page_y=touch.screenY;}
	else if (evt.clientX) { /* faketouch */
	    if (evt.shiftKey) n_touches=2; else n_touches=1;
	    start_t=fdjtTime();
	    start_x=last_x=evt.clientX;
	    start_y=last_y=evt.clientY;
	    page_x=touch.screenX; page_y=evt.screenY;}
	touch_held=false; touch_moved=false; touch_scrolled=false;}

    var initial_offset=false;

    function content_touchstart(evt){
	evt=evt||event||false;
	clear_hold("touchstart/touchover");
	handled=false;
	var target=fdjtUI.T(evt);
	shared_touchstart(evt);
	var passage=Codex.getTarget(target);
	if (Codex.Trace.gestures)
	    fdjtLog("Touchstart %o on %o => %o",evt,target,passage);
	if (passage) {
	    var text=fdjtDOM.textify(passage).
		replace(/\n\n+/g,"\n").
		replace(/^\n+/,"").
		replace(/\n+$/,"").
		replace(/\n+/g," // ");
	    held=setTimeout(function(){
		clear_hold("completed");
		handled=true;
		Codex.setGlossTarget(passage);
		fdjtID("CODEXEXTRACT").passageid=
		    (passage.id||(passage.getAttribute("data-baseid")));
		fdjtID("CODEXEXTRACT").value=text;
		CodexMode("editexcerpt");},
			    1000);}
	var translation=Codex.pages.style.getPropertyValue(fdjtDOM.transform);
	var numstart; var numend;
	initial_offset=false;
	if (translation) {
	    var numstart=translation.search(/[\-0123456789]+/);
	    if (numstart>0) {
		translation=translation.slice(numstart);
		var numend=translation.search(/[^\-0123456789]+/);
		if (numend>0)
		    initial_offset=parseInt(translation.slice(0,numend));}}}
    Codex.UI.useExcerpt=function(flag){
	var text=fdjtID("CODEXEXTRACT").value;
	var excerpt_elt=fdjtID("CODEXEXCERPT");
	var form=fdjtID("CODEXLIVEGLOSS");
	if (flag) {
	    Codex.addExcerpt
	    (form,text,excerpt_elt.passageid);
	    CodexMode("addgloss");}
	else CodexMode("false");};
    
    var mouseisdown=false;

    function content_touchmove(evt){
	// When faking touch, moves only get counted if the mouse is down.
	if ((evt.type==="mousemove")&&(!(mouseisdown))) return;
	// fdjtUI.cancel(evt);
	touch_moves++;
	clear_hold("touchmove");
	var touches=evt.touches;
	var touch=
	    (((evt.touches)&&(evt.touches.length))?(evt.touches[0]):(evt));
	if (page_x<0) page_x=touch.screenX;
	if (page_y<0) page_y=touch.screenY;
	if ((touches)&&(touches.length>n_touches)) n_touches=touches.length;
	var dx=touch.screenX-page_x; var dy=touch.screenY-page_y;
	var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	if (Codex.Trace.gestures>2) tracetouch("touchmove",evt);
	/*
	  if ((held)&&((adx+ady)>5)) {
	  clear_hold("touchmove"+(adx+ady)); handled=true;}
	*/
	if (Codex.Trace.gestures>1)
	    fdjtLog("body_touchmove d=%o,%o a=%o,%o s=%o,%o c=%o,%o l=%o,%o n=%o scan=%o ",
		    dx,dy,adx,ady,touch.screenX,touch.screenY,
		    touch.clientX,touch.clientY,last_x,last_y,
		    touch_moves,Codex.scanning);
	last_x=touch.clientX; last_y=touch.clientY;
	touch_moved=true;
	/*
	// This provides direct interaction but looks a little clunky
	if (typeof initial_offset === 'number') {
	var new_translation="translate("+(initial_offset+dx)+"px,0px)";
	Codex.pages.style.setProperty
	(fdjtDOM.transform,new_translation,"important");}
	*/
	return;}
    
    function content_touchend(evt,tap){
	var target=fdjtUI.T(evt);
	if (held) clear_hold("touchend");
	if (handled) return;
	if (Codex.Trace.gestures) tracetouch("touchend",evt);
	mouseisdown=false; // For faketouch
	if (fdjtUI.isClickable(target)) return;
	if (touch_moved) {
	    var dx=last_x-start_x; var dy=last_y-start_y;
	    var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	    var ad=((adx<ady)?(ady-adx):(adx-ady));
	    if (Codex.Trace.gestures)
		fdjtLog("touchend/gesture l=%o,%o s=%o,%o d=%o,%o |d|=%o,%o",
			last_x,last_y,start_x,start_y,dx,dy,adx,ady);
	    if (adx>(ady*3)) { /* horizontal */
		if (n_touches===1) {
		    if (dx<0) Codex.Forward(evt);
		    else Codex.Backward(evt);}
		else {
		    if (dx<0) Codex.scanForward(evt);
		    else Codex.scanBackward(evt);}}
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
	if (Codex.Trace.gestures>1) tracetouch("hud_touchmove",evt);
	if ((hold_timer)&&((adx+ady)>4)) {
	    clearTimeout(hold_timer); hold_timer=false;}
	last_x=touch.clientX; last_y=touch.clientY;
	touch_moved=true;
	page_x=touch.screenX; page_y=touch.screenY;
	touch_scrolled=true;}

    function hud_touchend(evt){
	if (Codex.Trace.gestures) tracetouch("hud_touchend",evt);
	var target=fdjtUI.T(evt);
	mouseisdown=false; // For faketouch
	var scroller=((Codex.scrolling)&&(Codex.scrollers)&&
		      (Codex.scrollers[Codex.scrolling]));
	// fdjtLog("hud_touchend scroller=%o(%o) moved=%o",scroller,scroller.element,scroller.moved);
	if ((scroller)&&(scroller.motion)&&(scroller.motion>10)) return;
	else if (fdjtUI.isClickable(target)) {
	    if (Codex.ui==="faketouch") {
		// This happens automatically when faking touch
		fdjtUI.cancel(evt);
		return;}
	    else {
		var click_evt = document.createEvent("MouseEvents");
		while (target)
		    if (target.nodeType===1) break;
		else target=target.parentNode;
		if (!(target)) return;
		if (Codex.Trace.gestures)
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
	var glossmark=fdjtDOM.getParent(target,".codexglossmark");
	var passage=Codex.getTarget(glossmark.parentNode,true);
	if (Codex.Trace.gestures)
	    fdjtLog("glossmark_tapped (%o) on %o gmark=%o passage=%o mode=%o target=%o",
		    evt,target,glossmark,passage,Codex.mode,Codex.target);
	if (!(glossmark)) return false;
	fdjtUI.cancel(evt);
	if ((Codex.mode==='glosses')&&(Codex.target===passage)) {
	    CodexMode(true);
	    return;}
	else Codex.openGlossmark(passage);}
    function glossmark_onmouseover(evt){
	evt=evt||event||null;
	var target=Codex.getTarget(fdjtUI.T(evt))
	fdjtDOM.addClass(target,"sbooklivespot");}
    function glossmark_onmouseout(evt){
	evt=evt||event||null;
	var target=Codex.getTarget(fdjtUI.T(evt));
	fdjtDOM.dropClass(target,"sbooklivespot");}

    /* Moving forward and backward */

    var last_motion=false;

    function Forward(evt){
	var now=fdjtTime();
	if (!(evt)) evt=event||false;
	if (evt) fdjtUI.cancel(evt);
	if ((last_motion)&&((now-last_motion)<100)) return;
	else last_motion=now;
	if (Codex.Trace.nav)
	    fdjtLog("Forward e=%o h=%o t=%o",evt,Codex.head,Codex.target);
	if ((Codex.mode==="glosses")||(Codex.mode==="addgloss"))
	    CodexMode(true);
	if (((evt)&&(evt.shiftKey))||(n_touches>1))
	    scanForward();
	else pageForward();}
    Codex.Forward=Forward;
    function Backward(evt){
	var now=fdjtTime();
	if (!(evt)) evt=event||false;
	if (evt) fdjtUI.cancel(evt);
	if ((last_motion)&&((now-last_motion)<100)) return;
	else last_motion=now;
	if ((Codex.mode==="glosses")||(Codex.mode==="addgloss"))
	    CodexMode(true);
	if (Codex.Trace.nav)
	    fdjtLog("Backward e=%o h=%o t=%o",evt,Codex.head,Codex.target);
	if (((evt)&&(evt.shiftKey))||(n_touches>1))
	    scanBackward();
	else pageBackward();}
    Codex.Backward=Backward;

    function pageForward(){
	if (Codex.Trace.gestures)
	    fdjtLog("pageForward c=%o n=%o",Codex.curpage,Codex.pagecount);
	if ((Codex.mode==="scanning")||(Codex.mode==="tocscan"))
	    CodexMode(false);
	if ((Codex.paginate)&&(Codex.colbreak)&&(Codex.pages)) {
	    if (Codex.curpage===Codex.pagecount) {}
	    else Codex.GoToPage(Codex.curpage=(Codex.curpage+1));}
	else if ((Codex.paginate)&&(Codex.pagecount)) {
	    var newpage=false;
	    if (Codex.mode==="glosses") CodexMode(true);
	    if (Codex.curpage===Codex.pagecount) {}
	    else Codex.GoToPage(newpage=Codex.curpage+1);
	    if ((false)&&(newpage)&&(Codex.mode==='allglosses')) /* to fix */
		Codex.UI.scrollGlosses(
		    Codex.pageinfo[newpage].first,
		    fdjtID("CODEXALLGLOSSES"),true);}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()+delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    Codex.pageForward=pageForward;

    function pageBackward(){
	if (Codex.Trace.gestures)
	    fdjtLog("pageBackward c=%o n=%o",Codex.curpage,Codex.pagecount);
	if ((Codex.mode==="scanning")||(Codex.mode==="tocscan"))
	    CodexMode(false);
	if ((Codex.paginate)&&(Codex.colbreak)&&(Codex.pages)) {
	    if (Codex.curpage===0) {}
	    else Codex.GoToPage(Codex.curpage=(Codex.curpage-1));}
	else if ((Codex.paginate)&&(Codex.pagecount)) {
	    var newpage=false;
	    if (Codex.mode==="glosses") CodexMode(true);
	    if (Codex.curpage===0) {}
	    else {
		Codex.GoToPage(newpage=Codex.curpage-1);}
	    if ((false)&&(newpage)&&(Codex.mode==='allglosses')) /* to fix */
		Codex.UI.scrollGlosses(
		    Codex.pageinfo[newpage].first,
		    fdjtID("CODEXALLGLOSSES"),true);}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()-delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    Codex.pageBackward=pageBackward;

    function scanForward(){
	if (Codex.mode==="scanning") {}
	else if (Codex.mode==="tocscan") {}
	else if (Codex.scanning) CodexMode("scanning");
	else CodexMode("tocscan");
	if (Codex.mode==="tocscan") {
	    var head=Codex.head;
	    var headid=head.id||head.getAttribute("data-baseid");
	    var headinfo=Codex.docinfo[headid];
	    if (Codex.Trace.nav) 
		fdjtLog("scanForward/toc() head=%o info=%o n=%o h=%o",
			head,headinfo,headinfo.next,headinfo.head);
	    if (headinfo.next) Codex.GoTo(headinfo.next.elt);
	    else if ((headinfo.head)&&(headinfo.head.next)) {
		Codex.GoTo(headinfo.head.next.elt); CodexMode("toc");}
	    else if ((headinfo.head)&&(headinfo.head.head)&&
		     (headinfo.head.head.next)) 
		Codex.GoTo(headinfo.head.head.next.elt);
	    else CodexMode(false);
	    return;}
	var start=Codex.scanning;
	var scan=Codex.nextSlice(start);
	var ref=((scan)&&(Codex.getRef(scan)));
	if (Codex.Trace.nav) 
	    fdjtLog("scanForward() from %o/%o to %o/%o under %o",
		    start,Codex.getRef(start),scan,ref,slice);
	if ((ref)&&(scan)) Codex.Scan(ref,scan);
	return scan;}
    Codex.scanForward=scanForward;

    function scanBackward(){
	if (Codex.mode==="scanning") {}
	else if (Codex.mode==="tocscan") {}
	else if (Codex.scanning) CodexMode("scanning");
	else CodexMode("tocscan");
	if (Codex.mode==="tocscan") {
	    var head=Codex.head;
	    var headid=head.id||head.getAttribute("data-baseid");
	    var headinfo=Codex.docinfo[headid];
	    if (Codex.Trace.nav) 
		fdjtLog("scanBackward/toc() head=%o info=%o p=%o h=%o",
			head,headinfo,headinfo.prev,headinfo.head);
	    if (headinfo.prev) Codex.GoTo(headinfo.prev.elt);
	    else if (headinfo.head) 
		Codex.GoTo(headinfo.head.elt);
	    else CodexMode(false);
	    return;}
	var scan=Codex.prevSlice(Codex.scanning);
	var ref=((scan)&&(Codex.getRef(scan)));
	if (Codex.Trace.nav) 
	    fdjtLog("scanBackward() from %o/%o to %o/%o under %o",
		    start,Codex.getRef(start),scan,ref,slice);
	if ((ref)&&(scan)) Codex.Scan(ref,scan);
	return scan;}
    Codex.scanBackward=scanBackward;

    function scanner_click(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	if (fdjtUI.isClickable(target)) return;
	var scanning=Codex.scanning;
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
	if (Codex.hudup) {CodexMode(false); return;}
	CodexMode.toggle("gotopage");}
    function enterLocation(evt) {
	evt=evt||event;
	fdjtUI.cancel(evt);
	if (Codex.hudup) {CodexMode(false); return;}
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
	if (Codex.Trace.gestures) fdjtLog("head_click %o",evt);
	if (fdjtUI.isClickable(evt)) return;
	else if (Codex.mode==='help') {
	    fdjtUI.cancel(evt);
	    CodexMode(true);}
	else if (Codex.mode) return;
	else {
	    fdjtUI.cancel(evt);
	    CodexMode(true);}}
    function foot_click(evt){
	if (Codex.Trace.gestures) fdjtLog("foot_click %o",evt);
	if (fdjtUI.isClickable(evt)) return;
	else if (Codex.mode) {
	    fdjtUI.cancel(evt);
	    CodexMode(false);
	    return;}}

    function pageinfo_click(evt){
	var pageinfo=fdjtID("CODEXPAGEINFO");
	if ((Codex.hudup)||(Codex.mode)) {
	    fdjtUI.cancel(evt);
	    CodexMode(false);
	    return;}
	var offx=evt.offsetX;
	var offwidth=pageinfo.offsetWidth;
	var gopage=Math.floor((offx/offwidth)*Codex.pagecount)+1;
	if ((Codex.Trace.gestures)||(hasClass(pageinfo,"codextrace")))
	    fdjtLog("pageinfo_click %o off=%o/%o=%o gopage=%o/%o",
		    evt,offx,offwidth,offx/offwidth,
		    gopage,Codex.pagecount);
	if (!(offx)) return;
	fdjtUI.cancel(evt);
	Codex.GoToPage(gopage);
	if ((Codex.mode==="gotoloc")||(Codex.mode==="gotopage"))
	    CodexMode(false);}

    function pageinfo_hover(evt){
	var pageinfo=fdjtID("CODEXPAGEINFO");
	var offx=evt.offsetX;
	if (!(offx)) return;
	var offwidth=pageinfo.offsetWidth;
	var showpage=Math.floor((offx/offwidth)*Codex.pagecount)+1;
	pageinfo.title=fdjtString("%d",showpage);}
    /* This doesn't quite work on the iPad, so we're not currently
       using it. */
    function pageinfo_move(evt){
	var pageinfo=fdjtID("CODEXPAGEINFO"); var offx;
	if (evt.offsetX) {
	    var tx=fdjtDOM.getGeometry(fdjtUI.T(evt),pageinfo).left;
	    offx=evt.offsetX+tx;}
	else offx=getOffX(evt);
	var offwidth=fdjtID("CODEXPAGEINFO").offsetWidth;
	var goloc=Math.floor((offx/offwidth)*Codex.ends_at);
	var page=((Codex.paginate)&&Codex.getPageAt(goloc));
	fdjtUI.cancel(evt);
	fdjtLog("%o type=%o ox=%o ow=%o gl=%o p=%o",
		evt,evt.type,offx,offwidth,goloc,page);
	if ((evt.type==='touchmove')||
	    ((evt.type==='mousemove')&&((evt.button)||(evt.shiftKey)))) {
	    if ((typeof page === 'number')&&(page!==Codex.curpage))
		Codex.GoToPage(page);}}
    

    /* Rules */

    var nobubble=fdjtUI.nobubble;
    var cancel=fdjtUI.cancel;

    function hideSplashToggle(evt) {
	evt=evt||event;
	var newval=(!(Codex.hidesplash));
	Codex.setConfig('hidesplash',newval);
	Codex.saveConfig();
	fdjtUI.cancel(evt);
	if ((newval)&&(Codex._setup)&&
	    ((fdjtTime()-(Codex._setup.getTime()))<30000))
	    CodexMode(false);}
    Codex.UI.handlers.mouse=
	{window: {
	    keyup: onkeyup,
	    keydown: onkeydown,
	    keypress: onkeypress,
	    click: edge_click},
	 content: {mouseup: content_tapped},
	 hud: {click: hud_tapped},
	 glossmark: {mouseup: glossmark_tapped},
	 glossbutton: {mouseup: glossbutton_ontap,mousedown: cancel},
	 ".sbookmargin": {click: edge_click},
	 "#CODEXHELP": {click: Codex.UI.dropHUD},
	 "#CODEXFLYLEAF": {click: flyleaf_tap},
	 "#CODEXPAGEINFO": {click: pageinfo_click, mousemove: pageinfo_hover},
	 "#CODEXPAGENOTEXT": {click: enterPageNum},
	 "#CODEXLOCOFF": {click: enterLocation},
	 "#CODEXSCANNER": {click: scanner_click},
	 "#CODEXPAGEHEAD": {click: head_click},
	 "#CODEXHEAD": {click: head_click},
	 "#CODEXPAGEFOOT": {click: foot_click},
	 "#HIDESPLASHCHECKSPAN" : {click: hideSplashToggle},
	 "#HIDEHELPBUTTON" : {click: function(evt){CodexMode(false);}},
	 // Not really used any more
	 "#CODEXPAGENEXT": {click: Codex.Forward},
	 /* ".hudbutton": {mouseover:hudbutton,mouseout:hudbutton}, */
	 ".hudmodebutton": {click:hudbutton,mouseup:cancel,mousedown:cancel},
	 toc: {mouseover: fdjtUI.CoHi.onmouseover,
	       mouseout: fdjtUI.CoHi.onmouseout}};

    Codex.UI.handlers.webtouch=
	{window: {keyup:onkeyup,keydown:onkeydown,keypress:onkeypress,
		  touchstart: cancel, touchmove: cancel, touchend: cancel},
	 content: {touchstart: content_touchstart,
		   touchmove: content_touchmove,
		   touchend: content_touchend},
	 hud: {touchstart: shared_touchstart,
	       touchmove: hud_touchmove,
	       touchend: hud_touchend},
	 "#CODEXPAGEHEAD": {
	     touchstart: cancel,
	     touchmove: cancel,
	     touchend: head_click},
	 "#CODEXPAGEFOOT": {
	     touchstart: cancel,
	     touchmove: cancel,
	     touchend: foot_click},
	 "#CODEXHELP": {touchstart: Codex.UI.dropHUD,
			touchmove: cancel,
			touchend: cancel},
	 "#CODEXSCANNER": {touchstart: scanner_click},
	 // "#CODEXFLYLEAF": {touchend: flyleaf_tap},
	 "#CODEXPAGEINFO": {touchstart: pageinfo_click,
			    touchmove: cancel,touchend: cancel},
	 "#CODEXPAGENOTEXT": {touchstart: enterPageNum,
			      touchmove: cancel,touchend: cancel},
	 "#CODEXLOCOFF": {touchstart: enterLocation,
			  touchmove: cancel,touchend: cancel},
	 // Not really used any more
	 "#CODEXPAGENEXT": {touchstart: Codex.Forward,touchmove: cancel, touchend: cancel},
	 ".hudbutton": {touchstart: dont,touchmove: dont, touchend: dont},
	 "#CODEXTABS": {touchstart: dont,touchmove: dont, touchend: dont},
	 "#HIDESPLASHCHECKSPAN" : {touchstart: hideSplashToggle,
				   touchmove: cancel,
				   touchend: cancel},
	 "#HIDEHELPBUTTON" : {click: function(evt){CodexMode(false);},
			      touchmove: cancel,
			      touchend: cancel},
	 ".hudmodebutton": {touchend:hudbutton,
			    touchdown:cancel,
			    touchmove:cancel},
	 glossmark: {touchend: glossmark_tapped,
		     touchstart: cancel,
		     touchmove: cancel},
	 glossbutton: {touchend: glossbutton_ontap,
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

