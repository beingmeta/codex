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
// Array of sbook info, mapping from element IDs to descriptive info
var sbook_info=[];
// Array of sbook info, mapping from element IDs objects
var sbook_idinfo={};
// This is a big weighted inverted index
var sbook_index=new KnowletIndex();
// This is a pool for all OID information
var sbookOIDs=new fdjtKB.Pool("oids");

/* Tag indices */

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
// Whether the HUD is up
var sbook_interaction=false;
// Whether we're moving ourselves
var sbook_egomotion=false;
// This is the last mode which was active
var sbook_last_mode="context";
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
// Whether to do gesture recognition
var sbook_gestures=false;
// Whether to handle edge taps/clicks
var sbook_edge_taps=true;
// Modifies some gestures to be more accessible
var sbook_accessible=false;
// Whether the HUD should track the scroll position absolutely
// This is neccessary for viewport based browsers like the iPad
var sbook_notfixed=false;

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
// Whether to trace navigation
var sbook_trace_nav=false;
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
      ("[%f] %s %o in %o: mode%s=%o, target=%o, head=%o preview=%o",
       fdjtElapsedTime(),handler,cxt,cxt.target,
       ((sbook_preview)?("(preview)"):""),sbook_mode,
       sbook_target,sbook_head,sbook_preview);
  else fdjtLog
	 ("[%f] %s %o: mode%s=%o, target=%o, head=%o preview=%o",
	  fdjtElapsedTime(),handler,cxt,
	  ((sbook_preview)?("(preview)"):""),sbook_mode,
	  sbook_target,sbook_head,sbook_preview);
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

function sbookInfo(arg)
{
  if (arg)
    if (typeof arg === 'string')
      return sbook_info[arg]||sbookOIDs.map[arg];
    else if (arg.oid) return arg;
    else if (arg.id) return sbook_info[arg.id];
    else return false;
  else return false;
}

function sbookTarget(arg)
{
  if (arg)
    if (typeof arg === 'string')
      return document.getElementById(arg);
    else if (arg.nodeType) return arg;
    else if (arg.frag)
      return document.getElementById(arg);
    else if (arg.id) return sbook_info[arg.id];
    else return false;
  else return false;
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
    if ((target.id)&&(sbook_info[target.id])) {
      target=sbook_info[target.id]; break;}
    else target=target.parentNode;
  if (target)
    if (target.toclevel)
      return target.elt||document.getElementById(target.frag);
    else if (target.head)
      return target.head.elt||
	document.getElementById(target.head.frag);
    else return false;
  else return false;
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
  return (target)&&($ID(target.sbook_ref));
}

function sbookGetTarget(scan,closest)
{
  var target=false;
  while (scan) 
    if ((scan===sbook_root)||(scan===sbook_root)||(scan.sbookui))
      return target;
    else if (scan.id)
      if ((fdjtHasClass(scan,"sbookfoci"))||
	  (fdjtElementMatches(scan,sbook_focus_rules)))
	return scan;
      else if (closest) return scan;
      else if (target) scan=scan.parentNode;
      else {target=scan; scan=scan.parentNode;}
    else scan=scan.parentNode;
  return target;
}

function sbookGetTitle(target)
{
  if (target===sbook_target)
    return sbook_target_title;
  else return (target.title)||false;
}

/* Global query information */

function sbookSetQuery(query,scored)
{
  if ((sbook_query) &&
      ((sbook_query._query)===query) &&
      ((scored||false)===(sbook_query._scored)))
    return sbook_query;
  var result=sbookQuery(query);
  if (result._qstring!==sbookQueryBase($ID("SBOOKSEARCHTEXT").value)) {
    $ID("SBOOKSEARCHTEXT").value=result._qstring;
    $ID("SBOOKSEARCHTEXT").removeAttribute('isempty');}
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
    var ncompletions=fdjtComplete($ID("SBOOKSEARCHTEXT")).length;}
  sbookSetSources($ID("SBOOKGLOSSES"),result._sources||[]);
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
  var info=sbookInfo(head);
  if (info.title) {
    var scan=sbookInfo(info.elt.sbook_ref);
    while (scan) {
      if (scan.title) title=title+" // "+scan.title;
      scan=sbookInfo(scan.elt.head);}
    return title;}
  else return null;
}

