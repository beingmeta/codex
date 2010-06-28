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

var sbook=
    {mode: false,hudup: false,preview: false,scrolling: false,
     query: false,head: false,target: false,
     user: false,root: false,start: false,
     HUD: false,preview_target:false,last_preview: false,
     _setup: false,_user_setup: false,_gloss_setup: false,_social_setup: false,
     // For pagination
     curpage: false,curoff: false,curinfo: false, curbottom: false,
     // For tracking UI state
     last_mode: false, last_dash: "about",
     target_title: false,preview_title: false,
     // How long it takes a gesture to go from tap to hold
     holdmsecs: 500, edgeclick: 50, pagesize: 250,
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
     paginate: true, scrolling: false, floathud: false,
     mouse: true,touch: false,kbd: false,
     // Restrictions on excerpts
     min_excerpt: 3, max_excerpt: false,
     UI: {handlers: {mouse: {}, kbd: {}, ios: {}}},
     Trace: {
	 mode: false,  // Whether to trace mode changes
	 nav: false,    // Whether to trace book navigation
	 search: 0, // Whether (and level) to trace searches
	 clouds: 0, // Whether to trace cloud generation
	 focus: false,// Whether to trace focus/target changes
	 locations: false, // Whether we're debugging locations
	 network: 0,      // Whether we're debugging server interaction
	 startup: 0,      // Whether to debug startup
	 mark: false,      // Whether to debug gloss addition
	 pagination: 0, // Whether to trace pagination
	 paging: false,       // Whether to trace paging (movement by pages)
	 preview: false, // Whether to trace preview
	 gestures: false}, // Whether to trace gestures
    };
var _sbook_setup=false;

var sbookHUD=false;

var sbook_gloss_data=
  ((typeof sbook_gloss_data === 'undefined')?(false):
   (sbook_gloss_data));

