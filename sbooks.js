/* -*- Mode: Javascript; -*- */

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

// This is the HUD top element
var sbookHUD=false;
// This is the current head
var sbook_head=false;
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
// Rules for building the TOC.  These can be extended.
var sbook_headlevels=
  {"H1": 1,"H2": 2,"H3": 3,"H4": 4,"H5": 5};
// This table maps IDs or NAMEs to elements.  This is different
//  from just their XML ids, because elements that have no ID by
//  a nearby named anchor will appear in this table.
var sbook_hashmap={};
// Nonbreakable space, all handy
var sbook_nbsp="\u00A0";
// Use spanbars in the HUD
var sbook_use_spanbars=true;
// Show subsections too
var sbook_list_subsections=true;
// Whether the HUD is up
var sbook_hudup=false;
// Whether the HUD was 'forced down' (by a user action)
// This makes it harder to come back up automatically
var sbook_hud_suppressed=false;
// Electro highlights
var sbook_electric_spanbars=false;
// Whether the HUD state was forced
var sbookHUD_forced=false;
// The keycode for bringing the HUD up and down
var sbook_hudkey=27;
// Whether we are previewing a section
var sbook_saved_scrollx=false, sbook_saved_scrolly=false;
// Where graphics can be found
var sbook_graphics_root="/static/graphics/";
// Whether to enable podpings
var sbook_besocial=true;
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

// What to use as the podspot image URI.  This 'image' 
//  really invokes a script to pick or generate a
//  image for the current user and document.
var sbook_podspot_img="sBooksWE_32x32.png";
function sbook_echoes_icon(uri)
{
  return sbook_webechoes_root+"podspots/"+sbook_podspot_img+
    ((uri) ? ("?URI="+encodeURIComponent(uri)) : "");
}

function sbookScrollOffset()
{
  return ((sbookHUD_at_top)&&(-(sbookHUD.offsetHeight+20)))
}

// This can also be "echoes" or "search" to indicate which
// main element is active
var sbook_mode="toc";
var sbook_toc=false;
var sbook_echoes=false;
var sbook_search=false;

