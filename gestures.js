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

var sbookUI=
    (function(){

	var sbook_mousedown=false;
	var sbook_hold_threshold=750;
	var default_hud_flash=3000;

	/* click events */

	function inUI(node){
	    while (node)
		if (!(node)) return false;
	    else if (node.sbookui) return true;
	    else node=node.parentNode;
	    return false;}

	/* Top level functions */

	function sbookUI(mode){}
	sbookUI.handlers={};
	sbookUI.holdThreshold=sbook_hold_threshold;
	sbookUI.hudFlash=default_hud_flash;

	function sparseMode(flag){
	    if (flag) {
		sbook_sparse=true;
		fdjtUI.CheckSpan.set(fdjtID("SBOOKSPARSE"),true,true);
		fdjtDOM.addClass(document.body,"spartan");}
	    else {
		sbook_sparse=false;
		fdjtUI.CheckSpan.set(fdjtID("SBOOKSPARSE"),false,true);
		fdjtDOM.dropClass(document.body,"spartan");}}
	sbookUI.Sparse=sparseMode;

	function flashMode(flag){
	    if (flag) {
		fdjtUI.CheckSpan.set(fdjtID("SBOOKHUDFLASH"),true,true);
		sbook_hud_flash=default_hud_flash;}
	    else {
		fdjtUI.CheckSpan.set(fdjtID("SBOOKHUDFLASH"),false,true);
		sbook_hud_flash=false;}}
	sbookUI.Flash=flashMode;

	/* Mouse handlers */
	
	var mousedown=false;

	/* Clicking on the body */
	function onclick(evt){
	    var target=fdjtUI.T(evt);
	    mousedown=false;
	    if (sbook.Trace.gestures)
		fdjtLog(
		    "[%f] onclick %o cl=%o ui=%o sbt=%o sbp=%o sh=%o sm=%o hp=%o @<%o,%o>",
		    fdjtET(),evt,fdjtDOM.isClickable(target),inUI(target),
		    sbook.target,sbook.preview,
		    sbook.hudup,sbook.mode,
		    (fdjtDOM.hasParent(target,sbook.target)),
		    evt.clientX,evt.clientY);
	    if (!(target)) return;
	    else if (fdjtDOM.isClickable(target)) return;
	    else if (inUI(target)) return;
	    else if (sbook.preview) {
		if (fdjtDOM.hasParent(target,sbook.preview)) {
		    sbook.Preview(false); sbookMode(false);
		    sbook.GoTo(target);}
		else sbook.Preview(false);}
	    else if ((sbook.hudup)&&(sbook.target)&&
		     (fdjtDOM.hasParent(target,sbook.target))&&
		     (!(sbook.mode==="mark"))) {
		var target=sbook.getTarget(evt)
		var selection=window.getSelection();
		var excerpt=fdjtString.stdspace(selection.toString());
		sbookMark(target,false,excerpt);
		sbook.GoToPage(sbook_curpage);}
	    else if (!(sbook.getTarget(target)))
		sbookMode(false);
	    else {
		sbook.setTarget(sbook.getTarget(target));
		sbookMode(true);}}
	/* This does paging forward and backwards */
	sbookUI.margin_onclick=function(evt) {
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
	    fdjtUI.cancel(evt);};
	function hud_onclick(evt){
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] hud_onclick %o",fdjtET(),evt);
	    if (fdjtDOM.isClickable(fdjtUI.T(evt))) return;
	    sbookMode(false);}
	sbookUI.hud_onclick=hud_onclick;
	
	function ondblclick(evt){
	    sbookMark(sbook.getTarget(evt));}

	/* Touch handlers */

	// Touch start on a reference starts a timer to preview
	//   the reference
	// Touch end on a reference either jumps (if the timer is still running)
	//  or stops preview

	/* Keyboard handlers */

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
	    else if (kc===33) sbook.Backward();  /* Page Up */
	    else if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	    else if (kc===32) sbook.Forward(); // Space
	    else if ((kc===8)||(kc===45)) sbook.Backward(); // backspace or delete
	    else if (kc===36)  
		// Home goes to the current head.
		sbook.GoTo(sbook.head);
	    else return;}
	sbookUI.handlers.onkeydown=onkeydown;

	function onkeyup(evt){
	    evt=evt||event||null;
	    var kc=evt.keyCode;
	    // sbook.trace("sbook_onkeyup",evt);
	    if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	    else if ((evt.ctrlKey)||(evt.altKey)||(evt.metaKey)) return true;
	    else {}}
	sbookUI.handlers.onkeyup=onkeyup;

	/* Keypress handling */

	var modechars={
	    43: "mark",13: "mark",
	    63: "searching",102: "searching",
	    83: "searching",115: "searching",
	    70: "searching",
	    100: "device",68: "device",
	    110: "toc",78: "toc",
	    116: "dashtoc",84: "dashtoc",
	    104: "help",72: "help",
	    103: "allglosses",71: "allglosses",
	    67: "console", 99: "console",
	    76: "layers", 108: "layers"};

	function onkeypress(evt){
	    var modearg=false; 
	    evt=evt||event||null;
	    var ch=evt.charCode||evt.keyCode;
	    // sbook.trace("sbook_onkeypress",evt);
	    if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	    else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
	    else if ((ch===65)||(ch===97)) /* A */
		modearg=sbook.last_dash||"help";
	    else modearg=modechars[ch];
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
	sbookUI.handlers.onkeypress=onkeypress;

	/* Setup */

	var hudbuttons=
	    ["SBOOKTOCBUTTON","SBOOKDASHBUTTON","SBOOKSEARCHBUTTON",
	     "SBOOKALLGLOSSESBUTTON"];

	sbookUI.getMode=function(){
	  return ((sbook.touch)?("touch"):
		  (sbook.mouse)?("mouse"):
		  (sbook.kbd)?("keyboard"):
		  (sbook.oneclick)?("oneclick"):
		  ("mouse"));}
	function addHandlers(node,type){
	  var mode=sbookUI.getMode();
	  fdjtDOM.addListeners(node,sbookUI.handlers[mode][type]);}
	sbookUI.addHandlers=addHandlers;

	function setupGestures(){
	    // Unavoidable browser sniffing
	  if (sbook.mobilesafari) mobileSafariGestures();
	  var mode=sbookUI.getMode();
	  addHandlers(false,'window');
	  addHandlers(sbook.HUD,'hud');
	  addHandlers(hudbuttons,'hudbutton');}
	sbook.setupGestures=setupGestures;

	function mobileSafariGestures(){
	    window.onscroll=function(evt){sbook.syncHUD();};}

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
	sbookUI.hudbutton=hudbutton;

	/* Preview support */

	var cohi_onmouseover=fdjtUI.CoHi.onmouseover;
	var cohi_onmouseout=fdjtUI.CoHi.onmouseout;

	var stopping_preview=false;
	function start_preview(evt){
	  var target=fdjtDOM.T(evt);
	  var ref=sbook.getRef(target);
	  if (!(ref)) return;
	  if (stopping_preview) {
	    clearTimeout(stopping_preview);
	    stopping_preview=false;}
	  if (ref===sbook.preview) {}
	  else if (ref) sbook.Preview(ref,true);
	  fdjtUI.cancel(evt);}
	function stop_preview(evt){
	  if (stopping_preview) return false;
	  var target=fdjtDOM.T(evt);
	  var ref=sbook.getRef(target);
	  sbook.Preview(false,true);}

	/* TOC handlers */

	function toc_onmouseover(evt){
	  evt=evt||event;
	  var target=fdjtDOM.T(evt);
	  // Spanbars in TOCs automatically generate previews on mouseover
	  if (fdjtDOM.hasParent(target,'.spanbar'))
	    start_preview(evt);
	  else if (evt.button)
	    start_preview(evt);
	  else {}}
	function toc_onmouseout(evt){
	  evt=evt||event;
	  var target=fdjtDOM.T(evt);
	  if (fdjtDOM.hasParent(target,'.spanbar'))
	    stop_preview(evt);}
	function toc_onmousedown(evt){
	  evt=evt||event;
	  var target=fdjtDOM.T(evt);
	  if (fdjtDOM.hasParent(target,'.spanbar')) return;
	  mousedown=fdjtTime();
	  start_preview(evt);}
	// The generic mouseup handles stopping preview
	function toc_onclick(evt){
	  fdjtLog("onclick now=%o md=%o sp=%o",
		  mousedown,sbook.preview,fdjtTime());
	  if ((sbook.preview)&&(mousedown)) {
	    var duration=fdjtTime()-mousedown;
	    if (duration>1000) {
	      mousedown=false; return;}}
	  mousedown=false;
	  evt=evt||event;
	  var ref=sbook.getRef(evt);
	  if (ref) sbook.GoTo(ref);}

	/* Summary handlers */

	function summary_onmousedown(evt){
	  evt=evt||event;
	  mousedown=fdjtTime();
	  var target=fdjtDOM.T(evt);
	  start_preview(evt);}
	function summary_onmouseover(evt){
	  if (!(sbook.preview)) return;
	  evt=evt||event;
	  var ref=sbook.getRef(evt);
	  if (ref===sbook.preview) {}
	  else if (ref) sbook.Preview(ref,true);}
	function summary_onclick(evt){
	  evt=evt||event;
	  if (mousedown) {
	    var duration=fdjtTime()-mousedown;
	    if (duration>1000) {
	      mousedown=false; return;}}
	  mousedown=false;
	  var ref=sbook.getRef(evt);
	  if (ref) sbook.GoTo(ref);
	  fdjtUI.cancel(evt);}

	/* Rules */

	sbookUI.handlers.mouse=
	  {window: {"mouseup": onclick,"dblclick": ondblclick,
		    "keyup":onkeyup,"keydown":onkeydown,"keypress":onkeypress},
	   hud: {"click":hud_onclick},
	   hudbutton: {"mouseover":hudbutton,
		       "mouseout":hudbutton},
	   toc: {mouseover: toc_onmouseover,mouseout: toc_onmouseout,
		 mousedown: toc_onmousedown,onclick: toc_onclick},
	   summary: {title: "hold to glimpse, click to go",
		     mouseover: summary_onmouseover,
		     mousedown: summary_onmousedown,
		     click: summary_onclick}};
	
	sbookUI.handlers.oneclick=
	  {window: {"mouseup": onclick,"dblclick": ondblclick,
		    "keyup":onkeyup,"keydown":onkeydown,"keypress":onkeypress},
	   hud: {"click":hud_onclick,
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
	sbook.Backward=sbookBackward;

	return sbookUI;})();

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

