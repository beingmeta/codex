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

/* Source metadata */

// When defined, this is a precomputed TOC for this file (NYI)
var sbook_local_toc=false;
// This is the TOC in which this document is embedded (NYI)
var sbook_context_toc={};
// Imported social info
var sbook_social_info=
  ((typeof sbook_social_info === 'undefined')?(false):(sbook_social_info));
// Imported gloss information
var sbook_gloss_data=
  ((typeof sbook_gloss_data === 'undefined')?(false):(sbook_gloss_data));
// Imported gloss information
var sbook_user_overlays=
  ((typeof sbook_user_overlays === 'undefined')?(false):(sbook_user_overlays));

/* Derived metadata */

// This is a list of content nodes
var sbook_nodes=[];
// This is a list of the identified heads
var sbook_heads=[];
// This table maps IDs or NAMEs to elements.  This is different
//  from just their XML ids, because elements that have no ID by
//  a nearby named anchor will appear in this table.
var sbook_hashmap={};
// Array of sbook info, mapping from _fdjtid to objects
var sbook_info=[];
// Array of sbook info, mapping from element IDs objects
var sbook_idinfo={};

/* Tag indices */

// This is a table mapping tags (dterms) to elements (or IDs)
//  Note that this includes the genls of actual tags; the index
//   sbook_dindex is reserved for actual tags.
var sbook_index={_all: []};
// This is a table mapping prime (focal) tags (dterms) to elements (or IDs)
var sbook_prime_index={_all: []};
// This is the 'direct index' of dterms which are explicitly referenced
var sbook_direct_index={_all: []};
// This is the index of dterms/tags to items that don't include genls
var sbook_dterm_index={_all: []};
// This is a straight 'keyword' index mapping keywords to elements (or IDs)
// This is actually just a cache of searches which are done on demand
var sbook_word_index={};
// This is an array of all tags
var sbook_all_tags=[];
// Whether the index is a hybrid of strings and DOM nodes
var sbook_hybrid_index=false;

/* Network connection settings */

// Where to go for your glosses
var sbook_glosses_root="https://app.sbooks.net/sbook/";
// This is the AJAX sbook mark uri
var sbook_mark_uri="/sbook/glossmark.fdcgi?AJAX=yes";
// This is the JSONP sbook mark uri
var sbook_jsonping_uri="https://apps.sbooks.net/sbook/glossmark.fdcgi?JSONP=yes";
// This is the hostname for the sbookserver.
var sbook_server=false;
// This is an array for looking up sbook servers.
var sbook_servers=[[/.sbooks.net$/g,"glosses.sbooks.net"]];
//var sbook_servers=[];
// This is the default server
var sbook_default_server="glosses.sbooks.net";
// This (when needed) is the iframe bridge for sBooks requests
var sbook_ibridge=false;
// Whether this sbook is set up for offline reading
var sbook_offline=
  ((typeof sbook_offline === "undefined")?(false):(sbook_offline)); 

// There be icons here!
var sbook_graphics_root="http://static.beingmeta.com/graphics/";
function sbicon(name,suffix) { return sbook_graphics_root+name+(suffix||"");}

/* User information */

// This is the sbook user, which we're careful not to override
var sbook_user=((typeof sbook_user === "undefined")?(false):(sbook_user));
// This is a javascript object with information about the user
var sbook_user_data=
  ((typeof sbook_user_data === "undefined")?(false):(sbook_user_data));
// This is the picture to use for the user
var sbook_user_img=
  ((typeof sbook_user_img === "undefined")?(false):(sbook_user_img));
// Whether the user has enabled feed posting
var sbook_user_canpost=
  ((typeof sbook_user_canpost === "undefined")?(false):(sbook_user_canpost));
// These are the friends of the user
var sbook_friends=
  ((typeof sbook_friends === "undefined")?[]:(sbook_friends));
// These are the 'tribes' (associated groups) of the user
var sbook_tribes=
  ((typeof sbook_tribes === "undefined")?[]:(sbook_tribes));
// These are a set of common group/user tags for this particular user.
var sbook_user_dist=
  ((typeof sbook_user_dist === "undefined")?[]:(sbook_user_dist));
// These are the overlays that the user can write
var sbook_overlays=
  ((typeof sbook_overlays === "undefined")?[]:(sbook_overlays));

/* Defining information for the document */

// This is the base URI for this document, also known as the REFURI
// A document (for instance an anthology or collection) may include
// several refuri's, but this is the default.
var sbook_refuri=false;
// These are the refuris used in this document
var sbook_refuris=[];
// This is the document URI, which is usually the same as the REFURI.
var sbook_docuri=false;
// This is the base ID for fragment/element identifiers in this
// document.
var sbook_baseid=false;
// Controls on excerpts
var sbook_max_excerpt=false;
// This is mostly a kludge to ignore selections which are really just clicks
var sbook_min_excerpt=5;
// This is the unique DOC identifier used by myCopy social DRM.
var sbook_mycopyid=false; 

/* UI State information */

// This is the HUD top element
var sbookHUD=false;
// Whether the HUD is up
var sbook_mode=false;
// Whether we're moving ourselves
var sbook_egomotion=false;
// This is the last mode which was active
var sbook_last_mode="minimal";
// Whether preview mode is engaged (the element being previewed)
var sbook_preview=false; 
// The last element being previewed
var sbook_last_preview=false; 
// This is the content root
var sbook_root=false;
// This is where the content starts
var sbook_start=false;
// This is the current head element
var sbook_head=false;
// This is the 'focus element' approximately under the mouse.
var sbook_focus=false;
// This is the saved title for the current focus
var sbook_focus_title=false;
// This is the last explicit target of a jump or mark.
var sbook_target=false;
// This is the saved title for the current target
var sbook_target_title=false;
// This is the target for a preview which can be activated by
//  the control key
var sbook_preview_target=false;
// This is when the mouse was pressed for a preview
var sbook_preview_mousedown=false;
// This is when the mouse was released from a preview
var sbook_preview_mouseup=false;
// This is the current query
var sbook_query=false;
// Which sources to search.  False to exclude glosses, true to include
//  all glosses, and an array to include selected glosses
var sbook_sources=true;
// Whether the page has been scrolled
var sbook_scrolled=false;
// Whether to switch headings on all mouseovers
var sbook_close_tracking=true;
// If a search has fewer than this many results,
//  it just displays them
var sbook_search_gotlucky=5;
//  Whether the the search input has the focus
var sbook_search_focus=false;
// Whether to display verbose tool tips
var sbook_noisy_tooltips=false;
// Whether the UI is touch based
var sbook_touch=false;
// Whether to do gesture recognition
var sbook_gestures=false;
// Whether to handle edge taps/clicks
var sbook_edge_taps=true;
// Modifies some gestures to be more accessible
var sbook_accessible=false;
// Whether the HUD should track the scroll position absolutely
// This is neccessary for viewport based browsers like the iPad
var sbook_floating_hud=false;

// Whether to startup with the help screen
var sbook_help_on_startup=false;
// How long to flash HUD elements when they change (milliseconds)
var sbook_hud_flash=false;
// The default value for the above value when engaged (milliseconds)
var sbook_default_hud_flash=2000;

/* Control of initial document scan */

// Rules for building the TOC.  These can be extended.
var sbook_headlevels=
  {"H1": 1,"H2": 2,"H3": 3,"H4": 4,"H5": 5, "H6": 6, "H7": 7};
// These are selectors for terminal elements
var sbook_terminals=[];
// These are selectors for ignored elements
var sbook_ignored=[];
// These are selectors for non-block elements which get IDs
var sbook_idify=[];
// Whether or not to assign IDs automatically based on structure
// Ideally, this is done by the publisher using automatic tools
var sbook_autoid=false;
// Whether to build the index
var sbook_build_index=true;
// This is a count of all tagged elements
var sbook_tagged_count=0;
// An array of element selectors which contain tags
var sbook_tag_tags=[];
// An array of element selectors which shouldn't be tagged/taggable
var sbook_notags=[];
// This is the deepest TOC level to show for navigation
var sbook_tocmax=false;
// Whether to embed qricons with glossmarks
var sbook_glossmark_qricons=false;
// Whether to tag headings with qricons
var sbook_heading_qricons=false;
// Use spanbars in the HUD
var sbook_use_spanbars=true;
// Show subsections too
var sbook_list_subsections=true;
// Electro highlights
var sbook_electric_spanbars=false;
// Focus rules
var sbook_focus_rules=[];
// Whether to do pagination
var sbook_pageview=false;
// Whether to be sparse
var sbook_sparse=false;

/* Some layout information */
var sbook_pageheads=false;
var sbook_pagefeet=false;
var sbook_tocmajor=1;
var sbook_pageblocks=false;
var sbook_avoid_pagehead=false;
var sbook_avoid_pagefoot=false;
var sbook_fullpages=[".sbookfullpage",".titlepage"];

/* Debugging flags */

// Whether to debug generally
var sbook_debug=false;
// Whether to debug the HUD
var sbook_trace_hud=false;
// Whether to trace mode changes
var sbook_trace_mode=false;
// Whether to debug the NAV/TOC HUD
var sbook_trace_nav_hud=false;
// Whether to debug search
var sbook_trace_search=0;
// Whether to debug clouds
var sbook_trace_clouds=0;
// Whether to trace focus
var sbook_trace_focus=false;
// Whether to trace selection
var sbook_trace_selection=false;
// Whether we're debugging locations
var sbook_trace_locations=false;
// Whether we're debugging server interaction
var sbook_trace_network=0;
// Whether to debug startup
var sbook_trace_startup=0;
// Whether to trace navigation
var sbook_trace_nav=false;
// Whether to trace paging
var sbook_trace_paging=false;
// Whether to trace gesture recognition
var sbook_trace_gestures=false;

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

