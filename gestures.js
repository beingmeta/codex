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

	/* Setup for gesture handling */

	var hudbuttons=
	    ["SBOOKTOCBUTTON","SBOOKDASHBUTTON","SBOOKSEARCHBUTTON",
	     "SBOOKALLGLOSSESBUTTON"];

	function addHandlers(node,type){
	    var mode=sbook.ui;
	    fdjtDOM.addListeners(node,sbookUI.handlers[mode][type]);}
	sbookUI.addHandlers=addHandlers;

	function setupGestures(){
	    // Unavoidable browser sniffing
	    if (sbook.mobilesafari) mobileSafariGestures();
	    var mode=sbook.ui;
	    if (!(mode)) sbook.ui=mode="mouse";
	    addHandlers(false,'window');
	    addHandlers(document.body,'body');
	    addHandlers(sbook.HUD,'hud');
	    addHandlers(hudbuttons,'hudbutton');}
	sbook.setupGestures=setupGestures;

	function mobileSafariGestures(){
	    window.onscroll=function(evt){sbook.syncHUD();};}

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

	/* Clicking on the body:

	 * when in preview:
	    ** if you've clicked on the preview target, go there,
	    ** otherwise leave preview
	 * when the HUD is up:
	    ** if the click target is the sbook target, toggle the mark HUD,
	    ** if there's a content target, make it the sbook target and
	          bring the HUD up, while
	    **  otherwise, toggle the HUD

	 Note that the HUD usually cancels events before they get here.
	*/
	function onclick(evt){
	    var target=fdjtUI.T(evt);
	    mousedown=false;
	    if (sbook.Trace.gestures) {
		fdjtLog(
		    "[%f] onclick() %o cl=%o ui=%o sbt=%o",
		    fdjtET(),evt,fdjtDOM.isClickable(target),inUI(target),
		    sbook.target);
		fdjtLog("[%f] onclick()  sbp=%o sh=%o sm=%o sbph=%o hp=%o @<%o,%o>",
			fdjtET(),sbook.preview,
			sbook.hudup,sbook.mode,sbook.preview_hold,
			(fdjtDOM.hasParent(target,sbook.preview)),
			evt.clientX,evt.clientY);}
	    /* These are all cases where this method doesn't apply */
	    if (!(target)) return;
	    else if (fdjtDOM.isClickable(target)) return;
	    else if (inUI(target)) return;
	    /* In preview mode, either go to the target (and drop the HUD)
	       or toggle out of preview mode and back to the HUD. */
	    else if (sbook.preview) {
		if (fdjtDOM.hasParent(target,sbook.preview)) {
		    var goto=sbook.preview;
		    sbook.Preview(false);
		    sbookMode(false);
		    sbook.GoTo(goto);}
		else if (sbook.preview_hold) sbook.Preview(false);
		else {}}
	    /* If you're clicking on the current target, toggle the mark HUD */
	    else if ((sbook.hudup)&&(sbook.target)&&
		     (fdjtDOM.hasParent(target,sbook.target))&&
		     (!(sbook.mode==="mark"))) {
		var target=sbook.getTarget(evt)
		var selection=window.getSelection();
		var excerpt=fdjtString.stdspace(selection.toString());
		sbookMark(target,false,excerpt);
		sbook.GoToPage(sbook_curpage);
		fdjtID("SBOOKMARKINPUT").focus();}
	    /* Otherwise, if there's no content target, just toggle the HUD */
	    else if (!(sbook.getTarget(target)))
		if (sbook.hudup) sbookMode(false); else sbookMode(true);
	    else {
		sbook.setTarget(sbook.getTarget(target),true);
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
	    var target=fdjtUI.T(evt);
	    if (target===sbook.HUD) sbookMode(false);}
	sbookUI.hud_onclick=hud_onclick;
	
	function ondblclick(evt){
	    sbookMark(sbook.getTarget(evt));}

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
	    else if (kc===32) sbook.Forward(); // Space
	    // backspace or delete
	    else if ((kc===8)||(kc===45)) sbook.Backward();
	    // Home goes to the current head.
	    else if (kc===36) sbook.GoTo(sbook.head);
	    else return;}
	sbookUI.handlers.onkeydown=onkeydown;

	// At one point, we had the shift key temporarily raise/lower the HUD.
	//  We might do it again, so we keep this definition around
	function onkeyup(evt){
	    evt=evt||event||null;
	    var kc=evt.keyCode;
	    // sbook.trace("sbook_onkeyup",evt);
	    if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	    else if ((evt.ctrlKey)||(evt.altKey)||(evt.metaKey)) return true;
	    else {}}
	sbookUI.handlers.onkeyup=onkeyup;

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
	sbookUI.handlers.onkeypress=onkeypress;

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

	/* Previews provide content glimpses from the HUD */

	// Should these be localized somehow for multitouch?
	var preview_hold=false;
	var preview_timer=false;
	function preview_down(evt){
	    evt=evt||event;
	    var target=fdjtUI.T(evt);
	    var ref=sbook.getRef(target);
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] preview_down() %o pt=%o sbp=%o ph=%o, ref=%o",
			fdjtET(),evt,preview_timer,sbook.preview,preview_hold,ref);
	    if ((evt)&&(evt.touches)) {
		if (evt.touches.length>1) return;}
	    fdjtUI.cancel(evt);
	    // Always toggle off preview mode if it's on
	    if (sbook.preview) {
	      sbook.preview_hold=preview_hold=false;
	      sbook.Preview(false);
	      return;}
	    else if (ref) {
		sbook.preview_hold=preview_hold=false;
		sbook.Preview(ref);
		preview_timer=setTimeout(function(){
		    sbook.preview_hold=preview_hold=true;},500);}}
	function preview_up(evt){
	    evt=evt||event;
	    if ((evt)&&(evt.touches)&&(evt.touches.length>1)) return;
	    fdjtUI.cancel(evt);
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] preview_up() %o pt=%o sbp=%o ph=%o",
			fdjtET(),evt,preview_timer,sbook.preview,preview_hold);
	    // If the timer is still there, it's a click
	    if (preview_timer) {
		clearTimeout(preview_timer);
		preview_timer=false;}
	    // If you were hodling it
	    if ((sbook.preview)&&(preview_hold)) sbook.Preview(false);}
	function preview_onclick(evt){
	    fdjtUI.cancel(evt);
	    var target=fdjtUI.T(evt);
	    var ref=sbook.getRef(target);
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] preview_onclick() %o pt=%o sbp=%o ph=%o, ref=%o",
			fdjtET(),evt,sbook.preview,ref);
	    if (ref) sbook.Preview(ref);}

	/* TOC handlers */

	var cohi_onmouseover=fdjtUI.CoHi.onmouseover;
	var cohi_onmouseout=fdjtUI.CoHi.onmouseout;
	// Should these be localized for multitouch?
	var toc_preview_timer=false;
	var toc_preview_hold=false;
	
	function toc_onmouseover(evt){
	    evt=evt||event;
	    fdjtUI.cancel(evt);
	    cohi_onmouseover(evt);
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] toc_onmouseover() %o pt=%o sbp=%o tph=%o",
			fdjtET(),evt,toc_preview_timer,
			sbook.preview,preview_hold);
	    var target=fdjtDOM.T(evt);
	    // Spanbars in TOCs automatically generate previews on mouseover
	    if ((evt.button)||(fdjtDOM.hasParent(target,'.spanbar'))) {
		var ref=sbook.getRef(target);
		if (ref) {
		    if (toc_preview_timer) {
		      clearTimeout(toc_preview_timer);
		      toc_preview_timer=false;}
		    sbook.Preview(ref);}}}
	function toc_onmouseout(evt){
	    evt=evt||event;
	    fdjtUI.cancel(evt);
	    cohi_onmouseover(evt);
	    if (sbook.Trace.gestures)
	      fdjtLog("[%f] toc_onmouseout() %o tpt=%o sbp=%o ph=%o",
		      fdjtET(),evt,toc_preview_timer,
		      sbook.preview,preview_hold);
	    var target=fdjtDOM.T(evt);
	    // Spanbars in TOCs automatically generate previews on mouseover
	    if (sbook.preview) {
	      var ref=sbook.getRef(target);
	      if ((ref)&&(sbook.preview)&&(sbook.preview===ref))
		if (toc_preview_timer) {
		  clearTimeout(toc_preview_timer);
		  toc_preview_timer=false;}
	      toc_preview_timer=
		setTimeout(function(){sbook.Preview(false);},500);}}
	function toc_onmousedown(evt){
	  evt=evt||event;
	  if (sbook.Trace.gestures)
	    fdjtLog("[%f] toc_onmousedown() %o tpt=%o sbp=%o ph=%o",
		    fdjtET(),evt,toc_preview_timer,sbook.preview,preview_hold);
	  var target=fdjtDOM.T(evt);
	  // Spanbars in TOCs automatically generate previews on mouseover
	  if (!(fdjtDOM.hasParent(target,'.spanbar'))) preview_down(evt);}
	function toc_onmouseup(evt){
	  evt=evt||event;
	  if (sbook.Trace.gestures)
	    fdjtLog("[%f] toc_onmouseup() %o pt=%o sbp=%o ph=%o",
		    fdjtET(),evt,preview_timer,sbook.preview,preview_hold);
	  var target=fdjtDOM.T(evt);
	  // Spanbars in TOCs automatically generate previews on mouseover
	  if (!(fdjtDOM.hasParent(target,'.spanbar')))
	    if (sbook.preview) sbook.Preview(false);}
	
	// The generic mouseup handles stopping preview
	function toc_onclick(evt){
	  var keeptoc=(sbook.mode==='toc');
	  var target=fdjtUI.T(evt);
	  var ref=sbook.getRef(target);
	  if (sbook.Trace.gestures)
	    fdjtLog("[%f] toc_onmouseup() %o pt=%o sbp=%o ph=%o ref=%o",
		    fdjtET(),evt,preview_timer,sbook.preview,preview_hold,ref);
	  if ((ref)&&(!(preview_hold))) {
	    if (keeptoc) {
	      var info=sbook.Info(ref); var sub=info.sub;
	      if ((!(sub))||(sub.length<3)) keeptoc=false;}
	    if (keeptoc) sbook.setHead(ref);
	    else sbook.GoTo(ref);}
	  preview_hold=false;
	  fdjtUI.cancel(evt);}
	
	/* Summary handlers */

	/* Rules */

	sbookUI.handlers.mouse=
	  {window: {"mouseup": onclick,"dblclick": ondblclick,
		    "keyup":onkeyup,"keydown":onkeydown,"keypress":onkeypress},
	   hud: {},
	   hudbutton: {"mouseover":hudbutton,
		       "mouseout":hudbutton},
	   toc: {title:"click to jump, hold to preview",
		 mouseover: toc_onmouseover,mouseout: toc_onmouseout,
		 mousedown: toc_onmousedown,mouseup: toc_onmouseup,
		 click: toc_onclick},
	   summary: {title: "hold or click to glimpse",
		     mousedown: preview_down,
		     mouseup: preview_up,
		     click: fdjtUI.cancel}};
	
	function ios_dontscroll(evt){
	    if ((evt.touches)&&(evt.touches.length===1)) fdjtUI.cancel(evt);}
	
	sbookUI.handlers.ios=
	    {window: {touchend: onclick,touchmove: ios_dontscroll,
		      keyup:onkeyup,keydown:onkeydown,keypress:onkeypress},
	     body: {},
	     hud: {},
	     hudbutton: {},
	     toc: {title:"click to glimpse",
		   click: preview_onclick},
	     summary: {title: "click to glimpse",
		       click: preview_onclick}};
	sbookUI.handlers.mouse=
	    {window: {click: onclick,
		      keyup:onkeyup,keydown:onkeydown,keypress:onkeypress},
	     hud: {onclick:hud_onclick},
	     hudbutton: {},
	     toc: {title:"click to jump, hold to preview",
		   click: preview_down,
		   // mouseover: toc_onmouseover,mouseout: toc_onmouseout,
		   // mousedown: toc_onmousedown,mouseup: toc_onmouseup,
		   click: toc_onclick},
	     summary: {title: "hold or click to glimpse",
		       click: preview_onclick}};
	
	sbookUI.handlers.oneclick=
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
	sbook.Backward=sbookBackward;

	return sbookUI;})();

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

