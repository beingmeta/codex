/* -*- Mode: Javascript; -*- */

var sbooks_pagination_id=
  "$Id$";
var sbooks_pagination_version=parseInt("$Revision$".slice(10,-1));

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

var sbook_curpage=-1;
var sbook_curoff=0;
var sbook_curinfo=-1;
var sbook_curbottom=sbook_bottom_px;
var sbook_pagesize=-1;
var sbook_pages=[];
var sbook_pageinfo=[];
var sbook_pagemaxoff=-1;
var sbook_pagescroll=false;
var sbook_fudge_bottom=false;

var sbook_paginated=false;

var sbook_top_px=40;
var sbook_bottom_px=40;
var sbook_widow_limit=3;
var sbook_orphan_limit=3;

var sbook_debug_pagination=false;
var sbook_trace_pagination=0;

/* Pagination predicates */

function sbookIsPageHead(elt)
{
  return ((elt)&&
	  (((elt.toclevel||0)&&
	    (sbook_tocmajor)&&
	    (elt.toclevel<=sbook_tocmajor))||
	   ((sbook_pageheads)&&(fdjtElementMatches(elt,sbook_pageheads)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt,null).pageBreakBefore==='always'))));
}

function sbookIsPageFoot(elt)
{ 
  return ((elt)&&
	  (((sbook_pagefeet)&&(fdjtElementMatches(elt,sbook_pagefeet)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt,null).pageBreakAfter==='always'))));
}

function sbookIsPageBlock(elt)
{
  return ((elt)&&
	  (((sbook_pageblocks)&&(fdjtElementMatches(elt,sbook_pageblocks)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt,null).pageBreakInside==='avoid'))));
}

function sbookAvoidPageHead(elt)
{
  return ((elt)&&
	  (((sbook_avoid_pagehead)&&
	    (fdjtElementMatches(elt,sbook_avoid_pagehead)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt,null).pageBreakBefore==='avoid'))));
}

function sbookAvoidPageFoot(elt)
{
  return ((elt)&&
	  ((elt.toclevel)||(fdjtHasClass(elt,"nobreakafter"))||
	   ((sbook_avoid_pagefoot)&&
	    (fdjtElementMatches(elt,sbook_avoid_pagefoot)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt,null).pageBreakAfter==='avoid'))));
}

/* Pagination loop */

