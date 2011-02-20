/* -*- Mode: Javascript; -*- */

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

sbook.Startup=
    (function(){

	var sbook_faketouch=false;
	var sbook_showconsole=true;

	var sbook_fullpages=[];
	var sbook_heading_qricons=false;

	var https_graphics=
	    "https://beingmeta.s3.amazonaws.com/static/graphics/";

	/* Initialization */
	
	var _sbook_setup_start=false;
	
	function Startup(force){
	    if (sbook._setup) return;
	    if ((!force)&&(fdjtState.getQuery("nosbooks"))) return; 
	    fdjtLog.console="CODEXCONSOLE";
	    fdjtLog.consoletoo=true;
	    fdjtLog("This is Codex version %d, built on %s at %s",
		    fdjt_versions.codex,sbooks_buildhost,sbooks_buildtime);
	    if (!(sbook._setup_start)) sbook._setup_start=new Date();
	    // Get various settings
	    getSettings();
	    sbookPaginate.getSettings();
	    // Dependent setups
	    fdjtDOM.init();
	    // Add this as soon as possible
	    if (sbook.paginate) fdjtDOM.addClass(document.body,"paginate");
	    if (sbook_showconsole)
		fdjtDOM.addClass(document.body,"sbookconsoled");
	    var metadata=false;
	    var helphud=false;
	    fdjtTime.timeslice
	    ([// Setup sbook tables, databases, etc
		sbook.initDB,
		// This wraps the body in an div#SBOOKCONTENT 
		function(){
		    initBody();
		    if (sbook.animate.page)
			fdjtDOM.addClass("SBOOKCONTENT","codexanimate");
		    sbook.body.style.opacity='0.25';},
		function(){
		    if (sbook.Trace.startup>1)
			fdjtLog("Initializing HUD");
		    sbook.initHUD(); sbook.initDisplay();
		    if (sbook.animate.hud)
			fdjtDOM.addClass("CODEXHUD","codexanimate");
		    helphud=fdjtID("CODEXHELP");
		    helphud.style.opacity=0.0001;
		    if (sbook.Trace.startup>1)
			fdjtLog("HUD Setup, sizing help");},
		function(){CodexMode("splash");}, 
		function(){fdjtDOM.adjustToFit(helphud,0.2);},
		function(){fdjtDOM.adjustToFit(helphud,0.2);},
		function(){
		    fdjtDOM.finishScale(helphud);
		    if (sbook.Trace.startup>1)
			fdjtLog("Displaying help");
		    helphud.style.opacity='';},
		sbook.setupGestures,
		getUser,
		function(){
		    metadata=CodexDOMScan(sbook.root);
		    sbook.docinfo=sbook.DocInfo.map=metadata;
		    sbook.ends_at=sbook.docinfo[sbook.root.id].ends_at;},
		function(){
		    fdjtLog("building table of contents based on %d heads",
			    sbook.docinfo._headcount);},
		10,
		function(){
		    sbook.setupTOC(metadata[sbook.root.id]);},
		function(){
		    sbook.resizeBody();
		    sbook.body.style.opacity='';},
		function(){
		    fdjtLog("processing knodule %s",sbook.knodule.name);},
		10,
		((Knodule)&&(Knodule.HTML)&&(Knodule.HTML.Setup)&&
		 (function(){
		     Knodule.HTML.Setup(sbook.knodule);})),
		applyInlineTags,
		function(){sbook.Message("indexing tags");},10,
		function(){
		    sbook.indexTags(metadata);
		    sbook.indexTechnoratiTags(sbook.knodule);},
		function(){sbook.Message("setting up clouds");},10,
		function(){initClouds();},
		function(){sbook.Message("configuring server");},10,
		setupGlossServer,
		function(){
		    if (sbook.user) sbook.Message("getting glosses");},10,
		function (){ if (sbook.user) setupGlosses();},
		function(){
		    if (sbook.Trace.startup>1)
			fdjtLog("Initial pagination for %ox%o",
				fdjtDOM.viewWidth(),fdjtDOM.viewHeight());
		    sbookPaginate(sbook.paginate);},
		function(){
		    if ((sbook.user)&&(!(sbook.glossing))&&
			(!(sbook.glossed)))
			sbook.Message("getting glosses");},10,
		function (){
		    if ((sbook.user)&&(!(sbook.glossing))&&(!(sbook.glossed)))
			setupGlosses();},500,
		function(){
		    if ((sbook.user)&&(!(sbook.glossing))&&
			(!(sbook.glossed)))
			sbook.Message("getting glosses");},10,
		function(){
		    if ((!(sbook.glossing))&&(!(sbook.glossed))) {
			if (sbook.user) setupGlosses();
			else gotGlosses();}},
		function(){sbook.Message("setup completed");},10,
		function(){
		    if ((fdjtState.getQuery("action"))||
			(fdjtState.getQuery("invitation"))) {
			CodexMode("sbookapp");}
		    else if ((sbook.mode==='splash')&&(sbook.hidesplash)) {
			CodexMode(false);}
		    else {}},
		initLocation,
		function(){
		    sbook.displaySync();
		    setInterval(sbook.serverSync,60000);
		    _sbook_setup=sbook._setup=new Date();}],
	     25,100);}
	sbook.Startup=Startup;

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
		fdjtState.getLocal("sbook.offline("+refuri+")")||
		fdjtState.getLocal("sbook.mycopy("+refuri+")")||
		fdjtState.getLocal("sbook.offline")||
		((fdjtDOM.getMeta("sbook.mycopyid")))||
		((fdjtDOM.getMeta("MYCOPYID")))||
		(fdjtDOM.getMeta("sbook.offline"));
	    if ((!(value))||(value==="no")||(value==="off")||(value==="never"))
		return false;
	    else if ((value==="ask")&&(window.confirm))
		return window.confirm("Read offline?");
	    else return true;}
	
	var glossref_classes=false;

	function getSettings(){
	    if (typeof _sbook_loadinfo === "undefined") _sbook_loadinfo=false;
	    // Basic stuff
	    var useragent=navigator.userAgent;
	    var refuri=_getsbookrefuri();
	    document.body.refuri=sbook.refuri=refuri;
	    sbook.docuri=_getsbookdocuri();
	    var deviceid=fdjtState.getLocal("sbook.deviceId",false);
	    var devicename=fdjtState.getLocal("sbook.deviceName",false);
	    if (!(deviceid)) {
		deviceid=fdjtState.getUUID();
		fdjtState.setLocal("sbook.deviceId",deviceid);}
	    sbook.deviceId=deviceid;
	    if (devicename) sbook.deviceName=devicename;
	    var refuris=fdjtState.getLocal("sbook.refuris",true)||[];
	    var offline=workOffline(refuri);
	    sbook.offline=((offline)?(true):(false));
	    if (offline)
		fdjtState.setLocal("sbook.offline("+refuri+")",offline);
	    // Get the settings for scanning the document structure
	    getScanSettings();
	    // Get the settings for automatic pagination
	    getPageSettings();
	    // Whether to hide help after startup
	    if (fdjtState.getLocal("sbook.hidehelp")) setConfig('hidehelp');

	    if ((sbook.graphics==="http://static.beingmeta.com/graphics/")&&
		(window.location.protocol==='https:'))
		sbook.graphics=https_graphics;
	    
	    // Whether to suppress login, etc
	    if ((fdjtState.getLocal("sbook.nologin"))||
		(fdjtState.getQuery("nologin")))
		sbook.nologin=true;
	    sbook.max_excerpt=fdjtDOM.getMeta("sbook.maxexcerpt")||
		(sbook.max_excerpt);
	    sbook.min_excerpt=fdjtDOM.getMeta("sbook.minexcerpt")||
		(sbook.min_excerpt);
	    var sbooksrv=fdjtDOM.getMeta("sbook.server")||
		fdjtDOM.getMeta("SBOOKSERVER");
	    if (sbooksrv) sbook.server=sbooksrv;
	    else if (fdjtState.getCookie["SBOOKSERVER"])
		sbook.server=fdjtState.getCookie["SBOOKSERVER"];
	    else sbook.server=lookupServer(document.domain);
	    if (!(sbook.server)) sbook.server=sbook.default_server;
	    sbook_ajax_uri=fdjtDOM.getMeta("sbook.ajax",true);
	    sbook.mycopyid=fdjtDOM.getMeta("sbook.mycopyid")||
		((offline)&&(fdjtState.getLocal("mycopy("+refuri+")")))||
		false;
	    sbook.syncstamp=fdjtState.getLocal("syncstamp("+refuri+")",true);
	    
	    if ((offline)&&
		(!(fdjtState.getLocal("sbook.offline("+refuri+")")))) {
		fdjtState.setLocal("sbook.offline("+refuri+")",true,true);
		refuris.push(refuri);
		fdjtState.setLocal("sbook.refuris",refuris,true);}
	    
	    var isIphone = (/iphone/gi).test(navigator.appVersion);
	    var isIpad = (/ipad/gi).test(navigator.appVersion);
	    var isAndroid = (/android/gi).test(navigator.appVersion);
	    var isWebKit = navigator.appVersion.search("WebKit")>=0;
	    var isWebTouch = isIphone || isIpad || isAndroid;

	    if ((isWebKit)&&(typeof sbook.colpage === 'undefined'))
		sbook.colpage=true;
	    else sbook.colpage=false;
	    if (isWebTouch) {
		fdjtDOM.addClass(document.body,"sbooktouch");
		viewportSetup();
		sbook.ui="webtouch"; sbook.touch=true;}
	    if ((useragent.search("Safari/")>0)&&
		(useragent.search("Mobile/")>0)) { 
		hide_mobile_safari_address_bar();
		sbook.nativescroll=false;
		sbook.scrolldivs=false;
		// Have fdjtLog do it's own format conversion for the log
		fdjtLog.doformat=true;}
	    else if (sbook_faketouch) {
		fdjtDOM.addClass(document.body,"sbooktouch");
		viewportSetup();
		sbook.ui="faketouch"}
	    else {
		sbook.ui="mouse";}
	    
	    sbook.allglosses=
		((offline)?
		 ((fdjtState.getLocal("glosses("+refuri+")",true))||[]):
		 []);
	    sbook.allsources=
		((offline)?
		 ((fdjtState.getLocal("sources("+refuri+")",true))||{}):
		 {});
	    sbook.glossetc=
		((offline)?
		 ((fdjtState.getLocal("glossetc("+refuri+")",true))||{}):
		 {});}

	function setConfig(name,value){
	    var inputs=document.getElementsByName(name.toUpperCase());
	    // fdjtLog("[%fs] setConfig %o=%o",fdjtET(),name,value);
	    if ((value===true)||(typeof value === 'undefined')) {
		fdjtState.setLocal("sbook."+name,'yes');
		sbook[name]=true;
		if ((inputs)&&(inputs.length)) {
		    var i=0; var lim=inputs.length;
		    while (i<lim) fdjtUI.CheckSpan.set(inputs[i++],true);}}
	    else if (value===false) {
		fdjtState.dropLocal("sbook."+name,'yes');
		delete sbook[name];
		if ((inputs)&&(inputs.length)) {
		    var i=0; var lim=inputs.length;
		    while (i<lim) fdjtUI.CheckSpan.set(inputs[i++],false);}}
	    else {
		fdjtState.setLocal("sbook."+name,value);
		sbook[name]=value;
		if ((inputs)&&(inputs.length)) {
		    var i=0; var lim=inputs.length;
		    while (i<lim) inputs[i++].value=value;}}}
	sbook.setConfig=setConfig;

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
		fdjtDOM.getLink("DOCURI",false)||
		fdjtDOM.getMeta("sbook.docuri",false)||
		fdjtDOM.getMeta("DOCURI",false)||
		fdjtDOM.getLink("canonical",false)||
		location.href;}

	function lookupServer(string){
	    var sbook_servers=sbook.servers;
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
	sbook.hasTOCLevel=hasTOCLevel;

	function getScanSettings(){
	    if (!(sbook.root))
		if (fdjtDOM.getMeta("sbook.root"))
		    sbook.root=fdjtID(fdjtDOM.getMeta("sbook.root"));
	    else sbook.root=fdjtID("SBOOKCONTENT")||document.body;
	    if (!(sbook.start))
		if (fdjtDOM.getMeta("sbook.start"))
		    sbook.start=fdjtID(fdjtDOM.getMeta("sbook.start"));
	    else if (fdjtID("SBOOKSTART"))
		sbook.start=fdjtID("SBOOKSTART");
	    else {
		var titlepage=fdjtID("SBOOKTITLE")||fdjtID("TITLEPAGE");
		while (titlepage)
		    if (fdjtDOM.nextElt(titlepage)) {
			sbook.start=fdjtDOM.nextElt(titlepage); break;}
		else titlepage=titlepage.parentNode;}
	    var i=1; while (i<9) {
		var rules=fdjtDOM.getMeta("sbook.head"+i,true).
		    concat(fdjtDOM.getMeta("sbook"+i+"head",true));
		if ((rules)&&(rules.length)) {
		    var j=0; var lim=rules.length;
		    var elements=fdjtDOM.getChildren(document.body,rules[j++]);
		    var k=0; var n=elements.length;
		    while (k<n) {
			var elt=elements[k++];
			if (!(hasTOCLevel(elt))) elt.toclevel=i;}}
		i++;}
	    if (fdjtDOM.getMeta("sbookignore")) 
		sbook.ignore=new fdjtDOM.Selector(
		    fdjtDOM.getMeta("sbookignore"));
	    if (fdjtDOM.getMeta("sbooknotoc")) 
		sbook.notoc=new fdjtDOM.Selector(
		    fdjtDOM.getMeta("sbooknotoc"));
	    if (fdjtDOM.getMeta("sbookterminal"))
		sbook.terminal_rules=new fdjtDOM.Selector(
		    fdjtDOM.getMeta("sbookterminal"));
	    if (fdjtDOM.getMeta("sbookid")) 
		sbook_idify=new fdjtDOM.Selector(
		    fdjtDOM.getMeta("sbookid"));
	    if (fdjtDOM.getMeta("sbook.notag"))
		sbook.notag_rules=
		new fdjtDOM.Selector(fdjtDOM.getMeta("sbook.notag"));
	    if ((fdjtDOM.getMeta("sbookfocus"))) 
		sbook.foci=new fdjtDOM.Selector(fdjtDOM.getMeta("sbookfocus"));
	    else if ((fdjtDOM.getMeta("sbookfoci")))  
		sbook.foci=new fdjtDOM.Selector(fdjtDOM.getMeta("sbookfoci"));
	    else {}
	    if (fdjtDOM.getMeta("sbooknofocus"))
		sbook.nofoci=newfdjtDOM.Selector(
		    fdjtDOM.getMeta("sbooknofocus"));
	    else if (fdjtDOM.getMeta("sbooknofoci"))
		sbook.nofoci=new fdjtDOM.Selector(
		    fdjtDOM.getMeta("sbooknofoci"));
	    else {}}
	

	function getPageSettings(){
	    var tocmajor=fdjtDOM.getMeta("sbook.tocmajor",true);
	    if (tocmajor) sbook_tocmajor=parseInt(tocmajor);
	    var sbook_fullpage_rules=fdjtDOM.getMeta("sbook.fullpage",true);
	    if (sbook_fullpage_rules) {
		var i=0; while (i<sbook_fullpage_rules.length) {
		    sbook_fullpages.push
		    (fdjtDOM.Selector(sbook_fullpage_rules[i++]));}}
	    sbook_fullpages.push
	    (fdjtDOM.Selector(".sbookfullpage, .titlepage"));}

	function applyMetaClass(name){
	    var meta=fdjtDOM.getMeta(name,true);
	    var i=0; var lim=meta.length;
	    while (i<lim) fdjtDOM.addClass(fdjtDOM.$(meta[i++]),name);}

	var note_count=1;
	function initBody(){
	    var page=fdjtID("CODEXPAGE");
	    var content=
		((fdjtDOM.getMeta("sbook.body"))?
		 ((fdjtID(fdjtDOM.getMeta("sbook.body")))||(document.body)):
		 (fdjtID("SBOOKCONTENT")));
	    if (!(content)) {
		content=fdjtDOM("div#SBOOKCONTENT");
		var nodes=fdjtDOM.toArray(document.body.childNodes);
		var i=0; var lim=nodes.length;
		while (i<lim) content.appendChild(nodes[i++]);}
	    if (!(page))
		page=fdjtDOM("div#CODEXPAGE",
			     fdjtDOM("div#CODEXASIDE"),
			     fdjtDOM("div#CODEXREF"),
			     fdjtDOM("div#CODEXMASK"),
			     content);
	    document.body.appendChild(page);
	    fdjtDOM.addClass(document.body,"sbook");
	    sbook.body=content; sbook.page=page;
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
		var idcontext=sbook.getTarget(noteref.parentNode);
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
		var detailhead=((head)?(fdjtDOM.clone(head)):
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
	    if (sbook.Trace.startup>1)
		fdjtLog("Initialized body");}

	/* Changing settings */

	function updateSessionSettings(delay){
	    if (delay) {
		setTimeout(sbookUpdateSessionSettings,delay);
		return;}
	    // This updates the session settings from the checkboxes 
	    var sessionsettings="opts";
	    setopt("paginate",fdjtID("SBOOKPAGINATE").checked);
	    setopt("touch",fdjtID("SBOOKTOUCHMODE").checked);
	    setopt("mouse",fdjtID("SBOOKMOUSEMODE").checked);
	    setopt("kbd",fdjtID("SBOOKKBDMODE").checked);
	    setopt("flashy",fdjtID("CODEXHUDFLASH").checked);
	    // setopt("rich",fdjtID("CODEXHUDRICH").checked);
	    fdjtSetSession("sbookopts",sessionsettings);
	    applySettings();}

	function saveSettings(){
	    var opts=fdjtGetSession("sbookopts");
	    if (opts) {
		fdjtState.setLocal("sbookopts",opts);}}
	sbook.saveSettings=saveSettings;

	function getUser() {
	    var refuri=sbook.refuri;
	    var loadinfo=_sbook_loadinfo||false;
	    if (sbook.Trace.startup>1)
		fdjtLog("Getting user for %o cur=%o",refuri,sbook.user);
	    if (sbook.user) return;
	    else if (sbook.nologin) return;
	    if ((loadinfo)&&
		(setUser(loadinfo.userinfo,loadinfo.nodeid,
			 loadinfo.sources,loadinfo.outlets,
			 loadinfo.etc,loadinfo.sync))) 
		return;
	    if ((sbook.offline)&&
		(fdjtState.getLocal("sbook.user"))&&
		(fdjtState.getLocal("sbook.nodeid("+refuri+")"))) {
		var refuri=sbook.refuri;
		var user=fdjtState.getLocal("sbook.user");
		if (sbook.trace.startup)
		    fdjtLog("Restoring offline user info for %o reading %o",
			    user,refuri);
		var userinfo=JSON.parse(fdjtState.getLocal(user));
		var sources=fdjtState.getLocal("sbook.sources("+refuri+")",true);
		var outlets=fdjtState.getLocal("sbook.outlets("+refuri+")",true);
		var etc=fdjtState.getLocal("sbook.etc("+refuri+")",true);
		var nodeid=fdjtState.getLocal("sbook.nodeid("+refuri+")");
		var sync=fdjtState.getLocal("sbook.usersync",true);
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
		    "https://"+sbook.server+"/v4/user.js";
		document.body.appendChild(user_script);
		fdjtDOM.addClass(document.body,"nosbookuser");}
	    else fdjtDOM.addClass(document.body,"nosbookuser");}
	
	function setUser(userinfo,nodeid,sources,outlets,etc,sync){
	    var persist=((sbook.offline)&&(navigator.onLine));
	    var refuri=sbook.refuri;
	    if (sbook.user)
		if (userinfo.oid===sbook.user.oid) {}
	    else throw { error: "Can't change user"};
	    var syncstamp=sbook.syncstamp;
	    if ((syncstamp)&&(syncstamp>=sync)) {
		fdjtLog.warn(
		    "Cached user information is newer (%o) than loaded (%o)",
		    syncstamp,sync);
		return false;}
	    sbook.user=fdjtKB.Import(userinfo);
	    if (persist) {
		fdjtState.setLocal(sbook.user.oid,sbook.user,true);
		fdjtState.setLocal("sbook.nodeid("+sbook.refuri+")",nodeid);
		fdjtState.setLocal("sbook.user",sbook.user.oid);}
	    gotInfo("sources",sources,persist);
	    gotInfo("outlets",outlets,persist);
	    gotInfo("etc",etc,persist);
	    if (outlets) {
		var i=0; var ilim=outlets.length;
		while (i<ilim) {
		    var outlet=outlets[i++];
		    var span=fdjtID("SBOOKGLOSSOUTLET"+outlet.humid);
		    if (!(span)) {
			var completion=
			    fdjtDOM("span.completion.outlet.cue",outlet.name);
			completion.id="SBOOKGLOSSOUTLET"+outlet.humid;
			completion.setAttribute("value",outlet.qid);
			completion.setAttribute("key",outlet.name);
			fdjtDOM(fdjtID("CODEXGLOSSOUTLETS"),completion," ");
			if (sbook.gloss_cloud)
			    sbook.gloss_cloud.addCompletion(completion);}}}
	    if (sync) {
		sbook.usersync=sync;
		if (persist) fdjtState.setLocal("sbook.usersync",sync);}
	    if (!(sbook.nodeid)) {
		sbook.nodeid=nodeid;
		if ((nodeid)&&(persist))
		    fdjtState.setLocal("sbook.nodeid("+refuri+")",nodeid);}
	    setupUser();
	    return sbook.user;}
	function gotInfo(name,info,persist) {
	    var refuri=sbook.refuri;
	    if (info)
		if (info instanceof Array) {
		    var i=0; var lim=info.length; var qids=[];
		    while (i<lim) {
			if (typeof info[i] === 'string') {
			    var qid=info[i++];
			    if (sbook.offline) fdjtKB.load(qid);
			    qids.push(qid);}
			else {
			    var obj=fdjtKB.Import(info[i++]);
			    if (persist) 
				fdjtState.setLocal(obj.qid,obj,true);
			    qids.push(obj.qid);}}
		    sbook[name]=qids;
		    if (sbook.offline)
			fdjtState.setLocal
		    ("sbook."+name+"("+refuri+")",qids,true);}
	    else {
		var obj=fdjtKB.Import(info);
		if (persist) 
		    fdjtState.setLocal(obj.qid,obj,true);
		sbook[name]=obj.qid;
		if (persist)
		    fdjtState.setLocal("sbook."+name+"("+refuri+")",qid,true);}}
	sbook.setUser=setUser;
	function setupUser(){
	    if (sbook._user_setup) return;
	    if (!(sbook.user)) {
		fdjtDOM.addClass(document.body,"nosbookuser");
		return;}
	    fdjtDOM.dropClass(document.body,"nosbookuser");
	    var username=sbook.user.name;
	    fdjtID("SBOOKUSERNAME").innerHTML=username;
	    if (fdjtID("SBOOKMARKUSER"))
		fdjtID("SBOOKMARKUSER").value=sbook.user.oid;
	    var pic=
		(sbook.user.pic)||
		((sbook.user.fbid)&&
		 ("https://graph.facebook.com/"+sbook.user.fbid+"/picture?type=square"));
	    if (pic) {
		if (fdjtID("SBOOKMARKIMAGE")) fdjtID("SBOOKMARKIMAGE").src=pic;
		if (fdjtID("SBOOKUSERPIC")) fdjtID("SBOOKUSERPIC").src=pic;}
	    if (fdjtID("SBOOKFRIENDLYOPTION"))
		if (sbook.user)
		    fdjtID("SBOOKFRIENDLYOPTION").value=sbook.user.oid;
	    else fdjtID("SBOOKFRIENDLYOPTION").value="";
	    var idlinks=document.getElementsByName("IDLINK");
	    if (idlinks) {
		var i=0; var len=idlinks.length;
		while (i<len) {
		    var idlink=idlinks[i++];
		    idlink.target='_blank';
		    idlink.title='click to edit your personal information';
		    idlink.href='https://auth.sbooks.net/admin/identity';}}
	    if (sbook.user.friends) {
		var friends=sbook.user.friends; var i=0; var lim=friends.length;
		while (i<lim) {
		    var friend=fdjtKB.ref(friends[i++]);
		    sbook.addTag2UI(friend);}}
	    sbook._user_setup=true;}

	function setupGlosses() {
	    var allglosses=[];
	    sbook.glossing=fdjtTime();
	    var latest=sbook.syncstamp||0;
	    var loaded=((_sbook_loadinfo)&&(_sbook_loadinfo.glosses))||[];
	    var cached=fdjtState.getLocal("glosses("+sbook.refuri+")",true);
	    if ((_sbook_loadinfo)&&(_sbook_loadinfo.sync)) {
		if ((latest)&&(latest>_sbook_loadinfo.sync)) {
		    fdjtLog.warn("Cached data is fresher than loaded data");
		    return;}
		else latest=sbook.syncstamp=(_sbook_loadinfo.sync);}
	    sbook.glosses.Import(loaded);
	    if (cached) allglosses=cached;
	    if (loaded.length) {
		var n=loaded.length; var i=0; while (i<n) {
		    var gloss=loaded[i++];
		    var id=gloss.qid||gloss.uuid||gloss.oid;
		    var tstamp=gloss.syncstamp||gloss.tstamp;
		    if (tstamp>latest) latest=tstamp;
		    allglosses.push(id);}}
	    if ((_sbook_loadinfo)&&(_sbook_loadinfo.etc))
		fdjtKB.Import(_sbook_loadinfo.etc);
	    sbook.syncstamp=latest;
	    sbook.allglosses=allglosses;
	    if (sbook.offline) {
		fdjtState.setLocal("glosses("+sbook.refuri+")",allglosses,true);
		fdjtState.setLocal("syncstamp("+sbook.refuri+")",latest);}
	    if ((allglosses.length===0) &&
		(!(sbook.nologin)) && (sbook.user) && (navigator.onLine) &&
		(!(_sbook_loadinfo))) {
		var glosses_script=fdjtDOM("SCRIPT#SBOOKGETGLOSSES");
		glosses_script.language="javascript";
		glosses_script.src="https://"+sbook.server+
		    "/v4/glosses.js?CALLBACK=sbook.Startup.initGlosses&REFURI="+
		    encodeURIComponent(sbook.refuri);
		if (sbook.Trace.glosses)
		    fdjtLog("setupGlosses/JSONP %o sync=%o",
			    glosses_script.src,sbook.syncstamp||false);
		if (sbook.syncstamp)
		    glosses_script.src=
		    glosses_script.src+"&SYNCSTAMP="+sbook.syncstamp;
		document.body.appendChild(glosses_script);}
	    else gotGlosses();}
	
	function go_online(evt){return offline_update();}
	function offline_update(){
	    sbook.writeGlosses();
	    var uri="https://"+sbook.server+
		"/v4/update?REFURI="+
		encodeURIComponent(sbook.refuri)+
		"&ORIGIN="+
		encodeURIComponent(
		    document.location.protocol+"//"+document.location.hostname);
	    if (sbook.syncstamp) uri=uri+"&SYNCSTAMP="+(sbook.syncstamp+1);
	    fdjtAjax.jsonCall(offline_import,uri);}
	function offline_import(results){
	    fdjtKB.Import(results);
	    var i=0; var lim=results.length;
	    var syncstamp=sbook.syncstamp; var tstamp=false;
	    while (i<lim) {
		tstamp=results[i++].tstamp;
		if ((tstamp)&&(tstamp>syncstamp)) syncstamp=tstamp;}
	    sbook.syncstamp=syncstamp;
	    fdjtState.setLocal("syncstamp("+sbook.refuri+")",syncstamp);}
	sbook.update=offline_update;
	
	/* This initializes the sbook state to the initial location with the
	   document, using the hash value if there is one. */ 
	function initLocation() {
	    var hash=window.location.hash; var target=sbook.root;
	    if ((typeof hash === "string") && (hash.length>0)) {
		if ((hash[0]==='#') && (hash.length>1))
		    target=document.getElementById(hash.slice(1));
		else target=document.getElementById(hash);
		if (sbook.Trace.startup>1)
		    fdjtLog("sbookInitLocation hash=%s=%o",hash,target);
		if (target) sbook.GoTo(target,false,true);}
	    else {
		var uri=sbook.docuri||sbook.refuri;
		var statestring=fdjtState.getLocal("sbook.state("+uri+")");
		if (statestring) {
		    var state=JSON.parse(statestring);
		    if (state.target) sbook.setTarget(state.target,(state.location),true);
		    if (state.location) sbook.GoTo(state.location,true,true);
		    sbook.state=state;}
		if ((sbook.user)&&(sbook.dosync)&&(navigator.onLine)) syncLocation();}}
	
	function syncLocation(){
	    if (!(sbook.user)) return;
	    var uri="https://"+sbook.server+"/v4/sync"+
		"?DOCURI="+encodeURIComponent(sbook.docuri)+
		"&REFURI="+encodeURIComponent(sbook.refuri);
	    if (sbook.Trace.dosync)
		fdjtLog("syncLocation(call) %s",uri);
	    fdjtAjax.jsonCall(
		function(d){
		    if (sbook.Trace.dosync)
			fdjtLog("syncLocation(response) %s: %o",uri,d);
		    if ((!(d))||(!(d.location))) {
			if (!(sbook.state))
			    sbook.GoTo(sbook.start||sbook.root||sbook.body,false,false);
			return;}
		    else if ((!(sbook.state))||(sbook.state.tstamp<d.tstamp)) {
			if ((d.location)&&(d.location<sbook.location)) return;
			var msg=
			    "Sync to L"+d.location+
			    ((d.page)?(" (page "+d.page+")"):"")+"?";
			if (confirm(msg)) {
			    if (d.location) sbook.setLocation(d.location);
			    if (d.target) sbook.setTarget(d.target,true,true);
			    if (d.location) sbook.GoTo(d.location,true,true);
			    sbook.state=d;}}
		    else {}},
		uri);}

	function gotGlosses(){
	    delete sbook.glossing; sbook.glossed=fdjtTime();
	    if (sbook.Trace.glosses) fdjtLog("gotGlosses");}

	function initGlosses(glosses,etc){
	    var allglosses=sbook.allglosses;
	    if (etc) {
		if (sbook.Trace.startup)
		    fdjtLog("Assimilating %d new glosses and %d sources",
			    glosses.length,etc.length);
		sbook.Message(
		    fdjtString("Assimilating %d new glosses/%d sources...",
			       glosses.length,etc.length));}
	    else {
		if (sbook.Trace.startup)
		    fdjtLog("Assimilating %d new glosses",glosses.length);
		sbook.Message(
		    fdjtString(
			"Assimilating %d new glosses...",glosses.length));}
	    fdjtKB.Import(etc);
	    sbook.glosses.Import(glosses);
	    var i=0; var lim=glosses.length;
	    var latest=sbook.syncstamp||0;
	    while (i<lim) {
		var gloss=glosses[i++];
		var id=gloss.qid||gloss.uuid||gloss.oid;
		var tstamp=gloss.syncstamp||gloss.tstamp;
		if (tstamp>latest) latest=tstamp;
		allglosses.push(id);}
	    sbook.syncstamp=latest;
	    sbook.allglosses=allglosses;
	    if (sbook.offline) {
		fdjtState.setLocal("glosses("+sbook.refuri+")",allglosses,true);
		fdjtState.setLocal("syncstamp("+sbook.refuri+")",latest);}
	    gotGlosses();}
	sbook.Startup.initGlosses=initGlosses;

	function applyInlineTags(){
	    sbook.Message("Applying inline tags");
	    var tags=fdjtDOM.$(".sbooktags");
	    var i=0; var lim=tags.length;
	    while (i<lim) {
		var tagelt=tags[i++];
		var target=sbook.getTarget(tagelt);
		var info=sbook.docinfo[target.id];
		var tagtext=fdjtDOM.textify(tagelt);
		var tagsep=tagelt.getAttribute("tagsep")||";";
		var tagstrings=tagtext.split(tagsep);
		if (tagstrings.length) {
		    if (info.tags)
			info.tags=info.tags.concat(tagstrings);
		    else info.tags=tagstrings;}}}
	
	/* Indexing tags */

	function sbookIndexTags(docinfo){
	    var sbook_index=sbook.index;
	    knodule=(knodule)||(knodule=sbook.knodule);
	    /* One pass processes all of the inline KNodes and
	       also separates out primary and auto tags. */
	    for (var eltid in docinfo) {
		var tags=docinfo[eltid].tags;
		if (!(tags)) continue;
		var k=0; var ntags=tags.length; var scores=false;
		while (k<ntags) {
		    var tag=tags[k]; 
		    // This indicates an 'automatic tag' for easy replacement.
		    if (tag[0]==='%') tag=tag.slice(1);
		    if (tag[0]==='*') {
			var tagstart=tag.search(/[^*]+/);
			if (!(scores)) tags.scores=scores={};
			tags[k]=tag=tag.slice(tagstart);
			scores[tag]=2*(tagstart+1);}
		    else if (tag[0]==='~') {
			var tagstart=tag.search(/[^~]+/);
			tags[k]=tag=tag.slice(tagstart);
			if (tagstart>1) {
			    if (!(scores)) tags.scores=scores={};
			    scores[tag]=1/tagstart;}}
		    else {
			if (!(scores)) tags.scores=scores={};
			scores[tag]=2;}
		    if ((tag.indexOf('|')>=0)) knodule.handleSubjectEntry(tag);
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
	    var knodule=sbook.knodule||false;
	    sbook_index.Tags=function(item){
		var info=docinfo[item]||
		    sbook.glosses.ref(item)||
		    fdjtKB.ref(item);
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
	sbook.indexTags=sbookIndexTags;
	
	/* Inline knodules */
	function indexTechnoratiTags(kno) {
	    var sbook_index=sbook.index;
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
     sbook.indexTechnoratiTags=indexTechnoratiTags;

     /* Setting up the clouds */

     function initClouds(){
	 sbook.Message("setting up search cloud...");
	 fdjtDOM.replace("CODEXSEARCHCLOUD",sbook.fullCloud().dom);
	 sbook.Message("setting up glossing cloud...");
	 fdjtDOM.replace("CODEXGLOSSCLOUD",sbook.glossCloud().dom);
	 if (sbook.cloud_queue) {
	     fdjtLog("Starting to sync gloss cloud");
	     fdjtTime.slowmap(
		 sbook.addTag2UI,sbook.cloud_queue,
		 function(){
		     sbook.cloud_queue=false;
		     fdjtLog("Gloss cloud synced");});}
	 if (sbook.search_cloud_queue) {
	     fdjtLog("Starting to sync search cloud");
	     fdjtTime.slowmap(
		 sbook.addTag2UI,sbook.search_cloud_queue,
		 function(){
		     sbook.search_cloud_queue=false;
		     fdjtLog("Search cloud synced");});}
	 
	 if (sbook.knodule) {
	     fdjtLog("starting to integrate knodule");
	     fdjtTime.slowmap(
		 sbook.addTag2UI,sbook.knodule.alldterms,
		 function(){fdjtLog("Knodule integrated");});}
	 sbook.sizeCloud(sbook.full_cloud);
	 sbook.sizeCloud(sbook.gloss_cloud);}
	 
     /* Clearing offline data */

     function clearOffline(refuri){
	 if (refuri) {
	     var glosses=
		 fdjtState.getLocal("sbook.glosses("+refuri+")",true);
	     var i=0; var lim=glosses.length;
	     while (i<lim) fdjtState.dropLocal(glosses[i++]);
	     fdjtState.dropLocal("sbook.sources("+refuri+")");
	     fdjtState.dropLocal("sbook.outlets("+refuri+")");
	     fdjtState.dropLocal("sbook.etc("+refuri+")");
	     fdjtState.dropLocal("sbook.offline("+refuri+")");
	     var refuris=fdjtState.getLocal("sbook.refuris",true);
	     refuris=fdjtKB.remove(refuris,refuri);
	     fdjtState.setLocal("sbook.refuris",refuris,true);}
	 else {
	     var refuris=fdjtState.getLocal("sbook.refuris",true);
	     var i=0; var lim=refuris.length;
	     while (i<lim) clearOffline(refuris[i++]);
	     fdjtState.dropLocal("sbook.refuris");}}
     sbook.clearOffline=clearOffline;

     /* Other setup */
     
     function setupGlossServer(){}

     return Startup;})();
sbookStartup=sbook.Startup;
sbook.Setup=sbook.Startup;

fdjt_versions.decl("codex",codex_startup_version);
fdjt_versions.decl("codex/startup",codex_startup_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
