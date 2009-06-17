/* -*- Mode: Javascript; -*- */

var sbooks_id="$Id$";
var sbooks_version=parseInt("$Revision$".slice(10,-1));

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
// This is a list of all the terminal content nodes
var sbook_nodes=[];
// This is a list of the identified heads
var sbook_heads=[];

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

// When defined, this is a precomputed TOC for this file (NYI)
var sbook_local_toc=false;
// This is the TOC in which this document is embedded (NYI)
var sbook_context_toc={};

// Flavors of tags
//  prime: humanly indicated as important to an item
//  manual: humanly indicated
//  auto: automatically generated
//  direct: assigned to a particular item
//  contextual: inherited through the TOC hierarchy
//  inferred: implies through Knowlet rules (typically genls)
// The core search algorithm computes a simple intersection
//  of the tagged items, but the information above is used in
//  scoring the results.

// This is a table mapping tags (dterms) to elements (or IDs)
//  Note that this includes the genls of actual tags; the index
//   sbook_dindex is reserved for actual tags.
var sbook_index={_all: []};
// This is a table mapping prime (focal) tags (dterms) to elements (or IDs)
var sbook_prime_index={_all: []};
// This is the 'direct index' of dterms which are explicitly referenced
var sbook_direct_index={_all: []};
// This is the contextual index of items where the tag comes from the context
var sbook_contextual_index={_all: []};

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

function sbook_compute_offsets(node)
{
  if (!(node)) return node;
  else if (node.Xoff) return node;
  else {
    var parent=sbook_compute_offsets(node.offsetParent);
    if (parent) {
      var xoff=((node.offsetLeft)||(0))+parent.Xoff;
      var yoff=((node.offsetTop)||(0))+parent.Yoff;
      node.Xoff=xoff; node.Yoff=yoff;
      return node;}
    else {
      node.Xoff=node.offsetLeft; node.Yoff=node.offsetTop;
      return node;}}
}


/* Building the TOC */

var debug_toc_build=false;
var trace_toc_build=false;
var _sbook_toc_built=false;

var _total_tagged_count=0; var _total_tag_count=0;

function sbookBuildMetadata()
{
  var start=new Date();
  if (_sbook_toc_built) return;
  fdjtLog('Starting to build metadata from DOM');
  var body=document.body, children=body.childNodes, level=false;
  var bodyinfo=new Object();
  var tocstate={curlevel: 0,idserial:0,location: 0,tagstack: []};
  tocstate.curhead=body; tocstate.curinfo=bodyinfo;
  tocstate.knowlet=knowlet;
  // Location is an indication of distance into the document
  var location=0;
  body.sbookinfo=bodyinfo; bodyinfo.starts_at=0;
  bodyinfo.level=0; bodyinfo.sub=new Array();
  bodyinfo.sbook_head=false; bodyinfo.sbook_heads=new Array();
  if (!(body.id)) body.id="TMPIDBODY";
  bodyinfo.id=body.id;
  /* Build the metadata */
  var i=0; while (i<children.length) {
    var child=children[i++];
    sbook_toc_builder(child,tocstate);} 
  var scan=tocstate.curhead, scaninfo=tocstate.curinfo;
  /* Close off all of the open spans in the TOC */
  while (scan) {
    scaninfo.ends_at=tocstate.location;
    scan=scaninfo.sbook_head;
    if (!(scan)) scan=false;
    if (scan) scaninfo=scan.sbookinfo;}
  /* Sort the nodes by their offset in the document */
  sbook_nodes.sort(function(x,y) {
      if (x.Yoff<y.Yoff) return -1;
      else if (x.Yoff===y.Yoff) return 0;
      else return 1;});
  var done=new Date();
  fdjtLog('Finished gather metadata in %f secs over %d/%d heads/nodes',
	  (done.getTime()-start.getTime())/1000,
	  sbook_heads.length,sbook_nodes.length);
  fdjtLog("Found %d tags over %d elements: %s now has %d dterms",
	  _total_tag_count,_total_tagged_count,
	  knowlet.name,knowlet.alldterms.length);
  _sbook_toc_build=true;
}