function sbook_trace(handler,cxt)
{
  if (cxt.target)
    fdjtLog
      ("[%f] %s %o in %o: mode%s=%o, focus%s=%o, target=%o, head=%o preview=%o",
       fdjtElapsedTime(),handler,cxt,cxt.target,
       ((sbook_preview)?("(preview)"):""),sbook_mode,
       ((sbook_target)?("(targeted)"):""),
       sbook_focus,sbook_target,sbook_head,sbook_preview);
  else fdjtLog
	 ("[%f] %s %o: mode%s=%o, focus%s=%o, target=%o, head=%o preview=%o",
	  fdjtElapsedTime(),handler,cxt,
	  ((sbook_preview)?("(preview)"):""),sbook_mode,
	  ((sbook_target)?("(targeted)"):""),
	  sbook_focus,sbook_target,sbook_head,sbook_preview);
}

/* Basic SBOOK functions */

function sbookHeadLevel(elt)
{
  var tl=
    elt.getAttribute("toclevel")||
    elt.getAttribute("data-toclevel")||
    ((elt.getAtttributeNS)&&
     (elt.getAtttributeNS("http://sbooks.net/","toclevel")));
  if (tl) {
    if (typeof tl === "number") return tl;
    else if ((tl==="no") || (tl==="none"))
      return false;
    else if (typeof tl === "string")
      tl=parseInt(tl);
    else return false;
    if ((typeof tl === "number") && (tl>=0))
      return tl;
    else return false;}
  var classname=elt.className;
  if ((classname)&&(classname.search(/\bsbook/)>=0))
    if (classname.search(/\bsbooknothead\b/)>=0) return false;
    else if (classname.search(/\bsbookignore\b/)>=0) return false;
    else if (classname.search(/\bsbookhead\d\b/)>=0) {
      var start=classname.search(/\bsbookhead\d\b/);
      var end=classname.indexOf(' ',start);
      if (end<0)
	return parseInt(classname.slice(start+9));
      else return parseInt(classname.slice(start+9,end));}
  var computed=fdjtLookupElement(sbook_headlevels,elt);
  if (typeof computed === "number") return computed;
  else if (typeof computed === "function") return computed(elt);
  else return false;
}

function sbook_getinfo(elt)
{
  if (!(elt)) return elt;
  else if (typeof elt === "string") 
    return sbook_getinfo($(elt));
  else if (elt._sbookid)
    return sbook_info[(elt._sbookid)]||false;
  else return false;
}

function sbook_needinfo(elt)
{
  if (!(elt)) return elt;
  else if (typeof elt === "string") 
    return sbook_needinfo($(elt));
  else if (elt._sbookid)
    return sbook_info[elt._sbookid];
  else {
    var id=elt._fdjtid||fdjtObjID(elt);
    elt._sbookid=id;
    var info=sbook_info[id];
    if (info) return info;
    info={}; info._sbookid=id;
    if (elt.id) {
      info.id=elt.id;
      sbook_idinfo[elt.id]=info;}
    sbook_info[id]=info;
    return info;}
}

/* Access functions */

var sbookUIclasses=/(\bhud\b)|(\bglossmark\b)|(\bleading\b)|(\bsbookmargin\b)/;

function sbookIsUIElement(elt)
{
  return fdjtHasClass(elt,sbookUIclasses);
}

function sbookInUI(elt)
{
  if (elt.sbookui) return true;
  else if (fdjtHasParent(elt,sbookHUD)) return true;
  else while (elt)
	 if (elt.sbookui) return true;
	 else if (fdjtHasClass(elt,sbookUIclasses)) return true;
	 else elt=elt.parentNode;
  return false;
}

function sbookGetHead(target)
{
  while (target)
    if (target.toclevel) return target;
    else if (target.sbook_headid) 
      return document.getElementById(target.sbook_headid);
    else target=target.parentNode;
  return false;
}

function sbookGetFocus(target,closest)
{
  var first=false;
  if (!(target)) return false;
  else if (sbookInUI(target)) return false;
  else if ((!(sbook_focus_rules))||(sbook_focus_rules.length===0))
    while (target) {
      if (target.id) 
	if (closest) return target;
	else if (!(first)) first=target;
      target=target.parentNode;}
  else while (target) {
      if (target.id)
	if (closest) return target;
	else if (fdjtHasClass(target,"sbookfoci"))
	  return target;
	else if (fdjtElementMatches(target,sbook_focus_rules))
	  return target;
	else if (!(first)) first=target;
      target=target.parentNode;}
  return first;
}

function sbookGetRef(target)
{
  while (target)
    if (target.sbook_ref) break;
    else target=target.parentNode;
  return (target)&&($(target.sbook_ref));
}

function sbookGetTitle(target)
{
  if (target===sbook_target)
    return sbook_target_title;
  else return (target.title)||false;
}


/* Building the TOC */

var debug_toc_build=false;
var trace_toc_build=false;
var _sbook_toc_built=false;

var _total_tagged_count=0; var _total_tag_count=0;

function sbookGatherMetadata()
{
  var start=new Date();
  if (_sbook_toc_built) return false;
  if (sbook_trace_startup>0)
    fdjtLog("[%fs] Starting to gather metadata from DOM",fdjtET());
  var root=((sbook_root)||
	    (document.getElementById("SBOOKROOT"))||
	    (document.body));
  sbook_root=root;
  var children=root.childNodes, level=false;
  var rootinfo=sbook_needinfo(root);
  var scanstate=
    {curlevel: 0,idserial:0,location: 0,
     tagstack: [],taggings: [],
     idstate: {prefix: false,count: 0},
     idstack: [{prefix: false,count: 0}]};
  scanstate.idstate.prefix=sbook_baseid;
  scanstate.idstack[0].prefix=sbook_baseid;
  scanstate.curhead=root; scanstate.curinfo=rootinfo;
  scanstate.knowlet=knowlet;
  // Location is an indication of distance into the document
  var location=0;
  rootinfo.title=root.title||document.title;
  rootinfo.starts_at=0;
  rootinfo.level=0; rootinfo.sub=new Array();
  rootinfo.sbook_head=false; rootinfo.sbook_heads=new Array();
  if (!(root.id)) root.id="SBOOKROOT";
  rootinfo.id=root.id;
  /* Build the metadata */
  var i=0; while (i<children.length) {
    var child=children[i++];
    if (!(child.sbookui))
      sbook_scanner(child,scanstate);} 
  var scaninfo=scanstate.curinfo;
  /* Close off all of the open spans in the TOC */
  while (scaninfo) {
    scaninfo.ends_at=scanstate.location;
    scaninfo=scaninfo.sbook_head;}
  /* Sort the nodes by their offset in the document */
  sbook_nodes.sort(function(x,y) {
      if ((!(x.Xoff))&&(x.Xoff!==0)) {
	fdjtWarn("Bad sbook node (xoff=%o) %o",x.Xoff,x);
	return 0;}
      else if ((!(y.Xoff))&&(y.Xoff!==0)) {
	fdjtWarn("Bad sbook node (xoff=%o) %o",y.Xoff,y);
	return 0;}
      else if (x.Yoff<y.Yoff) return -1;
      else if (x.Yoff===y.Yoff)
	if (x.Xoff<y.Xoff) return -1;
	else if (x.Xoff===y.Xoff) return 0;
	else return 1;
      else return 1;});
  var done=new Date();
  fdjtLog('[%fs] Finished gathering metadata in %f secs over %d/%d heads/nodes',
	  fdjtET(),(done.getTime()-start.getTime())/1000,
	  sbook_heads.length,sbook_nodes.length);
  /* 
  fdjtLog("[%fs] Found %d tags over %d elements: %s now has %d dterms",
	  fdjtET(),_total_tag_count,_total_tagged_count,
	  knowlet.name,knowlet.alldterms.length);
  */
  _sbook_toc_built=true;
  return scanstate;
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
  var title=
    (head.toctitle)||(head.getAttribute('toctitle'))||(head.title);
  if (!(title))
    return fdjtTextify(head,true);
  else if (typeof title === "string") {
    var std=fdjtStdSpace(title);
    if (std==="") return false;
    else return std;}
  else return fdjtTextify(title,true);
}

function _sbook_getid(elt,scanstate,level)
{
  if (!(level)) {
    var idstate=scanstate.idstate; idstate.count++;
    return idstate.prefix+"p"+fdjtPadNum(idstate.count,4);}
  else {
    var headstate; var idstate={};
    var curlevel=scanstate.idstack.length;
    if (level>curlevel) {
      // Add new heading levels if neccessary
      var curhead=scanstate.idstack[curlevel-1];
      while (level>curlevel) {
	var newhead={};
	// Level 0 has only one node, so we don't need to count up
	if (curlevel) 
	  newhead.prefix=curhead.prefix+"h"+fdjtPadNum(curhead.count,4);
	else newhead.prefix=curhead.prefix;
	newhead.count=0;
	scanstate.idstack.push(newhead);
	headstate=curhead=newhead;
	curlevel++;}}
    else {
      headstate=scanstate.idstack[level-1];
      scanstate.idstack=scanstate.idstack.slice(0,level+1);
      curlevel=level;}
    headstate.count++;
    var headid=headstate.prefix+"h"+fdjtPadNum(headstate.count,4);
    idstate.prefix=headid; idstate.count=0;
    scanstate.idstate=idstate;
    return headid;}
}

