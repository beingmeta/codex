/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

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

var Codex=
    {mode: false,hudup: false,scrolling: false,query: false,
     head: false,target: false,glosstarget: false,location: false,
     user: false,root: false,start: false,HUD: false,dosync: true,
     _setup: false,_user_setup: false,_gloss_setup: false,_social_setup: false,
     // Keeping track of paginated context
     curpage: false,curoff: false,curinfo: false, curbottom: false,
     // For tracking UI state
     last_mode: false, last_flyleaf: "about",
     // How long it takes a gesture to go from tap to hold
     holdmsecs: 500, edgeclick: 50, pagesize: 250,
     animate: {pages:true,hud: true}, // colbreak: true,
     updatehash: true,
     // This is the base URI for this document, also known as the REFURI
     // A document (for instance an anthology or collection) may include
     // several refuri's, but this is the default.
     refuri: false,
     // These are the refuris used in this document
     refuris: [],
     // This is the document URI, which is usually the same as the REFURI.
     docuri: false,
     // This is the unique signed DOC+USER identifier used by myCopy
     // social DRM
     mycopyid: false, 
     // This is the time of the last update
     syncstamp: false,
     // Whether to use native scrolling for body content
     nativescroll: false,
     // Whether to use native scrolling for embedded DIVs
     scrolldivs: true,
     // Dominant interaction mode
     mouse: true,touch: false,kbd: false,
     // Restrictions on excerpts
     min_excerpt: 3, max_excerpt: false,
     focusrules: false,
     UI: {handlers: {mouse: {}, kbd: {}, ios: {}}},
     Debug: {},
     Trace: {
	 startup: 1,	// Whether to debug startup
	 config: false,  // Whether to trace config setup/modification/etc
	 mode: false,	// Whether to trace mode changes
	 nav: false,	// Whether to trace book navigation
	 scan: false,	// Whether to trace DOM scanning
	 search: 0,	// How much to trace searches
	 clouds: 0,	// How much to trace cloud generation
	 focus: false,	// Whether to trace target changes
	 toc: false,	// Whether we're debugging TOC tracking
	 network: 0,	// How much to trace server interaction
	 glosses: false,// Whether we're tracing gloss processing
	 layout: 0,	// How much to trace pagination
	 dosync: false, // Whether to trace state saves
	 flips: false,	// Whether to trace page flips (movement by pages)
	 scroll: false,	// Whether to trace scrolling within the HUD
	 gestures: 0}   // How much to trace gestures
    };
var _sbook_setup=false;

var CodexHUD=false;

var sbook_gloss_data=
    ((typeof sbook_gloss_data === 'undefined')?(false):
     (sbook_gloss_data));

