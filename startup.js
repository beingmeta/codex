/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

var codex_startup_id="$Id$";
var codex_startup_version=parseInt("$Revision$".slice(10,-1));

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
   if _sbook_loadinfo, do gotInfo(_sbook_loadinfo);
   else do a JSONP call.
*/

var _sbook_autoindex=
    ((typeof _sbook_autoindex === 'undefined')?(false):(_sbook_autoindex));

Codex.Startup=
    (function(){

	var sbook_faketouch=false;
	var sbook_showconsole=true;

	var sbook_heading_qricons=false;

	var https_graphics=
	    "https://beingmeta.s3.amazonaws.com/static/graphics/";

	function sbicon(name,suffix) {return Codex.graphics+name+(suffix||"");}
	function cxicon(name,suffix) {
	    return Codex.graphics+"codex/"+name+(suffix||"");}

	var getLocal=fdjtState.getLocal;
	var setLocal=fdjtState.setLocal;

	/* Initialization */
	
	var _sbook_setup_start=false;
	
	var addClass=fdjtDOM.addClass;
	var dropClass=fdjtDOM.dropClass;
	var TOA=fdjtDOM.Array;

	function startupLog(){
	    var args=TOA(arguments);
	    // var div=fdjtDOM("div#CODEXSTARTUPMSG",fdjtString.apply(null,args));
	    fdjtLog.apply(null,arguments);
	    // fdjtDOM.replace("CODEXSTARTUPMSG",div);
	}

	function startupMessage(){
	    var args=TOA(arguments);
	    // var div=fdjtDOM("div#CODEXSTARTUPMSG",fdjtString.apply(null,args));
	    if ((Codex.Trace.startup)&&
		(typeof Codex.Trace.startup === "number")&&
		(Codex.Trace.startup>1))
		fdjtLog.apply(null,arguments);
	    // fdjtDOM.replace("CODEXSTARTUPMSG",div);
	}
	Codex.startupMessage=startupMessage;

	/* Configuration information */

	var config_handlers={};
	var default_config=
	    {pageview: true,
	     bodysize: 'normal',bodyfamily: 'serif',
	     uisize: 'normal',showconsole: false,
	     animatepages: true,animatehud: true,
	     hidesplash: false};
	var current_config={};

	var setCheckSpan=fdjtUI.CheckSpan.set;

	function addConfig(name,handler){
	    if (Codex.Trace.config)
		fdjtLog("Adding config handler for %s: %s",name,handler);
	    config_handlers[name]=handler;}
	Codex.addConfig=addConfig;

	function getConfig(name){
	    if (!(name)) return current_config;
	    else return current_config[name];}
	Codex.getConfig=getConfig;

	function setConfig(name,value){
	    if (arguments.length===1) {
		var config=name;
		Codex.postconfig=[];
		if (Codex.Trace.config) fdjtLog("batch setConfig: %s",config);
		for (var setting in config) {
		    if (config.hasOwnProperty(setting))
			setConfig(setting,config[setting]);}
		var dopost=Codex.postconfig;
		Codex.postconfig=false;
		if ((Codex.Trace.config)&&(!((dopost)||(dopost.length===0))))
		    fdjtLog("batch setConfig, no post processing",config);
		var i=0; var lim=dopost.length;
		while (i<lim) {
		    if (Codex.Trace.config)
			fdjtLog("batch setConfig, post processing %s",dopost[i]);
		    dopost[i++]();}
		return;}
	    if (current_config[name]===value) return;
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
	    if (config_handlers[name]) {
		if (Codex.Trace.config) fdjtLog("setConfig (handler=%s) %o=%o",
						config_handlers[name],name,value);
		config_handlers[name](name,value);}
	    current_config[name]=value;}
	Codex.setConfig=setConfig;

	function saveConfig(config){
	    if (Codex.Trace.config) {
		fdjtLog("saveConfig %o",config);
		fdjtLog("current_config=%o",current_config);}
	    if (!(config)) config=current_config;
	    // Save automatically applies (seems only fair)
	    else setConfig(config);
	    var saved={};
	    for (var setting in config) {
		if ((!(default_config.hasOwnProperty(setting)))||
		    (config[setting]!==default_config[setting])) {
		    saved[setting]=config[setting];}}
	    if (Codex.Trace.config) fdjtLog("Saving config %o",saved);
	    setLocal('codex.config',JSON.stringify(saved));}
	Codex.saveConfig=saveConfig;

	function initConfig(){
	    var config=getLocal('codex.config',true);
	    Codex.postconfig=[];
	    if (Codex.Trace.config) fdjtLog("initConfig (saved) %o",config);
	    if (config) {
		for (var setting in config) {
		    if (config.hasOwnProperty(setting)) 
			setConfig(setting,config[setting]);}}
	    else config={};
	    if (Codex.Trace.config)
		fdjtLog("initConfig (default) %o",default_config);
	    for (var setting in default_config) {
		if (!(config[setting]))
		    if (default_config.hasOwnProperty(setting))
			setConfig(setting,default_config[setting]);}
	    var dopost=Codex.postconfig;
	    Codex.postconfig=false;
	    var i=0; var lim=dopost.length;
	    while (i<lim) dopost[i++]();
	    
	    var deviceid=current_config.deviceid;
	    var devicename=current_config.devicename;
	    if (!(deviceid)) {
		deviceid=fdjtState.getUUID();
		setConfig("deviceid",deviceid);}
	    Codex.deviceId=deviceid;
	    if (!(devicename)) {
		var vi=fdjtState.versionInfo(); var now=new Date();
		devicename=vi.browser+"/"+vi.platform+"/0"+
		    (now.getFullYear())+"/"+
		    ((now.getMonth())+1)+"/"+
		    (now.getDate())+"-"+(Math.floor(Math.random()*1000000));
		setConfig('devicename',devicename);}
	    Codex.deviceName=devicename;

	    saveConfig();}

	var getParent=fdjtDOM.getParent;
	var getChild=fdjtDOM.getChild;

	function updateConfig(name,id){
	    var elt=((typeof id === 'string')&&(document.getElementById(id)))||
		((id.nodeType)&&(getParent(id,'input')))||
		((id.nodeType)&&(getChild(id,'input')))||
		((id.nodeType)&&(getChild(id,'textarea')))||
		((id.nodeType)&&(getChild(id,'select')))||
		(id);
	    if (Codex.Trace.config) fdjtLog("Update config %s",name);
	    if ((elt.type=='radio')||(elt.type=='checkbox'))
		setConfig(name,elt.checked||false);
	    else setConfig(name,elt.value);}
	Codex.updateConfig=updateConfig;

	Codex.addConfig("hidesplash",function(name,value){
	    Codex.hidesplash=value;});
	Codex.addConfig("devicename",function(name,value){
	    Codex.deviceName=value;});
	Codex.addConfig("deviceid",function(name,value){
	    Codex.deviceId=value;});

	function Startup(force){
	    if (Codex._setup) return;
	    if ((!force)&&(fdjtState.getQuery("nosbooks"))) return; 
	    fdjtLog.console="CODEXCONSOLELOG";
	    fdjtLog.consoletoo=true;
	    fdjtLog("This is Codex version %s, built at %s on %s",
		    Codex.version,sbooks_buildtime,sbooks_buildhost);
	    if (navigator.appVersion)
		fdjtLog("Navigator App version: %s",navigator.appVersion);
	    if (!(Codex._setup_start)) Codex._setup_start=new Date();
	    // Get various settings for the sBook, including
	    // information for scanning, graphics, glosses, etc
	    readSettings();
	    // Execute any FDJT initializations
	    fdjtDOM.init();
	    // Declare this to invoke some style constraints
	    fdjtDOM.addClass(document.body,"codexstartup");
	    var metadata=false;
	    var helphud=false;
	    // Initialize the databases
	    Codex.initDB();
	    // Modifies the DOM in various ways
	    initBody();
	    // This initializes the book tools (the HUD/Heads Up Display)
	    Codex.initHUD();
	    // Get any local saved configuration information
	    initConfig();
	    // Setup the UI components for the body and HUD
	    Codex.setupGestures();
	    // Init user based on locally stored user information
	    if ((!(Codex.nologin))&&(getLocal("sync("+Codex.refuri+")")))
		initUserOffline();
	    // Start JSONP call to get initial or updated glosses, etc
	    var notloading=false;
	    if (Codex.nologin) {}
	    else if (_sbook_loadinfo) {
		var msg=fdjtID("CODEXNEWGLOSSES");
		if (msg) {
		    msg.innerHTML="Using preloaded glosses";
		    addClass(msg,"running");}
		fdjtLog("Using preloaded glosses");
		notloading=true;}
	    /*
	    else if (getLocal("sync("+Codex.refuri+")")) {
		var msg=fdjtID("CODEXNEWGLOSSES");
		if (msg) {
		    msg.innerHTML="Using cached offline glosses";
		    addClass(msg,"running");}} */
	    else if (window.navigator.onLine) {
		var msg=fdjtID("CODEXNEWGLOSSES");
		if (msg) {
		    msg.innerHTML=fdjtString(
			"Getting glosses from %s",Codex.server);
		    addClass(msg,"running");}
		fdjtLog("Getting new glosses from %s",Codex.server);
		// Get any glosses
		var script=fdjtDOM("SCRIPT#LOADSBOOKINFO");
		script.language="javascript";
		var uri="https://"+Codex.server+"/v1/loadinfo.js?"+
		    "REFURI="+encodeURIComponent(Codex.refuri)+"&"+
		    "CALLBACK=Codex.loadInfo";
		if (Codex.sync) uri=uri+"&SYNC="+Codex.sync;
		if (Codex.user) uri=uri+"&SYNCUSER="+
		    encodeURIComponent(Codex.user._id)
		script.src=uri;
		document.body.appendChild(script);}
	    else notloading=true;
	    fdjtTime.timeslice
	    ([// Setup sbook tables, databases, etc
		appSplash,
		// Scan the DOM for metadata.  This is surprisingly fast,
		//  so we don't currently try to timeslice it, though we could
		function(){
		    var scanmsg=fdjtID("CODEXSTARTUPSCAN");
		    addClass(scanmsg,"running");
		    metadata=new CodexDOMScan(Codex.root);
		    fdjtDOM.addClass(metadata._heads,"avoidbreakafter");
		    Codex.docinfo=Codex.DocInfo.map=metadata;
		    Codex.ends_at=Codex.docinfo[Codex.root.id].ends_at;
		    dropClass(scanmsg,"running");
		    if (Codex.afterscan) {
			var donefn=Codex.afterscan;
			delete Codex.afterscan;
			donefn();}},
		// Now you're ready to lay out the book, which is
		//  timesliced and runs on its own.  We wait to do
		//  this until we've scanned the DOM because we may
		//  use results of DOM scanning in layout (for example,
		//  heading information).
		function(){if (Codex.paginate) Codex.Paginate("initial");},
		// Build the display TOC, both the dynamic (top of
		// display) and the static (inside the flyleaf)
		function(){
		    var tocmsg=fdjtID("CODEXSTARTUPTOC");
		    if (tocmsg) {
			tocmsg.innerHTML=fdjtString(
			    "Building table of contents based on %d heads",
			    Codex.docinfo._headcount);
			addClass(tocmsg,"running");}
		    startupLog("Building table of contents based on %d heads",
			       Codex.docinfo._headcount);
		    Codex.setupTOC(metadata[Codex.root.id]);
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
		// Process any preloaded user/gloss information
		((_sbook_loadinfo)&&(function(){loadInfo(_sbook_loadinfo);})),
		// Process locally stored glosses if not loading
		((notloading)&&(getLocal("sync("+Codex.refuri+")"))&&
		 initGlossesOffline),
		// Index tags for search
		function(){
		    var tagsmsg=fdjtID("CODEXSTARTUPTAGGING");
		    addClass(tagsmsg,"running");
		    startupLog("Indexing tags for search");
		    applyTagSpans();
		    startupLog("Indexing tag attributes from the source");
		    indexContentTags(metadata);
		    startupLog("Indexing inline (Technorati-style) tags");
		    indexAnchorTags(Codex.knodule);
		    // This table is generally loaded as part of the book 
		    if (_sbook_autoindex) {
			startupLog("Indexing automatic tags");
			Codex.useIndexData(_sbook_autoindex,Codex.knodule);
			_sbook_autoindex=false;}
		    dropClass(tagsmsg,"running");},
		function(){
		    var cloudmsg=fdjtID("CODEXSTARTUPCLOUDS");
		    addClass(cloudmsg,"running");
		    startupLog("Setting up tag clouds");
		    initClouds();
		    dropClass(cloudmsg,"running");},
		// Figure out which mode to start up in, based on
		// query args to the book.
		function(){
		    if ((fdjtState.getQuery("join"))||
			(fdjtState.getQuery("action"))||
			(fdjtState.getQuery("invitation"))) {
			CodexMode("sbookapp");}
		    else if (fdjtState.getQuery("startmode")) 
			CodexMode(fdjtState.getQuery("startmode"));
		    if ((!(Codex.paginate))||(Codex.paginated))
			startupDone();
		    else Codex.pagewait=startupDone;}],
	     100,25);}
	Codex.Startup=Startup;
	
	function appSplash(){
	    // Take any message passed along as a query string
	    //  and put it in the top of the help window, then
	    //  display the help window
	    if (fdjtState.getQuery("congratulations"))
		fdjtDOM(fdjtID("CODEXINTRO"),
			fdjtDOM("strong","Congratulations, "),
			fdjtState.getQuery("congratulations"));
	    else if (fdjtState.getQuery("sorry"))
		fdjtDOM(fdjtID("CODEXINTRO"),
			fdjtDOM("strong","Sorry, "),
			fdjtState.getQuery("sorry"));
	    else if (fdjtState.getQuery("weird")) 
		fdjtDOM(fdjtID("CODEXINTRO"),
			fdjtDOM("strong","Weird, "),
			fdjtState.getQuery("weird"));
	    if (fdjtState.getQuery("ACTION"))
		CodexMode("sbookapp");
	    else CodexMode("help");
	    // Hide the splash page, if any
	    if (fdjtID("CODEXSPLASH"))
		fdjtID("CODEXSPLASH").style.display='none';
	    window.focus();}
     
	function startupDone(){
	    initLocation();
	    if (fdjtID("CODEXREADYSPLASH"))
		fdjtID("CODEXREADYSPLASH").style.display='none';
	    Codex.displaySync();
	    setInterval(Codex.serverSync,60000);
	    fdjtDOM.dropClass(document.body,"codexstartup");
	    if ((Codex.mode==='help')&&(Codex.hidesplash)) {
		CodexMode(false);}
	    _sbook_setup=Codex._setup=new Date();}

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
	    var value=fdjtState.getQuery("offline")||
		getLocal("offline("+refuri+")")||
		getLocal("mycopyid("+refuri+")")||
		getLocal("sbooks.offline")||
		((fdjtDOM.getMeta("sbook.mycopyid")))||
		((fdjtDOM.getMeta("sbooks.mycopyid")))||
		((fdjtDOM.getMeta("MYCOPYID")))||
		(fdjtDOM.getMeta("sbook.offline"));
	    if ((!(value))||(value==="no")||(value==="off")||(value==="never"))
		return false;
	    else if ((value==="ask")&&(window.confirm))
		return window.confirm("Read offline?");
	    else return true;}
	
	var glossref_classes=false;

	function readSettings(){
	    if (typeof _sbook_loadinfo === "undefined") _sbook_loadinfo=false;
	    if (typeof _sbook_glosses === "undefined") _sbook_glosses=false;
	    // Basic stuff
	    var useragent=navigator.userAgent;
	    var refuri=_getsbookrefuri();
	    document.body.refuri=Codex.refuri=refuri;
	    Codex.docuri=_getsbookdocuri();
	    Codex.devinfo=fdjtState.versionInfo();
	    
	    var refuris=getLocal("sbooks.refuris",true)||[];
	    var offline=workOffline(refuri);
	    Codex.offline=((offline)?(true):(false));
	    
	    // Get the settings for scanning the document structure
	    getScanSettings();

	    // Where to get your images from, especially to keep referenes
	    //  inside https
	    if ((Codex.graphics==="http://static.beingmeta.com/graphics/")&&
		(window.location.protocol==='https:'))
		Codex.graphics=https_graphics;
	    
	    // Whether to suppress login, etc
	    if ((getLocal("sbooks.nologin"))||(fdjtState.getQuery("nologin")))
		Codex.nologin=true;
	    if ((getLocal("sbooks.nopage"))||(fdjtState.getQuery("nopage"))) {
		default_config.pageview=false;
		Codex.paginate=false;}
	    Codex.max_excerpt=fdjtDOM.getMeta("sbook.maxexcerpt")||
		(Codex.max_excerpt);
	    Codex.min_excerpt=fdjtDOM.getMeta("sbook.minexcerpt")||
		(Codex.min_excerpt);
	    var sbooksrv=fdjtDOM.getMeta("sbook.server")||
		fdjtDOM.getMeta("SBOOKSERVER");
	    if (sbooksrv) Codex.server=sbooksrv;
	    else if (fdjtState.getCookie["SBOOKSERVER"])
		Codex.server=fdjtState.getCookie["SBOOKSERVER"];
	    else Codex.server=lookupServer(document.domain);
	    if (!(Codex.server)) Codex.server=Codex.default_server;
	    sbook_ajax_uri=fdjtDOM.getMeta("sbook.ajax",true);

	    refuris.push(refuri);

	    if ((!(Codex.nologin))&&(Codex.offline)) {
		Codex.mycopyid=fdjtDOM.getMeta("sbook.mycopyid")||
		    ((offline)&&(getLocal("mycopy("+refuri+")")))||
		    false;
		setLocal("sbooks.refuris",refuris,true);}	    

	    var isIphone = (/iphone/gi).test(navigator.appVersion);
	    var isTouchPad = (/Touchpad/gi).test(navigator.appVersion);
	    var isIpad = (/ipad/gi).test(navigator.appVersion);
	    var isAndroid = (/android/gi).test(navigator.appVersion);
	    var isWebKit = navigator.appVersion.search("WebKit")>=0;
	    var isWebTouch = isIphone || isIpad || isAndroid || isTouchPad;

	    if ((typeof Codex.colbreak === 'undefined')&&
		((Codex.devinfo.Chrome)||
		 ((Codex.devinfo.AppleWebKit)&&
		  (Codex.devinfo.Mobile)&&
		  (Codex.devinfo.AppleWebKit>532))||
		 ((Codex.devinfo.AppleWebKit)&&
		  (Codex.devinfo.AppleWebKit>533)))) {
		Codex.colbreak=true;
		Codex.talldom=true;}
	    if (isWebTouch) {
		fdjtDOM.addClass(document.body,"sbooktouchui");
		viewportSetup();
		Codex.ui="webtouch"; Codex.touch=true;}
	    if ((useragent.search("Safari/")>0)&&
		(useragent.search("Mobile/")>0)) { 
		hide_mobile_safari_address_bar();
		Codex.nativescroll=false;
		Codex.scrolldivs=false;
		Codex.updatehash=false;
		// Have fdjtLog do it's own format conversion for the log
		fdjtLog.doformat=true;}
	    else if (sbook_faketouch) {
		fdjtDOM.addClass(document.body,"sbooktouchui");
		viewportSetup();
		Codex.ui="faketouch"}
	    else {
		fdjtDOM.addClass(document.body,"sbookmouseui");
		// fdjtDOM.addClass(document.body,"sbooktouchui");
		// fdjtDOM.addClass(document.body,"codexscalebody");
		Codex.ui="mouse";}
	    
	    Codex.allglosses=[];
	    Codex.allsources=[];
	    Codex.etc=[];}

	function initUserOffline(){
	    var refuri=Codex.refuri;
	    var sync=getLocal("sync("+refuri+")",true);
	    if (!(sync)) return;
	    var user=getLocal("user("+refuri+")");
	    var nodeid=getLocal("nodeid("+refuri+")");
	    if (!(user)) return;
	    var userinfo=getLocal(user,true);
	    var outlets=Codex.outlets=getLocal("outlets("+refuri+")",true)||[];
	    Codex.allsources=getLocal("sources("+refuri+")",true)||[];
	    Codex.sourcekb.Import(Codex.allsources);
	    if (userinfo) setUser(userinfo,outlets,sync);
	    if (nodeid) setNodeID(nodeid);
	    Codex.sync=sync;}

	function initGlossesOffline(){
	    var refuri=Codex.refuri;
	    var sync=getLocal("sync("+refuri+")",true);
	    if (!(sync)) return;
	    var localglosses=getLocal("glosses("+refuri+")",true)||[];
	    var queuedglosses=getLocal("queued("+refuri+")",true)||[];
	    var allglosses=Codex.allglosses||[];
	    localglosses=localglosses.concat(queuedglosses);
	    Codex.localglosses=localglosses;
	    Codex.allglosses=allglosses.concat(localglosses);
	    Codex.etc=getLocal("etc("+refuri+")",true)||[];
	    var i=0; var lim=localglosses.length;
	    var glossdb=Codex.glosses;
	    while (i<lim) {
		var glossid=localglosses[i++];
		var gloss=glossdb.ref(glossid);
		gloss.load();
		if (Codex.Trace.offline>1)
		    fdjtLog("Restored %o: %j",glossid,gloss);}
	    var etc=Codex.etc;
	    var i=0; var lim=etc.length;
	    while (i<lim) Codex.sourcekb.ref(etc[i++]);}

	/* Viewport setup */

	var viewport_spec="width=device-width,initial-scale=1.0";
	function viewportSetup(){
	    var head=fdjtDOM.getHEAD();
	    var viewport=fdjtDOM.getMeta("viewport",false,false,true);
	    if (!(viewport)) {
		viewport=document.createElement("META");
		viewport.setAttribute("name","viewport");
		head.appendChild(viewport);}
	    viewport.setAttribute("content",viewport_spec);
	    var isapp=fdjtDOM.getMeta
	    ("apple-mobile-web-app-capable",false,false,true);
	    if (!(isapp)) {
		isapp=document.createElement("META");
		isapp.setAttribute("name","apple-mobile-web-app-capable");
		head.appendChild(isapp);}}

	function hide_mobile_safari_address_bar(){
	    window.scrollTo(0,1);
	    setTimeout(function(){window.scrollTo(0,0);},0);}

	/* Getting settings */

	function _getsbookrefuri(){
	    var refuri=fdjtDOM.getLink("sbook.refuri",false,false)||
		fdjtDOM.getLink("refuri",false,false)||
		fdjtDOM.getMeta("sbook.refuri",false,false)||
		fdjtDOM.getMeta("refuri",false,false)||
		fdjtDOM.getLink("canonical",false,true);
	    if (refuri) return decodeURI(refuri);
	    else {
		var locref=document.location.href;
		var qstart=locref.indexOf('?');
		if (qstart>=0) locref=locref.slice(0,qstart);
		var hstart=locref.indexOf('#');
		if (hstart>=0) locref=locref.slice(0,hstart);
		return decodeURI(locref);}}
	function _getsbookdocuri(){
	    return fdjtDOM.getLink("sbook.docuri",false)||
		fdjtDOM.getLink("docuri",false)||
		fdjtDOM.getMeta("sbook.docuri",false)||
		fdjtDOM.getMeta("docuri",false)||
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
		if (fdjtDOM.getMeta("sbook.root"))
		    Codex.root=fdjtID(fdjtDOM.getMeta("sbook.root"));
	    else Codex.root=fdjtID("SBOOKCONTENT")||document.body;
	    if (!(Codex.start))
		if (fdjtDOM.getMeta("sbook.start"))
		    Codex.start=fdjtID(fdjtDOM.getMeta("sbook.start"));
	    else if (fdjtID("SBOOKSTART"))
		Codex.start=fdjtID("SBOOKSTART");
	    else {
		var titlepage=fdjtID("SBOOKTITLE")||fdjtID("TITLEPAGE");
		while (titlepage)
		    if (fdjtDOM.nextElt(titlepage)) {
			Codex.start=fdjtDOM.nextElt(titlepage); break;}
		else titlepage=titlepage.parentNode;}
	    var i=0; while (i<9) {
		var rules=fdjtDOM.getMeta("sbook.head"+i,true).
		    concat(fdjtDOM.getMeta("sbook"+i+"head",true)).
		    concat(fdjtDOM.getMeta("sbook"+headlevels[i]+"head",true));
		if ((rules)&&(rules.length)) {
		    var j=0; var lim=rules.length;
		    var elements=fdjtDOM.getChildren(document.body,rules[j++]);
		    var k=0; var n=elements.length;
		    while (k<n) {
			var elt=elements[k++];
			if (!(hasTOCLevel(elt))) elt.toclevel=i;}}
		i++;}
	    if (fdjtDOM.getMeta("sbookignore")) 
		Codex.ignore=new fdjtDOM.Selector(fdjtDOM.getMeta("sbookignore"));
	    if (fdjtDOM.getMeta("sbooknotoc")) 
		Codex.notoc=new fdjtDOM.Selector(fdjtDOM.getMeta("sbooknotoc"));
	    if (fdjtDOM.getMeta("sbookterminal"))
		Codex.terminal_rules=
		new fdjtDOM.Selector(fdjtDOM.getMeta("sbookterminal"));
	    if (fdjtDOM.getMeta("sbookid")) 
		sbook_idify=new fdjtDOM.Selector(fdjtDOM.getMeta("sbookid"));
	    if ((fdjtDOM.getMeta("sbookfocus"))) 
		Codex.focus=new fdjtDOM.Selector(fdjtDOM.getMeta("sbookfocus"));
	    if (fdjtDOM.getMeta("sbooknofocus"))
		Codex.nofocus=new fdjtDOM.Selector(fdjtDOM.getMeta("sbooknofocus"));}

	function applyMetaClass(name){
	    var meta=fdjtDOM.getMeta(name,true);
	    var i=0; var lim=meta.length;
	    while (i<lim) fdjtDOM.addClass(fdjtDOM.$(meta[i++]),name);}

	var note_count=1;
	function initBody(){
	    var body=document.body;
	    var content=fdjtDOM("div#CODEXCONTENT");
	    var nodes=fdjtDOM.toArray(body.childNodes);
	    var style=fdjtDOM("STYLE");
	    fdjtDOM(document.head,style);
	    Codex.stylesheet=style.sheet;
	    var i=0; var lim=nodes.length;
	    // Move all of the body nodes into the content element
	    while (i<lim) {
		var node=nodes[i++];
		if (node.nodeType===1) {
		    if ((node.tagName!=='LINK')&&(node.tagName!=='META')&&
			(node.tagName!=='SCRIPT'))
			content.appendChild(node);}
		else content.appendChild(node);}
	    Codex.content=content;
	    Codex.coverpage=fdjtID("SBOOKCOVERPAGE");
	    Codex.titlepage=fdjtID("SBOOKTITLEPAGE");
	    fdjtDOM.addClass(document.body,"codexscalebody");
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
	    fdjtDOM(body,content,page);
	    fdjtDOM.addClass(body,"sbook");
	    var page_width=fdjtDOM.getGeometry(page).width;
	    var view_width=fdjtDOM.viewWidth();
	    var page_margin=(view_width-page_width)/2;
	    if (page_margin>=50) {
		page.style.left=page_margin+'px';
		page.style.right=page_margin+'px';}
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
				fdjtDOM("span#CODEXPAGENOTEXT","p/n")));
	    var pagefoot=fdjtDOM("div.codexmargin#CODEXPAGEFOOT",pageinfo," ");
	    pagehead.codexui=true; pagefoot.codexui=true;
	    sbookPageHead=pagehead; sbookPageFoot=pagefoot;

	    fdjtDOM.prepend(document.body,pagehead,pagefoot,pageleft,pageright);

	    for (var pagelt in [pagehead,pageright,pageleft,pagefoot,pageinfo]) {
		fdjtDOM.addListeners(
		    pageinfo,Codex.UI.handlers[Codex.ui]["#"+pagelt.id]);}
		
	    fdjtUI.TapHold(pagefoot);

	    window.scrollTo(0,0);
	    
	    // The better way to do this might be to change the stylesheet,
	    //  but fdjtDOM doesn't currently handle that 
	    var bgcolor=getBGColor(document.body)||"white";
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
	    fdjtDOM.addListener(false,"resize",function(evt){
		if (Codex.paginate) CodexLayout.onresize(evt||event);});}
	
	function getBGColor(arg){
	    var color=fdjtDOM.getStyle(arg).backgroundColor;
	    if (!(color)) return false;
	    else if (color==="transparent") return false;
	    else if (color.search(/rgba/)>=0) return false;
	    else return color;}

	/* Loading meta info (user, glosses, etc) */

	function loadInfo(info) {
	    if (!(Codex.docinfo)) /* Scan not done */
		Codex.scandone=function(){loadInfo(info);};
	    else if (info.loaded) return;
	    var refuri=Codex.refuri;
	    if ((Codex.offline)&&
		(info)&&(info.userinfo)&&(Codex.user)&&
		(info.userinfo._id!==Codex.user._id)) {
		clearOffline(refuri);}
	    var persist=((Codex.offline)&&(navigator.onLine));
	    info.loaded=fdjtTime();
	    if (info.userinfo)
		setUser(info.userinfo,info.outlets,info.sync);
	    if (info.nodeid) setNodeID(info.nodeid);
	    if ((!(Codex.localglosses))&&
		((getLocal("sync("+refuri+")"))||
		 (getLocal("queued("+refuri+")"))))
		initGlossesOffline();
	    if (info.sources) gotInfo("sources",info.sources,persist);
	    if (info.glosses) initGlosses(info.glosses,info.etc);
	    if (info.sync) setLocal("sync("+refuri+")",info.sync);}
	Codex.loadInfo=loadInfo;

	function getUser() {
	    var refuri=Codex.refuri;
	    var loadinfo=_sbook_loadinfo||false;
	    if (Codex.Trace.startup>1)
		fdjtLog("Getting user for %o cur=%o",refuri,Codex.user);
	    if (Codex.user) return Codex.user;
	    else if (Codex.nologin) return false;
	    if ((loadinfo)&&(gotUser(loadinfo)))
		return Codex.user;
	    else if ((typeof _sbook_userinfo !== 'undefined')&&
		     gotUser(_sbook_userinfo))
		return Codex.user;
	    if (getLocal("sbooks.user")) {
		var user=getLocal("sbooks.user");
		if (Codex.Trace.startup)
		    fdjtLog("Restoring offline user info for %o reading %o",
			    user,refuri);
		var userinfo=JSON.parse(getLocal(user));
		var sources=getLocal("sources("+refuri+")",true);
		var outlets=getLocal("outlets("+refuri+")",true);
		var nodeid=getLocal("nodeid("+refuri+")");
		var sync=getLocal("sbooks.usersync",true);
		gotUser(userinfo,nodeid,sources,outlets,etcinfo,sync);
		return;}
	    else if (!(fdjtID("SBOOKGETUSERINFO"))) {
		var user_script=fdjtDOM("SCRIPT#SBOOKGETUSERINFO");
		user_script.language="javascript";
		user_script.src=
		    "https://"+Codex.server+"/v1/loadinfo.js?REFURI="+
		    encodeURIComponent(codex.refuri)+"&CALLBACK=Codex.gotInfo";
		document.body.appendChild(user_script);
		fdjtDOM.addClass(document.body,"notsbookuser");}
	    else fdjtDOM.addClass(document.body,"notsbookuser");}
	
	function setUser(userinfo,outlets,sync){
	    var persist=((Codex.offline)&&(navigator.onLine));
	    var refuri=Codex.refuri;
	    if (userinfo) {
		fdjtDOM.dropClass(document.body,"notsbookuser");
		fdjtDOM.addClass(document.body,"sbookuser");}
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
	    if (persist) {
		setLocal(Codex.user._id,Codex.user,true);
		setLocal("sbooks.user",Codex.user._id);
		setLocal("user("+refuri+")",Codex.user._id);}
	    gotInfo("outlets",outlets,persist);
	    if ((outlets)&&(outlets.length)) {
		Codex.outlets=outlets;
		var ss=Codex.stylesheet;
		ss.insertRule("span.showoutlets { display: inline;}",
			      ss.cssRules.length);
		// Add the outlets
		var div=fdjtID("CODEXGLOSSOUTLETS");
		var i=0; var ilim=outlets.length;
		while (i<ilim) {
		    var outlet=outlets[i];
		    var span=
			fdjtDOM("span.outlet",outlet.nick||outlet.name);
		    span.value=outlet._id;
		    if ((outlet.description)&&(outlet.nick))
			span.title=outlet.name+": "+outlet.description;
		    else if (outlet.description)
			span.title=outlet.description;
		    else if (outlet.nick) span.title=outlet.name;
		    fdjtDOM(div,((i>0)&&(" \u2014 ")),span);
		    i++;}}
	    setupUI4User();
	    return Codex.user;}
	Codex.setUser=setUser;
	
	function setNodeID(nodeid){
	    var refuri=Codex.refuri;
	    if (!(Codex.nodeid)) {
		Codex.nodeid=nodeid;
		if ((nodeid)&&(Codex.offline))
		    setLocal("nodeid("+refuri+")",nodeid);}}
	Codex.setNodeID=setNodeID;

	function setupUI4User(){
	    if (Codex._user_setup) return;
	    if (!(Codex.user)) {
		fdjtDOM.addClass(document.body,"notsbookuser");
		return;}
	    fdjtDOM.dropClass(document.body,"notsbookuser");
	    var username=Codex.user.name;
	    if (fdjtID("SBOOKUSERNAME"))
		fdjtID("SBOOKUSERNAME").innerHTML=username;
	    var names=document.getElementsByName("CODEXUSERNAME");
	    if (names) {
		var i=0, lim=names.length;
		while (i<lim) names[i++].innerHTML=username;}
	    if (fdjtID("SBOOKMARKUSER"))
		fdjtID("SBOOKMARKUSER").value=Codex.user._id;

	    /* Initialize add gloss prototype */
	    var ss=Codex.stylesheet;
	    var form=fdjtID("CODEXADDGLOSSPROTOTYPE");
	    var getChild=fdjtDOM.getChild;
	    if (Codex.user.fbid)  {
		ss.insertRule("span.facebook_share { display: inline;}",
			      ss.cssRules.length);
		var cs=getChild(form,".checkspan.facebook_share");
		fdjtUI.CheckSpan.set(cs,true);
		var cb=getChild(cs,"input");
		cb.setAttribute("checked","checked");}
	    if (Codex.user.twitterid) {
		ss.insertRule("span.twitter_share { display: inline;}",
			     ss.cssRules.length);
		var cs=getChild(form,".checkspan.twitter_share");
		fdjtUI.CheckSpan.set(cs,true);
		var cb=getChild(cs,"input");
		cb.setAttribute("checked","checked");}
	    if (Codex.user.linkedinid) {
		ss.insertRule("span.linkedin_share { display: inline;}",
			     ss.cssRules.length);
		var cs=getChild(form,".checkspan.linkedin_share");
		fdjtUI.CheckSpan.set(cs,true);
		var cb=getChild(cs,"input");
		cb.setAttribute("checked","checked");}
	    if (Codex.user.googleid) {
		ss.insertRule("span.google_share { display: inline;}",
			     ss.cssRules.length);
		var cs=getChild(form,".checkspan.google_share");
		fdjtUI.CheckSpan.set(cs,true);
		var cb=getChild(cs,"input");
		cb.setAttribute("checked","checked");}
	    var pic=
		(Codex.user.pic)||
		((Codex.user.fbid)&&
		 ("https://graph.facebook.com/"+Codex.user.fbid+
		  "/picture?type=square"));
	    if (pic) {
		if (fdjtID("SBOOKMARKIMAGE")) fdjtID("SBOOKMARKIMAGE").src=pic;
		if (fdjtID("SBOOKUSERPIC")) fdjtID("SBOOKUSERPIC").src=pic;
		var byname=document.getElementsByName("SBOOKUSERPIC");
		if (byname) {
		    var i=0; var lim=byname.length;
		    while (i<lim) byname[i++].src=pic;}}
	    if (fdjtID("SBOOKFRIENDLYOPTION"))
		if (Codex.user)
		    fdjtID("SBOOKFRIENDLYOPTION").value=Codex.user._id;
	    else fdjtID("SBOOKFRIENDLYOPTION").value="";
	    var idlinks=document.getElementsByName("IDLINK");
	    if (idlinks) {
		var i=0; var len=idlinks.length;
		while (i<len) {
		    var idlink=idlinks[i++];
		    idlink.target='_blank';
		    idlink.title='click to edit your personal information';
		    idlink.href='https://auth.sbooks.net/admin/identity';}}
	    if (Codex.user.friends) {
		var friends=Codex.user.friends;
		var i=0; var lim=friends.length;
		while (i<lim) {
		    var friend=fdjtKB.ref(friends[i++]);
		    Codex.addTag2UI(friend);}}
	    Codex._user_setup=true;}
	
	// Processes info loaded remotely
	function gotInfo(name,info,persist) {
	    var refuri=Codex.refuri;
	    if (info)
		if (info instanceof Array) {
		    var i=0; var lim=info.length; var qids=[];
		    while (i<lim) {
			if (typeof info[i] === 'string') {
			    var qid=info[i++];
			    if (Codex.offline) fdjtKB.load(qid);
			    qids.push(qid);}
			else {
			    var obj=fdjtKB.Import(info[i++]);
			    if (persist) 
				setLocal(obj._id,obj,true);
			    qids.push(obj._id);}}
		    sbook[name]=qids;
		    if (Codex.offline)
			setLocal(
			    "sbooks."+name+"("+refuri+")",qids,true);}
	    else {
		var obj=fdjtKB.Import(info);
		if (persist) 
		    setLocal(obj._id,obj,true);
		sbook[name]=obj._id;
		if (persist)
		    setLocal("sbooks."+name+"("+refuri+")",qid,true);}}

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
	    if (Codex.offline) 
		setLocal("glosses("+Codex.refuri+")",allglosses,true);}

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
	    if (Codex.offline) 
		setLocal("glosses("+Codex.refuri+")",allglosses,true);
	    dropClass(msg,"running");}
	Codex.Startup.initGlosses=initGlosses;
	
	function go_online(evt){return offline_update();}
	function offline_update(){
	    Codex.writeGlosses();
	    var uri="https://"+Codex.server+
		"/v1/loadinfo.js?REFURI="+encodeURIComponent(Codex.refuri);
	    if (Codex.sync) uri=uri+"&SYNC="+(Codex.sync+1);
	    fdjtAjax.jsonCall(Codex.loadInfo,uri);}
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
	    var statestring=getLocal("sbooks.state("+uri+")");
	    if (statestring) Codex.state=state=JSON.parse(statestring);}
	
	/* This initializes the sbook state to the initial location with the
	   document, using the hash value if there is one. */ 
	function initLocation() {
	    var state=false;
	    if (!(state)) {
		var uri=Codex.docuri||Codex.refuri;
		var statestring=getLocal("sbooks.state("+uri+")");
		if (statestring) Codex.state=state=JSON.parse(statestring);
		else state={};}
	    var hash=window.location.hash; var target=false;
	    if ((typeof hash === "string") && (hash.length>0)) {
		if ((hash[0]==='#') && (hash.length>1))
		    target=document.getElementById(hash.slice(1));
		else target=document.getElementById(hash);
		if (Codex.Trace.startup>1)
		    fdjtLog("sbookInitLocation hash=%s=%o",hash,target);}
	    if (target) Codex.GoTo(target,false,true);
	    else if ((state)&&(state.target)&&(fdjtID(state.target)))
		Codex.GoTo(state.target,false,true);
	    else Codex.GoTo((Codex.start||Codex.coverpage||
			     Codex.titlepage||Codex.root),false,true);
	    if ((Codex.user)&&(Codex.dosync)&&(navigator.onLine))
		syncLocation();}
	
	function syncLocation() {
	    if (!(Codex.user)) return;
	    var uri="https://"+Codex.server+"/v1/sync"+
		"?DOCURI="+encodeURIComponent(Codex.docuri)+
		"&REFURI="+encodeURIComponent(Codex.refuri);
	    if (Codex.Trace.dosync)
		fdjtLog("syncLocation(call) %s",uri);
	    fdjtAjax.jsonCall(
		function(d){
		    if (Codex.Trace.dosync)
			fdjtLog("syncLocation(callback) %s: %j",uri,d);
		    if ((!(d))||(!(d.location))) {
			if (!(Codex.state))
			    Codex.GoTo(Codex.start||Codex.root||Codex.body,
				       false,false);
			return;}
		    else if ((!(Codex.state))||(Codex.state.tstamp<d.tstamp)) {
			if ((d.location)&&(d.location<=Codex.location)) return;
			if (d.page===Codex.curpage) return;
			var msg=
			    "Sync to L"+d.location+
			    ((d.page)?(" (page "+d.page+")"):"")+"?";
			if (confirm(msg)) {
			    if (d.location) Codex.setLocation(d.location);
			    if (d.target) Codex.setTarget(d.target,true,true);
			    if (d.location) Codex.GoTo(d.location,true,true);
			    Codex.state=d;}}
		    else {}},
		uri);}

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
	
	/* Indexing tags */

	function indexContentTags(docinfo){
	    var sbook_index=Codex.index;
	    knodule=(knodule)||(knodule=Codex.knodule);
	    /* One pass processes all of the inline KNodes and
	       also separates out primary and auto tags. */
	    for (var eltid in docinfo) {
		var tags=docinfo[eltid].tags;
		if (!(tags)) continue;
		var k=0; var ntags=tags.length; var scores=tags.scores||false;
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
			if ((knode)&&(knode.tagString)) tag=knode.tagString();}
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
	    var knodule=Codex.knodule||false;
	    for (var eltid in docinfo) {
		var info=docinfo[eltid];
		var tags=info.tags; 
		if (tags) {
		    var scores=tags.scores;
		    var k=0; var ntags=tags.length;
		    while (k<ntags) {
			var tag=tags[k++];
			if (scores)
			    sbook_index.add(eltid,tag,scores[tag]||1,knodule);
			else sbook_index.add(eltid,tag,1,knodule);}}
		var sectags=info.sectags||((info.head)&&(info.head.sectags));
		if (sectags) {
		    var k=0, ntags=sectags.length;
		    while (k<ntags) {
			var tag=sectags[k++];
			sbook_index.add(eltid,tag,0,knodule);}}}}
	Codex.indexContentTags=indexContentTags
	
	/* Inline tags */
	function indexAnchorTags(kno) {
	    var sbook_index=Codex.index;
	    if (!(kno)) kno=knodule;
	    var anchors=document.getElementsByTagName("A");
	    if (!(anchors)) return;
	    var i=0; var len=anchors.length;
	    while (i<len)
		if (anchors[i].rel==='tag') {
		    var elt=anchors[i++];
		    var href=elt.href;
		    var cxt=elt;
		    while (cxt) if (cxt.id) break; else cxt=cxt.parentNode;
		    if (!((href)&&(cxt))) return;
		    var tagstart=(href.search(/[^/]+$/));
	    var tag=((tagstart<0)?(href):href.slice(tagstart));
	    var dterm=((kno)?(kno.handleEntry(tag)):(fdjtString.stdspace(tag)));
	    sbook_index.add(cxt,dterm);}
	else i++;}
     Codex.indexAnchorTags=indexAnchorTags;

     /* Using the autoindex which may be generated by book building */

     function useIndexData(autoindex,knodule,baseweight){
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
	     var weak=(tag[0]==='~');
	     var knode=((tag.indexOf('|')>=0)?
			(knodule.handleSubjectEntry(tag)):
			(tag[0]==='~')?(tag.slice(1)):
			(knodule.handleSubjectEntry(tag)));
	     if ((weak)&&(typeof knode !== 'string')) knode.weak=true;
	     var i=0; var lim=ids.length;
	     while (i<lim) {
		 var idinfo=ids[i++];
		 var itemid=((typeof idinfo === 'string')?(idinfo):(idinfo[0]));
		 var info=Codex.docinfo[itemid];
		 if (!(info)) continue;
		 var tagval=((typeof knode === 'string')?(knode):(knode.dterm));
		 if (info.autotags) info.autotags.push(tagval);
		 else info.autotags=[tagval];
		 if (typeof knode !== 'string') {
		     if (info.knodes) info.knodes.push(knode);
		     else info.knodes=[knode];}
		 if (typeof idinfo === 'string') {}
		 else if ((idinfo.length===2)&&
			  ((!(info.knodeterms))||
			   (!(info.knodeterms[tagval])))) {
		     var knodeterms=info.knodeterms;
		     if (!(knodeterms))
			 knodeterms=info.knodeterms={};
		     knodeterms[tagval]=idinfo[1];}
		 else {
		     var knodeterms=info.knodeterms;
		     if (!(info.knodeterms)) knodeterms=info.knodeterms={};
		     var terms=knodeterms[tagval];
		     if (!(terms)) terms=knodeterms[tagval]=[];
		     if (typeof terms === 'string')
			 terms=knodeterms[tagval]=[terms];
		     var j=1; var jlim=idinfo.length;
		     while (j<jlim) {terms.push(idinfo[j++]);}}
		 sbook_index.add(
		     info.frag,knode,starpower||baseweight||0,
		     knodule);}}}
     Codex.useIndexData=useIndexData;

     /* Setting up the clouds */

     function initClouds(){
	 startupMessage("setting up search cloud...");
	 fdjtDOM.replace("CODEXSEARCHCLOUD",Codex.fullCloud().dom);
	 startupMessage("setting up glossing cloud...");
	 fdjtDOM.replace("CODEXGLOSSCLOUD",Codex.glossCloud().dom);
	 if (Codex.cloud_queue) {
	     fdjtLog("Starting to sync gloss cloud");
	     fdjtTime.slowmap(
		 Codex.addTag2UI,Codex.cloud_queue,false,
		 function(){
		     Codex.cloud_queue=false;
		     fdjtLog("Gloss cloud synced");});}
	 if (Codex.search_cloud_queue) {
	     fdjtLog("Starting to sync search cloud");
	     fdjtTime.slowmap(
		 Codex.addTag2UI,Codex.search_cloud_queue,false,
		 function(){
		     Codex.search_cloud_queue=false;
		     fdjtLog("Search cloud synced");});}
	 
	 if (Codex.knodule) {
	     fdjtLog("Beginning knodule integration");
	     fdjtTime.slowmap(Codex.addTag2UI,Codex.knodule.alldterms,false,
			      function(){fdjtLog("Knodule integrated");});}
	 Codex.sizeCloud(Codex.full_cloud);
	 Codex.sizeCloud(Codex.gloss_cloud);}
     
     /* Clearing offline data */

     function clearOffline(refuri){
	 var dropLocal=fdjtState.dropLocal;
	 if (refuri) {
	     var glosses=getLocal("glosses("+refuri+")",true);
	     var i=0; var lim=glosses.length;
	     while (i<lim) fdjtState.dropLocal(glosses[i++]);
	     dropLocal("sources("+refuri+")");
	     dropLocal("outlets("+refuri+")");
	     dropLocal("queued("+refuri+")");
	     dropLocal("sync("+refuri+")");
	     dropLocal("user("+refuri+")");
	     dropLocal("sync("+refuri+")");
	     dropLocal("etc("+refuri+")");
	     dropLocal("offline("+refuri+")");
	     var refuris=getLocal("sbooks.refuris",true);
	     refuris=fdjtKB.remove(refuris,refuri);
	     setLocal("sbooks.refuris",refuris,true);}
	 else {
	     var refuris=getLocal("sbooks.refuris",true);
	     var i=0; var lim=refuris.length;
	     while (i<lim) clearOffline(refuris[i++]);
	     dropLocal("sbooks.refuris");}}
     Codex.clearOffline=clearOffline;

     /* Other setup */
     
     function setupGlossServer(){}

     Codex.StartupHandler=function(evt){
	 Startup();};

     return Startup;})();
sbookStartup=Codex.StartupHandler;
Codex.Setup=Codex.StartupHandler;
sbook={Start: Codex.StartupHandler,setUser: Codex.setUser};

fdjt_versions.decl("codex",codex_startup_version);
fdjt_versions.decl("codex/startup",codex_startup_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