function _sbook_setid(elt,scanstate,level,curlevel)
{
  /* This doesn't currently handle the addition of conflicting IDs */
  if (elt.getAttribute("SBOOKIDS")) {
    var tocidstring=elt.getAttribute("SBOOKIDS");
    var tocids=((tocidstring)?(tocidstring.split(';')):([]));
    var i=0; while (i<tocids.length) sbook_hashmap[tocids[i++]]=elt;}
  if (elt.id) {
    sbook_hashmap[elt.id]=elt;
    return elt.id;}
  else if (!((fdjtHasContent(elt))||
	     (fdjtHasClass(elt,"sbookidify"))||
	     (fdjtElementMatches(elt,sbook_idify))))
    return false;
  else if (sbook_autoid) {
    var tocid=_sbook_getid(elt,scanstate,level,curlevel);
    elt.id=tocid; sbook_hashmap[tocid]=elt;  
    return tocid;}
  else return false;
}

function _sbook_process_head(head,scanstate,level,curhead,curinfo,curlevel)
{
  var headinfo=sbook_needinfo(head);
  var headid=_sbook_setid(head,scanstate,level,curlevel);
  /* Update global tables, arrays */
  sbook_heads.push(head);
  head.sbookloc=scanstate.location;
  head.sbooklevel=level;
  if (debug_toc_build)
    fdjtLog("Found head item %o under %o at level %d w/id=#%s ",
	    head,curhead,level,headid);
  /* Iniitalize the headinfo */
  headinfo.starts_at=scanstate.location;
  headinfo.elt=head; headinfo.level=level;
  headinfo.sub=new Array(); headinfo.id=headid;
  headinfo.title=_sbook_get_title(head);
  headinfo.toctitle=head.getAttribute('toctitle');
  headinfo.next=false; headinfo.prev=false;
  if (level>curlevel) {
    /* This is the simple case where we are a subhead
       of the current head. */
    headinfo.sbook_head=curinfo;
    if (!(curinfo.intro_ends_at))
      curinfo.intro_ends_at=scanstate.location;
    curinfo.sub.push(headinfo);}
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
	scaninfo.next=headinfo;}
      scaninfo.ends_at=scanstate.location;
      scanstate.tagstack=scanstate.tagstack.slice(0,-1);
      var nextinfo=scaninfo.sbook_head;
      if (nextinfo) {
	scaninfo=nextinfo; scanlevel=nextinfo.level;}
      else {
	scaninfo=sbook_getinfo(root);
	scanlevel=0;
	break;}}
    if (debug_toc_build)
      fdjtLog("Found parent: up=%o, upinfo=%o, atlevel=%d, sbook_head=%o",
	      scan,scaninfo,scaninfo.level,scaninfo.sbook_head);
    /* We've found the head for this item. */
    headinfo.sbook_head=scaninfo;
    scaninfo.sub.push(headinfo);} /* handled below */
  /* Add yourself to your children's subsections */
  var supinfo=headinfo.sbook_head;
  var newheads=new Array();
  newheads=newheads.concat(supinfo.sbook_heads); newheads.push(supinfo);
  headinfo.sbook_heads=newheads;
  if ((trace_toc_build) || (debug_toc_build))
    fdjtLog("@%d: Found head=%o, headinfo=%o, sbook_head=%o",
	    scanstate.location,head,headinfo,headinfo.sbook_head);
  /* Update the toc state */
  scanstate.curhead=head;
  scanstate.curinfo=headinfo;
  scanstate.curlevel=level;
  if (headinfo)
    headinfo.head_ends_at=scanstate.location+fdjtFlatWidth(head);
  scanstate.location=scanstate.location+fdjtFlatWidth(head);  
}

function sbook_scanner(child,scanstate,skiptoc)
{
  // fdjtTrace("scanner %o %o",scanstate,child);
  var location=scanstate.location;
  var curhead=scanstate.curhead;
  var curinfo=scanstate.curinfo;
  var curlevel=scanstate.curlevel;
  var level=0;
  // Location tracking and TOC building
  if (child.nodeType===3) {
    var width=child.nodeValue.length;
    if (!(fdjtIsEmptyString(child.nodeValue)))
      scanstate.location=scanstate.location+width;
    return;}
  else if (child.nodeType!==1) {
    child.sbook_head=curhead;
    return;}
  else if (sbookInUI(child)) return;
  else if ((fdjtHasClass(child,"sbookignore"))||
	   (fdjtElementMatches(child,sbook_ignored))) {
    fdjtComputeOffsets(child);
    sbook_nodes.push(child);
    return;}
  fdjtComputeOffsets(child);
  var refuri=(child.refuri)||
    child.getAttributeNS('refuri','http://www.sbooks.net')||
    child.getAttribute('refuri')||
    child.getAttribute('data-refuri');
  if ((refuri)&&(refuri!==sbook_refuri)) {
    child.refuri=refuri;
    fdjtInsert(sbook_refuris,refuri);}
  var refid=child.getAttributeNS('refid','http://www.sbooks.net')||
    child.getAttribute('refid')||
    child.getAttribute('data-refid');
  if ((refid)&&(refid!==child.id)) sbook_hashmap[refid]=child;
  if (level=sbookHeadLevel(child)) {
    if (skiptoc) sbook_nodes.push(child);
    else _sbook_process_head
	   (child,scanstate,level,curhead,curinfo,curlevel);}
  else if (skiptoc) sbook_nodes.push(child);
  else if ((fdjtIsBlockElt(child))||
	   (fdjtHasClass(child,"sbookidify"))||
	   (fdjtElementMatches(child,sbook_idify))) {
    var loc=scanstate.location;
    var eltid=_sbook_setid(child,scanstate,level,curlevel);
    skiptoc=skiptoc||
      (fdjtHasClass(child,"sbookterminal"))||
      (fdjtElementMatches(child,sbook_terminals));
    sbook_nodes.push(child);
    child.sbookloc=loc;
    child.sbook_headid=curhead.id;
    scanstate.location=loc+fdjtTagWidth(child);
    if (child.childNodes) {
      var children=child.childNodes;
      var i=0; while (i<children.length)
		 sbook_scanner(children[i++],scanstate,skiptoc);}}
  else {}
  if (level) child.toclevel=level;
  // Tagging
  var info=sbook_getinfo(child);
  var headtag=((info)&&((info.title) && ("\u00A7"+info.title)));
  var tagstring;
  if (headtag) {
    sbookAddTag(child,headtag,true,false,true,scanstate.knowlet);}
  if ((sbook_build_index)&&(child.id)&&(child.getAttribute)&&
      (tagstring=
       ((child.getAttribute("tags"))||
	(child.getAttribute("data-tags"))||
	((child.getAttributeNS)&&
	 (child.getAttribute("tags","http://sbooks.net/")))))) { 
    var tags=fdjtSemiSplit(fdjtUnEntify(tagstring));
    var tagging={};
    tagging.elt=child; tagging.tags=tags;
    tagging.ctags=scanstate.tagstack;
    scanstate.taggings.push(tagging);
    if (level>0) {
      var ctags=[]; if (headtag) ctags.push(headtag);
      var i=0; var len=tags.length; while (i<len) {
	if (tags[i][0]==='*') {
	  var tag=tags[i++];
	  var barpos=tag.indexOf('|');
	  if (barpos<0) ctags.push(tag.slice(1));
	  else ctags.push(tag.slice(1,barpos));}
	else i++;}
      scanstate.tagstack.push(ctags);}}
  else {}
  // Setting this attribute can help with debugging
  if ((sbook_trace_locations) && (child.sbookloc) && (child.setAttribute))
    child.setAttribute("sbookloc",child.sbookloc);
}

/* Global query information */

function sbookSetQuery(query,scored)
{
  if ((sbook_query) &&
      ((sbook_query._query)===query) &&
      ((scored||false)===(sbook_query._scored)))
    return sbook_query;
  var result=sbookQuery(query);
  if (result._qstring!==sbookQueryBase($("SBOOKSEARCHTEXT").value)) {
    $("SBOOKSEARCHTEXT").value=result._qstring;
    $("SBOOKSEARCHTEXT").removeAttribute('isempty');}
  sbook_query=result; query=result._query;
  // sbookSetGlosses(sbook_search_glosses(query));
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
  sbookSetSources($("SBOOKGLOSSES"),result._sources||[]);
  return result;
}

function sbookUpdateQuery(input_elt)
{
  var q=sbookStringToQuery(input_elt.value);
  if ((q)!==(sbook_query._query))
    sbookSetQuery(q,false);
}

function sbook_title_path(head)
{
  var info=sbook_getinfo(head);
  if (info.title) {
    var scan=sbook_getinfo(info.elt.sbook_ref);
    while (scan) {
      if (scan.title) title=title+" // "+scan.title;
      scan=sbook_getinfo(scan.elt.sbook_head);}
    return title;}
  else return null;
}

function sbookSetHead(head)
{
  if (head===null) head=sbook_root;
  else if (typeof head === "string") {
    var probe=$(head);
    if (!(probe)) probe=sbook_hashmap[head];
    if (!(probe)) return;
    else head=probe;}
  if (head===sbook_head) {
    if (sbook_debug) fdjtLog("Redundant SetHead");
    return;}
  else if (head) {
    var headinfo=sbook_getinfo(head);
    if (sbook_trace_focus) sbook_trace("sbookSetHead",head);
    sbookTOCUpdate(head,"SBOOKTOC4");
    sbookTOCUpdate(head,"SBOOKDASHTOC4");
    window.title=headinfo.title+" ("+document.title+")";
    if (sbook_head) fdjtDropClass(sbook_head,"sbookhead");
    fdjtAddClass(head,"sbookhead");
    sbookSetLocation(sbook_location);
    sbook_head=head;}
  else {
    if (sbook_trace_focus) sbook_trace("sbookSetHead",head);
    sbookTOCUpdate(head,"SBOOKTOC4");
    sbookTOCUpdate(head,"SBOOKDASHTOC4");
    sbook_head=false;}
  // if (sbookHUDglosses) sbookSetGlosses(sbookGetGlossesUnder(sbook_head.id));
}

var sbook_location=false;

