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

    var unhold=false;
    var hold_timer=false;
    var hold_interval=500;
    var start_x=-1; var start_y=-1; var last_x=-1; var last_y=-1;
    
    /* Setup for gesture handling */

    function addHandlers(node,type){
	var mode=sbook.ui;
	fdjtDOM.addListeners(node,sbook.UI.handlers[mode][type]);}
    sbook.UI.addHandlers=addHandlers;

    function setupGestures(){
	var mode=sbook.ui;
	if (!(mode)) sbook.ui=mode="mouse";
	addHandlers(false,'window');
	addHandlers(sbook.body,'body');
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

    /* Core functions */

    function body_tap(element){
      if (sbook.Trace.gestures)
	fdjtLog("[%fs] body_tap %o hudup=%o mode=%o preview=%o target=%o",
		fdjtET(),element,sbook.hudup,sbook.mode,sbook.preview,
		sbook.target);
      if (!(element)) {
	if (sbook.preview) sbook.Preview(false);
	else if (sbook.mode) sbookMode(false);
	else if (sbook.hudup) sbookMode(false);
	else sbookMode(true);}
      else if (sbook.preview) {
	if (fdjtDOM.hasParent(element,sbook.preview))
	  sbook.JumpTo(sbook.preview.id);
	else sbook.Preview(false);}
      else {
	var target=sbook.getTarget(element);
	if (sbook.Trace.gestures)
	  fdjtLog("[%fs] Tap on target %o",fdjtET(),target);
	if ((!(target))||(target===sbook.root)||(target===sbook.body)) {
	  if (sbook.mode) sbookMode(false);
	  else sbookMode(true);
	  return;}
	else if (sbook.glosstarget===target) {
	  if (sbook.mode) sbookMode(false);
	  else sbookMode("target");
	  return;}
	sbook.glossTarget(target);
	window.focus();
	sbookMode('target');}}

    function body_hold(element){
      if (sbook.Trace.gestures)
	fdjtLog("[%fs] body_hold %o hudup=%o mode=%o preview=%o target=%o",
		fdjtET(),element,sbook.hudup,sbook.mode,sbook.preview,
		sbook.target);
      if (!(element)) {
	if (sbook.hudup) {
	  fdjtDOM.dropClass(document.body,"hudup");
	  return function(){
	    fdjtDOM.addClass(document.body,"hudup");};}
	else {
	  sbookMode("context");
	  return function(){sbookMode(false);};}}
      else if (sbook.mode) {
	var mode=sbook.mode;
	sbookMode("context");
	return function(){sbookMode(mode);};}
      else {
	var target=sbook.getTarget(element);
	if (target) {
	  sbook.setTarget(target);
	  sbook.setInfoTarget(target);
	  sbookMode("context");
	  return function(){sbookMode(false);};}}}

    function hud_tap(element){
      var ref=sbook.getRef(element);
      if (sbook.Trace.gestures)
	fdjtLog("[%fs] hud_tap %o (%o) hudup=%o mode=%o preview=%o target=%o",
		fdjtET(),element,ref,sbook.hudup,sbook.mode,sbook.preview,
		sbook.target);
      if (!(ref))
	if (sbook.preview) return sbook.Preview(false);
	else return;
      else return sbook.Preview(ref,sbook.getRefElt(element));}

    function hud_hold(element){
      if (sbook.Trace.gestures)
	fdjtLog("[%fs] hud_hold %o hudup=%o mode=%o preview=%o target=%o",
		fdjtET(),element,sbook.hudup,sbook.mode,sbook.preview,
		sbook.target);
      var ref=sbook.getRef(element);
      if (ref) {
	if (sbook.preview) {
	  sbook.Preview(ref); return false;}
	else {
	  sbook.Preview(ref);
	  return function(){sbook.Preview(false);};}}
      return false;}

    function edgeTap(evt,x){
      if (typeof x !== 'number') x=((evt)&&(evt.clientX));
      if (typeof x !== 'number') x=last_x;
      if (typeof x === 'number') {
	if (x<50) {
	  if (sbook.preview) previewBackward();
	  else pageBackward();
	  fdjtUI.cancel(evt);
	  return true;}
	else if (x>(fdjtDOM.viewWidth()-50)) {
	  if (sbook.preview) previewForward();
	  else if (typeof sbook.mode === 'string') sbookMode(false);
	  else pageForward();
	  fdjtUI.cancel(evt);
	  return true;}
	else return false;}
      else return false;}

    /* Onclick handlers */

    function body_onclick(evt){
	var target=fdjtUI.T(evt);
	if (sbook.Trace.gestures) 
	  fdjtLog("[%fs] body_onclick() %o ui=%o cl=%o sbp=%o sbh=%o mode=%o",
		  fdjtET(),evt,(inUI(target)),(fdjtDOM.isClickable(target)),
		  sbook.preview,sbook.hudup,sbookMode());
	if ((evt.button>1)||(fdjtDOM.isClickable(target))||(edgeTap(evt)))
	  return;
	else return body_tap(sbook.getTarget(target));}
    
    function hud_onclick(evt){
	var target=fdjtUI.T(evt);
	if (sbook.Trace.gestures) 
	  fdjtLog("[%fs] hud_onclick() %o cl=%o sbp=%o sbh=%o mode=%o",
		  fdjtET(),evt,(fdjtDOM.isClickable(target)),
		  sbook.preview,sbook.hudup,sbookMode());
	if (fdjtDOM.isClickable(target)) return;
	else fdjtUI.cancel(evt);
	var ref=sbook.getRef(target);
	if (ref) {
	    if ((sbook.preview)&&(sbook.preview===ref)) 
		sbook.JumpTo(ref);
	    else sbook.Preview(ref,sbook.getRefElt(target));}}
    
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
		fdjtID("SBOOKSEARCHINPUT").blur();}
	    else if (sbook.last_mode) sbookMode(sbook.last_mode);
	    else {}
	    return;}
	else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
	else if (kc===34) sbook.Forward();   /* page down */
	else if (kc===33) sbook.Backward();  /* page up */
	// Don't interrupt text input for space, etc
	else if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	else if (kc===32) sbook.Forward(); // Space
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
	    fdjtID("SBOOKSEARCHINPUT").focus();
	else fdjtID("SBOOKSEARCHINPUT").blur();
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
	  fdjtLog("[%fs] hudbutton() %o mode=%o cl=%o sbp=%o sbh=%o mode=%o",
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
		else {sbookMode(false); sbookMode(true);}}
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
    var touch_selecting=false;

    var doubletap=false, tripletap=false;

    function cleartouch(){
	touch_started=false; touch_ref=false;
	start_x=start_y=last_x=last_y=-1;
	page_x=page_y=sample_t=-1; touch_moves=0;
	touch_timer=false; touch_held=false;
	touch_moved=false; touch_scrolled=false;
	doubletap=false; tripletap=false;
	touch_selecting=false;}

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
		((sbook.preview)?"preview ":""),
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
		   ((sbook.preview)?"preview ":""),
		   touch.clientX,touch.clientY,touch.screenX,touch.screenY,
		   touch_started,evt.type,target,ref);
      if (ref) fdjtLog("[%fs] %s() ref=%o from %o",fdjtET(),handler,ref,target);}

    /* Consolidated mouse */

    function mousedown(evt,hold){
	var target=fdjtUI.T(evt);
	if ((evt.button>1)||(fdjtDOM.isClickable(target))) return;
	fdjtUI.cancel(evt);
	if (sbook.Trace.gestures) tracetouch("mousedown",evt);
	if (hold_timer) {
	    clearTimeout(hold_timer); hold_timer=false;}
	touch_started=fdjtTime();
	var touch=evt;
	if (touch) {
	    start_x=last_x=touch.clientX;
	    start_y=last_y=touch.clientY;}
	hold_timer=
	  setTimeout(function(){
	      if (sbook.Trace.gestures) tracetouch("mousehold",evt);
	      hold_timer=false;
	      var unholder=hold(target);
	      if (unholder) unhold=unholder;},
	    hold_interval);
	touch_held=false; touch_moved=false; touch_scrolled=false;}

    function mouseup(evt,tap){
      if (evt.button>1) return;
      if (sbook.Trace.gestures) tracetouch("mouseup",evt);
      if (unhold) {
	var tocall=unhold; unhold=false; tocall();}
      if (hold_timer) {
	var target=fdjtUI.T(evt);
	clearTimeout(hold_timer); hold_timer=false;
	if (!(edgeTap(evt))) return tap(target);}
      else return;}
    
    function mousemove(evt){
      if (touch_started) {
	last_x=evt.clientX;
	last_y=evt.clientX;}
      if (hold_timer) {
	clearTimeout(hold_timer);
	hold_timer=false;}}

    /* Mouse handlers for body and HUD */

    function body_mousedown(evt){
      return mousedown(evt,body_hold);}
    function body_mouseup(evt){
      return mouseup(evt,body_tap);}
    function hud_mousedown(evt){
      return mousedown(evt,hud_hold);}
    function hud_mouseup(evt){
      return mouseup(evt,hud_tap);}

    /* Touch handling */

    function touchstart(evt,hold){
      var target=fdjtUI.T(evt);
      if (fdjtDOM.isClickable(target)) return;
      fdjtUI.cancel(evt);
      if (sbook.Trace.gestures) tracetouch("touchstart",evt);
      if (hold_timer) {
	clearTimeout(hold_timer); hold_timer=false;}
      touch_started=fdjtTime();
      var touches=evt.touches;
      var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
      if (touch) {
	start_x=last_x=touch.clientX;
	start_y=last_y=touch.clientY;
	page_x=touch.screenX; page_y=touch.screenY;}
      else if (evt.clientX) { /* faketouch */
	start_x=last_x=evt.clientX;
	start_y=last_y=evt.clientY;
	page_x=touch.screenX; page_y=evt.screenY;}
      hold_timer=
	setTimeout(function(){
	    if (sbook.Trace.gestures) tracetouch("mousehold",evt);
	    hold_timer=false;
	    var unholder=hold(target);
	    if (unholder) unhold=unholder;},
	  hold_interval);
      touch_held=false; touch_moved=false; touch_scrolled=false;}

    function touchmove(evt){
	if (touch_selecting) return;
	// if (evt.type==='mousemove') {if (!(evt.button)) return;}
	fdjtUI.cancel(evt);
	touch_moves++;
	if (touch_held) return;
	var touch=
	  (((evt.touches)&&(evt.touches.length))?(evt.touches[0]):(evt));
	if (page_x<0) page_x=touch.screenX;
	if (page_y<0) page_y=touch.screenY;
	var dx=touch.screenX-page_x; var dy=touch.screenY-page_y;
	var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	// if (sbook.Trace.gestures) tracetouch("touchmove",evt);
	if ((hold_timer)&&((adx+ady)>4)) {
	  clearTimeout(hold_timer); hold_timer=false;}
	var target=fdjtUI.T(evt);
	touch_moved=true;
	last_x=touch.clientX; last_y=touch.clientY;
	if (ady>(adx*4)) {
	  if (sbook.preview) {
	    scrollBody(dx,dy); touch_scrolled=true;
	    page_x=touch.screenX; page_y=touch.screenY;}
	  else if (fdjtDOM.hasParent(target,fdjtID("SBOOKFLYLEAF"))) {
	    scrollHUD(dx,dy);
	    page_x=touch.screenX; page_y=touch.screenY;
	    touch_scrolled=true;}}
	else {}}

    function scrollBody(dx,dy){
      var curx=window.scrollX; var cury=window.scrollY;
      if (sbook.Trace.gestures)
	fdjtLog("[%fs] scrollBody(%o,%o)",fdjtET(),dx,dy);
      var newx=curx-dx; var newy=cury-dy;
      fdjtDOM.addClass(sbookHUD,"hidebuttons");
      sbook.scrollTo(newx,newy);}
    function scrollHUD(dx,dy){
      var content=((sbook.scrolling)&&(fdjtID(sbook.scrolling)));
      if (!(content)) return;
      var curtop=parseInt(fdjtDOM.getStyle(content).top.slice(0,-2));
      var geom=fdjtDOM.getGeometry(content);
      var newtop=curtop+dy; 
      var mintop=-(geom.height);
      if (newtop>0) newtop=0; else if (newtop<mintop) newtop=mintop; else {}
      if (sbook.Trace.gestures) 
	fdjtLog("[%fs] scrollHUD() %o,%o: cur=%o new=%o min=%o=-(%o): %o",
		fdjtET(),dx,dy,curtop,newtop,mintop,geom.height,
		content);
      if (newtop!==curtop) content.style.top=newtop+'px';}

    function touchend(evt,tap){
      if (sbook.Trace.gestures) tracetouch("touchend",evt);
      if (unhold) {
	var tocall=unhold; unhold=false; tocall();}
      if (hold_timer) {
	var target=fdjtUI.T(evt);
	clearTimeout(hold_timer); hold_timer=false;}
      if (touch_moved) {
	var dx=last_x-start_x; var dy=last_y-start_y;
	var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	fdjtLog("[%fs] touchend/gesture d=%o,%o |d|=%o,%o",
		fdjtET(),dx,dy,adx,ady);
	if (adx>(ady*4)) { /* horizontal */
	  if (dx<0) sbook.Forward();
	  else sbook.Backward();}
	else if (ady>(adx*4)) { /* vertical */
	  if ((sbook.mode)&&(dy<0)) sbookMode(false);
	  else if ((sbook.mode)&&(dy>0)) {
	    if (sbook.target) {
	      sbook.glossTarget(sbook.target);
	      sbookMode("target");}
	    else sbookMode(true);}
	  else if (dy<0) sbookMode("context");
	  else {
	    if (sbook.target) {
	      sbook.glossTarget(sbook.target);
	      sbookMode("target");}
	    else sbookMode(true);}}
	else if ((adx+ady)>17) {
	  if ((dx>0)&&(dy>0)) sbookMode("toc");
	  else if ((dx<0)&&(dy>0)) sbookMode("searching");
	  else if ((dx>0)&&(dy<0)) sbookMode("dash");
	  else if ((dx<0)&&(dy<0)) sbookMode("allglosses");
	  else {}}
	else {}
	return;}
      else if (!(edgeTap(evt))) return tap(target);
      else return;}

    /* Mouse handlers for body and HUD */

    function body_touchstart(evt){
      return touchstart(evt,body_hold);}
    function body_touchend(evt){
      return touchend(evt,body_tap);}
    function hud_touchstart(evt){
      return touchstart(evt,hud_hold);}
    function hud_touchend(evt){
      return touchend(evt,hud_tap);}

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

    /* Moving forward and backward */

    function Forward(){
      if (sbook.preview) previewForward();
      else pageForward();}
    sbook.Forward=Forward;
    function Backward(){
      if (sbook.preview) previewBackward();
      else pageBackward();}
    sbook.Backward=Backward;

    function pageForward(){
	if (sbook.Trace.gestures)
	    fdjtLog("[%fs] pageForward c=%o n=%o",
		    fdjtET(),sbook.curpage,sbook.pages.length);
	if ((sbook.paginate)&&(sbook.pageinfo)) {
	    if ((sbook.curpage<0)||(sbook.curpage>=sbook.pages.length)) {
		// If there isn't a valid page number, figure one out
		//  (if possible) and advance from there.
		var pagenum=sbook.getPage(fdjtDOM.viewTop());
		if ((pagenum>=0)&&(pagenum<(sbook.pages.length-2)))
		    sbook.FadeToPage(pagenum+1);}
	    else {
		var pagescroll=sbook.pagescroll;
		var info=sbook.pageinfo[sbook.curpage];
		// This is where the display bottom is
		var pagebottom=pagescroll+(fdjtDOM.viewHeight())-sbook.pageBottom();
		if (pagebottom<info.bottom)
		    // This handles oversize pages
		    sbook.FadeToPage(sbook.curpage,pagebottom);
		else if (sbook.curpage===sbook.pages.length) {}
		else sbook.FadeToPage(sbook.curpage+1);}
	    if (sbook.mode==='allglosses')
		sbook.UI.scrollGlosses(
		    sbook.curinfo.first,fdjtID("SBOOKALLGLOSSES"),true);}
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
	    if ((sbook.curpage<0)||(sbook.curpage>=sbook.pages.length)) {
		// If there isn't a valid page number, figure one out
		//  (if possible) and go back from there.
		var pagenum=sbook.getPage(fdjtDOM.viewTop());
		if ((pagenum<=(sbook.pages.length-1))&&(pagenum>0))
		    sbook.FadeToPage(pagenum-1);}
	    else {
		var pagescroll=sbook.pagescroll;
		var info=sbook.pageinfo[sbook.curpage];
		var pagetop=pagescroll+sbook.pageTop();
		if (pagetop>info.top)
		    // Move within oversize page
		    sbook.FadeToPage(sbook.curpage,pagetop-sbook.pageSize());
		else if (sbook.curpage===0) {}
		else {
		    sbook.FadeToPage(sbook.curpage-1);}}
	    if (sbook.mode==='allglosses')
		sbook.UI.scrollGlosses(
		    sbook.curinfo.first,fdjtID("SBOOKALLGLOSSES"),true);}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()-delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    sbook.pageBackward=pageBackward;

    /* Moving forward and backward in preview mode */

    function previewForward(){
	var start=sbook.previewelt;
	var slice=fdjtDOM.getParent(start,".sbookslice");
	var scan=fdjtDOM.forwardElt(start); var ref=false;
	while (scan) {
	    if (((scan.about)||
		 ((scan.getAttribute)&&(scan.getAttribute("about"))))&&
		((fdjtDOM.hasClass(scan,"sbooknote"))||
		 (fdjtDOM.hasClass(scan,"passage"))))
		break;
	    else scan=fdjtDOM.forwardElt(scan);}
	if (sbook.Trace.mode) 
	    fdjtLog("[%fs] previewForward() from %o to %o under %o",
		    fdjtET(),start,scan,slice);
	if (!(fdjtDOM.hasParent(scan,slice))) scan=false;
	var ref=((scan)&&(sbook.getRef(scan)));
	if ((ref)&&(scan)) sbook.Preview(ref,scan);
	else if (ref) sbook.Preview(ref);
	else sbook.Preview(false);
	if (scan) {} // scroll into view
	return scan;}
    sbook.previewForward=previewForward;
    function previewBackward(){
	var start=sbook.previewelt;
	var slice=fdjtDOM.getParent(start,".sbookslice");
	var scan=fdjtDOM.backwardElt(start); var ref=false;
	while (scan) {
	    if (((scan.about)||
		 ((scan.getAttribute)&&(scan.getAttribute("about"))))&&
		((fdjtDOM.hasClass(scan,"sbooknote"))||
		 (fdjtDOM.hasClass(scan,"passage"))))
		break;
	    else scan=fdjtDOM.backwardElt(scan);}
	if (sbook.Trace.mode) 
	    fdjtLog("[%fs] previewBackward() from %o to %o under %o",
		    fdjtET(),start,scan,slice);
	if (!(fdjtDOM.hasParent(scan,slice))) scan=false;
	var ref=((scan)&&(sbook.getRef(scan)));
	if ((ref)&&(scan)) sbook.Preview(ref,scan);
	else if (ref) sbook.Preview(ref);
	else sbook.Preview(false);
	if (scan) {} // scroll into view
	return scan;}
    sbook.previewBackward=previewBackward;

    /* Rules */
    
    sbook.UI.handlers.mouse=
      {window: {keyup:onkeyup,keydown:onkeydown,keypress:onkeypress},
       hud: {mousedown:hud_mousedown,mouseup:hud_mouseup,
	     mousemove:mousemove},
       body: {mousedown:body_mousedown,mouseup:body_mouseup,
	      mousemove:mousemove},
       glossmark: {click: glossmark_onclick},
       "#SBOOKPAGERIGHT": {click: Forward},
       "#SBOOKPAGELEFT": {click: Backward},
       ".hudbutton": {mouseover:hudbutton,
		      mouseout:hudbutton},
       ".sbookmargin": {click:body_onclick}};
    
    // A mouse pretending to be a touch screen
    sbook.UI.handlers.faketouch=
	{window: {keyup:onkeyup,keydown:onkeydown,keypress:onkeypress},
	 body: {mousedown: body_touchstart,mouseup: body_touchend,
		mousemove: touchmove},
	 hud: {mousedown: hud_touchstart,mouseup: hud_touchend,
	       mousemove: touchmove},
	 ".sbookmargin": {click: body_onclick},
	 glossmark: {}};

    sbook.UI.handlers.ios=
	{window: {keyup:onkeyup,keydown:onkeydown,keypress:onkeypress},
	 body: {touchstart: body_touchstart,touchend: body_touchend,
		touchmove: touchmove},
	 hud: {touchstart: hud_touchstart,touchend: hud_touchend,
	       touchmove: touchmove},
	 ".sbookmargin": {touchstart: body_touchstart,touchend: body_touchend,
			  touchmove: touchmove},
	 ".hudbutton": {touchstart: dont,touchmove: dont, touchend: dont},
	 "#SBOOKTABS": {touchstart: dont,touchmove: dont, touchend: dont},
	 glossmark: {}};

    sbook.UI.handlers.oneclick=
	{window: {mouseup: body_onclick,
		  "keyup":onkeyup,"keydown":onkeydown,"keypress":onkeypress},
	 hud: {click:hud_onclick,
	       mouseover:fdjtUI.CoHi.onmouseover,
	       mouseout:fdjtUI.CoHi.onmouseout}};

})();

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

