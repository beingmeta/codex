/* -*- Mode: Javascript; -*- */

var sbooks_id="$Id$";
var sbooks_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2010 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knowlets, visit www.knowlets.net
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
  {mode: false,query: false,user: false,
   root: false,start: false,
   target: false,head: false,
   preview: false,preview_target:false,
   _setup: false,_user_setup: false,_gloss_setup: false,_social_setup: false,
   last_preview: false,last_mode: false,last_dash: "help",
   target_title: false,preview_title: false};
var _sbook_setup=false;

var sbookHUD=false;

var sbook_gloss_data=
  ((typeof sbook_gloss_data === 'undefined')?(false):
   (sbook_gloss_data));

var sBook=
  (function(){
    function sBook(doc){
      if (!(doc)) return this;
      this.doc=doc; this.user=false; this.mode=false;
      this.last_mode="context"; this.last_dash="help";
      this.last_preview=false; 
      this.preview=false; this.head=false; this.target=false;
      this.root=false; this.start=false;
      this.target_title=false;
      this.query=false;
      this.index=new KnowletIndex();
      return this;}

    var info=new fdjtKB.Pool("#");
    // This is a big weighted inverted index
    var sbook_index=new KnowletIndex();
    // This is a pool for all OID information
    var sbookOIDs=new fdjtKB.Pool("oids");
    // These are handlers
    var handlers={}

    sBook.Info=info;
    sBook.Index=sbook_index;
    sBook.OIDs=sbookOIDs;
    sBook.Handlers=handlers;
    
    sBook.Trace={
    mode: false,  // Whether to trace mode changes
    nav: false,    // Whether to trace book navigation
    search: 0, // Whether (and level) to trace searches
    clouds: 0, // Whether to trace cloud generation
    focus: false,// Whether to trace focus/target changes
    locations: false, // Whether we're debugging locations
    network: 0,      // Whether we're debugging server interaction
    startup: 0,      // Whether to debug startup
    mark: false,      // Whether to debug gloss addition
    pagination: false, // Whether to trace pagination
    paging: false,       // Whether to trace paging (movement by pages)
    gestures: false};               // Whether to trace gesture recognition

    sBook.debug={
      // Debugging pagination stores HTML attributes describing
      //  pagination decisions
    pagination: false};
    sBook.pageview=true;
    
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
    sBook.trace=sbook_trace;

    // Where to go for your glosses
    sBook.glossroot="https://app.sbooks.net/sbook/";
    // This is the AJAX sbook mark uri
    sBook.mark_uri="/sbook/glossmark.fdcgi?AJAX=yes";
    // This is the JSONP sbook mark uri
    sBook.jsonp="https://apps.sbooks.net/sbook/glossmark.fdcgi?JSONP=yes";
    // This is the hostname for the sbookserver.
    sBook.server=false;
    // This is an array for looking up sbook servers.
    sBook.servers=[[/.sbooks.net$/g,"glosses.sbooks.net"]];
    //var sbook_servers=[];
    // This is the default server
    var sbook_default_server="glosses.sbooks.net";
    // This (when needed) is the iframe bridge for sBooks requests
    sBook.ibridge=false;
    // Whether this sbook is set up for offline reading
    sBook.offline=
      ((typeof sbook_offline === "undefined")?(false):(sbook_offline)); 
    // There be icons here!
    sBook.graphics="http://static.beingmeta.com/graphics/";
    function sbicon(name,suffix) {return sBook.graphics+name+(suffix||"");}

    sBook.getRefURI=function(target){
      var scan=target;
      while (scan)
	if (scan.refuri) return scan.refuri;
	else scan=scan.parentNode;
      return sBook.refuri;}

    sBook.getDocURI=function(target){
      var scan=target;
      while (scan) {
	var docuri=
	  (((scan.getAttributeNS)&&
	    (scan.getAttributeNS("docuri","http://sbooks.net/")))||
	   ((scan.getAttribute)&&(scan.getAttribute("docuri")))||
	   ((scan.getAttribute)&&(scan.getAttribute("data-docuri"))));
	if (docuri) return docuri;
	else scan=scan.parentNode;}
      return sBook.docuri;}

    sBook.getRefID=function(target){
      if (target.getAttributeNS)
	return (target.getAttributeNS('sbookid','http://sbooks.net/'))||
	  (target.getAttributeNS('sbookid'))||
	  (target.getAttributeNS('data-sbookid'))||
	  (target.id);
      else return target.id;};

    function getHead(target){
      while (target)
	if ((target.id)&&(sBook.Info.map[target.id])) {
	  target=sBook.Info.map[target.id]; break;}
	else target=target.parentNode;
      if (target)
	if (target.toclevel)
	  return target.elt||document.getElementById(target.frag);
	else if (target.head)
	  return target.head.elt||
	    document.getElementById(target.head.frag);
	else return false;
      else return false;}
    sBook.getHead=getHead;

    sBook.getFocus=function(target,closest){
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

    sBook.getRef=function(target){
      while (target)
	if (target.sbook_ref) break;
	else target=target.parentNode;
      return (target)&&(fdjtID(target.sbook_ref));};

    sBook.getTarget=function(scan,closest){
      var target=false;
      while (scan) 
	if ((scan===sbook.root)||(scan===sbook.root)||(scan.sbookui))
	  return target;
	else if (scan.id)
	  if ((fdjtDOM.hasClass(scan,"sbookfoci"))||
	      ((sbook_focus_rules)&&(sbook_focus_rules.match(scan))))
	    return scan;
	  else if (closest) return scan;
	  else if (target) scan=scan.parentNode;
	  else {target=scan; scan=scan.parentNode;}
	else scan=scan.parentNode;
      return target;};

    sBook.getTitle=function(target) {
      if (target===sbook.target)
	return sbook.target_title;
      else return (target.title)||false;};

    function getinfo(arg){
      if (arg)
	if (typeof arg === 'string')
	  return sBook.Info.map[arg]||sbookOIDs.map[arg];
	else if (arg.oid) return arg;
	else if (arg.id) return sBook.Info.map[arg.id];
	else return false;
      else return false;}
    sBook.Info=getinfo;

    /* Query functions */

    /* Global query information */

    sBook.getQuery=function(){return sbook.query;}

    sBook.setQuery=function(query,scored){
      if ((sbook.query) &&
	  ((sbook.query._query)===query) &&
	  ((scored||false)===(sbook.query._scored)))
	return sbook.query;
      var result=sbook_index.Query(query);
      if (result._qstring!==
	  Knowlet.Query.base(fdjtID("SBOOKSEARCHTEXT").value)) {
	fdjtID("SBOOKSEARCHTEXT").value=result._qstring;
	fdjtID("SBOOKSEARCHTEXT").removeAttribute('isempty');
	fdjtDOM.dropClass(fdjtID("SBOOKSEARCHTEXT"),'isempty');}
      sbook.query=result; query=result._query;
      // sBook.setGlosses(sbook_search_glosses(query));
      if (sBook.Trace.search>1)
	fdjtLog("Current query is now %o: %o/%o",
		result._query,result,result._refiners);
      else if (sBook.Trace.search)
	fdjtLog("Current query is now %o: %d results/%d refiners",
		result._query,result._results.length,
		result._refiners._results.length);
      if (result._refiners) {
	var completions=sbookQueryCloud(result);
	if (sBook.Trace.search>1)
	  fdjtLog("Setting completions to %o",completions.dom);
	fdjtDOM.replace(fdjtID("SBOOKSEARCHCOMPLETIONS"),completions.dom);}
      sBook.setSources(fdjtID("SBOOKGLOSSES"),result._sources||[]);
      return result;};

    sBook.updateQuery=function(input_elt){
      var q=Knowlet.Query.string2query(input_elt.value);
      if ((q)!==(sbook.query._query))
	sBook.setQuery(q,false);};

    /* Navigation functions */

    function setHead(head){
      if (head===null) head=sbook.root;
      else if (typeof head === "string") {
	var probe=fdjtID(head);
	if (!(probe)) return;
	else head=probe;}
      if (!(head.toclevel)) head=getHead(head);
      if (!(head)) return;
      else if (head===sbook.head) {
	if (sBook.Trace.focus) fdjtLog("Redundant SetHead");
	return;}
      else if (head) {
	var headinfo=sBook.Info(head);
	if (sBook.Trace.focus) sBook.trace("sBook.setHead",head);
	sbookTOC.update("SBOOKTOC4",headinfo,sBook.Info(sbook.head));
	sbookTOC.update("SBOOKDASHTOC4",headinfo,sBook.Info(sbook.head));
	window.title=headinfo.title+" ("+document.title+")";
	if (sbook.head) fdjtDOM.dropClass(sbook.head,"sbookhead");
	fdjtDOM.addClass(head,"sbookhead");
	sBook.setLocation(sbook_location);
	sbook.head=head;}
      else {
	if (sBook.Trace.focus) sBook.trace("sBook.setHead",head);
	sbookTOCUpdate(head,"SBOOKTOC4");
	sbookTOCUpdate(head,"SBOOKDASHTOC4");
	sbook.head=false;}}
    sBook.setHead=setHead;

    var sbook_location=false;

    function setLocation(location,force){
      if ((!(force)) && (sbook_location===location)) return;
      if (sBook.Trace.locations)
	fdjtLog("Setting location to %o",location);
      var info=sBook.Info(sbook.head);
      while (info) {
	var tocelt=document.getElementById("SBOOKTOC4"+info.frag);
	var dashtocelt=document.getElementById("SBOOKDASHTOC4"+info.frag);
	var start=tocelt.sbook_start; var end=tocelt.sbook_end;
	var progress=((location-start)*80)/(end-start);
	var bar=fdjtDOM.getFirstChild(tocelt,".progressbar");
	var appbar=fdjtDOM.getFirstChild(dashtocelt,".progressbar");
	if (sBook.Trace.locations)
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
	if (sBook.Trace.locations)
	  fdjtLog("ratio for spanbar %o[%d] is %o [%o,%o,%o]",
		  spanbar,spanbar.childNodes[0].childNodes.length,
		  ratio,spanbar.starts,location,spanbar.ends);
	if ((ratio>=0) && (ratio<=1)) {
	  var progressbox=fdjtDOM.$(".progressbox",spanbar);
	  if (progressbox.length>0) {
	    progressbox[0].style.left=((Math.round(ratio*10000))/100)+"%";}}}
      sbook_location=location;}
    sBook.setLocation=setLocation;

    function setTarget(target,nogo){
      if (sBook.Trace.focus) sBook.trace("sBook.setTarget",target);
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
	if (!(nogo)) sBook.GoTo(target,true);
	if (target.title) sbook.target_title=target.title;
	target.title=_('click to add a gloss');}}
    sBook.setTarget=setTarget;

    sBook.checkTarget=function(){
      if ((sbook.target) && (!(fdjtDOM.isVisible(sbook.target,true)))) {
	if (sBook.Trace.focus)
	  sBook.trace("sbookCheckTarget(clear)",sbook.target);
	fdjtDOM.dropClass(sbook.target,"sbooktarget");
	sbook.target=false;}};

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
    sBook.setHashID=setHashID;

    function scrollTo(elt,cxt){
      fdjtUI.scrollRestore();
      if ((elt.getAttribute) &&
	  ((elt.tocleve)|| (elt.getAttribute("toclevel")) ||
	   ((elt.sbookinfo) && (elt.sbookinfo.level))))
	setHead(elt);
      else if (elt.head)
	setHead(elt.head);
      if (sBook.pageview)
	sBook.GoToPage(sBook.getPage(elt));
      else if (fdjtDOM.isVisible(elt)) {}
      else if ((!cxt) || (elt===cxt))
	fdjtUI.scrollIntoView
	  (elt,sbookGetStableId(elt),false,true,displayOffset());
      else fdjtUI.scrollIntoView
	     (elt,sbookGetStableId(elt),cxt,true,displayOffset());}

    function sbookGoTo(target,noset){
      sBook.Preview(false);
      if (typeof target === 'string') target=document.getElementById(target);
      if (!(target)) return;
      var page=((sBook.pageview)&&sBook.getPage(target));
      var info=((target.id)&&(sBook.Info.map[target.id]));
      if (sBook.Trace.nav)
	fdjtLog("sBook.GoTo #%o@P%o/L%o %o",
		target.id,page,info.sbookloc,target);
      if (target.id) setHashID(target);
      if (info) {
	if (info.sbookloc) setLocation(info.sbookloc);
	if (info.level) setHead(target);
	else if (info.head) setHead(info.head.frag);}
      if ((!(noset))&&(target.id)&&(!(inUI(target))))
	setTarget(target);
      else if (sBook.pageview) sBook.GoToPage(page);
      else scrollTo(target);
      sBookMode(false);}
    sBook.GoTo=sbookGoTo;

    return sBook;})();

/* Adding qricons */

/*
function sbookAddQRIcons(){
  var i=0;
  while (i<sbook.heads.length) {
    var head=sbook.heads[i++];
    var id=head.id;
    var title=(head.sbookinfo)&&sbook_get_titlepath(head.sbookinfo);
    var qrhref="https://"+sbook_server+"/sbook/qricon.fdcgi?"+
      "URI="+encodeURIComponent(sBook.docuri||sBook.refuri)+
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