function sbookSetLocation(location,force)
{
  if ((!(force)) && (sbook_location===location)) return;
  if (sbook_trace_locations)
    fdjtLog("Setting location to %o",location);
  var info=sbook_getinfo(sbook_head);
  while (info) {
    var tocelt=document.getElementById("SBOOKTOC4"+info.id);
    var apptocelt=document.getElementById("SBOOKDASHTOC4"+info.id);
    var start=tocelt.sbook_start; var end=tocelt.sbook_end;
    var progress=((location-start)*80)/(end-start);
    var bar=fdjtGetFirstChild(tocelt,".progressbar");
    var appbar=fdjtGetFirstChild(apptocelt,".progressbar");
    if (sbook_trace_locations)
      fdjtLog("For tocbar %o loc=%o start=%o end=%o progress=%o",
	      bar,location,start,end,progress);
    if ((bar)&& (progress>0) && (progress<100)) {
      bar.style.width=((progress)+10)+"%";
      appbar.style.width=((progress)+10)+"%";}
    info=info.sbook_head;}
  var spanbars=$$(".spanbar",$("SBOOKHUD"));
  var i=0; while (i<spanbars.length) {
    var spanbar=spanbars[i++];
    var width=spanbar.ends-spanbar.starts;
    var ratio=(location-spanbar.starts)/width;
    if (sbook_trace_locations)
      fdjtLog("ratio for spanbar %o[%d] is %o [%o,%o,%o]",
	      spanbar,spanbar.childNodes[0].childNodes.length,
	      ratio,spanbar.starts,location,spanbar.ends);
    if ((ratio>=0) && (ratio<=1)) {
      var progressbox=$$(".progressbox",spanbar);
      if (progressbox.length>0) {
	progressbox[0].style.left=((Math.round(ratio*10000))/100)+"%";}}}
  sbook_location=location;
}

/* Next and previous heads */

function sbookNextHead(head)
{
  var info=sbook_getinfo(head);
  if ((info.sub)&&(info.sub.length>0))
    return $(info.sub[0].id);
  else if (info.next)
    return $(info.next.id);
  else if ((info.sbook_head)&&(info.sbook_head.next))
    return $(info.sbook_head.next.id);
  else return false;
}

function sbookPrevHead(head)
{
  var info=sbook_getinfo(head);
  if (info.prev)
    return $(info.prev.id);
  else if (info.sbook_head)
    return $(info.sbook_head.id);
  else return false;
}

/* Tracking position within the document. */

var sbook_focus_tags=false;
var sbook_last_x=false;
var sbook_last_y=false;
var sbook_focus_delay=100;
var sbook_fickle_head=true;
var sbook_track_window=25;

function sbookSetFocus(target)
{
  // If the target has changed, update the location
  if (target!==sbook_focus) {
    var info=sbook_getinfo(target);
    var tags=((info)&&(info.tags));
    var tagdiv=fdjtDiv(".hudblock.hud.tags");
    tagdiv.onclick=sbook_tagdiv_onclick;
    if (tags) {
      var i=0; while (i<tags.length) {
	var tag=tags[i++];
	if ((typeof tag === "string") && (tag[0]==="\u00A7")) {}
	else if (i===1) fdjtAppend(tagdiv,knoSpan(tag)," ");
	else fdjtAppend(tagdiv,"\u00B7 ",knoSpan(tag)," ");}}
    fdjtReplace("SBOOKTAGS",tagdiv);
    if ((sbook_hud_flash)&&(!(sbook_mode)))
      fdjtFlash("SBOOKTAGS",sbook_hud_flash,"flash");}
  if (!(target)) {
    if (old_focus) fdjtDropClass(old_focus,"sbookfocus");}
  else if (target!==sbook_focus) {
    var head=((target) &&
	      ((target.sbooklevel) ? (target) :
	       (sbookGetHead(target))));
    if (sbook_trace_focus) sbook_trace("sbookSetFocus",target);
    /* Only set the head if the old head isn't visible anymore.  */
    if ((head) && (sbook_head!==head)) sbookSetHead(head);
    var old_focus=sbook_focus;
    fdjtSetCookie("sbookfocus",target.id);
    sbook_focus=target;
    fdjtAddClass(target,"sbookfocus");
    if ((old_focus)&&(old_focus!==target)) {
      fdjtDropClass(old_focus,"sbookfocus");}
    if (sbook_mode==="glosses")
      sbookScrollGlosses(sbook_focus);
    if (target.sbookloc)
      if (!((old_focus) && (fdjtHasParent(old_focus,target)))) 
	sbookSetLocation(target.sbookloc,true);
  }
}

function sbookTrackFocus(target,shift)
{
  // Lots of reasons *not* to track the focus
  if (!(target)) return null;
  else if (sbook_egomotion) return null;
  else if ((sbook_mode)&&(sbook_mode!=="minimal"))
    if (shift) {} else return;
  else if ((sbook_target)&&(fdjtIsVisible($(sbook_target))))
    if ((target===sbook_target)&&(!(sbook_mode))) {
      sbookHUDMode("minimal");
      return;}
    else return;
  else if ((sbook_pageview) &&
	   ((sbook_last_y<sbook_top_px)||
	    (sbook_last_y>(window.innerHeight-sbook_bottom_px))))
    return;

  // All the direct reasons not to track the focus are false,
  // so we try to find the actual focus element
  if (sbook_trace_focus) sbook_trace("sbookTrackFocus",target);
  // Now, go up the DOM, looking for an ID to use
  while (target) 
    if (target.id) break;
    else target=target.parentNode;
  // Now that you've found something, there are various
  //  reasons to not use it.
  if (!(target)) return;
  else if (target===sbook_focus) return;
  else if (fdjtHasParent(target,sbookHUD)) return;
  else if ((sbook_focus)&&(fdjtHasParent(sbook_focus,target)))
    return;
  else if (!(fdjtIsVisible(target,true))) return;
  // If there are no reasons not to change the focus, go ahead and change it.
  sbookSetFocus(target);
}

function sbookSetTarget(target,nogo)
{
  if (sbook_trace_focus) sbook_trace("sbookSetTarget",target);
  if (target===sbook_target) return;
  if (sbook_target) {
    if (sbook_target_title)
      sbook_target.title=sbook_target_title;
    else sbook_target.title=null;
    fdjtDropClass(sbook_target,"sbooktarget");
    sbook_target=false; sbook_target_title=false;}
  if ((!(target))||(sbookInUI(target))||
      ((target===sbook_root)||(target===document.body))) {
    return;}
  else {
    fdjtAddClass(target,"sbooktarget");
    sbook_target=target;
    if (!(nogo)) sbookGoTo(target);
    if (target.title) sbook_target_title=target.title;
    target.title=_('click to add a gloss');}
}

function sbookCheckTarget()
{
  if ((sbook_target) && (!(fdjtIsVisible(sbook_target,true)))) {
    if (sbook_trace_focus)
      sbook_trace("sbookCheckTarget(clear)",sbook_target);
    fdjtDropClass(sbook_target,"sbooktarget");
    sbook_target=false;}
}

/* Going to particular elements */

/* Determines how far below the top edge to naturally scroll.
   This ties to avoid the HUD, in case it is up. */
function sbookDisplayOffset()
{
  var toc;
  if (sbook_touch) return -50;
  else if (sbook_mode)
    if (toc=$("SBOOKTOC"))
      return -((toc.offsetHeight||50)+15);
    else return -60;
  else return -40;
}

function sbookScrollTo(elt,cxt)
{
  fdjtClearPreview();
  sbookTrackFocus(elt,true);
  if ((elt.getAttribute) &&
      (elt.getAttribute("toclevel")) ||
      ((elt.sbookinfo) && (elt.sbookinfo.level)))
    sbookSetHead(elt);
  else if (elt.sbook_head)
    sbookSetHead(elt.sbook_head);
  if (sbook_pageview)
    sbookGoToPage(sbookGetPage(elt));
  else if (fdjtIsVisible(elt)) {}
  else if ((!cxt) || (elt===cxt))
    fdjtScrollTo(elt,sbookGetStableId(elt),false,true,sbookDisplayOffset());
  else fdjtScrollTo(elt,sbookGetStableId(elt),cxt,true,sbookDisplayOffset());
}

function sbookSetHashID(target)
{
  if ((!(target.id))||(window.location.hash===target.id))
    return;
  var saved_y=((fdjtIsVisible(target))&&(window.scrollY));
  var saved_x=((fdjtIsVisible(target))&&(window.scrollX));
  var was_visible=fdjtIsVisible(target);
  window.location.hash=target.id;
  if (sbook_pageview) sbookGoToPage(sbookGetPage(target));
  else if ((was_visible)&&(saved_y)&&(saved_y!==window.scrollY))
    // This resets when setting the ID moved the page unneccessarily
    window.scrollTo(saved_x,saved_y);
  else if (!(fdjtIsVisible(target)))
    sbookScrollTo(target,((target.sbook_head)&&($(target.sbook_head))));
  else {}
}

function sbookGoTo(target,noset)
{
  sbookPreview(false);
  var page=((sbook_pageview)&&sbookGetPage(target));
  if (sbook_trace_nav)
    fdjtLog("sbookGoTo #%o@P%o/L%o %o",target.id,page,target.sbookloc,target);
  if (target.sbookloc) sbookSetLocation(target.sbookloc);
  if ((!(noset))&&(target.id)&&(!(sbookInUI(target))))
    sbookSetTarget(target,true);
  if (target.id) sbookSetHashID(target);
  else if (sbook_pageview) sbookGoToPage(page);
  else sbookScrollTo(target);
  sbookHUDMode(false);
  if ((sbook_hud_flash)&&(!(sbook_mode)))
    sbookHUDFlash("minimal",sbook_hud_flash);
}

/* Keyboard handlers */

