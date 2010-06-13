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
	
	function onclick(evt){
	    var target=fdjtUI.T(evt);
	    if (fdjtDOM.isClickable(target)) return;
	    else if (inUI(target)) return;
	    else if (sbook.preview) {
		if ((target)&&(fdjtDOM.hasParent(target,sbook.preview))) {
		    sbook.Preview(false); sbookMode(false);
		    sbook.GoTo(target);}
		else sbook.Preview(false);}
	    else if ((sbook.hudup)&&(sbook.target)&&
		     (fdjtDOM.hasParent(target,sbook.target))&&
		     (!(sbook.mode==="mark"))) {
		var target=sbook.getTarget(evt)
		var selection=window.getSelection();
		var excerpt=fdjtString.stdspace(selection.toString());
		sbookMark(target,false,excerpt);}
	    else if ((sbook.mode)||(sbook.hudup))
	      sbookMode(false);
	    else {
		sbook.setTarget(sbook.getTarget(target));
		sbookMode(true);}}
	sbookUI.margin_onclick=function(evt) {
	    if (sbook.preview) sbook.Preview(false);
	    else if ((sbook.mode)||(sbook.hudup)) sbookMode(false);
	    else sbookMode(true);};

	/*
	  body_onmousedown:
	    if preview mode and over target, go there, otherwise
	      leave preview mode
	    if hudup, bring it down
	    otherwise start addgloss timer
           body_onmouseup:
            if addgloss timer, stop it and bring the hud up
            otherwise, don't do anything
	    
	 */

	var mousedown_timer=false;
	var mousedown=false;
	var mousemoved=false;

	function onmousedown(evt){
	    var target=sbook.getTarget(evt);
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] onmousedown@%o %o %o",
			fdjtET(),fdjtTime(),evt,target);
	    if (fdjtDOM.isClickable(target)) return;
	    else if (inUI(target)) return;
	    else if (sbook.preview) {
		if ((target)&&(fdjtDOM.hasParent(target,sbook.preview))) {
		    sbook.Preview(false); sbookMode(false);
		    sbook.GoTo(target);}
		else sbook.Preview(false);}
	    else if ((sbook.mode)||(sbook.hudup)) sbookMode(false);
	    else {
		mousemoved=false;
		mousedown=fdjtTime();
		mousedown_timer=
		    setTimeout(addgloss,sbook.hold_ms,target);
		if (sbook.Trace.gestures)
	    	    fdjtLog("[%f] settimeout@%o to gloss %o after %o",
			    fdjtET(),mousedown,target,sbook.hold_ms);}}

	function addgloss(target){
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] addgloss %o",fdjtET(),target);
	    mousedown_timer=false;
	    sbookMark(target);}

	function onmousemove(evt){
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] onmousemove@%o %o t=%o moved=%o",
			fdjtET(),fdjtTime(),
			evt,mousedown_timer,mousemoved);
	    if (mousedown_timer) {
		clearTimeout(mousedown_timer);
		mousedown_timer=false;
		mousemoved=true;}}

	function onmouseup(evt){
	    var now=fdjtTime();
	    if (sbook.Trace.gestures)
		fdjtLog("[%f] onmouseup@%o %o timer=%o down=%o moved=%o hold=%o",
			fdjtET(),now,evt,mousedown_timer,mousedown,mousemoved,
			now-mousedown);
	    if (mousedown_timer) {
		if ((mousedown)&&((now-mousedown)>sbook.hold_ms)) {
		    if (sbook.Trace.gestures)
			fdjtLog("[%f] timer %o didn't trip@%o",
				fdjtET(),mousedown_timer,now);
		    // Timer didn't trip for some reason
		    clearTimeout(mousedown_timer);
		    mousedown_timer=false; mousemoved=false; mousedown=false;
		    var target=sbook.getTarget(evt)
		    var selection=window.getSelection();
		    var excerpt=fdjtString.stdspace(selection.toString());
		    sbookMark(target,false,excerpt);}
		else {
		    clearTimeout(mousedown_timer);
		    mousedown_timer=false; mousemoved=false; mousedown=false;
		    if ((sbook.mode)||(sbook.hudup))
			sbookMode(false);
		    else {
			sbook.setTarget(sbook.getTarget(evt));
			sbookMode(true);}}}
	    else if (mousemoved) {
		var target=sbook.getTarget(evt)
		var selection=window.getSelection();
		var excerpt=fdjtString.stdspace(selection.toString());
		sbookMark(target,false,excerpt);}
	    else if (sbook.preview) sbook.Preview(false);}
	
	function ondblclick(evt){
	    sbookMark(sbook.getTarget(evt));}

	// This should be for the accessible version
	// In preview mode, clicking on the target goes there
	//   otherwise, disable preview mode
	// Outside of preview mode,
	//   clicking on the target brings up the gloss HUD
	// otherwse, if the HUD is up, clicking brings it down
	// otherwise, clicking sets the target and brings it up

	/*
	function body_onclick(evt){
	    var mousedown=sbook_mousedown; var target;
	    evt=evt||event; sbook_mousedown=false;
	    // fdjtLog("body_onclick %o",evt);
	    // Determine if you were really held down and not clicked
	    if ((mousedown)&&
		((fdjtTime()-mousedown)>sbook_hold_threshold)) {
		return;}
	    // Check if you should do anything
	    if (!(target=fdjtDOM.T(evt))) return;
	    else if (fdjtDOM.isClickable(target)) return;
	    else if (inUI(target)) return;
	    // In preview mode, clicking on the previewed passage goes
	    //  there but anything else just turns off preview mode.
	    else if (sbook.preview) {
		if (fdjtDOM.hasParent(target,sbook.preview)) {
		    sbook.Preview(false); sbookMode(false);
		    sbook.GoTo(target);}
		else sbook.Preview(false);}
	    // If you're in a HUD mode, leave the mode
	    else if (sbook.mode)
		sbookMode(false);
	    // If the HUD is up, bring it down
	    else if (fdjtDOM.hasClass(document.body,"hudup"))
		fdjtDOM.dropClass(document.body,"hudup");
	    // Otherwise, bring the HUD up and set the target
	    // (Maybe, flash some context)
	    else {
		sbook.setTarget(sbook.getTarget(target));
	    	fdjtDOM.addClass(document.body,"hudup");}}
	sbookUI.handlers.bodyclick=body_onclick
	*/

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

	function setupGestures(){
	    // Unavoidable browser sniffing
	    if (sbook.mobilesafari) mobileSafariGestures();
	    if (sbook.touchmode) touchGestureSetup();
	    else mouseGestureSetup();}
	sbook.setupGestures=setupGestures;

	function mouseGestureSetup(){
	    setupMargins();

	    // We handle the click on mouseup because that way
	    //  we will get selections
	    fdjtDOM.addListener(false,"mouseup",onclick);
	    fdjtDOM.addListener(document.body,"dblclick",ondblclick);

	    // For command keys
	    fdjtDOM.addListener(false,"keypress",onkeypress);
	    fdjtDOM.addListener(false,"keydown",onkeydown);
	    fdjtDOM.addListener(false,"keyup",onkeyup);

	    var toc_button=fdjtID("SBOOKTOCBUTTON");
	    var dash_button=fdjtID("SBOOKDASHBUTTON");
	    var search_button=fdjtID("SBOOKSEARCHBUTTON");
	    var glosses_button=fdjtID("SBOOKALLGLOSSESBUTTON");

	    toc_button.onmouseover=toc_button.onmouseout=
		toc_button.onclick=hudbutton;
	    search_button.onmouseover=search_button.onmouseout=
		search_button.onclick=hudbutton;
	    dash_button.onmouseover=dash_button.onmouseout=
		dash_button.onclick=hudbutton;
	    glosses_button.onmouseover=glosses_button.onmouseout=
		glosses_button.onclick=hudbutton;}

	var mode_hud_map={
	    "toc": "SBOOKTOC",
	    "search": "SBOOKSEARCH",
	    "allglosses": "SBOOKALLGLOSSES",
	    "dash": "SBOOKDASH"};

	function hudbutton(evt){
	    var target=fdjtUI.T(evt);
	    var mode=target.getAttribute("hudmode");
	    if (!(mode)) return;
	    var hudid=((mode)&&(mode_hud_map[mode]));
	    var hud=fdjtID(hudid);
	    if (evt.type==='click') {
		if (hud) fdjtDOM.dropClass(hud,"hover");
		sbookMode(mode); fdjtUI.cancel(evt);}
	    else if ((evt.type==='mouseover')&&(sbook.mode))
		return;
	    else {
		if (!(hud)) {}
		else if (evt.type==='mouseover')
		    fdjtDOM.addClass(hud,"hover");
		else if (evt.type==='mouseout')
		    fdjtDOM.dropClass(hud,"hover");
		else {}}}

	function touchGestureSetup(){
	    setupMargins();

	    fdjtDOM.addListener(window,"click",onclick);
	    //fdjtDOM.addListener(window,"touchstart",onmousedown);
	    //fdjtDOM.addListener(window,"touchmove",onmousemove);
	    //fdjtDOM.addListener(window,"touchend",onmouseup);
	    //fdjtDOM.addListener(window,"mousedown",onmousedown);
	    //fdjtDOM.addListener(window,"mousemove",onmousemove);
	    //fdjtDOM.addListener(window,"mouseup",onmouseup);
	    fdjtDOM.addListener(window,"keypress",sbook_onkeypress);
	    fdjtDOM.addListener(window,"keydown",sbook_onkeydown);
	    fdjtDOM.addListener(window,"keyup",sbook_onkeyup);
	    fdjtDOM.addClass(document.body,"touch");}

	function sbookSimpleGestureSetup(){
	    setupMargins();
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
	    else window.scrollBy(0,sbook_pagesize);}
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