(function(){

    function initDB() {
	if (Codex.Trace.start>1) fdjtLog("Initializing DB");
	var refuri=(Codex.refuri||document.location.href);
	if (refuri.indexOf('#')>0) refuri=refuri.slice(0,refuri.indexOf('#'));
	var docinfo=Codex.DocInfo=new fdjtKB.Pool(refuri+"#");
	fdjtKB.addRefMap(docinfo.map);
	fdjtKB.addRefMap(function(ref){
	    return ((typeof ref === 'string')&&(ref[0]==='#')&&
		    (docinfo.ref(ref.slice(1))));});
	
	var knodule_name=
	    fdjtDOM.getMeta("codex.knodule")||
	    fdjtDOM.getMeta("KNODULE")||
	    refuri;
	Codex.knodule=new Knodule(knodule_name);
	Codex.index=new KnoduleIndex(Codex.knodule);
	Codex.query=Codex.empty_query=Codex.index.Query([]);
	Codex.BRICO=new Knodule("BRICO");
	Codex.BRICO.addAlias(":@1/");
	Codex.glosses=new fdjtKB.Pool("glosses"); {
	    var superadd=Codex.glosses.add;
	    Codex.glosses.addAlias("glossdb");
	    Codex.glosses.addAlias("-UUIDTYPE=61");
	    Codex.glosses.addAlias(":@31055/");
	    Codex.glosses.xforms['tags']=function(tag){
		if (typeof tag==='string') {
		    var info=
			((tag.indexOf('|')>=0)?
			 (Codex.knodule.handleSubjectEntry(tag)):
			 (fdjtKB.ref(tag)));
		    if (info) return info.tagString(Codex.knodule);
		    else return tag;}
		else return tag.tagString(Codex.knodule);};
	    Codex.glosses.addInit(function(item) {
		var info=Codex.docinfo[item.frag];
		if (!(info))
		    fdjtLog("Gloss refers to nonexistent '%s': %o",
			    item.frag,item);
		if ((info)&&(info.starts_at)) {item.starts_at=info.starts_at;}
		if ((info)&&(info.starts_at)) {item.ends_at=info.ends_at;}
		Codex.index.add(item,item.maker);
		Codex.addTag2UI(item.maker);
		var tags=item.tags;
		if (tags) {
		    if (!(tags instanceof Array)) tags=[tags];
		    if ((tags)&&(tags.length)) {
			var i=0; var lim=tags.length;
			while (i<lim) {
			  var tag=tags[i++]; var score=false;
			  if (tag[0]==='*') {
			    score=tag.search(/[^*]/);
			    tag=tag.slice(score);}
			  var knode=fdjtKB.ref(tag)||tag;
			  if (info.glosstags)
			    info.glosstags.push(knode);
			  else info.glosstags=[knode];
			  Codex.index.add(item,knode);
			  Codex.addTag2UI(knode,true);}}}
		var sources=item.sources;
		if (sources) {
		    if (typeof sources !== 'array') sources=[sources];
		    if ((sources)&&(sources.length)) {
			var i=0; var lim=sources.length;
			while (i<lim) {
			    var source=sources[i++];
			    Codex.index.add(item,source);
			    Codex.UI.addGlossSource(fdjtKB.ref(source),true);}}}});
	    Codex.glosses.index=new fdjtKB.Index();
	    if (Codex.offline)
		Codex.glosses.storage=new fdjtKB.OfflineKB(Codex.glosses);}
	Codex.sourcekb=new fdjtKB.Pool("sources");{
	    Codex.sourcekb.addAlias("@1961/");
	    Codex.sourcekb.index=new fdjtKB.Index();
	    if (Codex.offline)
		Codex.sourcekb.storage=new fdjtKB.OfflineKB(Codex.sourcekb);}
	if (Codex.Trace.start>1) fdjtLog("Initialized DB");}
    Codex.initDB=initDB;

    var trace1="%s %o in %o: mode%s=%o, target=%o, head=%o scanning=%o";
    var trace2="%s %o: mode%s=%o, target=%o, head=%o scanning=%o";
    function sbook_trace(handler,cxt){
	var target=((cxt.nodeType)?(cxt):(fdjtUI.T(cxt)));
	if (target)
	    fdjtLog(trace1,handler,cxt,target,
		    ((Codex.scanning)?("(scanning)"):""),Codex.mode,
		    Codex.target,Codex.head,Codex.scanning);
	else fdjtLog(trace2,handler,cxt,
		     ((Codex.scanning)?("(scanning)"):""),Codex.mode,
		     Codex.target,Codex.head,Codex.scanning);}
    Codex.trace=sbook_trace;

    // This is the hostname for the sbookserver.
    Codex.server=false;
    // Whether this sbook is set up for offline reading
    Codex.offline=false;
    // This is an array for looking up sbook servers.
    Codex.servers=[[/.sbooks.net$/g,"gloss.sbooks.net"]];
    //Codex.servers=[];
    // This is the default server
    Codex.default_server="gloss.sbooks.net";
    // There be icons here!
    function sbicon(name,suffix) {return Codex.graphics+name+(suffix||"");}
    function cxicon(name,suffix) {
	return Codex.graphics+"codex/"+name+(suffix||"");}
    Codex.graphics="http://static.beingmeta.com/graphics/";
    // Codex.graphics="https://www.sbooks.net/static/graphics/";
    // Codex.graphics="https://beingmeta.s3.amazonaws.com/static/graphics/";

    Codex.getRefURI=function(target){
	var scan=target;
	while (scan)
	    if (scan.refuri) return scan.refuri;
	else scan=scan.parentNode;
	return Codex.refuri;}

    Codex.getDocURI=function(target){
	var scan=target;
	while (scan) {
	    var docuri=
		(((scan.getAttributeNS)&&
		  (scan.getAttributeNS("docuri","http://sbooks.net/")))||
		 ((scan.getAttribute)&&(scan.getAttribute("docuri")))||
		 ((scan.getAttribute)&&(scan.getAttribute("data-docuri"))));
	    if (docuri) return docuri;
	    else scan=scan.parentNode;}
	return Codex.docuri;}

    Codex.getRefID=function(target){
	if (target.getAttributeNS)
	    return (target.getAttributeNS('sbookid','http://sbooks.net/'))||
	    (target.getAttributeNS('sbookid'))||
	    (target.getAttributeNS('data-sbookid'))||
	    (target.id);
	else return target.id;};

    function getHead(target){
	/* First, find some relevant docinfo */
	if ((target.id)&&(Codex.docinfo[target.id]))
	    target=Codex.docinfo[target.id];
	else if (target.id) {
	    while (target)
		if ((target.id)&&(Codex.docinfo[target.id])) {
		    target=Codex.docinfo[target.id]; break;}
	    else target=target.parentNode;}
	else {
	    /* First, try scanning forward to find a non-empty node */
	    var scan=target.firstChild; var next=target.nextNode;
	    while ((scan)&&(scan!=next)) {
		if (scan.id) break;
		if ((scan.nodeType===3)&&(!(fdjtString.isEmpty(scan.nodeValue)))) break;
		scan=fdjtDOM.forward(scan);}
	    /* If you found something, use it */
	    if ((scan)&&(scan.id)&&(scan!=next))
		target=Codex.docinfo[scan.id];
	    else {
		while (target)
		    if ((target.id)&&(Codex.docinfo[target.id])) {
			target=Codex.docinfo[target.id]; break;}
		else target=target.parentNode;}}
	if (target)
	    if (target.level)
		return target.elt||document.getElementById(target.frag);
	else if (target.head)
	    return target.head.elt||
	    document.getElementById(target.head.frag);
	else return false;
	else return false;}
    Codex.getHead=getHead;

    Codex.getRef=function(target){
	while (target)
	    if (target.about) break;
	else if ((target.getAttribute)&&(target.getAttribute("about"))) break;
	else target=target.parentNode;
	if (target) {
	    var ref=((target.about)||(target.getAttribute("about")));
	    if (!(target.about)) target.about=ref;
	    if (ref[0]==='#')
		return document.getElementById(ref.slice(1));
	    else return document.getElementById(ref);}
	else return false;}
    Codex.getRefElt=function(target){
	while (target)
	    if ((target.about)||
		((target.getAttribute)&&(target.getAttribute("about"))))
		break;
	else target=target.parentNode;
	return target||false;}

    Codex.checkTarget=function(){
	if ((Codex.target)&&(Codex.mode==='glosses'))
	    if (!(fdjtDOM.isVisible(Codex.target))) {
		CodexMode(false); CodexMode(true);}};

    function getTarget(scan,closest){
	scan=scan.target||scan.srcElement||scan;
	var target=false;
	while (scan) {
	    if (scan.sbookui)
		return false;
	    else if (scan===Codex.root) return target;
	    else if (scan.id) {
		if (fdjtDOM.hasParent(scan,CodexHUD)) return false;
		else if (fdjtDOM.hasParent(scan,".sbookmargin")) return false;
		else if ((fdjtDOM.hasClass(scan,"sbooknofocus"))||
			 ((Codex.nofocus)&&(Codex.nofocus.match(scan))))
		    scan=scan.parentNode;
		else if ((fdjtDOM.hasClass(scan,"sbookfocus"))||
			 ((Codex.focus)&&(Codex.focus.match(scan))))
		    return scan;
		else if (!(fdjtDOM.hasText(scan)))
		    scan=scan.parentNode;
		else if (closest) return scan;
		else if (target) scan=scan.parentNode;
		else {target=scan; scan=scan.parentNode;}}
	    else scan=scan.parentNode;}
	return target;}
    Codex.getTarget=getTarget;
    
    Codex.getTitle=function(target,tryhard) {
	return target.sbooktitle||
	    (((target.id)&&(Codex.docinfo[target.id]))?
	     (Codex.docinfo[target.id].title):
	     (target.title))||
	    ((tryhard)&&
	     (fdjtDOM.textify(target)).
	     replace(/\n\n+/g,"\n").
	     replace(/^\n+/,"").
	     replace(/\n+$/,"").
	     replace(/\n+/g," // "));};

    function getinfo(arg){
	if (arg)
	    if (typeof arg === 'string')
		return Codex.docinfo[arg]||fdjtKB.ref(arg);
	else if (arg._id) return arg;
	else if (arg.id) return Codex.docinfo[arg.id];
	else return false;
	else return false;}
    Codex.Info=getinfo;

    /* Navigation functions */

    function setHead(head){
	if (head===null) head=Codex.root;
	else if (typeof head === "string") 
	    head=getHead(fdjtID(head));
	else head=getHead(head)||Codex.root;
	var headinfo=Codex.docinfo[head.id];
	if (!(head)) return;
	else if (head===Codex.head) {
	    if (Codex.Trace.focus) fdjtLog("Redundant SetHead");
	    return;}
	else if (head) {
	    if (Codex.Trace.focus) Codex.trace("Codex.setHead",head);
	    CodexTOC.update("CODEXTOC4",headinfo,Codex.Info(Codex.head));
	    CodexTOC.update("CODEXFLYTOC4",headinfo,Codex.Info(Codex.head));
	    window.title=headinfo.title+" ("+document.title+")";
	    if (Codex.head) fdjtDOM.dropClass(Codex.head,"sbookhead");
	    fdjtDOM.addClass(head,"sbookhead");
	    Codex.setLocation(Codex.location);
	    Codex.head=fdjtID(head.id);}
	else {
	    if (Codex.Trace.focus) Codex.trace("Codex.setHead",head);
	    CodexTOC.update(head,"CODEXTOC4");
	    CodexTOC.update(head,"CODEXFLYTOC4");
	    Codex.head=false;}}
    Codex.setHead=setHead;

    function setLocation(location,force){
	if ((!(force)) && (Codex.location===location)) return;
	if (Codex.Trace.toc)
	    fdjtLog("Setting location to %o",location);
	var info=Codex.Info(Codex.head);
	while (info) {
	    var tocelt=document.getElementById("CODEXTOC4"+info.frag);
	    var flytocelt=document.getElementById("CODEXFLYTOC4"+info.frag);
	    var start=tocelt.sbook_start; var end=tocelt.sbook_end;
	    var progress=((location-start)*100)/(end-start);
	    var bar=fdjtDOM.getFirstChild(tocelt,".progressbar");
	    var appbar=fdjtDOM.getFirstChild(flytocelt,".progressbar");
	    tocelt.title=flytocelt.title=Math.round(progress)+"%";
	    if (Codex.Trace.toc)
		fdjtLog("For tocbar %o loc=%o start=%o end=%o progress=%o",
			bar,location,start,end,progress);
	    if ((bar)&& (progress>=0) && (progress<=100)) {
		// bar.style.width=((progress)+10)+"%";
		// appbar.style.width=((progress)+10)+"%";
		bar.style.width=(progress)+"%";
		appbar.style.width=(progress)+"%";
	    }
	    info=info.head;}
	var spanbars=fdjtDOM.$(".spanbar");
	var i=0; while (i<spanbars.length) {
	    var spanbar=spanbars[i++];
	    var width=spanbar.ends-spanbar.starts;
	    var ratio=(location-spanbar.starts)/width;
	    if (Codex.Trace.toc)
		fdjtLog("ratio for spanbar %o[%d] is %o [%o,%o,%o]",
			spanbar,spanbar.childNodes[0].childNodes.length,
			ratio,spanbar.starts,location,spanbar.ends);
	    if ((ratio>=0) && (ratio<=1)) {
		var progressbox=fdjtDOM.$(".progressbox",spanbar);
		if (progressbox.length>0) {
		    progressbox[0].style.left=((Math.round(ratio*10000))/100)+"%";}}}
	Codex.location=location;}
    Codex.setLocation=setLocation;

    function setTarget(target,nogo,nosave){
	if (Codex.Trace.focus) Codex.trace("Codex.setTarget",target);
	if (target===Codex.target) return;
	else if ((!target)&&(Codex.target)) {
	    fdjtDOM.dropClass(Codex.target,"sbooktarget");
	    Codex.target=false;
	    return;}
	else if (!(target)) return;
	else if ((inUI(target))||(!(target.id))) return;
	else if ((target===Codex.root)||(target===Codex.body)||
		 (target===document.body)) {
	    if (!(nogo)) Codex.GoTo(target,true);
	    return;}
	if (Codex.target) {
	    fdjtDOM.dropClass(Codex.target,"sbooktarget");
	    Codex.target=false;}
	fdjtDOM.addClass(target,"sbooktarget");
	fdjtState.setCookie("sbooktarget",target.id);
	Codex.target=target;
	if (Codex.full_cloud)
	    Codex.setCloudCuesFromTarget(Codex.full_cloud,target);
	if (!(nosave))
	    setState({target: target.id,
		      location: Codex.location,
		      page: Codex.curpage});
 	if (!(nogo)) Codex.GoTo(target,true);}
    Codex.setTarget=setTarget;

    /* Navigation */

    function resizeBody(){
	if (Codex.nativescroll) {}
	else {
	    var curx=x_offset-fdjtDOM.parsePX(Codex.pages.style.left);
	    var cury=y_offset-fdjtDOM.parsePX(Codex.pages.style.top);
	    // Codex.body.style.left=''; Codex.body.style.top='';
	    var geom=fdjtDOM.getGeometry(Codex.body,Codex.body);
	    x_offset=geom.left; y_offset=geom.top;
	    Codex.bodyoff=[x_offset,y_offset];
	    Codex.pages.style.left='0px';
	    Codex.pages.style.top=(y_offset)+'px';}}
    Codex.resizeBody=resizeBody;

    Codex.viewTop=function(){
	if (Codex.nativescroll) return fdjtDOM.viewTop();
	else return -(fdjtDOM.parsePX(Codex.pages.style.top));}
    var sbookUIclasses=
	/(\bhud\b)|(\bglossmark\b)|(\bleading\b)|(\bsbookmargin\b)/;

    function inUI(elt){
	if (elt.sbookui) return true;
	else if (fdjtDOM.hasParent(elt,CodexHUD)) return true;
	else while (elt)
	    if (elt.sbookui) return true;
	else if (fdjtDOM.hasClass(elt,sbookUIclasses)) return true;
	else elt=elt.parentNode;
	return false;}

    function displayOffset(){
	var toc;
	if (Codex.mode)
	    if (toc=fdjtID("CODEXTOC"))
		return -((toc.offsetHeight||50)+15);
	else return -60;
	else return -40;}

    function setHashID(target){
	if ((!(target.id))||(window.location.hash===target.id)||
	    ((window.location.hash[0]==='#')&&
	     (window.location.hash.slice(1)===target.id)))
	    return;
	if ((target===Codex.body)||(target===document.body)) return;
	window.location.hash=target.id;}
    Codex.setHashID=setHashID;

    var syncing=false;
    
    function setState(state){
	if ((Codex.state===state)||
	    ((Codex.state)&&
	     (Codex.state.target===state.target)&&
	     (Codex.state.location===state.location)&&
	     (Codex.state.page===state.page)))
	    return;
	if (syncing) return;
	if (!(Codex.dosync)) return;
	if (!(state.tstamp)) state.tstamp=fdjtTime.tick();
	if (!(state.refuri)) state.refuri=Codex.refuri;
	Codex.state=state;
	var statestring=JSON.stringify(state);
	var uri=Codex.docuri||Codex.refuri;
	fdjtState.setLocal("codex.state("+uri+")",statestring);}
    Codex.setState=setState;
	    
    function serverSync(){
	if ((Codex.user)&&(Codex.dosync)&&(navigator.onLine)) {
	    var state=Codex.state; var synced=Codex.syncstate;
	    // Warning when syncing doesn't return?
	    if (syncing) return;
	    if (!(state)) {
		var uri=Codex.docuri||Codex.refuri;
		var statestring=fdjtState.getLocal("codex.state("+uri+")");
		if (statestring) Codex.state=state=JSON.parse(statestring);
		else state={};}
	    if ((synced)&&
		(synced.target===state.target)&&
		(synced.location===state.location)&&
		(synced.page===state.page))
		return;
	    var refuri=((Codex.target)&&(Codex.getRefURI(Codex.target)))||
		(Codex.refuri);
	    var uri="https://"+Codex.server+"/glosses/sync?ACTION=save"+
		"&DOCURI="+encodeURIComponent(Codex.docuri)+
		"&REFURI="+encodeURIComponent(refuri);
	    if (Codex.deviceId)
		uri=uri+"&deviceid="+encodeURIComponent(Codex.deviceId);
	    if (Codex.deviceName)
		uri=uri+"&devicename="+encodeURIComponent(Codex.deviceName);
	    if (state.target) uri=uri+"&target="+encodeURIComponent(state.target);
	    if ((state.location)||(state.hasOwnProperty('location')))
		uri=uri+"&location="+encodeURIComponent(state.location);
	    if (Codex.ends_at) uri=uri+"&maxloc="+encodeURIComponent(Codex.ends_at);
	    if ((state.page)||(state.hasOwnProperty('page')))
		uri=uri+"&page="+encodeURIComponent(state.page);
	    if (typeof Codex.pagecount === 'number')
		uri=uri+"&maxpage="+encodeURIComponent(Codex.pagecount);
	    if (Codex.Trace.dosync)
		fdjtLog("syncPosition(call) %s: %o",uri,state);
	    var req=new XMLHttpRequest();
	    syncing=state;
	    req.onreadystatechange=function(evt){
		if ((req.readyState===4)&&(req.status>=200)&&(req.status<300)) {
		    Codex.syncstate=syncing;
		    syncing=false;}
		if (Codex.Trace.dosync)
		    fdjtLog("serverSync(callback) ready=%o status=%o %o",
			    req.readyState,req.status,evt);};
	    req.open("GET",uri,true);
	    req.withCredentials='yes';
	    req.send();}}
    Codex.serverSync=serverSync;

    function scrollToElt(elt,cxt){
	if ((elt.getAttribute) &&
	    ((elt.tocleve)|| (elt.getAttribute("toclevel")) ||
	     ((elt.sbookinfo) && (elt.sbookinfo.level))))
	    setHead(elt);
	else if (elt.head)
	    setHead(elt.head);
	if (Codex.paginate)
	    Codex.GoToPage(elt,"scrollTo");
	else if (fdjtDOM.isVisible(elt)) {}
	else if ((!cxt) || (elt===cxt))
	    fdjtUI.scrollIntoView(elt,elt.id,false,true,displayOffset());
	else fdjtUI.scrollIntoView(elt,elt.id,cxt,true,displayOffset());}
    
    function getLocInfo(elt){
	var counter=0; var lim=200;
	var forward=fdjtDOM.forward;
	while ((elt)&&(counter<lim)) {
	    if ((elt.id)&&(Codex.docinfo[elt.id])) break;
	    else {counter++; elt=forward(elt);}}
	if ((elt.id)&&(Codex.docinfo[elt.id])) {
	    var info=Codex.docinfo[elt.id];
	    return {start: info.starts_at,end: info.ends_at,
		    len: info.ends_at-info.starts_at};}
	else return false;}
    Codex.getLocInfo=getLocInfo;

    function resolveLocation(loc){
	var allinfo=Codex.docinfo._allinfo;
	var i=0; var lim=allinfo.length;
	while (i<lim) {
	    if (allinfo[i].starts_at<loc) i++;
	    else break;}
	while (i<lim)  {
	    if (allinfo[i].starts_at>loc) break;
	    else i++;}
	return fdjtID(allinfo[i-1].frag);}
    Codex.resolveLocation=resolveLocation;


    // This moves within the document in a persistent way
    function CodexGoTo(arg,noset,nosave){
	var target; var location;
	if (typeof arg === 'string') {
	    target=document.getElementById(arg);
	    var info=getLocInfo(target);
	    location=info.start;}
	else if (typeof arg === 'number') {
	    location=arg;
	    target=resolveLocation(arg);}
	else if (arg.nodeType) {
	    var info=getLocInfo(arg);
	    if (arg.id) target=arg;
	    else target=getTarget(arg);
	    location=info.start;}
	else {
	    fdjtLog.warn("Bad CodexGoTo %o",arg);
	    return;}
	if (!(target)) return;
	var page=((Codex.paginate)&&
		  (Codex.pagecount)&&
		  (Codex.getPage(target)));
	var info=((target.id)&&(Codex.docinfo[target.id]));
	if (Codex.Trace.nav)
	    fdjtLog("Codex.GoTo() #%o@P%o/L%o %o",
		    target.id,page,((info)&&(info.starts_at)),target);
	if ((target.id)&&(Codex.updatehash))
	  setHashID(target);
	if (info) {
	    if (typeof info.level === 'number')
		setHead(target);
	    else if (info.head) setHead(info.head.frag);}
	setLocation(location);
	if ((!(noset))&&(target.id)&&(!(inUI(target))))
	    setTarget(target,true,nosave||false);
	if (nosave) {}
	else if (noset)
	    Codex.setState({
		target: ((Codex.target)&&(Codex.target.id)),
		location: location,page: page})
	else Codex.setState(
	    {target: (target.id),location: location,page: page});
	if (page) Codex.GoToPage(target,"CodexGoTo",nosave||false);
	Codex.location=location;}
    Codex.GoTo=CodexGoTo;

    function anchorFn(evt){
	var target=fdjtUI.T(evt);
	while (target)
	    if (target.href) break; else target=target.parentNode;
	if ((target)&&(target.href)&&(target.href[0]==='#')) {
	    var elt=document.getElementById(target.href.slice(1));
	    if (elt) {CodexGoTo(elt); fdjtUI.cancel(evt);}}}
    Codex.anchorFn=anchorFn;

    // This jumps and disables the HUD at the same time
    // We try to animate the transition
    function CodexJumpTo(target){
      if (Codex.hudup) CodexMode(false);
      CodexGoTo(target);}
    Codex.JumpTo=CodexJumpTo;

    function getLevel(elt){
	if (elt.toclevel) {
	    if (elt.toclevel==='none')
		return elt.toclevel=false;
	    else return elt.toclevel;}
	var attrval=
	    ((elt.getAttributeNS)&&
	     (elt.getAttributeNS('toclevel','http://sbooks.net')))||
	    (elt.getAttribute('toclevel'))||
	    (elt.getAttribute('data-toclevel'));
	if (attrval) {
	    if (attrval==='none') return false;
	    else return parseInt(attrval);}
	if (elt.className) {
	    var cname=elt.className;
	    var tocloc=cname.search(/sbook\dhead/);
	    if (tocloc>=0) return parseInt(cname.slice(5,6));}
	if (elt.tagName.search(/H\d/)==0)
	    return parseInt(elt.tagName.slice(1,2));
	else return false;}
    Codex.getTOCLevel=getLevel;
    


})();

/* Adding qricons */

/*
  function sbookAddQRIcons(){
  var i=0;
  while (i<Codex.heads.length) {
  var head=Codex.heads[i++];
  var id=head.id;
  var title=(head.sbookinfo)&&sbook_get_titlepath(head.sbookinfo);
  var qrhref="https://"+Codex.server+"/glosses/qricon.png?"+
  "URI="+encodeURIComponent(Codex.docuri||Codex.refuri)+
  ((id)?("&FRAG="+head.id):"")+
  ((title) ? ("&TITLE="+encodeURIComponent(title)) : "");
  var qricon=fdjtDOM.Image(qrhref,".sbookqricon");
  fdjtDOM.prepend(head,qricon);}}
*/

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
