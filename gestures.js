/* -*- Mode: Javascript; -*- */

var sbooks_gestures_id="$Id$";
var sbooks_gestures_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knowlets, visit www.knowlets.net
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
	var sbook_hold_threshold=900;
	var default_hud_flash=3000;

	/* click events */

	function inUI(node){
	    while (node)
		if (!(node)) return false;
	    else if (node.sbookui) return true;
	    else node=node.parentNode;
	    return false;}

	/* Top level functions */

	function sbookUI(mode){
	    if (mode==='touch') {
		sbook_interaction=mode;
		fdjtUI.CheckSpan.set(fdjtID("SBOOKTOUCHMODE"),true,true);
		fdjtDOM.addClass(document.body,"touch");
		sbookPaginate();}
	    else if (mode==='mouse') {
		sbook_interaction=mode;
		fdjtUI.CheckSpan.set(fdjtID("SBOOKMOUSEMODE"),true,true);
		fdjtDOM.dropClass(document.body,"touch");
		sbookPaginate();}
	    else if (mode==='keyboard') {
		sbook_interaction=mode;
		fdjtUI.CheckSpan.set(fdjtID("SBOOKKBDMODE"),true,true);
		fdjtDOM.dropClass(document.body,"touch");
		sbookPaginate();}
	    else {
		sbook_interaction=false;
		fdjtDOM.dropClass(document.body,"touch");}}
	sbookUI.handlers={};
	sbookUI.holdThreshold=sbook_hold_threshold;
	sbookUI.hudFlash=default_hud_flash;

	function sparseMode(flag){
	    if (flag) {
		sbook_sparse=true;
		fdjtUI.CheckSpan.set(fdjtID("SBOOKSPARSE"),true,true);
		fdjtDOM.addClass(document.body,"sparsebook");}
	    else {
		sbook_sparse=false;
		fdjtUI.CheckSpan.set(fdjtID("SBOOKSPARSE"),false,true);
		fdjtDOM.dropClass(document.body,"sparsebook");}}
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
	
	function body_onclick(evt){
	    evt=evt||event;
	    var target=fdjtDOM.T(evt);
	    if (fdjtDOM.isClickable(target)) return;
	    else if (inUI(target)) return;
	    else if (sbook.preview) {
		sbook.Preview(false); sbookMode(false);
		sbook.GoTo(target);}
	    else if ((sbook.mode)&&(sbook.mode!=="context"))
		sbookMode(false);
	    else if (sbook.target)
		if ((target===sbook.target)||
		    (fdjtDOM.hasParent(target,sbook.target)))
		    sbookMark(sbook.target);
	    else sbook.setTarget(sbook.getTarget(target));
	    else sbook.setTarget(sbook.getTarget(target));
	    if (sbook.Setup.notfixed) sbookSyncHUD();
	    fdjtDOM.cancel(evt);}
	sbookUI.handlers.bodyclick=body_onclick


	function onmouseup(evt){
	    var target=fdjtDOM.T(evt);
	    if (sbook.preview) sbook.Preview(false);
	    sbook_mousedown=false;}
	sbookUI.handlers.onmouseup=onmouseup

	function ignoreclick(evt){
	    var target=fdjtDOM.T(evt);
	    if (fdjtDOM.isClickable(target)) return;
	    else fdjtDOM.cancel(evt);}
	sbookUI.handlers.ignoreclick=ignoreclick

	/* Touch handlers */

	function ontouchstart(evt){
	    var target=fdjtDOM.T(evt);
	    var ref=sbook.getRef(target);
	    if (ref) {
		if (sbook.preview)
		    if (ref===sbook.preview) sbook.Preview(false);
		else sbook.Preview(ref);
		else  sbook.Preview(ref,true);
		fdjtDOM.cancel(evt);}}
	sbookUI.handlers.ontouchstart=ontouchstart;

	function ontouchmove(evt){
	    var target=fdjtDOM.T(evt);
	    var ref=sbook.getRef(target);
	    if (ref) {
		if (sbook.preview)
		    if (ref===sbook.preview) {}
		else sbook.Preview(ref);
		fdjtDOM.cancel(evt);}}
	sbookUI.handlers.ontouchmove=ontouchmove;

	function ontouchend(evt){
	    var target=fdjtDOM.T(evt);
	    var ref=sbook.getRef(target);
	    if (sbook.preview) sbookStopPreview();
	    fdjtDOM.cancel(evt);}
	sbookUI.handlers.ontouchend=ontouchend;


	/* Keyboard handlers */

	function onkeydown(evt){
	    evt=evt||event||null;
	    var kc=evt.keyCode;
	    // sbook.trace("sbook_onkeydown",evt);
	    if (evt.keyCode===27) { /* Escape works anywhere */
		if (sbook.mode) {
		    sbook.last_mode=mode;
		    fdjtDOM.dropClass(document.body,"hudup");
		    sbookMode(false);
		    sbook.Preview(false);
		    sbook.setTarget(false);
		    fdjtID("SBOOKSEARCHTEXT").blur();}
		else if (sbook.last_mode) sbookMode(sbook.last_mode);
		else {
		    if ((sbook_mark_target)&&(fdjtDOM.isVisible(sbook_mark_target)))
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
	    /*
	      else if (((!(sbook.mode))||(sbook.mode==="context"))&&
	      ((ch===112)||(ch===80)))
	      if (sbook.pageview) sbookPaginate(false);
	      else sbookPaginate(true);
	    */
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
		sbookMarkHUDSetup(false);
		fdjtID("SBOOKMARKINPUT").focus();}
	    else fdjtID("SBOOKSEARCHTEXT").blur();
	    fdjtDOM.cancel(evt);}
	sbookUI.handlers.onkeypress=onkeypress;

	function sbook_onscroll(evt){
	    evt=evt||event||null;
	    // sbook.trace("sbook_onscroll",evt);
	    /* If you're previewing, ignore mouse action */
	    if (sbook.preview) return;
	    if (sbook.target) sbook.checkTarget();}
	sbookUI.handlers.onscroll=sbook_onscroll;

	/* Setup */

	function setupGestures(){
	    if ((sbook_interaction==='touch')) touchGestureSetup();
	    else mouseGestureSetup();}
	sbook.setupGestures=setupGestures;

	function mouseGestureSetup(){
	    setupMargins();

	    fdjtDOM.addListener(false,"scroll",sbook_onscroll);
	    fdjtDOM.addListener(false,"mouseup",onmouseup);

	    fdjtDOM.addListener(document.body,"click",body_onclick);

	    // For command keys
	    fdjtDOM.addListener(false,"keypress",onkeypress);
	    fdjtDOM.addListener(false,"keydown",onkeydown);
	    fdjtDOM.addListener(false,"keyup",onkeyup);

	    var toc_button=fdjtID("SBOOKTOCBUTTON");
	    var dash_button=fdjtID("SBOOKDASHBUTTON");
	    var search_button=fdjtID("SBOOKSEARCHBUTTON");
	    var glosses_button=fdjtID("SBOOKALLGLOSSESBUTTON");

	    toc_button.onmouseover=function(evt){
		fdjtDOM.addClass(fdjtID("SBOOKTOC"),"hover");
		fdjtUI.cancel(evt);};
	    toc_button.onmouseout=function(evt){
		fdjtDOM.dropClass(fdjtID("SBOOKTOC"),"hover");
		fdjtUI.cancel(evt);};
	    search_button.onmouseover=function(evt){
		fdjtDOM.addClass(fdjtID("SBOOKSEARCH"),"hover");
		fdjtUI.cancel(evt);};
	    search_button.onmouseout=function(evt){
		fdjtDOM.dropClass(fdjtID("SBOOKSEARCH"),"hover");
		fdjtUI.cancel(evt);};
	    glosses_button.onmouseover=function(evt){
		fdjtDOM.addClass(fdjtID("SBOOKALLGLOSSES"),"hover");
		fdjtUI.cancel(evt);};
	    glosses_button.onmouseout=function(evt){
		fdjtDOM.dropClass(fdjtID("SBOOKALLGLOSSES"),"hover");
		fdjtUI.cancel(evt);};
	    dash_button.onmouseover=function(evt){
		fdjtDOM.addClass(fdjtID("SBOOKDASH"),"hover");
		fdjtDOM.addClass(fdjtID("SBOOKFOOT"),"hover");
		fdjtUI.cancel(evt);};
	    dash_button.onmouseout=function(evt){
		fdjtDOM.dropClass(fdjtID("SBOOKDASH"),"hover");
		fdjtDOM.dropClass(fdjtID("SBOOKFOOT"),"hover");
		fdjtUI.cancel(evt);};}

	function touchGestureSetup(){
	    setupMargins();
	    fdjtDOM.addListener(document.body,"scroll",sbook_onscroll);
	    fdjtDOM.addListener(document.body,"click",sbook_body_onclick);
	    fdjtDOM.addListener(sbookHUD,"touchstart",sbook_ontouchstart);
	    fdjtDOM.addListener(sbookHUD,"touchmove",sbook_ontouchmove);
	    document.fdjtDOM.addListener(body,"touchend",sbook_ontouchend);
	    fdjtDOM.addListener(window,"keypress",sbook_onkeypress);
	    fdjtDOM.addListener(window,"keydown",sbook_onkeydown);
	    fdjtDOM.addListener(window,"keyup",sbook_onkeyup);
	    fdjtDOM.addClass(document.body,"touch");}

	function sbookSimpleGestureSetup(){
	    setupMargins();
	    fdjtDOM.addListener(document.body,"scroll",sbook_onscroll);
	    fdjtDOM.addListener(document.body,"click",sbook_body_onclick);
	    fdjtDOM.addListener(sbookHUD,"mouseover",fdjtUI.CoHi.onmouseover);
	    fdjtDOM.addListener(sbookHUD,"mouseout",fdjtUI.CoHi.onmouseout);
	    fdjtDOM.addListener(sbookHUD,"click",sbookRef_onclick);
	    fdjtDOM.addListener(window,"keypress",sbook_onkeypress);
	    fdjtDOM.addListener(window,"keydown",sbook_onkeydown);
	    fdjtDOM.addListener(window,"keyup",sbook_onkeyup);}
	
	/* Other stuff */

	function setupMargins() {
	    var leftedge=fdjtID("SBOOKLEFTEDGE");
	    var rightedge=fdjtID("SBOOKRIGHTEDGE");
	    var leftedge2=fdjtID("SBOOKLEFTEDGE2");
	    var rightedge2=fdjtID("SBOOKRIGHTEDGE2");
	    leftedge.onclick=leftedge_onclick;
	    rightedge.title='tap/click to go forward';
	    rightedge.onclick=rightedge_onclick;
	    leftedge.title='tap/click to go back';
	    leftedge2.title='tap/click to go back';
	    leftedge2.onclick=leftedge_onclick;
	    rightedge2.title='tap/click to go forward';
	    rightedge2.onclick=rightedge_onclick;}


	function leftedge_onclick(evt){
	    // sbook.trace("sbookLeftEdge_onclick",evt);
	    if (sbook_edge_taps) sbookBackward();
	    else sbookMode(false);
	    fdjtDOM.cancel(evt);}

	function rightedge_onclick(evt){
	    // sbook.trace("sbookRightEdge_onclick",evt);
	    if (sbook_edge_taps) sbookForward();
	    else sbookMode(false);
	    fdjtDOM.cancel(evt);}

	function sbookForward(){
	    if (sbook.pageview) {
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
	    else window.scrollBy(0,sbook_pagesize);}
	sbook.Forward=sbookForward;

	function sbookBackward(){
	    if (sbook.pageview) {
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
			sbook.GoToPage(sbook_curpage,(info.top-pagetop)-sbook_pagesize);
		    else if (sbook_curpage===0) {}
		    else {
			sbook_curpage--;
			sbook.GoToPage(sbook_curpage);
			if (sbook_curinfo.focus) sbook.setHashID(sbook_curinfo.focus);}}}
	    else window.scrollBy(0,-sbook_pagesize);}
	sbook.Backward=sbookBackward;

	return sbookUI;})();
/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

