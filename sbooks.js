/* -*- Mode: Javascript; -*- */

var codex_id="$Id$";
var codex_version=parseInt("$Revision$".slice(10,-1));

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

var sbook=
    {mode: false,hudup: false,scrolling: false,query: false,
     head: false,target: false,glosstarget: false,location: false,
     user: false,root: false,start: false,HUD: false,dosync: true,
     _setup: false,_user_setup: false,_gloss_setup: false,_social_setup: false,
     // For pagination
     curpage: false,curoff: false,curinfo: false, curbottom: false,
     // For tracking UI state
     last_mode: false, last_flyleaf: "about",
     // How long it takes a gesture to go from tap to hold
     holdmsecs: 500, edgeclick: 50, pagesize: 250,
     animate: {pages:false,hud: true},
     updatelocation: true,
     // This is the base URI for this document, also known as the REFURI
     // A document (for instance an anthology or collection) may include
     // several refuri's, but this is the default.
     refuri: false,
     // These are the refuris used in this document
     refuris: [],
     // This is the document URI, which is usually the same as the REFURI.
     docuri: false,
     // This is the unique DOC+USER identifier used by myCopy social DRM.
     mycopyid: false, 
     // This is the time of the last update
     syncstamp: false,
     // Various settings
     paginate: true, fastpage: false,
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
     Trace: {
	 startup: 1,	// Whether to debug startup
	 mode: false,	// Whether to trace mode changes
	 nav: false,	// Whether to trace book navigation
	 scan: false,	// Whether to trace DOM scanning
	 search: 0,	// Whether (and level) to trace searches
	 clouds: 0,	// Whether to trace cloud generation
	 focus: false,	// Whether to trace focus/target changes
	 toc: false,	// Whether we're debugging TOC tracking
	 network: 0,	// Whether we're debugging server interaction
	 glosses: false,// Whether we're tracing gloss processing
	 layout: 0,	// Whether to trace pagination
	 dosync: false, // Whether to trace state saves
	 paging: false,	// Whether to trace paging (movement by pages)
	 scroll: false,	// Whether to trace scrolling within the HUD
	 gestures: 0},   // Whether to trace gestures
     version: codex_version, id: codex_id
    };
var _sbook_setup=false;

var CodexHUD=false;

var sbook_gloss_data=
    ((typeof sbook_gloss_data === 'undefined')?(false):
     (sbook_gloss_data));