function _sbook_transplant_content(content)
{
  var transplanted=[];
  var i=0; var j=0;
  while (i<content.length) {
    var transplant=fdjtTransplant(content[i++]);
    if (transplant) transplanted[j++]=transplant;}
  return transplanted;
}
function _sbook_get_title(head)
{
  var title=fdjtCacheAttrib(head,title);
  if (!(title))
    return fdjtTextify(head,true);
  else if (typeof title === "string")
    if (title==="") return false;
    else return title;
  else return fdjtTextify(title,true);
}

function _sbook_build_head(head,tocstate,level,curhead,curinfo,curlevel)
{
  var headinfo=sbook_needinfo(head);
  var headid=fdjtGuessAnchor(head);
  /* Update global tables, arrays */
  sbook_compute_offsets(head);
  sbook_nodes.push(head);
  sbook_heads.push(head);
  head.sbookloc=tocstate.location;
  if (headid) sbook_hashmap[headid]=head;
  else headid=fdjtForceId(head);
  if (debug_toc_build)
    fdjtLog("Found head item %o under %o at level %d w/id=#%s ",
	    head,curhead,level,headid);
  /* Iniitalize the headinfo */
  head.sbookinfo=headinfo;
  headinfo.starts_at=tocstate.location;
  headinfo.elt=head; headinfo.level=level;
  headinfo.sub=new Array(); headinfo.id=headid;
  headinfo.content=_sbook_transplant_content(head.childNodes);
  headinfo.title=_sbook_get_title(head);
  headinfo.next=false; headinfo.prev=false;
  if (level>curlevel) {
    /* This is the simple case where we are a subhead
       of the current head. */
    headinfo.sbook_head=curhead;
    if (!(curinfo.intro_ends_at))
      curinfo.intro_ends_at=tocstate.location;
    curinfo.sub.push(head);}
  else {
    /* We're not a subhead, so we're popping up at least one level. */
    var scan=curhead;
    var scaninfo=curinfo;
    var scanlevel=curinfo.level;
    /* Climb the stack of headers, closing off entries and setting up
       prev/next pointers where needed. */
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
	scan=next; scaninfo=nextinfo; scanlevel=nextinfo.level;
	tocstate.tagstack.pop();}
      else {
	scan=document.body;
	scaninfo=sbook_getinfo(scan);
	scanlevel=0;
	break;}}
    if (debug_toc_build)
      fdjtLog("Found parent: up=%o, upinfo=%o, atlevel=%d, sbook_head=%o",
	      scan,scaninfo,scaninfo.level,scaninfo.sbook_head);
    /* We've found the head for this item. */
    headinfo.sbook_head=scan;
    scaninfo.sub.push(head);} /* handled below */
  /* Add yourself to your children's subsections */
  var sup=headinfo.sbook_head;
  var supinfo=sbook_getinfo(sup);
  var newheads=new Array();
  newheads=newheads.concat(supinfo.sbook_heads); newheads.push(sup);
  headinfo.sbook_heads=newheads;
  if ((trace_toc_build) || (debug_toc_build))
    fdjtLog("@%d: Found head=%o, headinfo=%o, sbook_head=%o",
	    tocstate.location,head,headinfo,headinfo.sbook_head);
  /* Update the toc state */
  tocstate.curhead=head;
  tocstate.curinfo=headinfo;
  tocstate.curlevel=level;
  tocstate.location=tocstate.location+fdjtFlatWidth(head);  
}

