/* -*- Mode: Javascript; -*- */

var sbooks_id="$Id: domutils.js 40 2009-04-30 13:31:58Z haase $";
var sbooks_version=parseInt("$Revision: 40 $".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
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

// This is the current head
var sbook_head=false;
// This is the base URI for this document
var sbook_base=false;

// Whether to debug generally
var sbook_debug=false;
// Whether to debug the HUD
var sbook_debug_hud=false;
// Whether to debug search
var sbook_trace_search=0;
// Whether to debug clouds
var sbook_trace_clouds=0;
// Whether we're debugging locations
var sbook_debug_locations=false;

// Nonbreakable space, all handy
var sbook_nbsp="\u00A0";

// Rules for building the TOC.  These can be extended.
var sbook_headlevels=
  {"H1": 1,"H2": 2,"H3": 3,"H4": 4,"H5": 5};
// This table maps IDs or NAMEs to elements.  This is different
//  from just their XML ids, because elements that have no ID by
//  a nearby named anchor will appear in this table.
var sbook_hashmap={};
// Use spanbars in the HUD
var sbook_use_spanbars=true;
// Show subsections too
var sbook_list_subsections=true;
// Electro highlights
var sbook_electric_spanbars=false;

// Whether to enable podpings
var sbook_besocial=true;
var sbook_echoes_iframe=true;
// Whether to use extended (semantic) search
var sbook_extended_search=true;
// When defined, this is a precomputed TOC for this file
var sbook_local_toc=false;
// This is the TOC in which this document is embedded (NYI)
var sbook_context_toc={};
// This is a table mapping tags (dterms) to elements (or IDs)
//  Note that this includes the genls of actual tags; the index
//   sbook_dindex is reserved for actual tags.
var sbook_index={_all: []};
// This is a table mapping prime (focal) tags (dterms) to elements (or IDs)
var sbook_pindex={_all: []};
// This is the 'extended index' which maps genls (dterms) to elements (or IDs)
var sbook_dindex={_all: []};
// This is a straight 'keyword' index mapping keywords to elements (or IDs)
// This is actually just a cache of searches which are done on demand
var sbook_word_index={};
// This is an array of all tags
var sbook_all_tags=[];
// This is a count of all tagged elements
var sbook_tagged_count=0;
// This is a table mapping tags (typically, hopefully, dterms) to URIs
var sbook_context_index={};
// Whether to build the index
var sbook_build_index=true;
// An array of element selectors which contain tags
var sbook_tag_tags=[];
// Whether the HUD is at the top or the bottom
var sbookHUD_at_top=false;
// Whether to sync the echoes icon
var sbook_sync_echo_icon=true;
// Whether the page has been scrolled
var sbook_scrolled=false;
// Where to go for your webechoes
var sbook_webechoes_root="http://webechoes.net/";
// Whether to switch headings on all mouseovers
var sbook_close_tracking=true;
// If a search has fewer than this many results,
//  it just displays them
var sbook_search_gotlucky=5;
//  Whether the the search input has the focus
var sbook_search_focus=false;
// Whether to display verbose tool tips
var sbook_noisy_tooltips=false;

function sbookScrollOffset()
{
  return ((sbookHUD_at_top)&&(-(sbookHUD.offsetHeight+20)))
}

/* Basic SBOOK functions */

function sbookHeadLevel(elt)
{
  if (fdjtHasAttrib(elt,"toclevel")) {
    var tl=elt.getAttribute("toclevel");
    if (typeof tl === "number") return tl;
    else if ((tl==="no") || (tl==="none"))
      return false;
    else if (typeof tl === "string")
      tl=parseInt(tl);
    else return false;
    if ((typeof tl === "number") && (tl>=0))
      return tl;
    else return false;}
  else {
    var tl=fdjtLookupElement(sbook_headlevels,elt);
    if (typeof tl === "number") return tl;
    else if (typeof tl === "function") return tl(elt);
    else return false;}
}

function sbook_getinfo(elt)
{
  if (!(elt)) return elt;
  else if (typeof elt === "string") {
    var real_elt=$(elt);
    if (real_elt) return sbook_getinfo(real_elt);
    else return false;}
  else if (!(elt.sbookinfo))
    return false;
  else return elt.sbookinfo;
}

function sbook_needinfo(elt)
{
  if (!(elt)) return elt;
  else if (typeof elt === "string") {
    var real_elt=$(elt);
    if (real_elt) return sbook_needinfo(real_elt);
    else return false;}
  else if (!(elt.sbookinfo)) {
    var info=new Object();
    elt.sbookinfo=info;
    return info;}
  else return elt.sbookinfo;
}

function sbook_get_headelt(target)
{
  while (target)
    if (target.headelt) break;
    else target=target.parentNode;
  return target;
}


/* Building the TOC */

var debug_toc_build=false;
var trace_toc_build=false;
var _sbook_toc_built=false;

function sbookBuildTOC()
{
  var start=new Date();
  if (_sbook_toc_built) return;
  fdjtLog('Starting to build TOC');
  var body=document.body, children=body.childNodes, level=false;
  var bodyinfo=new Object();
  var tocstate={curlevel: 0,idserial:0,location: 0};
  tocstate.curhead=body; tocstate.curinfo=bodyinfo;
  // Location is an indication of distance into the document
  var location=0;
  body.sbookinfo=bodyinfo; bodyinfo.starts_at=0;
  bodyinfo.level=0; bodyinfo.sub=new Array();
  bodyinfo.sbook_head=false; bodyinfo.sbook_heads=new Array();
  if (!(body.id)) body.id="TMPIDBODY";
  bodyinfo.id=body.id;
  var i=0; while (i<children.length) {
    var child=children[i++];
    sbook_toc_builder(child,tocstate);} 
  var scan=tocstate.curhead, scaninfo=tocstate.curinfo;
  while (scan) {
    scaninfo.ends_at=tocstate.location;
    scan=scaninfo.sbook_head;
    if (!(scan)) scan=false;
    if (scan) scaninfo=scan.sbookinfo;}
  var done=new Date();
  fdjtLog('Done building TOC in %f secs',
	  (done.getTime()-start.getTime())/1000);
  _sbook_toc_build=true;
}

function sbook_toc_builder(child,tocstate)
{
  // fdjtTrace("toc_builder %o %o",tocstate,child);
  var location=tocstate.location;
  var curhead=tocstate.curhead;
  var curinfo=tocstate.curinfo;
  var curlevel=tocstate.curlevel;
  // Location tracking and TOC building
  if (child.nodeType==Node.TEXT_NODE) {
    var width=child.nodeValue.length;
    child.sbookloc=tocstate.location+width/2;
    tocstate.location=tocstate.location+width;}
  else if (child.nodeType!=Node.ELEMENT_NODE)
    child.sbook_head=curhead;
  else if (level=sbookHeadLevel(child)) {
    var head=child;
    var headinfo=sbook_needinfo(head);
    var headid=fdjtGuessAnchor(head);
    child.sbookloc=tocstate.location;
    if (headid) sbook_hashmap[headid]=head;
    else headid=fdjtForceId(head)
	   if (debug_toc_build)
	     fdjtLog("Found head item %o under %o at level %d w/id=#%s ",
		     head,curhead,level,headid);
    head.sbookinfo=headinfo;
    headinfo.starts_at=tocstate.location;
    headinfo.elt=head; headinfo.level=level;
    headinfo.sub=new Array(); headinfo.id=headid;
    {
      var content=child.childNodes;
      var transplanted=[];
      var i=0; var j=0;
      while (i<content.length) {
	var transplant=fdjtTransplant(content[i++]);
	if (transplant) transplanted[j++]=transplant;}
      headinfo.content=transplanted;}
    if ((typeof head.title === "string") &&
	(head.title != ""))
      headinfo.title=head.title;
    else headinfo.title=fdjtTextify(head,true);
    headinfo.next=false; headinfo.prev=false;
    if (level>curlevel) {
      headinfo.sbook_head=curhead;
      if (!(curinfo.intro_ends_at))
	curinfo.intro_ends_at=tocstate.location;
      curinfo.sub.push(head);}
    else {
      var scan=curhead;
      var scaninfo=curinfo;
      var scanlevel=curinfo.level;
      while (scaninfo) {
	if (debug_toc_build) /* debug_toc_build */
	  fdjtLog("Finding head: scan=%o, info=%o, sbook_head=%o, cmp=%o",
		  scan,scaninfo,scanlevel,scaninfo.sbook_head,
		  (scanlevel<level));
	if (scanlevel<level) break;
	if (level===scanlevel) {
	  headinfo.prev=scan;
	  scaninfo.next=head;}
	scaninfo.ends_at=tocstate.location;
	var next=scaninfo.sbook_head;
	var nextinfo=sbook_getinfo(next);
	if ((nextinfo) && (nextinfo.sbook_head)) {
	  scan=next; scaninfo=nextinfo; scanlevel=nextinfo.level;}
	else {
	  scan=document.body;
	  scaninfo=sbook_getinfo(scan);
	  scanlevel=0;
	  break;}}
      if (debug_toc_build)
	fdjtLog("Found parent: up=%o, upinfo=%o, atlevel=%d, sbook_head=%o",
		scan,scaninfo,scaninfo.level,scaninfo.sbook_head);
      headinfo.sbook_head=scan;
      scaninfo.sub.push(head);}
    var sup=headinfo.sbook_head;
    var supinfo=sbook_getinfo(sup);
    var newheads=new Array();
    newheads=newheads.concat(supinfo.sbook_heads); newheads.push(sup);
    headinfo.sbook_heads=newheads;
    if ((trace_toc_build) || (debug_toc_build))
      fdjtLog("@%d: Found head=%o, headinfo=%o, sbook_head=%o",
	      tocstate.location,head,headinfo,headinfo.sbook_head);
    tocstate.curhead=head;
    tocstate.curinfo=headinfo;
    tocstate.curlevel=level;
    tocstate.location=tocstate.location+fdjtFlatWidth(child);}
  else {
    var width=fdjtFlatWidth(child);
    var loc=tocstate.location+width/2;
    tocstate.location=tocstate.location+width;
    if ((child.tagName) && (child.tagName==="DIV")) {
      var children=child.childNodes;
      if (children) {
	var i=0; while (i<children.length)
		   sbook_toc_builder(children[i++],tocstate);}
      if ((fdjtHasContent(child)) || (fdjtHasAttrib(child,'tags'))) {
	child.sbook_head=curhead;
	child.sbookloc=loc;}}
    else {
      child.sbookloc=loc;
      child.sbook_head=curhead;}}
  if ((sbook_debug_locations) && (child.sbookloc) &&
      (child.setAttribute))
    child.setAttribute("sbookloc",child.sbookloc);
}

/* Global query information */

// This is the current query
var sbook_query=false;

function sbookSetQuery(query,scored)
{
  if ((sbook_query) &&
      ((sbook_query._query)===query) &&
      ((scored||false)===(sbook_query._scored)))
    return sbook_query;
  var result=sbookQuery(query);
  if (result._qstring!==sbookQueryBase($("SBOOKSEARCHTEXT").value)) 
    $("SBOOKSEARCHTEXT").value=result._qstring;
  sbook_query=result; query=result._query;
  if (sbook_trace_search>1)
    fdjtLog("Current query is now %o: %o/%o",
	    result._query,result,result._refiners);
  else if (sbook_trace_search)
    fdjtLog("Current query is now %o: %d results/%d refiners",
	    result._query,result._results.length,
	    result._refiners._results.length);
  if (result._refiners) {
    var completions=sbookQueryCloud(result);
    if (sbook_trace_search>1)
      fdjtLog("Setting completions to %o",completions);
    fdjtSetCompletions("SBOOKSEARCHCOMPLETIONS",completions);
    var ncompletions=fdjtComplete($("SBOOKSEARCHTEXT")).length;}
  return result;
}

function sbookUpdateQuery(input_elt)
{
  var q=sbookStringToQuery(input_elt.value);
  if ((q)!==(sbook_query._query))
    sbookSetQuery(q,false);
}

/* Accessing the TOC */

function sbook_title_path(head)
{
  var info=sbook_getinfo(head);
  if (info.title) {
    var title=info.title;
    var scan=sbook_getinfo(info.sup);
    while (scan) {
      if (scan.title) title=title+" // "+scan.title;
      scan=sbook_getinfo(scan.sup);}
    return title;}
  else return null;
}

function sbookSetHead(head)
{
  if (head===null) head=document.body;
  else if (typeof head === "string") {
    var probe=$(head);
    if (!(probe)) probe=sbook_hashmap[head];
    if (!(probe)) return;
    else head=probe;}
  if (head===sbook_head) {
    if (sbook_debug) fdjtLog("Redundant SetHead");
    return;}
  else {
    var info=head.sbookinfo;
    var navhud=createSBOOKHUDnav(head,info);
    /* Set NAV titles */
    if (sbook_sync_echo_icon)
      try {
	var stable_id=sbookGetStableId(head);
	var uri=window.location.href;
	var hashpos=uri.indexOf('#');
	var new_uri=((hashpos>0) ? (uri.slice(0,hashpos)+'#'+stable_id) :
		     (uri+'#'+stable_id));
	var image_uri=sbook_echoes_icon(new_uri);
	var podspot_img=$("SBOOKECHOESBUTTON");
	if (podspot_img.src!==image_uri)
	  podspot_img.src=image_uri;}
      catch (e) {
	fdjtLog("Unexpected error with podspot: %o",e);}
    // fdjtTrace("Replacing TOC with %o",navhud);
    fdjtReplace("SBOOKTOC",navhud);
    window.title=document.title+" // "+info.title;
    // window.location="#"+newid;
    sbook_head=head;}
  if ($("SBOOKECHOES"))
    $("SBOOKECHOES").setFocus(sbook_head.id);
}

var sbook_location=false;

function sbookSetLocation(location)
{
  if (sbook_location===location) return;
  if (sbook_debug_locations)
    fdjtLog("Setting location to %o",location);
  var spanbars=$$(".spanbar",$("SBOOKHUD"));
  var i=0; while (i<spanbars.length) {
    var spanbar=spanbars[i++];
    var width=spanbar.ends-spanbar.starts;
    var ratio=(location-spanbar.starts)/width;
    if (sbook_debug_locations)
      fdjtLog("ratio for %o[%d] is %o [%o,%o,%o]",
	      spanbar,spanbar.childNodes[0].childNodes.length,
	      ratio,spanbar.starts,location,spanbar.ends);
    if ((ratio>=0) && (ratio<=1)) {
      var progressbox=$$(".progressbox",spanbar);
      if (progressbox.length>0)
	progressbox[0].style.left=((Math.round(ratio*10000))/100)+"%";}}
  sbook_location=location;
}

/* Tracking the current section */

function sbookUpdateHUD(evt)
{
  var target=evt.target, body=document.body;
  while (target)
    if (target.parentNode===body) break;
    else target=target.parentNode;
  if (target===null) return;
  else if (target===body) return;
  else if (target.sbookinfo)
    sbookSetHead(target);
  else sbookSetHead(target.sbook_head);
}

function sbookScrollTo(elt)
{
  if (elt.sbookloc) sbookSetLocation(elt.sbookloc);
  if (fdjtHasAttrib(elt,"toclevel")) 
    sbookSetHead(elt);
  else if (elt.sbook_head)
    sbookSetHead(elt.sbook_head);
  fdjtScrollTo(elt,sbookGetStableId(elt),elt.sbook_head);
}

/* Tracking position within the document. */

var sbook_focus_elt=false;
var sbook_focus_tags=false;
var sbook_track_x=false;
var sbook_track_y=false;
var sbook_scrolled=false;
var sbook_onscroll_works=false;

var sbook_track_window=25;

function sbook_onmouseover(evt)
{
  var target=evt.target;
  /* if (sbook_hudup) return; */
  /* If you're over the HUD, don't do anything. */
  if (fdjtHasParent(evt.target,sbookHUD))
    return;
  /* If you're not, go back to the saved scroll location */
  if (fdjtScrollRestore()) return;
  if (sbook_track_x) {
    var offsets=fdjtGetOffsets(target);
    var xpos=(evt.x)|(evt.layerX);
    var ypos=(evt.y)|(evt.layerY);
    var xmoved=Math.abs(sbook_track_x-xpos);
    var ymoved=Math.abs(sbook_track_y-ypos);
    if ((xmoved>sbook_track_window) ||
	(ymoved>sbook_track_window) ||
	(sbook_scrolled)) {
      sbook_track_x=xpos; sbook_track_y=ypos;
      sbook_scrolled=false;}
    else return;}
  /* Now, we try to find a top level element to sort out whether
     we need to update the location or section head. */
  while (target)
    if (target.sbook_head) break;
    else if (target.sbookinfo) break;
    else if (target.parentNode===document.body) break;
    else target=target.parentNode;
  if (target===null) return;
  if (target===sbookHUD) return;
  if ((!(sbook_close_tracking)) && (fdjtIsVisible(sbook_head))) return;
  if (target!=sbook_focus_elt) {
    var tags=sbook_get_tags(target);
    if ((tags.length>0) &&
	(tags != sbook_focus_tags)) {
      var old=$("SBOOKSEARCHCUES");
      var tagdiv=fdjtDiv("cues");
      var i=0; while (i<tags.length) {
	var span=fdjtSpan("tag",tags[i]);
	if (i>0) 
	  fdjtAppend(tagdiv," . ",span);
	else fdjtAppend(tagdiv,span);
	i++;}
      tagdiv.id="SBOOKSEARCHCUES";
      fdjtReplace(old,tagdiv);
      sbook_focus_elt=target;
      sbook_focus_tags=tags;}}
  if ((target.sbookinfo) && (target.sbookinfo.level))
    sbookSetHead(target);
  else if (target.sbook_head)
    sbookSetHead(target.sbook_head);
  if ((target) && (target.sbookloc))
    sbookSetLocation(target.sbookloc);
}

function sbook_onclick(evt)
{
  var target=evt.target;
  while (target)
    if (target===sbookHUD) return;
    else target=target.parentNode;
  // fdjtTrace("sbook_onclick %o,%o,%o",evt,evt.target,target);
  sbookSetHUD(false);
  target=evt.target;
  /* If you're not, go back to the saved scroll location */
  if (fdjtScrollRestore()) return;
  while (target)
    if (target.sbook_head) break;
    else if (target.parentNode===document.body) break;
    else target=target.parentNode;
  if (target===null) return;
  if (target===sbookHUD) return;
  if ((target.sbookinfo) && (target.sbookinfo.level)) {
    var id=target.sbookinfo.id;
    sbookSetHead(target);
    if ((id) && (!(id.search(/TMPID/)==0)))
      window.location.hash=id;}
  else if (target.sbook_head) {
    var id=target.sbook_head.sbookinfo.id;
    sbookSetHead(target.sbook_head);
    if ((id) && (!(id.search(/TMPID/)==0)))
      window.location.hash=id;}
}

function sbook_onscroll(evt)
{
  sbook_scrolled=true;
  sbook_onscroll_works=true;
}

/* Scrolling by moving sideways */
/* Currently not enabled */

var _sbook_mousex_down=false;

function sbook_onmousedown(evt)
{
  var target=evt.target;
  /* If you're over the HUD, don't do anything. */
  if (evt.screenX<sbookHUD.offsetHeight) return;
  _sbook_mousex_down=evt.screenX;
}

function sbook_onmouseup(evt)
{
  var target=evt.target;
  /* If you're over the HUD, don't do anything. */
  if (evt.screenX<sbookHUD.offsetHeight) {
    _sbook_mousex_down=false;
    return;}
  if (_sbook_mousex_down) {
    var delta=evt.screenX-_sbook_mousex_down;
    if (delta>100)
      window.scrollBy(0,window.innerHeight);
    else if (delta<100)
      window.scrollBy(0,-window.innerHeight);
    _sbook_mousex_down=false;}
}

/* Default keystrokes */

function sbook_onkeypress(evt)
{
  /*
  if (!(evt.keyCode)) return;
  if (evt.keyCode===sbook_hudkey) {
    if (sbook_hudup) sbookHUDLive(false,true);
    else sbookHUDLive(true);
    return false;}
  var target=evt.target;
  while (target)
    if ((target.tagName==="INPUT") ||
	(target.tagName==="TEXTAREA") ||
	(target.className==="sbooknokeys"))
      return true;
    else target=target.parentNode;
  if ((evt.ctrlKey) && (evt.keyCode===39))
    sbookHUD_Next();
  else if ((evt.ctrlKey) && (evt.keyCode===37))
    sbookHUD_Prev();
  else if ((evt.ctrlKey) && (evt.keyCode===38)) {
    document.body.setAttribute("mode","");
    sbookHUDLive(true);}
  else if ((evt.ctrlKey) && (evt.keyCode===40)) {
    sbookHUDLive(false);}
  else if ((evt.ctrlKey) && (evt.keyCode===13)) {
    fdjtDropClass(document.body,"social","mode");
    fdjtAddClass(document.body,"search","mode");    
    sbookHUDLive(true);
    $("SBOOKSEARCHTEXT").focus();}
  else return;
  sbookHUD_forced=true;
  evt.preventDefault();
  */
}

/* Initialization */

var _sbook_setup=false;

function sbookSetup(evt)
{
  if (_sbook_setup) return;
  fdjtSetup();
  if (fdjtHasClass(document.body,"tophud"))
    sbookHUD_at_top=true;
  sbookBuildTOC();
  importSocialData();
  createSBOOKHUD();
  sbookHUD_Init();
  sbook_base=getsbookbase();
  document.body.onmouseover=sbook_onmouseover;
  document.body.onclick=sbook_onclick;
  window.onscroll=sbook_onscroll;
  window.onkeypress=sbook_onkeypress;
  if (knoHTMLSetup) knoHTMLSetup();
  setupTags();
  sbookFullCloud();
  /* _sbook_createHUDSocial(); */
  _sbook_setup=true;
}

function getsbookbase()
{
  var base=fdjtGetMeta("SBOOKBASE");
  if (base) return base;
  var base_elts=fdjtGetChildrenByTagName("BASE");
  if ((base_elts) && (base_elts.length>0))
    return base_elt[0].href;
  var uri=document.location.href;
  var hashpos=uri.indexOf("#");
  if (hashpos>0) return uri.slice(0,hashpos);
  else return uri;
}


fdjtLoadMessage("Loaded sbooks module");
fdjtTrace("Working off of moby")

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