function sbookPaginate(pagesize,start)
{
  if (!(start)) start=_sbookScanContent(sbook_root||document.body);
  var result={}; var pages=[]; var pageinfo=[];
  result.pages=pages; result.info=pageinfo;
  var scan=start; var info=sbookNodeInfo(scan);
  var pagetop=info.top; var pagelim=pagetop+pagesize;
  var fudge=sbook_bottom_px/4;
  var start=fdjtET();
  var curpage={}; var newtop=false; var nodecount=1;
  curpage.pagenum=pages.length;
  curpage.top=pagetop; curpage.limit=pagelim;
  curpage.first=start; curpage.last=start;
  pages.push(pagetop); pageinfo.push(curpage);
  while (scan) {
    var oversize=false;
    var next=_sbookScanContent(scan);
    var nextinfo=(next)&&sbookNodeInfo(next);
    var splitblock=false; var forcebottom=false;
    var widowthresh=((info.fontsize)*sbook_widow_limit);
    var orphanthresh=((info.fontsize)*sbook_orphan_limit);
    // If the top of the current node is above the page,
    //  make scantop be the page top
    var scantop=((info.top<pagetop)?(pagetop):(info.top));
    var dbginfo=((sbook_debug_pagination)&&
		 ("P#"+curpage.pagenum+
		  "["+pagetop+","+pagelim+
		  "/"+pagesize+"/"+widowthresh+","+orphanthresh+"] "));
    // We track a 'focus' for every page, which is the first sbook
    // focusable element on the page.
    if (!(curpage.focus))
      if ((scan.toclevel)||(fdjtElementMatches(scan,sbook_focus_rules)))
	curpage.focus=scan;
    if (dbginfo) dbginfo=dbginfo+(_sbookPageNodeInfo(scan,info,curpage));
    if ((dbginfo)&&(next))
      dbginfo=dbginfo+" ... N#"+next.id+
	_sbookPageNodeInfo(next,nextinfo,curpage);
    if (sbook_trace_pagination>1) _sbookTracePagination("SCAN",scan,info);
    if ((dbginfo)&&(scan.getAttribute("sbookpagedbg")))
      dbginfo=scan.getAttribute("sbookpagedbg")+" // "+dbginfo;
    if (sbookIsPageHead(scan)) {
      // Unless we're already at the top, just break
      if (scantop>pagetop) newtop=scan;
      else {}}
    // WE'RE COMPLETELY OFF THE PAGE
    else if (scantop>pagelim) {
      // Issue a warning (if neccessary) and break on this element
      if (sbookAvoidPageHead(scan)) 
	fdjtWarn("Pagination got stuck with non page head %o",scan);
      else if (sbookIsPageFoot(scan))
	fdjtWarn("Pagination got stuck with page foot at head %o",scan);
      else {}
      newtop=scan;}
    else if ((info.bottom>pagelim)&&(sbookIsPageBlock(scan)))
      if (info.top>pagetop)  // If we're not at the top, break now
	newtop=scan;
      else {
	// Otherwise, declare an oversized page
	curpage.bottom=info.bottom;
	curpage.oversize=oversize=true;}
    // WE'RE COMPLETELY ON THE PAGE
    // including the case where we have children which are on the page.
    else if ((info.bottom<pagelim)||((nextinfo)&&(nextinfo.top<pagelim))) {
      if (sbookAvoidPageHead(scan)) {} // don't think about breaking here
      // if we want to be a foot, force a break at the next node
      else if (sbookIsPageFoot(scan)) {
	curpage.bottom=info.bottom;
	newtop=_sbookScanContent(scan);}
      // if we're a bad foot close to the bottom, break
      else if (((scan.toclevel)||(sbookAvoidPageFoot(scan)))&&
	       ((pagelim-info.bottom)<widowthresh))
	newtop=scan;
      // Look ahead to see if we should page break anyway
      else if (next) {
	// Only record next in debug info if we look at it
	if (dbginfo)
	  dbginfo=dbginfo+" ... N#"+next.id+
	    _sbookPageNodeInfo(next,nextinfo,curpage);
	// If we're trying to avoid putting this item at the foot
	if ((scan.toclevel)||(sbookAvoidPageFoot(scan))) {
	  // Break here if the next item 
	  if ((nextinfo.top>=pagelim) // is off the page
	      ||(sbookIsPageHead(next)) // is a forced head
	      // is a straddling no-break block
	      ||((nextinfo.top<pagelim)&&(nextinfo.bottom>pagelim)&&
		 (sbookIsPageBlock(next)))
	      // is a bad foot close to the bottom
	      ||(((next.toclevel)||(sbookAvoidPageFoot(next)))&&
		 ((pagelim-nextinfo.bottom)<widowthresh*2))
	      // is likely to be pushed off the bottom
	      ||((pagelim-nextinfo.top)<widowthresh)
	      // is small and straddling
	      ||((nextinfo.bottom>=pagelim)&&
		 ((nextinfo.height)<(widowthresh+orphanthresh))))
	    newtop=scan;
	  else {}} ///// End of foot avoiding logic
	else if (sbookAvoidPageHead(next)) {
	  // If the next node is a bad head, break or split
	  if (nextinfo.bottom<pagelim) {} // if there isn't enough space for it
	  else { // Either break or split
	    var newbreak=info.bottom-orphanthresh;
	    if (newbreak<scantop) newtop=scan; // just break
	    else { // split
	      curpage.bottom=newbreak;
	      newtop=splitblock=scan;}}}
	// No problem, leave this block on the page
	else {}}
      // We're on the page and at the end
      else {}
      /* End of 'on the page' cases */}
    // If we've gotten here,
    // WE'RE STRADDLING THE BOTTOM OF THE PAGE
    else if (sbookIsPageBlock(scan))
      if (curpage.top<scantop)
	// Break if we're not at the top already
	newtop=scan;
      else {
	// If we're already at the top, this is a huge block
	// and we will make an oversize page
	curpage.bottom=info.bottom;
	curpage.oversize=oversize=true;
	curpage.last=scan;}
    else if ((scan.toclevel)||(sbookAvoidPageFoot(scan)))
      // If we're avoiding the foot, we start a new page
      newtop=scan;
    else if (sbookAvoidPageHead(scan))
      // If we're avoiding the head, we split this block.
      newtop=splitblock=scan;
    else if ((sbook_fudge_bottom)&&
	     (sbookIsPageFoot(scan))&&
	     (info.bottom<(pagelim+sbook_fudge_bottom)))
      // If we want to be a foot and we're close enough,
      // just fudge the bottom, pushing it down.  This may be 
      // a bad idea (adjust sbook_fudge_bottom accordingly)
      curpage.bottom=info.bottom;
    // If we're too small to split, just start a new page
    else if (info.height<(widowthresh+orphanthresh))
      newtop=scan;
    // If splitting would create a widow, just break
    else if ((pagelim-scantop)<widowthresh)
      newtop=scan;
    // If we might create orphans, adjust the page bottom
    // to ensure that doesn't happen
    else if ((info.bottom-pagelim)<orphanthresh)
      if ((sbook_fudge_bottom)&&
	  (info.bottom<(pagelim+sbook_fudge_bottom))) {
	// possibly move the bottom down
	curpage.bottom=pagelim=info.bottom;}
      else {
	// Or making this page shorter to keep orphans from being
	// too isolated on the next page
	// move the pagelim up to make sure the orphans aren't isolated
	curpage.bottom=pagelim=info.bottom-orphanthresh;
	newtop=splitblock=scan;}
    //  If the next node is inside the current one, just break
    else if (fdjtHasParent(next,scan))
      newtop=scan;
    else {
      // Just break at (around) the pagelim
      newtop=splitblock=scan;
      curpage.bottom=pagelim;}
    // Okay, we've figured out what to do with this element
    if (!(newtop)) {
      // When we're not starting a new page, just extend the bottom
      //  of this one
      curpage.bottom=info.bottom;
      curpage.last=scan;}
    else {
      // If we starting a new page, clean up the page break
      var newinfo=((newtop==scan)?(info):sbookNodeInfo(newtop));
      var prevpage=curpage;
      if (dbginfo)
	dbginfo=dbginfo+" np"+((splitblock)?"/split":"")+"/"+curpage.bottom;
      // Adjust the page bottom information
      if (splitblock) {
	curpage.bottom=pagelim;
	curpage.last=splitblock;
	var newbottom=
	  sbookAdjustPageBreak(splitblock,curpage.top,curpage.bottom);
	if ((newbottom>pagetop)&&(newbottom>info.top)&&
	    (newbottom>(pagetop+(pagesize/2)))) {
	  // Check that we were able to find a good page break
	  curpage.bottom=newbottom;
	  curpage.bottomedge=splitblock;
	  if (dbginfo) dbginfo=dbginfo+"~"+curpage.bottom;
	  // If we're splitting, force the next node to be the split block
	  next=splitblock; nextinfo=info;}
	else {
	  // We weren't able to find a good page break,
	  // so we break entirely (no split), and declare this
	  // page oversize
	  curpage.bottom=info.bottom; curpage.oversize=oversize=true;
	  if (dbginfo) dbginfo=dbginfo+"~oversize/"+curpage.bottom;}}
      // If it's a clean break, make sure that the page bottom is good
      else if (!(curpage.bottom)) curpage.bottom=newinfo.top;
      else if (newinfo.top<curpage.bottom) curpage.bottom=newinfo.top;
      else {}
      if (sbook_trace_pagination) 
	fdjtLog("[%f] New %spage break P%d[%d,%d]#%s %o, closed P%d[%d,%d] %o",
		fdjtET(),((splitblock)?("split "):("")),
		pages.length,newinfo.top,newinfo.bottom,newtop.id,newtop,
		curpage.pagenum,curpage.top,curpage.bottom,curpage);
      // Make a new page
      curpage={}; curpage.pagenum=pages.length;
      if (splitblock) curpage.top=prevpage.bottom;
      else curpage.top=newinfo.top;
      // If the item at the top of the new page is larger than a page,
      // declare the page oversize
      // (Left out for now)
      // Initialize the first and last elements on the page
      curpage.first=newtop; curpage.last=newtop;
      // Indicate the straddling top element, if we're split
      if (splitblock) curpage.topedge=splitblock;
      // Initialize the scan variables of the page top and bottom
      pagetop=curpage.top;
      pagelim=curpage.limit=pagetop+pagesize;
      scan=newtop; splitblock=false; newtop=false;
      // Update the tables
      pages.push(pagetop); pageinfo.push(curpage);}
    if (dbginfo) scan.setAttribute("sbookpagedbg",dbginfo);
    // Advance around the loop.  If we have an explicit next page,
    //  we use it (usually the case if we're splitting a block).
    if (oversize) {
      scan=_sbookScanContent(scan,true);
      if (scan) info=sbookNodeInfo(scan);}
    else if (next) {scan=next; info=nextinfo;}
    else {
      // Otherwise, advance through the DOM
      scan=_sbookScanContent(scan);
      if (scan) info=sbookNodeInfo(scan);}
    if (!(splitblock)) nodecount++;}
  var done=fdjtET();
  fdjtLog("[%f] Paginated %d nodes into %d pages with pagesize=%d in %s",
	  fdjtET(),nodecount,pages.length,pagesize,
	  fdjtShortIntervalString(done-start));
  return result;
}

