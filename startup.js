/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/startup.js ###################### */

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

/* Newer startup model:
   gotInfo(info)
   info has { user: {}, outlets: [], glosses: [] }
   if _sbook_loadinfo, do loadInfo(_sbook_loadinfo);
   else do a JSONP call.
*/

Codex.Startup=
    (function(){

	var sbook_faketouch=false;

	var sbook_heading_qricons=false;

	var https_root="https://beingmeta.s3.amazonaws.com/static/g/codex/";

	// Imported functions
	var cxicon=Codex.icon;

	var getLocal=fdjtState.getLocal;
	var setLocal=fdjtState.setLocal;
	var getQuery=fdjtState.getQuery;
	var getCookie=fdjtState.getCookie;
	var getMeta=fdjtDOM.getMeta;
	var getLink=fdjtDOM.getLink;
	var addClass=fdjtDOM.addClass;
	var dropClass=fdjtDOM.dropClass;
	var TOA=fdjtDOM.Array;


	/* Initialization */
	
	var _sbook_setup_start=false;
	
	function startupLog(){
	    if (!(Codex.Trace.startup)) return;
	    var args=TOA(arguments);
	    fdjtLog.apply(null,arguments);}

	function startupMessage(){
	    var args=TOA(arguments);
	    if ((Codex.Trace.startup)&&
		(typeof Codex.Trace.startup === "number")&&
		(Codex.Trace.startup>1))
		fdjtLog.apply(null,arguments);}
	Codex.startupMessage=startupMessage;

	/* Configuration information */

	var config_handlers={};
	var default_config=
	    {layout: 'bypage',
	     bodysize: 'normal',bodyfamily: 'serif',
	     uisize: 'normal',showconsole: false,
	     animatecontent: true,animatehud: true,
	     hidesplash: false,keyboardhelp: true,
	     holdmsecs: 750,taptapmsecs: 500};
	var current_config={};
	var saved_config={};

	var setCheckSpan=fdjtUI.CheckSpan.set;

	function addConfig(name,handler){
	    if (Codex.Trace.config>1)
		fdjtLog("Adding config handler for %s: %s",name,handler);
	    config_handlers[name]=handler;}
	Codex.addConfig=addConfig;

	function getConfig(name){
	    if (!(name)) return current_config;
	    else return current_config[name];}
	Codex.getConfig=getConfig;

	function setConfig(name,value,save){
	    if (arguments.length===1) {
		var config=name;
		Codex.postconfig=[];
		if (Codex.Trace.config) fdjtLog("batch setConfig: %s",config);
		for (var setting in config) {
		    if (config.hasOwnProperty(setting))
			setConfig(setting,config[setting]);}
		var dopost=Codex.postconfig;
		Codex.postconfig=false;
		if ((Codex.Trace.config>1)&&(!((dopost)||(dopost.length===0))))
		    fdjtLog("batch setConfig, no post processing",config);
		var i=0; var lim=dopost.length;
		while (i<lim) {
		    if (Codex.Trace.config>1)
			fdjtLog("batch setConfig, post processing %s",dopost[i]);
		    dopost[i++]();}
		return;}
	    if (Codex.Trace.config) fdjtLog("setConfig %o=%o",name,value);
	    var input_name="CODEX"+(name.toUpperCase());
	    var inputs=document.getElementsByName(input_name);
	    var i=0; var lim=inputs.length;
	    while (i<lim) {
		var input=inputs[i++];
		if (input.tagName!=='INPUT') continue;
		if (input.type==='checkbox') {
		    if (value) setCheckSpan(input,true);
		    else setCheckSpan(input,false);}
		else if (input.type==='radio') {
		    if (value===input.value) setCheckSpan(input,true);
		    else setCheckSpan(input,false);}
		else input.value=value;}
	    if (!((current_config[name])&&
		  (current_config[name]===value))) {
		if (config_handlers[name]) {
		    if (Codex.Trace.config)
			fdjtLog("setConfig (handler=%s) %o=%o",
				config_handlers[name],name,value);
		    config_handlers[name](name,value);}}
	    current_config[name]=value;
	    if (save) {
		saved_config[name]=value;
		saveConfig(saved_config);}}
	Codex.setConfig=setConfig;

	function saveConfig(config){
	    if (Codex.Trace.config) {
		fdjtLog("saveConfig %o",config);
		fdjtLog("saved_config=%o",saved_config);}
	    if (!(config)) config=saved_config;
	    // Save automatically applies (seems only fair)
	    else setConfig(config);
	    var saved={};
	    for (var setting in config) {
		if ((!(default_config.hasOwnProperty(setting)))||
		    (config[setting]!==default_config[setting])) {
		    saved[setting]=config[setting];}}
	    if (Codex.Trace.config) fdjtLog("Saving config %o",saved);
	    setLocal("codex.config",JSON.stringify(saved));}
	Codex.saveConfig=saveConfig;

	function initConfig(){
	    var config=saved_config=
		getLocal("codex.config",true)||{};
	    Codex.postconfig=[];
	    if (Codex.Trace.config) fdjtLog("initConfig (saved) %o",config);
	    if (config) {
		for (var setting in config) {
		    if ((config.hasOwnProperty(setting))&&
			(!(getQuery(setting))))
			setConfig(setting,config[setting]);}}
	    else config={};
	    if (Codex.Trace.config)
		fdjtLog("initConfig (default) %o",default_config);
	    for (var setting in default_config) {
		if (!(config.hasOwnProperty(setting)))
		    if (default_config.hasOwnProperty(setting)) {
			if (getQuery(setting))
			    setConfig(setting,getQuery(setting));
			else if (getMeta("Codex."+setting))
			    setConfig(setting,getMeta("Codex."+setting));
			else setConfig(setting,default_config[setting]);}}
	    var dopost=Codex.postconfig;
	    Codex.postconfig=false;
	    var i=0; var lim=dopost.length;
	    while (i<lim) dopost[i++]();
	    
	    var deviceid=current_config.deviceid;
	    var devicename=current_config.devicename;
	    if (!(deviceid)) {
		deviceid=fdjtState.getUUID();
		setConfig("deviceid",deviceid,true);}
	    Codex.deviceId=deviceid;
	    if (!(devicename)) {
		var vi=fdjtState.versionInfo(); var now=new Date();
		devicename=vi.browser+"/"+vi.platform+"/0"+
		    (now.getFullYear())+"/"+
		    ((now.getMonth())+1)+"/"+
		    (now.getDate())+"-"+(Math.floor(Math.random()*1000000));
		setConfig('devicename',devicename,true);}
	    Codex.deviceName=devicename;

	    saveConfig();}

	var getParent=fdjtDOM.getParent;
	var getChild=fdjtDOM.getChild;

	function updateConfig(name,id,save){
	    if (typeof save === 'undefined') save=true;
	    var elt=((typeof id === 'string')&&(document.getElementById(id)))||
		((id.nodeType)&&(getParent(id,'input')))||
		((id.nodeType)&&(getChild(id,'input')))||
		((id.nodeType)&&(getChild(id,'textarea')))||
		((id.nodeType)&&(getChild(id,'select')))||
		(id);
	    if (Codex.Trace.config) fdjtLog("Update config %s",name);
	    if ((elt.type=='radio')||(elt.type=='checkbox'))
		setConfig(name,elt.checked||false,save);
	    else setConfig(name,elt.value,save);}
	Codex.updateConfig=updateConfig;

	Codex.addConfig("hidesplash",function(name,value){
	    Codex.hidesplash=value;
	    fdjtUI.CheckSpan.set(
		document.getElementsByName("CODEXHIDESPLASH"),
		value);});
	Codex.addConfig("keyboardhelp",function(name,value){
	    Codex.keyboardhelp=value;
	    fdjtUI.CheckSpan.set(
		document.getElementsByName("CODEXKEYBOARDHELP"),
		value);});
	Codex.addConfig("devicename",function(name,value){
	    Codex.deviceName=value;});
	Codex.addConfig("deviceid",function(name,value){
	    Codex.deviceId=value;});

	Codex.addConfig("holdmsecs",function(name,value){
	    Codex.holdmsecs=value;
	    fdjtUI.TapHold.interval=value;});
	Codex.addConfig("taptapmsecs",function(name,value){
	    Codex.taptapmsecs=value;});

	function syncStartup(){
	    // This is the startup code which is run
	    //  synchronously, before the time-sliced processing
	    fdjtLog.console="CODEXCONSOLELOG";
	    fdjtLog.consoletoo=true;
	    if (!(Codex._setup_start)) Codex._setup_start=new Date();
	    fdjtLog("This is Codex version %s, built %s on %s, launched %s",
		    Codex.version,Codex.buildtime,Codex.buildhost,
		    Codex._setup_start.toString());
	    if (navigator.appVersion)
		fdjtLog("Navigator App version: %s",navigator.appVersion);
	    // This lets trace configurations be passed as query
	    // arguments, for handy debugging.
	    if (getQuery("cxtrace")) readTraceSettings();

	    deviceSetup();
	    appSetup();
	    userSetup();

	    if (Codex.Trace.startup)
		fdjtLog("Done with synchronous startup");

	    // Hide the loading splash page, if any
	    if (fdjtID("CODEXSPLASH"))
		fdjtID("CODEXSPLASH").style.display='none';

	    CodexMode("status");}

	function appSetup() {

	    if (Codex.Trace.startup) fdjtLog("Starting app setup");

	    // Initialize domain and origin for browsers which care
	    document.domain="sbooks.net"; document.origin="sbooks.net";

	    // Execute any FDJT initializations
	    fdjtDOM.init();

	    fdjtDOM.addAppSchema("SBOOK","http://sbooks.net/");
	    fdjtDOM.addAppSchema("Codex","http://codex.sbooks.net/");
	    fdjtDOM.addAppSchema("DC","http://purl.org/dc/elements/1.1/");
	    fdjtDOM.addAppSchema("DCTERMS","http://purl.org/dc/terms/");
	    fdjtDOM.addAppSchema("OLIB","http://openlibrary.org/");
	    
	    // Get various settings for the sBook from the HTML (META
	    // tags, etc), including settings or guidance for
	    // scanning, graphics, layout, glosses, etc.
	    readSettings();

	    // Initialize the databases
	    Codex.initDB();

	    // Modifies the DOM in various ways
	    initBody();
	    // This initializes the book tools (the HUD/Heads Up Display)
	    Codex.initHUD();

	    if (Codex.coverpage) {
		var status_cover=fdjtID("CODEXSTATUSCOVER");
		status_cover.src=Codex.coverpage;
		status_cover.style.display='block';}

	    var saveprops=["sources","outlets","etc","overlays","sync","user",
			   "sync","nodeid","state"];
	    addConfig(
		"localstorage",
		function(name,value){
		    var refuri=Codex.refuri;
		    if ((value)&&(Codex.persist)) return;
		    else if ((!(value))&&(!(Codex.persist))) return;
		    else if (value) {
			if (!(Codex.sourcekb.storage))
			    Codex.sourcekb.storage=
			    new fdjtKB.OfflineKB(Codex.sourcekb);
			if (!Codex.glosses.storage)
			    Codex.glosses.storage=
			    new fdjtKB.OfflineKB(Codex.glosses);
			for (var prop in saveprops) {
			    if (Codex[prop]) setLocal(
				prop+"("+refuri+")",Codex[prop],true);}
			if ((Codex.allglosses)&&(Codex.allglosses.length))
			    setLocal("glosses("+refuri+")",Codex.allglosses);}
		    else if (!(value)) {
			if (getConfig("localstorage"))
			    clearOffline(Codex.refuri);
			else clearOffline();}
		    Codex.persist=value;
		    setCheckSpan(fdjtID("CODEXLOCALCHECKBOX"),value);});

	    // Get any local saved configuration information
	    //  We do this after the HUD is setup so that the settings
	    //   panel gets initialized appropriately.
	    initConfig();
	    Codex.persist=
		((!(Codex.force_online))&&
		 ((Codex.force_offline)||(workOffline())));

	    // Setup the UI components for the body and HUD
	    Codex.setupGestures();
	    
	    // Setup the reticle (if desired)
	    if ((typeof (document.body.style["pointer-events"])
		 != "undefined")&&
		((Codex.demo)||(fdjtState.getLocal("codex.demo"))||
		 (fdjtState.getCookie("sbooksdemo"))||
		 (getQuery("demo")))) {
		fdjtUI.Reticle.setup();}

	    // Set up what the user sees during setup
	    appstatus();

	    

	}
	
	function userSetup(){
	    if (Codex.Trace.startup) fdjtLog("Starting user setup");
	    // Start JSONP call to get initial or updated glosses, etc
	    if (Codex.nologin) {}
	    else if (getLocal("codex.user")) {
		initUserOffline();
		Codex.sync=getLocal("sync("+Codex.refuri+")",true);
		if (Codex.Trace.storage) 
		    fdjtLog("Local info for %o (%s) from %o",
			    Codex.user._id,Codex.user.name,Codex.sync);
		// If we have local glosses, ignore any cached
		// _sbook_loadinfo because we've already processed it
		if ((Codex.sync)&&
		    (getLocal("glosses("+Codex.refuri+")"))&&
		    (window._sbook_loadinfo))
		    window._sbook_loadinfo=false;}
	    else if (window._sbook_loadinfo) {
		var info=window._sbook_loadinfo;
		if (info.userinfo)
		    setUser(info.userinfo,
			    info.outlets,info.overlays,
			    info.sync);
		if (info.nodeid) setNodeID(info.nodeid);
		Codex.sync=info.sync;
		if (Codex.Trace.storage>1) 
		    fdjtLog("Cached loadinfo.js for %o (%s) from %o: %j",
			    Codex.user._id,Codex.user.name,Codex.sync,
			    Codex.user);
		if (Codex.Trace.storage) 
		    fdjtLog("Cached loadinfo.js for %o (%s) from %o",
			    Codex.user._id,Codex.user.name,Codex.sync);}
	    else {}
	    if (Codex.nologin) return;
	    else if (window.navigator.onLine) {
		if ((Codex.user)&&(Codex.sync))
		    fdjtLog("Getting new (> %s (%d)) glosses from %s for %s",
			    fdjtTime.timeString(Codex.sync),Codex.sync,
			    Codex.server,Codex.user._id,Codex.user.name);
		else if (Codex.user)
		    fdjtLog("Getting glosses from %s for %s (%s)",
			    Codex.server,Codex.user._id,Codex.user.name);
		else fdjtLog("Getting glosses from %s",Codex.server);
		updateInfo();
		setInterval(updateInfo,300000);
		return;}
	    else return;}
	Codex.userSetup=userSetup;

	function readTraceSettings(){
	    var tracing=getQuery("cxtrace",true);
	    var i=0; var lim=tracing.length;
	    while (i<lim) {
		var trace_spec=tracing[i++];
		var colon=trace_spec.indexOf(":");
		if (colon<0) {
		    if (typeof Codex.Trace[trace_spec] === 'number')
			Codex.Trace[trace_spec]=1;
		    else Codex.Trace[trace_spec]=true;}
		else {
		    var trace_name=trace_spec.substr(0,colon);
		    var trace_val=trace_spec.substr(colon+1);
		    if (typeof Codex.Trace[trace_name] === 'number')
			Codex.Trace[trace_name]=parseInt(trace_val);
		    else Codex.Trace[trace_name]=trace_val;}}}

	function Startup(force){
	    var metadata=false;
	    if (Codex._setup) return;
	    if ((!force)&&(getQuery("nocodex"))) return;
	    // This is all of the startup that we need to do synchronously
	    syncStartup();
	    // The rest of the stuff we timeslice
	    fdjtTime.timeslice
	    ([  // Scan the DOM for metadata.  This is surprisingly fast,
		//  so we don't currently try to timeslice it, though we could
		function(){
		    var scanmsg=fdjtID("CODEXSTARTUPSCAN");
		    addClass(scanmsg,"running");
		    metadata=new Codex.DOMScan(Codex.content);
		    // fdjtDOM.addClass(metadata._heads,"avoidbreakafter");
		    Codex.docinfo=Codex.DocInfo.map=metadata;
		    Codex.ends_at=Codex.docinfo[Codex.content.id].ends_at;
		    dropClass(scanmsg,"running");
		    if (Codex.scandone) {
			var donefn=Codex.scandone;
			delete Codex.scandone;
			donefn();}},
		// Now you're ready to lay out the book, which is
		//  timesliced and runs on its own.  We wait to do
		//  this until we've scanned the DOM because we may
		//  use results of DOM scanning in layout (for example,
		//  heading information).
		function(){
		    if (Codex.bypage) Codex.Paginate("initial");
		    else if (Codex.bysect) {
			if (!(Codex.layout)) {
			    Codex.layout=
				new Codex.SectionLayout(
				    Codex.content,Codex.docinfo,Codex.window);
			    Codex.layout.breakupPages(
				Codex.layout.height,
				function(layout){
				    fdjtDOM.addClass(document.body,"cxPAGED");
				    fdjtDOM.dropClass(document.body,"cxLAYOUT");
				    Codex.pagecount=layout.pagelocs.length;
				    if (!(Codex.nativescroll)) {
					if (!(Codex.iscroll)) {
					    var is=new iScroll("CODEXCONTENT");
					    Codex.iscroll=is;
					    is.doubletouch=true;}
					else Codex.iscroll.refresh();}
				    if (Codex.section) {
					Codex.curpage=layout.getPageNumber()||1;
					Codex.updatePageDisplay(
					    Codex.curpage,Codex.location);}
				    else Codex.updatePageDisplay(1,0);});
			    Codex.sections=Codex.layout.sections;}
			addClass(document.body,"cxBYSECT");}
		    else addClass(document.body,"cxSCROLL");},
		// Build the display TOC, both the dynamic (top of
		// display) and the static (inside the hudheart)
		function(){
		    var tocmsg=fdjtID("CODEXSTARTUPTOC");
		    if (tocmsg) {
			tocmsg.innerHTML=fdjtString(
			    "Building table of contents based on %d heads",
			    Codex.docinfo._headcount);
			addClass(tocmsg,"running");}
		    startupLog("Building table of contents based on %d heads",
			       Codex.docinfo._headcount);
		    Codex.setupTOC(metadata[Codex.content.id]);
		    dropClass(tocmsg,"running");},
		// Read knowledge bases (knodules) used by the book
		((Knodule)&&(Knodule.HTML)&&
		 (Knodule.HTML.Setup)&&(Codex.knodule)&&
		 (function(){
		     var knomsg=fdjtID("CODEXSTARTUPKNO");
		     var knodetails=fdjtID("CODEXSTARTUPKNODETAILS");
		     if (knodetails) {
			 knodetails.innerHTML=fdjtString(
			     "Processing knodule %s",Codex.knodule.name);}
		     addClass(knomsg,"running");
		     startupLog("Processing knodule %s",Codex.knodule.name);
		     Knodule.HTML.Setup(Codex.knodule);
		     dropClass(knomsg,"running");})),
		// Process locally stored (offline data) glosses
		((getLocal("sync("+Codex.refuri+")"))&&initGlossesOffline),
		// Process any preloaded (app cached) glosses
		((window._sbook_loadinfo)&&(function(){
		    loadInfo(window._sbook_loadinfo);
		    window._sbook_loadinfo=false;})),
		// Process anything we got via JSONP ahead of processing
		//  _sbook_loadinfo
		((window._sbook_newinfo)&&(function(){
		    loadInfo(window._sbook_newinfo);
		    window._sbook_newinfo=false;})),
		function(){
		    startupLog("Finding and applying Technorati-style tags");
		    applyAnchorTags();},
		function(){
		    startupLog("Finding and applying tags spans");
		    applyTagSpans();},
		function(){
		    if (window._sbook_autoindex) {
			startupLog("Indexing precompiled tags");
			Codex.useIndexData(
			    window._sbook_autoindex,Codex.knodule,false,indexingDone);
			window._sbook_autoindex=false;}},
		function(){
		    startupLog("Indexing assigned tags");
		    Codex.indexAssignedTags(metadata,indexingDone);},
		// Figure out which mode to start up in, based on
		// query args to the book.
		function(){
		    if (Codex.layout) startupDone();
		    else Codex.pagewait=startupDone;}],
	     100,25);}
	Codex.Startup=Startup;
	
	function appstatus(){
	    var intro=fdjtID("CODEXINTRO");
	    // Take any message passed along as a query string
	    //  and put it in the top of the help window, then
	    //  display the help window
	    if (getQuery("congratulations"))
		fdjtDOM(intro,fdjtDOM("strong","Congratulations, "),
			getQuery("congratulations"));
	    else if (getQuery("sorry"))
		fdjtDOM(intro,fdjtDOM("strong","Sorry, "),
			getQuery("sorry"));
	    else if (getQuery("weird")) 
		fdjtDOM(intro,fdjtDOM("strong","Weird, "),
			getQuery("weird"));
	    // This is the case where we're accessing the book but
	    //  have arguments to pass to the flyleaf app.  The most
	    //  common case here is accepting an invitation to join a
	    //  group.  It will probably be common for people to use
	    //  the invitation link to get to the book, but we don't
	    //  want to always present them with the invitation.  So
	    //  this gets a little hairy.
	    if ((getQuery("ACTION"))||
		(getQuery("JOIN"))||
		(getQuery("OVERLAY"))) {
		// We have args to pass to the flyleaf app, 
		// so we initialize it:
		Codex.initFlyleafApp();
		var appframe=fdjtID("SBOOKSAPP");
		var appwindow=((appframe)&&(appframe.contentWindow));
		if ((Codex.overlays)&&(getQuery("JOIN"))&&
		    (fdjtKB.contains(Codex.overlays,getQuery("JOIN")))) {
		    // Check that it's not redundant
		    var ref=fdjtKB.ref(getQuery("JOIN"));
		    if (ref.name)
			fdjtDOM(intro,"You've already added the overlay "+
				ref.name);
		    fdjtDOM(intro,"You've already added the overlay.");}
		// If you have postMessage, it will be used to change
		//  modes when the sbook app actually loads
		else if (appwindow.postMessage) {}
		else {
		    Codex.joining=getQuery("JOIN");
		    CodexMode("sbooksapp");}}
	    else if (getQuery("GLOSS"))
		Codex.glosshash=getQuery("GLOSS")[0];
	    else if ((location.hash)&&(location.hash.length>=36)) {
		var hash=location.hash;
		if (hash[0]==="#") hash=hash.slice(1);
		if (hash.search("X")===0)
		    Codex.glosshash=hash.slice(2);
		else if (hash.search("GL")===0)
		    Codex.glosshash=hash.slice(2);
		else if ((hash.search("FBX")===0)||(hash.search("TWX")===0)||
			 (hash.search("GPX")===0))
		    Codex.glosshash=hash.slice(3);
		else Codex.glosshash=hash;}
		
	    // This makes the splash page visible and applies some
	    // other styling
	    fdjtDOM.addClass(document.body,"codexstartup");
	    fdjtDOM.addClass(document.body,"codexappstatus");
	    window.focus();}
	
	function startupDone(mode){
	    if ((Codex.glosshash)&&(Codex.glosses.ref(Codex.glosshash))) {
		if (Codex.showGloss(Codex.glosshash))
		    Codex.glosshash=false;
		else initLocation();}
	    else initLocation();
	    if (fdjtID("CODEXREADYSPLASH"))
		fdjtID("CODEXREADYSPLASH").style.display='none';
	    Codex.displaySync();
	    setInterval(Codex.serverSync,60000);
	    fdjtDOM.dropClass(document.body,"codexstartup");
	    fdjtDOM.dropClass(document.body,"codexappstatus");
	    if (mode) {}
	    else if (getQuery("startmode"))
		mode=getQuery("startmode");
	    else if (Codex.hidesplash) 
		CodexMode(false);
	    else {}
	    if (mode) CodexMode(mode);
	    Codex._setup=new Date();
	    var msg=false;
	    if (msg=getQuery("APPMESSAGE")) {
		var uuid_end=false;
		if ((msg.slice(0,2)==="#{")&&
		    ((uuid_end=msg.indexOf('}'))>0)) {
		    var msgid="MSG_"+msg.slice(2,uuid_end);
		    if (fdjtState.getLocal(msgid)) {}
		    else {
			fdjtState.setLocal(msgid,"seen");
			fdjtUI.alertFor(10,msg.slice(uuid_end+1));}}
		else fdjtUI.alertFor(10,msg);}
	    if (msg=getQuery("SBOOKSMESSAGE")) {
		var uuid_end=false;
		if ((msg.slice(0,2)==="#{")&&
		    ((uuid_end=msg.indexOf('}'))>0)) {
		    var msgid="MSG_"+msg.slice(2,uuid_end);
		    if (fdjtState.getLocal(msgid)) {}
		    else {
			fdjtState.setLocal(msgid,"seen");
			fdjtUI.alertFor(10,msg.slice(uuid_end+1));}}
		else fdjtUI.alertFor(10,msg);}
	    if (msg=getCookie("APPMESSAGE")) {
		fdjtUI.alertFor(10,msg);
		fdjtState.clearCookie("APPMESSAGE","sbooks.net","/");}
	    if (msg=getCookie("SBOOKSMESSAGE")) {
		fdjtUI.alertFor(10,msg);
		fdjtState.clearCookie("SBOOKSMESSAGE","sbooks.net","/");}}
	
	/* Application settings */

	var optrules=
	    {"paginate":["scrolling"],
	     "scrolling":["paginate"],
	     "touch":["mouse","kbd"],
	     "mouse":["touch","kbd"],
	     "kbd":["touch","mouse"]};

	function setopt(opt,flag){
	    if (typeof flag === 'undefined') flag=true;
	    if ((flag)&&(sbook[opt])) return;
	    else if ((!(flag))&&(!(sbook[opt]))) return;
	    var unset=optrules[opt];
	    sbook[opt]=true;
	    if (unset) {
		var i=0; var lim=unset.length;
		sbook[unset[i++]]=false;}}

	function workOffline(refuri){
	    if (Codex.force_online) return false;
	    else if (Codex.force_offline) return true;
	    var config_val=getConfig("localstorage");
	    if (typeof config_val !== 'undefined') return config_val;
	    var value=(getMeta("Codex.offline"))||(getMeta("SBOOK.offline"));
	    if ((value===0)||(value==="0")||
		(value==="no")||(value==="off")||
		(value==="never"))
		return false;
	    else fdjtUI.choose(
		[{label: "No, thanks"},
		 {label: "Yes, keep locally",
		  handler:
		  function(){
		      setConfig("localstorage",true,true);}}],
		"Store personal information for offline/faster reading?");
	    return false;}
	
	var glossref_classes=false;

	function readSettings(){
	    // Basic stuff
	    var useragent=navigator.userAgent;
	    var refuri=_getsbookrefuri();
	    document.body.refuri=Codex.refuri=refuri;
	    Codex.docuri=_getsbookdocuri();
	    Codex.devinfo=fdjtState.versionInfo();
	    
	    if (fdjtState.getQuery("offline")) {
		var qval=fdjtState.getQuery("offline");
		if ((qval===false)||(qval===0)||(qval==="no")||(qval==="off")||
		    (qval==="never")||(qval==="0"))
		    Codex.force_online=true;
		else Codex.force_offline=true;}
	    else if (fdjtDOM.getMeta("SBOOK.offline")) {
		var mval=fdjtDOM.getMeta("SBOOK.offline");
		if ((mval===false)||(mval===0)||(mval==="no")||(mval==="off")||
		    (mval==="never")||(mval==="0"))
		    Codex.force_online=true;
		else Codex.force_offline=true;}

	    var refuris=getLocal("codex.refuris",true)||[];

	    // Get the settings for scanning the document structure
	    getScanSettings();

	    /* Where to get your images from, especially to keep
	       references inside https */
	    if ((Codex.root==="http://static.beingmeta.com/g/codex/")&&
		(window.location.protocol==='https:'))
		Codex.root=https_root;
	    
	    // Whether to suppress login, etc
	    if ((getLocal("codex.nologin"))||(getQuery("nologin")))
		Codex.nologin=true;
	    Codex.bypage=(Codex.page_style==='bypage'); 
	    Codex.max_excerpt=getMeta("SBOOK.maxexcerpt")||(Codex.max_excerpt);
	    Codex.min_excerpt=getMeta("SBOOK.minexcerpt")||(Codex.min_excerpt);
	    var sbooksrv=getMeta("SBOOK.server")||getMeta("SBOOKSERVER");
	    if (sbooksrv) Codex.server=sbooksrv;
	    else if (fdjtState.getCookie["SBOOKSERVER"])
		Codex.server=fdjtState.getCookie["SBOOKSERVER"];
	    else Codex.server=lookupServer(document.domain);
	    if (!(Codex.server)) Codex.server=Codex.default_server;
	    
	    refuris.push(refuri);

	    var coverpage=fdjtDOM.getLink("SBOOK.coverpage",false,true)||
		fdjtDOM.getLink("coverpage",false,true);
	    if (coverpage) Codex.coverpage=coverpage;
	    
	    var prefix=getMeta("SBOOK.prefix");
	    if (prefix) Codex.baseid=prefix;

	    if (!((Codex.nologin)||(Codex.force_online))) {
		Codex.mycopyid=getMeta("SBOOK.mycopyid")||
		    (getLocal("mycopy("+refuri+")"))||
		    false;}
	    setLocal("codex.refuris",refuris,true);
	    
	}

	function deviceSetup(){
	    var useragent=navigator.userAgent;
	    var body=document.body;

	    var isiPhone = (/iphone/gi).test(navigator.appVersion);
	    var isTouchPad = (/Touchpad/gi).test(navigator.appVersion);
	    var isiPad = (/ipad/gi).test(navigator.appVersion);
	    var isAndroid = (/android/gi).test(navigator.appVersion);
	    var isWebKit = navigator.appVersion.search("WebKit")>=0;
	    var isWebTouch = isiPhone || isiPad || isAndroid || isTouchPad;

	    if (isWebTouch) {
		fdjtDOM.addClass(body,"cxTOUCH");
		viewportSetup();
		Codex.ui="webtouch";
		Codex.touch=true;}
	    if ((useragent.search("Safari/")>0)&&
		(useragent.search("Mobile/")>0)) { 
		hide_mobile_safari_address_bar();
		Codex.nativescroll=false;
		Codex.scrolldivs=false;
		Codex.updatehash=false;
		// Animation seems to increase crashes in iOS
		Codex.dontanimate=true;
		// default_config.layout='fastpage';
		default_config.keyboardhelp=false;
		// Have fdjtLog do it's own format conversion for the log
		fdjtLog.doformat=true;}
	    else if (useragent.search(/Android/gi)>0) {
		default_config.keyboardhelp=false;
		Codex.nativescroll=false;
		Codex.updatehash=false;
		Codex.scrolldivs=false;}
	    else if (sbook_faketouch) {
		fdjtDOM.addClass(body,"cxTOUCH");
		viewportSetup();
		Codex.ui="faketouch";}
	    else {
		fdjtDOM.addClass(body,"cxMOUSE");
		Codex.ui="mouse";}
	    if (!(Codex.nativescroll)) fdjtDOM.addClass(body,"cxISCROLL");
	    var opt_string=
		fdjtString.stdspace(
		    ((isiPhone)?(" iPhone"):(""))+
			((isTouchPad)?(" TouchPad"):(""))+
			((isiPad)?(" iPad"):(""))+
			((isAndroid)?(" Android"):(""))+
			((isWebKit)?(" WebKit"):(""))+
			((isWebTouch)?(" touch"):(""))+
			((!(isWebTouch))?(" mouse"):(""))+
			((Codex.nativescroll)?(" nativescroll"):
			 (" iscroll"))+
			((Codex.updatehash)?(" updatehash"):
			 (" leavehash"))+
			((Codex.scrolldivs)?(" scrolldivs"):
			 (" noscrolldivs")));
	    fdjtLog("Device: %s %dx%d ui=%s, body=\"%s\"",
		    opt_string,fdjtDOM.viewWidth(),fdjtDOM.viewHeight(),
		    Codex.ui,body.className);}

	function initUserOffline(){
	    var refuri=Codex.refuri;
	    var user=getLocal("codex.user");
	    var sync=getLocal("sync("+refuri+")",true);
	    var nodeid=getLocal("nodeid("+refuri+")");
	    var userinfo=user&&getLocal(user,true);
	    if (Codex.Trace.storage)
		fdjtLog("initOffline user=%s sync=%s nodeid=%s info=%j",
			user,sync,nodeid,userinfo);
	    if (!(sync)) return;
	    if (!(user)) return;
	    var outlets=Codex.outlets=getLocal("outlets("+refuri+")",true)||[];
	    var overlays=Codex.overlays=
		getLocal("overlays("+refuri+")",true)||[];
	    if (Codex.Trace.startup)
		fdjtLog("initOffline userinfo=%j",userinfo);
	    Codex.allsources=getLocal("sources("+refuri+")",true)||[];
	    Codex.sourcekb.Import(Codex.allsources);
	    if (userinfo) setUser(userinfo,outlets,overlays,sync);
	    if (nodeid) setNodeID(nodeid);
	    Codex.sync=sync;}

	var offline_init=false;

	function initGlossesOffline(){
	    if (offline_init) return false;
	    else offline_init=true;
	    var refuri=Codex.refuri;
	    var sync=getLocal("sync("+refuri+")",true);
	    if (!(sync)) return;
	    if (Codex.Trace.glosses)
		fdjtLog("Starting initializing glosses from offline storage");
	    var localglosses=getLocal("glosses("+refuri+")",true)||[];
	    var queuedglosses=getLocal("queued("+refuri+")",true)||[];
	    var allglosses=Codex.allglosses||[];
	    localglosses=localglosses.concat(queuedglosses);
	    Codex.localglosses=localglosses;
	    Codex.allglosses=allglosses.concat(localglosses);
	    Codex.etc=getLocal("etc("+refuri+")",true)||[];
	    Codex.outlets=getLocal("outlets("+refuri+")",true)||[];
	    // Load everything in etc
	    var etc=Codex.etc; var outlets=Codex.outlets;
	    var i=0; var lim=etc.length;
	    var sourcekb=Codex.sourcekb;
	    while (i<lim) sourcekb.load(etc[i++]);
	    i=0; lim=outlets.length; while (i<lim) sourcekb.load(outlets[i++]);
	    // Load all the glosses
	    var i=0; var lim=localglosses.length;
	    var glossdb=Codex.glosses;
	    while (i<lim) {
		var glossid=localglosses[i++];
		var gloss=glossdb.load(glossid);
		if (Codex.Trace.storage>1)
		    fdjtLog("Restored %o: %j",glossid,gloss);}
	    if ((localglosses.length)||(etc.length))
		fdjtLog("Initialized %d glosses (%d etc) from offline storage",
			localglosses.length,etc.length);}

	/* Viewport setup */

	var viewport_spec=
	    "width=device-width,initial-scale=1.0,user-scalable=no";
	function viewportSetup(){
	    var head=fdjtDOM.getHEAD();
	    var viewport=getMeta("viewport",false,false,true);
	    if (!(viewport)) {
		viewport=document.createElement("META");
		viewport.setAttribute("name","viewport");
		viewport.setAttribute("content",viewport_spec);
		head.appendChild(viewport);}
	    var isapp=getMeta("apple-mobile-web-app-capable",false,false,true);
	    if (!(isapp)) {
		isapp=document.createElement("META");
		isapp.setAttribute("name","apple-mobile-web-app-capable");
		isapp.setAttribute("content","yes");
		head.appendChild(isapp);}}

	function hide_mobile_safari_address_bar(){
	    window.scrollTo(0,1);
	    setTimeout(function(){window.scrollTo(0,0);},0);}

	/* Getting settings */

	function _getsbookrefuri(){
	    var refuri=fdjtDOM.getLink("SBOOK.refuri",false,true)||
		fdjtDOM.getLink("refuri",false,true)||
		getMeta("SBOOK.refuri",false,true)||
		getMeta("refuri",false,true)||
		getLink("canonical",false,true);
	    if (refuri) return decodeURI(refuri);
	    else {
		var locref=document.location.href;
		var qstart=locref.indexOf('?');
		if (qstart>=0) locref=locref.slice(0,qstart);
		var hstart=locref.indexOf('#');
		if (hstart>=0) locref=locref.slice(0,hstart);
		return decodeURI(locref);}}
	function _getsbookdocuri(){
	    return fdjtDOM.getLink("SBOOK.docuri",false)||
		fdjtDOM.getLink("docuri",false)||
		fdjtDOM.getLink("canonical",false)||
		location.href;}

	function lookupServer(string){
	    var sbook_servers=Codex.servers;
	    var i=0;
	    while (i<sbook_servers.length) 
		if (sbook_servers[i][0]===string)
		    return sbook_servers[i][1];
	    else if (string.search(sbook_servers[i][0])>=0)
		return sbook_servers[i][1];
	    else if ((sbook_servers[i][0].call) &&
		     (sbook_servers[i][0].call(string)))
		return sbook_servers[i][1];
	    else i++;
	    return false;}

	function hasTOCLevel(elt){
	    if ((elt.toclevel)||
		((elt.getAttributeNS)&&
		 (elt.getAttributeNS('toclevel','http://sbooks.net/')))||
		(elt.getAttribute('toclevel'))||
		(elt.getAttribute('data-toclevel'))||
		((elt.className)&&
		 ((elt.className.search(/\bsbook\dhead\b/)>=0)||
		  (elt.className.search(/\bsbooknotoc\b/)>=0)||
		  (elt.className.search(/\bsbookignore\b/)>=0))))
		return true;
	    else return false;}
	Codex.hasTOCLevel=hasTOCLevel;

	var headlevels=["not","A","B","C","D","E","F","G","H","I","J","K","L"];

	function getScanSettings(){
	    if (!(Codex.root))
		if (getMeta("SBOOK.root"))
		    Codex.root=fdjtID(getMeta("SBOOK.root"));
	    else Codex.root=fdjtID("SBOOKCONTENT")||document.body;
	    if (!(Codex.start))
		if (getMeta("SBOOK.start"))
		    Codex.start=fdjtID(getMeta("SBOOK.start"));
	    else if (fdjtID("SBOOKSTART"))
		Codex.start=fdjtID("SBOOKSTART");
	    else {}
	    var i=0; while (i<9) {
		var rules=getMeta("sbookhead"+i,true).
		    concat(getMeta("sbook"+i+"head",true)).
		    concat(getMeta("sbook"+headlevels[i]+"head",true));
		if ((rules)&&(rules.length)) {
		    var j=0; var lim=rules.length;
		    var elements=fdjtDOM.getChildren(document.body,rules[j++]);
		    var k=0; var n=elements.length;
		    while (k<n) {
			var elt=elements[k++];
			if (!(hasTOCLevel(elt))) elt.toclevel=i;}}
		i++;}
	    var ignored=false;
	    // These are all meta class definit6ions, which is why
	    //  they don't have regular schema prefixes
	    if (getMeta("sbookignore")) 
		Codex.ignore=new fdjtDOM.Selector(getMeta("sbookignore"));
	    if (getMeta("sbooknotoc")) 
		Codex.notoc=new fdjtDOM.Selector(getMeta("sbooknotoc"));
	    if (getMeta("sbookterminal"))
		Codex.terminal_rules=new fdjtDOM.Selector(
		    getMeta("sbookterminal"));
	    if ((getMeta("sbookfocus"))) 
		Codex.focus=new fdjtDOM.Selector(getMeta("sbookfocus"));
	    if (getMeta("sbooknofocus"))
		Codex.nofocus=new fdjtDOM.Selector(getMeta("sbooknofocus"));}

	function applyMetaClass(name){
	    var meta=getMeta(name,true);
	    var i=0; var lim=meta.length;
	    while (i<lim) fdjtDOM.addClass(fdjtDOM.$(meta[i++]),name);}

	var note_count=1;
	function initBody(){
	    var body=document.body;
	    var content=fdjtDOM("div#CODEXCONTENT");
	    var headmask=fdjtDOM("div.codexwinmask#CODEXWINMASKHEAD");
	    var footmask=fdjtDOM("div.codexwinmask#CODEXWINMASKFOOT");
	    var win=fdjtDOM("div#CODEXWINDOW",headmask,footmask,content);
	    // Get any author provided splash page
	    var splash=fdjtID("CODEXSPLASH");
	
	    // Save those DOM elements in a handy place
	    Codex.window=win;
	    Codex.content=content;
	    Codex.winmaskhead=headmask;
	    Codex.winmaskfoot=footmask;

	    // Move the publisher-provided splash page directly into
	    //  the body (if neccessary)
	    if ((splash)&&(splash.parentNode!==body))
		fdjtDOM.prepend(body,splash);
	    var children=body.childNodes, nodes=[];
	    var i=0, lim=children.length;
	    if (splash) {
		// Gather all of the nodes except the splash page
		while (i<lim) {
		    //  We're trying to minimize display artifacts during
		    //   startup and this shuffling about might help in
		    //   some browsers.
		    var child=children[i++];
		    if (child===splash) {i++; break;}
		    else nodes.push(child);}}
	    // Now copy the rest of the nodes into the array
	    while (i<lim) nodes.push(children[i++]);
	    
	    // Create a custom stylesheet for the app
	    var style=fdjtDOM("STYLE");
	    fdjtDOM(document.head,style);
	    Codex.stylesheet=style.sheet;

	    var i=0; var lim=nodes.length;
	    // Now, move all of the body nodes into the content element
	    while (i<lim) {
		var node=nodes[i++];
		if (node.nodeType===1) {
		    if ((node.tagName!=='LINK')&&(node.tagName!=='META')&&
			(node.tagName!=='SCRIPT'))
			content.appendChild(node);}
		else content.appendChild(node);}

	    // Initialize cover and titlepage (if specified)
	    Codex.cover=Codex.getCover();
	    Codex.titlepage=fdjtID("SBOOKTITLEPAGE");

	    // Gather special content
	    var allnotes=fdjtID("SBOOKNOTES");
	    var allasides=fdjtID("SBOOKASIDES");
	    var alldetails=fdjtID("SBOOKDETAILS");
	    if (!(alldetails)) {
		var alldetails=fdjtDOM("div#SBOOKDETAILS");
		fdjtDOM(content,alldetails);}
	    if (!(allasides)) {
		var allasides=fdjtDOM("div#SBOOKASIDES");
		fdjtDOM(content,allasides);}
	    if (!(allnotes)) {
		var allnotes=fdjtDOM("div.sbookbackmatter#SBOOKNOTES");
		fdjtDOM(content,allnotes);}
	    
	    var page=Codex.page=fdjtDOM(
		"div#CODEXPAGE",
		fdjtDOM("div#CODEXPAGINATING","Laid out ",
			fdjtDOM("span#CODEXPAGEPROGRESS",""),
			" pages"),
		Codex.pages=fdjtDOM("div#CODEXPAGES"));
	    
	    fdjtDOM(body,win,page);
	    fdjtDOM.addClass(body,"sbook");
	    sizePage(page,content);
	    applyMetaClass("sbookdetails");
	    applyMetaClass("sbooknoteref");
	    applyMetaClass("sbookbibref");
	    applyMetaClass("sbookxnote");
	    applyMetaClass("sbookaside");
	    applyMetaClass("sbookbackmatter");
	    var sbookxnotes=fdjtDOM.$("sbookxnote");
	    // Add refs for all of the xnotes
	    var i=0; var lim=sbookxnotes.length;
	    while (i<lim) {
		var note=sbookxnotes[i++];
		var anchor=fdjtDOM("A.sbooknoteref","\u2193");
		var count=note_count++;
		anchor.id="SBOOKNOTEREF"+count;
		if (!(note.id)) note.id="SBOOKNOTE"+count;
		anchor.href="#"+note.id;
		fdjtDOM.insertBefore(note,anchor);}
	    // Move all the notes to the end
	    var noterefs=fdjtDOM.$(".sbooknoteref,.sbookbibref");
	    var i=0; var lim=noterefs.length;
	    while (i<lim) {
		var noteref=noterefs[i++];
		var idcontext=Codex.getTarget(noteref.parentNode);
		if ((noteref.href)&&(noteref.href[0]==='#')) {
		    var noteid=noteref.href.slice(1);
		    var notenode=fdjtID(noteid);
		    if (!(notenode)) continue;
		    if ((noteref.id)||(idcontext)) {
			var backanchor=fdjtDOM("A.sbooknotebackref","\u2191");
			backanchor.href="#"+noteref.id||(idcontext.id);
			fdjtDOM.prepend(notenode,backanchor);}
		    if ((idcontext)&&(fdjtDOM.hasClass(noteref,"sbooknoteref")))
			notenode.codextocloc=idcontext.id;
		    if ((fdjtDOM.hasClass(noteref,"sbooknoteref"))&&
			(!(fdjtDOM.hasParent(notenode,".sbookbackmatter"))))
			fdjtDOM.append(allnotes,notenode);}}
	    // Move all the details to the end
	    var details=fdjtDOM.$("detail,.sbookdetail");
	    var i=0; var lim=details.length;
	    while (i<lim) {
		var detail=details[i++];
		var head=fdjtDOM.getChild(detail,"summary,.sbooksummary");
		var detailhead=
		    ((head)?(fdjtDOM.clone(head)):
		     fdjtDIV("div.sbookdetailstart",
			     (fdjtString.truncate(fdjtDOM.textify(detail),42))));
		var anchor=fdjtDOM("A.sbookdetailref",detailhead);
		var count=detail_count++;
		if (!(detail.id)) detail.id="SBOOKDETAIL"+count;
		anchor.href="#"+detail.id; anchor.id="SBOOKDETAILREF"+count;
		fdjtDOM.replace(detail,anchor);
		detail.codextocloc=anchor.id;
		fdjtDOM.append(alldetails,detail);}
	    // Move all the asides to the end
	    var asides=fdjtDOM.$("aside,.sbookaside");
	    var i=0; var lim=asides.length;
	    while (i<lim) {
		var aside=asides[i++];
		var head=fdjtDOM.getChild(aside,".sbookasidehead")||
		    fdjtDOM.getChild(aside,"HEADER")||
		    fdjtDOM.getChild(aside,"H1")||
		    fdjtDOM.getChild(aside,"H2")||
		    fdjtDOM.getChild(aside,"H3")||
		    fdjtDOM.getChild(aside,"H4")||
		    fdjtDOM.getChild(aside,"H5")||
		    fdjtDOM.getChild(aside,"H6");
		var asidehead=
		    ((head)?(fdjtDOM.clone(head)):
		     fdjtDIV("div.sbookasidestart",
			     (fdjtString.truncate(fdjtDOM.textify(aside),42))));
		var anchor=fdjtDOM("A.sbookasideref",asidehead);
		var count=aside_count++;
		if (!(aside.id)) aside.id="SBOOKASIDE"+count;
		anchor.href="#"+aside.id; anchor.id="SBOOKASIDEREF"+count;
		fdjtDOM.insertBefore(aside,anchor);
		aside.codextocloc=anchor.id;
		fdjtDOM.append(allasides,aside);}
	    // Initialize the margins
	    initMargins();
	    if (Codex.Trace.startup>1)
		fdjtLog("Initialized body");}

	function sizePage(page,content){
	    content.style.left=page.style.left='';
	    content.style.right=page.style.right='';
	    var page_width=fdjtDOM.getGeometry(page).width;
	    var page_height=fdjtDOM.getGeometry(page).height;
	    var content_width=fdjtDOM.getGeometry(content).width;
	    var view_width=fdjtDOM.viewWidth();
	    var page_margin=(view_width-page_width)/2;
	    var content_margin=(view_width-content_width)/2;
	    if (page_margin>=50) {
		page.style.left=(page_margin+15)+'px';
		page.style.right=(page_margin-15)+'px';}
	    if (content_margin>=50) {
		content.style.left=content_margin+'px';
		content.style.right=content_margin+'px';}}
	Codex.sizePage=sizePage;
	
	/* Margin creation */

	function initMargins(){
	    var topleading=fdjtDOM("div#SBOOKTOPLEADING.leading.top"," ");
	    var bottomleading=fdjtDOM("div#SBOOKBOTTOMLEADING.leading.bottom"," ");
	    topleading.codexui=true; bottomleading.codexui=true;
	    
	    var pagehead=fdjtDOM("div.codexmargin#CODEXPAGEHEAD"," ");
	    var pageright=fdjtDOM("div#CODEXPAGERIGHT");
	    var pageleft=fdjtDOM("div#CODEXPAGELEFT");
	    
	    var pageinfo=
		fdjtDOM("div#CODEXPAGEINFO",
			fdjtDOM("div.progressbar#CODEXPROGRESSBAR",""),
			fdjtDOM("div#CODEXPAGENO",
				fdjtDOM("span#CODEXPAGENOTEXT","p/n")),
			fdjtDOM("span.locoff#CODEXLOCOFF","??%"));
	    var pagefoot=fdjtDOM("div.codexmargin#CODEXPAGEFOOT",pageinfo," ");
	    pagehead.codexui=true; pagefoot.codexui=true;
	    Codex.pagehead=pagehead; Codex.pagefoot=pagefoot;
	    
	    fdjtDOM.prepend(document.body,pagehead,pagefoot,pageleft,pageright);

	    for (var pagelt in [pagehead,pageright,pageleft,pagefoot,pageinfo]) {
		fdjtDOM.addListeners(
		    pageinfo,Codex.UI.handlers[Codex.ui]["#"+pagelt.id]);}

	    window.scrollTo(0,0);
	    
	    // The better way to do this might be to change the stylesheet,
	    //  but fdjtDOM doesn't currently handle that 
	    var bgcolor=getBGColor(document.body)||"white";
	    Codex.backgroundColor=bgcolor;
	    if (bgcolor==='transparent')
		bgcolor=fdjtDOM.getStyle(document.body).backgroundColor;
	    if ((bgcolor)&&(bgcolor.search("rgba")>=0)) {
		if (bgcolor.search(/,\s*0\s*\)/)>0) bgcolor='white';
		else {
		    bgcolor=bgcolor.replace("rgba","rgb");
		    bgcolor=bgcolor.replace(/,\s*((\d+)|(\d+.\d+))\s*\)/,")");}}
	    else if (bgcolor==="transparent") bgcolor="white";
	    pagehead.style.backgroundColor=bgcolor;
	    pagefoot.style.backgroundColor=bgcolor;
	    fdjtDOM.addListener(window,"resize",function(evt){
		Codex.resizeBody();
		Codex.sizePage(Codex.page,Codex.content);
		Codex.resizeHUD();
		if ((Codex.layout)&&(Codex.layout.onresize))
		    Codex.layout.onresize(evt||event);});}
	
	function getBGColor(arg){
	    var color=fdjtDOM.getStyle(arg).backgroundColor;
	    if (!(color)) return false;
	    else if (color==="transparent") return false;
	    else if (color.search(/rgba/)>=0) return false;
	    else return color;}

	/* Loading meta info (user, glosses, etc) */

	function loadInfo(info) {
	    if ((window._sbook_loadinfo!==info)&&(Codex.user))
		Codex.setConnected(true);
	    if (!(Codex.user)) {
		if (info.userinfo)
		    setUser(info.userinfo,
			    info.outlets,info.overlays,
			    info.sync);
		else addClass(document.body,"cxNOUSER");
		if (info.nodeid) setNodeID(info.nodeid);
		if (info.sync) Codex.sync=info.sync;}
	    else if (info.wronguser) {
		Codex.clearOffline(Codex.refuri);
		window.location=window.location.href;
		return;}
	    if (info.mycopyid) {
		if ((Codex.mycopyid)&&
		    (info.mycopid!==Codex.mycopyid))
		    fdjtLog.warn("Mismatched mycopyids");
		else Codex.mycopyid=info.mycopyid;}
	    if (!(Codex.docinfo)) { /* Scan not done */
		Codex.scandone=function(){loadInfo(info);};
		return;}
	    else if (info.loaded) return;
	    if (window._sbook_loadinfo) {
		// This means that we have more information from the gloss
		// server before the local app has gotten around to
		// processing  the app-cached loadinfo.js
		// In this case, we put it in _sbook_new_loadinfo
		window._sbook_newinfo=info;
		return;}
	    var refuri=Codex.refuri;
	    if ((Codex.persist)&&
		(info)&&(info.userinfo)&&(Codex.user)&&
		(info.userinfo._id!==Codex.user._id)) {
		clearOffline(refuri);}
	    var persist=((Codex.persist)&&(navigator.onLine));
	    info.loaded=fdjtTime();
	    if ((!(Codex.localglosses))&&
		((getLocal("sync("+refuri+")"))||
		 (getLocal("queued("+refuri+")"))))
		initGlossesOffline();
	    if (Codex.Trace.glosses) {
		fdjtLog("loadInfo for %d %sglosses and %d refs (sync=%d)",
			((info.glosses)?(info.glosses.length):(0)),
			((Codex.sync)?("updated "):("")),
			((info.etc)?(info.etc.length):(0)),
			info.sync)
		fdjtLog("loadInfo got %d sources, %d outlets, and %d overlays",
			((info.sources)?(info.sources.length):(0)),
			((info.outlets)?(info.outlets.length):(0)),
			((info.overlays)?(info.overlays.length):(0)));}
	    if ((info.glosses)||(info.etc))
		initGlosses(info.glosses,info.etc);
	    if (info.etc) gotInfo("etc",info.etc,persist);
	    if (info.sources) gotInfo("sources",info.sources,persist);
	    if (info.outlets) gotInfo("outlets",info.outlets,persist);
	    if (info.overlays) gotInfo("overlays",info.overlays,persist);
	    Codex.addOutlets2UI(info.outlets);
	    if ((info.sync)&&((!(Codex.sync))||(info.sync>=Codex.sync))) {
		setLocal("sync("+refuri+")",info.sync);
		Codex.sync=info.sync;}
	    Codex.loaded=info.loaded=fdjtTime();
	    if (Codex.glosshash) {
		if (Codex.showGloss(Codex.glosshash))
		    Codex.glosshash=false;}}
	Codex.loadInfo=loadInfo;

	var updating=false;
	Codex.updatedInfo=function(data){
	    loadInfo(data);
	    updating=false;};
	function updateInfo(callback){
	    if (updating) return;
	    if (!(navigator.onLine)) return;
	    if (!(callback)) callback="Codex.updatedInfo";
	    var elt=fdjtID("CODEXUPDATEINFO");
	    var update_script=fdjtDOM("script#CODEXUPDATEINFO");
	    var uri="https://"+Codex.server+"/v1/loadinfo.js?REFURI="+
		encodeURIComponent(Codex.refuri)+"&CALLBACK=Codex.updatedInfo";
	    var glosses=fdjtState.getQuery("GLOSS");
	    if ((glosses)&&(glosses.length)) {
		var i=0, lim=glosses.length; while (i<lim)
		    uri=uri+"&GLOSS="+glosses[i++];}
	    if (Codex.mycopyid)
		uri=uri+"&MCOPYID="+encodeURIComponent(Codex.mycopyid);
	    if (Codex.sync) uri=uri+"&SYNC="+(Codex.sync+1);
	    if (Codex.user) uri=uri+"&SYNCUSER="+Codex.user._id;
	    update_script.language="javascript";
	    update_script.type="text/javascript";
	    update_script.setAttribute("charset","utf-8");
	    update_script.setAttribute("async","async");
	    if (Codex.mycopyid)
		update_script.setAttribute("crossorigin","anonymous");
	    else update_script.setAttribute("crossorigin","use-credentials");
	    update_script.src=uri;
	    updating=true;
	    if (elt) fdjtDOM.replace(elt,update_script);
	    else document.body.appendChild(update_script);}

	function getUser() {
	    var refuri=Codex.refuri;
	    var loadinfo=window._sbook_loadinfo||false;
	    if (Codex.Trace.startup>1)
		fdjtLog("Getting user for %o cur=%o",refuri,Codex.user);
	    if (Codex.user) return Codex.user;
	    else if (Codex.nologin) return false;
	    if ((loadinfo)&&(gotUser(loadinfo)))
		return Codex.user;
	    else if ((typeof _sbook_userinfo !== 'undefined')&&
		     gotUser(_sbook_userinfo))
		return Codex.user;
	    if (getLocal("codex.user")) {
		var user=getLocal("codex.user");
		if (Codex.Trace.startup)
		    fdjtLog("Restoring offline user info for %o reading %o",
			    user,refuri);
		var userinfo=JSON.parse(getLocal(user));
		var sources=getLocal("sources("+refuri+")",true);
		var outlets=getLocal("outlets("+refuri+")",true);
		var nodeid=getLocal("nodeid("+refuri+")");
		var sync=getLocal("codex.usersync",true);
		gotUser(userinfo,nodeid,sources,outlets,etcinfo,sync);
		return;}
	    else if ((!(fdjtID("SBOOKLOADINFO")))&&
		     (!(fdjtID("CODEXLOADINFO")))) {
		updateInfo("Codex.gotInfo");
		fdjtDOM.addClass(document.body,"cxNOUSER");}
	    else fdjtDOM.addClass(document.body,"cxNOUSER");}
	
	function setUser(userinfo,outlets,overlays,sync){
	    var persist=((Codex.persist)&&(navigator.onLine));
	    var refuri=Codex.refuri;
	    if (userinfo) {
		fdjtDOM.dropClass(document.body,"cxNOUSER");
		fdjtDOM.addClass(document.body,"cxUSER");}
	    if (Codex.user)
		if (userinfo._id===Codex.user._id) {}
	    else throw { error: "Can't change user"};
	    var cursync=Codex.sync;
	    if ((cursync)&&(cursync>=sync)) {
		fdjtLog.warn(
		    "Cached user information is newer (%o) than loaded (%o)",
		    cursync,sync);
		return false;}
	    Codex.user=fdjtKB.Import(userinfo);
	    if (persist) setConfig("localstorage",true,true);
	    if (outlets) Codex.outlets=outlets;
	    if (overlays) Codex.overlays=overlays;
	    if (persist) {
		setLocal(Codex.user._id,Codex.user,true);
		setLocal("codex.user",Codex.user._id);}
	    setupUI4User();
	    return Codex.user;}
	Codex.setUser=setUser;
	
	function setNodeID(nodeid){
	    var refuri=Codex.refuri;
	    if (!(Codex.nodeid)) {
		Codex.nodeid=nodeid;
		if ((nodeid)&&(Codex.persist))
		    setLocal("nodeid("+refuri+")",nodeid);}}
	Codex.setNodeID=setNodeID;

	function setupUI4User(){
	    if (Codex._user_setup) return;
	    if (!(Codex.user)) {
		fdjtDOM.addClass(document.body,"cxNOUSER");
		return;}
	    fdjtDOM.dropClass(document.body,"cxNOUSER");
	    var username=Codex.user.name;
	    if (fdjtID("CODEXUSERNAME"))
		fdjtID("CODEXUSERNAME").innerHTML=username;
	    var names=document.getElementsByName("CODEXUSERNAME");
	    if (names) {
		var i=0, lim=names.length;
		while (i<lim) names[i++].innerHTML=username;}
	    if (fdjtID("SBOOKMARKUSER"))
		fdjtID("SBOOKMARKUSER").value=Codex.user._id;

	    // Initialize the splashform, which provides easy login
	    // and social features
	    var splashform=fdjtID("CODEXSPLASHFORM");
	    var docinput=fdjtDOM.getInput(splashform,"DOCURI");
	    if (docinput) docinput.value=Codex.docuri;
	    var refinput=fdjtDOM.getInput(splashform,"REFURI");
	    if (refinput) refinput.value=Codex.refuri;
	    var topinput=fdjtDOM.getInput(splashform,"TOPURI");
	    if (topinput) topinput.value=document.location.href;
	    var xquery=fdjtDOM.getInput(splashform,"XQUERY");
	    var query=document.location.query;
	    if (xquery) xquery.value=(((query)&&(query!=="?"))?(query):"");

	    /* Initialize add gloss prototype */
	    var ss=Codex.stylesheet;
	    var form=fdjtID("CODEXADDGLOSSPROTOTYPE");
	    var buttons=fdjtID("CODEXNETWORKBUTTONS");
	    var getChild=fdjtDOM.getChild;
	    if (Codex.user.fbid)  
		ss.insertRule(
		    "div#CODEXHUD span.facebook_share { display: inline;}",
		    ss.cssRules.length);
	    if (Codex.user.twitterid) 
		ss.insertRule(
		    "div#CODEXHUD span.twitter_share { display: inline;}",
		    ss.cssRules.length);
	    if (Codex.user.linkedinid) 
		ss.insertRule(
		    "div#CODEXHUD span.linkedin_share { display: inline;}",
		    ss.cssRules.length);
	    if (Codex.user.googleid) 
		ss.insertRule(
		    "div#CODEXHUD span.google_share { display: inline;}",
		    ss.cssRules.length);
	    var pic=
		(Codex.user.pic)||
		((Codex.user.fbid)&&
		 ("https://graph.facebook.com/"+Codex.user.fbid+
		  "/picture?type=square"));
	    if (pic) {
		if (fdjtID("SBOOKMARKIMAGE")) fdjtID("SBOOKMARKIMAGE").src=pic;
		if (fdjtID("CODEXUSERPIC")) fdjtID("CODEXUSERPIC").src=pic;
		var byname=document.getElementsByName("CODEXUSERPIC");
		if (byname) {
		    var i=0; var lim=byname.length;
		    while (i<lim) byname[i++].src=pic;}}
	    var idlinks=document.getElementsByName("IDLINK");
	    if (idlinks) {
		var i=0; var len=idlinks.length;
		while (i<len) {
		    var idlink=idlinks[i++];
		    idlink.target='_blank';
		    idlink.title='click to edit your personal information';
		    idlink.href='https://auth.sbooks.net/my/profile';}}
	    if (Codex.user.friends) {
		var friends=Codex.user.friends;
		var i=0; var lim=friends.length;
		while (i<lim) {
		    var friend=fdjtKB.ref(friends[i++]);
		    Codex.addTag2GlossCloud(friend);}}
	    Codex._user_setup=true;}
	
	// Processes info loaded remotely
	function gotInfo(name,info,persist) {
	    var refuri=Codex.refuri;
	    if (info) {
		if (info instanceof Array) {
		    var i=0; var lim=info.length; var qids=[];
		    while (i<lim) {
			if (typeof info[i] === 'string') {
			    var qid=info[i++];
			    if (Codex.persist) fdjtKB.load(qid);
			    qids.push(qid);}
			else {
			    var obj=fdjtKB.Import(info[i++]);
			    if (persist) 
				setLocal(obj._id,obj,true);
			    qids.push(obj._id);}}
		    Codex[name]=qids;
		    if (Codex.persist)
			setLocal(name+"("+refuri+")",qids,true);}
		else {
		    var obj=fdjtKB.Import(info);
		    if (persist) 
			setLocal(obj._id,obj,true);
		    Codex[name]=obj._id;
		    if (persist)
			setLocal(name+"("+refuri+")",qid,true);}}}

	function setupGlosses(newglosses) {
	    var allglosses=Codex.allglosses||[];
	    Codex.glosses.Import(newglosses);
	    if (newglosses.length) {
		var n=newglosses.length; var i=0; while (i<n) {
		    var gloss=newglosses[i++];
		    var id=gloss._id;
		    var tstamp=gloss.syncstamp||gloss.tstamp;
		    if (tstamp>latest) latest=tstamp;
		    allglosses.push(id);}}
	    Codex.syncstamp=latest;
	    Codex.allglosses=allglosses;
	    if (Codex.persist) {
		setLocal("etc("+Codex.refuri+")",Codex.etc,true);
		setLocal("glosses("+Codex.refuri+")",allglosses,true);}}

	function initGlosses(glosses,etc){
	    var msg=fdjtID("CODEXNEWGLOSSES");
	    var allglosses=Codex.allglosses;
	    if (msg) {
		msg.innerHTML=fdjtString(
		    "Assimilating %d new glosses",glosses.length);
		addClass(msg,"running");}
	    if (etc) {
		startupLog("Assimilating %d new glosses/%d sources...",
			   glosses.length,etc.length);}
	    else {
		startupLog("Assimilating %d new glosses...",glosses.length);}
	    fdjtKB.Import(etc);
	    Codex.glosses.Import(glosses);
	    var i=0; var lim=glosses.length;
	    var latest=Codex.syncstamp||0;
	    while (i<lim) {
		var gloss=glosses[i++]; var id=gloss._id;
		var tstamp=gloss.syncstamp||gloss.tstamp;
		if (tstamp>latest) latest=tstamp;
		allglosses.push(id);}
	    Codex.syncstamp=latest;
	    Codex.allglosses=allglosses;
	    startupLog("Done assimilating %d new glosses...",glosses.length);
	    if (Codex.persist) {
		setLocal("glosses("+Codex.refuri+")",allglosses,true);
		setLocal("etc("+Codex.refuri+")",etc,true);}
	    dropClass(msg,"running");}
	Codex.Startup.initGlosses=initGlosses;
	
	function go_online(evt){return offline_update();}
	function offline_update(){
	    Codex.writeGlosses(); updateInfo();}
	function offline_import(results){
	    fdjtKB.Import(results);
	    var i=0; var lim=results.length;
	    var syncstamp=Codex.syncstamp; var tstamp=false;
	    while (i<lim) {
		tstamp=results[i++].tstamp;
		if ((tstamp)&&(tstamp>syncstamp)) syncstamp=tstamp;}
	    Codex.syncstamp=syncstamp;
	    setLocal("syncstamp("+Codex.refuri+")",syncstamp);}
	Codex.update=offline_update;
	
	fdjtDOM.addListener(window,"online",go_online);

	function initState() {
	    var uri=Codex.docuri||Codex.refuri;
	    var statestring=getLocal("state("+uri+")");
	    if (statestring) Codex.state=state=JSON.parse(statestring);}
	
	/* This initializes the sbook state to the initial location with the
	   document, using the hash value if there is one. */ 
	function initLocation() {
	    var state=false;
	    if (!(state)) {
		var uri=Codex.docuri||Codex.refuri;
		var statestring=getLocal("state("+uri+")");
		if (statestring) {
		    Codex.state=state=JSON.parse(statestring);
		    if (Codex.Trace.state)
			fdjtLog("Got state from local storage: %j",
				state);}
		else state={};}
	    var hash=window.location.hash; var target=false;
	    if ((typeof hash === "string") && (hash.length>0)) {
		if ((hash[0]==='#') && (hash.length>1))
		    target=document.getElementById(hash.slice(1));
		else target=document.getElementById(hash);
		if (Codex.Trace.startup>1)
		    fdjtLog("sbookInitLocation hash=%s=%o",hash,target);}
	    if (target) Codex.GoTo(target,"initLocation/hash",true,true);
	    else if ((state)&&(state.target)&&(fdjtID(state.target)))
		Codex.GoTo(state.target,"initLocation/state.target",true,true);
	    else if ((state)&&(state.location))
		Codex.GoTo(state.location,"initLocation/state.locaion",
			   false,false);
	    else if (Codex.start||Codex.cover||Codex.titlepage)
		Codex.GoTo((Codex.start||Codex.cover||Codex.titlepage),
			   "initLocation/start/cover/titlepage",
			   false,false);
	    if ((Codex.user)&&(Codex.dosync)&&(navigator.onLine))
		syncLocation();}
	
	function syncLocation() {
	    if (!(Codex.user)) return;
	    var uri="https://"+Codex.server+"/v1/sync"+
		"?DOCURI="+encodeURIComponent(Codex.docuri)+
		"&REFURI="+encodeURIComponent(Codex.refuri);
	    if (Codex.Trace.dosync)
		fdjtLog("syncLocation(call) %s",uri);
	    try {
		fdjtAjax(function(req){
		    var d=JSON.parse(req.responseText);
		    Codex.setConnected(true);
		    Codex.syncstart=true;
		    if (Codex.Trace.dosync)
			fdjtLog("syncLocation(callback) %s: %j",uri,d);
		    if ((!(d))||(!(d.location))) {
			if (!(Codex.state))
			    Codex.GoTo(Codex.start||Codex.root||Codex.body,
				       "syncLocation",false,false);
			return;}
		    else if ((!(Codex.state))||(Codex.state.tstamp<d.tstamp)) {
			if ((d.location)&&(d.location<=Codex.location)) return;
			if (d.page===Codex.curpage) return;
			var msg=
			    "Sync to L"+Codex.location2pct(d.location)+
			    ((d.page)?(" (page "+d.page+")"):"")+"?";
			fdjtUI.choose([
			    {label: "No"},
			    {label: "Yes, go to that location",
			     handler: function() {
				 if (d.location) Codex.setLocation(d.location);
				 if (d.location)
				     Codex.GoTo(d.location,"syncLocation",
						false);
				 if (d.target) Codex.setTarget(d.target);}}],
				      msg);}
		    Codex.state=d;},
			 uri,false,
			 function(req){
			     if ((req.readyState == 4)&&(navigator.onLine))
				 Codex.setConnected(false);});}
	    catch (ex) {Codex.dosync=false;}}
	Codex.syncLocation=syncLocation;

	/* Indexing tags */
	
	function indexingDone(){
	    startupLog("Content indexing is completed");
	    if (Codex.loaded) {
		startupLog("Setting up tag clouds");
		initClouds();}
	    else {
		Codex.whenloaded=function(){
		    startupLog("Setting up tag clouds");
		    initClouds();};}}
	
	/* Using the autoindex generated during book building */
	function useIndexData(autoindex,knodule,baseweight,whendone){
	    var sbook_index=Codex.index;
	    if (!(autoindex)) return;
	    if (!(sbook_index)) return;
	    for (var tag in autoindex) {
		if (!(autoindex.hasOwnProperty(tag))) continue;
		var ids=autoindex[tag];
		var starpower=tag.search(/[^*]/);
		// all stars or empty string, just ignore
		if (starpower<0) continue;
		var weight=((tag[0]==='~')?(0):(2*starpower));
		var literal=(tag[0]==='~');
		var knode=((tag.indexOf('|')>=0)?
			   (knodule.handleSubjectEntry(tag)):
			   (tag[0]==='~')?(tag.slice(1)):
			   (knodule.handleSubjectEntry(tag)));
		if ((literal)&&(typeof knode !== 'string'))
		    knode.literal=knode.weak=true;
		var i=0; var lim=ids.length;
		while (i<lim) {
		    var idinfo=ids[i++];
		    var frag=((typeof idinfo === 'string')?
			      (idinfo):(idinfo[0]));
		    var info=Codex.docinfo[frag];
		    // Pointer to non-existent node.  Warn here?
		    if (!(info)) continue;
		    var tagval=((typeof knode === 'string')?(knode):
				(knode._qid||knode.dterm));
		    if (info.autotags) info.autotags.push(tagval);
		    else info.autotags=[tagval];
		    if (typeof knode !== 'string') {
			if (info.knodes) info.knodes.push(knode);
			else info.knodes=[knode];}
		    if (typeof idinfo === 'string') {}
		    // When the idinfo is an array, the first
		    // element is the id itself and the remaining
		    // elements are the text strings which
		    // actually matches the tag (we use this for
		    // highlighting).
		    else {
			var knodeterms=info.knodeterms, terms;
			// If it's the regular case, we just assume that
			if (!(info.knodeterms)) {
			    knodeterms=info.knodeterms={};
			    knodeterms[tagval]=terms=[];}
			else if (terms=knodeterms[tagval]) {}
			else knodeterms[tagval]=terms=[];
			var j=1; var jlim=idinfo.length;
			while (j<jlim) {terms.push(idinfo[j++]);}}
		    sbook_index.add(
			info._id,knode,starpower||baseweight||0,
			knodule);}}
	    if (whendone) whendone();}
	Codex.useIndexData=useIndexData;
	
	/* Applying various tagging schemes */

	function applyTagSpans(){
	    startupMessage("Applying inline tags");
	    var tags=fdjtDOM.$(".sbooktags");
	    var i=0; var lim=tags.length;
	    while (i<lim) {
		var tagelt=tags[i++];
		var target=Codex.getTarget(tagelt);
		var info=Codex.docinfo[target.id];
		var tagtext=fdjtDOM.textify(tagelt);
		var tagsep=tagelt.getAttribute("tagsep")||";";
		var tagstrings=tagtext.split(tagsep);
		if (tagstrings.length) {
		    if (info.tags)
			info.tags=info.tags.concat(tagstrings);
		    else info.tags=tagstrings;}}}
	
	function applyAnchorTags(kno) {
	    var sbook_index=Codex.index; var docinfo=Codex.docinfo;
	    var getTarget=Codex.getTarget;
	    var getNodeID=fdjtDOM.getNodeID;
	    var anchors=document.getElementsByTagName("A");
	    if (!(anchors)) return;
	    var i=0; var len=anchors.length;
	    while (i<len) {
		if (anchors[i].rel==='tag') {
		    var elt=anchors[i++];
		    var cxt=elt;
		    while (cxt) if (cxt.id) break; else cxt=cxt.parentNode;
		    // Nowhere to store it?
		    if (!(cxt)) return;
		    var eltid=elt.id||getNodeID(elt);
		    var href=elt.href; var name=elt.name; var tag=false;
		    if (name) { // DTerm style
			var def=elt.getAttribute('data-def')||
			    elt.getAttribute('data-def');
			var title=elt.title;
			if (def) {
			    if (def[0]==='|') tag=tag+def;
			    else tag=tag+"|"+def;}
			else if (title) {
			    if (title[0]==='|') tag=name+title;
			    else if (title.indexOf('|')>0) {
				tag=name+"|"+title;}
			    else tag=name+"|~"+title;}
			else tag=name;}
		    else if (href) {
			// Technorati style
			var tagstart=(href.search(/[^\/]+$/));
			tag=((tagstart<0)?(href):(href.slice(tagstart)));}
		    else {}
		    if (tag) {
			var info=docinfo[cxt.id];
			if (info.tags) info.tags.push(tag);
			else info.tags=[tag];}}
		else i++;}}
	
	/* Indexing tags */
	
	function indexAssignedTags(docinfo,whendone){
	    var ix=Codex.index; var knodule=Codex.knodule;
	    /* One pass processes all of the inline KNodes and
	       also separates out primary and auto tags. */
	    var tagged=[]; var toindex=[];
	    for (var eltid in docinfo) {
		var info=docinfo[eltid], tags=info.tags;
		if (tags) tagged.push(tags);
		if ((tags)||(info.sectags)||
		    ((info.head)&&(info.head.sectags)))
		    toindex.push(info);}
	    if ((Codex.Trace.indexing)&&
		((Codex.Trace.indexing>1)||
		 (tagged.length>7)))
		fdjtLog("Indexing inline tags for %d nodes (%d assigned)",
			toindex.length,tagged.length);
	    fdjtTime.slowmap(
		process_inline_tags,
		tagged,false,
		function(){
		    if ((Codex.Trace.indexing>1)&&(tagged.length))
			fdjtLog("Finished processing inline tags for %d nodes",
				tagged.length);
		    fdjtTime.slowmap(
			index_inline_tags(ix,knodule),
			toindex,false,
			function(){
			    if ((Codex.Trace.indexing)&&
				((Codex.Trace.indexing>1)||
				 (tagged.length>7)))
				fdjtLog("Done inline indexing for %d nodes",
					toindex.length);
			    whendone();});});}
	Codex.indexAssignedTags=indexAssignedTags;
	
	function process_inline_tags(tags){
	    var k=0; var ntags=tags.length;
	    var scores=tags.scores||false;
	    var knodule=Codex.knodule;
	    if (!(scores)) tags.scores=scores={};
	    while (k<ntags) {
		var tag=tags[k]; var score=1; var tagbase=false;
		if (tag[0]==='*') {
		    var tagstart=tag.search(/[^*]+/);
		    score=2*(tagstart+1);
		    tagbase=tag.slice(tagstart);}
		else if (tag[0]==='~') {
		    var tagstart=tag.search(/[^~]+/);
		    tag=tag.slice(tagstart);
		    if (tagstart>1) {
			if (!(scores)) tags.scores=scores={};
			score=1/tagstart;}
		    else score=1;}
		else {
		    tagbase=tag;
		    score=2;}
		if (tagbase) {
		    var knode=((tagbase.indexOf('|')>0)?
			       (knodule.handleSubjectEntry(tagbase)):
			       (knodule.ref(tagbase)));
		    if ((knode)&&(knode.tagString))
			tag=knode.tagString();}
		tags[k]=tag;
		scores[tag]=score;
		k++;}
	    if (scores) {
		tags.sort(function(t1,t2){
		    var s1=scores[t1]||1; var s2=scores[t2]||1;
		    if (s1>s2) return -1;
		    else if (s1<s2) return 1;
		    else if (t1<t2) return -1;
		    else if (t1>t2) return 1;
		    else return 0;});}
	    else tags.sort();}

	function index_inline_tags(ix,knodule){
	    var addTag2Search=Codex.addTag2SearchCloud;
	    return function (info){
		var eltid=info.frag;
		var tags=info.tags||[]; 
		if (tags) {
		    var scores=tags.scores;
		    var k=0; var ntags=tags.length;
		    while (k<ntags) {
			var tag=tags[k++];
			if (scores)
			    ix.add(eltid,tag,scores[tag]||1,knodule);
			else ix.add(eltid,tag,1,knodule);
			addTag2Search(tag);}}
		var sectags=info.sectags||
		    ((info.head)&&(info.head.sectags));
		if (sectags) {
		    var k=0, ntags=sectags.length;
		    while (k<ntags) {
			var tag=sectags[k++];
			ix.add(eltid,tag,0,knodule);
			addTag2Search(tag);}}};}
	
	/* Setting up the clouds */
	
	function initClouds(){
	    startupMessage("setting up search cloud...");
	    fdjtDOM.replace("CODEXSEARCHCLOUD",Codex.searchCloud().dom);
	    startupMessage("setting up glossing cloud...");
	    Codex.glossCloud();
	    startupMessage("setting up outlet cloud...");
	    Codex.outletCloud();
	    if (Codex.gloss_cloud_queue) {
		if (Codex.Trace.clouds)
		    fdjtLog("Starting to sync gloss cloud");
		fdjtTime.slowmap(
		    Codex.addTag2GlossCloud,Codex.gloss_cloud_queue,false,
		    function(){
			Codex.cloud_queue=false;
			if (Codex.Trace.clouds)
			    fdjtLog("Gloss cloud synced");});}
	    if (Codex.outlet_cloud_queue) {
		if (Codex.Trace.clouds)
		    fdjtLog("Starting to sync outlet cloud");
		fdjtTime.slowmap(
		    Codex.addOutlets2UI,Codex.outlet_cloud_queue,false,
		    function(){
			Codex.cloud_queue=false;
			if (Codex.Trace.clouds)
			    fdjtLog("Outlet cloud synced");});}
	    if (Codex.knodule) {
		if (Codex.Trace.knodules)
		    fdjtLog("Beginning knodule integration");
		fdjtTime.slowmap(Codex.addTag2GlossCloud,
				 Codex.knodule.alldterms,false,
				 function(){
				     if (Codex.Trace.knodules)
					 fdjtLog("Knodule integrated");});}
	    Codex.sizeCloud(Codex.search_cloud);
	    Codex.sizeCloud(Codex.gloss_cloud);}
	
	/* Clearing offline data */

	function clearOffline(refuri,global){
	    var dropLocal=fdjtState.dropLocal;
	    if (refuri) {
		var glosses=getLocal("glosses("+refuri+")",true);
		var i=0; var lim=glosses.length;
		while (i<lim) fdjtState.dropLocal(glosses[i++]);
		dropLocal("sources("+refuri+")");
		dropLocal("glosses("+refuri+")");
		dropLocal("outlets("+refuri+")");
		dropLocal("overlays("+refuri+")");
		dropLocal("queued("+refuri+")");
		dropLocal("state("+refuri+")");
		dropLocal("sync("+refuri+")");
		dropLocal("user("+refuri+")");
		dropLocal("sync("+refuri+")");
		dropLocal("nodeid("+refuri+")");
		dropLocal("etc("+refuri+")");
		dropLocal("offline("+refuri+")");
		var refuris=getLocal("codex.refuris",true);
		refuris=fdjtKB.remove(refuris,refuri);
		setLocal("codex.refuris",refuris,true);}
	    else {
		var refuris=getLocal("codex.refuris",true);
		var i=0; var lim=refuris.length;
		while (i<lim) clearOffline(refuris[i++]);
		dropLocal("codex.config");
		dropLocal("codex.user");
		dropLocal("codex.refuris");
		var local=fdjtState.listLocal();
		i=0; lim=local.length; while (i<lim) {
		    var key=local[i++];
		    if (key[0]==='@') dropLocal(key);}}}
	Codex.clearOffline=clearOffline;

	/* Other setup */
	
	function setupGlossServer(){}

	Codex.StartupHandler=function(evt){
	    Startup();};

	return Startup;})();
sbookStartup=Codex.StartupHandler;
Codex.Setup=Codex.StartupHandler;
sbook={Start: Codex.Startup,
       setUser: Codex.setUser,
       Startup: Codex.Startup};

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