function sbookSetHead(head)
{
  if (head===null) head=sbook_root;
  else if (typeof head === "string") {
    var probe=$ID(head);
    if (!(probe)) probe=sbook_hashmap[head];
    if (!(probe)) return;
    else head=probe;}
  if (!(head.toclevel)) head=sbookGetHead(head);
  if (!(head)) return;
  else if (head===sbook_head) {
    if (sbook_debug) fdjtLog("Redundant SetHead");
    return;}
  else if (head) {
    var headinfo=sbookInfo(head);
    if (sbook_trace_focus) sbook_trace("sbookSetHead",head);
    sbookTOC.update("SBOOKTOC4",headinfo,sbookInfo(sbook_head));
    sbookTOC.update("SBOOKDASHTOC4",headinfo,sbookInfo(sbook_head));
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
  var info=sbookInfo(sbook_head);
  while (info) {
    var tocelt=document.getElementById("SBOOKTOC4"+info.frag);
    var dashtocelt=document.getElementById("SBOOKDASHTOC4"+info.frag);
    var start=tocelt.sbook_start; var end=tocelt.sbook_end;
    var progress=((location-start)*80)/(end-start);
    var bar=fdjtGetFirstChild(tocelt,".progressbar");
    var appbar=fdjtGetFirstChild(dashtocelt,".progressbar");
    if (sbook_trace_locations)
      fdjtLog("For tocbar %o loc=%o start=%o end=%o progress=%o",
	      bar,location,start,end,progress);
    if ((bar)&& (progress>0) && (progress<100)) {
      bar.style.width=((progress)+10)+"%";
      appbar.style.width=((progress)+10)+"%";}
    info=info.head;}
  var spanbars=FDJT$(".spanbar",$ID("SBOOKHUD"));
  var i=0; while (i<spanbars.length) {
    var spanbar=spanbars[i++];
    var width=spanbar.ends-spanbar.starts;
    var ratio=(location-spanbar.starts)/width;
    if (sbook_trace_locations)
      fdjtLog("ratio for spanbar %o[%d] is %o [%o,%o,%o]",
	      spanbar,spanbar.childNodes[0].childNodes.length,
	      ratio,spanbar.starts,location,spanbar.ends);
    if ((ratio>=0) && (ratio<=1)) {
      var progressbox=FDJT$(".progressbox",spanbar);
      if (progressbox.length>0) {
	progressbox[0].style.left=((Math.round(ratio*10000))/100)+"%";}}}
  sbook_location=location;
}

/* Next and previous heads */

function sbookNextHead(head)
{
  var info=sbookInfo(head);
  if ((info.sub)&&(info.sub.length>0))
    return $ID(info.sub[0].id);
  else if (info.next)
    return $ID(info.next.id);
  else if ((info.head)&&(info.head.next))
    return $ID(info.head.next.id);
  else return false;
}

function sbookPrevHead(head)
{
  var info=sbookInfo(head);
  if (info.prev)
    return $ID(info.prev.id);
  else if (info.head)
    return $ID(info.head.id);
  else return false;
}

/* Tracking the target */

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
    var head=sbookGetHead(target);
    fdjtAddClass(target,"sbooktarget");
    fdjtSetCookie("sbooktarget",target);
    sbook_target=target;
    sbookSetHead(head);
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
  if (sbook_mode)
    if (toc=$ID("SBOOKTOC"))
      return -((toc.offsetHeight||50)+15);
    else return -60;
  else return -40;
}