(function(){

    function initDB() {
	if (sbook.Trace.start>1) fdjtLog("Initializing DB");
	var refuri=(sbook.refuri||document.location.href);
	if (refuri.indexOf('#')>0) refuri=refuri.slice(0,refuri.indexOf('#'));
	var docinfo=sbook.DocInfo=new fdjtKB.Pool(refuri+"#");
	fdjtKB.addRefMap(docinfo.map);
	fdjtKB.addRefMap(function(ref){
	    return ((typeof ref === 'string')&&(ref[0]==='#')&&
		    (docinfo.ref(ref.slice(1))));});
	
	var knodule_name=
	    fdjtDOM.getMeta("sbook.knodule")||
	    fdjtDOM.getMeta("KNODULE")||
	    refuri;
	sbook.knodule=new Knodule(knodule_name);
	sbook.index=new KnoduleIndex(sbook.knodule);
	sbook.query=sbook.empty_query=sbook.index.Query([]);
	sbook.BRICO=new Knodule("BRICO");
	sbook.BRICO.addAlias(":@1/");
	sbook.glosses=new fdjtKB.Pool("glosses"); {
	    var superadd=sbook.glosses.add;
	    sbook.glosses.addAlias("glossdb");
	    sbook.glosses.addAlias("-UUIDTYPE=61");
	    sbook.glosses.addAlias(":@31055/");
	    sbook.glosses.xforms['tags']=function(tag){
		if (typeof tag==='string') {
		    var info=
			((tag.indexOf('|')>=0)?
			 (sbook.knodule.handleSubjectEntry(tag)):
			 (fdjtKB.ref(tag)));
		    if (info) return info.tagString(sbook.knodule);
		    else return tag;}
		else return tag.tagString(sbook.knodule);};
	    sbook.glosses.addInit(function(item) {
		var info=sbook.docinfo[item.frag];
		if (!(info))
		    fdjtLog("Gloss refers to nonexistent '%s': %o",
			    item.frag,item);
		if ((info)&&(info.starts_at)) {item.starts_at=info.starts_at;}
		if ((info)&&(info.starts_at)) {item.ends_at=info.ends_at;}
		sbook.index.add(item,item.user);
		sbook.addTag2UI(item.user);
		var tags=item.tags;
		if (tags) {
		    if (!(tags instanceof Array)) tags=[tags];
		    if ((tags)&&(tags.length)) {
			var i=0; var lim=tags.length;
			while (i<lim) {
			    var tag=tags[i++];
			    sbook.index.add(item,tag);
			    sbook.addTag2UI(fdjtKB.ref(tag),true);}}}
		var outlets=item.audience;
		if (outlets) {
		    if (typeof outlets !== 'array') outlets=[outlets];
		    if ((outlets)&&(outlets.length)) {
			var i=0; var lim=outlets.length;
			while (i<lim) {
			    var audience=outlets[i++];
			    sbook.index.add(item,audience);
			    sbook.UI.addGlossSource(fdjtKB.ref(audience),true);}}}});
	    sbook.glosses.index=new fdjtKB.Index();
	    if (sbook.offline)
		sbook.glosses.storage=new fdjtKB.OfflineKB(sbook.glosses);}
	sbook.sourcekb=new fdjtKB.Pool("sources");{
	    sbook.sourcekb.addAlias("@1961/");
	    sbook.sourcekb.index=new fdjtKB.Index();
	    if (sbook.offline)
		sbook.sourcekb.storage=new fdjtKB.OfflineKB(sbook.sourcekb);}
	if (sbook.Trace.start>1) fdjtLog("Initialized DB");}
    sbook.initDB=initDB;

    var trace1="%s %o in %o: mode%s=%o, target=%o, head=%o scanning=%o";
    var trace2="%s %o: mode%s=%o, target=%o, head=%o scanning=%o";
    function sbook_trace(handler,cxt){
	var target=fdjtUI.T(cxt);
	if (target)
	    fdjtLog(trace1,handler,cxt,target,
		    ((sbook.scanning)?("(scanning)"):""),sbook.mode,
		    sbook.target,sbook.head,sbook.scanning);
	else fdjtLog(trace2,handler,cxt,
		     ((sbook.scanning)?("(scanning)"):""),sbook.mode,
		     sbook.target,sbook.head,sbook.scanning);}
    sbook.trace=sbook_trace;

    // This is the hostname for the sbookserver.
    sbook.server=false;
    // Whether this sbook is set up for offline reading
    sbook.offline=false;
    // This is an array for looking up sbook servers.
    sbook.servers=[[/.sbooks.net$/g,"gloss.sbooks.net"]];
    //sbook.servers=[];
    // This is the default server
    sbook.default_server="gloss.sbooks.net";
    // There be icons here!
    function sbicon(name,suffix) {return sbook.graphics+name+(suffix||"");}
    sbook.graphics="http://static.beingmeta.com/graphics/";
    // sbook.graphics="https://www.sbooks.net/static/graphics/";
    // sbook.graphics="https://beingmeta.s3.amazonaws.com/static/graphics/";

    sbook.getRefURI=function(target){
	var scan=target;
	while (scan)
	    if (scan.refuri) return scan.refuri;
	else scan=scan.parentNode;
	return sbook.refuri;}

    sbook.getDocURI=function(target){
	var scan=target;
	while (scan) {
	    var docuri=
		(((scan.getAttributeNS)&&
		  (scan.getAttributeNS("docuri","http://sbooks.net/")))||
		 ((scan.getAttribute)&&(scan.getAttribute("docuri")))||
		 ((scan.getAttribute)&&(scan.getAttribute("data-docuri"))));
	    if (docuri) return docuri;
	    else scan=scan.parentNode;}
	return sbook.docuri;}

    sbook.getRefID=function(target){
	if (target.getAttributeNS)
	    return (target.getAttributeNS('sbookid','http://sbooks.net/'))||
	    (target.getAttributeNS('sbookid'))||
	    (target.getAttributeNS('data-sbookid'))||
	    (target.id);
	else return target.id;};

    function getHead(target){
	/* First, find some relevant docinfo */
	if ((target.id)&&(sbook.docinfo[target.id]))
	    target=sbook.docinfo[target.id];
	else if (target.id) {
	    while (target)
		if ((target.id)&&(sbook.docinfo[target.id])) {
		    target=sbook.docinfo[target.id]; break;}
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
		target=sbook.docinfo[scan.id];
	    else {
		while (target)
		    if ((target.id)&&(sbook.docinfo[target.id])) {
			target=sbook.docinfo[target.id]; break;}
		else target=target.parentNode;}}
	if (target)
	    if (target.level)
		return target.elt||document.getElementById(target.frag);
	else if (target.head)
	    return target.head.elt||
	    document.getElementById(target.head.frag);
	else return false;
	else return false;}
    sbook.getHead=getHead;

    sbook.getRef=function(target){
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
    sbook.getRefElt=function(target){
	while (target)
	    if ((target.about)||
		((target.getAttribute)&&(target.getAttribute("about"))))
		break;
	else target=target.parentNode;
	return target||false;}

    sbook.checkTarget=function(){
	if ((sbook.target)&&(sbook.mode==='glosses'))
	    if (!(fdjtDOM.isVisible(sbook.target))) {
		CodexMode(false); CodexMode(true);}};

    function getTarget(scan,closest){
	scan=scan.target||scan.srcElement||scan;
	var target=false;
	while (scan) {
	    if (scan.sbookui)
		return false;
	    else if (scan===sbook.root) return target;
	    else if (scan.id) {
		if (fdjtDOM.hasParent(scan,CodexHUD)) return false;
		else if (fdjtDOM.hasParent(scan,".sbookmargin")) return false;
		else if ((fdjtDOM.hasClass(scan,"sbookfoci"))||(!(sbook.foci))||
			 (sbook.foci.match(scan)))
		    return scan;
		else if (closest) return scan;
		else if (target) scan=scan.parentNode;
		else {target=scan; scan=scan.parentNode;}}
	    else scan=scan.parentNode;}
	return target;}
    sbook.getTarget=getTarget;
    
    sbook.getTitle=function(target) {
	return target.sbooktitle||
	    (((target.id)&&(sbook.docinfo[target.id]))?
	     (sbook.docinfo[target.id].title):
	     (target.title));};

    function getinfo(arg){
	if (arg)
	    if (typeof arg === 'string')
		return sbook.docinfo[arg]||fdjtKB.ref(arg);
	else if ((arg.qid)||(arg.oid)) return arg;
	else if (arg.id) return sbook.docinfo[arg.id];
	else return false;
	else return false;}
    sbook.Info=getinfo;

    /* Navigation functions */

    function setHead(head){
	if (head===null) head=sbook.root;
	else if (typeof head === "string") 
	    head=getHead(fdjtID(head));
	else head=getHead(head)||sbook.root;
	var headinfo=sbook.docinfo[head.id];
	if (!(head)) return;
	else if (head===sbook.head) {
	    if (sbook.Trace.focus) fdjtLog("Redundant SetHead");
	    return;}
	else if (head) {
	    if (sbook.Trace.focus) sbook.trace("sbook.setHead",head);
	    CodexTOC.update("CODEXTOC4",headinfo,sbook.Info(sbook.head));
	    CodexTOC.update("CODEXFLYTOC4",headinfo,sbook.Info(sbook.head));
	    window.title=headinfo.title+" ("+document.title+")";
	    if (sbook.head) fdjtDOM.dropClass(sbook.head,"sbookhead");
	    fdjtDOM.addClass(head,"sbookhead");
	    sbook.setLocation(sbook.location);
	    sbook.head=fdjtID(head.id);}
	else {
	    if (sbook.Trace.focus) sbook.trace("sbook.setHead",head);
	    CodexTOCUpdate(head,"CODEXTOC4");
	    CodexTOCUpdate(head,"CODEXFLYTOC4");
	    sbook.head=false;}}
    sbook.setHead=setHead;

    function setLocation(location,force){
	if ((!(force)) && (sbook.location===location)) return;
	if (sbook.Trace.toc)
	    fdjtLog("Setting location to %o",location);
	var info=sbook.Info(sbook.head);
	while (info) {
	    var tocelt=document.getElementById("CODEXTOC4"+info.frag);
	    var flytocelt=document.getElementById("CODEXFLYTOC4"+info.frag);
	    var start=tocelt.sbook_start; var end=tocelt.sbook_end;
	    var progress=((location-start)*80)/(end-start);
	    var bar=fdjtDOM.getFirstChild(tocelt,".progressbar");
	    var appbar=fdjtDOM.getFirstChild(flytocelt,".progressbar");
	    if (sbook.Trace.toc)
		fdjtLog("For tocbar %o loc=%o start=%o end=%o progress=%o",
			bar,location,start,end,progress);
	    if ((bar)&& (progress>0) && (progress<100)) {
		bar.style.width=((progress)+10)+"%";
		appbar.style.width=((progress)+10)+"%";}
	    info=info.head;}
	var spanbars=fdjtDOM.$(".spanbar");
	var i=0; while (i<spanbars.length) {
	    var spanbar=spanbars[i++];
	    var width=spanbar.ends-spanbar.starts;
	    var ratio=(location-spanbar.starts)/width;
	    if (sbook.Trace.toc)
		fdjtLog("ratio for spanbar %o[%d] is %o [%o,%o,%o]",
			spanbar,spanbar.childNodes[0].childNodes.length,
			ratio,spanbar.starts,location,spanbar.ends);
	    if ((ratio>=0) && (ratio<=1)) {
		var progressbox=fdjtDOM.$(".progressbox",spanbar);
		if (progressbox.length>0) {
		    progressbox[0].style.left=((Math.round(ratio*10000))/100)+"%";}}}
	sbook.location=location;}
    sbook.setLocation=setLocation;

    function setTarget(target,nogo,nosave){
	if (sbook.Trace.focus) sbook.trace("sbook.setTarget",target);
	if (target===sbook.target) return;
	else if ((!target)&&(sbook.target)) {
	    fdjtDOM.dropClass(sbook.target,"sbooktarget");
	    sbook.target=false;
	    return;}
	else if (!(target)) return;
	else if ((inUI(target))||(!(target.id))) return;
	else if ((target===sbook.root)||(target===sbook.body)||
		 (target===document.body)) {
	    if (!(nogo)) sbook.GoTo(target,true);
	    return;}
	if (sbook.target) {
	    fdjtDOM.dropClass(sbook.target,"sbooktarget");
	    sbook.target=false;}
	fdjtDOM.addClass(target,"sbooktarget");
	fdjtState.setCookie("sbooktarget",target);
	sbook.target=target;
	if (sbook.full_cloud)
	    sbook.setCloudCuesFromTarget(sbook.full_cloud,target);
	if (!(nosave))
	    setState({target: target.id,
		      location: sbook.location,
		      loclen: sbook.ends_at,
		      page: sbook.curpage});
 	if (!(nogo)) sbook.GoTo(target,true);}
    sbook.setTarget=setTarget;

    /* Navigation */

    var x_offset=0; var y_offset=0;
    function scrollTo(x,y,win){
	if (sbook.nativescroll) (win||window).scrollTo(x,y);
	else {
	    //(win||sbook.body).style[fdjtDOM.transform]=" translateY(-"+y+"px)";
	    window.scrollTo(0,0);
	    sbook.page.scrollLeft=0;
	    sbook.page.scrollTop=0;
	    (win||sbook.body).style.left=""+(-x)+"px";
	    (win||sbook.body).style.top=""+(-y)+"px";
	}}
    sbook.scrollTo=scrollTo;
    function scrollPos(win){
	if (sbook.nativescroll)
	    return {x:(win||window).scrollX,y:(win||window).scrollY};
	else {
	    var x=fdjtDOM.parsePX((win||(sbook.body)).style.left);
	    var y=fdjtDOM.parsePX((win||sbook.body).style.top);
	    return {x: x,y: -y};}}
    sbook.scrollPos=scrollPos;

    function resizeBody(){
	if (sbook.nativescroll) {}
	else {
	    var curx=x_offset-fdjtDOM.parsePX(sbook.body.style.left);
	    var cury=y_offset-fdjtDOM.parsePX(sbook.body.style.top);
	    // sbook.body.style.left=''; sbook.body.style.top='';
	    var geom=fdjtDOM.getGeometry(sbook.body,sbook.body);
	    x_offset=geom.left; y_offset=geom.top;
	    sbook.bodyoff=[x_offset,y_offset];
	    sbook.body.style.left='0px';
	    sbook.body.style.top=(y_offset)+'px';}}
    sbook.resizeBody=resizeBody;

    sbook.viewTop=function(){
	if (sbook.nativescroll) return fdjtDOM.viewTop();
	else return -(fdjtDOM.parsePX(sbook.body.style.top));}
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
	if (sbook.mode)
	    if (toc=fdjtID("CODEXTOC"))
		return -((toc.offsetHeight||50)+15);
	else return -60;
	else return -40;}

    function setHashID(target){
	if ((!(target.id))||(window.location.hash===target.id)||
	    ((window.location.hash[0]==='#')&&
	     (window.location.hash.slice(1)===target.id)))
	    return;
	if ((target===sbook.body)||(target===document.body)) return;
	var saved_y=((fdjtDOM.isVisible(target))&&fdjtDOM.viewTop());
	var saved_x=((fdjtDOM.isVisible(target))&&(fdjtDOM.viewLeft()));
	window.location.hash=target.id;
	// This resets when setting the ID moved the page unneccessarily
	if ((fdjtDOM.viewLeft()!==saved_x)||(fdjtDOM.viewTop()!==saved_y))
	    sbook.scrollTo(saved_x,saved_y);}
    sbook.setHashID=setHashID;

    function setState(state){
	if (sbook.state===state) return;
	if (!(state.tstamp)) state.tstamp=fdjtTime.tick();
	if (!(state.refuri)) state.refuri=sbook.refuri;
	sbook.state=state;
	var statestring=JSON.stringify(state);
	var uri=sbook.docuri||sbook.refuri;
	fdjtState.setLocal("sbook.state("+uri+")",statestring);
	if ((sbook.user)&&(sbook.dosync)&&(navigator.onLine)) {
	    var refuri=((sbook.target)&&(sbook.getRefURI(sbook.target)))||
		(sbook.refuri);
	    var uri="https://"+sbook.server+"/v4/sync?ACTION=save"+
		"&DOCURI="+encodeURIComponent(sbook.docuri)+
		"&REFURI="+encodeURIComponent(refuri);
	    if (sbook.Trace.dosync)
		fdjtLog("syncPosition(call) %s: %o",uri,state);
	    var req=new XMLHttpRequest();
	    /* req.onreadystatechange=function(evt){
	       fdjtLog("Got response %o",evt);}; */
	    req.open("POST",uri,true);
	    req.withCredentials='yes';
	    req.send(statestring);}}
    sbook.setState=setState;
	    
    function scrollToElt(elt,cxt){
	if ((elt.getAttribute) &&
	    ((elt.tocleve)|| (elt.getAttribute("toclevel")) ||
	     ((elt.sbookinfo) && (elt.sbookinfo.level))))
	    setHead(elt);
	else if (elt.head)
	    setHead(elt.head);
	if (sbook.paginate)
	    sbook.GoToPage(sbook.getPage(elt),"scrollTo");
	else if (fdjtDOM.isVisible(elt)) {}
	else if ((!cxt) || (elt===cxt))
	    fdjtUI.scrollIntoView(elt,elt.id,false,true,displayOffset());
	else fdjtUI.scrollIntoView(elt,elt.id,cxt,true,displayOffset());}
    
    function getLocInfo(elt){
	var counter=0; var lim=200;
	var forward=fdjtDOM.forward;
	while ((elt)&&(counter<lim)) {
	    if ((elt.id)&&(sbook.docinfo[elt.id])) break;
	    else {counter++; elt=forward(elt);}}
	if ((elt.id)&&(sbook.docinfo[elt.id])) {
	    var info=sbook.docinfo[elt.id];
	    return {start: info.starts_at,end: info.ends_at,
		    len: info.ends_at-info.starts_at};}
	else return false;}
    sbook.getLocInfo=getLocInfo;

    function resolveLocation(loc){
	var allinfo=sbook.docinfo._allinfo;
	var i=0; var lim=allinfo.length;
	while (i<lim) {
	    if (allinfo[i].starts_at<loc) i++;
	    else break;}
	while (i<lim)  {
	    if (allinfo[i].starts_at>loc) break;
	    else i++;}
	return fdjtID(allinfo[i-1].frag);}
    sbook.resolveLocation=resolveLocation;


    // This moves within the document in a persistent way
    function sbookGoTo(arg,noset,nosave){
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
	    fdjtLog.warn("Bad sbookGoTo %o",arg);
	    return;}
	if (!(target)) return;
	var page=((sbook.paginate)&&(sbook.pageinfo)&&(sbook.getPageAt(location)));
	var info=((target.id)&&(sbook.docinfo[target.id]));
	if (sbook.Trace.nav)
	    fdjtLog("sbook.GoTo() #%o@P%o/L%o %o",
		    target.id,page,((info)&&(info.starts_at)),target);
	if (target.id) setHashID(target);
	if (info) {
	    if (typeof info.level === 'number')
		setHead(target);
	    else if (info.head) setHead(info.head.frag);}
	setLocation(location);
	if ((!(noset))&&(target.id)&&(!(inUI(target))))
	    setTarget(target,true,nosave||false);
	if (nosave) {}
	else if (noset)
	    sbook.setState({
		target: ((sbook.target)&&(sbook.target.id)),
		location: location,loclen: sbook.ends_at,page: page})
	else sbook.setState(
	    {target: (target.id),location: location,loclen: sbook.ends_at,page: page});
	if (typeof page === 'number') 
	    sbook.GoToPage(page,0,"sbookGoTo",nosave||false);
	sbook.location=location;}
    sbook.GoTo=sbookGoTo;

    function anchorFn(evt){
	var target=fdjtUI.T(evt);
	while (target)
	    if (target.href) break; else target=target.parentNode;
	if ((target)&&(target.href)&&(target.href[0]==='#')) {
	    var goto=document.getElementById(target.href.slice(1));
	    if (goto) {sbookGoTo(goto); fdjtUI.cancel(evt);}}}
    sbook.anchorFn=anchorFn;

    // This jumps and disables the HUD at the same time
    // We try to animate the transition
    function sbookJumpTo(target){
	if (sbook.animate) {
	    sbook.body.style.opacity=0.0001;
	    if (sbook.hudup) sbook.HUD.style.opacity=0.0001;
	    fdjtDOM.addClass(document.body,"pageswitch");
	    setTimeout(function() {
		if (sbook.hudup) CodexMode(false);
		sbookGoTo(target);
		fdjtDOM.dropClass(document.body,"pageswitch");
		sbook.HUD.style.opacity=1.0;
		sbook.body.style.opacity=1.0;
		setTimeout(function(){
		    fdjtDOM.dropClass(document.body,"pageswitch");
		    sbook.HUD.style.opacity="";
		    sbook.body.style.opacity="";},
			   200);},
		       200);}
	else {
	    if (sbook.hudup) CodexMode(false);
	    sbookGoTo(target);}}
    sbook.JumpTo=sbookJumpTo;

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
    sbook.getTOCLevel=getLevel;
    


})();

fdjt_versions.decl("codex",codex_version);
fdjt_versions.decl("codex/core",codex_version);

/* Adding qricons */

/*
  function sbookAddQRIcons(){
  var i=0;
  while (i<sbook.heads.length) {
  var head=sbook.heads[i++];
  var id=head.id;
  var title=(head.sbookinfo)&&sbook_get_titlepath(head.sbookinfo);
  var qrhref="https://"+sbook.server+"/v4/qricon.png?"+
  "URI="+encodeURIComponent(sbook.docuri||sbook.refuri)+
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