function sbook_toc_builder(child,tocstate)
{
  // fdjtTrace("toc_builder %o %o",tocstate,child);
  var location=tocstate.location;
  var curhead=tocstate.curhead;
  var curinfo=tocstate.curinfo;
  var curlevel=tocstate.curlevel;
  var level=0;
  // Location tracking and TOC building
  if (child.nodeType==Node.TEXT_NODE) {
    var width=child.nodeValue.length;
    child.sbookloc=tocstate.location+width/2;
    tocstate.location=tocstate.location+width;}
  else if (child.nodeType!=Node.ELEMENT_NODE)
    child.sbook_head=curhead;
  else if (level=sbookHeadLevel(child)) 
    _sbook_build_head(child,tocstate,level,curhead,curinfo,curlevel);
  else {
    var width=fdjtFlatWidth(child);
    var loc=tocstate.location+width/2;
    tocstate.location=tocstate.location+width;
    if ((child.tagName) && (child.tagName==="DIV")) {
      var children=child.childNodes;
      var nodeslength=sbook_nodes.length;
      if (children) {
	var i=0; while (i<children.length)
		   sbook_toc_builder(children[i++],tocstate);}
      if ((fdjtHasContent(child)) || (fdjtHasAttrib(child,'tags'))) {
	child.sbook_head=curhead;
	child.sbookloc=loc;}
      /* If none of the included nodes marked their location,
	 mark the DIV's location. */
      if (sbook_nodes.length===nodeslength) {
	sbook_compute_offsets(child);
	sbook_nodes.push(child);}}
    else {
      sbook_compute_offsets(child);
      sbook_nodes.push(child);
      child.sbookloc=loc;
      child.sbook_head=curhead;}}
  if ((child.getAttribute) && (child.getAttribute("TAGS"))) {
    var tagstring=child.getAttribute("TAGS");
    var tags=((knowlet) ?
	      (knowlet.segmentString(fdjtUnEntify(tagstring),';')) :
	      (fdjtSemiSplit(fdjtUnEntify(tagstring))));
    var knowdes=[];
    var i=0; while (i<tags.length) {
      var tag=tags[i++]; var knowde=tag;
      _total_tag_count++;
      if (tag.length===0) continue;
      if (knowlet)
	knowde=knowlet.handleSubjectEntry
	  (((tag[0]==="*") || (tag[0]==="~")) ? (tag.slice(1)) : (tag));
      knowdes.push(knowde);
      sbookAddTag(child,knowde,(tag[0]==="*"),false,true,tocstate.knowlet);
      if (level) tocstate.tagstack.push([]);}
    _total_tagged_count++;}
  else if (level) tocstate.tagstack.push([]);
  else {}
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
  sbookSetEchoes(sbook_search_echoes(query));
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
    var scan=sbook_getinfo(info.elt.headelt);
    while (scan) {
      if (scan.title) title=title+" // "+scan.title;
      scan=sbook_getinfo(scan.elt.headlet);}
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
    /*
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
    */
    // fdjtTrace("Replacing TOC with %o",navhud);
    fdjtReplace("SBOOKTOC",navhud);
    window.title=document.title+" // "+info.title;
    // window.location="#"+newid;
    sbook_head=head;}
  if (sbookHUDechoes)
    sbookSetEchoes(sbookGetEchoesUnder(sbook_head.id));
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

var sbook_focus=false;
var sbook_click_focus=false;
var sbook_click_focus_time=false;
var sbook_focus_tags=false;
var sbook_last_x=false;
var sbook_last_y=false;
var sbook_focus_delay=100;

var sbook_track_window=25;

function sbookSetFocus(target)
{
  if (!(target)) return null;
  else if (target===sbook_focus) return target;
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
    sbook_focus_tags=tags;}
  sbook_focus=target;
  if (target) {
    var head=(((target.sbookinfo) && (target.sbookinfo.level)) ?
	      (target) : (target.sbook_head));
    if ((head) && (sbook_head!=head)) sbookSetHead(head);
    if ((target) && (target.sbookloc))
      sbookSetLocation(target.sbookloc);}
}

function sbookGetXYFocus(xoff,yoff)
{
  if (!(xoff)) {
    xoff=sbook_last_x+window.scrollX;
    yoff=sbook_last_y+window.scrollY;}
  var nodes=sbook_nodes;
  var bot=0; var top=nodes.length-1; var mid=Math.floor(top/2);
  var node=nodes[mid]; var next=nodes[mid+1]; var target=false;
  while ((node) && (next) &&
	 ((!(((node.Yoff)<yoff) && ((next.Yoff)>yoff))))) {
    if (node.Yoff===yoff) break;
    if (yoff<node.Yoff) top=mid-1;
    else if (yoff>node.Yoff) bot=mid+1;
    else {}
    mid=bot+Math.floor((top-bot)/2);
    node=nodes[mid]; next=nodes[mid+1];}
  return node;
}