function createSBOOKHUD()
{
  var hud=$("SBOOKHUD");
  if (hud) return hud;
  else {
    sbookHUD=hud=fdjtDiv(); hud.id="SBOOKHUD"; hud.className="sbookhud";
    var prevarrow=
      fdjtAnchor("Javascript:sbookHUD_Prev();",
		 fdjtImage(sbook_graphics_root+"LeftTriangle32.png"));
    var nextarrow=
      fdjtAnchor("Javascript:sbookHUD_Next();",
		 fdjtImage(sbook_graphics_root+"/RightTriangle32.png"));
    var showechoes=
      fdjtAnchor("Javascript:sbookHUD_SocialMode();",
		 fdjtImageW(sbook_echoes_icon(false),
			    {"width": 32,"height": 32,
			        "id": "PODSPOTICON"}));
    var dosearch=
      fdjtAnchor("Javascript:sbookHUD_SearchMode();",
		 fdjtImage(sbook_graphics_root+"SearchIcon32.png"));
    var toc=fdjtDiv("sbooktoc");
    var localsearch=_sbook_createHUDSearch();
    var echoes=fdjtDiv("sbookechoes");
    hud.onmouseover=sbookHUD_onmouseover;
    hud.onmouseout=sbookHUD_onmouseout;
    hud.onclick=sbookHUD_onclick;
    prevarrow.id="SBOOKPREV";
    nextarrow.id="SBOOKNEXT";
    echoes.id="SBOOKECHOES";
    showechoes.id="SBOOKECHOESBUTTON";
    dosearch.id="SBOOKSEARCHBUTTON";
    toc.id="SBOOKTOC";
    dosearch.onclick=sbookHUD_SearchMode;
    localsearch.id="SBOOKSEARCH"
    sbook_toc=toc;
    if (!(sbook_besocial)) {
      echoes="";}
    else {
      sbook_echoes=fdjtNewElement("iframe"); sbook_echoes.src="";
      fdjtAppend(echoes,sbook_echoes);}
    fdjtAppend(hud,prevarrow,showechoes,dosearch,nextarrow,
	       toc,echoes,localsearch);
    fdjtPrepend(document.body,hud);}
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

/* Updating the HUD */

function _sbook_generate_spanbar(head,headinfo,child)
{
  var spanbar=fdjtDiv("spanbar");
  var spans=fdjtDiv("spans");
  var start=headinfo.starts_at;
  var end=headinfo.ends_at;
  var len=end-start;
  var subsections=headinfo.sub; var last_info;
  var sectnum=0; var percent=0;
  spanbar.starts=start; spanbar.ends=end;
  if ((!(subsections)) || (subsections.length===0))
    return false;
  var progress=fdjtDiv("progressbox","\u00A0");
  fdjtAppend(spanbar,spans);
  fdjtAppend(spans,progress);
  progress.style.left="0%";
  var i=0; while (i<subsections.length) {
    var subsection=subsections[i++];
    var spaninfo=subsection.sbookinfo;
    var spanstart; var spanend; var spanlen;
    if ((sectnum===0) && ((spaninfo.starts_at-start)>20)) {
      spanstart=start;  spanend=spaninfo.starts_at;
      spaninfo=headinfo; subsection=head;
      i--; sectnum++;}
    else {
      spanstart=spaninfo.starts_at; spanend=spaninfo.ends_at;
      sectnum++;}
    var span=_sbook_generate_span
      (sectnum,subsection,spaninfo.title,spanstart,spanend,len);
    /*
    span.setAttribute("startpercent",percent);
    percent=percent+(Math.round(10000*((spanend-spanstart)/len))/100);
    span.setAttribute("endpercent",percent);
    */
    if (subsection===child) {
      span.style.color='orange';
      span.style.backgroundColor='orange';
      span.style.borderColor='orange';}
    fdjtAppend(spans,span);
    last_info=spaninfo;}
  if ((end-last_info.ends_at)>20) {
    var span=_sbook_generate_span
      (sectnum,head,headinfo.title,last_info.ends_at,end,len);
    fdjtAppend(spanbar,span);}    
  return spanbar;
}

function _sbook_generate_span(sectnum,subsection,title,spanstart,spanend,len)
{
  var spanlen=spanend-spanstart;
  var span=fdjtDiv("sbookhudspan","\u00A0");
  var width=(Math.round(10000*(spanlen/len))/100)+"%";
  var odd=((sectnum%2)==1);
  if (odd) span.setAttribute("odd",sectnum);
  span.style.width=width;
  span.title=title+" ("+spanstart+"+"+(spanend-spanstart)+")";
  span.headelt=subsection;
  return span;
}

function _sbook_generate_subsections_div(subsections,start,end)
{
  if ((!(subsections)) || (subsections.length<1))
    return false;
  var subsections_div=fdjtDiv("subsections");
  var spanbar=fdjtDiv("spanbar");
  var spans=fdjtDiv("spans");
  var sectlist=fdjtDiv("sectlist");
  var len=end-start;
  var char_count=0; var size_base=70; var at_first=true;
  spanbar.starts=start; spanbar.ends=end;
  var progress=fdjtDiv("progressbox","\u00A0");
  fdjtAppend(spanbar,spans);
  fdjtAppend(spans,progress);
  var i=0; while (i<subsections.length) {
    var subsect=subsections[i++];
    var subsect_info=subsect.sbookinfo;
    char_count=char_count+2+subsect_info.title.length;}
  var i=0; while (i<subsections.length) {
    var odd=((i%2)==1);
    var subsection=subsections[i++];
    var info=subsection.sbookinfo;
    var spanlen=info.ends_at-info.starts_at;
    var span=fdjtDiv("sbookhudspan","\u00A0");
    var namespan=_sbook_add_head(sectlist,subsection,info,true);
    var width=100*(spanlen/len)+"%";
    namespan.fdjt_cohi=span;
    span.fdjt_cohi=namespan;
    if (odd) span.setAttribute("odd",i-1);
    span.style.width=width;
    span.title=info.title+
      " ("+info.starts_at+"+"+(info.ends_at-info.starts_at)+")";
    span.headelt=subsection;
    if (at_first) at_first=false;
    else fdjtInsertBefore(namespan," \u00B7 ");
    // span.onclick=sbook_spanelt_onclick;
    fdjtAppend(spans,span);}
  if (subsections.length>1)
    fdjtAppend(subsections_div,spanbar,"\n",sectlist);
  else fdjtAppend(subsections_div,sectlist);
  subsections_div.onmouseover=fdjtCoHi_onmouseover;
  subsections_div.onmouseout=fdjtCoHi_onmouseover;
  return subsections_div;
}

function _sbook_add_head(toc,head,headinfo,spanp)
{
  var level=headinfo.level;
  var sectid="SBOOKHEAD"+level;
  var secthead=document.getElementById(sectid);
  var content=headinfo.content;
  var parent=headinfo.sbook_head;
  var pinfo=sbook_getinfo(parent);
  var new_elt, content_elt;
  if (spanp) {
    new_elt=fdjtAnchor("#"+headinfo.id);
    new_elt.className='sbookhudsect';
    content_elt=new_elt;}
  else {
    var spanbar=_sbook_generate_spanbar(parent,pinfo,head);
    content_elt=fdjtAnchor("#"+headinfo.id);
    new_elt=fdjtDiv('sbookhudsect');
    if (spanbar) fdjtAppend(new_elt,spanbar);
    fdjtAppend(new_elt,content_elt);}
  new_elt.id=sectid;
  new_elt.headelt=head;
  if (head===document.body) {
    if (document.title)
      fdjtAppend(content_elt,document.title);
    else return null;}
  else if (!(content)) {
    // fdjtLog("No content for %o info=%o",head,headinfo);
    return null;}
  else {
    var i=0; while (i<content.length) {
      var node=content[i++].cloneNode(true);
      if (node) content_elt.appendChild(node);}}
  fdjtAppend(toc,new_elt);
  // fdjtLog("Added elts %o/%o w/span=%o",new_elt,content_elt,spanp);
  return new_elt;
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
    var id=fdjtForceId(head);
    if (sbook_debug)
      fdjtLog('Setting header info from %o/%s',head,id);
    var old_toc=$("SBOOKTOC");
    var new_toc=fdjtDiv("sbooktoc");
    var info=head.sbookinfo;
    if ((info) && (info.next) &&
	(info.next.sbookinfo) && (info.next.sbookinfo.title)) 
      $("SBOOKNEXT").title=info.next.sbookinfo.title;
    if ((info) && (info.prev) &&
	(info.prev.sbookinfo) && (info.prev.sbookinfo.title)) 
      $("SBOOKPREV").title=info.prev.sbookinfo.title;
    if (sbook_sync_echo_icon)
      try {
	var stable_id=sbookGetStableId(head);
	var uri=window.location.href;
	var hashpos=uri.indexOf('#');
	var new_uri=((hashpos>0) ? (uri.slice(0,hashpos)+'#'+stable_id) :
		     (uri+'#'+stable_id));
	var image_uri=sbook_echoes_icon(new_uri);
	var podspot_img=$("PODSPOTICON");
	if (podspot_img.src!==image_uri)
	  podspot_img.src=image_uri;}
      catch (e) {
	fdjtLog("Unexpected error with podspot: %o",e);}
    new_toc.id="SBOOKTOC";
    if (sbook_debug_hud)
      fdjtLog("Adding supersections %o",info.sbook_heads);
    var supersections_div=fdjtDiv("supersections");
    var supersections=info.sbook_heads;
    var i=0; while (i<supersections.length) {
      var supersection=supersections[i++];
      var relchild=((i<supersections.length) ? (supersections[i]) : (head));
      var head_elt=
	_sbook_add_head(supersections_div,
			supersection,
			supersection.sbookinfo,
			false);
      if (head_elt) head_elt.className="supersection";}
    fdjtAppend(new_toc,supersections_div);
    if (sbook_debug_hud)
      fdjtLog("Adding main elt %o %o",head,info);
    var sect_elt=_sbook_add_head(new_toc,head,info,false);
    if (sect_elt) {
      sect_elt.className='sbookhudsect';
      if ((info.title) && (info.title.length>60))
	sect_elt.style.fontSize="75%";}
    if (sbook_debug_hud)
      fdjtLog("Adding subsections %o",info.sub);
    if ((info.sub) && (info.sub.length>0))
      if ((sbook_list_subsections) || (!(sbook_use_spanbars))) {
	var subsections_div=
	  _sbook_generate_subsections_div(info.sub,info.starts_at,info.ends_at);
	fdjtAppend(new_toc,subsections_div);}
    fdjtReplace(old_toc,new_toc);
    sbook_toc=new_toc;
    window.title=document.title+" // "+info.title;
    // window.location="#"+newid;
    sbook_head=head;}
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

var sbookHUDHighlighted=false;
var sbookHUDHighlights=false;

function sbookHUDHighlight(secthead)
{
  if (secthead===sbookHUDHighlighted) return;
  if (!(sbook_electric_spanbars)) return;
  if (sbookHUDHighlighted) {
    var highlights=sbookHUDHighlights;
    sbookHUDHighlighted=false;
    sbookHUDHighlights=null;
    var i=0; while (i<highlights.length) {
      var sect=highlights[i++]; 
      sect.style.color=null; sect.style.backgroundColor=null;}}
  var highlights=new Array();
  var sections=fdjtGetChildrenByClassName(sbookHUD,"sbookhudsect");
  var spanelts=fdjtGetChildrenByClassName(sbookHUD,"sbookhudspan");
  var i=0; while (i<sections.length) {
    var sect=sections[i++];
    if (sect.headelt===secthead) {
      sect.style.color='orange';
      highlights.push(sect);}}
  i=0; while (i<spanelts.length) {
    var sect=spanelts[i++];
    if (sect.headelt===secthead) {
      sect.style.backgroundColor='orange';
      highlights.push(sect);}}
  sbookHUDHighlighted=secthead;
  sbookHUDHighlights=highlights;
}

/* Handlers */

function sbookHUDLive(flag,forced)
{
  if (flag===sbook_hudup)
    // Check that the body class agrees with the variable
    if ((sbook_hudup) ?
	(fdjtHasClass(document.body,"hudup")) :
	(!(fdjtHasClass(document.body,"hudup"))))
      return;
  if (sbookHUD)
    if (flag) {
      sbook_hudup=true;
      if (forced) sbook_hud_suppressed=false;
      fdjtAddClass(document.body,"hudup");
      document.body.setAttribute("HUDUP","yes");
      sbookHUD.focus();}
    else {
      sbook_hudup=false;
      if (forced) sbook_hud_suppressed=true;
      fdjtDropClass(document.body,"hudup");
      document.body.removeAttribute("HUDUP");
      sbookHUD.blur();
      fdjtScrollRestore();}
}

function sbookGetStableId(elt)
{
  var info=sbook_getinfo(elt);
  // fdjtLog("Scrolling to %o with id %s/%s",target,info.id,target.id);
  if ((info) && (info.id) && (!(info.id.search(/TMPID/)==0)))
    return info.id;
  else if ((elt.id) && (!(elt.id.search(/TMPID/)==0)))
    return elt.id;
  else return false;
}

function sbookScrollTo(elt)
{
  if (elt.sbookloc) sbookSetLocation(elt.sbookloc);
  if (fdjtHasAttrib(elt,"toclevel")) 
    fdjtSetHead(elt);
  else if (elt.sbook_head)
    fdjtSetHead(elt.sbook_head);
  fdjtScrollTo(elt,sbookGetStableId(elt),elt.sbook_head);
}

function sbookHUD_onclick(evt)
{
  var target=sbook_get_headelt(evt.target);
  if (target===null) return;
  evt.preventDefault();
  evt.cancelBubble=true;
  sbookSetHead(target.headelt);
  var info=sbook_getinfo(target.headelt);
  sbookScrollTo(target.headelt);
  // fdjtTmpLog("onclick sub=%o",info.sub);
  if (!((info.sub) && (info.sub.length>1))) {
    sbookHUDLive(false,true);}
}

function sbookHUD_hide()
{
  if (!(sbook_search_focus))
    sbookHUDLive(false);
}
var sbookHUD_hider=false;

var sbookHUD_highlighted_elt=false;

function sbookHUD_unhighlight(elt_arg)
{
  var elt=((elt_arg) || sbookHUD_highlighted_elt);
  if (elt) {
    var alt=((elt._sbook_span_elt) || (elt._sbook_name_elt) || (false));
    fdbDropClass(elt,"highlighted");}
}

function sbookHUD_onmouseover(evt)
{
  if (sbook_hud_suppressed) return;
  if (sbookHUD_hider) {
    clearTimeout(sbookHUD_hider);
    sbookHUD_hider=false;}
  sbookHUDLive(true);
  var target=sbook_get_headelt(evt.target);
  if (target===null) return;
  var head=target.headelt;
  sbookHUDHighlight(head);
  var hud=$("SBOOKHUD");
  if (head) fdjtScrollPreview(head,false,sbookScrollOffset());
  evt.cancelBubble=true;
  evt.preventDefault();
}

function sbookHUD_onmouseover(evt)
{
  if (sbook_hud_suppressed) return;
  if (sbookHUD_hider) {
    clearTimeout(sbookHUD_hider);
    sbookHUD_hider=false;}
  sbookHUDLive(true);
  var target=sbook_get_headelt(evt.target);
  if (target===null) return;
  var head=target.headelt;
  sbookHUDHighlight(head);
  var hud=$("SBOOKHUD");
  if (head) fdjtScrollPreview(head,false,sbookScrollOffset());
  evt.cancelBubble=true;
  evt.preventDefault();
}

function sbookHUD_onmouseout(evt)
{
  var rtarget=evt.relatedTarget;
  if (!(rtarget)) return;
  try {
    if (rtarget.ownerDocument!=document) {
      sbookHUD_hider=setTimeout(sbookHUD_hide,300);
      return;}
    // We'll get an error if we go out of the document,
    // in which case we probably want to hide anyway
    while (rtarget)
      if (rtarget===sbookHUD) return;
      else if (rtarget===document.body) break;
      else rtarget=rtarget.parentNode;}
  catch (e) {
    sbook_hud_suppressed=false;
    sbookHUD_hider=setTimeout(sbookHUD_hide,300);
    return;}
  sbook_hud_suppressed=false;
  sbookHUD_hider=setTimeout(sbookHUD_hide,300);
}

function sbookHUD_Next(evt)
{
  var curinfo=sbook_head.sbookinfo;
  var goto=curinfo.next;
  if (!(goto)) goto=curinfo.sbook_head.sbookinfo.next;
  if (goto) {
    sbookSetHead(goto);
    sbookScrollTo(goto);}
  if (evt) evt.cancelBubble=true;
  sbookHUDLive(false);
}

function sbookHUD_Prev(evt)
{
  var curinfo=sbook_head.sbookinfo;
  var goto=curinfo.prev;
  if (!(goto)) goto=curinfo.sbook_head.sbookinfo.prev;
  if (goto) {
    sbookSetHead(goto);
    sbookScrollTo(goto);}
  if (evt) evt.cancelBubble=true;
  sbookHUDLive(false);
}

/* Tracking position within the document. */

/* This initializes the HUD state to the initial location with the
   document, using the hash value if there is one. */ 
function sbookHUD_Init()
{
  var hash=window.location.hash, target=document.body;
  if ((typeof hash === "string") && (hash.length>0)) {
    if ((hash[0]==='#') && (hash.length>1))
      target=sbook_hashmap[hash.slice(1)];
    else target=sbook_hashmap[hash];}
  if (!(target))
    target=document.body;
  if (target!=document.body) target.scrollIntoView();
  sbookSetHead(target);
  if (target.sbookloc) sbookSetLocation(target.sbookloc);
  // window.location=window.location;
}

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
  if (sbook_hudup) return;
  /* If you're over the HUD, don't do anything. */
  else if (fdjtHasParent(evt.target,sbookHUD))
    return;
  /*     THis didn't seem to work portably. */
  /*
    if ((sbookHUD_at_top) ? (evt.clientY<sbookHUD.offsetHeight) :
    (evt.clientY>sbookHUD.offsetTop)) {
    return;}
  */
  /* If you're not, go back to the saved scroll location */
  if (fdjtScrollRestore()) return;
  /* Now, we try to find a top level element to sort out whether
     we need to update the location or section head. */
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
  /* If you're over the HUD, don't do anything. */
  if (evt.screenX<sbookHUD.offsetHeight) return;
  /* If you're not, go back to the saved scroll location */
  if (fdjtScrollRestore()) return;
  /* if ((sbook_hudup) && (!(sbookHUD_forced))) return; */
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

/* Echoes */

var sbook_echo_head=false;
var sbook_tribes=false;
function sbook_podspot_uri(uri,hash,title,tribes)
{
  var hashpos=uri.indexOf('#');
  fdjtTrace("Getting podspot for %s",uri);
  if ((hash) && (hashpos>=0))
    uri=uri.slice(0,hashpos)+'#'+hash;
  else uri=uri+'#'+hash;
  var href=sbook_webechoes_root+"podspot.fdcgi?"+
    "IFRAME=yes&PODSPOT=yes&DIALOG=yes";
  if (uri) href=href+"&URI="+encodeURIComponent(uri);
  if (title) href=href+"&TITLE="+encodeURIComponent(title);
  if (tribes) {
    if ((typeof tribes === "string") && (tribes.indexOf(';')>0))
      tribes=tribes.split(';');
    if (typeof tribes === "string")
      href=href+"&TRIBE="+encodeURIComponent(tribes);
    else if ((typeof tribes === "object") && (tribes instanceof Array)) {
      var i=0; while (i<tribes.length) 
		 href=href+"&TRIBE="+encodeURIComponent(tribes[i++]);}
    else fdjtWarn("Weird TRIBES argument for podspot %o",tribes);}
  return href;
}

function sbookHUD_SocialMode(evt)
{
  if (sbook_echo_head != sbook_head) {
    sbook_echoes.src=
      sbook_podspot_uri(location.href,sbookGetStableId(sbook_head),
			sbook_title_path(sbook_head),sbook_tribes);
    sbook_echo_head=sbook_head;}
  fdjtToggleClass(document.body,"social","mode");
  fdjtDropClass(document.body,"search","mode");
  if (evt) {
    evt.preventDefault();
    evt.cancelBubble=true;}
  if ((evt) && (evt.target)) evt.target.blur();
  $("SBOOKECHOESBUTTON").blur();
}

function sbookHUD_SearchMode(evt)
{
  if (evt) {
    evt.preventDefault();}
  if ((evt) && (evt.target)) evt.target.blur();
  $("SBOOKSEARCHBUTTON").blur();
  if (!(sbook_full_cloud)) {
    var full_cloud=sbookFullCloud();
    var input_elt=$("SBOOKSEARCHTEXT");
    if ((input_elt.value) && (input_elt.value.length===0))
      fdjtSetCompletions("SBOOKSEARCHCOMPLETIONS",full_cloud);}
  if (fdjtHasClass(document.body,"search","mode"))  {
    fdjtDropClass(document.body,"results","mode");
    fdjtDropClass(document.body,"social","mode");
    fdjtDropClass(document.body,"search","mode");}
  else {
    fdjtDropClass(document.body,"social","mode");
    fdjtAddClass(document.body,"search","mode");
    $("SBOOKSEARCHTEXT").focus();}
}

/* Default keystrokes */

function sbook_onkeypress(evt)
{
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
  createSBOOKHUD();
  sbookHUD_Init();
  document.body.onmouseover=sbook_onmouseover;
  document.body.onclick=sbook_onclick;
  window.onscroll=sbook_onscroll;
  window.onkeypress=sbook_onkeypress;
  if (knoHTMLSetup) knoHTMLSetup();
  setupTags();
  sbookFullCloud();
  importSocialData();
  /* _sbook_createHUDSocial(); */
  _sbook_setup=true;
}

fdjtLoadMessage("Loaded sbooks module");
fdjtTrace("Working off of moby")

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