function sbookNodeInfo(node)
{
  var info=fdjtGetOffset(node);
  var fontsize=getComputedStyle(node,null).fontSize;
  if ((fontsize)&&(typeof fontsize === 'string'))
    fontsize=parseInt(fontsize.slice(0,fontsize.length-2));
  info.fontsize=(fontsize||12);
  return info;
}

var sbook_content_nodes=['IMG','BR','HR'];

function _sbookScanContent(scan,skipchildren)
{
  var info=fdjtGetOffset(scan);
  var next=((skipchildren)?
	    (fdjtNextNode(scan,_sbookIsContentBlock)):
	    (fdjtForwardNode(scan,_sbookIsContentBlock)));
  var nextinfo=((next)&&(fdjtGetOffset(next)));
  if (!(next)) {}
  else if ((nextinfo.height===0)||(nextinfo.top<info.top)) 
    // Skip over weird nodes
    return _sbookScanContent(next,skipchildren);
  else if ((sbookIsPageHead(next))||(sbookIsPageBlock(next))) {}
  else if ((next.childNodes)&&(next.childNodes.length>0)) {
    var children=next.childNodes;
    if ((children[0].nodeType===1)&&(_sbookIsContentBlock(children[0])))
      next=children[0];
    else if ((children[0].nodeType===3)&&
	     (fdjtIsEmptyString(children[0].nodeValue))&&
	     (children.length>1)&&(children[1].nodeType===1)&&
	     (_sbookIsContentBlock(children[1])))
      next=children[1];}
  if ((next)&&(sbook_debug_pagination)) {
    if (next.id) scan.setAttribute("sbooknextnode",next.id);
    if (scan.id) next.setAttribute("sbookprevnode",scan.id);}
  return next;
}

