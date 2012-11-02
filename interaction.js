/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/interaction.js ###################### */

/* Copyright (C) 2009-2012 beingmeta, inc.
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

/* There are three basic display modes:
    reading (minimal decoration, with 'minimal' configurable)
    scanning (card at top, buttons on upper edges)
    tool (lots of tools unfaded)

   Tap on content:
    if not hudup, raise the HUD;
    if scanning or no target, lower the HUD
    if addgloss is live on target, lower the HUD
    otherwise addgloss on target
*/

(function(){

    // Imports (kind of )
    var addClass=fdjtDOM.addClass;
    var hasClass=fdjtDOM.hasClass;
    var dropClass=fdjtDOM.dropClass;
    var swapClass=fdjtDOM.swapClass;
    var toggleClass=fdjtDOM.toggleClass;
    var getTarget=Codex.getTarget;
    var getParent=fdjtDOM.getParent;
    var hasParent=fdjtDOM.hasParent;
    var isClickable=fdjtUI.isClickable;
    var getGeometry=fdjtDOM.getGeometry;
    var getChild=fdjtDOM.getChild;

    var parsePX=fdjtDOM.parsePX;
    var atoi=parseInt;

    var submitEvent=fdjtUI.submitEvent;

    var reticle=fdjtUI.Reticle;

    var unhold=false;
    var hold_timer=false;
    var start_x=-1; var start_y=-1; var last_x=-1; var last_y=-1;
    var start_t=-1; var last_t=-1;
    var cxicon=Codex.icon;

    /* Setup for gesture handling */

    function addHandlers(node,type){
	var mode=Codex.ui;
	fdjtDOM.addListeners(node,Codex.UI.handlers[mode][type]);}
    Codex.UI.addHandlers=addHandlers;

    function setupGestures(domnode){
	var mode=Codex.ui;
	if (!(mode)) Codex.ui=mode="mouse";
	if (!(domnode)) {
	    addHandlers(false,'window');
	    addHandlers(document,'document');
	    addHandlers(document.body,'body');
	    if (Codex.bypage)
		addHandlers(fdjtID("CODEXPAGE"),'content');
	    else addHandlers(fdjtID("CODEXCONTENT"),'content');
	    fdjtUI.TapHold(Codex.pagefoot,Codex.touch);
	    addHandlers(Codex.HUD,'hud');}
	var handlers=Codex.UI.handlers[mode];
	if (mode)
	    for (var key in handlers)
		if ((key.indexOf('.')>=0)||(key.indexOf('#')>=0)) {
		    var nodes=fdjtDOM.$(key,domnode);
		    var h=handlers[key];
		    fdjtDOM.addListeners(nodes,h);}}
    Codex.setupGestures=setupGestures;

    var dont=fdjtUI.noBubble;
    function passmultitouch(evt){
	if ((evt.touches)&&(evt.touches.length>1)) return;
	else fdjtUI.noBubble(evt);}

    /* New simpler UI */

    function inUI(node){
	while (node)
	    if (!(node)) return false;
	else if (node.codexui) return true;
	else node=node.parentNode;
	return false;}

    var gloss_focus=false;
    var gloss_blurred=false;
    function addgloss_focus(evt){
	evt=evt||event;
	gloss_blurred=false;
	var target=fdjtUI.T(evt);
	var form=getParent(target,"FORM");
	if (form) addClass(form,"focused");
	gloss_focus=form;}
    function addgloss_blur(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var form=getParent(target,"FORM");
	if (form) dropClass(form,"focused");
	gloss_blurred=fdjtTime();
	gloss_focus=false;}
    Codex.UI.addgloss_focus=addgloss_focus;
    Codex.UI.addgloss_blur=addgloss_blur;

    /* Adding a gloss button */

    function addGlossButton(target){
	var passage=getTarget(target);
	if (!(passage)) return;
	var img=fdjtDOM.getChild(passage,".codexglossbutton");
	if (img) return;
	img=fdjtDOM.Image(cxicon("remark",64,64),".codexglossbutton",
			  "+","click to add a gloss to this passage");
	Codex.UI.addHandlers(img,"glossbutton");
	fdjtDOM.prepend(passage,img);}
    
    function glossbutton_ontap(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var passage=getTarget(target);
	if ((Codex.mode==="addgloss")&&
	    (Codex.glosstarget===passage)) {
	    fdjtUI.cancel(evt);
	    CodexMode(true);}
	else if (passage) {
	    fdjtUI.cancel(evt);
	    var form=Codex.setGlossTarget(passage);
	    if (!(form)) return;
	    CodexMode("addgloss");
	    Codex.setGlossForm(form);}}

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

    /* Generic content interaction handler */

    var isEmpty=fdjtString.isEmpty;
    var gesture_start=false;
    var tap_target=false;
    var tap_timer=false;
    var last_text=false;

    var touch_timer=false; var timer_started=false;
    function content_mousedown(evt){
	evt=evt||event;
	var sX=evt.screenX, sY=evt.screenY;
	var cX=evt.clientX, cY=evt.clientY;
	var now=fdjtTime();
	var addgloss=false;
	var target=fdjtUI.T(evt);

	// Don't capture modified events, except with shift key
	if ((evt.ctrlKey)||(evt.altKey)) {
	    gesture_start=false;
	    return;}

	var anchor=getParent(target,"A"), href;
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
	    gesture_start=false;
	    return;}

	if (fdjtUI.isClickable(fdjtUI.T(evt))) return;

	var passage=getTarget(target);
	// We get the passage here so we can include it in the trace message
	if (Codex.Trace.gestures)
	    fdjtLog("new_mousedown (%o) on %o passage=%o mode=%o",
		    evt,target,passage,Codex.mode);
	var id=((passage)&&(passage.codexbaseid||passage.id));
	// Update our location
	if ((id)&&(Codex.docinfo[id])) {
	    var info=Codex.docinfo[id];
	    if (info.starts_at) {
		// If we were really clever, we might look at the
		//  selection object to get an even more precise
		//  location.  Not now.
		Codex.setLocation(info.starts_at);
		if (Codex.updatePageDisplay)
		    Codex.updatePageDisplay(Codex.curpage,Codex.location);}}
	
	if ((Codex.hudup)&&(Codex.mode!=="addgloss")) {
	    CodexMode(false);
	    fdjtUI.cancel(evt);
	    return;}
	else if (!(passage)) {
	    if (Codex.mode) {CodexMode(false); return;}
	    if (x>(fdjtDOM.viewWidth()/3))
		Codex.Forward(evt);
	    else Codex.Backward(evt);
	    gesture_start=false;
	    fdjtUI.cancel(evt);
	    return;}
	else if ((Codex.glosstarget)&&
		 ((hasParent(passage,Codex.glosstarget))||
		  (hasParent(Codex.glosstarget,passage)))&&
		 (fdjtID("CODEXLIVEGLOSS"))) {
	    fdjtUI.cancel(evt);
	    CodexMode("addgloss");}
	else if ((Codex.glosstarget)&&
		 (Codex.mode==="addgloss")) {
	    fdjtUI.cancel(evt);
	    CodexMode(false);}
	else {
	    var form=Codex.setGlossTarget(passage);
	    if (!(form)) return;
	    else fdjtUI.cancel(evt);
	    var form_elt=fdjtDOM.getChild(form,"form");
	    var mode=((evt.shiftKey)?("addtag"):("editnote"));
	    var ctrl=evt.ctrlKey||false;
	    var alt=evt.altKey||false;
	    var shift=evt.shiftKey||false;
	    var meta=evt.metaKey||false;
	    var button=evt.button||0;
	    Codex.setGlossMode(mode,form);
	    Codex.setGlossForm(form);
	    CodexMode("addgloss");
	    timer_started=true;
	    touch_timer=
		setTimeout(function(){
		    fakeMouseDown(
			sX,sY,cX,cY,ctrl,alt,shift,meta,button);},
			   Codex.holdmsecs);}}
	    
    function fakeMouseDown(sX,sY,cX,cY,ctrl,alt,shift,meta,button){
	var evt = document.createEvent("MouseEvent");
	var target=document.elementFromPoint(cX,cY);
	evt.initMouseEvent("mousedown", true, true,window,1,
			   sX,sY,cX,cY,ctrl,alt,shift,meta,button,null);	
	target.dispatchEvent(evt);}

    function content_mouseup(evt){
	evt=evt||event;
	if (timer_started) {
	    fdjtUI.cancel(evt);
	    timer_started=false;
	    if (touch_timer) {
		clearTimeout(touch_timer);
		touch_timer=false;}}}

    /* TOC handlers */

    function getAbout(elt){
	while (elt) {
	    if ((elt.name)&&(elt.name.search("SBR")===0))
		return elt;
	    else elt=elt.parentNode;}
	return false;}

	function getTitleSpan(toc,ref){
	    var titles=fdjtDOM.getChildren(toc,".codextitle");
	    var i=0; var lim=titles.length;
	    while (i<lim) {
		var title=titles[i++];
		if (title.name===ref) return title;}
	    return false;}

    function toc_tapped(evt){
	evt=evt||event;
	var tap_target=fdjtUI.T(evt);
	var about=getAbout(tap_target);
	var cur_target=Codex.target;
	if (about) {
	    var ref=about.name.slice(3);
	    var target=fdjtID(ref);
	    var info=Codex.docinfo[ref];
	    var toc=getParent(tap_target,".codextoc");
	    var show_fulltoc=
		((info.sub)&&(info.sub.length>2))&&
		(!(hasClass(toc,"codexlivehead")));
	    if (Codex.Trace.gestures)
		fdjtLog("toc_tapped %o about=%o ref=%s",evt,about,ref);
	    Codex.JumpTo(target);
	    if (show_fulltoc) CodexMode("toc");
	    else CodexMode("tocscan");
	    return fdjtUI.cancel(evt);}
    	else if (Codex.Trace.gestures) fdjtLog("toc_tapped %o noabout", evt);
	else {}}
    function toc_held(evt){
	evt=evt||event;
	var about=getAbout(fdjtUI.T(evt));
	if (about) {
	    var ref=about.name.slice(3);
	    var toc=getParent(about,".codextoc");
	    var title=getTitleSpan(toc,about.name);
	    if (Codex.Trace.gestures)
		fdjtLog("toc_held %o about=%o ref=%s toc=%o title=%s",
			evt,about,ref,toc,title);
	    addClass(title,"codexpreviewtitle");
	    addClass(about.parentNode,"codexheld");
	    addClass(getParent(about,".spanbar"),"codexvisible");
	    addClass(toc,"codexheld");
	    Codex.startPreview(fdjtID(ref),"codexheld");
	    return fdjtUI.cancel(evt);}
	else if (Codex.Trace.gestures) fdjtLog("toc_held %o noabout", evt);
	else {}}
    function toc_released(evt){
	evt=evt||event;
	var about=getAbout(fdjtUI.T(evt));
	if (about) {
	    var toc=getParent(about,".codextoc");
	    var title=getTitleSpan(toc,about.name);
	    if (Codex.Trace.gestures)
		fdjtLog("toc_released %o about=%o toc=%o title=%s",
			evt,about,toc,title);
	    dropClass(title,"codexpreviewtitle");
	    dropClass(about.parentNode,"codexheld");
	    dropClass(getParent(about,".spanbar"),"codexvisible");
	    dropClass(toc,"codexheld");
	    Codex.stopPreview("toc_released");}
	else if (Codex.Trace.gestures)
	    fdjtLog("toc_released %o noabout",evt);
	else {}}
    function toc_slipped(evt){
	evt=evt||event;
	var about=getAbout(fdjtUI.T(evt));
	if ((!about)&&(Codex.Trace.gestures))
	    fdjtLog("toc_slipped %o noabout",evt);
	if (about) {
	    var toc=getParent(about,".codextoc");
	    var title=getTitleSpan(toc,about.name);
	    if (Codex.Trace.gestures)
		fdjtLog("toc_slipped %o about=%o toc=%o title=%s",
			evt,about,toc,title);
	    dropClass(title,"codexpreviewtitle");
	    dropClass(getParent(about,".spanbar"),"codexvisible");
	    dropClass(about.parentNode,"codexheld");
	    dropClass(toc,"codexheld");}
	else if (Codex.Trace.gestures)
	    fdjtLog("toc_slipped %o noabout",evt);
	else {}}

    /* Slice handlers */

    function getCard(target){
	return ((hasClass(target,"codexcard"))?(target):
		(getParent(target,".codexcard")));}

    function slice_tapped(evt){
	var target=fdjtUI.T(evt);
	if (getParent(target,".ellipsis")) {
	    fdjtUI.Ellipsis.toggle(target);
	    fdjtUI.cancel(evt);
	    return;}
	var card=getCard(target);
	if ((!(getParent(target,".tool")))&&
	    (getParent(card,".codexslice"))) {
	    Codex.Scan(fdjtID(card.about),card);
	    return fdjtUI.cancel(evt);}
 	else if ((card.name)||(card.getAttribute("name"))) {
	    var name=(card.name)||(card.getAttribute("name"));
	    var gloss=fdjtKB.ref(name,Codex.glosses);
	    if (!(gloss)) return;
	    var form=Codex.setGlossTarget(gloss);	    
	    if (!(form)) return;
	    CodexMode("addgloss");}
 	else if (card.about) {
	    Codex.JumpTo(card.about);}}
    function slice_held(evt){
	var card=getCard(fdjtUI.T(evt||event));
	if (!(card)) return;
	if (Codex.scanning===card) return;
	var clone=card.cloneNode(true);
	clone.id="CODEXSCAN";
	fdjtDOM.replace("CODEXSCAN",clone);
	if (Codex.previewTarget) {
	    dropClass(Codex.previewTarget,"codexpreviewtarget");
	    Codex.clearHighlights(Codex.previewTarget);}
	if (card.about) {
	    var target=Codex.previewTarget=fdjtID(card.about);
	    addClass(target,"codexpreviewtarget");}
	if (hasClass(card,"gloss")) {
	    var glossinfo=Codex.glosses.ref(card.name);
	    if (!(target))
		Codex.previewTarget=target=fdjtID(glossinfo.frag);
	    else Codex.previewTarget=target;
	    if (glossinfo.excerpt) {
		var range=fdjtDOM.findString(
		    target,glossinfo.excerpt,glossinfo.exoff);
		if (range) fdjtUI.Highlight(range,"highlightexcerpt");
		else addClass(target,"highlightpassage");}
	    else addClass(target,"highlightpassage");}
	else if (getParent(card,".sbookresults")) {
	    var about=card.about;
	    Codex.previewTarget=target=fdjtID(about);
	    if (about) {
		var info=Codex.docinfo[target.id];
		var terms=Codex.query._query;
		var spellings=info.knodeterms;
		var i=0; var lim=terms.length;
		while (i<lim) {
		    var term=terms[i++];
		    highlightTerm(term,target,info,spellings);}}}
	else {}
	Codex.startPreview(target,"slice_held");
	return fdjtUI.cancel(evt);}
    function slice_released(evt){
	var card=getCard(fdjtUI.T(evt||event));
	if (card) {
	    Codex.stopPreview("slice_released");}}

    /* Highlighting terms in passages (for scanning, etc) */

    function highlightTerm(term,target,info,spellings){
	var words=[];
	if (typeof term === 'string')
	    words=((spellings)&&(spellings[term]))||[term];
	else {
	    var knodes=info.knodes;
	    var i=0; var lim=knodes.length;
	    while (i<lim) {
		var knode=knodes[i++];
		if ((knode===term)||
		    (fdjtKB.contains(knode._always,term))) {
		    var qid=knode._qid; var dterm=knode.dterm;
		    var spelling=
			((spellings)&&
			 ((spellings[qid])||(spellings[dterm])));
		    if (!(spelling)) {
			var synonyms=knode.EN;
			if (!(synonyms)) {}
			else if (typeof synonyms === 'string')
			    words.push(synonyms);
			else words=words.concat(synonyms);
			var hooks=knode.hooks;
			if (!(hooks)) {}
			else if (typeof hooks === 'string')
			    words.push(hooks);
			else words=words.concat(hooks);}
		    else if (typeof spelling === 'string')
			words.push(spelling);
		    else words=words.concat(spelling);}}
	    if (words.length===0) words=false;}
	if (!(words)) return;
	if (typeof words === 'string') words=[words];
	var j=0; var jlim=words.length;
	while (j<jlim) {
	    var word=words[j++];
	    var pattern=new RegExp(word.replace(/\s+/g,"(\\s+)"),"gm");
	    var ranges=fdjtDOM.findMatches(target,pattern);
	    if (Codex.Trace.highlight)
		fdjtLog("Trying to highlight %s (using %o) in %o, ranges=%o",
			word,pattern,target,ranges);
	    if ((ranges)&&(ranges.length)) {
		var k=0; while (k<ranges.length) 
		    fdjtUI.Highlight(ranges[k++],"highlightsearch");}}}
    Codex.highlightTerm=highlightTerm;

    /* HUD handlers */

    function hud_tapped(evt,target){
	if (!(target)) target=fdjtUI.T(evt);
	if (isClickable(target)) return;
	else if (getParent(target,".helphud")) {
	    var mode=fdjtDOM.findAttrib(target,"data-hudmode")||
		fdjtDOM.findAttrib(target,"hudmode");
	    if (mode) CodexMode(mode)
	    else CodexMode(false);
	    return fdjtUI.cancel(evt);}
	var card=((hasClass(target,"codexcard"))?(target):
		  (getParent(target,".codexcard")));
	if (card) {
	    if ((!(getParent(target,".tool")))&&
		(getParent(card,".codexslice"))) {
		Codex.Scan(fdjtID(card.about),card);
		return fdjtUI.cancel(evt);}
	    else if ((card.name)||(card.getAttribute("name"))) {
		var name=(card.name)||(card.getAttribute("name"));
		var gloss=fdjtKB.ref(name,Codex.glosses);
		if (!(gloss)) return;
		var form=Codex.setGlossTarget(gloss);	    
		if (!(form)) return;
		CodexMode("addgloss");}
	    else if (card.about) {
		Codex.JumpTo(card.about);}
	    fdjtUI.cancel(evt);
	    return;}
	var scan=target, about=false, frag=false, gloss=false;
	while (scan) {
	    if (about=scan.about) break;
	    else if (frag=scan.frag) break;
	    else scan=scan.parentNode;}
	if (frag) {Codex.ScanTo(frag); fdjtUI.cancel(evt);}
	else if ((about)&&(about[0]==='#')) {
	    Codex.ScanTo(about.slice(0)); fdjtUI.cancel(evt);}
	else if ((about)&&(gloss=Codex.glosses.ref(about))) {
	    var form=Codex.setGlossTarget(gloss);	    
	    if (!(form)) return;
	    CodexMode("addgloss");
	    fdjtUI.cancel(evt);}
	else {}}
    
    /* Keyboard handlers */

    // We use keydown to handle navigation functions and keypress
    //  to handle mode changes
    function onkeydown(evt){
	evt=evt||event||null;
	var kc=evt.keyCode;
	// fdjtLog("sbook_onkeydown %o",evt);
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
	else if (kc===34) Codex.pageForward(evt);   /* page down */
	else if (kc===33) Codex.pageBackward(evt);  /* page up */
	else if (kc===40) { /* arrow down */
	    Codex.setHUD(false);
	    Codex.pageForward(evt);}
	else if (kc===38) {  /* arrow up */
	    Codex.setHUD(false);
	    Codex.pageBackward(evt);}
	else if (kc===37) Codex.scanBackward(evt); /* arrow left */
	else if (kc===39) Codex.scanForward(evt); /* arrow right */
	// Don't interrupt text input for space, etc
	else if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
	else if ((!(Codex.mode))&&(kc===32)) // Space
	    Codex.Forward(evt);
	// backspace or delete
	else if ((!(Codex.mode))&&((kc===8)||(kc===45)))
	    Codex.Backward(evt);
	// Home goes to the current head.
	else if (kc===36) Codex.JumpTo(Codex.head);
	else if (Codex.mode==="addgloss") {
	    var mode=Codex.getGlossMode();
	    if (mode) return;
	    var formdiv=fdjtID("CODEXLIVEGLOSS");
	    var form=(formdiv)&&(fdjtDOM.getChild(formdiv,"FORM"));
	    if (!(form)) return;
	    if (kc===13) { // return/newline
		submitEvent(form);}
	    else if ((kc===35)||(kc===91)) // # or [
		Codex.setGlossMode("addtag",form);
	    else if (kc===32) // Space
		Codex.setGlossMode("editnote",form);
	    else if ((kc===47)||(kc===58)) // /or :
		Codex.setGlossMode("addlink",form);
	    else if ((kc===64)) // @
		Codex.setGlossMode("sharing",form);
	    else {}}
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
	65: "openheart", 97: "openheart",
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
	else if ((ch===72)||(ch===104)) { // 'H' or 'h'
	    fdjtDOM.toggleClass(document.body,'codexhelp');
	    return false;}
	else modearg=modechars[ch];
	if (modearg==="openheart")
	    modearg=Codex.last_heartmode||"about";
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
	    Codex.setFocus(fdjtID("CODEXSEARCHINPUT"));
	else fdjtID("CODEXSEARCHINPUT").blur();
	fdjtDOM.cancel(evt);}
    Codex.UI.handlers.onkeypress=onkeypress;

    function goto_keypress(evt){
	evt=evt||event||null;
	var target=fdjtUI.T(evt);
	var ch=evt.charCode||evt.keyCode;
	var max=false; var min=false;
	var handled=false;
	if (target.name==='GOTOLOC') {
	    min=0; max=Math.floor(Codex.ends_at/128);}
	else if (target.name==='GOTOPAGE') {
	    min=1; max=Codex.pagecount;}
	else if (ch===13) fdjtUI.cancel(evt);
	if (ch===13) {
	    if (target.name==='GOTOPAGE') {
		var num=parseInt(target.value);
		if (typeof num === 'number') {
		    handled=true; Codex.GoToPage(num);}
		else {}}
	    else if (target.name==='GOTOLOC') {
		var locstring=target.value;
		var pct=parseFloat(locstring);
		if ((typeof pct === 'number')&&(pct>=0)&&(pct<=100)) {
		    var loc=Math.floor((pct/100)*Codex.ends_at);
		    Codex.JumpTo(loc); handled=true;}}
	    else {}
	    if (handled) {
		target.value="";
		CodexMode(false);}}}
    Codex.UI.goto_keypress=goto_keypress;

    /* ADDGLOSS interaction */

    function delete_ontap(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	fdjtUI.cancel(evt);
	var block=getParent(target,".codexglossform");
	if (!(block)) return;
	var glosselt=fdjtDOM.getInput(block,'UUID');
	if (!(glosselt)) return;
	var qref=glosselt.value;
	var gloss=Codex.glosses.ref(qref);
	if (!(gloss)) return;
	if ((window.confirm)&&
	    (!(window.confirm("Really delete this gloss?"))))
	    return;
	var frag=gloss.get("frag");
	fdjtAjax.jsonCall(
	    function(response){glossdeleted(response,qref,frag);},
	    "https://"+Codex.server+"/v1/delete",
	    "gloss",qref);}
    Codex.UI.delete_ontap=delete_ontap;
    
    function respond_ontap(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	fdjtUI.cancel(evt);
	var block=getParent(target,".codexglossform");
	if (!(block)) return;
	var glosselt=fdjtDOM.getInput(block,'UUID');
	if (!(glosselt)) return;
	var qref=glosselt.value;
	var gloss=Codex.glosses.ref(qref);
	if (!(gloss)) return;
	var form=Codex.setGlossTarget(gloss,Codex.getGlossForm(gloss,true));
	if (!(form)) return;
	CodexMode("addgloss");}
    Codex.UI.respond_ontap=respond_ontap;

    function glossdeleted(response,glossid,frag){
	if (response===glossid) {
	    Codex.glosses.drop(glossid);
	    Codex.allglosses=fdjtKB.remove(Codex.allglosses,glossid);
	    if (Codex.saveglosses)
		fdjtState.setLocal("glosses("+Codex.refuri+")",
				   Codex.allglosses,true);
	    var editform=fdjtID("CODEXEDITGLOSS_"+glossid);
	    if (editform) {
		var editor=editform.parentNode;
		if (editor===fdjtID('CODEXLIVEGLOSS')) {
		    Codex.glosstarget=false;
		    CodexMode(false);}
		fdjtDOM.remove(editor);}
	    var renderings=fdjtDOM.Array(document.getElementsByName(glossid));
	    if (renderings) {
		var i=0; var lim=renderings.length;
		while (i<lim) {
		    var rendering=renderings[i++];
		    if (rendering.id==='CODEXSCAN')
			fdjtDOM.replace(
			    rendering,fdjtDOM("div.codexcard.deletedgloss"));
		    else fdjtDOM.remove(rendering);}}
	    var glossmark=fdjtID("SBOOK_GLOSSMARK_"+frag);
	    if (glossmark) {
		var newglosses=fdjtKB.remove(glossmark.glosses,glossid);
		if (newglosses.length===0) fdjtDOM.remove(glossmark);
		else glossmark.glosses=newglosses;}}
	else alert(response);}

    function addoutlet_keydown(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var content=target.value;
	var glossdiv=fdjtID("CODEXLIVEGLOSS");
	if (!(glossdiv)) return;
	var form=getChild(glossdiv,"FORM");
	var outlet_cloud=Codex.outletCloud();
	var ch=evt.keyCode||evt.charCode;
	if ((fdjtString.isEmpty(content))&&(ch===13)) {
	    if (outlet_cloud.selection) 
		Codex.addOutlet2Form(
		    form,outlet_cloud.selection.getAttribute("value"));
	    else Codex.setGlossMode("editnote");
	    return;}
	else if ((ch===13)&&(outlet_cloud.selection)) {
	    Codex.addOutlet2Form(form,outlet_cloud.selection);
	    outlet_cloud.complete("");
	    target.value="";}
	else if (ch===13) {
	    var completions=outlet_cloud.complete(content);
	    if (completions.length)
		Codex.addOutlet2Form(
		    form,completions[0].getAttribute("value"));
	    else Codex.addOutlet2Form(form,content);
	    fdjtUI.cancel(evt);
	    target.value="";
	    outlet_cloud.complete("");}
	else if (ch===9) { /* tab */
	    var completions=outlet_cloud.complete(content);
	    fdjtUI.cancel(evt);
	    if ((outlet_cloud.prefix)&&
		(outlet_cloud.prefix!==content)) {
		target.value=outlet_cloud.prefix;
		fdjtDOM.cancel(evt);
		setTimeout(function(){
		    Codex.UI.updateScroller("CODEXGLOSSOUTLETS");},
			   100);
		return;}
	    else if (evt.shiftKey) outlet_cloud.selectPrevious();
	    else outlet_cloud.selectNext();}
	else setTimeout(function(evt){
	    outlet_cloud.complete(target.value);},
			100);}

    function addtag_keydown(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var content=target.value;
	var glossdiv=fdjtID("CODEXLIVEGLOSS");
	if (!(glossdiv)) return;
	var form=getChild(glossdiv,"FORM");
	var gloss_cloud=Codex.glossCloud();
	var ch=evt.keyCode||evt.charCode;
	if ((fdjtString.isEmpty(content))&&(ch===13)) {
	    if (gloss_cloud.selection) 
		Codex.addTag2Form(form,gloss_cloud.selection);
	    else Codex.setGlossMode("editnote");
	    return;}
	else if ((ch===13)&&(gloss_cloud.selection)) {
	    Codex.addTag2Form(form,gloss_cloud.selection);
	    gloss_cloud.complete("");
	    target.value="";}
	else if (ch===13) {
	    var completions=gloss_cloud.complete(content);
	    if ((content.indexOf('|')>=0)||
		(content.indexOf('@')>=0)||
		(completions.length===0)||
		(evt.shiftKey))
		Codex.addTag2Form(form,content);
	    else {
		if (completions.length)
		    Codex.addTag2Form(form,completions[0]);
		else Codex.addTag2Form(form,content);}
	    fdjtUI.cancel(evt);
	    target.value="";
	    gloss_cloud.complete("");}
	else if (ch===9) { /* tab */
	    var completions=gloss_cloud.complete(content);
	    fdjtUI.cancel(evt);
	    if ((gloss_cloud.prefix)&&
		(gloss_cloud.prefix!==content)) {
		target.value=gloss_cloud.prefix;
		fdjtDOM.cancel(evt);
		setTimeout(function(){
		    Codex.UI.updateScroller("CODEXGLOSSTAGS");},
			   100);
		return;}
	    else if (evt.shiftKey) gloss_cloud.selectPrevious();
	    else gloss_cloud.selectNext();}
	else setTimeout(function(evt){
	    gloss_cloud.complete(target.value);},
			100);}

    function addlink_action(evt){
	var linkinput=fdjtID("CODEXURLINPUT");
	var titleinput=fdjtID("CODEXURLTITLE");
	var livegloss=fdjtID("CODEXLIVEGLOSS");
	if (!(livegloss)) return;
	var form=getChild(livegloss,"FORM");
	Codex.addLink2Form(form,linkinput.value,titleinput.value);
	linkinput.value="";
	titleinput.value="";
	Codex.setGlossMode("editnote");}
    function addlink_cancel(evt){
	var linkinput=fdjtID("CODEXURLINPUT");
	var titleinput=fdjtID("CODEXURLTITLE");
	var livegloss=fdjtID("CODEXLIVEGLOSS");
	if (!(livegloss)) return;
	linkinput.value="";
	titleinput.value="";
	Codex.setGlossMode("editnote");}
    function addlink_keydown(evt){
	evt=evt||event;
	var ch=evt.keyCode||evt.charCode;
	if (ch!==13) return;
	fdjtUI.cancel(evt);
	var linkinput=fdjtID("CODEXURLINPUT");
	var titleinput=fdjtID("CODEXURLTITLE");
	var livegloss=fdjtID("CODEXLIVEGLOSS");
	if (!(livegloss)) return;
	var form=getChild(livegloss,"FORM");
	Codex.addLink2Form(form,linkinput.value,titleinput.value);
	linkinput.value="";
	titleinput.value="";
	Codex.setGlossMode("editnote");}

    /* HUD button handling */

    var mode_hud_map={
	"toc": "CODEXTOC",
	"searching": "CODEXSEARCH",
	"allglosses": "CODEXSOURCES"};
    
    function hudbutton(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var mode=target.getAttribute("hudmode");
	if ((Codex.Trace.gestures)&&
	    ((evt.type==='tap')||
	     (evt.type==='click')||
	     (evt.type==='touchend')||
	     (evt.type==='release')||
	     (Codex.Trace.gestures>1)))
	    fdjtLog("hudbutton() %o mode=%o cl=%o scan=%o sbh=%o mode=%o",
		    evt,mode,(isClickable(target)),
		    Codex.scanning,Codex.hudup,CodexMode());
	if (reticle.live) reticle.flash();
	fdjtUI.cancel(evt);
	if (!(mode)) return;
	var hudid=((mode)&&(mode_hud_map[mode]));
	var hud=fdjtID(hudid);
	if ((evt.type==='click')||(evt.type==='tap')||
	    (evt.type==='touchend')||(evt.type==='release')) {
	    if (hud) dropClass(hud,"hover");
	    if (Codex.scanning) {
		if (mode==="search") {
		    CodexMode("searchresults"); return;}
		else if (mode==="allglosses") {
		    CodexMode("allglosses"); return;}}
	    if (fdjtDOM.hasClass(Codex.HUD,mode)) CodexMode(false);
	    else CodexMode(mode);}
	else if ((evt.type==='mouseover')&&(Codex.mode))
	    return;
	else {
	    if (!(hud)) {}
	    else if (evt.type==='mouseover')
		addClass(hud,"hover");
	    else if (evt.type==='mouseout')
		dropClass(hud,"hover");
	    else {}}}
    Codex.UI.hudbutton=hudbutton;

    Codex.UI.dropHUD=function(evt){
	var target=fdjtUI.T(evt);
	if (isClickable(target)) {
	    if (Codex.Trace.gestures)
		fdjtLog("Clickable: don't dropHUD %o",evt);
	    return;}
	if (Codex.Trace.gestures) fdjtLog("dropHUD %o",evt);
	fdjtUI.cancel(evt); CodexMode(false);};

    /* Gesture state */

    var touch_started=false; var touch_ref=false;
    var page_x=-1; var page_y=-1; var sample_t=-1;
    var touch_moves=0;
    var touch_held=false;
    var touch_moved=false;
    var touch_scrolled=false;
    var n_touches=0;

    /* Touch handling */

    var touch_moves=0, touch_moved=false;
    var touch_x, touch_y, n_touches=0;
    var start_x, start_y;

    function content_touchstart(evt){
	touch_moves=0; touch_moved=false;
	var touches=evt.touches;
	var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
	touch_x=start_x=touch.screenX;
	touch_y=start_y=touch.screenY;
	if ((touches)&&(touches.length)) n_touches=touches.length;
	if (Codex.Trace.gestures>1) tracetouch("touchstart",evt);
	gesture_start=fdjtTime();
	touch_moved=false;
	if (n_touches===1) content_mousedown(evt);
	return;}

    function content_touchmove(evt){
	fdjtUI.cancel(evt);
	touch_moves++; touch_moved=true;
	if (touch_timer) {
	    clearTimeout(touch_timer);
	    touch_timer=false;}
	var touches=evt.touches;
	var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
	touch_x=touch.screenX;
	touch_y=touch.screenY;
	if ((touches)&&(touches.length)&&
	    (touches.length>n_touches))
	    n_touches=touches.length;
	if (Codex.Trace.gestures>2) tracetouch("touchmove",evt);
	return;}
    
    function content_touchend(evt){
	var target=fdjtUI.T(evt);
	if ((touch_timer_started)&&(!(touch_timer))) {
	    touch_timer_started=false;
	    return;}
	if (isClickable(target)) {
	    if (touch_timer) clearTimeout(touch_timer);
	    touch_timer=touch_timer_started=false;
	    return;}
	if (!(touch_timer)) {
	    touch_timer_started=false;
	    return;}
	// Identify swipes
	if (touch_moved) {
	    var dx=touch_x-start_x; var dy=touch_y-start_y;
	    var adx=((dx<0)?(-dx):(dx)); var ady=((dy<0)?(-dy):(dy));
	    var ad=((adx<ady)?(ady-adx):(adx-ady));
	    if (Codex.Trace.gestures)
		fdjtLog("touchend/gesture l=%o,%o s=%o,%o d=%o,%o |d|=%o,%o",
			last_x,last_y,start_x,start_y,dx,dy,adx,ady);
	    if (adx>(ady*3)) { /* horizontal */
		if (touch_timer) clearTimeout(touch_timer);
		touch_timer=touch_timer_started=false;
		fdjtUI.cancel(evt);
		if (n_touches===1) {
		    if (dx<0) Codex.Forward(evt);
		    else Codex.Backward(evt);}
		else {
		    if (dx<0) Codex.scanForward(evt);
		    else Codex.scanBackward(evt);}}
	    else content_mouseup(evt);
	    return;}
	else content_mouseup(evt);}

    /* Tracing touch */
    
    function tracetouch(handler,evt){
	evt=evt||event;
	var touches=evt.touches;
	var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
	var target=fdjtUI.T(evt); var ref=Codex.getRef(target);
	if (touch_started)
	    fdjtLog("%s(%o) n=%o %sts=%o %s@%o\n\t+%o %s%s%s%s%s%s%s s=%o,%o l=%o,%o p=%o,%o d=%o,%o ref=%o tm=%o",
		    handler,evt,((touches)&&(touches.length)),
		    ((!(touch))?(""):
		     ("c="+touch.clientX+","+touch.clientY+";s="+touch.screenX+","+touch.screenY+" ")),
		    touch_started,evt.type,target,
		    fdjtTime()-touch_started,
		    ((Codex.mode)?(Codex.mode+" "):""),
		    ((Codex.scanning)?"scanning ":""),
		    ((touch_held)?("held "):("")),
		    ((touch_moved)?("moved "):("")),
		    ((touch_scrolled)?("scrolled "):("")),
		    ((isClickable(target))?("clickable "):("")),
		    ((touch)?"":"notouch "),
		    start_x,start_y,last_x,last_y,page_x,page_y,
		    (((touch)&&(touch.screenX))?(touch.screenX-page_x):0),
		    (((touch)&&(touch.screenY))?(touch.screenY-page_y):0),
		    touch_ref,touch_moves);
	else fdjtLog("%s(%o) n=%o %s%s c=%o,%o p=%o,%o ts=%o %s@%o ref=%o",
		     handler,evt,((touches)&&(touches.length)),
		     ((Codex.mode)?(Codex.mode+" "):""),
		     ((Codex.scanning)?"scanning ":""),
		     touch.clientX,touch.clientY,touch.screenX,touch.screenY,
		     touch_started,evt.type,target,ref);
	if (ref) fdjtLog("%s(%o) ref=%o from %o",handler,evt,ref,target);}


    /* HUD touch */

    function hud_touchmove(evt){
	var target=fdjtUI.T(evt);
	if (isClickable(target)) return;
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
	var scroller=((Codex.scrolling)&&(Codex.scrollers)&&
		      (Codex.scrollers[Codex.scrolling]));
	if ((scroller)&&(scroller.motion)&&(scroller.motion>10)) return;
	else if (isClickable(target)) {
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

    /* Default click/tap */
    function default_tap(evt){
	var target=fdjtUI.T(evt);
	if (((Codex.hudup)||(Codex.mode))&&
	    (!(getParent(target,Codex.HUD))))
	    CodexMode(false);}

    /* Glossmarks */
    
    function glossmark_tapped(evt){
	evt=evt||event||null;
	if (held) clear_hold("glossmark_tapped");
	var target=fdjtUI.T(evt);
	var glossmark=getParent(target,".codexglossmark");
	var passage=getTarget(glossmark.parentNode,true);
	if (Codex.Trace.gestures)
	    fdjtLog("glossmark_tapped (%o) on %o gmark=%o passage=%o mode=%o target=%o",
		    evt,target,glossmark,passage,Codex.mode,Codex.target);
	if (!(glossmark)) return false;
	fdjtUI.cancel(evt);
	if ((Codex.mode==='glosses')&&(Codex.target===passage)) {
	    CodexMode(true);
	    return;}
	else Codex.showGlosses(passage);}

    var glossmark_animated=false;
    var glossmark_image=false;
    function animate_glossmark(target,enable){
	if (glossmark_animated) {
	    clearInterval(glossmark_animated);
	    glossmark_animated=false;
	    if (glossmark_image)
		fdjtUI.ImageSwap.reset(glossmark_image);}
	if ((target)&&(enable)) {
	    var glossmark=((hasClass(target,"codexglossmark"))?(target):
			   (getParent(target,".codexglossmark")));
	    if (!(glossmark)) return;
	    var bigimage=fdjtDOM.getChild(glossmark,"img.big");
	    if (!(bigimage)) return;
	    glossmark_image=bigimage;
	    glossmark_animated=fdjtUI.ImageSwap(bigimage,750);}}

    function glossmark_hoverstart(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	if (!(fdjtDOM.getParent(target,".codextarget")))
	    animate_glossmark(target,true);}

    function glossmark_hoverdone(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	if (!(fdjtDOM.getParent(target,".codextarget")))
	    animate_glossmark(target,false);}

    function setTargetUI(target){
	if (target) {
	    var glossmark=fdjtDOM.getChild(target,".codexglossmark");
	    if (glossmark) animate_glossmark(glossmark,true);
	    else animate_glossmark(false,false);}
	else animate_glossmark(false,false);}
    Codex.UI.setTarget=setTargetUI;

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
	/* 
	if ((Codex.mode==="glosses")||(Codex.mode==="addgloss"))
	CodexMode(true); else */
	CodexMode(false);
	if (((evt)&&(evt.shiftKey))||(n_touches>1))
	    scanForward();
	else pageForward();}
    Codex.Forward=Forward;
    function right_margin(evt){
	if (Codex.Trace.gestures) tracetouch("right_margin",evt);
	if (Codex.hudup) CodexMode(false);
	else Forward(evt);}

    function Backward(evt){
	var now=fdjtTime();
	if (!(evt)) evt=event||false;
	if (evt) fdjtUI.cancel(evt);
	if ((last_motion)&&((now-last_motion)<100)) return;
	else last_motion=now;
	/* if ((Codex.mode==="glosses")||(Codex.mode==="addgloss"))
	   CodexMode(true); else */
	CodexMode(false);
	if (Codex.Trace.nav)
	    fdjtLog("Backward e=%o h=%o t=%o",evt,Codex.head,Codex.target);
	if (((evt)&&(evt.shiftKey))||(n_touches>1))
	    scanBackward();
	else pageBackward();}
    Codex.Backward=Backward;
    function left_margin(evt){
	if (Codex.Trace.gestures) tracetouch("left_margin",evt);
	if (Codex.hudup) CodexMode(false);
	else Backward(evt);}


    function pageForward(){
	if (Codex.Trace.gestures)
	    fdjtLog("pageForward c=%o n=%o",Codex.curpage,Codex.pagecount);
	if ((Codex.mode==="scanning")||(Codex.mode==="tocscan"))
	    CodexMode(false);
	if ((Codex.bypage)&&(Codex.pagecount)) {
	    var newpage=false;
	    if (Codex.mode==="glosses") CodexMode(true);
	    if (Codex.curpage===Codex.pagecount) {}
	    else Codex.GoToPage(newpage=Codex.curpage+1,"pageForward",true);}
	else if (Codex.bysect) {
	    var win=Codex.window; var content=Codex.content;
	    var section=Codex.section;
	    var wbottom=win.scrollTop+win.offsetHeight;
	    var cbottom=section.offsetHeight+section.offsetTop;
	    // -parsePX(section.style.marginBottom)
	    var cursection=Codex.cursect;
	    if (wbottom>=cbottom) {
		if (cursection>=Codex.sections.length) {
		    fdjtLog("At end of last section");
		    return;}
		// Codex.sections is zero-based, while cursection is
		// one-based, so we just call it directly.
		var next=Codex.sections[cursection];
		var breaks=Codex.layout.getPageBreaks(next);
		// At the bottom of this section
		next={sectnum: cursection+1, section: next,
		      breaks: breaks, pageoff: 0,
		      tops: Codex.layout.pagetops[cursection],
		      off: 0};
		if (Codex.pagecount)
		    next.pagenum=Codex.layout.pagenums[cursection][0];
		Codex.GoToSection(next,"pageForward",true);}
	    else {
		var breaks=Codex.layout.getPageBreaks(section); var next=false;
		if (breaks.length<2) {
		    // This is the case where the section has been CSS-scaled,
		    //  which doesn't get reflected in the offsetHeight.
		    var next=Codex.sections[cursection];
		    var breaks=Codex.layout.getPageBreaks(next);
		    next={sectnum: cursection+1, section: next,
			  breaks: breaks, pageoff: 0,
			  tops: Codex.layout.pagetops[cursection],
			  off: 0};
		    if (Codex.pagecount)
			next.pagenum=Codex.layout.pagenums[cursection][0];
		    Codex.GoToSection(next,"pageForward",true);}
		else {
		    var pagetop=win.scrollTop;
		    var i=0, lim=breaks.length;
		    while ((i<lim)&&(pagetop>=breaks[i])) i++;
		    next={sectnum: cursection, section: section,
			  off: breaks[i], breaks: breaks, pageoff: i,
			  tops: Codex.layout.pagetops[cursection-1]};
		    if (Codex.pagecount)
			next.pagenum=Codex.layout.pagenums[cursection-1][i];
		    Codex.GoToSection(next,"pageForward",true);}}}
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
	if ((Codex.bypage)&&(Codex.pagecount)) {
	    var newpage=false;
	    if (Codex.mode==="glosses") CodexMode(true);
	    if (Codex.curpage===0) {}
	    else {
		Codex.GoToPage(newpage=Codex.curpage-1,"pageBackward",true);}}
	else if (Codex.bysect) {
	    var win=Codex.window;
	    var section=Codex.section;
	    var cursection=Codex.cursect;
	    if (win.scrollTop<=0) {
		if (cursection<=1) {
		    // beep?
		    fdjtLog("Already at beginning");
		    return;}
		// At top, go back a section
		var newsection=Codex.sections[cursection-2];
		var breaks=Codex.layout.getPageBreaks(newsection);
		var nbreaks=((breaks)?(breaks.length):(0));
		var next={sectnum: cursection-1,
			  section: newsection,
			  breaks: breaks, pageoff: nbreaks-1,
			  tops: Codex.layout.pagetops[cursection-2]||false,
			  off: ((breaks)?(breaks[nbreaks-1]):(0))};
		if (Codex.pagecount) 
		    next.pagenum=
		    Codex.layout.pagenums[cursection-2][nbreaks-1];
		Codex.GoToSection(next,"pageBackward",true);}
	    else {
		var breaks=Codex.layout.getPageBreaks(section);
		var pagetop=win.scrollTop;
		var i=breaks.length-1;
		while ((i>=0)&&(breaks[i]>=pagetop)) i--;
		var next={sectnum: cursection,
			  section: section,
			  breaks: breaks, pageoff: i,
			  tops: Codex.layout.pagetops[cursection-1],
			  off: breaks[i]};
		if (Codex.pagecount) 
		    next.pagenum=
		    Codex.layout.pagenums[cursection-1][i];
		Codex.GoToSection(next,"pageBackward",true);}}
	else {
	    var delta=fdjtDOM.viewHeight()-50;
	    if (delta<0) delta=fdjtDOM.viewHeight();
	    var newy=fdjtDOM.viewTop()-delta;
	    window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    Codex.pageBackward=pageBackward;

    function scanForward(){
	if (Codex.mode==="scanning") {}
	else if (Codex.mode==="tocscan") {}
	else if (Codex.mode==="glosses") {
	    var ids=Codex.docinfo._ids;
	    var id=((Codex.target)&&(Codex.target.id));
	    var glosses=Codex.glosses;
	    var i, lim=ids.length;
	    if ((id)&&((i=fdjtKB.position(ids,id))>0)) {
		i++; while (i<lim) {
		    var g=glosses.index(false,'frag',ids[i]);
		    if ((g)&&(g.length)) {
			var passage=fdjtID(ids[i]);
			Codex.GoTo(passage,"scanForward/glosses",true);
			Codex.showGlosses(passage);
			return;}
		    else i++;}}
	    CodexMode(false);
	    return;}
	else if (Codex.scanning) CodexMode("scanning");
	else CodexMode("tocscan");
	if (Codex.mode==="tocscan") {
	    var head=Codex.head;
	    var headid=head.codexbaseid||head.id;
	    var headinfo=Codex.docinfo[headid];
	    if (Codex.Trace.nav) 
		fdjtLog("scanForward/toc() head=%o info=%o n=%o h=%o",
			head,headinfo,headinfo.next,headinfo.head);
	    if (headinfo.next) Codex.GoTo(headinfo.next.elt,"scanForward");
	    else if ((headinfo.head)&&(headinfo.head.next)) {
		Codex.GoTo(headinfo.head.next.elt,"scanForward");
		CodexMode("toc");}
	    else if ((headinfo.head)&&(headinfo.head.head)&&
		     (headinfo.head.head.next)) 
		Codex.GoTo(headinfo.head.head.next.elt,"scanForward");
	    else CodexMode(false);
	    return;}
	var start=Codex.scanning;
	var scan=Codex.nextSlice(start);
	var ref=((scan)&&(Codex.getRef(scan)));
	if (Codex.Trace.nav) 
	    fdjtLog("scanForward() from %o/%o to %o/%o under %o",
		    start,Codex.getRef(start),scan,ref,Codex.scanning);
	if ((ref)&&(scan)) Codex.Scan(ref,scan);
	return scan;}
    Codex.scanForward=scanForward;

    function scanBackward(){
	if (Codex.mode==="scanning") {}
	else if (Codex.mode==="tocscan") {}
	else if (Codex.mode==="glosses") {
	    var ids=Codex.docinfo._ids;
	    var id=((Codex.target)&&(Codex.target.id));
	    var glosses=Codex.glosses;
	    var i, lim=ids.length;
	    if ((id)&&((i=fdjtKB.position(ids,id))>0)) {
		i--; while (i>=0) {
		    var g=glosses.index(false,'frag',ids[i]);
		    if ((g)&&(g.length)) {
			var passage=fdjtID(ids[i]);
			Codex.GoTo(passage,"scanBackward/glosses",true);
			Codex.showGlosses(passage);
			return;}
		    else i--;}}
	    CodexMode(false);
	    return;}
	else if (Codex.scanning) CodexMode("scanning");
	else CodexMode("tocscan");
	if (Codex.mode==="tocscan") {
	    var head=Codex.head;
	    var headid=head.codexbaseid||head.id;
	    var headinfo=Codex.docinfo[headid];
	    if (Codex.Trace.nav) 
		fdjtLog("scanBackward/toc() head=%o info=%o p=%o h=%o",
			head,headinfo,headinfo.prev,headinfo.head);
	    if (headinfo.prev) Codex.GoTo(headinfo.prev.elt,"scanBackward");
	    else if (headinfo.head) 
		Codex.GoTo(headinfo.head.elt,"scanBackward");
	    else CodexMode(false);
	    return;}
	var scan=Codex.prevSlice(Codex.scanning);
	var ref=((scan)&&(Codex.getRef(scan)));
	if (Codex.Trace.nav) 
	    fdjtLog("scanBackward() from %o/%o to %o/%o under %o",
		    start,Codex.getRef(start),scan,ref,Codex.scanning);
	if ((ref)&&(scan)) Codex.Scan(ref,scan);
	return scan;}
    Codex.scanBackward=scanBackward;

    function scanner_tapped(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	if (isClickable(target)) return;
	if ((getParent(target,".tool"))) {
	    var card=getCard(target);
	    if ((card)&&((card.name)||(card.getAttribute("name")))) {
		var name=(card.name)||(card.getAttribute("name"));
		var gloss=fdjtKB.ref(name,Codex.glosses);
		if (!(gloss)) return;
		var form=Codex.setGlossTarget(gloss);
		if (!(form)) return;
		CodexMode("addgloss");
		return;}
	    else return;}
	if ((hasClass(target,"ellipsis"))||
	    (getParent(target,".ellipsis"))) {
	    var ellipsis=getParent(target,".ellipsis");
	    if (ellipsis) {
		if (hasClass(ellipsis,"expanded")) {
		    dropClass(ellipsis,"expanded");}
		else {
		    addClass(ellipsis,"expanded");
		    fdjtDOM.addClass("CODEXSCANNER","expanded");}
		fdjtUI.cancel(evt);
		return;}}
	// Tapping the tochead returns to results/glosses/etc
 	var scanning=Codex.scanning;
	if (!(scanning)) return;
	if (getParent(scanning,fdjtID("CODEXALLGLOSSES"))) {
	    CodexMode("allglosses");
	    fdjtUI.cancel(evt);}
	else if (getParent(scanning,fdjtID("CODEXSEARCHRESULTS"))) {
	    CodexMode("searchresults");
	    fdjtUI.cancel(evt);}
	else {}
	return;}

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
	if (isClickable(evt)) return;
	else CodexMode(false);}

    function getOffX(evt){
	evt=evt||event;
	if ((evt.touches)&&(evt.touches.length)) {
	    var touch=evt.touches[0];
	    var pinfo=fdjtID("CODEXPAGEINFO");
	    var target=touch.target;
	    while ((target)&&(target.nodeType!==1)) target=target.parentNode;
	    var geom=getGeometry(target,pinfo);
	    var tx=geom.left;
	    return touch.clientX-(tx+pinfo.offsetLeft);}
	else if ((evt.clientX)) {
	    var pinfo=fdjtID("CODEXPAGEINFO");
	    return evt.clientX-(pinfo.offsetLeft);}
	else return false;}

    var hasParent=fdjtDOM.hasParent;

    function head_tap(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	if (Codex.Trace.gestures) fdjtLog("head_tap %o t=%o",evt,target);
	if (!((target===CodexHUD.head)||
	      (target===CodexHUD.tabs)))
	    return;
	else if (Codex.mode) {
	    fdjtUI.cancel(evt);
	    CodexMode(false);}
	else if (fdjtDOM.hasClass(document.body,"codexhelp")) {
	    fdjtUI.cancel(evt);
	    fdjtDOM.dropClass(document.body,"codexhelp");}
	else if (Codex.hudup) {
	    fdjtUI.cancel(evt);
	    CodexMode(false);}
	else {
	    fdjtUI.cancel(evt);
	    CodexMode(true);}}
    function foot_tap(evt){
	if (Codex.Trace.gestures) fdjtLog("foot_tap %o",evt);
	if (isClickable(evt)) return;
	else if ((Codex.hudup)||(Codex.mode)||(Codex.cxthelp)) {
	    fdjtUI.cancel(evt);
	    CodexMode(false);
	    return;}}

    function pageinfo_tap(evt){
	var pageinfo=fdjtID("CODEXPAGEINFO");
	if ((Codex.hudup)||(Codex.mode)||(Codex.cxthelp)) {
	    fdjtUI.cancel(evt);
	    CodexMode(false);
	    return;}
	var offx=getOffX(evt);
	var offwidth=pageinfo.offsetWidth;
	var gopage=Math.floor((offx/offwidth)*Codex.pagecount)+1;
	if ((Codex.Trace.gestures)||(hasClass(pageinfo,"codextrace")))
	    fdjtLog("pageinfo_tap %o off=%o/%o=%o gopage=%o/%o",
		    evt,offx,offwidth,offx/offwidth,
		    gopage,Codex.pagecount);
	if (!(offx)) return;
	fdjtUI.cancel(evt);
	Codex.GoToPage(gopage,"pageinfo_tap",true);
	CodexMode(false);}

    function pageinfo_hold(evt){
	var pageinfo=fdjtID("CODEXPAGEINFO");
	if ((Codex.hudup)||(Codex.mode)) {
	    fdjtUI.cancel(evt);
	    CodexMode(false);
	    return;}
	var offx=getOffX(evt);
	var offwidth=pageinfo.offsetWidth;
	var gopage=Math.floor((offx/offwidth)*Codex.pagecount)+1;
	if (gopage===1)
	    fdjtLog("gopage=%d, offx=%o",gopage,offx);
	if ((Codex.Trace.gestures)||(hasClass(pageinfo,"codextrace")))
	    fdjtLog("pageinfo_hold %o off=%o/%o=%o gopage=%o/%o",
		    evt,offx,offwidth,offx/offwidth,
		    gopage,Codex.pagecount);
	pageinfo.title=
	    fdjtString("Release to return to page %d",Codex.curpage);
	if (!(offx)) return;
	Codex.startPagePreview(gopage,"pageinfo_hold");}
    
    function pageinfo_release(evt){
	var pageinfo=fdjtID("CODEXPAGEINFO");
	pageinfo.title="";
	Codex.stopPagePreview("pageinfo_release");}

    var showing_page=false;
    function pageinfo_hover(evt){
	var pageinfo=fdjtID("CODEXPAGEINFO");
	var target=fdjtUI.T(evt);
	var offx=getOffX(evt);
	var offwidth=pageinfo.offsetWidth;
	var showpage=Math.floor((offx/offwidth)*Codex.pagecount)+1;
	if ((Codex.Trace.gestures)||(hasClass(pageinfo,"codextrace")))
	    fdjtLog("pageinfo_hover %o off=%o/%o=%o showpage=%o/%o pressed=%o",
		    evt,offx,offwidth,offx/offwidth,
		    showpage,Codex.pagecount,fdjtUI.TapHold.ispressed());
	if (showpage!==showing_page) {
	    pageinfo.title=
		fdjtString(
		    "click to go to page %d, hold to glimpse its preview",
		    showpage);
	    showing_page=showpage;}
	if (Codex.previewing) {
	    var page=Codex.getPage(showpage);
	    if (hasClass(page,"curpage")) return;
	    Codex.startPreview(showpage,"pageinfo_hover");}}
    
    /* Gloss form handlers */

    /**** Clicking on outlets *****/
    
    function glossform_outlets_tapped(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	if (getParent(target,".checkspan"))
	    return fdjtUI.CheckSpan.onclick(evt);
	else if (getParent(target,".sharing"))
	    toggleClass(getParent(target,".sharing"),"expanded");
	else {}}
    Codex.UI.outlets_tapped=glossform_outlets_tapped;

    function outlet_tapped(evt){
	var target=fdjtUI.T(evt);
	var outletspan=fdjtDOM.getParent(target,'.outlet');
	if (!(outletspan)) return;
	var live=fdjtID("CODEXLIVEGLOSS");
	var form=((live)&&(fdjtDOM.getChild(live,"form")));
	var outlet=outletspan.value;
	Codex.addOutlet2Form(form,outlet);
	fdjtUI.cancel(evt);}

    var glossmodes=Codex.glossmodes;

    function glossmode_button(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var alt=target.alt;
	
	var form=fdjtDOM.getParent(target,'form');
	if (!(alt)) return;
	if (alt==="tag") {
	    altclass="addtag";
	    input=fdjtID("CODEXTAGINPUT");}
	else if (alt==="link") {
	    altclass="addlink";
	    input=fdjtID("CODEXURLINPUT");}
	else if (alt==="excerpt") {
	    altclass="excerpt";
	    input=fdjtDOM.getInput(form,'EXCERPT');}
	else if (alt==="note") {
	    altclass="editnote";
	    input=fdjtDOM.getInput(form,'NOTE');}
	else if (alt==="sharing") {
	    altclass="sharing";
	    input=fdjtID("CODEXOUTLETINPUT");}
	else return;
	// fdjtLog("glossmode_button gm=%s input=%o",altclass,input);
	fdjtUI.cancel(evt);
	if (!(hasClass(form,altclass))) {
	    if (alt==="tag") {
		addClass("CODEXHEART","tagging");
		Codex.UI.updateScroller("CODEXGLOSSTAGS");}
	    else dropClass("CODEXHEART","tagging");
	    if (alt==="sharing") {
		addClass("CODEXHEART","showoutlets");
		Codex.UI.updateScroller("CODEXGLOSSOUTLETS");}
	    else dropClass("CODEXHEART","showoutlets");
	    if (alt==="link") 
		addClass("CODEXHEART","addlink");
	    else dropClass("CODEXHEART","addlink");
	    swapClass(form,glossmodes,altclass);
	    Codex.setHUD(true);
	    Codex.setFocus(input);}
	else {
	    dropClass("CODEXHEART","tagging");
	    dropClass("CODEXHEART","showoutlets");
	    dropClass("CODEXHEART","addlink");
	    dropClass(form,glossmodes);}}

    function submitGloss(evt){
	fdjtUI.cancel(evt);
	return fdjtUI.submitEvent(evt);}

    /* Changing gloss networks */

    function changeGlossNetwork(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var alternate=((fdjtDOM.hasParent(target,".codexglossform"))?
		       ("CODEXNETWORKBUTTONS"):(("CODEXLIVEGLOSS")));
	var doppels=fdjtDOM.getInputsFor(alternate,'NETWORKS',target.value);
	fdjtUI.CheckSpan.set(doppels,target.checked);}
    Codex.UI.changeGlossNetwork=changeGlossNetwork;

    function changeGlossPosting(evt){
	var target=fdjtUI.T(evt=(evt||event));
	var alternate=((fdjtDOM.hasParent(target,".codexglossform"))?
		       ("CODEXNETWORKBUTTONS"):(("CODEXLIVEGLOSS")));
	var doppels=fdjtDOM.getInputs(alternate,'POSTGLOSS');
	fdjtUI.CheckSpan.set(doppels,target.checked);}
    Codex.UI.changeGlossPosting=changeGlossPosting;

    /* Back to the text */

    function back_to_reading(evt){
	evt=evt||event;
	fdjtUI.cancel(evt);
	CodexMode(false);
	fdjtDOM.dropClass(document.body,"codexhelp");}

    /* Rules */

    var noBubble=fdjtUI.noBubble;
    var cancel=fdjtUI.cancel;

    function hideSplash(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	if (fdjtUI.isClickable(target)) return;
	else CodexMode(false);}

    function hideSplashToggle(evt) {
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var newval=(!(Codex.hidesplash));
	var input=getParent(target,"input");
	if (input)
	    setTimeout(function(){
		Codex.setConfig("hidesplash",input.checked);
		Codex.saveConfig();},
		       100);
	else {
	    Codex.setConfig("hidesplash",newval);
	    Codex.saveConfig();}
	if ((newval)&&(Codex._setup)&&
	    ((fdjtTime()-(Codex._setup.getTime()))<30000))
	    CodexMode(false);}

    function toggleHelp(evt){
	evt=evt||event;
	fdjtUI.cancel(evt);
	if (Codex.cxthelp) {
	    fdjtDOM.dropClass(document.body,"codexhelp");
	    Codex.cxthelp=false;}
	else {
	    fdjtDOM.addClass(document.body,"codexhelp");
	    Codex.cxthelp=true;}
	return false;}
    Codex.toggleHelp=toggleHelp;

    function editglossnote(evt){
	evt=evt||event;
	setGlossMode("editnote");
	fdjtUI.cancel(evt);}

    Codex.UI.handlers.mouse=
	{window: {
	    keyup: onkeyup,
	    keydown: onkeydown,
	    keypress: onkeypress,
	    mouseup: default_tap},
	 content: {mousedown: content_mousedown,
		   mouseup: content_mouseup},
	 toc: {tap: toc_tapped,hold: toc_held,
	       release: toc_released,slip: toc_slipped,
	       mouseover: fdjtUI.CoHi.onmouseover,
	       mouseout: fdjtUI.CoHi.onmouseout,
	       click: cancel},
	 glossmark: {mouseup: glossmark_tapped, mousedown: cancel,
		     mouseover: glossmark_hoverstart,
		     mouseout: glossmark_hoverdone},
	 glossbutton: {mouseup: glossbutton_ontap,mousedown: cancel},
	 summary: {tap: slice_tapped, hold: slice_held,
		   release: slice_released},
	 "#CODEXSTARTPAGE": {click: Codex.UI.dropHUD},
	 "#CODEXHUDHELP": {click: Codex.UI.dropHUD},
	 ".helphud": {click: Codex.UI.dropHUD},
	 ".codexheart": {tap: flyleaf_tap},
	 "#CODEXPAGEINFO": {tap: pageinfo_tap,
			    hold: pageinfo_hold,
			    release: pageinfo_release,
			    mousemove: pageinfo_hover},
	 "#CODEXPAGENOTEXT": {tap: enterPageNum},
	 "#CODEXLOCOFF": {tap: enterLocation},
	 // Return to scan
	 "#CODEXSCANNER": {click: scanner_tapped},
	 // Raise and lower HUD
	 "#CODEXPAGEHEAD": {click: head_tap},
	 "#CODEXTABS": {click: head_tap},
	 "#CODEXHEAD": {click: head_tap},
	 "#CODEXPAGEFOOT": {tap: foot_tap},
	 // Forward and backwards
	 "#CODEXPAGELEFT": {click: left_margin},
	 "#CODEXPAGERIGHT": {click: right_margin},
	 "#HIDESPLASHCHECKSPAN" : {click: hideSplashToggle},
	 "#CODEXTAGINPUT": {keydown: addtag_keydown},
	 "#CODEXOUTLETINPUT": {keydown: addoutlet_keydown},
	 "#CODEXURLINPUT": {click: addlink_keydown},
	 "#CODEXURLTITLE": {click: addlink_keydown},
	 "#CODEXADDLINKOK": {click: addlink_action},
	 "#CODEXADDLINKCANCEL": {click: addlink_cancel},
	 "#CODEXOUTLETCLOUD": {tap: outlet_tapped},
	 "#CODEXHELPBUTTON": {
	     click: toggleHelp, mousedown: cancel,mouseup: cancel},
	 "#CODEXHELP": {
	     click: toggleHelp, mousedown: cancel,mouseup: cancel},
	 "#CODEXSHOWTEXT": {click: back_to_reading},
	 "#CODEXAPPSTATUS": {click: hideSplash},
	 ".hudmodebutton": {click:hudbutton,mouseup:cancel,mousedown:cancel},
	 // GLOSSFORM rules
	 "span.codexglossdelete": { click: delete_ontap },
	 "span.codexglossrespond": { click: respond_ontap },
	 "span.codexsharegloss": {tap: fdjtUI.CheckSpan.onclick},
	 ".submitbutton": {click: submitGloss },
	 "div.glossetc": {click: fdjtUI.CheckSpan.onclick},
	 "div.glossetc div.sharing": {click: glossform_outlets_tapped},
	 "div.glossetc span.modebuttons": {click: glossmode_button},
	 "div.glossetc div.notetext": {click: editglossnote}};

    Codex.UI.handlers.webtouch=
	{window: {
	    keyup: onkeyup,
	    keydown: onkeydown,
	    keypress: onkeypress,
	    touchmove: cancel},
	 content: {touchstart: content_touchstart,
		   touchmove: content_touchmove,
		   touchend: content_touchend},
	 toc: {tap: toc_tapped,hold: toc_held,
	       release: toc_released,slip: toc_slipped},
	 glossmark: {touchstart: glossmark_tapped,
		     touchend: cancel},
	 // glossbutton: {mouseup: glossbutton_ontap,mousedown: cancel},
	 summary: {tap: slice_tapped, hold: slice_held,release: slice_released},
	 "#CODEXSTARTPAGE": {click: Codex.UI.dropHUD},
	 "#CODEXHUDHELP": {click: Codex.UI.dropHUD},
	 ".helphud": {click: Codex.UI.dropHUD},
	 "#CODEXPAGEFOOT": {},
	 "#CODEXPAGEINFO": {tap: pageinfo_tap,
			    hold: pageinfo_hold,
			    release: pageinfo_release},
	 "#CODEXPAGENOTEXT": {tap: enterPageNum},
	 "#CODEXLOCOFF": {tap: enterLocation},
	 // Return to scan
	 "#CODEXSCANNER": {touchstart: scanner_tapped},
	 // Raise and lower HUD
	 "#CODEXPAGEHEAD": {touchstart: head_tap},
	 "#CODEXTABS": {touchstart: head_tap},
	 "#CODEXHEAD": {click: head_tap},
	 "#CODEXFOOT": {tap: foot_tap},
	 // Forward and backwards
	 "#CODEXPAGELEFT": {touchstart: left_margin},
	 "#CODEXPAGERIGHT": {touchstart: right_margin},
	 "#CODEXTAGINPUT": {keydown: addtag_keydown},
	 "#CODEXOUTLETINPUT": {keydown: addoutlet_keydown},
	 "#CODEXURLINPUT": {click: addlink_keydown},
	 "#CODEXURLTITLE": {click: addlink_keydown},
	 "#CODEXADDLINKOK": {click: addlink_action},
	 "#CODEXADDLINKCANCEL": {click: addlink_cancel},
	 "#CODEXOUTLETCLOUD": {tap: outlet_tapped},
	 "#HIDESPLASHCHECKSPAN" : {tap: hideSplashToggle},
	 "#CODEXHELPBUTTON": {click: toggleHelp},
	 "#CODEXHELP": {click: toggleHelp},
	 "#CODEXSHOWTEXT": {click: back_to_reading},
	 "#CODEXAPPSTATUS": {click: hideSplash},
	 /* ".hudbutton": {mouseover:hudbutton,mouseout:hudbutton}, */
	 ".hudmodebutton": {click: hudbutton},
	 // GLOSSFORM rules
	 "span.codexglossdelete": { click: delete_ontap },
	 "span.codexglossrespond": { click: respond_ontap },
	 "span.codexsharegloss": {click: fdjtUI.CheckSpan.onclick},
	 ".submitbutton": {click: submitGloss },
	 "div.glossetc span.links": {click: fdjtUI.CheckSpan.onclick},
	 "div.glossetc span.tags": {click: fdjtUI.CheckSpan.onclick},
	 "div.glossetc div.sharing": {click: glossform_outlets_tapped},
	 "div.glossetc span.modebuttons": {click: glossmode_button},
	 "div.glossetc div.notetext": {click: editglossnote}};
    
})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/