function sbook_onmouseover(evt)
{
  var target=evt.target;
  /* If you're previewing, ignore mouse action */
  if (_fdjt_saved_scroll) return;
  /* If you're over the HUD, don't do anything */
  if (fdjtHasParent(evt.target,sbookHUD)) return;
  /* If you have a saved scroll location, just restore it. */
  if (fdjtScrollRestore()) return;
  /* Now, we try to find a top level element */
  while (target)
    if (target.sbook_head) break;
    else if (target.sbookinfo) break;
    else if (target.parentNode===document.body) break;
    else target=target.parentNode;
  /* These are top level elements which aren't much use */
  if ((target===null) || (target===document.body) ||
      (!((target) && ((target.Xoff) || (target.Yoff)))))
    target=sbookGetXYFocus
      (window.scrollX+evt.clientX,window.scrollY+evt.clientY);
  fdjtDelayHandler
    (sbook_focus_delay,sbookSetFocus,target,document.body,"setfocus");
}

function sbook_onmousemove(evt)
{
  var target=evt.target;
  /* If you're previewing, ignore mouse action */
  if (_fdjt_saved_scroll) return;
  /* Save mouse positions */
  sbook_last_x=evt.clientX; sbook_last_y=evt.clientY;
  /* Now, we try to find a top level element to sort out whether
     we need to update the location or section head. */
  while (target)
    if (target.sbook_head) break;
    else if (target.sbookinfo) break;
    else if (target.parentNode===document.body) break;
    else target=target.parentNode;
  /* These are all cases which onmouseover will handle */
  if ((target) && ((target.Xoff) || (target.Yoff))) return;
  target=sbookGetXYFocus(window.scrollX+evt.clientX,window.scrollY+evt.clientY);
  fdjtDelayHandler
    (sbook_focus_delay,sbookSetFocus,target,document.body,"setfocus");
}

function sbook_onscroll(evt)
{
  /* If you're previewing, ignore mouse action */
  if (_fdjt_saved_scroll) return;
  var xoff=window.scrollX+sbook_last_x;
  var yoff=window.scrollY+sbook_last_y;
  var target=sbookGetXYFocus(xoff,yoff);
  fdjtDelayHandler
    (sbook_focus_delay,sbookSetFocus,target,document.body,"setfocus");
}

function sbook_onkeydown(evt)
{
  // fdjtTrace("keydown %o %o",evt,evt.keyCode);
  if (evt.keyCode===27) { /* Escape works anywhere */
    if (sbook_hudup) {
      sbookSetHUD(false);
      $("SBOOKSEARCHTEXT").blur();}
    else sbookSetHUD(true);
    return;}  var target=evt.target;
  while (target)
    if ((target.tagName==="INPUT") ||
	(target.tagName==="TEXTAREA") ||
	(target.className==="sbooknokeys"))
      return true;
    else target=target.parentNode;
  if (!(sbook_hudup))
    if (evt.keyCode===16)  
      fdjtAddClass(document.body,"hudhover");
}

function sbook_onkeyup(evt)
{
  // fdjtTrace("keyup %o %o",evt,evt.keyCode);
  var target=evt.target;
  while (target)
    if ((target.tagName==="INPUT") ||
	(target.tagName==="TEXTAREA") ||
	(target.className==="sbooknokeys"))
      return true;
    else target=target.parentNode;
  if (!(sbook_hudup))
    if (evt.keyCode===16) 
      fdjtDropClass(document.body,"hudhover");
}

