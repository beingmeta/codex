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
    var isClickable=fdjtUI.isClickable;
    var getGeometry=fdjtDOM.getGeometry;

    var submitEvent=fdjtUI.submitEvent;

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

    function setupGestures(domnode){
	var mode=Codex.ui;
	if (!(mode)) Codex.ui=mode="mouse";
	if (!(domnode)) {
	    addHandlers(false,'window');
	    addHandlers(fdjtID("CODEXPAGE"),'content');
	    addHandlers(Codex.HUD,'hud');}
	var handlers=Codex.UI.handlers[mode];
	if (mode)
	    for (var key in handlers)
		if ((key.indexOf('.')>=0)||(key.indexOf('#')>=0)) {
		    var nodes=fdjtDOM.$(key,domnode);
		    var h=handlers[key];
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
	img=fdjtDOM.Image(cxicon("remarkballoon32x32.png"),".codexglossbutton",
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

    /* Generic content handler */

    function content_tapped(evt,target){
	if (!(target)) target=fdjtUI.T(evt);
	// Don't capture modified events
	if ((evt.shiftKey)||(evt.ctrlKey)||(evt.altKey)) return;
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
	    return;}
	var passage=getTarget(target);
	// We get the passage here so we can include it in the trace message
	if (Codex.Trace.gestures)
	    fdjtLog("content_tapped (%o) on %o passage=%o mode=%o",
		    evt,target,passage,Codex.mode);
	// These should have their own handlers
	if ((isClickable(target))||
	    // (fdjtDOM.hasParent(target,".codexglossbutton"))||
	    (fdjtDOM.hasParent(target,".codexglossmark"))) {
	    if (Codex.Trace.gestures)
		fdjtLog("deferring content_tapped (%o) on %o",
			evt,target,passage,Codex.mode);
	    return;}
	// If there's a selection, store it as an excerpt.
	var sel=window.getSelection();
	if ((sel)&&(sel.anchorNode)&&(!(emptySelection(sel)))) {
	    var p=getTarget(sel.anchorNode)||
		getTarget(sel.focusNode)||
		passage;
	    if (p) {
		if ((Codex.mode==="addgloss")&&
		    (fdjtID("CODEXLIVEGLOSS"))) {
		    Codex.addExcerpt(
			fdjtID("CODEXLIVEGLOSS"),
			sel.toString(),
			((Codex.glosstarget!==p)&&
			 ((p.id)||p.codexdupid)));}
		else {
		    Codex.excerpt=sel.toString();
		    tapTarget(p);}
		return;}
	    else CodexMode(false);}
	if ((Codex.hudup)&&(passage)&&(Codex.mode==='addgloss')&&
	    ((gloss_focus)||((fdjtTime()-gloss_blurred)<1000))) {
	    if (passage===Codex.target) CodexMode(false);
	    else tapTarget(passage);}
	else if ((passage)&&(passage===Codex.target)&&(Codex.hudup)) {
	    Codex.setTarget(false);
	    CodexMode(false);}
	else if (passage)
	    tapTarget(passage);
	else if ((Codex.mode)||(Codex.hudup))
	    CodexMode(false);
	else CodexMode(true);}

    /* Tap actions */

    function tapTarget(target){
	if (Codex.Trace.gestures)
	    fdjtLog("Tap on target %o mode=%o",target,Codex.mode);
	Codex.setTarget(target);
	addGlossButton(target);
	CodexMode(true);}

    function edgeTap(evt,x){
	if (!(evt)) evt=event||false;
	var pageom=getGeometry(Codex.page,document.body);
	if (typeof x !== 'number') x=((evt)&&getOffX(evt));
	if (typeof x !== 'number') x=last_x;
	if (typeof x === 'number') {
	    if (Codex.Trace.gestures)
		fdjtLog("edgeTap %o x=%o w=%o g=%j",evt,x,
			fdjtDOM.viewWidth(),pageom);
	    if (x<0) {Backward(evt); return true;}
	    else if (x>pageom.width) {
		Forward(evt); return true;}
	    else return false}
	else return false;}
    Codex.edgeTap=edgeTap;
    
    function edge_click(evt) {
	var target=fdjtUI.T(evt);
	if ((isClickable(target))||
	    (fdjtDOM.hasParent(target,".codexglossbutton"))||
	    (fdjtDOM.hasParent(target,".codexglossmark")))
	    return;
	if (edgeTap(evt)) fdjtUI.cancel(evt);}

    /* HUD handlers */

    function hud_tapped(evt,target){
	if (!(target)) target=fdjtUI.T(evt);
	if (isClickable(target)) return;
	else if (fdjtDOM.hasParent(target,".helphud")) {
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
		Codex.setGlossTarget(gloss);	    
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
	    Codex.setGlossTarget(gloss);	    
	    CodexMode("addgloss");
	    fdjtUI.cancel(evt);}
	else {}}
    
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
	    Codex.setFocus(fdjtID("CODEXSEARCHINPUT"));
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
	var frag=gloss.get("frag");
	fdjtAjax.jsonCall(
	    function(response){glossdeleted(response,qref,frag);},
	    "https://"+Codex.server+"/glosses/delete",
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
	Codex.setGlossTarget(gloss,Codex.getGlossForm(gloss,true));
	CodexMode("addgloss");}
    Codex.UI.respond_ontap=respond_ontap;

    function glossdeleted(response,glossid,frag){
	if (response===glossid) {
	    Codex.glosses.drop(glossid);
	    Codex.allglosses=fdjtKB.remove(Codex.allglosses,glossid);
	    if (Codex.offline)
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
			fdjtDOM.replace(rendering,fdjtDOM("div.codexcard.deletedgloss"));
		    else fdjtDOM.remove(rendering);}}
	    var glossmark=fdjtID("SBOOK_GLOSSMARK_"+frag);
	    if (glossmark) {
		var newglosses=fdjtKB.remove(glossmark.glosses,glossid);
		if (newglosses.length===0) fdjtDOM.remove(glossmark);
		else glossmark.glosses=newglosses;}}
	else alert(response);}

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
		    evt,mode,(isClickable(target)),
		    Codex.scanning,Codex.hudup,CodexMode());
	fdjtUI.cancel(evt);
	if (!(mode)) return;
	var hudid=((mode)&&(mode_hud_map[mode]));
	var hud=fdjtID(hudid);
	if ((evt.type==='click')||(evt.type==='touchend')) {
	    if (hud) dropClass(hud,"hover");
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
	evt=evt||event;
	var touches=evt.touches;
	var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
	var target=fdjtUI.T(evt); var ref=Codex.getRef(target);
	if (touch_started)
	    fdjtLog("%s(%o) n=%o %sts=%o %s@%o\n\t+%o %s%s%s%s%s%s%s s=%o,%o l=%o,%o p=%o,%o d=%o,%o ref=%o tt=%o tm=%o",
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
		    touch_ref,touch_timer,touch_moves);
	else fdjtLog("%s(%o) n=%o %s%s c=%o,%o p=%o,%o ts=%o %s@%o ref=%o",
		     handler,evt,((touches)&&(touches.length)),
		     ((Codex.mode)?(Codex.mode+" "):""),
		     ((Codex.scanning)?"scanning ":""),
		     touch.clientX,touch.clientY,touch.screenX,touch.screenY,
		     touch_started,evt.type,target,ref);
	if (ref) fdjtLog("%s(%o) ref=%o from %o",handler,evt,ref,target);}

    /* Touch handling */

    function shared_touchstart(evt){
	evt=evt||event||false;
	var target=fdjtUI.T(evt);
	if (isClickable(target)) return;
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
	var passage=getTarget(target);
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
		    (passage.id||(passage.codexdupid));
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
	    Codex.addExcerpt(form,text,excerpt_elt.passageid);
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
	if (isClickable(target)) return;
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
	mouseisdown=false; // For faketouch
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
	if ((Codex.mode==="glosses")||(Codex.mode==="addgloss"))
	    CodexMode(true);
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
	    var headid=head.id||head.codexdupid;
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
	    var headid=head.id||head.codexdupid;
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

    function scanner_tapped(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	if (isClickable(target)) return;
	if (getParent(target,".tool")) return;
	var scanning=Codex.scanning;
	if (!(scanning)) return;
	var hudparent=getParent(scanning,".hudpanel");
	if (getParent(scanning,fdjtID("CODEXBROWSEGLOSSES"))) {
	    CodexMode("allglosses");
	    fdjtUI.cancel(evt);}
	else if (getParent(scanning,fdjtID("CODEXSEARCH"))) {
	    CodexMode("searchresults");
	    fdjtUI.cancel(evt);}
	else {}}

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
	if (typeof evt.offsetX === "number") return evt.offsetX;
	else if ((evt.touches)&&(evt.touches.length)) {
	    var touch=evt.touches[0];
	    var pinfo=fdjtID("CODEXPAGEINFO");
	    var target=touch.target;
	    while ((target)&&(target.nodeType!==1)) target=target.parentNode;
	    var geom=getGeometry(target,pinfo);
	    var tx=geom.left;
	    return touch.clientX-(tx+pinfo.offsetLeft);}
	else return false;}

    function head_click(evt){
	if (Codex.Trace.gestures) fdjtLog("head_click %o",evt);
	if (isClickable(evt)) return;
	else if (Codex.mode==='help') {
	    fdjtUI.cancel(evt);
	    CodexMode(true);}
	else if (Codex.mode) return;
	else {
	    fdjtUI.cancel(evt);
	    CodexMode(true);}}
    function foot_click(evt){
	if (Codex.Trace.gestures) fdjtLog("foot_click %o",evt);
	if (isClickable(evt)) return;
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
	var offx=getOffX(evt);
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
	/* 
	fdjtLog("%o type=%o ox=%o ow=%o gl=%o p=%o",
		evt,evt.type,offx,offwidth,goloc,page); */
	if ((evt.type==='touchmove')||
	    ((evt.type==='mousemove')&&((evt.button)||(evt.shiftKey)))) {
	    if ((typeof page === 'number')&&(page!==Codex.curpage))
		Codex.GoToPage(page);}}
    

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

    var glossmodes=Codex.glossmodes;

    function glossmode_button(evt){
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var alt=target.alt, altclass, input;
	var form=fdjtDOM.getParent(target,'form');
	if (!(alt)) return;
	if (alt==="tag") {
	    altclass="addtag";
	    input=fdjtDOM.getInput(form,'TAG');}
	else if (alt==="link") {
	    altclass="addlink";
	    input=fdjtDOM.getInput(form,'LINK');}
	else if (alt==="excerpt") {
	    altclass="excerpt";
	    input=fdjtDOM.getInput(form,'EXCERPT');}
	else if (alt==="note") {
	    altclass="editnote";
	    input=fdjtDOM.getInput(form,'NOTE');}
	else return;
	if (alt==="tag") addClass("CODEXADDGLOSS","tagging");
	else dropClass("CODEXADDGLOSS","tagging");
	fdjtLog("glossmode_button gm=%s input=%o",altclass,input);
	if (!(hasClass(form,altclass))) {
	    swapClass(form,glossmodes,altclass);
	    Codex.setFocus(input);}
	else {
	    dropClass(form,glossmodes);
	    if ((alt==="tag")||(alt==="link")||(alt==="excerpt")) {}
	    else {}}}

    /* Rules */

    var nobubble=fdjtUI.nobubble;
    var cancel=fdjtUI.cancel;

    function hideSplashToggle(evt) {
	evt=evt||event;
	var target=fdjtUI.T(evt);
	var newval=(!(Codex.hidesplash));
	var input=getParent(target,"input");
	if (input)
	    setTimeout(function(){
		Codex.setConfig('hidesplash',input.checked);
		Codex.saveConfig();},
		       100);
	else {
	    Codex.setConfig('hidesplash',newval);
	    Codex.saveConfig();}
	if ((newval)&&(Codex._setup)&&
	    ((fdjtTime()-(Codex._setup.getTime()))<30000))
	    CodexMode(false);}
    Codex.UI.handlers.mouse=
	{window: {
	    keyup: onkeyup,
	    keydown: onkeydown,
	    keypress: onkeypress},
	 content: {mouseup: content_tapped},
	 hud: {click: hud_tapped},
	 glossmark: {mouseup: glossmark_tapped},
	 glossbutton: {mouseup: glossbutton_ontap,mousedown: cancel},
	 // ".codexmargin": {click: edge_click},
	 "#CODEXHELP": {click: Codex.UI.dropHUD},
	 "#CODEXFLYLEAF": {click: flyleaf_tap},
	 "#CODEXPAGEINFO": {click: pageinfo_click, mousemove: pageinfo_hover},
	 "#CODEXPAGENOTEXT": {click: enterPageNum},
	 "#CODEXLOCOFF": {click: enterLocation},
	 "#CODEXSCANNER": {click: scanner_tapped},
	 "#CODEXPAGEHEAD": {click: head_click},
	 "#CODEXHEAD": {click: head_click},
	 "#CODEXPAGEFOOT": {click: foot_click},
	 "#CODEXPAGELEFT": {click: left_margin},
	 "#CODEXPAGERIGHT": {click: right_margin},
	 "#HIDESPLASHCHECKSPAN" : {click: hideSplashToggle},
	 "#HIDEHELPBUTTON" : {click: function(evt){CodexMode(false);}},
	 // Not really used any more
	 "#CODEXPAGENEXT": {click: Codex.Forward},
	 /* ".hudbutton": {mouseover:hudbutton,mouseout:hudbutton}, */
	 ".hudmodebutton": {click:hudbutton,mouseup:cancel,mousedown:cancel},
	 toc: {mouseover: fdjtUI.CoHi.onmouseover,
	       mouseout: fdjtUI.CoHi.onmouseout},
	 // GLOSSFORM rules
	 "span.codexglossdelete": { click: delete_ontap },
	 "span.codexglossrespond": { click: respond_ontap },
	 "div.submitbutton": {click: submitEvent },
	 "div.glossetc span.links": {click: fdjtUI.CheckSpan.onclick},
	 "div.glossetc span.tags": {click: fdjtUI.CheckSpan.onclick},
	 "div.glossetc div.sharing": {
	     click: glossform_outlets_tapped},
	 "div.glossetc span.modebuttons": {
	     click: glossmode_button}};

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
	 "#CODEXPAGELEFT": {
	     touchstart: cancel,
	     touchmove: cancel,
	     touchend: left_margin},
	 "#CODEXPAGERIGHT": {
	     touchstart: cancel,
	     touchmove: cancel,
	     touchend: right_margin},
	 "#CODEXHELP": {touchstart: Codex.UI.dropHUD,
			touchmove: cancel,
			touchend: cancel},
	 "#CODEXSCANNER": {touchstart: scanner_tapped},
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
		       touchmove: cancel},
	 // GLOSSFORM rules
	 "span.codexglossdelete": {
	     touchend: delete_ontap, touchstart: cancel, touchmove: cancel},
	 "span.codexglossrespond": {
	     touchend: respond_ontap, touchstart: cancel, touchmove: cancel},
	 "div.submitbutton": {
	     touchend: submitEvent, touchstart: cancel, touchmove: cancel},
	 "div.glossetc span.links": {
	     touchend: fdjtUI.CheckSpan.onclick,
	     touchstart: cancel, touchmove: cancel},
	 "div.glossetc span.tags": {
	     touchend: fdjtUI.CheckSpan.onclick,
	     touchstart: cancel, touchmove: cancel},
	 "div.glossetc div.sharing": {
	     touchend: glossform_outlets_tapped,
	     touchstart: cancel, touchmove: cancel},
	 "div.glossetc span.modebuttons": {
	     touchend: glossmode_button,
	     touchstart: cancel, touchmove: cancel}};
    
})();

fdjt_versions.decl("codex",codex_interaction_version);
fdjt_versions.decl("codex/interaction",codex_interaction_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/