function sbook_onkeydown(evt)
{
  evt=evt||event||null;
  var kc=evt.keyCode;
  // sbook_trace("sbook_onkeydown",evt);
  if (evt.keyCode===27) { /* Escape works anywhere */
    if ((sbook_mode)||(sbook_target)) {
      sbook_last_mode=sbook_mode;
      sbookHUDMode(false);
      fdjtDropClass(document.body,"hudup");
      sbookStopPreview(evt);
      sbookSetTarget(false);
      $("SBOOKSEARCHTEXT").blur();}
    else if (sbook_last_mode) sbookHUDMode(sbook_last_mode);
    else {
      if ((sbook_mark_target)&&(fdjtIsVisible(sbook_mark_target)))
	sbookHUDMode("mark");
      else sbookHUDMode("minimal");}
    return;}
  if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
  else if (kc===34) sbookForward();   /* page down */
  else if (kc===33) sbookBackward();  /* Page Up */
  else if (fdjtIsTextInput($T(evt))) return true;
  else if (kc===16) { /* Shift key */
    if (sbook_mode) {
      fdjtDropClass(document.body,"hudup");
      fdjtDropClass(sbookHUD,sbook_mode);}
    else {
      fdjtSwapClass(sbookHUD,sbookHUDMode_pat,"minimal");
      fdjtAddClass(document.body,"hudup");}}
  else if (kc===17) { /* Control key */
    if (sbook_preview) return;
    else if (sbook_preview_target)
      sbookPreview(sbook_preview_target);
    else return;}
  else if (kc===32) {
    /* Space char or page down */
    // sbookHUDMode(false);
    sbookForward();}
  else if ((kc===8)||(kc===45)) {
    /* Backspace, Delete, or Page Up */
    // sbookHUDMode(false);
    sbookBackward();}
  else if (kc===36)  
    // Home goes to the current head.
    // (more nav keys to come)
    sbookGoTo(sbook_head);
  else return;
}

function sbook_onkeyup(evt)
{
  evt=evt||event||null;
  var kc=evt.keyCode;
  // sbook_trace("sbook_onkeyup",evt);
  if (fdjtIsTextInput($T(evt))) return true;
  else if ((evt.altKey)||(evt.metaKey)) return true;
  else if (kc===17) { /* Control key */
    if (sbook_preview)
      if (sbook_preview_mousedown) return false;
      else return sbookPreview(false);
    else return;}
  else if (kc===16) {
    fdjtDropClass(document.body,"hudup");
    if (sbook_mode) fdjtAddClass(sbookHUD,sbook_mode);
    fdjtCancelEvent(evt);}
}

var sbook_modechars={
 43: "mark",13: "mark",
 63: "searching",102: "searching",
 83: "searching",115: "searching",
 70: "searching",
 100: "device",68: "device",
 110: "toc",78: "toc",
 116: "apptoc",84: "apptoc",
 104: "help",72: "help",
 103: "glosses",71: "glosses",
 67: "console", 99: "console",
 76: "layers", 108: "layers"};

function sbook_onkeypress(evt)
{
  var modearg=false;
  evt=evt||event||null;
  // sbook_trace("sbook_onkeypress",evt);
  if (fdjtIsTextInput($T(evt))) return true;
  else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
  else if ((evt.charCode===65)||(evt.charCode===97)) /* A */
    modearg=sbook_last_app||"help";
  else if (((!(sbook_mode))||(sbook_mode==="minimal"))&&
	    ((evt.charCode===112)||(evt.charCode===80))) /* P */
    if (sbook_pageview) sbookPageView(false);
    else sbookPageView(true);
  else modearg=sbook_modechars[evt.charCode];
  if (modearg) 
    if (sbook_mode===modearg) sbookHUDMode(false);
    else sbookHUDMode(modearg);
  else {}
  if (sbook_mode==="searching")
    $("SBOOKSEARCHTEXT").focus();
  else if (sbook_mode==="mark") {
    sbookMarkHUDSetup(false);
    $("SBOOKMARKINPUT").focus();}
  else $("SBOOKSEARCHTEXT").blur();
  fdjtCancelEvent(evt);
}

/* Mouse handlers */

function sbookGetXYFocus(xoff,yoff,closest)
{
  var scrollx=window.scrollX||document.body.scrollLeft;
  var scrolly=window.scrollY||document.body.scrollLeft;
  if (!(xoff)) {
    xoff=sbook_last_x+scrollx;
    yoff=sbook_last_y+scrolly;}
  var nodes=sbook_nodes;
  var bot=0; var top=nodes.length-1; var mid=Math.floor(top/2);
  var node=nodes[mid]; var next=nodes[mid+1]; var target=false;
  while ((node) && (next) &&
	 ((!(((node.Yoff)<=yoff) && ((next.Yoff)>=yoff))))) {
    if (node.Yoff===yoff) break;
    if (yoff<node.Yoff) top=mid-1;
    else if (yoff>node.Yoff) bot=mid+1;
    else {}
    mid=bot+Math.floor((top-bot)/2);
    node=nodes[mid]; next=nodes[mid+1];}
  if ((node)&&(next)&&(!(fdjtIsVisible(node)))&&
      ((next.Yoff-yoff)<100))
    // pick next node
    node=next;
  return sbookGetFocus(node,closest||false);
}

function sbook_onmouseover(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbook_onmouseover",evt);
  /* If you're previewing, ignore mouse action */
  if (sbook_preview) return;
  if (sbook_target) sbookCheckTarget();
  /* Get the target */
  var target=$T(evt);
  if (sbookInUI(target)) return;
  else target=sbookGetFocus(target,evt.ctrlKey);
  if ((target)&&(evt.shiftKey)&&(sbook_mode)) {
    sbookTrackFocus(target,true);
    return;}
  var scrollx=window.scrollX||document.body.scrollLeft;
  var scrolly=window.scrollY||document.body.scrollLeft;
  // Track position
  sbook_last_x=evt.clientX; sbook_last_y=evt.clientY;
  /* These are top level elements which aren't much use as heads or foci */
  if ((target===null) || (target===sbook_root) ||
      (!((target) && ((target.Xoff) || (target.Yoff))))) 
    target=sbookGetXYFocus(scrollx+evt.clientX,scrolly+evt.clientY,evt.ctrlKey);
  // Don't raise the focus to parents unless the control key down
  if ((sbook_focus)&&(fdjtHasParent(sbook_focus,target)))
    if (!(evt.ctrlKey)) return;
  fdjtDelay
    (sbook_focus_delay,sbookTrackFocus,target,document.body,"setfocus");
}

function sbook_onmousemove(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbook_onmousemove",evt);
  if (sbook_target) sbookCheckTarget();
  var target=$T(evt);
  /* If you're previewing, ignore mouse action */
  if ((sbook_preview) || (sbook_mode) || (sbook_mode)) return;
  if (fdjtHasClass(document.body,"hudup")) return;
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
  var scrollx=window.scrollX||document.body.scrollLeft;
  var scrolly=window.scrollY||document.body.scrollLeft;
  target=sbookGetXYFocus(scrollx+evt.clientX,scrolly+evt.clientY,evt.ctrlKey);
  // Don't raise the focus to parents unless the control key down
  if ((sbook_focus)&&(fdjtHasParent(sbook_focus,target)))
    if (!(evt.ctrlKey)) return;
  fdjtDelay
    (sbook_focus_delay,sbookTrackFocus,target,document.body,"setfocus");
}

function sbook_onscroll(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbook_onscroll",evt);
  /* If you're previewing, ignore mouse action */
  if (sbook_floating_hud) sbookSyncHUD();
  if (sbook_preview) return;
  if (sbook_target) sbookCheckTarget();
  // if (sbook_pageview) fdjtDropClass(document.body,"sbookpageview");
  var scrollx=window.scrollX||document.body.scrollLeft;
  var scrolly=window.scrollY||document.body.scrollLeft;
  var xoff=scrollx+sbook_last_x;
  var yoff=scrolly+sbook_last_y;
  var target=sbookGetXYFocus(xoff,yoff,evt.ctrlKey);
  // Don't raise the focus to parents unless the control key down
  if ((sbook_focus)&&(fdjtHasParent(sbook_focus,target)))
    if (!(evt.ctrlKey)) return;
  fdjtDelay
    (sbook_focus_delay,sbookTrackFocus,target,document.body,"setfocus");
}

function sbook_tagdiv_onclick(evt)
{
  var target=$T(evt);
  var term=((target.sectname)||
	    ((target.getAttribute) && (target.getAttribute("dterm"))));
  var textinput=$("SBOOKSEARCHTEXT");
  var qval=((textinput.getAttribute("isempty"))? ("") : (textinput.value||""));
  var qlength=qval.length;
  if (qlength===0)
    sbookSetQuery(term+';',false);
  else if (qval[qlength-1]===';')
    sbookSetQuery(qval+term+';',false);
  else sbookSetQuery(term+';'+qval,false);
  sbookHUDMode("searching");
}

/* Getting REFURI/DOCURI context */

function sbookGetRefURI(target)
{
  var scan=target;
  while (scan)
    if (scan.refuri) return scan.refuri;
    else scan=scan.parentNode;
  return sbook_refuri;
}

function sbookGetDocURI(target)
{
  var scan=target;
  while (scan) {
    var docuri=
      (((scan.getAttributeNS)&&
	(scan.getAttributeNS("docuri","http://sbooks.net/")))||
       ((scan.getAttribute)&&(scan.getAttribute("docuri")))||
       ((scan.getAttribute)&&(scan.getAttribute("data-docuri"))));
    if (docuri) return docuri;
    else scan=scan.parentNode;}
  return sbook_docuri;
}