function sbookScrollTo(elt,cxt)
{
  fdjtClearPreview();
  if ((elt.getAttribute) &&
      ((elt.tocleve)|| (elt.getAttribute("toclevel")) ||
       ((elt.sbookinfo) && (elt.sbookinfo.level))))
    sbookSetHead(elt);
  else if (elt.head)
    sbookSetHead(elt.head);
  if (sbook_pageview)
    sbookGoToPage(sbookGetPage(elt));
  else if (fdjtIsVisible(elt)) {}
  else if ((!cxt) || (elt===cxt))
    fdjtScrollTo(elt,sbookGetStableId(elt),false,true,sbookDisplayOffset());
  else fdjtScrollTo(elt,sbookGetStableId(elt),cxt,true,sbookDisplayOffset());
}

function sbookSetHashID(target)
{
  if ((!(target.id))||(window.location.hash===target.id)||
      ((window.location.hash[0]==='#')&&
       (window.location.hash.slice(1)===target.id)))
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
    sbookScrollTo(target,((target.head)&&($ID(target.head))));
  else {}
}

function sbookGoTo(target,noset)
{
  sbookPreview(false);
  if (typeof target === 'string') target=document.getElementById(target);
  if (!(target)) return;
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
    sbookHUDFlash("context",sbook_hud_flash);
}

/* Mouse handlers */

function sbook_onscroll(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbook_onscroll",evt);
  /* If you're previewing, ignore mouse action */
  if (sbook_preview) return;
  if (sbook_target) sbookCheckTarget();
}

function sbook_tagdiv_onclick(evt)
{
  var target=$T(evt);
  var term=((target.sectname)||
	    ((target.getAttribute) && (target.getAttribute("dterm"))));
  var textinput=$ID("SBOOKSEARCHTEXT");
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
    var next=(info.head)||false;
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

  if (sbookTestOpt("touch",["mouse",",keyboard"]))
    sbook_interaction="touch";
  else if (sbookTestOpt("keyboard",["mouse","touch"]))
    sbook_interaction="keyboard";
  else sbook_interaction="mouse";


  // Unavoidable browser sniffing
  var useragent=navigator.userAgent;
  if ((useragent.search("Safari/")>0)&&(useragent.search("Mobile/")>0))
    sbookMobileSafariSetup();
}