var sbook_block_tags=
  {"IMG": true, "HR": true, "P": true, "DIV": true,"UL": true,"BLOCKQUOTE":true};

function _sbookIsContentBlock(node)
{
  var styleinfo;
  if (node.nodeType===1)
    if (node.sbookui) return false;
    else if (sbook_block_tags[node.tagName]) return true;
    else if ((window.getComputedStyle)&&
	     (styleinfo=window.getComputedStyle(node,null))) {
      if (styleinfo.position!=='static') return false;
      else if ((styleinfo.display==='block')||
	       (styleinfo.display==='list-item'))
	return true;
      else return false;}
    else if (fdjtDisplayStyle(node)==="inline") return false;
    else return true;
  else return false;
}

function _sbookIsJustContainer(node)
{
  var children=node.childNodes;
  var i=0; var len=children.length;
  while (i<len) {
    var child=children[i++];
    if ((child.nodeType===3)&&
	(!(fdjtIsEmptyString(child.nodeValue))))
      return false;
    else if (child.sbookui) {}
    else if (sbook_block_tags[node.tagName]) {}
    else if ((window.getComputedStyle)&&
	     (styleinfo=window.getComputedStyle(node,null))) {
      if (styleinfo.position!=='static') {}
      else if ((styleinfo.display==='block')||
	       (styleinfo.display==='list-item'))
	{}
      else return false;}
    else {}}
  return true;
}

function _sbookIsContainer(node)
{
  var next=_sbookScanContent(node);
  if (fdjtHasParent(next,node)) return next;
  else return false;
}


function _sbookTracePagination(name,elt,info)
{
  if (elt)
    fdjtLog("[%f] %s '%s' [%d,%d] %d%s%s%s%s%s %o",
	    fdjtET(),name,elt.id,info.top,info.bottom,
	    elt.toclevel||0,
	    ((sbookIsPageHead(elt))?"/ph":""),
	    ((sbookIsPageBlock(elt))?"/pb":""),
	    ((sbookAvoidPageHead(elt))?"/ah":""),
	    ((sbookAvoidPageFoot(elt))?"/af":""),
	    ((fdjtHasText(elt))?"/ht":""),
	    elt);
  else fdjtLog("[%f] %s none",fdjtET(),name);
}

function _sbookPaginationInfo(elt,info,newpage,splitblock)
{
  return ((splitblock)?"s":(newpage)?"h":"p")+(elt.toclevel||0)+
    ((sbookIsPageHead(elt))?"/ph":"")+
    ((sbookIsPageBlock(elt))?"/pb":"")+
    ((sbookAvoidPageHead(elt))?"/ah":"")+
    ((sbookAvoidPageFoot(elt))?"/af":"")+
    ((fdjtHasText(elt))?"/ht":"")+
    " ["+
    info.top+","+info.bottom+"-"+info.height+
    ((info.fontsize)?"/":"")+((info.fontsize)?(info.fontsize):"")+
    +"]"+
    ((newpage)?((newpage!==elt)?("ph="+newpage.id):""):"");
}

