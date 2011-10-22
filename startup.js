/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

var codex_startup_id="$Id$";
var codex_startup_version=parseInt("$Revision$".slice(10,-1));

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


	/* Initialization */
	
	var _sbook_setup_start=false;
	
	var TOA=fdjtDOM.Array;

	function startupLog(){
	    var args=TOA(arguments);
	    var div=fdjtDOM("div#CODEXSTARTUPMSG",fdjtString.apply(null,args));
	    fdjtLog.apply(null,arguments);
	    fdjtDOM.replace("CODEXSTARTUPMSG",div);}

	function startupMessage(){
	    var args=TOA(arguments);
	    var div=fdjtDOM("div#CODEXSTARTUPMSG",fdjtString.apply(null,args));
	    if ((Codex.Trace.startup)&&
		(typeof Codex.Trace.startup === "number")&&
		(Codex.Trace.startup>1))
		fdjtLog.apply(null,arguments);
	    fdjtDOM.replace("CODEXSTARTUPMSG",div);}
	Codex.startupMessage=startupMessage;

	function Startup(force){
	    if (Codex._setup) return;
	    if ((!force)&&(fdjtState.getQuery("nosbooks"))) return; 
	    fdjtLog.console="CODEXCONSOLELOG";
	    fdjtLog.consoletoo=true;
	    fdjtLog("This is Codex version %s, built at %s on %s",
		    Codex.version,sbooks_buildtime,sbooks_buildhost);
	    if (navigator.appVersion)
		fdjtLog("App version: %s",navigator.appVersion);
	    if (!(Codex._setup_start)) Codex._setup_start=new Date();
	    // Get various settings
	    readSettings();
	    // Execute fdjt initializations
	    fdjtDOM.init();
	    // Declare this
	    fdjtDOM.addClass(document.body,"codexstartup");
	    var metadata=false;
	    var helphud=false;
	    Codex.initDB();
	    fdjtTime.timeslice
	    ([// Setup sbook tables, databases, etc
		// This wraps the body in its own block and sets up
		//  the DOM structure for pagination
		initBody,
		// This initializes the book tools (the HUD, or Heads Up Display)
		Codex.initHUD,
		(function(){
		    // Take any message passed along as a query string
		    //  and put it in the top of the help window, then
		    //  display the help window
		    initConfig();
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
		    CodexMode("help");
		    // Setup the UI components
		    Codex.setupGestures();
		    if (fdjtID("CODEXSPLASH"))
			fdjtID("CODEXSPLASH").style.display='none';
		    window.focus();}),
		// Try to figure out if we already have a user
		// (from pre-loaded loadinfo.js or user.js or stored
		// in offline storage)
		// creating a script to load user.js if there isn't
		getUser,
		// Scan the DOM for metadata.  THis is surprisingly fast,
		//  so we don't currently try to timeslice it, though we could
		function(){
		    // This scans the DOM.  It would probably be a good
		    //  idea to do this asynchronously
		    metadata=new CodexDOMScan(Codex.root);
		    fdjtDOM.addClass(metadata._heads,"avoidbreakafter");
		    Codex.docinfo=Codex.DocInfo.map=metadata;
		    Codex.ends_at=Codex.docinfo[Codex.root.id].ends_at;},
		// Now you're ready to lay out the book, which is
		//  timesliced and runs on its own.  We wait to do
		//  this until we've scanned the DOM because we may
		//  use results of DOM scanning in layout.
		function(){if (Codex.paginate) Codex.Paginate("initial");},
		// Build the display TOC, both the dynamic (top of
		// display) and the static (inside the flyleaf)
		function(){
		    startupLog("Building table of contents based on %d heads",
			       Codex.docinfo._headcount);
		    Codex.setupTOC(metadata[Codex.root.id]);},
		// Read an knowledge bases (knodules) used by the book
		((Knodule)&&(Knodule.HTML)&&
		 (Knodule.HTML.Setup)&&(Codex.knodule)&&
		 (function(){
		     startupLog("Processing knodule %s",Codex.knodule.name);
		     Knodule.HTML.Setup(Codex.knodule);})),
		// Index tags for search
		function(){
		    startupLog("Indexing tags for search");
		    applyInlineTags();
		    startupLog("Indexing tag attributes from the source");
		    indexContentTags(metadata);
		    startupLog("Indexing inline (Technorati-style) tags");
		    indexInlineTags(Codex.knodule);
		    // This table is generally loaded as part of the book 
		    if (_sbook_autoindex) {
			startupLog("Indexing automatic tags");
			Codex.useAutoIndex(_sbook_autoindex,Codex.knodule);
			_sbook_autoindex=false;}},
		function(){
		    startupLog("Setting up tag clouds"); initClouds();},
		function(){
		    startupLog("Configuring gloss server"); setupGlossServer();},
		function(){
		    if (Codex.user) startupLog("Getting glosses");
		    if (Codex.user) setupGlosses();},
		function(){
		    if ((!(Codex.glossing))&&(!(Codex.glossed))) {
			if (Codex.user) setupGlosses();
			else gotGlosses();}},
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
		fdjtState.getLocal("codex.offline("+refuri+")")||
		fdjtState.getLocal("codex.mycopy("+refuri+")")||
		fdjtState.getLocal("codex.offline")||
		((fdjtDOM.getMeta("sbook.mycopyid")))||
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
	    
	    var refuris=fdjtState.getLocal("codex.refuris",true)||[];
	    var offline=workOffline(refuri);
	    Codex.offline=((offline)?(true):(false));
	    if (offline)
		fdjtState.setLocal("codex.offline("+refuri+")",offline);
	    
	    // Get the settings for scanning the document structure
	    getScanSettings();

	    // Where to get your images from, especially to keep referenes
	    //  inside https
	    if ((Codex.graphics==="http://static.beingmeta.com/graphics/")&&
		(window.location.protocol==='https:'))
		Codex.graphics=https_graphics;
	    
	    // Whether to suppress login, etc
	    if ((fdjtState.getLocal("codex.nologin"))||
		(fdjtState.getQuery("nologin")))
		Codex.nologin=true;
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
	    Codex.mycopyid=fdjtDOM.getMeta("sbook.mycopyid")||
		((offline)&&(fdjtState.getLocal("mycopy("+refuri+")")))||
		false;
	    Codex.syncstamp=fdjtState.getLocal("syncstamp("+refuri+")",true);
	    
	    if ((offline)&&
		(!(fdjtState.getLocal("codex.offline("+refuri+")")))) {
		fdjtState.setLocal("codex.offline("+refuri+")",true,true);
		refuris.push(refuri);
		fdjtState.setLocal("codex.refuris",refuris,true);}
	    
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
		fdjtDOM.addClass(document.body,"sbooktouch");
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
		fdjtDOM.addClass(document.body,"sbooktouch");
		viewportSetup();
		Codex.ui="faketouch"}
	    else {
		Codex.ui="mouse";}
	    
	    Codex.allglosses=
		((offline)?
		 ((fdjtState.getLocal("glosses("+refuri+")",true))||[]):
		 []);
	    Codex.allsources=
		((offline)?
		 ((fdjtState.getLocal("sources("+refuri+")",true))||{}):
		 {});
	    Codex.glossetc=
		((offline)?
		 ((fdjtState.getLocal("glossetc("+refuri+")",true))||{}):
		 {});}

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
	    fdjtState.setLocal('codex.config',JSON.stringify(saved));}
	Codex.saveConfig=saveConfig;

	function initConfig(){
	    var config=fdjtState.getLocal('codex.config',true);
	    Codex.postconfig=[];
	    if (Codex.Trace.config) fdjtLog("initConfig (saved) %o",config);
	    if (config) {
		for (var setting in config) {
		    if (config.hasOwnProperty(setting)) 
			setConfig(setting,config[setting]);}}
	    else config={};
	    if (Codex.Trace.config) fdjtLog("initConfig (default) %o",default_config);
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
	    while (i<lim) content.appendChild(nodes[i++]);
	    Codex.content=content;
	    Codex.coverpage=fdjtID("SBOOKCOVERPAGE");
	    Codex.titlepage=fdjtID("SBOOKTITLEPAGE");
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
		var asidehead=((head)?(fdjtDOM.clone(head)):
			       fdjtDIV("div.sbookasidestart",
				       (fdjtString.truncate(fdjtDOM.textify(aside),42))));
		var anchor=fdjtDOM("A.sbookasideref",asidehead);
		var count=aside_count++;
		if (!(aside.id)) aside.id="SBOOKASIDE"+count;
		anchor.href="#"+aside.id; anchor.id="SBOOKASIDEREF"+count;
		fdjtDOM.insertBefore(aside,anchor);
		aside.codextocloc=anchor.id;
		fdjtDOM.append(allasides,aside);}
	    var humane=fdjtDOM.$(".humane");
	    if (humane) {
		var i=0; var lim=humane.length;
		while (i<lim) humane[i++].codexui=true;}
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
	    fdjtDOM.addListener(false,"resize",CodexLayout.onresize);}
	
	function getBGColor(arg){
	    var color=fdjtDOM.getStyle(arg).backgroundColor;
	    if (!(color)) return false;
	    else if (color==="transparent") return false;
	    else if (color.search(/rgba/)>=0) return false;
	    else return color;}

	/* Getting the current user */

	function getUser() {
	    var refuri=Codex.refuri;
	    var loadinfo=_sbook_loadinfo||false;
	    if (Codex.Trace.startup>1)
		fdjtLog("Getting user for %o cur=%o",refuri,Codex.user);
	    if (Codex.user) return;
	    else if (Codex.nologin) return;
	    if ((loadinfo)&&
		(setUser(loadinfo.userinfo,loadinfo.nodeid,
			 loadinfo.sources,loadinfo.outlets,
			 loadinfo.etc,loadinfo.sync)))
		return;
	    else if ((typeof _sbook_userinfo !== 'undefined')&&(_sbook_userinfo))
		setUser(_sbook_userinfo.user,
			_sbook_userinfo.nodeid,
			_sbook_userinfo.sources,
			_sbook_userinfo.outlets,
			_sbook_userinfo.etc,
			_sbook_userinfo.sync);
	    if ((Codex.offline)&&
		(fdjtState.getLocal("codex.user"))&&
		(fdjtState.getLocal("codex.nodeid("+refuri+")"))) {
		var refuri=Codex.refuri;
		var user=fdjtState.getLocal("codex.user");
		if (Codex.Trace.startup)
		    fdjtLog("Restoring offline user info for %o reading %o",
			    user,refuri);
		var userinfo=JSON.parse(fdjtState.getLocal(user));
		var sources=fdjtState.getLocal("codex.sources("+refuri+")",true);
		var outlets=
		    fdjtState.getLocal("codex.outlets("+refuri+")",true);
		var etc=fdjtState.getLocal("codex.etc("+refuri+")",true);
		var nodeid=fdjtState.getLocal("codex.nodeid("+refuri+")");
		var sync=fdjtState.getLocal("codex.usersync",true);
		var etcinfo=[];
		if (etc) {
		    var i=0; var lim=etc.length;
		    while (i<lim) {
			var ref=etc[i++];
			fdjtKB.load(ref); etcinfo.push(ref);}}
		setUser(userinfo,nodeid,sources,outlets,etcinfo,sync);
		return;}
	    else if (!(fdjtID("SBOOKGETUSERINFO"))) {
		var user_script=fdjtDOM("SCRIPT#SBOOKGETUSERINFO");
		user_script.language="javascript";
		user_script.src=
		    "https://"+Codex.server+"/glosses/user.js";
		document.body.appendChild(user_script);
		fdjtDOM.addClass(document.body,"notsbookuser");}
	    else fdjtDOM.addClass(document.body,"notsbookuser");}
	
	function setUser(userinfo,nodeid,sources,outlets,etc,sync){
	    var persist=((Codex.offline)&&(navigator.onLine));
	    var refuri=Codex.refuri;
	    if (userinfo) {
		fdjtDOM.dropClass(document.body,"notsbookuser");
		fdjtDOM.addClass(document.body,"sbookuser");}
	    if (Codex.user)
		if (userinfo.oid===Codex.user.oid) {}
	    else throw { error: "Can't change user"};
	    var syncstamp=Codex.syncstamp;
	    if ((syncstamp)&&(syncstamp>=sync)) {
		fdjtLog.warn(
		    "Cached user information is newer (%o) than loaded (%o)",
		    syncstamp,sync);
		return false;}
	    Codex.user=fdjtKB.Import(userinfo);
	    if (persist) {
		fdjtState.setLocal(Codex.user.oid,Codex.user,true);
		fdjtState.setLocal("codex.nodeid("+Codex.refuri+")",nodeid);
		fdjtState.setLocal("codex.user",Codex.user.oid);}
	    gotInfo("sources",sources,persist);
	    gotInfo("outlets",outlets,persist);
	    gotInfo("etc",etc,persist);
	    if ((outlets)&&(outlets.length)) {
		Codex.outlets=outlets;
		var addgloss=fdjtID("CODEXADDGLOSSPROTOTYPE");
		var div=fdjtDOM.getChild(addgloss,".outlets");
		fdjtDOM.dropClass(div,"nocontent");
		var i=0; var ilim=outlets.length;
		while (i<ilim) {
		    var outlet=outlets[i++];
		    var checkspan=
			fdjtUI.CheckSpan(
			    "span.checkspan",
			    "SHARE",outlet._id,false,
			    outlet.nick||outlet.name);
		    if ((outlet.description)&&(outlet.nick))
			checkspan.title=outlet.name+": "+outlet.description;
		    else if (outlet.description)
			checkspan.title=outlet.description;
		    else if (outlet.nick) checkspan.title=outlet.name;
		    fdjtDOM(div,checkspan,"\n");}}
	    if (sync) {
		Codex.usersync=sync;
		if (persist) fdjtState.setLocal("codex.usersync",sync);}
	    if (!(Codex.nodeid)) {
		Codex.nodeid=nodeid;
		if ((nodeid)&&(persist))
		    fdjtState.setLocal("codex.nodeid("+refuri+")",nodeid);}
	    setupUser();
	    return Codex.user;}
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
				fdjtState.setLocal(obj._id,obj,true);
			    qids.push(obj._id);}}
		    sbook[name]=qids;
		    if (Codex.offline)
			fdjtState.setLocal(
			    "codex."+name+"("+refuri+")",qids,true);}
	    else {
		var obj=fdjtKB.Import(info);
		if (persist) 
		    fdjtState.setLocal(obj._id,obj,true);
		sbook[name]=obj._id;
		if (persist)
		    fdjtState.setLocal("codex."+name+"("+refuri+")",qid,true);}}
	Codex.setUser=setUser;
	function setupUser(){
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
		fdjtID("SBOOKMARKUSER").value=Codex.user.oid;

	    /* Initialize add gloss forms */
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
		 ("https://graph.facebook.com/"+Codex.user.fbid+"/picture?type=square"));
	    if (pic) {
		if (fdjtID("SBOOKMARKIMAGE")) fdjtID("SBOOKMARKIMAGE").src=pic;
		if (fdjtID("SBOOKUSERPIC")) fdjtID("SBOOKUSERPIC").src=pic;
		var byname=document.getElementsByName("SBOOKUSERPIC");
		if (byname) {
		    var i=0; var lim=byname.length;
		    while (i<lim) byname[i++].src=pic;}}
	    if (fdjtID("SBOOKFRIENDLYOPTION"))
		if (Codex.user)
		    fdjtID("SBOOKFRIENDLYOPTION").value=Codex.user.oid;
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
		var friends=Codex.user.friends; var i=0; var lim=friends.length;
		while (i<lim) {
		    var friend=fdjtKB.ref(friends[i++]);
		    Codex.addTag2UI(friend);}}
	    Codex._user_setup=true;}

	function setupGlosses() {
	    var allglosses=[];
	    Codex.glossing=fdjtTime();
	    var latest=Codex.syncstamp||0;
	    var loaded=((_sbook_loadinfo)&&(_sbook_loadinfo.glosses))||
		((_sbook_glosses)||false)||[];
	    var cached=fdjtState.getLocal("glosses("+Codex.refuri+")",true);
	    if ((_sbook_loadinfo)&&(_sbook_loadinfo.sync)) {
		if ((latest)&&(latest>_sbook_loadinfo.sync)) {
		    fdjtLog.warn("Cached data is fresher than loaded data");
		    return;}
		else latest=Codex.syncstamp=(_sbook_loadinfo.sync);}
	    Codex.glosses.Import(loaded);
	    if (cached) allglosses=cached;
	    if (loaded.length) {
		var n=loaded.length; var i=0; while (i<n) {
		    var gloss=loaded[i++];
		    var id=gloss._id;
		    var tstamp=gloss.syncstamp||gloss.tstamp;
		    if (tstamp>latest) latest=tstamp;
		    allglosses.push(id);}}
	    if ((_sbook_loadinfo)&&(_sbook_loadinfo.etc))
		fdjtKB.Import(_sbook_loadinfo.etc);
	    Codex.syncstamp=latest;
	    Codex.allglosses=allglosses;
	    if (Codex.offline) {
		fdjtState.setLocal("glosses("+Codex.refuri+")",allglosses,true);
		fdjtState.setLocal("syncstamp("+Codex.refuri+")",latest);}
	    if ((allglosses.length===0) &&
		(!(Codex.nologin)) && (Codex.user) && (navigator.onLine) &&
		(!(_sbook_loadinfo))) {
		var glosses_script=fdjtDOM("SCRIPT#SBOOKGETGLOSSES");
		glosses_script.language="javascript";
		glosses_script.src="https://"+Codex.server+
		    "/glosses/glosses.js?CALLBACK=Codex.Startup.initGlosses&REFURI="+
		    encodeURIComponent(Codex.refuri);
		if (Codex.Trace.glosses)
		    fdjtLog("setupGlosses/JSONP %o sync=%o",
			    glosses_script.src,Codex.syncstamp||false);
		if (Codex.syncstamp)
		    glosses_script.src=
		    glosses_script.src+"&SYNCSTAMP="+Codex.syncstamp;
		document.body.appendChild(glosses_script);}
	    else gotGlosses();}
	
	function go_online(evt){return offline_update();}
	function offline_update(){
	    Codex.writeGlosses();
	    var uri="https://"+Codex.server+
		"/glosses/update?REFURI="+
		encodeURIComponent(Codex.refuri)+
		"&ORIGIN="+
		encodeURIComponent
	    (document.location.protocol+"//"+document.location.hostname);
	    if (Codex.syncstamp) uri=uri+"&SYNCSTAMP="+(Codex.syncstamp+1);
	    fdjtAjax.jsonCall(offline_import,uri);}
	function offline_import(results){
	    fdjtKB.Import(results);
	    var i=0; var lim=results.length;
	    var syncstamp=Codex.syncstamp; var tstamp=false;
	    while (i<lim) {
		tstamp=results[i++].tstamp;
		if ((tstamp)&&(tstamp>syncstamp)) syncstamp=tstamp;}
	    Codex.syncstamp=syncstamp;
	    fdjtState.setLocal("syncstamp("+Codex.refuri+")",syncstamp);}
	Codex.update=offline_update;
	
	function initState()
	{
	    var uri=Codex.docuri||Codex.refuri;
	    var statestring=fdjtState.getLocal("codex.state("+uri+")");
	    if (statestring) Codex.state=state=JSON.parse(statestring);

	}

	/* This initializes the sbook state to the initial location with the
	   document, using the hash value if there is one. */ 
	function initLocation() {
	    var state=false;
	    if (!(state)) {
		var uri=Codex.docuri||Codex.refuri;
		var statestring=fdjtState.getLocal("codex.state("+uri+")");
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
	    else Codex.GoTo((Codex.start||Codex.coverpage||Codex.titlepage||Codex.root),false,true);
	    if ((Codex.user)&&(Codex.dosync)&&(navigator.onLine))
		syncLocation();}
	
	function syncLocation(){
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
			    Codex.GoTo(Codex.start||Codex.root||Codex.body,false,false);
			return;}
		    else if ((!(Codex.state))||(Codex.state.tstamp<d.tstamp)) {
			if ((d.location)&&(d.location<Codex.location)) return;
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

	function gotGlosses(){
	    delete Codex.glossing; Codex.glossed=fdjtTime();
	    if (Codex.Trace.glosses) fdjtLog("gotGlosses");}

	function initGlosses(glosses,etc){
	    var allglosses=Codex.allglosses;
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
	    if (Codex.offline) {
		fdjtState.setLocal("glosses("+Codex.refuri+")",allglosses,true);
		fdjtState.setLocal("syncstamp("+Codex.refuri+")",latest);}
	    gotGlosses();}
	Codex.Startup.initGlosses=initGlosses;

	function applyInlineTags(){
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
	    sbook_index.Tags=function(item){
		if (docinfo[item]) {
		    var info=docinfo[item];
		    if (info.alltags) return info.alltags;
		    return (info.alltags=
			    (KnoduleIndex.combineTags([info.tags||false,
						       info.glosstags||false,
						       info.autotags||false])));}
		var info=Codex.glosses.ref(item)||fdjtKB.ref(item);
		return ((info)&&(info.tags))||[];};
	    for (var eltid in docinfo) {
		var tags=docinfo[eltid].tags; 
		if (!(tags)) continue;
		var scores=tags.scores;
		var k=0; var ntags=tags.length;
		while (k<ntags) {
		    var tag=tags[k++];
		    if (scores)
			sbook_index.add(eltid,tag,scores[tag]||1,knodule);
		    else sbook_index.add(eltid,tag,1,knodule);}}}
	Codex.indexContentTags=indexContentTags
	
	/* Inline tags */
	function indexInlineTags(kno) {
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
     Codex.indexInlineTags=indexInlineTags;

     function useAutoIndex(autoindex,knodule){
	 var sbook_index=Codex.index;
	 if (!(autoindex)) return;
	 if (!(sbook_index)) return;
	 for (var tag in autoindex) {
	     var ids=autoindex[tag];
	     var starpower=tag.search(/[^*]/);
	     // all stars or empty string, just ignore
	     if (starpower<0) continue;
	     var weight=((tag[0]==='~')?(1):(2*(starpower+1)));
	     var knode=((tag.indexOf('|')>=0)?
			(knodule.handleSubjectEntry(tag.slice(starpower))):
			(tag[0]==='~')?(tag.slice(1)):
			(knodule.handleSubjectEntry(tag.slice(starpower))));
	     var i=0; var lim=ids.length;
	     while (i<lim) {
		 var info=Codex.docinfo[ids[i++]];
		 if (!(info)) continue;
		 var tagval=((typeof knode === 'string')?(knode):(knode.dterm));
		 if (info.autotags) info.autotags.push(tagval);
		 else info.autotags=[tagval];
		 sbook_index.add(info.frag,knode,weight,knodule);}}}
     Codex.useAutoIndex=useAutoIndex;

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
	 if (refuri) {
	     var glosses=
		 fdjtState.getLocal("codex.glosses("+refuri+")",true);
	     var i=0; var lim=glosses.length;
	     while (i<lim) fdjtState.dropLocal(glosses[i++]);
	     fdjtState.dropLocal("codex.sources("+refuri+")");
	     fdjtState.dropLocal("codex.outlets("+refuri+")");
	     fdjtState.dropLocal("codex.etc("+refuri+")");
	     fdjtState.dropLocal("codex.offline("+refuri+")");
	     var refuris=fdjtState.getLocal("codex.refuris",true);
	     refuris=fdjtKB.remove(refuris,refuri);
	     fdjtState.setLocal("codex.refuris",refuris,true);}
	 else {
	     var refuris=fdjtState.getLocal("codex.refuris",true);
	     var i=0; var lim=refuris.length;
	     while (i<lim) clearOffline(refuris[i++]);
	     fdjtState.dropLocal("codex.refuris");}}
     Codex.clearOffline=clearOffline;

     /* Other setup */
     
     function setupGlossServer(){}

     return Startup;})();
sbookStartup=Codex.Startup;
Codex.Setup=Codex.Startup;
sbook={Start: Codex.Startup,setUser: Codex.setUser};

fdjt_versions.decl("codex",codex_startup_version);
fdjt_versions.decl("codex/startup",codex_startup_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