function sbookGetRefID(target)
{
  return (target.getAttributeNS('sbookid','http://sbooks.net/'))||
    (target.getAttributeNS('sbookid'))||
    (target.getAttributeNS('data-sbookid'))||
    (target.id);
}

function sbookAltLink(type,uri)
{
  uri=uri||sbook_refuri;
  if (uri.search("http://")===0)
    return "http://offline."+uri.slice(7);
  else if (uri.search("https://")===0)
    return "https://offline."+uri.slice(8);
  else return false;
}

function sbook_get_titlepath(info,embedded)
{
  if (!(info))
    if (document.title)
      if (embedded)
	return " // "+document.title;
      else return "";
    else return "";
  else {
    var next=(info.sbook_head)||false;
    if (info.title)
      return ((embedded) ? (" // ") : (""))+info.title+
	sbook_get_titlepath(next,true);
    else return sbook_get_titlepath(next,embedded);}
}

/* Getting settings */

function _getsbookrefuri()
{
  // Explicit REFURI is just returned
  var refuri=fdjtGetLink("REFURI",true)||fdjtGetMeta("REFURI",true);
  if (refuri) return refuri;
  // No explicit value, try to figure one out
  // First, try the CANONICAL link
  refuri=fdjtGetLink("canonical",true);
  // Otherwise, use the document location
  if (!(refuri)) {
    var locref=document.location.href;
    var qstart=locref.indexOf('?');
    if (qstart>=0) locref=locref.slice(0,qstart);
    refuri=locref;}
  return refuri;
}

function _getsbookbaseid()
{
  var baseid=fdjtGetMeta("SBOOKIDPREFIX",true)||fdjtGetMeta("SBOOKID",true);
  if ((!(baseid))||(typeof baseid !== 'string')||
      (baseid.length===0) || (baseid[0]===':'))
    return false;
  else return baseid;
}

function _getsbookdocuri()
{
  var docuri=fdjtGetLink("DOCURI",true)||
    fdjtGetMeta("DOCURI",true)||
    fdjtGetMeta("SBOOKSRC",true);
  if (docuri) return docuri;
  else return _getsbookrefuri();
}

function sbookGetSettings()
{
  // Basic stuff
  document.body.refuri=sbook_refuri=_getsbookrefuri();
  sbook_baseid=_getsbookbaseid()||"SBOOK";
  sbook_docuri=_getsbookdocuri();
  // Get the settings for scanning the document structure
  sbookGetScanSettings();
  // Get the settings for automatic pagination
  sbookGetPageSettings();
  sbook_max_excerpt=fdjtGetMeta("SBOOKMAXEXCERPT",false)
  var sbooksrv=fdjtGetMeta("SBOOKSERVER",true);
  if (sbooksrv) sbook_server=sbooksrv;
  else if (fdjtGetCookie["SBOOKSERVER"])
    sbook_server=fdjtGetCookie["SBOOKSERVER"];
  else sbook_server=sbookLookupServer(document.domain);
  if (!(sbook_server)) sbook_server=sbook_default_server;
  sbook_ajax_uri=fdjtGetMeta("SBOOKSAJAX",true);
  sbook_mycopyid=fdjtGetMeta("SBOOKMYCOPY",false);
}

function sbookGetScanSettings()
{
  if (!(sbook_root))
    if (fdjtGetMeta("SBOOKROOT"))
      sbook_root=$(fdjtGetMeta("SBOOKROOT"));
    else sbook_root=document.body;
  if (!(sbook_start))
    if (fdjtGetMeta("SBOOKSTART"))
      sbook_start=$(fdjtGetMeta("SBOOKSTART"));
    else if ($("SBOOKSTART"))
      sbook_start=$("SBOOKSTART");
    else {
      var titlepage=$("SBOOKTITLE")||$("TITLEPAGE");
      if (titlepage) {
	fdjtComputeOffsets(titlepage);
	sbook_nodes.push(titlepage);}
      while (titlepage)
	if (fdjtNextElement(titlepage)) {
	  sbook_start=fdjtNextElement(titlepage); break;}
	else titlepage=titlepage.parentNode;}
  var h1=fdjtGetMeta("SBOOKHEAD1",true);
  if (h1) {
    var rules=fdjtSemiSplit(h1);
    var i=0; while (i<rules.length) {
      sbook_headlevels[rules[i++]]=1;}}
  var h2=fdjtGetMeta("SBOOKHEAD2",true);
  if (h2) {
    var rules=fdjtSemiSplit(h2);
    var i=0; while (i<rules.length) {
      sbook_headlevels[rules[i++]]=2;}}
  var h3=fdjtGetMeta("SBOOKHEAD3",true);
  if (h3) {
    var rules=fdjtSemiSplit(h3);
    var i=0; while (i<rules.length) {
      sbook_headlevels[rules[i++]]=3;}}
  var h4=fdjtGetMeta("SBOOKHEAD4",true);
  if (h4) {
    var rules=fdjtSemiSplit(h4);
    var i=0; while (i<rules.length) {
      sbook_headlevels[rules[i++]]=4;}}
  var h5=fdjtGetMeta("SBOOKHEAD5",true);
  if (h5) {
    var rules=fdjtSemiSplit(h5);
    var i=0; while (i<rules.length) {
      sbook_headlevels[rules[i++]]=5;}}
  var h6=fdjtGetMeta("SBOOKHEAD6",true);
  if (h6) {
    var rules=fdjtSemiSplit(h6);
    var i=0; while (i<rules.length) {
      sbook_headlevels[rules[i++]]=6;}}
  var h7=fdjtGetMeta("SBOOKHEAD7",true);
  if (h7) {
    var rules=fdjtSemiSplit(h7);
    var i=0; while (i<rules.length) {
      sbook_headlevels[rules[i++]]=7;}}
  var ignored_rules=fdjtGetMeta("SBOOKIGNORED",true);
  if (ignored_rules) {
    var selectors=fdjtSemiSplit(ignored_rules);
    var i=0; while (i<selectors.length) {
      sbook_ignored.push(fdjtParseSelector(selectors[i++]));}}
  var idify_rules=fdjtGetMeta("SBOOKIDIFY",true);
  if (idify_rules) {
    var selectors=fdjtSemiSplit(idify_rules);
    var i=0; while (i<selectors.length) {
      sbook_idify.push(fdjtParseSelector(selectors[i++]));}}
  var focus_rules=fdjtGetMeta("SBOOKFOCI",true);
  if (focus_rules) {
    var selectors=fdjtSemiSplit(focus_rules);
    var i=0; while (i<selectors.length) {
      sbook_focus_rules.push(fdjtParseSelector(selectors[i++]));}}
  var terminal_rules=fdjtGetMeta("SBOOKTERMINALS",true);
  if (terminal_rules) {
    var selectors=fdjtSemiSplit(terminal_rules);
    var i=0; while (i<selectors.length) {
      sbook_terminals.push(fdjtParseSelector(selectors[i++]));}}
  var notag=fdjtGetMeta("SBOOKNOTAG",true);
  if (notag) {
    var rules=fdjtSemiSplit(notag);
    var i=0; while (i<rules.length) {
      sbook_notags.push(rules[i++]);}}
  if (fdjtGetMeta("SBOOKAUTOID"))
    sbook_autoid=true;
  else if ($(sbook_baseid))
    sbook_autoid=false;
  else sbook_autoid=true;
}

function sbookGetPageSettings()
{
  var tocmajor=fdjtGetMeta("SBOOKTOCMAJOR",true);
  if (tocmajor) sbook_tocmajor=parseInt(tocmajor);
  var sbook_pagehead_rules=fdjtGetMeta("SBOOKPAGEHEADS",true);
  if (sbook_pagehead_rules) {
    var selectors=fdjtSemiSplit(sbook_pagehead_rules);
    sbook_pageheads=[];
    var i=0; while (i<selectors.length) {
      sbook_pageheads.push(fdjtParseSelector(selectors[i++]));}}
  var sbook_pagefoot_rules=fdjtGetMeta("SBOOKPAGEFEET",true);
  if (sbook_pagefoot_rules) {
    var selectors=fdjtSemiSplit(sbook_pagefoot_rules);
    sbook_pagefeet=[];
    var i=0; while (i<selectors.length) {
      sbook_pagefeet.push(fdjtParseSelector(selectors[i++]));}}
  var sbook_pageblock_rules=fdjtGetMeta("SBOOKPAGEBLOCKS",true);
  if (sbook_pageblock_rules) {
    var selectors=fdjtSemiSplit(sbook_pageblock_rules);
    sbook_pageblocks=[];
    var i=0; while (i<selectors.length) {
      sbook_pageblocks.push(fdjtParseSelector(selectors[i++]));}}
  var sbook_nobefore_rules=fdjtGetMeta("SBOOKAVOIDTOP",true);
  if (sbook_nobefore_rules) {
    var selectors=fdjtSemiSplit(sbook_nobefore_rules);
    sbook_avoid_pagehead=[];
    var i=0; while (i<selectors.length) {
      sbook_avoid_pagehead.push(fdjtParseSelector(selectors[i++]));}}
  var sbook_noafter_rules=fdjtGetMeta("SBOOKAVOIDBOTTOM",true);
  if (sbook_noafter_rules) {
    var selectors=fdjtSemiSplit(sbook_noafter_rules);
    sbook_avoid_pagefoot=[];
    var i=0; while (i<selectors.length) {
      sbook_avoid_pagefoot.push(fdjtParseSelector(selectors[i++]));}}
  var sbook_fullpage_rules=fdjtGetMeta("SBOOKFULLPAGE",true);
  if (sbook_fullpage_rules) {
    var selectors=fdjtSemiSplit(sbook_noafter_rules);
    var i=0; while (i<selectors.length) {
      sbook_fullpages.push(fdjtParseSelector(selectors[i++]));}}
}

/* Application settings */