function _sbookPageNodeInfo(elt,info,curpage)
{
  return "["+info.top+","+info.bottom+"/"+info.height+"] "+
    (((info.top<=curpage.top)&&(info.bottom>=curpage.limit))?"around":
     ((info.top>curpage.top)&&(info.bottom<curpage.limit))?"inside":
     ((info.top<curpage.top)&&(info.bottom>=curpage.top))?"topedge":
     ((info.top<curpage.limit)&&(info.bottom>=curpage.limit))?"botedge":
     (info.top>=curpage.limit)?"below":
     (info.bottom<=curpage.top)?"above":
     "weird")+
    "/t"+(elt.toclevel||0)+
    ((sbookIsPageHead(elt))?"/ph":"")+
    ((sbookIsPageBlock(elt))?"/pb":"")+
    ((sbookAvoidPageHead(elt))?"/ah":"")+
    ((sbookAvoidPageFoot(elt))?"/af":"")+
    ((fdjtHasText(elt))?"/ht":"");
}

/* Adjusting pages */

/* This adjusts the offset of a page and its successor to avoid widows */

function sbookAdjustPageBreak(node,top,bottom)
{
  var nodeinfo=fdjtGetOffset(node);
  var styleinfo=((window.getComputedStyle)&&
		 (window.getComputedStyle(node,null)));
  var lastbottom=nodeinfo.top;
  var linebottom=lastbottom;
  var children=node.childNodes;
  var len=children.length; 
  var i=0; while (i<len) {
    var child=children[i++];
    if (child.nodeType===1)
      if (child.sbookinui) continue;
      else {
	var offinfo=fdjtGetOffset(child);
	if ((!(offinfo))||(offinfo.height===0)) continue;
	else if (offinfo.bottom<top) continue;
	else if (offinfo.bottom>=bottom)
	  return lastbottom;
	else if (offinfo.top>=lastbottom) { // new line 
	  lastbottom=linebottom;
	  linebottom=offinfo.bottom;}
	else if (offinfo.bottom>linebottom)
	  linebottom=offinfo.bottom;
	else {}}
    else if (child.nodeType===3) {
      // Make the text into a span
      var chunk=fdjtSpan(false,child.nodeValue);
      node.replaceChild(chunk,child);
      var offinfo=fdjtGetOffset(chunk);
      if ((!(offinfo))||(offinfo.height===0)) {
	node.replaceChild(child,chunk);
	continue;}
      else if (offinfo.bottom<top) {
	node.replaceChild(child,chunk);
	continue;}
      else if (offinfo.top>=bottom) {
	// if it's over the bottom, put it back
	// and use the last bottom
	node.replaceChild(child,chunk);
	return lastbottom;}
      else if (offinfo.bottom<bottom) {
	// if it's above the bottom, put it back and keep going
	node.replaceChild(child,chunk);
	if (offinfo.top>=lastbottom) { // new line 
	  lastbottom=linebottom;
	  linebottom=offinfo.bottom;}
	else if (offinfo.bottom>linebottom)
	  linebottom=offinfo.bottom;
	else {}}
      else {
	// It's stradding the bottom, so we go finer
	var split=sbookSplitNode(child);
	node.replaceChild(split,chunk);
	var words=split.childNodes;
	var j=0; var nwords=words.length;
	while (j<nwords) {
	  var word=words[j++];
	  if (word.nodeType!==1) continue;
	  var wordoff=fdjtGetOffset(word);
	  if (wordoff.bottom<top) continue;
	  else if (wordoff.bottom>=bottom) {
	    // As soon as we're over the bottom, we return the last bottom
	    node.replaceChild(child,split);
	    return lastbottom;}
	  else if (wordoff.top>=lastbottom) { // new line
	    lastbottom=linebottom;
	    linebottom=wordoff.bottom;}
	  else if (wordoff.bottom>linebottom)
	    linebottom=wordoff.bottom;
	  else {}}
	node.replaceChild(child,split);
	return lastbottom;}}
    else {}}
  return lastbottom;
}

function sbookSplitNode(textnode)
{
  var text=textnode.nodeValue;
  var words=text.split(/\b/);
  var span=fdjtSpan("sbookpageprobe");
  var i=0; var len=words.length;
  while (i<len) {
    var word=words[i++];
    var textnode=document.createTextNode(word);
    if (word.search(/\S/)>=0) {
      var wordspan=document.createElement("span");
      wordspan.appendChild(textnode);
      span.appendChild(wordspan);}
    else span.appendChild(textnode);}
  return span;
}

/* Framing a page */

