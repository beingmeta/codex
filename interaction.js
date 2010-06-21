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

    var sbook_mousedown=false;
    var sbook_hold_threshold=750;
    var default_hud_flash=3000;

    /* Setup for gesture handling */

    var hudbuttons=
	["SBOOKTOCBUTTON","SBOOKDASHBUTTON","SBOOKSEARCHBUTTON",
	 "SBOOKALLGLOSSESBUTTON"];

    function addHandlers(node,type){
	var mode=sbook.ui;
	fdjtDOM.addListeners(node,sbook.UI.handlers[mode][type]);}
    sbook.UI.addHandlers=addHandlers;

    function setupGestures(){
	// Unavoidable browser sniffing
	if (sbook.mobilesafari) mobileSafariGestures();
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

    function mobileSafariGestures(){
	window.onscroll=function(evt){sbook.syncHUD();};}

    /* New simpler UI */

    function inUI(node){
	while (node)
	    if (!(node)) return false;
	else if (node.sbookui) return true;
	else node=node.parentNode;
	return false;}

    function body_onclick(evt){
	var target=fdjtUI.T(evt);
	if (sbook.Trace.gestures) 
	    fdjtLog("[%f] body_onclick() %o ui=%o cl=%o sbp=%o sbh=%o mode=%o",
		    fdjtET(),evt,(inUI(target)),(fdjtDOM.isClickable(target)),
		    sbook.preview,sbook.hudup,sbookMode());
	if (fdjtDOM.isClickable(target)) return;
	else if (inUI(target)) return;
	/* Three cases: preview, hudup, and plain */
	else if (sbook.preview) {
	    if (fdjtDOM.hasParent(target,sbook.preview)) 
		sbook.GoTo(sbook.preview);
	    else sbook.Preview(false);}
	else if (sbook.hudup) sbookMode(false);
	else {
	    var glosstarget=sbook.getTarget(target);
	    if (glosstarget) sbookMark(glosstarget);
	    else sbookMode(true);}}
    
    function hud_onclick(evt){
	var target=fdjtUI.T(evt);
	if (sbook.Trace.gestures) 
	  fdjtLog("[%f] hid_onclick() %o cl=%o sbp=%o sbh=%o mode=%o",
		  fdjtET(),evt,(fdjtDOM.isClickable(target)),
		  sbook.preview,sbook.hudup,sbookMode());
	if (fdjtDOM.isClickable(target)) return;
	else fdjtUI.cancel(evt);
	var ref=sbook.getRef(target);
	if (ref) sbook.Preview(ref,sbook.getRefElt(target));}
    
    function margin_onclick(evt){
	var left=fdjtDOM.viewLeft();
	var width=fdjtDOM.viewWidth();
	var leftwidth=fdjtDOM.getGeometry("SBOOKPAGELEFT").width;
	var rightwidth=fdjtDOM.getGeometry("SBOOKPAGERIGHT").width;
	if (sbook.preview) sbook.Preview(false);
	else if ((sbook.edgeclick)&&((evt.clientX-left)<leftwidth))
	    sbookBackward();
	else if ((sbook.edgeclick)&&(((left+width)-evt.clientX)<rightwidth))
	    sbookForward();
	else if ((sbook.mode)||(sbook.hudup)) sbookMode(false);
	else sbookMode(true);
	fdjtUI.cancel(evt);}

    /* This does paging forward and backwards */
    sbook.UI.margin_onclick=margin_onclick;
    
    /* Browsing by refs */

    var hasClass=fdjtDOM.hasClass;
    function previewForward(){
      var start=sbook.previewelt;
      var scan=fdjtDOM.forwardElt(start); var ref=false;
      while (scan) {
	if ((scan.sbook_ref)&&(fdjtDOM.hasClass(scan,"summary")))
	  break;
	else scan=fdjtDOM.forwardElt(scan);}
      if (sbook.Trace.preview) 
	fdjtLog("[%f] previewForward() from %o to %o",fdjtET(),start,scan);
      var ref=((scan)&&(sbook.getRef(scan)));
      if ((ref)&&(scan)) sbook.Preview(ref,scan);
      else if (ref) sbook.Preview(ref);
      else sbook.Preview(false);
      if (scan) {} // scroll into view
      return scan;}
    function previewBackward(){
      var start=sbook.previewelt;
      var scan=fdjtDOM.backwardElt(start); var ref=false;
      while (scan) {
	if ((scan.sbook_ref)&&(fdjtDOM.hasClass(scan,"summary")))
	  break;
	else scan=fdjtDOM.backwardElt(scan);}
      if (sbook.Trace.preview) 
	fdjtLog("[%f] previewBackward() from %o to %o",fdjtET(),start,scan);
      var ref=((scan)&&(sbook.getRef(scan)));
      if ((ref)&&(scan)) sbook.Preview(ref,scan);
      else if (ref) sbook.Preview(ref);
      else sbook.Preview(false);
      if (scan) {} // scroll into view
      return scan;}

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
	else if (kc===36) sbook.GoTo(sbook.head);
	else return;}
    sbook.UI.handlers.onkeydown=onkeydown;

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

    /* Rules */
    
    sbook.UI.handlers.mouse=
	{window: {"mouseup": body_onclick,"keyup":onkeyup,"keydown":onkeydown,"keypress":onkeypress},
	 ".sbookmargin": {click: margin_onclick},
	 hud: {click:hud_onclick},
	 hudbutton: {"mouseover":hudbutton,"mouseout":hudbutton},
	 toc: {},
	 summary: {}};
    
    function ios_dontscroll(evt){
	if ((evt.touches)&&(evt.touches.length===1)) fdjtUI.cancel(evt);}
    
    sbook.UI.handlers.ios=
	{window: {touchend: body_onclick,touchmove: ios_dontscroll,
		  keyup:onkeyup,keydown:onkeydown,keypress:onkeypress},
	 body: {},
	 hud: {},
	 hudbutton: {},
	 toc: {},
	 summary: {}};
    
    sbook.UI.handlers.oneclick=
	{window: {"mouseup": onclick,"dblclick": ondblclick,
		  "keyup":onkeyup,"keydown":onkeydown,"keypress":onkeypress},
	 hud: {//"click":hud_onclick,
	     "mouseover":fdjtUI.CoHi.onmouseover,
	     "mouseout":fdjtUI.CoHi.onmouseout}};

    /* Other stuff */

    function sbookForward(){
	if (sbook.paginate) {
	    var goto=-1;
	    if ((sbook_curpage<0)||(sbook_curpage>=sbook_pages.length)) {
		var pagenum=sbookGetPage(fdjtDOM.viewTop());
		if (pagenum<(sbook_pages.length-1)) sbook_curpage=pagenum+1;
		sbook.GoToPage(sbook_curpage);}
	    else {
		// Synchronize if neccessary
		if (sbook_pagescroll!==fdjtDOM.viewTop())
		    sbook.GoToPage(sbook_curpage,sbook_curoff);
		var info=sbook_pageinfo[sbook_curpage];
		var pagebottom=fdjtDOM.viewTop()+(fdjtDOM.viewHeight());
		if (pagebottom<info.bottom)
		    sbook.GoToPage(sbook_curpage,pagebottom-info.top);
		else if (sbook_curpage===sbook_pages.length) {}
		else {
		    sbook_curpage++;
		    sbook.GoToPage(sbook_curpage);
		    if ((sbook_curinfo.focus)&&(sbook_curinfo.focus.id))
			sbook.setHashID(sbook_curinfo.focus);}}}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()+delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    sbook.Forward=sbookForward;

    function sbookBackward(){
	if (sbook.paginate) {
	    var goto=-1;
	    if ((sbook_curpage<0)||(sbook_curpage>=sbook_pages.length)) {
		var pagenum=sbook.getPage(fdjtDOM.viewTop());
		if (pagenum<(sbook_pages.length-1)) sbook_curpage=pagenum+1;
		sbook.GoToPage(sbook_curpage);}
	    else {
		// Synchronize if neccessary
		if (sbook_pagescroll!==fdjtDOM.viewTop())
		    sbook.GoToPage(sbook_curpage,sbook_curoff);
		var info=sbook_pageinfo[sbook_curpage];
		var pagetop=fdjtDOM.viewTop()+sbook_top_px;
		if (pagetop>info.top)
		    sbook.GoToPage(sbook_curpage,(info.top-pagetop)-sbook.pagesize);
		else if (sbook_curpage===0) {}
		else {
		    sbook_curpage--;
		    sbook.GoToPage(sbook_curpage);
		    if (sbook_curinfo.focus) sbook.setHashID(sbook_curinfo.focus);}}}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()-delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    sbook.Backward=sbookBackward;})();

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