var sbook_allopts=
  [["page","scroll"],["sparse","rich"],["flash","noflash"],
   ["fetch","nofetch"],["setup","nosetup"]];

var sbook_default_opts=["page","rich","flash","mouse"];
var sbook_window_opts=[];
var sbook_opts=[];

function sbookTestOpt(pos,neg,session)
{
  return fdjtTestOpt(pos,neg,
		     (session||fdjtGetSession("sbookopts")),
		     fdjtGetQuery("sbookopts"),
		     fdjtGetLocal("sbookopts"),
		     fdjtGetMeta("sbookopts"),
		     sbook_default_opts);
}

function sbookApplySettings()
{
  // This applies the current session settings
  sbookSparseMode(sbookTestOpt("sparse","rich"));
  sbookFlashMode(sbookTestOpt("flash","dull"));
  var tocmax=fdjtGetMeta("SBOOKTOCMAX",true);
  if (tocmax) sbook_tocmax=parseInt(tocmax);
  var sbookhelp=fdjtGetMeta("SBOOKHELP",true);
  if (sbookhelp) sbook_help_on_startup=true;
  sbookPageView(sbookTestOpt("page","scroll"));
  if (sbookTestOpt("touch",["mouse",",keyboard"]))
    sbookInterfaceMode("touch");
  else if (sbookTestOpt("keyboard",["mouse","touch"]))
    sbookInterfaceMode("keyboard");
  else sbookInterfaceMode("mouse");
}

function sbookUpdateSessionSettings(delay)
{
  if (delay) {
    setTimeout(sbookUpdateSessionSettings,delay);
    return;}
  // This updates the session settings from the checkboxes 
  var sessionsettings="opts";
  if ($("SBOOKPAGEVIEW").checked)
    if (sbookTestOpt("page","scroll","")) {}
    else sessionsettings=sessionsettings+" page";
  else if (sbookTestOpt("scroll","page","")) {}
  else sessionsettings=sessionsettings+" scroll";
  if ($("SBOOKTOUCHMODE").checked)
    if (sbookTestOpt("touch",["mouse","keyboard"],"")) {}
    else sessionsettings=sessionsettings+" touch";
  if ($("SBOOKMOUSEMODE").checked)
    if (sbookTestOpt("mouse",["touch","keyboard"],"")) {}
    else sessionsettings=sessionsettings+" mouse";
  if ($("SBOOKKBDMODE").checked)
    if (sbookTestOpt("keyboard",["touch","mouse"],"")) {}
    else sessionsettings=sessionsettings+" keyboard";
  if ($("SBOOKHUDFLASH").checked)
    if (sbookTestOpt("flash","noflash","")) {}
    else sessionsettings="sessionsettings"+flash;
  else if (sbookTestOpt("noflash","flash","")) {}
  else sessionsettings=sessionsettings+" noflash";
  if ($("SBOOKSPARSE").checked)
    if (sbookTestOpt("sparse","rich","")) {}
    else sessionsettings=sessionsettings+" sparse";
  else if (sbookTestOpt("sparse","rich","")) {}
  else sessionsettings=sessionsettings+" rich";
  fdjtSetSession("sbookopts",sessionsettings);
  sbookApplySettings();
}

function sbookSaveSessionSettings()
{
  var opts=fdjtGetSession("sbookopts");
  if (opts) {
    fdjtSetLocal("sbookopts",opts);
    fdjtDropLocal("sbookopts");}
}

/* Other setup */

function sbookLookupServer(string)
{
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
  return false;
}

function sbookSetupGlossServer()
{
  var domain=document.domain;
  if ((sbook_server) && (domain===sbook_server))
    return;
  else if (sbook_server) {
    var common_suffix=fdjtCommonSuffix(sbook_server,domain,'.');
    if (common_suffix) {
      if (common_suffix.indexOf('.')>0) {
	if (sbook_trace_network)
	  fdjtLog("[%fs] Setting up access to gloss server %o from %o through %o",
		  fdjtET(),sbook_server,domain,common_suffix);
	var iframe=fdjtNewElement("iframe");
	iframe.style.display='none';
	iframe.id="SBOOKIBRIDGE";
	iframe.onload=function() {
	  document.domain=common_suffix;
	  sbookSetIBridge(iframe.contentWindow);};
      	iframe.src=
	  'http://'+sbook_server+'/sbook/ibridge.fdcgi?DOMAIN='+common_suffix;
	document.body.appendChild(iframe);}}}
}

function sbookSetIBridge(window)
{
  sbook_ibridge=window;
  if ($("SBOOKMARKFORM")) $("SBOOKMARKFORM").ajaxbridge=window;
}

function _sbook_domain_match(x,y)
{
  if (x.length===y.length) return (x===y);
  else {
    var i=0; var len=((x.length<y.length)?(x.length):(y.length));
    while (i<len)
      if (x[i]===y[i]) i++;
      else return false;
    if (x.length>i)
      if (x[i+1]==='.') return true;
      else return false;
    else if (y.length>i)
      if (y[i+1]==='.') return true;
      else return false;
    else return false;}
}

/* Adding qricons */

function sbookAddQRIcons()
{
  var i=0;
  while (i<sbook_heads.length) {
    var head=sbook_heads[i++];
    var id=head.id;
    var title=(head.sbookinfo)&&sbook_get_titlepath(head.sbookinfo);
    var qrhref="https://"+sbook_server+"/sbook/qricon.fdcgi?"+
      "URI="+encodeURIComponent(sbook_docuri||sbook_refuri)+
      ((id)?("&FRAG="+head.id):"")+
      ((title) ? ("&TITLE="+encodeURIComponent(title)) : "");
    var qricon=fdjtImage(qrhref,"sbookqricon");
    fdjtPrepend(head,qricon);}
}

/* The Help Splash */

function _sbookHUDSplash()
{
  if ((document.location.search)&&
      (document.location.search.length>0))
    sbookHUDMode("sbookapp");
  else {
    var cookie=fdjtGetCookie("sbookhidehelp");
    if (cookie==='no') sbookHUDMode("help");
    else if (cookie) {}
    else if (sbook_help_on_startup) sbookHUDMode("help");
    else if (!(sbook_mode)) {}
    else if (sbook_mode!=="console") {}
    else sbookHUDMode(false);}
}

/* Other stuff */

/* This initializes the sbook state to the initial location with the
   document, using the hash value if there is one. */ 
function sbookInitLocation()
{
  var hash=window.location.hash; var target=sbook_root;
  var justfocus=true;
  if ((typeof hash === "string") && (hash.length>0)) {
    if ((hash[0]==='#') && (hash.length>1))
      target=sbook_hashmap[hash.slice(1)];
    else target=sbook_hashmap[hash];
    if (sbook_trace_startup)
      fdjtLog("[%f] sbookInitLocation %s=%o",fdjtET(),hash,target);
    justfocus=false;}
  else if (fdjtGetCookie("sbookfocus")) {
    var focusid=fdjtGetCookie("sbookfocus");
    if (sbook_trace_startup)
      fdjtLog("[%f] sbookInitLocation cookie=#%s=%o",
	      fdjtET(),focusid,target);
    if ((focusid)&&($(focusid)))
      target=$(focusid);
    else target=sbook_root;}
  else if (window.scrollY) {
    var scrollx=window.scrollX||document.body.scrollLeft;
    var scrolly=window.scrollY||document.body.scrollTop;
    var xoff=scrollx+sbook_last_x;
    var yoff=scrolly+sbook_last_y;
    var scroll_target=sbookGetXYFocus(xoff,yoff);
    if (sbook_trace_startup)
      fdjtLog("[%f] sbookInitLocation %o,%o=%o jf=%o",fdjtET(),xoff,yoff,target);
    if (scroll_target) target=scroll_target;}
  if (sbook_trace_startup)
    fdjtLog("[%f] sbookInitLocation t=%o jf=%o",fdjtET(),target,justfocus);
  sbookSetFocus(target||sbook_start||sbook_root);
  if (justfocus) {
    if (sbook_pageview)
      if (target) sbookGoToPage(sbookGetPage(target));
      else sbookGoToPage(sbookGetPage(sbook_start));
    else if ((target!==sbook_root)||(target!==document.body)) 
      target.scrollIntoView();}
  else sbookGoTo(target||sbook_start||sbook_root);
}

/* Initialization */

var _sbook_setup=false;
var _sbook_setup_start=false;

function sbookSetup()
{
  if (_sbook_setup) return;
  if (!(_sbook_setup_start)) _sbook_setup_start=new Date();
  if (!((fdjt_setup_started))) fdjtSetup();
  if (_sbook_setup) return;
  if (sbook_user) fdjtSwapClass(document.body,"nosbookuser","sbookuser");
  else fdjtAddClass(document.body,"nosbookuser");
  fdjtAddClass(document.body,"sbooknovice");
  var fdjt_done=new Date();
  sbookGetSettings();
  sbookDisplaySetup();
  if (!((document.location.search)&&
	(document.location.search.length>0))) {
    sbookHUDMode(false);
    sbookMessage("Setting up your sBook");}
  sbookApplySettings();
  if (fdjtGetQuery("action")) {
    sbookSetupAppFrame();
    sbookHUDMode("sbookapp");}
  if ((!(sbook_ajax_uri))||(sbook_ajax_uri==="")||(sbook_ajax_uri==="none"))
    sbook_ajax_uri=false;
  sbookMessage("Scanning document structure");
  var scanstate=sbookGatherMetadata();
  sbookInitNavHUD();
  var scan_done=new Date();
  sbookMessage("Determining page layout");
  if (sbook_pageview) sbookCheckPagination();
  sbookMessage("Processing knowledge sources");
  if (knoHTMLSetup) knoHTMLSetup();
  if (scanstate) sbookHandleInlineKnowlets(scanstate);
  var knowlets_done=new Date();
  sbookMessage("Indexing tags");
  if (scanstate) sbookIndexTags(scanstate);
  sbookIndexTechnoratiTags(knowlet);
  var tags_done=new Date();
  if ($("SBOOKHIDEHELP"))
    $("SBOOKHIDEHELP").checked=(!(sbook_help_on_startup));
  if (sbook_gloss_data) {sbookGlossesSetup();}
  else {
    sbookMessage("Loading glosses...");
    var refuri=sbook_refuri; var added=[];
    var uri="https://"+sbook_server+"/sbook/glosses.fdcgi?URI="+
      (encodeURIComponent(refuri))+
      ((sbook_mycopyid)?("&MYCOPY="+encodeURIComponent(sbook_mycopyid)):(""));
    added.push(refuri);
    var i=0; while (i<sbook_refuris.length) {
      if (fdjtContains(added,sbook_refuris)) i++;
      else {
	var oref=sbook_refuris[i++];
	uri=uri+'&'+oref; added.push(oref);}}
    var script_elt=fdjtNewElement("SCRIPT");
    script_elt.language="javascript"; script_elt.src=uri;
    document.body.appendChild(script_elt);}
  var hud_done=new Date();
  sbookInitLocation();
  var hud_init_done=new Date();
  window.onresize=sbookCheckPagination;
  sbookGestureSetup();
  sbookFlashMessage();
  // sbookFullCloud();
  _sbook_setup=new Date();
}

