/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/hud.js ###################### */

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

Codex.setMode=
    (function(){
	// Helpful dimensions
	var head_height=false, foot_height=false;
	var help_top=false, help_bottom=false;
	// The BOX HUD (contains scrollable content) and its margins
	var box_top=false; var box_bottom=false;
	// This is the HUD where all glosses are displayed
	var sbookGlossesHUD=false;
	// This is the HUD for tag searching
	var sbookSearchHUD=false;
	// How long to let messages flash up
	var message_timeout=5000;
	// Whether to call displaySync on mode changes
	var display_sync=false;
	
	var addClass=fdjtDOM.addClass;
	var dropClass=fdjtDOM.dropClass;
	var hasClass=fdjtDOM.hasClass;
	var getParent=fdjtDOM.getParent;
	var getGeometry=fdjtDOM.getGeometry;
	var getChild=fdjtDOM.getChild;
	var hasSuffix=fdjtString.hasSuffix;
	var Ref=fdjtKB.Ref;

	var CodexHUD=false;

	// This will contain the interactive input console (for debugging)
	var input_console;
	var input_button;

	function initHUD(){
	    if (fdjtID("CODEXHUD")) return;
	    var messages=fdjtDOM("div.startupmessages");
	    messages.innerHTML=Codex.HTML.messages;
	    var hud=Codex.HUD=CodexHUD=fdjtDOM("div#CODEXHUD");
	    hud.codexui=true;
	    hud.innerHTML=Codex.HTML.hud;
	    fdjtDOM.prepend(document.body,
			    messages,
			    fdjtDOM("div.fdjtprogress#CODEXLAYOUTMESSAGE",
				    fdjtDOM("div.indicator"),
				    fdjtDOM("div.message")),
			    fdjtID("HUMANE"),
			    hud);
	    // Fill in the HUD help
	    var hudhelp=fdjtID("CODEXHUDHELP");
	    hudhelp.innerHTML=Codex.HTML.hudhelp;
	    // Set up the start page and the reader help
	    var startpage=Codex.HUD.startpage=fdjtID("CODEXSTARTPAGE");
	    // Set up the help page
	    var help=Codex.DOM.help=fdjtID("CODEXHELP");
	    help.innerHTML=Codex.HTML.help;
	    // Set up the app splash/status page
	    var splash=Codex.DOM.appstatus=fdjtID("CODEXAPPSTATUS");
	    splash.innerHTML=Codex.HTML.splash;
	    // Setup heart
	    var heart=fdjtID("CODEXHEART");
	    heart.innerHTML=Codex.HTML.hudheart;
	    Codex.DOM.heart=heart;
	    // Setup settings
	    var settings=fdjtID("CODEXSETTINGS");
	    settings.innerHTML=Codex.HTML.settings;
	    Codex.DOM.settings=settings;
	    // Other HUD parts
	    Codex.DOM.head=fdjtID("CODEXHEAD");
	    Codex.DOM.heart=fdjtID("CODEXHEART");
	    Codex.DOM.foot=fdjtID("CODEXFOOT");
	    Codex.DOM.tabs=fdjtID("CODEXTABS");
	    // Initialize search UI
	    var search=fdjtID("CODEXSEARCH");
	    search.innerHTML=Codex.HTML.searchbox;
	    Codex.empty_cloud=
		new fdjtUI.Completions(fdjtID("CODEXSEARCHCLOUD"));
	    // Setup addgloss prototype
	    var addgloss=fdjtID("CODEXADDGLOSSPROTOTYPE");
	    addgloss.innerHTML=Codex.HTML.addgloss;

	    Codex.DOM.sbooksapp=fdjtID("SBOOKSAPP");
	    Codex.DOM.allglosses=fdjtID("CODEXALLGLOSSES");
	    
	    if (!(Codex.svg)) {
		var images=fdjtDOM.getChildren(hud,"img");
		var i=0; var lim=images.length;
		while (i<lim) {
		    var img=images[i++];
		    if ((img.src)&&
			((hasSuffix(img.src,".svg"))||
			 (hasSuffix(img.src,".svgz")))&&
			(img.getAttribute('bmp')))
			img.src=img.getAttribute('bmp');}}

	    Codex.hudtick=fdjtTime();

	    fdjtID("SBOOK_RETURN_TO").value=location.href;

	    // Initialize gloss UI
	    var glosses=fdjtID("CODEXALLGLOSSES");
	    Codex.UI.setupSummaryDiv(glosses);
	    Codex.glosses.addEffect("maker",function(f,p,v){
		Codex.sourcekb.ref(v).oninit
		(Codex.UI.addGlossSource,"newsource");});
	    Codex.glosses.addEffect("sources",function(f,p,v){
		Codex.sourcekb.ref(v).oninit
		(Codex.UI.addGlossSource,"newsource");});

	    function addGloss2UI(item){
		if (document.getElementById(item.frag)) {
		    var addGlossmark=Codex.UI.addGlossmark;
		    Codex.UI.addToSlice(item,glosses,false);
		    var nodes=Codex.getDups(item.frag);
		    addClass(nodes,"glossed");
		    var i=0, lim=nodes.length; while (i<lim) {
			addGlossmark(nodes[i++],item);}
		    if (item.tstamp>Codex.syncstamp)
			Codex.syncstamp=item.tstamp;}}
	    Codex.glosses.addInit(addGloss2UI);

	    var tagHTML=Knodule.HTML;

	    function addTag2GlossCloud(tag){
		if (!(tag)) return;
		else if (tag instanceof Array) {
		    var i=0; var lim=tag.length;
		    while (i<lim) addTag2GlossCloud(tag[i++]);
		    return;}
		else if (!(Codex.gloss_cloud)) {
		    // If the HUD hasn't been initialized, add the tag
		    //  to queues for addition.
		    var queue=Codex.gloss_cloud_queue;
		    if (!(queue)) queue=Codex.gloss_cloud_queue=[];
		    queue.push(tag);}
		else if ((tag instanceof Ref)&&(!(tag._init)))
		    // If it's uninitialized, delay adding it
		    tag.oninit(addTag2GlossCloud,"addTag2GlossCloud");
		// Skip weak tags
		else if ((tag instanceof Ref)&&(tag.weak)) return;
		else {
		    var gloss_cloud=Codex.glossCloud();
		    var search_cloud=Codex.searchCloud();
		    var ref=((tag instanceof Ref)?(tag):
			     ((fdjtKB.probe(tag,Codex.knodule))||
			      (fdjtKB.ref(tag,Codex.knodule))));
		    var ref_tag=(((ref)&&(ref.tagString))&&
				 (ref.tagString(Codex.knodule)))||
			((ref)&&((ref._id)||(ref.uuid)||(ref.oid)))||
			(tag);
		    var gloss_tag=gloss_cloud.getByValue(ref_tag,".completion");
		    if (!((gloss_tag)&&(gloss_tag.length))) {
			gloss_tag=tagHTML(tag,Codex.knodule,false,true);
			if ((ref)&&(ref.pool===Codex.sourcekb))
			    fdjtDOM(fdjtID("CODEXGLOSSCLOUDSOURCES"),
				    gloss_tag," ");
			else fdjtDOM(fdjtID("CODEXGLOSSCLOUDTAGS"),
				     gloss_tag," ");
			gloss_cloud.addCompletion(gloss_tag);}}}
	    Codex.addTag2GlossCloud=addTag2GlossCloud;
	    
	    function addOutlets2UI(outlets){
		if (typeof outlets === 'string')
		    outlets=Codex.sourcekb.ref(outlets);
		if (!(outlets)) return;
		if (!(outlets instanceof Array)) outlets=[outlets];
		if (!(Codex.outlet_cloud)) {
		    // If the HUD hasn't been initialized, add the tag
		    //  to queues for addition.
		    var queue=Codex.outlet_cloud_queue;
		    if (!(queue)) queue=Codex.outlet_cloud_queue=[];
		    queue=Codex.outlet_cloud_queue=queue.concat(outlets);
		    return;}
		else {
		    var i=0; var lim=outlets.length;
		    var loaded=[];
		    while (i<lim) {
			var outlet=outlets[i++];
			if (typeof outlet === 'string')
			    outlet=fdjtKB.ref(outlet);
			if ((outlet instanceof Ref)&&(!(outlet._init)))
			    outlet.oninit(addOutlets2UI,"addOutlets2UI");
			else loaded.push(outlet);}
		    var cloud=Codex.outletCloud()
		    var form=fdjtID("CODEXADDGLOSSPROTOTYPE");
		    i=0; lim=loaded.length; while (i<lim) {
			var outlet=loaded[i++];
			if (i<=5)
			    Codex.addOutlet2Form(form,outlet,false);
			addOutlet2Cloud(outlet,cloud);}
		    return;}}
	    Codex.addOutlets2UI=addOutlets2UI;
	    
	    /* Initializing outlets */
	    
	    function addOutlet2Cloud(outlet,cloud) {
		if (typeof outlet === 'string')
		    outlet=fdjtKB.load(outlet);
		var humid=outlet.humid;
		var sourcetag=fdjtID("cxOUTLET"+humid);
		if (!(sourcetag)) { // Add entry to the share cloud
		    var completion=fdjtDOM(
			"span.completion.source",outlet.name);
		    completion.id="cxOUTLET"+humid;
		    completion.setAttribute("value",outlet._id);
		    completion.setAttribute("key",outlet.name);
		    if ((outlet.description)&&(outlet.nick))
			completion.title=outlet.name+": "+
			outlet.description;
		    else if (outlet.description)
			completion.title=outlet.description;
		    else if (outlet.nick) completion.title=outlet.name;
		    fdjtDOM(cloud.dom,completion," ");
		    if (cloud) cloud.addCompletion(completion);}}
	    
	    var cloudEntry=Codex.cloudEntry;

	    function addTag2SearchCloud(tag){
		if (!(tag)) return;
		else if (tag instanceof Array) {
		    var i=0; var lim=tag.length;
		    while (i<lim) addTag2SearchCloud(tag[i++]);
		    return;}
		else if (!(Codex.search_cloud)) {
		    // If the HUD hasn't been initialized, add the tag
		    //  to queues for addition.
		    var queue=Codex.search_cloud_queue;
		    if (!(queue)) queue=Codex.search_cloud_queue=[];
		    queue.push(tag);}
		else if ((tag instanceof Ref)&&(!(tag._init)))
		    // If it's uninitialized, delay adding it
		    tag.oninit(addTag2SearchCloud,"addTag2SearchCloud");
		else {
		    var search_cloud=Codex.searchCloud();
		    var div=search_cloud.dom;
		    var tagstring=((tag.tagString)?(tag.tagString()):(tag));
		    var search_tag=
			search_cloud.getByValue(tagstring,".completion");
		    var container=div;
		    var ref=((typeof tag === 'string')?
			     (fdjtKB.ref(tag,Codex.knodule)):
			     (tag));
		    if (!(ref)) {
			if (tag[0]==="\u00a7")
			    container=getChild(div,".sections")||container;
			else container=getChild(div,".words")||div;}
		    else if (ref.weak)
			container=getChild(div,".weak");
		    else if (ref.prime)
			container=getChild(div,".prime");
		    else if (ref.pool===Codex.sourcekb)
			container=getChild(div,".sources");
		    else {}
		    if (!(container)) container=div;
		    if (!((search_tag)&&(search_tag.length))) {
			search_tag=cloudEntry(tag,Codex.knodule,false,true);
			fdjtDOM(container,search_tag," ");
			search_cloud.addCompletion(search_tag,false,tag);}}}
	    Codex.addTag2SearchCloud=addTag2SearchCloud;
	    
	    var console=fdjtID("CODEXCONSOLE");
	    input_console=fdjtDOM.getChild(console,"TEXTAREA");
	    input_button=fdjtDOM.getChild(console,"span.button");
	    input_button.onclick=consolebutton_click;
	    input_console.onkeypress=consoleinput_keypress;

	    var appframe=fdjtID("SBOOKSAPP");
	    var appwindow=((appframe)&&(appframe.contentWindow));
	    if (appwindow.postMessage) {
		if (Codex.Trace.messages)
		    fdjtLog("Setting up message listener");
		fdjtDOM.addListener(window,"message",function(evt){
		    var origin=evt.origin;
		    if (Codex.Trace.messages)
			fdjtLog("Got a message from %s with payload %s",
				origin,evt.data);
		    if (origin.search(/https:\/\/[^\/]+.sbooks.net/)!==0) {
			fdjtLog.warn("Rejecting insecure message from %s",
				     origin);
			return;}
		    if (evt.data==="sbooksapp") {
			CodexMode("sbooksapp");}
		    else if (evt.data==="loggedin") {
			if (!(Codex.user)) Codex.userSetup();}
		    else if (evt.data)
			fdjtDOM("CODEXINTRO",evt.data);
		    else {}});}


	    // Set up the splash form
	    var splashform=fdjtID("CODEXSPLASHFORM");
	    var docinput=fdjtDOM.getInput(splashform,"DOCURI");
	    if (docinput) docinput.value=Codex.docuri;
	    var refinput=fdjtDOM.getInput(splashform,"REFURI");
	    if (refinput) refinput.value=Codex.refuri;
	    var topinput=fdjtDOM.getInput(splashform,"TOPURI");
	    if (topinput) topinput.value=document.location.href;
	    if ((Codex.user)&&(Codex.user.email)) {
		var nameinput=fdjtDOM.getInput(splashform,"USERNAME");
		if (nameinput) nameinput.value=Codex.user.email;}
	    var query=document.location.search||"?";
	    var appuri="https://"+Codex.server+"/flyleaf"+query;
	    var refuri=Codex.refuri;
	    if (query.search("REFURI=")<0)
		appuri=appuri+"&REFURI="+encodeURIComponent(refuri);
	    if (query.search("TOPURI=")<0)
		appuri=appuri+"&TOPURI="+
		encodeURIComponent(document.location.href);
	    if (document.title) {
		appuri=appuri+"&DOCTITLE="+encodeURIComponent(document.title);}
	    fdjtID("CODEXSPLASH_RETURN_TO").value=appuri;
	    	    
	    fdjtUI.TapHold(Codex.DOM.foot,Codex.touch);

	    fillinTabs();
	    resizeHUD();

	    Codex.scrollers={};
	    updateScroller("CODEXGLOSSTAGS");
	    updateScroller("CODEXSEARCHCLOUD");
	    fdjtDOM.setupCustomInputs(fdjtID("CODEXHUD"));}
	Codex.initHUD=initHUD;
	
	function fixStaticRefs(string){
	    if (Codex.root==="http://static.beingmeta.com/codex/")
		return string;
	    else return string.replace
	    (/http:\/\/static.beingmeta.com\/codex\//g,
	     Codex.root);}

	function resizeHUD(){
	    var vh=fdjtDOM.viewHeight();
	    var vw=fdjtDOM.viewWidth();
	    var hf=fdjtID("CODEXFOOT");
	    var fh=fdjtDOM.getGeometry(hf).height;
	    // fdjtLog("resizeHUD vh=%o vw=%o fh=%o",vh,vw,fh);
	    if (!(Codex.nativescroll)) hf.style.top=(vh-fh)+'px';}
	Codex.resizeHUD=resizeHUD;

	/* This is used for viewport-based browser, where the HUD moves
	   to be aligned with the viewport */
	
	var sbook_sync_off=false;
	var sbook_sync_height=false;
	
	function getBounds(elt){
	    var style=fdjtDOM.getStyle(elt);
	    return { top: fdjtDOM.parsePX(style.marginTop)||0+
		     fdjtDOM.parsePX(style.borderTop)||0+
		     fdjtDOM.parsePX(style.paddingTop)||0,
		     bottom: fdjtDOM.parsePX(style.marginBottom)||0+
		     fdjtDOM.parsePX(style.borderBottom)||0+
		     fdjtDOM.parsePX(style.paddingBottom)||0};}
	fdjtDOM.getBounds=getBounds;
	
	/* Creating the HUD */
	
	function setupTOC(root_info){
	    var navhud=createNavHUD("div#CODEXTOC.hudpanel",root_info);
	    var toc_button=fdjtID("CODEXTOCBUTTON");
	    toc_button.style.visibility='';
	    Codex.DOM.toc=navhud;
	    fdjtDOM.replace("CODEXTOC",navhud);
	    var flytoc=createStaticTOC("div#CODEXFLYTOC.hudpanel",root_info);
	    Codex.Flytoc=flytoc;
	    fdjtDOM.replace("CODEXFLYTOC",flytoc);}
	Codex.setupTOC=setupTOC;

	function createNavHUD(eltspec,root_info){
	    var scan=root_info;
	    while (scan) {
		if ((!(scan.sub))||(scan.sub.length===0)) break;
		else if (scan.sub.length>1) {
		    root_info=scan; break;}
		else scan=scan.sub[0];}
	    var toc_div=Codex.TOC(root_info,0,false,"CODEXTOC4",true);
	    var div=fdjtDOM(eltspec||"div#CODEXTOC.hudpanel",toc_div);
	    Codex.UI.addHandlers(div,"toc");
	    return div;}

	function createStaticTOC(eltspec,root_info){
	    var toc_div=Codex.TOC(root_info,0,false,"CODEXFLYTOC4");
	    var div=fdjtDOM(eltspec||"div#CODEXFLYTOC",toc_div);
	    Codex.UI.addHandlers(div,"toc");
	    return div;}

	/* HUD animation */

	function setHUD(flag,clearmode){
	    if (typeof clearmode === 'undefined') clearmode=true;
	    // clearmode=((Codex.mode!=='scanning')&&(Codex.mode!=='tocscan'));
	    if ((Codex.Trace.gestures)||(Codex.Trace.mode))
		fdjtLog("setHUD %o mode=%o hudup=%o bc=%o hc=%o",
			flag,Codex.mode,Codex.hudup,
			document.body.className,
			CodexHUD.className);
	    if (flag) {
		Codex.hudup=true;
		addClass(document.body,"hudup");}
	    else {
		Codex.hudup=false;
		Codex.scrolling=false;
		if (Codex.previewing) Codex.stopPreview();
		if (clearmode) {
		    var wait=false;
		    dropClass(CodexHUD,"openheart");
		    dropClass(CodexHUD,"openhead");
		    dropClass(CodexHUD,"full");
		    dropClass(CodexHUD,CodexMode_pat);
		    Codex.mode=false;}
		dropClass(document.body,"hudup");}}
	Codex.setHUD=setHUD;

	/* Mode controls */
	
	var CodexMode_pat=/\b((status)|(device)|(sbooksapp)|(scanning)|(tocscan)|(search)|(searchresults)|(toc)|(glosses)|(allglosses)|(context)|(flytoc)|(about)|(console)|(minimal)|(addgloss)|(editexcerpt)|(gotoloc)|(gotopage))\b/g;
	var codexHeartMode_pat=/\b((device)|(sbooksapp)|(flytoc)|(about)|(console)|(search)|(searchresults)|(allglosses)|(login))\b/g;
	var codexHeadMode_pat=/\b((toc)|(search)|(searchresults)|(glosses)|(allglosses)|(addgloss)|(gotopage)|(gotoloc)|(tocscan))\b/g;
	var codex_mode_scrollers=
	    {allglosses: "CODEXALLGLOSSES",
	     searchresults: "CODEXSEARCHRESULTS",
	     search: "CODEXSEARCHCLOUD",
	     console: "CODEXCONSOLE",
	     // sbooksapp: "SBOOKSAPP",
	     device: "CODEXSETTINGS",
	     flytoc: "CODEXFLYTOC",
	     about: "CODEXABOUTBOOK"};
	var codex_mode_foci=
	    {gotopage: "CODEXPAGEINPUT",
	     gotoloc: "CODEXLOCINPUT",
	     search: "CODEXSEARCHINPUT"};
	var hide_startup_help=true;
	
	function CodexMode(mode){
	    var oldmode=Codex.mode;
	    if (typeof mode === 'undefined') return oldmode;
	    if (mode==='last') mode=Codex.last_mode;
	    if (mode==='none') mode=false;
	    if (mode==='heart') mode=Codex.heart_mode||"about";
	    if (Codex.Trace.mode)
		fdjtLog("CodexMode %o, cur=%o dbc=%o",
			mode,Codex.mode,document.body.className);
	    if ((mode!==Codex.mode)&&(Codex.previewing))
		Codex.stopPreview();
	    if ((Codex.mode==="addgloss")&&(mode!==Codex.mode)) {
		var live=fdjtID("CODEXLIVEGLOSS");
		if ((live)&&(hasClass(live,"modified"))) {
		    fdjtUI.choose([
			{label: "Discard",
			 handler: function(){Codex.cancelGloss(live);}},
			{label: "Save",
			 handler: function(){
			     var form=fdjtDOM.getChild(live,"form");
			     fdjtUI.forceSubmit(form);}}],
				  "Save the changes to this gloss?");}
		else if (live) Codex.cancelGloss(live);
		else {}}
	    if (mode) {
		if ((mode==="scanning")||(mode==="tocscan"))
		    addClass(document.body,"cxSHRINK");
		else if (mode==="addgloss") {}
		else dropClass(document.body,"cxSHRINK");
		if (mode===Codex.mode) {}
		else if (mode===true) {
		    /* True just puts up the HUD with no mode info */
		    if (codex_mode_foci[Codex.mode]) {
			var input=fdjtID(codex_mode_foci[Codex.mode]);
			input.blur();}
		    Codex.mode=false;
		    Codex.last_mode=true;}
		else if (typeof mode !== 'string') 
		    throw new Error('mode arg not a string');
		else {
		    if (codex_mode_foci[Codex.mode]) {
			var input=fdjtID(codex_mode_foci[Codex.mode]);
			input.blur();}
		    Codex.mode=mode;}
		// If we're switching to the inner app but the iframe
		//  hasn't been initialized, we do it now.
		if ((mode==="sbooksapp")&&
		    (!(fdjtID("SBOOKSAPP").src))&&
		    (!(Codex.appinit)))
		    initFlyleafApp();
		// Update Codex.scrolling which is the scrolling
		// element in the HUD for this mode
		if (!(typeof mode === 'string'))
		    Codex.scrolling=false;
		else if (codex_mode_scrollers[mode]) 
		    Codex.scrolling=(codex_mode_scrollers[mode]);
		else Codex.scrolling=false;

		// Scanning is a funny mode in that the HUD is down
		//  for it.  We handle all of this stuff here.
		if ((mode==='scanning')||
		    (mode==='tocscan')||
		    (mode==='status')) {
		    if (mode!==oldmode) {
			Codex.hudup=false;
			dropClass(CodexHUD,"openheart");
			dropClass(CodexHUD,"full");
			dropClass(document.body,"hudup");}}
		else if (mode==='addgloss') {}
		// And if we're not scanning, we just raise the hud
		else setHUD(true);
		// Actually change the class on the HUD object
		if (mode===true) {
		    fdjtDOM.swapClass(CodexHUD,CodexMode_pat,"minimal");
		    dropClass(CodexHUD,"openhead");
		    dropClass(CodexHUD,"openheart");}
		else {
		    if (mode.search(codexHeartMode_pat)<0) {
			dropClass(CodexHUD,"openheart");}
		    if (mode.search(codexHeadMode_pat)<0)
			dropClass(CodexHUD,"openhead");
		    if (mode.search(codexHeartMode_pat)>=0) {
			Codex.heart_mode=mode;
			addClass(CodexHUD,"openheart");}
		    if (mode.search(codexHeadMode_pat)>=0) {
			Codex.head_mode=mode;
			addClass(CodexHUD,"openhead");}}
		
		changeMode(mode);}
	    else {
		// Clearing the mode is a lot simpler, in part because
		//  setHUD clears most of the classes when it brings
		//  the HUD down.
		fdjtLog.HumaneHide();
		Codex.last_mode=Codex.mode;
		if (Codex.liveinput) {
		    Codex.liveinput.blur();
		    Codex.liveinput=false;}
		document.body.focus();
		dropClass(CodexHUD,"openheart");
		dropClass(CodexHUD,"openhead");
		dropClass(document.body,"dimmed");
		dropClass(document.body,"codexhelp");
		dropClass(document.body,"cxPREVIEW");
		dropClass(document.body,"cxSHRINK");
		Codex.cxthelp=false;
		if (display_sync) Codex.displaySync();
		setHUD(false);}}

	function focus(input){
	    input.focus(); Codex.liveinput=input;}
	Codex.setFocus=focus;

	function changeMode(mode){	
	    fdjtDOM.dropClass(CodexHUD,CodexMode_pat);
	    fdjtDOM.addClass(CodexHUD,mode);
	    // This updates scanning state
	    if ((Codex.scanning)&&(mode!=="scanning")) {
		// Scroll the scanned content (glosses, search
		// results, etc) to reflect any motion
		var heart=Codex.DOM.heart;
		var height=heart.offsetHeight;
		var scanning=Codex.scanning;
		var content=getParent(scanning,".hudpanel");
		var scrolltop=content.scrollTop;
		var scrollbottom=content.scrollTop+height;
		var inner=getGeometry(scanning,content);
		
		if (inner.height<=0) {} /* Not displayed */
		else if ((inner.top<scrolltop)||(inner.bottom>scrollbottom)) {
		    // Scroll into view
		    if (inner.height>height) content.scrollTop=inner.top;
		    else if (inner.height>height/2)
			content.scrollTop=Math.floor(inner.top-(height/2));
		    else {
			var gap=height-inner.height;
			content.scrollTop=Math.floor(inner.top-(gap/2));}}
		else {} // Already in view
		Codex.scanning=false;}
	    
	    // This updates scroller dimensions, we delay it
	    //  because apparently, on some browsers, the DOM
	    //  needs to catch up with CSS
	    if (Codex.scrolling) {
		var scroller=fdjtID(Codex.scrolling);
		if (Codex.Trace.scroll)
		    fdjtLog("Updating scroller for #%s s=%o",
			    Codex.scrolling,scroller);
		setTimeout(function(){updateScroller(scroller);},
			   2000);}
	    
	    // We autofocus any input element appropriate to the
	    // mode
	    if (codex_mode_foci[mode]) {
		var input=fdjtID(codex_mode_foci[mode]);
		if (input) focus(input);}
	    // Moving the focus back to the body lets keys work
	    else document.body.focus();
	    
	    if (display_sync) Codex.displaySync();}

	function fadeUpHUD(){
	    fdjtLog("Setting properties");
	    CodexHUD.style.opacity=0.001;
	    setTimeout(function(){
		fdjtLog("Changing opacity");
		CodexHUD.style.opacity=1.00;
		setTimeout(function(){
		    fdjtLog("Clearing setup");
		    CodexHUD.style.opacity='';},
			   1500);},
		       1500);}
	Codex.fadeUpHUD=fadeUpHUD;

	// function updateScroller(elt){}
	function updateScroller(elt){
	    if (Codex.scrolldivs) return;
	    if (typeof elt === 'string') elt=fdjtID(elt);
	    fdjtLog("updateScroller elt=%o",elt);
	    if (!(elt)) return;
	    if ((Codex.scrollers[elt.id])&&
		(Codex.scrollers[elt.id].element===elt)) {
		var scroller=Codex.scrollers[elt.id];
		if (Codex.Trace.scroll)
		    fdjtLog("updateScroller/refresh %o",scroller);
		scroller.refresh();}
	    else {
		var scroller=new iScroll(elt);
		if (Codex.Trace.scroll)
		    fdjtLog("updateScroller/create %o",scroller);
		Codex.scrollers[elt.id]=scroller;}}
	Codex.UI.updateScroller=updateScroller;

	function CodexHUDToggle(mode,keephud){
	    if (!(Codex.mode)) CodexMode(mode);
	    else if (mode===Codex.mode)
		if (keephud) CodexMode(true); else CodexMode(false);
	    else if ((mode==='heart')&&
		     (Codex.mode.search(codexHeartMode_pat)===0))
		if (keephud) CodexMode(true); else CodexMode(false);
	    else CodexMode(mode);}
	CodexMode.toggle=CodexHUDToggle;

	Codex.dropHUD=function(){return CodexMode(false);}
	Codex.toggleHUD=function(evt){
	    evt=evt||event;
	    if ((evt)&&(fdjtUI.isClickable(fdjtUI.T(evt)))) return;
	    fdjtLog("toggle HUD %o hudup=%o",evt,Codex.hudup);
	    if (Codex.hudup) setHUD(false,false);
	    else setHUD(true);};
	
	/* The App HUD */
	
	function fillinTabs(){
	    var hidehelp=fdjtID("SBOOKHIDEHELP");
	    var dohidehelp=fdjtState.getCookie("sbookhidehelp");
	    if (!(hidehelp)) {}
	    else if (dohidehelp==='no') hidehelp.checked=false;
	    else if (dohidehelp) hidehelp.checked=true;
	    else hidehelp.checked=false;
	    if (hidehelp)
		hidehelp.onchange=function(evt){
		    if (hidehelp.checked)
			fdjtState.setCookie("sbookhidehelp",true,false,"/");
		    else fdjtState.setCookie("sbookhidehelp","no",false,"/");};
	    var refuris=document.getElementsByName("REFURI");
	    if (refuris) {
		var i=0; var len=refuris.length;
		while (i<len)
		    if (refuris[i].value==='fillin')
			refuris[i++].value=Codex.refuri;
		else i++;}
	    fillinAboutInfo();
	    /* Get various external APPLINK uris */
	    var offlineuri=fdjtDOM.getLink("Codex.offline")||altLink("offline");
	    var epuburi=fdjtDOM.getLink("Codex.epub")||altLink("ebub");
	    var mobiuri=fdjtDOM.getLink("Codex.mobi")||altLink("mobi");
	    var zipuri=fdjtDOM.getLink("Codex.mobi")||altLink("mobi");
	    if (offlineuri) {
		var elts=document.getElementsByName("SBOOKOFFLINELINK");
		var i=0; while (i<elts.length) {
		    var elt=elts[i++];
		    if (offlineuri!=='none') elt.href=offlineuri;
		    else {
			elt.href=false;
			addClass(elt,"deadlink");
			elt.title='this sBook is not available offline';}}}
	    if (epuburi) {
		var elts=document.getElementsByName("SBOOKEPUBLINK");
		var i=0; while (i<elts.length) {
		    var elt=elts[i++];
		    if (epuburi!=='none') elt.href=epuburi;
		    else {
			elt.href=false;
			addClass(elt,"deadlink");
			elt.title='this sBook is not available as an ePub';}}}
	    if (mobiuri) {
		var elts=document.getElementsByName("SBOOKMOBILINK");
		var i=0; while (i<elts.length) {
		    var elt=elts[i++];
		    if (mobiuri!=='none') elt.href=mobiuri;
		    else {
			elt.href=false;
			addClass(elt,"deadlink");
			elt.title=
			    'this sBook is not available as a MOBIpocket format eBook';}}}
	    if (zipuri) {
		var elts=document.getElementsByName("SBOOKZIPLINK");
		var i=0; while (i<elts.length) {
		    var elt=elts[i++];
		    if (zipuri!=='none') elt.href=zipuri;
		    else {
			elt.href=false;
			addClass(elt,"deadlink");
			elt.title=
			    'this sBook is not available as a ZIP bundle';}}}
	    /* If the book is offline, don't bother showing the link
	       to the offline version. */
	    if (Codex.persist) addClass(document.body,"sbookoffline");}

	function altLink(type,uri){
	    uri=uri||Codex.refuri;
	    if (uri.search("http://")===0)
		return "http://offline."+uri.slice(7);
	    else if (uri.search("https://")===0)
		return "https://offline."+uri.slice(8);
	    else return false;}

	function _sbookFillTemplate(template,spec,content){
	    if (!(content)) return;
	    var elt=fdjtDOM.$(spec,template);
	    if ((elt)&&(elt.length>0)) elt=elt[0];
	    else return;
	    if (typeof content === 'string')
		elt.innerHTML=content;
	    else if (content.cloneNode)
		fdjtDOM.replace(elt,content.cloneNode(true));
	    else fdjtDOM(elt,content);}

	function fillinAboutInfo(){
	    var about=fdjtID("CODEXABOUTBOOK");
	    var bookabout=fdjtID("SBOOKABOUTPAGE")||fdjtID("SBOOKABOUT");
	    var authorabout=fdjtID("SBOOKAUTHORPAGE")||
		fdjtID("SBOOKABOUTAUTHOR");
	    var acknowledgements=
		fdjtID("SBOOKACKNOWLEDGEMENTSPAGE")||
		fdjtID("SBOOKACKNOWLEDGEMENTS");
	    var metadata=fdjtDOM.Anchor(
		"https://www.sbooks.net/publish/metadata?REFURI="+
		    encodeURIComponent(Codex.refuri),
		"metadata",
		"edit metadata");
	    metadata.target="_blank";
	    metadata.title=
		"View (and possibly edit) the metadata for this book";
	    var reviews=fdjtDOM.Anchor(
		null,
		// "https://www.sbooks.net/publish/reviews?REFURI="+
		//		    encodeURIComponent(Codex.refuri),
		"reviews",
		"see/add reviews");
	    reviews.target="_blank";
	    reviews.title="Sorry, not yet implemented";
	    // fdjtDOM(about,fdjtDOM("div.links",metadata,reviews));

	    if (bookabout) fdjtDOM(about,bookabout);
	    else {
		var title=
		    fdjtID("SBOOKTITLE")||
		    fdjtDOM.getMeta("Codex.title")||
		    fdjtDOM.getMeta("SBOOK.title")||
		    fdjtDOM.getMeta("DC.title")||
		    fdjtDOM.getMeta("~TITLE")||
		    document.title;
		var byline=
		    fdjtID("SBOOKBYLINE")||fdjtID("SBOOKAUTHOR")||
		    fdjtDOM.getMeta("Codex.byline")||
		    fdjtDOM.getMeta("Codex.author")||
		    fdjtDOM.getMeta("SBOOK.byline")||
		    fdjtDOM.getMeta("SBOOK.author")||
		    fdjtDOM.getMeta("BYLINE")||
		    fdjtDOM.getMeta("AUTHOR");
		var copyright=
		    fdjtID("SBOOKCOPYRIGHT")||
		    fdjtDOM.getMeta("Codex.copyright")||
		    fdjtDOM.getMeta("Codex.rights")||
		    fdjtDOM.getMeta("SBOOK.copyright")||
		    fdjtDOM.getMeta("SBOOK.rights")||
		    fdjtDOM.getMeta("COPYRIGHT")||
		    fdjtDOM.getMeta("RIGHTS");
		var publisher=
		    fdjtID("SBOOKPUBLISHER")||
		    fdjtDOM.getMeta("Codex.publisher")||
		    fdjtDOM.getMeta("SBOOK.publisher")||		    
		    fdjtDOM.getMeta("PUBLISHER");
		var description=
		    fdjtID("SBOOKDESCRIPTION")||
		    fdjtDOM.getMeta("Codex.description")||
		    fdjtDOM.getMeta("SBOOK.description")||
		    fdjtDOM.getMeta("DESCRIPTION");
		var digitized=
		    fdjtID("SBOOKDIGITIZED")||
		    fdjtDOM.getMeta("Codex.digitized")||
		    fdjtDOM.getMeta("SBOOK.digitized")||
		    fdjtDOM.getMeta("DIGITIZED");
		var sbookified=fdjtID("SBOOK.converted")||
		    fdjtDOM.getMeta("SBOOK.converted");
		_sbookFillTemplate(about,".title",title);
		_sbookFillTemplate(about,".byline",byline);
		_sbookFillTemplate(about,".publisher",publisher);
		_sbookFillTemplate(about,".copyright",copyright);
		_sbookFillTemplate(about,".description",description);
		_sbookFillTemplate(about,".digitized",digitized);
		_sbookFillTemplate(about,".sbookified",sbookified);
		_sbookFillTemplate(about,".about",fdjtID("SBOOKABOUT"));
		var cover=fdjtDOM.getLink("cover");
		if (cover) {
		    var cover_elt=fdjtDOM.$(".cover",about)[0];
		    if (cover_elt) fdjtDOM(cover_elt,fdjtDOM.Image(cover));}}
	    if (authorabout) fdjtDOM(about,authorabout);
	    if (acknowledgements) {
		var clone=acknowledgements.cloneNode(true);
		clone.id=null;
		fdjtDOM(about,clone);}}

	var flyleaf_app_init=false;
	function initFlyleafApp(){
	    if (flyleaf_app_init) return;
	    if (Codex.appinit) return;
	    var query=document.location.search||"?";
	    var refuri=Codex.refuri;
	    var appuri="https://"+Codex.server+"/flyleaf"+query;
	    if (query.search("REFURI=")<0)
		appuri=appuri+"&REFURI="+encodeURIComponent(refuri);
	    if (query.search("TOPURI=")<0)
		appuri=appuri+"&TOPURI="+
		encodeURIComponent(document.location.href);
	    if (document.title) {
		appuri=appuri+"&DOCTITLE="+encodeURIComponent(document.title);}
	    fdjtID("SBOOKSAPP").src=appuri;
	    flyleaf_app_init=true;}
	Codex.initFlyleafApp=initFlyleafApp;

	CodexMode.selectApp=function(){
	    if (Codex.mode==='sbooksapp') CodexMode(false);
	    else CodexMode('sbooksapp');}

	/* Scanning */

	function CodexScan(elt,src,backward){
	    var cxt=false;
	    var body=document.body;
	    var pelt=Codex.scanning;
	    if (Codex.Trace.mode)
		fdjtLog("CodexScan() %o (src=%o) mode=%o scn=%o/%o",
			elt,src,Codex.mode,Codex.scanning,Codex.target);
	    // Copy the description of what we're scanning into the
	    // scanner (at the top of the page during scanning and
	    // preview)
	    if (Codex.scanning!==src) {
		var clone=src.cloneNode(true);
		clone.id="CODEXSCAN";
		fdjtDOM.replace("CODEXSCAN",clone);
		// This all makes sure that the >| and |< buttons
		// appear appropriately
		if (Codex.nextSlice(src))
		    dropClass("CODEXHUD","scanend");
		else addClass("CODEXHUD","scanend");
		if (Codex.prevSlice(src))
		    dropClass("CODEXHUD","scanstart");
		else addClass("CODEXHUD","scanstart");
		// This marks where we are currently scanning
		if (pelt) dropClass(pelt,"codexscanpoint");
		if (src) addClass(src,"codexscanpoint");
		Codex.scanning=src;}
	    else {}
	    var highlights=[];
	    if (Codex.target)
		Codex.clearHighlights(Codex.getDups(Codex.target));
	    if ((src)&&(hasClass(src,"gloss"))) {
		var glossinfo=Codex.glosses.ref(src.name);
		if (glossinfo.excerpt) {
		    var searching=Codex.getDups(elt.id);
		    var range=Codex.findExcerpt(
			searching,glossinfo.excerpt,glossinfo.exoff);
		    if (range) highlights=
			fdjtUI.Highlight(range,"highlightexcerpt");}
		else {
		    var about=src.about, target=fdjtID(about);
		    addClass(target,"highlightpassage");}}
	    else if ((src)&&(getParent(src,".sbookresults"))) {
		var about=src.about, target=fdjtID(about);
		if (target) {
		    var info=Codex.docinfo[target.id];
		    var terms=Codex.query._query;
		    var spellings=info.knodeterms;
		    var i=0; var lim=terms.length;
		    if (lim===0) addClass(target,"highlightpassage");
		    else while (i<lim) {
			var term=terms[i++];
			var h=Codex.highlightTerm(term,target,info,spellings);
			highlights=highlights.concat(h);}}}
	    Codex.setTarget(elt);
	    delete Codex.scanpoints;
	    delete Codex.scanoff;
	    if ((highlights)&&(highlights.length===1)&&
		(getParent(highlights[0],elt)))
		Codex.GoTo(elt,"Scan");
	    else if ((highlights)&&(highlights.length)) {
		var possible=Codex.getDups(elt.id);
		if (possible.length) {
		    var scanpoints=[];
		    var i=0, lim=possible.length;
		    while (i<lim) {
			var poss=possible[i++];
			var j=0, jlim=highlights.length;
			while (j<jlim) {
			    if (getParent(highlights[j++],poss)) {
				scanpoints.push(poss); break;}}}
		    if (scanpoints.length)
			Codex.scanpoints=scanpoints;
		    else Codex.scanpoints=possible;
		    if (backward) 
			Codex.scanoff=Codex.scanpoints.length-1;
		    else Codex.scanoff=0;
		    Codex.GoTo(Codex.scanpoints[Codex.scanoff]);}
		else Codex.GoTo(elt,"Scan");}
	    else Codex.GoTo(elt,"Scan");
	    CodexMode("scanning");}
	Codex.Scan=CodexScan;
	
	Codex.addConfig("uisize",function(name,value){
	    fdjtDOM.swapClass(CodexHUD,/codexuifont\w+/,"codexuifont"+value);});
	Codex.addConfig("showconsole",function(name,value){
	    if (value) addClass(CodexHUD,"codexshowconsole");
	    else dropClass(CodexHUD,"codexshowconsole");});
	Codex.addConfig("animatecontent",function(name,value){
	    if (Codex.dontanimate) {}
	    else if (value) addClass(document.body,"cxANIMATE");
	    else dropClass(Codex.page,"cxANIMATE");});
	Codex.addConfig("animatehud",function(name,value){
	    if (Codex.dontanimate) {}
	    else if (value) addClass(Codex.HUD,"cxANIMATE");
	    else dropClass(Codex.HUD,"cxANIMATE");});

	/* Settings apply/save handlers */

	function getSettings(){
	    var result={};
	    var settings=fdjtID("CODEXSETTINGS");
	    var layout=fdjtDOM.getInputValues(settings,"CODEXLAYOUT");
	    result.layout=
		((layout)&&(layout.length)&&(layout[0]))||false;
	    var bodysize=fdjtDOM.getInputValues(settings,"CODEXBODYSIZE");
	    if ((bodysize)&&(bodysize.length))
		result.bodysize=bodysize[0];
	    var bodyfamily=fdjtDOM.getInputValues(settings,"CODEXBODYFAMILY");
	    if ((bodyfamily)&&(bodyfamily.length))
		result.bodyfamily=bodyfamily[0];
	    var uisize=fdjtDOM.getInputValues(settings,"CODEXUISIZE");
	    if ((uisize)&&(uisize.length))
		result.uisize=uisize[0];
	    var hidesplash=fdjtDOM.getInputValues(settings,"CODEXHIDESPLASH");
	    result.hidesplash=((hidesplash)&&(hidesplash.length))||false;
	    var showconsole=fdjtDOM.getInputValues(settings,"CODEXSHOWCONSOLE");
	    result.showconsole=
		((showconsole)&&(showconsole.length)&&(true))||false;
	    var isoffline=fdjtDOM.getInputValues(settings,"CODEXLOCAL");
	    result.persist=
		((isoffline)&&(isoffline.length)&&(isoffline[0]))||false;
	    var animatecontent=fdjtDOM.getInputValues(
		settings,"CODEXANIMATECONTENT");
	    result.animatecontent=
		((animatecontent)&&(animatecontent.length)&&
		 (animatecontent[0]))||
		false;
	    var animatehud=fdjtDOM.getInputValues(
		settings,"CODEXANIMATEHUD");
	    result.animatehud=
		((animatehud)&&(animatehud.length)&&
		 (animatehud[0]))||
		false;
	    
	    return result;}

	Codex.UI.settingsOK=function(){
	    var settings=getSettings();
	    Codex.setConfig(settings);
	    Codex.saveConfig(settings);
	    fdjtDOM.replace("CODEXSETTINGSMESSAGE",
			    fdjtDOM("span#CODEXSETTINGSMESSAGE",
				    "Your new settings have been saved."));};
	
	Codex.UI.settingsCancel=function(){
	    Codex.setConfig(Codex.getConfig());
	    fdjtDOM.replace("CODEXSETTINGSMESSAGE",
			    fdjtDOM("span#CODEXSETTINGSMESSAGE",
				    "The current settings have been restored."));};

	/* Console methods */
	function console_eval(){
	    fdjtLog("Executing %s",input_console.value);
	    var result=eval(input_console.value);
	    var string_result=
		((result.nodeType)?
		 (fdjtString("%o",result)):
		 (fdjtString("%j",result)));
	    fdjtLog("Result is %s",string_result);}
	function consolebutton_click(evt){console_eval();}
	function consoleinput_keypress(evt){
	    evt=evt||event;
	    var target=fdjtUI.T(evt);
	    if (evt.keyCode===13) {
		if (!(evt.ctrlKey)) {
		    fdjtUI.cancel(evt);
		    console_eval();
		    if (evt.shiftKey) input_console.value="";}}}

	function keyboardHelp(arg,force){
	    if (arg===true) {
		if (Codex.keyboardHelp.timer) {
		    clearTimeout(Codex.keyboardHelp.timer);
		    Codex.keyboardHelp.timer=false;}
		dropClass("CODEXKEYBOARDHELPBOX","closing");
		dropClass("CODEXKEYBOARDHELPBOX","closed");
		return;}
	    else if (arg===false) {
		if (Codex.keyboardHelp.timer) {
		    clearTimeout(Codex.keyboardHelp.timer);
		    Codex.keyboardHelp.timer=false;}
		addClass("CODEXKEYBOARDHELPBOX","closed");
		dropClass("CODEXKEYBOARDHELPBOX","closing");
		return;}
	    if ((!force)&&(!(Codex.keyboardhelp))) return;
	    if (typeof arg === 'string') arg=fdjtID(arg);
	    if ((!(arg))||(!(arg.nodeType))) return;
	    var box=fdjtID("CODEXKEYBOARDHELPBOX");
	    var content=arg.cloneNode(true);
	    content.id="CODEXKEYBOARDHELP";
	    fdjtDOM.replace("CODEXKEYBOARDHELP",content);
	    fdjtDOM.dropClass(box,"closed");
	    Codex.keyboardHelp.timer=
		setTimeout(function(){
		    fdjtDOM.addClass(box,"closing");
		    Codex.keyboardHelp.timer=
			setTimeout(function(){
			    Codex.keyboardHelp.timer=false;
			    fdjtDOM.swapClass(box,"closing","closed");},
				   5000);},
			   5000);};
	Codex.keyboardHelp=keyboardHelp;

	/* Showing a particular gloss */

	Codex.showGloss=function showGloss(uuid){
	    if (!(Codex.glosses.ref(uuid))) return false;
	    var elts=document.getElementsByName(uuid);
	    if (!(elts)) return false;
	    else if (!(elts.length)) return false;
	    else {
		var allglosses=fdjtID("CODEXALLGLOSSES");
		var hasParent=fdjtDOM.hasParent;
		var i=0, lim=elts.length;
		while (i<lim) {
		    var src=elts[i++];
		    if (hasParent(src,allglosses)) {
			var elt=fdjtID(src.about);
			CodexMode("allglosses");
			Codex.Scan(elt,src);
			return true;}}
		return false;}};

	/* Setting/clearing help mode */
	Codex.hideHelp=function(){
	    fdjtDOM.dropClass(document.body,"codexhelp");};
	Codex.showHelp=function(){
	    fdjtDOM.addClass(document.body,"codexhelp");};

	/* Button methods */

	function LoginButton_ontap(evt){
	    evt=evt||event||null;
	    if (Codex.mode==="sbooksapp") CodexMode(false);
	    else CodexMode("sbooksapp");
	    evt.cancelBubble=true;}

	return CodexMode;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