function sbookGetScanSettings()
{
  if (!(sbook_root))
    if (fdjtGetMeta("SBOOKROOT"))
      sbook_root=$ID(fdjtGetMeta("SBOOKROOT"));
    else sbook_root=document.body;
  if (!(sbook_start))
    if (fdjtGetMeta("SBOOKSTART"))
      sbook_start=$ID(fdjtGetMeta("SBOOKSTART"));
    else if ($ID("SBOOKSTART"))
      sbook_start=$ID("SBOOKSTART");
    else {
      var titlepage=$ID("SBOOKTITLE")||$ID("TITLEPAGE");
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
  else if ($ID(sbook_baseid))
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

/* Device settings */

function sbookMobileSafariSetup()
{
  var head=FDJT$("HEAD")[0];
  fdjt_format_console=true;

  document.body.ontouchmove=
    function(evt){
    var target=$T(evt);
    if ((FDJT$P("sbooksummaries",target))||
	(fdjtHasParent(target,sbookDash)))
      return true;
    else if (sbook_pageview) {
      evt.preventDefault(); return false;}};

  var head=FDJT$("HEAD")[0];
  var appmeta=fdjtElt("META");
  appmeta.name='apple-mobile-web-app-capable';
  appmeta.content='yes';
  // fdjtPrepend(head,appmeta);

  var viewmeta=fdjtElt("META");
  viewmeta.name='viewport';
  viewmeta.content='user-scalable=no,width=device-width';
  fdjtPrepend(head,viewmeta);

  sbook_notfixed=true;
  fdjtAddClass(document.body,"notfixed");
  
 var mouseopt=fdjtIndexOf(sbook_default_opts,"mouse");
  if (mouseopt<0)
    mouseopt=fdjtIndexOf(sbook_default_opts,"keyboard");
  if (mouseopt<0)
    mouseopt=fdjtIndexOf(sbook_default_opts,"oneclick");
  if (mouseopt<0) sbook_default_opts.push("touch");
  else sbook_default_opts[mouseopt]="touch";

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

function sbookApplySessionSettings()
{
  // This applies the current session settings
  sbookSparseMode(sbookTestOpt("sparse","rich"));
  sbookFlashMode(sbookTestOpt("flash","dull"));
  var tocmax=fdjtGetMeta("SBOOKTOCMAX",true);
  if (tocmax) sbook_tocmax=parseInt(tocmax);
  var sbookhelp=fdjtGetMeta("SBOOKHELP",true);
  if (sbookhelp) sbook_help_on_startup=true;
  sbookPageView(sbookTestOpt("page","scroll"));
  sbookInterfaceMode(sbook_interaction);
}

function sbookUpdateSessionSettings(delay)
{
  if (delay) {
    setTimeout(sbookUpdateSessionSettings,delay);
    return;}
  // This updates the session settings from the checkboxes 
  var sessionsettings="opts";
  if ($ID("SBOOKPAGEVIEW").checked)
    if (sbookTestOpt("page","scroll","")) {}
    else sessionsettings=sessionsettings+" page";
  else if (sbookTestOpt("scroll","page","")) {}
  else sessionsettings=sessionsettings+" scroll";
  if ($ID("SBOOKTOUCHMODE").checked)
    if (sbookTestOpt("touch",["mouse","keyboard"],"")) {}
    else sessionsettings=sessionsettings+" touch";
  if ($ID("SBOOKMOUSEMODE").checked)
    if (sbookTestOpt("mouse",["touch","keyboard"],"")) {}
    else sessionsettings=sessionsettings+" mouse";
  if ($ID("SBOOKKBDMODE").checked)
    if (sbookTestOpt("keyboard",["touch","mouse"],"")) {}
    else sessionsettings=sessionsettings+" keyboard";
  if ($ID("SBOOKHUDFLASH").checked)
    if (sbookTestOpt("flash","noflash","")) {}
    else sessionsettings="sessionsettings"+flash;
  else if (sbookTestOpt("noflash","flash","")) {}
  else sessionsettings=sessionsettings+" noflash";
  if ($ID("SBOOKSPARSE").checked)
    if (sbookTestOpt("sparse","rich","")) {}
    else sessionsettings=sessionsettings+" sparse";
  else if (sbookTestOpt("sparse","rich","")) {}
  else sessionsettings=sessionsettings+" rich";
  fdjtSetSession("sbookopts",sessionsettings);
  sbookApplySessionSettings();
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
  if ($ID("SBOOKMARKFORM")) $ID("SBOOKMARKFORM").ajaxbridge=window;
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
  else if (fdjtGetCookie("sbooktarget")) {
    var targetid=fdjtGetCookie("sbooktarget");
    if (sbook_trace_startup)
      fdjtLog("[%f] sbookInitLocation cookie=#%s=%o",
	      fdjtET(),targetid,target);
    if ((targetid)&&($ID(targetid)))
      target=$ID(targetid);
    else target=sbook_root;}
  if (sbook_trace_startup)
    fdjtLog("[%f] sbookInitLocation t=%o jf=%o",fdjtET(),target,justfocus);
  sbookSetHead(target||sbook_start||sbook_root);
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
  if (fdjtGetQuery("action")) {
    sbookSetupAppFrame();
    sbookHUDMode("sbookapp");}
  if ((!(sbook_ajax_uri))||(sbook_ajax_uri==="")||(sbook_ajax_uri==="none"))
    sbook_ajax_uri=false;
  sbookMessage("Scanning document structure");
  var metadata=sbookScan(sbook_root);
  sbook_info=metadata;
  sbookInitNavHUD(metadata[sbook_root.id]);
  var scan_done=new Date();
  sbookMessage("Determining page layout");
  sbookApplySessionSettings();
  if (sbook_pageview) sbookCheckPagination();
  var knowlet=fdjtDOM.getMeta("KNOWLET")||sbook_refuri;
  sbookMessage("Processing knowledge with knowlet ",knowlet);
  document.knowlet=knowlet=new Knowlet(knowlet);
  if (knowletSetupHTML) knowletSetupHTML();
  var knowlets_done=new Date();
  sbookMessage("Indexing tags");
  sbookIndexTags(metadata);
  // sbookIndexTechnoratiTags(knowlet);
  var tags_done=new Date();
  if ($ID("SBOOKHIDEHELP"))
    $ID("SBOOKHIDEHELP").checked=(!(sbook_help_on_startup));
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
  var topleading=fdjtDOM("div#SBOOKTOPLEADING.leading.top"," ");
  var bottomleading=fdjtDOM("div#SBOOKBOTTOMLEADING.leading.bottom"," ");
  var pagehead=sbookMakeMargin(".sbookmargin#SBOOKPAGEHEAD"," ");
  var pagefoot=sbookMakeMargin(".sbookmargin#SBOOKPAGEFOOT"," ");
  var leftedge=fdjtDOM("div#SBOOKLEFTEDGE.sbookmargin.sbookleft");
  var rightedge=fdjtDOM("div#SBOOKRIGHTEDGE.sbookmargin.sbookright");

  topleading.sbookui=true; bottomleading.sbookui=true;
  var hud=createSBOOKHUD();
  fdjtPrepend(document.body,createSBOOKHUD(),
	      pagehead,pagefoot,leftedge,rightedge,
	      topleading);  
  fdjtAppend(document.body,bottomleading);
  
  sbookPageHead=pagehead; sbookPageFoot=pagefoot;
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
  pagehead.onclick=sbookHeadHUD_onclick;
  pagefoot.onclick=sbookFootHUD_onclick;

  sbook_left_px=leftedge.offsetWidth;
  sbook_right_px=rightedge.offsetWidth;
  leftedge.onclick=sbookLeftEdge_onclick;
  rightedge.title='tap/click to go forward';
  rightedge.onclick=sbookRightEdge_onclick;
  leftedge.title='tap/click to go back';

  // These are the edges above the bottom margin
  var leftedge2=fdjtDOM("div.sbookmargin.sbookleft");
  var rightedge2=fdjtDOM("div.sbookmargin.sbookright");
  fdjtAppend(pagefoot,leftedge2,rightedge2);
  leftedge2.title='tap/click to go back';
  leftedge2.onclick=sbookLeftEdge_onclick;
  rightedge2.title='tap/click to go forward';
  rightedge2.onclick=sbookRightEdge_onclick;
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
  if ($ID("SBOOKFRIENDLYOPTION"))
    if (sbook_user)
      $ID("SBOOKFRIENDLYOPTION").value=sbook_user;
    else $ID("SBOOKFRIENDLYOPTION").value=null;
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
  var invite_options=$ID("SBOOKINVITEOPTIONS");
  var mark_options=$ID("SBOOKMARKOPTIONS");
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
    sbookOIDs.import(info);}
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
    sbookOIDs.import(sbook_user_data);
  if (sbook_user) fdjtSwapClass(document.body,"nosbookuser","sbookuser");
  var userinfo=sbookOIDs.map[sbook_user];
  var username=userinfo.name;
  if ((!(sbook_user_img))&&(userinfo.pic))
    sbook_user_img=userinfo.pic;
  $ID("SBOOKUSERNAME").innerHTML=username;
  if ($ID("SBOOKMARKUSER")) $ID("SBOOKMARKUSER").value=sbook_user;
  if ($ID("SBOOKMARKFORM"))
    $ID("SBOOKMARKFORM").onsubmit=fdjtForm_onsubmit;
  if (sbook_user_img) {
    if ($ID("SBOOKMARKIMAGE")) $ID("SBOOKMARKIMAGE").src=sbook_user_img;
    if ($ID("SBOOKUSERPIC")) $ID("SBOOKUSERPIC").src=sbook_user_img;}
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
  $ID("APPFRAME").src=appuri;
}

fdjtAddSetup(sbookSetup);

fdjtLoadMessage("Loaded sbooks module");

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