var _sbook_user_setup=false;
var _sbook_gloss_setup=false;
var _sbook_social_setup=false;

function sbookDisplaySetup()
{
  var useragent=navigator.userAgent;
  var topleading=fdjtDiv("#SBOOKTOPLEADING.leading.top"," ");
  var bottomleading=fdjtDiv("#SBOOKBOTTOMLEADING.leading.bottom"," ");
  var pagehead=sbookMakeMargin(".sbookmargin#SBOOKTOPMARGIN"," ");
  var pagefoot=sbookMakeMargin(".sbookmargin#SBOOKBOTTOMMARGIN"," ");
  var leftedge=fdjtDiv("#SBOOKLEFTMARGIN.hud.sbookmargin");
  var rightedge=fdjtDiv("#SBOOKRIGHTMARGIN.hud.sbookmargin");
    
  if ((useragent.search("Safari/")>0)&&(useragent.search("Mobile/")>0))
    sbookMobileSafariSetup();    
  topleading.sbookui=true; bottomleading.sbookui=true;
  fdjtPrepend(document.body,createSBOOKHUD(),
	      topleading,pagehead,pagefoot,leftedge,rightedge);  
  fdjtAppend(document.body,bottomleading);
  var pagehead=$("SBOOKTOPMARGIN");
  var pagefoot=$("SBOOKBOTTOMMARGIN");
  var bgcolor=document.body.style.backgroundColor;
  if ((!(bgcolor)) && (window.getComputedStyle)) {
    var bodystyle=window.getComputedStyle(document.body,null);
    var bgcolor=((bodystyle)&&(bodystyle.backgroundColor));
    if ((bgcolor==='transparent')||(bgcolor.search('rgba')>=0))
      bgcolor=false;}
  if (bgcolor) {
    pagehead.style.backgroundColor=bgcolor;
    pagefoot.style.backgroundColor=bgcolor;}
  // Probe the size of the head and foot
  pagehead.style.display='block'; pagefoot.style.display='block';
  sbook_top_px=pagehead.offsetHeight;
  sbook_bottom_px=pagefoot.offsetHeight;
  pagehead.style.display=null; pagefoot.style.display=null;
  pagehead.sbookui=true; pagefoot.sbookui=true;
  pagehead.onclick=sbookPageHead_onclick;
  pagefoot.onclick=sbookPageFoot_onclick;
  leftedge.title='tap/click to go back';
  leftedge.onclick=sbookLeftEdge_onclick;
  rightedge.title='tap/click to go forward';
  rightedge.onclick=sbookRightEdge_onclick;

}

function sbookMobileSafariSetup()
{
  var head=$$("HEAD")[0];
  fdjtTrace("Mobile Safari setup");
  document.body.ontouchmove=
    function(evt){ if (sbook_pageview) {
      evt.preventDefault(); return false;}};
  var meta=fdjtElt("META");
  meta.name='apple-mobile-web-app-capable ';
  meta.content='yes';
  fdjtPrepend(head,meta);
  var meta=fdjtElt("META");
  meta.name='viewport'; meta.content='user-scalable=no,width=device-width';
  fdjtPrepend(head,meta);
  fdjtAddClass(document.body,"fixedbroken");

  var modepos=fdjtIndexOf(sbook_default_opts,"mouse");
  if (modepos<0) sbook_default_opts.push("touch");
  else sbook_default_opts[modepos]="touch";

  sbook_floating_hud=true;
}

function sbookGlossesSetup()
{
  sbookUserSetup();
  if (_sbook_gloss_setup) return;
  sbookMessage("Importing glosses...");
  sbookInitSocialHUD();
  sbookInitSearchHUD();
  sbookImportGlosses();
  sbookMessage("Analyzing tag frequencies...");
  sbookTagScores();
  sbookMessage("Setting up search cloud...");
  sbookFullCloud();
  sbookMessage("Setting up glossing cloud...");
  fdjtReplace("SBOOKMARKCLOUD",sbookMarkCloud());
  sbookSetupGlossServer();
  if (sbook_user) fdjtSwapClass(document.body,"nosbookuser","sbookuser");
  if ($("SBOOKFRIENDLYOPTION"))
    if (sbook_user)
      $("SBOOKFRIENDLYOPTION").value=sbook_user;
    else $("SBOOKFRIENDLYOPTION").value=null;
  if (sbook_heading_qricons) {
    sbookMessage("Adding print icons...");
    sbookAddQRIcons();}
  sbookMessage("Importing personal overlays...");
  if (sbook_user) sbookImportOverlays();
  var done=new Date().getTime();
  sbookMessage("Completed sBook setup"," in ",
	       ((done-_sbook_setup_start.getTime())/1000),
	       " seconds");
  // fdjtTrace("[%fs] Done with glosses setup",fdjtET());
  _sbookHUDSplash();
  _sbook_gloss_setup=true;
}

function sbookImportOverlays(arg)
{
  var invite_options=$("SBOOKINVITEOPTIONS");
  var mark_options=$("SBOOKMARKOPTIONS");
  var overlays=((arg)?((arg.oid)?(new Array(arg)):(arg)):sbook_user_overlays);
  var i=0; var n=overlays.length;
  while (i<n) {
    var info=overlays[i++];
    if (!(info.oid)) continue;
    else if (fdjtContains(sbook_overlays,info.oid)) {}
    else {
      var named="("+info.kind.slice(1)+") "+info.name;
      sbook_overlays.push(info.oid);
      var invite_option=fdjtElt("OPTION",named);
      invite_option.title=info.about;
      invite_option.value=info.oid;
      fdjtAppend(invite_options,invite_option);
      var mark_option=fdjtElt("OPTION",named);
      mark_option.title=info.about;
      mark_option.value=info.oid;
      fdjtAppend(mark_options,mark_option);}
    fdjtImportOID(info);}
}

function sbookSocialSetup()
{
  sbookUserSetup();
  if (_sbook_social_setup) return;
  if (typeof sbook_tribes !== "undefined")
    sbookImportSocialInfo(sbook_social_info);
  if (sbook_user_canpost) {
    fdjtDropClass(document.body,"sbookcantpost");}
  _sbook_social_setup=true;
}

function sbookUserSetup()
{
  if (_sbook_user_setup) return;
  if (!(sbook_user)) {
    fdjtAddClass(document.body,"nosbookuser");
    return;}
  if ((sbook_user_data)&&(sbook_user_data.oid))
    fdjtImportOID(sbook_user_data);
  if (sbook_user) fdjtSwapClass(document.body,"nosbookuser","sbookuser");
  var userinfo=fdjtOIDs[sbook_user];
  var username=userinfo.name;
  if ((!(sbook_user_img))&&(userinfo.pic))
    sbook_user_img=userinfo.pic;
  fdjtReplace("SBOOKUSERNAME",fdjtSpan("username",username));
  if ($("SBOOKMARKUSER")) $("SBOOKMARKUSER").value=sbook_user;
  if ($("SBOOKMARKFORM"))
    $("SBOOKMARKFORM").onsubmit=fdjtForm_onsubmit;
  if (sbook_user_img) {
    if ($("SBOOKMARKIMAGE")) $("SBOOKMARKIMAGE").src=sbook_user_img;
    if ($("SBOOKUSERPIC")) $("SBOOKUSERPIC").src=sbook_user_img;}
  var idlinks=document.getElementsByName("IDLINK");
  if (idlinks) {
    var i=0; var len=idlinks.length;
    while (i<len) {
      var idlink=idlinks[i++];
      idlink.target='_blank';
      idlink.title='click to edit your personal information';
      idlink.href='http://www.sbooks.net/admin/id.fdcgi';}}
  _sbook_user_setup=true;
}

function sbookSetupAppFrame()
{
  var query=document.location.search||"?";
  var refuri=sbook_refuri;
  var appuri="https://"+sbook_server+"/sbook/manage.fdcgi"+query;
  if (query.search("REFURI=")<0)
    appuri=appuri+"&REFURI="+encodeURIComponent(refuri);
  if (query.search("DOCURI=")<0)
    appuri=appuri+"&DOCURI="+encodeURIComponent(sbook_docuri);
  if (document.title) {
    appuri=appuri+"&DOCTITLE="+encodeURIComponent(document.title);}
  $("APPFRAME").src=appuri;
}

fdjtAddSetup(sbookSetup);

fdjtLoadMessage("Loaded sbooks module");

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