function sbookGoToPage(pagenum,pageoff)
{
  if ((typeof pagenum !== 'number')||
      (pagenum<0)||(pagenum>=sbook_pages.length)) {
    fdjtWarn("[%f] Invalid page number %o",pagenum);
    return;}
  if (sbook_trace_paging)
    fdjtLog("[%f] sbookGoToPage %o+%o",fdjtET(),pagenum,pageoff);
  var off=sbook_pages[pagenum]+(pageoff||0);
  var info=sbook_pageinfo[pagenum];
  if (sbook_trace_paging)
    if (sbook_curpage>=0)
      fdjtLog("[%f] Jumped to P%d@%d=%d+%d P%d@[%d,%d]#%s+%d (%o) from P%d@[%d,%d]#%s (%o)",
	      fdjtET(),pagenum,off,sbook_pages[pagenum],pageoff,
	      pagenum,info.top,info.bottom,info.first.id,pageoff||0,info,
	      sbook_curpage,sbook_curinfo.top,sbook_curinfo.bottom,
	      sbook_curinfo.first.id,sbook_curinfo);
    else ("[%f] Jumped to %d P%d@[%d,%d]#%s+%d (%o)",
	  fdjtET(),off,
	  pagenum,info.top,info.bottom,info.first.id,pageoff||0,info);
  var footheight=((off-sbook_top_px)+window.innerHeight)-info.bottom;
  if (sbook_floating_hud) {
    $("SBOOKTOPMARGIN").style.height=off+'px';
    $("SBOOKBOTTOMMARGIN").style.height=
      (document.body.offsetHeight-info.bottom)+'px';}
  else if (footheight<0) {
    $("SBOOKBOTTOMMARGIN").style.height=0;
    sbook_curbottom=sbook_bottom_px;}
  else {
    $("SBOOKBOTTOMMARGIN").style.height=footheight+'px';
    sbook_curbottom=footheight;}
  sbook_curpage=pagenum;
  sbook_curoff=pageoff||0;
  sbook_curinfo=info;
  window.scrollTo(0,(off-sbook_top_px));
  if ((sbook_focus)&&(!(fdjtIsVisible(sbook_focus))))
    sbookSetFocus(sbook_target||info.focus||info.first);
  sbook_pagescroll=window.scrollY;
  document.body.style.opacity=1.0;
  if (sbook_floating_hud) sbookSyncHUD();
  // Add class if it's temporarily gone
  fdjtAddClass(document.body,"sbookpageview");
}

function sbookGetPage(arg)
{
  var top;
  if (typeof arg === "number") top=arg;
  else if (!($(arg))) return 0;
  else top=fdjtGetOffset($(arg)).top;
  var i=1; var len=sbook_pages.length;
  while (i<len) 
    if (sbook_pages[i]>top) return i-1;
    else i++;
  return i-1;
}

function sbookSyncPage()
{
  if (sbook_pageview) {
    if (window.scrollY!==sbook_pages[sbook_curpage]) {
      window.scrollTo(sbook_pages[sbook_curpage]);
      if (sbook_floating_hud) sbookSyncHUD();}}
}

/* Other stuff */

function sbookForward()
{
  if (sbook_pageview) {
    var goto=-1;
    if ((sbook_curpage<0)||(sbook_curpage>=sbook_pages.length)) {
      var pagenum=sbookGetPage(window.scrollY);
      if (pagenum<(sbook_pages.length-1)) sbook_curpage=pagenum+1;
      sbookGoToPage(sbook_curpage);}
    else {
      // Synchronize if neccessary
      if (sbook_pagescroll!==window.scrollY)
	sbookGoToPage(sbook_curpage,sbook_curoff);
      var info=sbook_pageinfo[sbook_curpage];
      var pagebottom=window.scrollY+window.innerHeight;
      if (pagebottom<info.bottom)
	sbookGoToPage(sbook_curpage,pagebottom-info.top);
      else if (sbook_curpage===sbook_pages.length) {}
      else {
	sbook_curpage++;
	sbookGoToPage(sbook_curpage);
	if (sbook_curinfo.focus) sbookSetHashID(sbook_curinfo.focus);}}}
  else window.scrollBy(0,sbook_pagesize);
}

function sbookBackward()
{
  if (sbook_pageview) {
    var goto=-1;
    if ((sbook_curpage<0)||(sbook_curpage>=sbook_pages.length)) {
      var pagenum=sbookGetPage(window.scrollY);
      if (pagenum<(sbook_pages.length-1)) sbook_curpage=pagenum+1;
      sbookGoToPage(sbook_curpage);}
    else {
      // Synchronize if neccessary
      if (sbook_pagescroll!==window.scrollY)
	sbookGoToPage(sbook_curpage,sbook_curoff);
      var info=sbook_pageinfo[sbook_curpage];
      var pagetop=window.scrollY+sbook_top_px;
      if (pagetop>info.top)
	sbookGoToPage(sbook_curpage,(info.top-pagetop)-sbook_pagesize);
      else if (sbook_curpage===0) {}
      else {
	sbook_curpage--;
	sbookGoToPage(sbook_curpage);
	if (sbook_curinfo.focus) sbookSetHashID(sbook_curinfo.focus);}}}
  else window.scrollBy(0,-sbook_pagesize);
}