(function(){

    function initDB() {
	var refuri=(sbook.refuri||document.location.href);
	if (refuri.indexOf('#')>0) refuri=refuri.slice(0,refuri.indexOf('#'));
	sbook.DocInfo=new fdjtKB.Pool(refuri+"#");
	sbook.knodule=new Knodule(fdjtDOM.getMeta("KNODULE")||refuri);
	sbook.index=new KnoduleIndex(sbook.knodule);
	sbook.BRICO=new Knodule("BRICO");
	sbook.BRICO.addAlias(":@1/");
	sbook.glosses=new fdjtKB.Pool("glosses"); {
	    var superadd=sbook.glosses.add;
	    sbook.glosses.addAlias("glossdb");
	    sbook.glosses.addAlias("-UUIDTYPE=61");
	    sbook.glosses.addAlias(":@31055/");
	    sbook.glosses.xforms['tags']=function(tag){
		var dterm=tag;
		if (typeof tag==='string')
		    if (tag.indexOf('|')>=0)
			return sbook.knodule.handleSubjectEntry(tag);
		else return sbook.knodule.probe(tag)||tag;
		else return tag;};
	    sbook.glosses.addInit(function(item) {
		var info=sbook.docinfo[item.frag];
		if ((info)&&(info.starts_at)) {item.starts_at=info.starts_at;}
		if ((info)&&(info.starts_at)) {item.ends_at=info.ends_at;}});
	    sbook.glosses.index=new fdjtKB.Index();
	    if (sbook.offline)
		sbook.glosses.storage=new fdjtKB.OfflineKB(sbook.glosses);}
	sbook.sourcekb=new fdjtKB.Pool("sources");{
	    sbook.sourcekb.addAlias(":@1961/");
	    sbook.sourcekb.index=new fdjtKB.Index();}}
    sbook.initDB=initDB;

    function sbook_trace(handler,cxt){
	var target=fdjtUI.T(cxt);
	if (target)
	    fdjtLog
	("[%f] %s %o in %o: mode%s=%o, target=%o, head=%o preview=%o",
	 fdjtET(),handler,cxt,target,
	 ((sbook.preview)?("(preview)"):""),sbook.mode,
	 sbook.target,sbook.head,sbook.preview);
	else fdjtLog
	("[%f] %s %o: mode%s=%o, target=%o, head=%o preview=%o",
	 fdjtET(),handler,cxt,
	 ((sbook.preview)?("(preview)"):""),sbook.mode,
	 sbook.target,sbook.head,sbook.preview);}
    sbook.trace=sbook_trace;

    // Where to go for your glosses
    sbook.glossroot="https://glosses.sbooks.net/v3/";
    // This is the AJAX sbook mark uri
    sbook.mark_uri="/v3/glossmark.fdcgi?AJAX=yes";
    // This is the JSONP sbook mark uri
    sbook.jsonp="https://glosses.sbooks.net/v3/glossmark.fdcgi?JSONP=yes";
    // This is the hostname for the sbookserver.
    sbook.server=false;
    // Whether this sbook is set up for offline reading
    sbook.offline=false;
    // This is an array for looking up sbook servers.
    sbook.servers=[[/.sbooks.net$/g,"glosses.sbooks.net"]];
    //sbook.servers=[];
    // This is the default server
    sbook.default_server="glosses.sbooks.net";
    // There be icons here!
    sbook.graphics="http://static.beingmeta.com/graphics/";
    function sbicon(name,suffix) {return sbook.graphics+name+(suffix||"");}

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
	while (target)
	    if ((target.id)&&(sbook.docinfo[target.id])) {
		target=sbook.docinfo[target.id]; break;}
	else target=target.parentNode;
	if (target)
	    if (target.level)
		return target.elt||document.getElementById(target.frag);
	else if (target.head)
	    return target.head.elt||
	    document.getElementById(target.head.frag);
	else return false;
	else return false;}
    sbook.getHead=getHead;

    sbook.getFocus=function(target,closest){
	var first=false;
	if (!(target)) return false;
	else if (inUI(target)) return false;
	else if ((!(sbook_focus_rules))||(sbook_focus_rules.length===0))
	    while (target) {
		if (target.id) 
		    if (closest) return target;
		else if (!(first)) first=target;
		target=target.parentNode;}
	else while (target) {
	    if (target.id)
		if (closest) return target;
	    else if (fdjtDOM.hasClass(target,"sbookfoci"))
		return target;
	    else if (sbook_focus_rules.match(target))
		return target;
	    else if (!(first)) first=target;
	    target=target.parentNode;}
	return first;};

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
		sbookMode(false); sbookMode(true);}};

    sbook.getTarget=function(scan,closest){
	scan=scan.target||scan.srcElement||scan;
	var target=false;
	while (scan) 
	    if ((scan===sbook.root)||(scan.sbookui))
		return false;
	else if (scan.id)
	    if ((fdjtDOM.hasClass(scan,"sbookfoci"))||
		((sbook_focus_rules)&&(sbook_focus_rules.match(scan))))
		return scan;
	else if (closest) return scan;
	else if (target) scan=scan.parentNode;
	else {target=scan; scan=scan.parentNode;}
	else scan=scan.parentNode;
	return target;};

    sbook.getTitle=function(target) {
	if (target===sbook.target)
	    return sbook.target_title;
	else if (target===sbook.preview)
	    return sbook.preview_title;
	else return (target.title)||false;};

    function getinfo(arg){
      if (arg)
	if (typeof arg === 'string')
	  return sbook.docinfo[arg]||fdjtKB.ref(arg);
	else if ((arg.qid)||(arg.oid)) return arg;
	else if (arg.id) return sbook.docinfo[arg.id];
	else return false;
      else return false;}
    sbook.Info=getinfo;

    /* Query functions */

    sbook.getQuery=function(){return sbook.query;}

    sbook.setQuery=function(query,scored){
	if ((sbook.query) &&
	    ((sbook.query._query)===query) &&
	    ((scored||false)===(sbook.query._scored)))
	    return sbook.query;
	var result=sbook.index.Query(query);
	if (result._qstring!==
	    Knodule.Query.base(fdjtID("SBOOKSEARCHTEXT").value)) {
	    fdjtID("SBOOKSEARCHTEXT").value=result._qstring;
	    fdjtID("SBOOKSEARCHTEXT").removeAttribute('isempty');
	    fdjtDOM.dropClass(fdjtID("SBOOKSEARCHTEXT"),'isempty');}
	sbook.query=result; query=result._query;
	// sbook.setGlosses(sbook_search_glosses(query));
	if (sbook.Trace.search>1)
	    fdjtLog("Current query is now %o: %o/%o",
		    result._query,result,result._refiners);
	else if (sbook.Trace.search)
	    fdjtLog("Current query is now %o: %d results/%d refiners",
		    result._query,result._results.length,
		    result._refiners._results.length);
	if (result._refiners) {
	    var completions=sbook.queryCloud(result);
	    if (sbook.Trace.search>1)
		fdjtLog("Setting completions to %o",completions.dom);
	    fdjtDOM.replace(fdjtID("SBOOKSEARCHCLOUD"),completions.dom);}
	return result;};

    sbook.updateQuery=function(input_elt){
	var q=Knodule.Query.string2query(input_elt.value);
	if ((q)!==(sbook.query._query))
	    sbook.setQuery(q,false);};

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
	    sbookTOC.update("SBOOKTOC4",headinfo,sbook.Info(sbook.head));
	    sbookTOC.update("SBOOKDASHTOC4",headinfo,sbook.Info(sbook.head));
	    window.title=headinfo.title+" ("+document.title+")";
	    if (sbook.head) fdjtDOM.dropClass(sbook.head,"sbookhead");
	    fdjtDOM.addClass(head,"sbookhead");
	    sbook.setLocation(sbook_location);
	    sbook.head=fdjtID(head.id);}
	else {
	    if (sbook.Trace.focus) sbook.trace("sbook.setHead",head);
	    sbookTOCUpdate(head,"SBOOKTOC4");
	    sbookTOCUpdate(head,"SBOOKDASHTOC4");
	    sbook.head=false;}}
    sbook.setHead=setHead;

    var sbook_location=false;

    function setLocation(location,force){
	if ((!(force)) && (sbook_location===location)) return;
	if (sbook.Trace.locations)
	    fdjtLog("Setting location to %o",location);
	var info=sbook.Info(sbook.head);
	while (info) {
	    var tocelt=document.getElementById("SBOOKTOC4"+info.frag);
	    var dashtocelt=document.getElementById("SBOOKDASHTOC4"+info.frag);
	    var start=tocelt.sbook_start; var end=tocelt.sbook_end;
	    var progress=((location-start)*80)/(end-start);
	    var bar=fdjtDOM.getFirstChild(tocelt,".progressbar");
	    var appbar=fdjtDOM.getFirstChild(dashtocelt,".progressbar");
	    if (sbook.Trace.locations)
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
	    if (sbook.Trace.locations)
		fdjtLog("ratio for spanbar %o[%d] is %o [%o,%o,%o]",
			spanbar,spanbar.childNodes[0].childNodes.length,
			ratio,spanbar.starts,location,spanbar.ends);
	    if ((ratio>=0) && (ratio<=1)) {
		var progressbox=fdjtDOM.$(".progressbox",spanbar);
		if (progressbox.length>0) {
		    progressbox[0].style.left=((Math.round(ratio*10000))/100)+"%";}}}
	sbook_location=location;}
    sbook.setLocation=setLocation;

    function setTarget(target,nogo){
	if (sbook.Trace.focus) sbook.trace("sbook.setTarget",target);
	if (target===sbook.target) return;
	if (sbook.target) {
	    if (sbook.target_title)
		sbook.target.title=sbook.target_title;
	    else sbook.target.title=null;
	    fdjtDOM.dropClass(sbook.target,"sbooktarget");
	    sbook.target=false; sbook.target_title=false;}
	if ((!(target))||(inUI(target))||(!(target.id))||
	    ((target===sbook.root)||(target===document.body))) {
	    return;}
	else {
	    fdjtDOM.addClass(target,"sbooktarget");
	    fdjtState.setCookie("sbooktarget",target);
	    sbook.target=target;
	    if (!(nogo)) sbook.GoTo(target,true);
	    if (target.title) sbook.target_title=target.title;
	    target.title=_('click to add a gloss');}}
    sbook.setTarget=setTarget;

    /* Navigation */

    var sbookUIclasses=
	/(\bhud\b)|(\bglossmark\b)|(\bleading\b)|(\bsbookmargin\b)/;
    
    function inUI(elt){
	if (elt.sbookui) return true;
	else if (fdjtDOM.hasParent(elt,sbookHUD)) return true;
	else while (elt)
	    if (elt.sbookui) return true;
	else if (fdjtDOM.hasClass(elt,sbookUIclasses)) return true;
	else elt=elt.parentNode;
	return false;}

    function displayOffset(){
	var toc;
	if (sbook.mode)
	    if (toc=fdjtID("SBOOKTOC"))
		return -((toc.offsetHeight||50)+15);
	else return -60;
	else return -40;}

    function setHashID(target){
	if ((!(target.id))||(window.location.hash===target.id)||
	    ((window.location.hash[0]==='#')&&
	     (window.location.hash.slice(1)===target.id)))
	    return;
	var saved_y=((fdjtDOM.isVisible(target))&&fdjtDOM.viewTop());
	var saved_x=((fdjtDOM.isVisible(target))&&(fdjtDOM.viewLeft()));
	window.location.hash=target.id;
	// This resets when setting the ID moved the page unneccessarily
	if ((fdjtDOM.viewLeft()!==saved_x)||(fdjtDOM.viewTop()!==saved_y))
	    window.scrollTo(saved_x,saved_y);}
    sbook.setHashID=setHashID;

    function scrollTo(elt,cxt){
	fdjtUI.scrollRestore();
	if ((elt.getAttribute) &&
	    ((elt.tocleve)|| (elt.getAttribute("toclevel")) ||
	     ((elt.sbookinfo) && (elt.sbookinfo.level))))
	    setHead(elt);
	else if (elt.head)
	    setHead(elt.head);
	if (sbook.paginate)
	    sbook.GoToPage(sbook.getPage(elt));
	else if (fdjtDOM.isVisible(elt)) {}
	else if ((!cxt) || (elt===cxt))
	    fdjtUI.scrollIntoView(elt,elt.id,false,true,displayOffset());
	else fdjtUI.scrollIntoView(elt,elt.id,cxt,true,displayOffset());}

    function sbookGoTo(target,noset){
	sbook.Preview(false);
	if (typeof target === 'string') target=document.getElementById(target);
	if (!(target)) return;
	var page=((sbook.paginate)&&sbook.getPage(target));
	var info=((target.id)&&(sbook.docinfo[target.id]));
	if (sbook.Trace.nav)
	    fdjtLog("[%f] sbook.GoTo() #%o@P%o/L%o %o",
		    fdjtET(),target.id,page,((info)&&(info.starts_at)),target);
	if (target.id) setHashID(target);
	if (info) {
	    if (info.starts_at) setLocation(info.starts_at);
	    if (info.level) setHead(target);
	    else if (info.head) setHead(info.head.frag);}
	if ((!(noset))&&(target.id)&&(!(inUI(target))))
	    setTarget(target);
	else if (sbook.paginate) sbook.GoToPage(page);
	else scrollTo(target);
	sbook.checkTarget();
	// sbookMode(false);
	if (!(sbook.mode)) {
	    fdjtDOM.addClass(sbook.TOC,"hover");
	    fdjtDOM.addClass(document.body,"hudup");
	    setTimeout(function(){
		fdjtDOM.dropClass(sbook.TOC,"hover");
		if (!(sbook.hudup))
		    fdjtDOM.dropClass(document.body,"hudup");},
		       1500);}}
    sbook.GoTo=sbookGoTo;

    function sbookJumpTo(target){
	sbookGoTo(target); sbookMode(false);}
    sbook.JumpTo=sbookJumpTo;

})();

/* Adding qricons */

/*
function sbookAddQRIcons(){
  var i=0;
  while (i<sbook.heads.length) {
    var head=sbook.heads[i++];
    var id=head.id;
    var title=(head.sbookinfo)&&sbook_get_titlepath(head.sbookinfo);
    var qrhref="https://"+sbook.server+"/v3/qricon.fdcgi?"+
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