function sbook_onkeypress(evt)
{
  // fdjtTrace("%o: kc=%o cc=%o",evt,evt.keyCode,evt.charCode);
  var target=evt.target;
  /* Make sure you're not inputting text or doing anything
     else on keypresses*/
  if (fdjtIsTextInput(target)) return true;
  else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
  else if (evt.keyCode===40) {   /* Space */
    var info=sbook_head.sbookinfo;
    if (info.sub.length) sbookScrollTo(info.sub[0]);}
  /* Backspace or Delete */
  else if ((evt.keyCode===73) || (evt.keyCode===105)) {
    window.scrollBy(0,-window.innerHeight);
    sbookSetFocus(sbookGetXYFocus());}
  else if (evt.keyCode===36) { /* Home */
    sbookScrollTo(sbook_head);}
  else if (evt.keyCode===37) { /* LEFT arrow */
    var info=sbook_head.sbookinfo;
    if (info.prev) sbookScrollTo(info.prev);}
  else if (evt.keyCode===38) { /* UP arrow */
    var info=sbook_head.sbookinfo;
    if (info.sbook_head) sbookScrollTo(info.sbook_head);}
  else if (evt.keyCode===39) { /* RIGHT arrow */
    var info=sbook_head.sbookinfo;
    if (info.next) sbookScrollTo(info.next);}
  else if (evt.charCode===43) { /* + sign */
    sbook_open_ping();}
  else if ((evt.charCode===105) || (evt.charCode===84)) { /* S or s */
    sbookSetHUD("hudup","search");
    $("SBOOKSEARCHTEXT").focus();}
  else if ((evt.charCode===116)||(evt.charCode===84)) { /* T or t */
    sbookSetHUD("hudup","toc");
    $("SBOOKSEARCHTEXT").focus();}
  else if ((evt.keyCode===8) || (evt.keyCode===46)) { /* Backspace or Delete */
    window.scrollBy(0,-window.innerHeight);
    sbookSetFocus(sbookGetXYFocus());}
  else return;
  evt.preventDefault();
}

function sbook_onclick(evt)
{
  var target=evt.target;
  while (target)
    if (target===sbookHUD) return;
    else target=target.parentNode;
  if (evt.shiftKey) {
    if (sbook_hudup)
      sbookSetHUD(false);
    else sbookSetHUD(true);
    evt.cancelBubble=true; evt.preventDefault();
    return false;}
  else sbookSetHUD(false);
  target=evt.target;
  /* If you're not, go back to the saved scroll location */
  if (fdjtScrollRestore()) return;
  while (target)
    if (target.sbook_head) break;
    else if (target.Xoff) break;
    else if (target.parentNode===document.body) break;
    else target=target.parentNode;
  if (target===null) return;
  if (target===sbookHUD) return;
  if ((target.sbookinfo) && (target.sbookinfo.level)) 
    sbookSetHead(target);
  else if (target.sbook_head)
    sbookSetHead(target.sbook_head);
  sbook_click_focus=target;
  sbook_click_focus_time=fdjtTick();
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

/* Initialization */

var _sbook_setup=false;

function sbookSetup()
{
  if (_sbook_setup) return;
  if (!((fdjt_setup_started))) fdjtSetup();
  if (_sbook_setup) return;
  if (knoHTMLSetup) knoHTMLSetup();
  sbookBuildMetadata();
  importSocialData();
  createSBOOKHUD();
  sbookHUD_Init();
  sbookHUD.className="toc";
  sbook_base=getsbookbase();
  window.onmouseover=sbook_onmouseover;
  window.onmousemove=sbook_onmousemove;
  // document.body.onclick=sbook_onclick;
  window.onclick=sbook_onclick;
  window.onscroll=sbook_onscroll;
  window.onkeypress=sbook_onkeypress;
  window.onkeydown=sbook_onkeydown;
  window.onkeyup=sbook_onkeyup;
  sbookFullCloud();
  /* _sbook_createHUDSocial(); */
  _sbook_setup=true;
}

fdjtAddSetup(sbookSetup);

fdjtLoadMessage("Loaded sbooks module");
//fdjtTrace("Working off of moby")
//fdjtTrace("Working off of localhost")

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