/* Tracing pagination */

function sbookTracePaging(name,elt)
{
  if (!(elt)) {
    fdjtLog("[%f] %s none",fdjtET(),name);
    return;}
  var top=window.scrollY+sbook_top_px;
  var bottom=window.scrollY+(window.innerHeight-sbook_bottom_px);
  var offsets=fdjtGetOffset(elt);
  fdjtLog("[%f] %s [%d+%d=%d] %s [%d,%d] %o%s%s%s%s '%s'\n%o",
	  fdjtET(),name,offsets.top,offsets.height,offsets.top+offsets.height,
	  sbookPagePlacement(offsets,top,bottom),top,bottom,
	  elt.toclevel||0,
	  (sbookIsPageHead(elt)?"/ph":""),
	  (sbookIsPageBlock(elt)?"/pb":""),
	  (sbookAvoidPageHead(elt)?"/ah":""),
	  (sbookAvoidPageFoot(elt)?"/af":""),
	  elt.id,elt);
}

function sbookPagePlacement(offsets,top,bottom)
{
  if (offsets.top>bottom) return "below";
  else if (offsets.bottom<top) return "above";
  else if (offsets.top<top) return "athead";
  else if ((offsets.top+offsets.height)<bottom) return "inside";
  else return "atfoot";
}

/* Getting the 'next' node */

function sbookNext(elt)
{
  var info=sbook_getinfo(elt);
  if ((info.sub) && (info.sub.length>0))
    return info.sub[0];
  else if (info.next) return info.next;
  else return sbookNextUp(elt);
}

function sbookNextUp(elt)
{
  var info=sbook_getinfo(elt).sbook_head;
  while (info) {
    if (info.next) return info.next;
    info=info.sbook_head;}
  return false;
}

function sbookPrev(elt)
{
  var info=sbook_getinfo(elt);
  if (!(info)) return false;
  else if (info.prev) {
    info=info.prev;
    if ((info.sub) && (info.sub.length>0))
      return info.sub[info.sub.length-1];
    else return document.getElementById(info.id);}
  else if (info.sbook_head)
    return document.getElementById(info.sbook_head.id);
  else return false;
}

function sbookUp(elt)
{
  var info=sbook_getinfo(elt);
  if ((info) && (info.sbook_head))
    return document.getElementById(info.sbook_head.id);
  else return false;
}


/* Section/page navigation */

function sbookNextSection(evt)
{
  var prev=((evt.ctrlKey) ? (sbookUp(sbook_head)) :
	    (sbookPrev(sbook_head)));
  if (prev) sbookGoTo(prev);
}

function sbookPrevSection(evt)
{
    var next=((evt.ctrlKey) ? (sbookNextUp(sbook_head)) :
	      (sbookNext(sbook_head)));
    if (next) sbookGoTo(next);
}

function sbookNextPage(evt)
{
  evt=evt||event||null;
  window.scrollBy(0,window.innerHeight-100);
  setTimeout("sbookTrackFocus(sbookGetXYFocus())",100);
  if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
  evt.cancelBubble=true;
}

function sbookPrevPage(evt)
{
  evt=evt||event||null;
  window.scrollBy(0,-(window.innerHeight-100));
  setTimeout("sbookTrackFocus(sbookGetXYFocus())",100);
  if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
  evt.cancelBubble=true;
}

var advance_timer=false;
var advance_interval=800;

function sbookNextPrev_startit(evt)
{
  evt=evt||event;
  var target=$T(evt);
  if (advance_timer) clearInterval(advance_timer);
  if (target.alt==='>>') sbookForward(); else sbookBackward();
  if (target.alt==='>>')
    advance_timer=setInterval(sbookForward,advance_interval);
  else advance_timer=setInterval(sbookBackward,advance_interval);
}

function sbookNextPrev_stopit(evt)
{
  clearInterval(advance_timer);
}

function sbookPageView(flag,nogo)
{
  if (flag===sbook_pageview)
    sbookCheckPagination();
  else if (flag) {
    sbook_pageview=true;
    fdjtCheckSpan_set($("SBOOKPAGEVIEW"),true,true);
    fdjtAddClass(document.body,"sbookpageview");
    fdjtDropClass(document.body,"sbookscroll");
    sbookFlashMessage(3000,
		      "Now using page view",
		      fdjtSpan("details",
			       "Press ",fdjtSpan("key","P"),
			       " to toggle back to scroll view"));
    sbookCheckPagination();
    if (!(nogo))
      sbookGoToPage(sbookGetPage(sbook_focus||sbook_root));}
  else {
    sbook_pageview=false;
    sbook_nextpage=false; sbook_pagebreak=false;
    fdjtCheckSpan_set($("SBOOKPAGEVIEW"),false,true);
    fdjtAddClass(document.body,"sbookscroll");
    fdjtDropClass(document.body,"sbookpageview");
    sbookFlashMessage(3000,
		      "Now using scroll view",
		      fdjtSpan("details",
			       "Press ",fdjtSpan("key","P"),
			       " to toggle back to page view"));
    if (!(nogo)) {
      var curx=window.scrollX; var cury=window.scrollY;
      window.scrollTo(0,0);
      window.scrollTo(curx,cury);}}
}

