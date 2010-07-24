/* -*- Mode: Javascript; -*- */

var sbooks_id="$Id$";
var sbooks_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2010 beingmeta, inc.
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

sbook.Setup=
    (function(){

	var sbook_touchmouse=false;

	var sbook_fullpages=[];
	var sbook_heading_qricons=false;
	var sbook_help_on_startup=false;

	/* Initialization */
	
	var _sbook_setup_start=false;
	
	function Setup(){
	    if (sbook._setup) return;
	    if (!(sbook._setup_start)) sbook._setup_start=new Date();
	    // Get various settings
	    getSettings();
	    // Dependent setups
	    fdjtDOM.init();
	    var metadata=false;
	    fdjtTime.timeslice
	    ([// Setup sbook tables, databases, etc
		sbook.initDB,
		// This wraps the body in an div#SBOOKBODY 
		initBody,
		function(){
		    sbook.initHUD(); sbook.syncHUD();},
		function(){sbookMode("help");}, 
		function(){fdjtDOM.adjustToFit(fdjtID("SBOOKHELP"),0.2);},
		function(){fdjtDOM.adjustToFit(fdjtID("SBOOKHELP"),0.2);},
		function(){fdjtDOM.adjustToFit(fdjtID("SBOOKHELP"),0.2);},
		function(){fdjtDOM.adjustToFit(fdjtID("SBOOKHELP"),0.2);},
		function(){fdjtDOM.adjustToFit(fdjtID("SBOOKHELP"),0.2);},
		function(){fdjtDOM.adjustToFit(fdjtID("SBOOKHELP"),0.2);},
		function(){fdjtDOM.adjustToFit(fdjtID("SBOOKHELP"),0.2);},
		function(){
		    if ((sbook.user)||(sbook.nouser))
			sbook.Message("Initializing....");
		    else sbook.Message("getting user information");}, 10,
		function(){
		    if (sbook.user)
			fdjtDOM.swapClass(document.body,"nosbookuser","sbookuser");
		    else if (sbook.nouser) {
			fdjtDOM.addClass(document.body,"nosbookuser");}
		    else getUser();},
		function(){sbook.Message("initializing display");},10,
		function(){
		    sbook.initDisplay(); sbook.displaySync();},
		function(){sbook.Message("scanning document structure");},10,
		function(){
		    metadata=sbookScan(sbook.root);
		    sbook.docinfo=sbook.DocInfo.map=metadata;
		    sbook.ends_at=sbook.docinfo[sbook.root.id].ends_at;},
		function(){sbook.Message("configuring server");},10,
		setupGlossServer,
		function(){sbook.Message("getting glosses");},10,
		getGlosses,
		function(){sbook.Message("Building table of contents");},10,
		function(){
		    sbook.setupTOC(metadata[sbook.root.id]);},
		function(){
		    sbook.Message("Processing knodule ",sbook.knodule);},10,
		((Knodule)&&(Knodule.HTML)&&(Knodule.HTML.Setup)&&
		 (function(){Knodule.HTML.Setup(sbook.knodule);})),
		function(){sbook.Message("Indexing tags");},10,
		function(){
		    sbook.indexTags(metadata);
		    sbook.indexTechnoratiTags(sbook.knodule);},
		initLocation,
		function(){
		    if (sbook.offline)
			fdjtDOM.addListener(document.body,"online",go_online);
		    window.onresize=function(evt){
			// fdjtLog("[%f] Resize event %o",fdjtET(),evt);
			sbookPaginate(sbook.paginate);};
		    if (fdjtID("SBOOKHIDEHELP"))
			fdjtID("SBOOKHIDEHELP").checked=(!(sbook_help_on_startup));
		    applySettings();},
		sbook.setupGestures,
		function(){sbookPaginate(sbook.paginate);},
		function(){sbook.Message("setup completed");},10,
		function(){
		    if (fdjtState.getQuery("action")) {
			sbookMode("sbookapp");}
		    else if (sbook.mode==='help') 
			setTimeout(function(){
			    if (sbook.mode==="help") sbookMode(false);},
				   2500);
		    else {}},
		function(){
		    sbook.displaySync();
		    _sbook_setup=sbook._setup=new Date();}],
	       25,100);}
	sbook.Setup=Setup;

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

	function getSettings(){
	    // Basic stuff
	    var useragent=navigator.userAgent;
	    var refuri=_getsbookrefuri();
	    document.body.refuri=sbook.refuri=refuri;
	    sbook.docuri=_getsbookdocuri();
	    var refuris=fdjtState.getLocal("sbook.refuris",true)||[];
	    var offline=
		((fdjtState.getQuery("offline")!=="no")&&
		 ((fdjtState.getQuery("offline"))||
		  (fdjtState.getLocal("sbook.offline"))||
		  (fdjtState.getLocal("sbook.offline("+refuri+")"))||
		  (fdjtDOM.getMeta("SBOOKMYCOPY"))||
		  ((refuris)&&(fdjtKB.contains(refuri,refuris)))||
		  ((fdjtDOM.getMeta("SBOOKOFFLINE"))&&
		   (window.confirm)&&(window.confirm("Read offline?")))));
	    sbook.offline=((offline)?(true):(false));
	    // Get the settings for scanning the document structure
	    getScanSettings();
	    // Get the settings for automatic pagination
	    getPageSettings();
	    sbook.max_excerpt=fdjtDOM.getMeta("SBOOKMAXEXCERPT")||
		(sbook.max_excerpt);
	    sbook.min_excerpt=fdjtDOM.getMeta("SBOOKMINEXCERPT")||
		(sbook.min_excerpt);
	    var sbooksrv=fdjtDOM.getMeta("SBOOKSERVER");
	    if (sbooksrv) sbook.server=sbooksrv;
	    else if (fdjtState.getCookie["SBOOKSERVER"])
		sbook.server=fdjtState.getCookie["SBOOKSERVER"];
	    else sbook.server=lookupServer(document.domain);
	    if (!(sbook.server)) sbook.server=sbook.default_server;
	    sbook_ajax_uri=fdjtDOM.getMeta("SBOOKSAJAX",true);
	    sbook.mycopyid=fdjtDOM.getMeta("SBOOKMYCOPY")||
		((offline)&&(fdjtState.getLocal("mycopyid("+refuri+")")))||false;
	    sbook.syncstamp=fdjtState.getLocal("syncstamp("+refuri+")");
	    
	    if ((offline)&&(!(fdjtState.getLocal("sbook.offline("+refuri+")")))) {
		fdjtState.setLocal("sbook.offline("+refuri+")",true,true);
		refuris.push(refuri);
		fdjtState.setLocal("sbook.refuris",refuris,true);}
	    
	    if ((useragent.search("Safari/")>0)&&
		 (useragent.search("Mobile/")>0)) { 
		hide_mobile_safari_address_bar();
		// Have fdjtLog do it's own format conversion for the log
		fdjtLog.doformat=true;
		fdjtDOM.addClass(document.body,"touch");
		sbook.floathud=true; sbook.mobilesafari=true;
		sbook.ui="ios";}
	    else if (sbook_touchmouse) {
		fdjtDOM.addClass(document.body,"touch");
		sbook.floathud=true; sbook.mobilesafari=true;
		sbook.ui="touchmouse"}
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

	function hide_mobile_safari_address_bar(){
	    window.scrollTo(0,1);
	    setTimeout(function(){window.scrollTo(0,0);},0);}

	/* Getting settings */

	function _getsbookrefuri(){
	    // Explicit REFURI is just returned
	    var refuri=fdjtDOM.getLink("REFURI",false,true)||
		fdjtDOM.getMeta("REFURI",false,true);
	    if (refuri) return refuri;
	    // No explicit value, try to figure one out
	    // First, try the CANONICAL link
	    refuri=fdjtDOM.getLink("canonical",false,true);
	    // Otherwise, use the document location
	    if (!(refuri)) {
		var locref=document.location.href;
		var qstart=locref.indexOf('?');
		if (qstart>=0) locref=locref.slice(0,qstart);
		refuri=locref;}
	    return refuri;}
	function _getsbookdocuri(){
	    var docuri=fdjtDOM.getLink("DOCURI",true)||
		fdjtDOM.getMeta("DOCURI",true)||
		fdjtDOM.getMeta("SBOOKSRC",true);
	    if (docuri) return docuri;
	    else return _getsbookrefuri();}

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

	function getScanSettings(){
	    if (!(sbook.root))
		if (fdjtDOM.getMeta("SBOOKROOT"))
		    sbook.root=fdjtID(fdjtDOM.getMeta("SBOOKROOT"));
	    else sbook.root=fdjtID("SBOOKBODY")||document.body;
	    if (!(sbook.start))
		if (fdjtDOM.getMeta("SBOOKSTART"))
		    sbook.start=fdjtID(fdjtDOM.getMeta("SBOOKSTART"));
	    else if (fdjtID("SBOOKSTART"))
		sbook.start=fdjtID("SBOOKSTART");
	    else {
		var titlepage=fdjtID("SBOOKTITLE")||fdjtID("TITLEPAGE");
		while (titlepage)
		    if (fdjtDOM.nextElt(titlepage)) {
			sbook.start=fdjtDOM.nextElt(titlepage); break;}
		else titlepage=titlepage.parentNode;}
	    var i=1; while (i<9) {
		var rules=fdjtDOM.getMeta("SBOOKHEAD"+i,true);
		if ((rules)&&(rules.length)) {
		    var j=0; var lim=rules.length;
		    var elements=fdjtDOM.getChildren(rules[j++]);
		    var k=0; var n=elements.length;
		    while (k<n) elements[k++].toclevel=i;}
		i++;}
	    if (fdjtDOM.getMeta("SBOOKIGNORED")) 
		sbook.ignored=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKIGNORED"));
	    if (fdjtDOM.getMeta("SBOOKNOTAG"))
		sbook.terminal_rules=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKNOTAG"));
	    if (fdjtDOM.getMeta("SBOOKTERMINALS"))
		sbook.terminal_rules=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKTERMINALS"));
	    if (fdjtDOM.getMeta("SBOOKIDIFY")) 
		sbook_idify=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKIDIFY"));
	    if (fdjtDOM.getMeta("SBOOKFOCI"))
		sbook.focusrules=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKFOCI"));}

	function getPageSettings(){
	    var tocmajor=fdjtDOM.getMeta("SBOOKTOCMAJOR",true);
	    if (tocmajor) sbook_tocmajor=parseInt(tocmajor);
	    var sbook_fullpage_rules=fdjtDOM.getMeta("SBOOKFULLPAGE",true);
	    if (sbook_fullpage_rules) {
		var i=0; while (i<sbook_fullpage_rules.length) {
		    sbook_fullpages.push(fdjtDOM.Selector(sbook_fullpage_rules[i++]));}}
	    sbook_fullpages.push(fdjtDOM.Selector(".sbookfullpage, .titlepage"));}

	function initBody(){
	  var sbody=
	    ((fdjtDOM.getMeta("SBOOKBODY"))?
	     ((fdjtID(fdjtDOM.getMeta("SBOOKBODY")))||(document.body)):
	     (fdjtID("SBOOKBODY")));
	  if (!(sbody)) {
	    sbody=fdjtDOM("div#SBOOKBODY");
	    var nodes=fdjtDOM.toArray(document.body.childNodes);
	    var i=0; var lim=nodes.length;
	    while (i<lim) sbody.appendChild(nodes[i++]);
	    document.body.appendChild(sbody);}
	  sbook.body=sbody;}

	/* Changing settings */

	function applySettings(){
	  // This applies the current session settings
	  var tocmax=fdjtDOM.getMeta("SBOOKTOCMAX");
	  if (tocmax) sbook_tocmax=parseInt(tocmax);
	  var sbookhelp=fdjtDOM.getMeta("SBOOKHELP");
	  if (sbookhelp) sbook_help_on_startup=true;
	  sbookPaginate(sbook.paginate);}

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
	    setopt("flashy",fdjtID("SBOOKHUDFLASH").checked);
	    // setopt("rich",fdjtID("SBOOKHUDRICH").checked);
	    fdjtSetSession("sbookopts",sessionsettings);
	    applySettings();}

	function saveSettings(){
	    var opts=fdjtGetSession("sbookopts");
	    if (opts) {
		fdjtState.setLocal("sbookopts",opts);}}
	sbook.saveSettings=saveSettings;

	function getUser() {
	  var refuri=sbook.refuri;
	  if (sbook.user) return;
	  else if ((sbook.offline)&&
		   (fdjtState.getLocal("sbook.user"))&&
		   (fdjtState.getLocal("sbook.nodeid("+refuri+")"))) {
	    var refuri=sbook.refuri;
	    var user=fdjtState.getLocal("sbook.user");
	    if (sbook.trace.startup)
	      fdjtLog("[%f] Restoring offline user info for %o reading %o",
		      fdjtET(),user,refuri);
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
	      "https://"+sbook.server+"/v3/user.js";
	    document.body.appendChild(user_script);
	    fdjtDOM.addClass(document.body,"nosbookuser");}
	  else fdjtDOM.addClass(document.body,"nosbookuser");}
	
	function setUser(userinfo,nodeid,sources,outlets,etc,sync){
	  var persist=((sbook.offline)&&(navigator.onLine));
	  var refuri=sbook.refuri;
	  if (sbook.user)
	    if (userinfo.oid===sbook.user.oid) {}
	    else throw { error: "Can't change user"};
	  sbook.user=fdjtKB.Import(userinfo);
	  if (persist) {
	    fdjtState.setLocal(sbook.user.oid,sbook.user,true);
	    fdjtState.setLocal("sbook.nodeid("+sbook.refuri+")",nodeid);
	    fdjtState.setLocal("sbook.user",sbook.user.oid);}
	  gotInfo("sources",sources,persist);
	  gotInfo("outlets",outlets,persist);
	  gotInfo("etc",etc,persist);
	  if (sync) {
	    sbook.usersync=sync;
	    if (persist) fdjtState.setLocal("sbook.usersync",sync);}
	  if (!(sbook.nodeid)) {
	    sbook.nodeid=nodeid;
	    if ((nodeid)&&(persist))
	      fdjtState.setLocal("sbook.nodeid("+refuri+")",nodeid);}
	  setupUser();}
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
	    if (sbook.user.pic) {
		if (fdjtID("SBOOKMARKIMAGE"))
		    fdjtID("SBOOKMARKIMAGE").src=sbook.user.pic;
		if (fdjtID("SBOOKUSERPIC"))
		    fdjtID("SBOOKUSERPIC").src=sbook.user.pic;}
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
		    idlink.href='https://www.sbooks.net/admin/id.fdcgi';}}
	    sbook._user_setup=true;}

	function getGlosses() {
	    if (sbook.syncstamp) {
	      // fdjtLog("[%f] Restoring glosses from local storage",fdjtET());
	      var glosses=
		fdjtState.getLocal("glosses("+sbook.refuri+")",true)||[];
	      var glossdb=sbook.glosses;
	      if (glosses) {
		sbook.allglosses=glosses;
		var i=0; var lim=glosses.length;
		while (i<lim) glossdb.load(glosses[i++]);}
	      else sbook.allglosses=[];
	      // fdjtLog("[%f] Restored glosses from local storage",fdjtET());
	    }
	    if (navigator.onLine) {
		var glosses_script=fdjtDOM("SCRIPT#SBOOKGETGLOSSES");
		glosses_script.language="javascript";
		glosses_script.src="https://"+sbook.server+
		    "/v3/glosses.js?CALLBACK=sbook.Setup.initGlosses&REFURI="+
		    encodeURIComponent(sbook.refuri);
		if (sbook.syncstamp)
		    glosses_script.src=glosses_script.src+"&SYNCSTAMP="+sbook.syncstamp;
		document.body.appendChild(glosses_script);}}

	function go_online(evt){
	    sbookMark.sync();
	    var uri="https://"+sbook.server+
		"/v3/glosses.js?&REFURI="+
		encodeURIComponent(sbook.refuri)+
		"&ORIGIN="+encodeURIComponent(document.location.protocol+"//"+document.location.hostname);
	    if (sbook.syncstamp) uri=uri+"&SYNCSTAMP="+sbook.syncstamp;
	    fdjtAjax.jsonCall(fdjtKB.Import,uri);}
	    
	/* This initializes the sbook state to the initial location with the
	   document, using the hash value if there is one. */ 
	function initLocation() {
	    var hash=window.location.hash; var target=sbook.root;
	    if ((typeof hash === "string") && (hash.length>0)) {
		if ((hash[0]==='#') && (hash.length>1))
		    target=document.getElementById(hash.slice(1));
		else target=document.getElementById(hash);
		if (sbook.Trace.startup>1)
		    fdjtLog("[%f] sbookInitLocation hash=%s=%o",
			    fdjtET(),hash,target);}
	    else if (fdjtState.getCookie("sbooktarget")) {
		var targetid=fdjtState.getCookie("sbooktarget");
		if (sbook.Trace.startup>1)
		    fdjtLog("[%f] sbookInitLocation cookie=#%s=%o",
			    fdjtET(),targetid,target);
		if ((targetid)&&(fdjtID(targetid)))
		    target=fdjtID(targetid);
		else target=sbook.root;}
	    else target=sbook.root;
	    if (sbook.Trace.startup>1)
		fdjtLog("[%f] sbookInitLocation target=%o",fdjtET(),target);
	    sbook.target=target;
	    sbook.setHead(target||sbook.start||sbook.root);
	    if (sbook.paginate) {
		if (sbook.pages) sbook.GoTo(target);}
	    else sbook.GoTo(target);}
	
	function initGlosses(glosses){
	    var allglosses=sbook.allglosses;
	    if (sbook.Trace.startup)
	      fdjtLog("[%f] Assimilating %d glosses",fdjtET(),glosses.length);
	    sbook.Message("Assimilating %d glosses...",glosses.length);
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
	    sbook.Message("Setting up search cloud...");
	    fdjtDOM.replace("SBOOKSEARCHCLOUD",sbook.FullCloud().dom);
	    sbook.FullCloud().complete('');
	    sbook.Message("Setting up glossing cloud...");
	    fdjtDOM.replace("SBOOKMARKCLOUD",sbookMark.getCloud().dom);
	    sbookMark.getCloud().complete('');
	    var done=new Date().getTime();
	    sbook.Message("Completed sbook setup"," in ",
			  ((done-sbook._setup_start.getTime())/1000),
			  " seconds");
	    splash();}
	sbook.Setup.initGlosses=initGlosses;

	/* Clearing offline data */

	function clearOffline(refuri){
	    if (refuri) {
		var glosses=fdjtState.getLocal("sbook.glosses("+refuri+")",true);
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

	/* Other setup */
	
	function setupGlossServer(){}

	/* The Help Splash */
	function splash(){
	    if ((document.location.search)&&
		(document.location.search.length>0))
		sbookMode("sbookapp");
	    else {
		var cookie=fdjtState.getCookie("sbookhidehelp");
		if (cookie==='no') sbookMode("help");
		else if (cookie) {}
		else if (sbook_help_on_startup) sbookMode("help");
		else if (!(sbook.mode)) {}
		else if (sbook.mode!=="console") {}
		else sbookMode(false);}}

	return Setup;})();
sbookSetup=sbook.Setup;

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