/* Setting up the page layout */

function sbookMakeMargin(spec)
{
  var div=fdjtDiv(spec);
  div.onmouseover=fdjtCancelEvent;
  div.onmouseout=fdjtCancelEvent;
  div.onmousedown=fdjtCancelEvent;
  div.onmouseup=fdjtCancelEvent;
  div.onclick=sbookDropHUD;
  return div;
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

function sbookPageSetup()
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
  fdjtPrepend(document.body,topleading,pagehead,pagefoot,leftedge,rightedge);  
  fdjtAppend(document.body,bottomleading);
  fdjtAppend(document.body,createSBOOKHUD());
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

function sbookPageHead_onclick(evt)
{
  evt=evt||event;
  if ((evt.clientX)>($("SBOOKRIGHTMARGIN").offsetLeft))
    return sbookRightEdge_onclick(evt);
  else if ((evt.clientX)<($("SBOOKLEFTMARGIN").offsetWidth))
    return sbookLeftEdge_onclick(evt);
  else if (sbook_mode) sbookHUDMode(false);
  else sbookHUDMode(sbook_last_app);
}

function sbookPageFoot_onclick(evt)
{
  evt=evt||event;
  if ((evt.clientX)>($("SBOOKRIGHTMARGIN").offsetLeft))
    return sbookRightEdge_onclick(evt);
  else if ((evt.clientX)<($("SBOOKLEFTMARGIN").offsetWidth))
    return sbookLeftEdge_onclick(evt);
  else if (sbook_mode) sbookHUDMode(false);
  else sbookHUDMode("minimal");
}

/* Pagination utility functions */

function sbookUpdatePagination()
{
  var pagesize=window.innerHeight-
    (sbook_top_px+sbook_bottom_px);
  var focus=sbook_focus;
  /*
  var elts=$$(sbook_fullpages);
  var i=0; var len=elts.length;
  while (i<len) {
    var elt=elts[i++];
    elt.style.height=pagesize+'px';
    elt.style.width=window.innerWidth-100;}
  */
  sbookMessage("Determining page layout");
  var pagination=sbookPaginate(pagesize);
  $("SBOOKBOTTOMLEADING").style.height=pagesize+'px';
  sbook_pages=pagination.pages;
  sbook_pageinfo=pagination.info;
  sbook_pagesize=pagesize;
  sbookFlashMessage(2000,"Done with page layout");
  if (focus)
    sbookGoToPage(sbookGetPage(focus));
  else sbookGoToPage(sbookGetPage(window.scrollY));
}

function sbookCheckPagination()
{
  if ((sbook_paginated)&&
      (sbook_paginated.offheight===document.body.offsetHeight)&&
      (sbook_paginated.offwidth===document.body.offsetWidth)&&
      (sbook_paginated.winwidth===window.innerWidth)&&
      (sbook_paginated.winheight===window.innerHeight))
    return false;
  else {
    var newinfo={};
    sbookUpdatePagination();
    newinfo.offheight=document.body.offsetHeight;
    newinfo.offwidth=document.body.offsetWidth;
    newinfo.winwidth=window.innerWidth;
    newinfo.winheight=window.innerHeight;
    // fdjtTrace("Updated pagination from %o to %o",sbook_paginated,newinfo);
    sbook_paginated=newinfo;
    return newinfo;}
}

function sbookSetFontSize(size)
{
  if (document.body.style.fontSize!==size) {
    document.body.style.fontSize=size;
    sbookCheckPagination();}
}

function sbookSetHUDFontSize(size)
{
  if (sbookHUD.style.fontSize!==size) sbookHUD.style.fontSize=size;
}

function sbookLeftEdge_onclick(evt)
{
  sbook_trace("sbookLeftEdge_onclick",evt);
  if (sbook_edge_taps) sbookBackward();
  else sbookHUDMode(false);
  fdjtCancelEvent(evt);
}

function sbookRightEdge_onclick(evt)
{
  sbook_trace("sbookRightEdge_onclick",evt);
  if (sbook_edge_taps) sbookForward();
  else sbookHUDMode(false);
  fdjtCancelEvent(evt);
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
