/* -*- Mode: Javascript; -*- */

var sbooks_pagination_id="$Id$";
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
var sbook_pagescroll=false;

var sbook_top_px=40;
var sbook_bottom_px=40;
var sbook_widow_limit=3;
var sbook_orphan_limit=3;

var sbook_debug_pagination=true;
var sbook_trace_pagination=0;
var sbook_trace_paging=false;

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
  if (!(start)) start=_sbookScanPageContent(sbook_root||document.body);
  var result={}; var pages=[]; var pageinfo=[];
  result.pages=pages; result.info=pageinfo;
  var scan=start; var info=sbookNodeInfo(scan);
  var pagetop=info.top; var pagelim=pagetop+pagesize;
  var fudge=sbook_bottom_px/4;
  var start=fdjtET();
  var curpage={}; var newpage=false; var nodecount=1;
  curpage.pagenum=pages.length;
  curpage.top=pagetop;
  curpage.first=start; curpage.last=start;
  pages.push(pagetop); pageinfo.push(curpage);
  while (scan) {
    var newinfo=false; var next=false; var nextinfo=false;
    var splitblock=false; var forcebottom=false;
    var widowthresh=((info.fontsize)*sbook_widow_limit);
    var orphanthresh=((info.fontsize)*sbook_orphan_limit);
    var skipchildren=false;
    var dbginfo=((sbook_debug_pagination)&&
		 ("P#"+curpage.pagenum+
		  "["+pagetop+","+pagelim+
		  "/"+pagesize+"/"+widowthresh+","+orphanthresh+"] "));
    if (dbginfo) dbginfo=dbginfo+(_sbookPageNodeInfo(scan,info));
    if (sbook_trace_pagination>1) _sbookTracePagination("SCAN",scan,info);
    if ((sbookIsPageHead(scan))&&(info.top>pagetop))
      newpage=scan;
    else if (info.top>pagelim)
      // Yuck, we're completely off the page
      if (((sbookAvoidPageHead(scan))||(sbookIsPageFoot(scan)))&&
	  (info.bottom<pagelim+sbook_bottom_px))
	// If there's space, stay on this page, otherwise, tough
	if (info.bottom<(pagelim-sbook_bottom_px)) {}
	else newpage=scan;
      else newpage=scan;
    else if (info.bottom>pagelim)
      /* We're straddling the bottom of the page */
      if (sbookIsPageBlock(scan))
	if (curpage.top<info.top) newpage=scan;
	else {
	  // Big block, we'll keep it all on this page
	  skipchildren=true;
	  curpage.bottom=info.bottom;
	  curpage.oversize=true;
	  curpage.last=scan;}
      else if ((scan.toclevel)||(sbookAvoidPageFoot(scan)))
	newpage=scan;
      else if (((sbookAvoidPageHead(scan))||(sbookIsPageFoot(scan))))
	if (info.bottom<pagelim+sbook_bottom_px)
	  // If we can, keep it on this page
	  curpage.bottom=pagelim=info.bottom;
	else curpage.bottom=pagelim;
      else if (!(fdjtHasText(scan))) {}
      else if ((pagelim-info.top)<widowthresh)
	newpage=scan;
      else if ((info.bottom-pagelim)<orphanthresh) {
	newpage=splitblock=scan;
	curpage.bottom=pagelim=info.bottom-orphanthresh;}
      else {
	newpage=splitblock=scan;
	curpage.bottom=pagelim=pagelim;}
    // We're completely on the page
    else if (sbookAvoidPageHead(scan)) {}
    else if (sbookIsPageFoot(scan)) {
      curpage.bottom=scan.bottom;
      newpage=_sbookScanPageContent(scan);}
    else if (((scan.toclevel)||(sbookAvoidPageFoot(scan)))&&
	     ((pagelim-info.top)<(pagesize/3)))
      // Bad feet close to the bottom get pushed right away
      newpage=scan;
    else if (next=_sbookScanPageContent(scan)) {
      // Look ahead to see if we should page break anyway
      nextinfo=sbookNodeInfo(next);
      if (dbginfo)
	dbginfo=dbginfo+" ... N"+_sbookPageNodeInfo(next,nextinfo);
      if ((nextinfo.top<pagelim)&&(nextinfo.bottom>pagelim)&&
	  (sbookIsPageBlock(next))&&(sbookAvoidPageFoot(scan)))
	// If the current node is a bad foot and the next node is
	// straddling but needs to keep together, break now
	newpage=scan;
      else if (((next.toclevel)||(sbookAvoidPageFoot(next)))&&
	       ((scan.toclevel)||(sbookAvoidPageFoot(scan)))&&
	       ((pagelim-info.top)<pagesize/2))
	// Double heads/non feet cause a page break when they're more
	// than halfway down
	newpage=scan;
      else if ((nextinfo.bottom>(pagelim+fudge))&&
	       ((pagelim-nextinfo.top)<sbook_bottom_px)&&
	       (sbookAvoidPageHead(next)))
	// If the next node is a bad straddle head and starts close to
	// the bottom, break now
	newpage=scan;
      else {}}
    if (!(newpage)) {
      curpage.bottom=info.bottom;
      curpage.last=scan;}
    if ((newpage)&&(dbginfo))
      dbginfo=dbginfo+" np"+
	((splitblock)?"/split":"")+
	"/"+curpage.bottom;
    if ((newpage)&&(!(newinfo))) newinfo=info;
    if (dbginfo) scan.setAttribute("sbookpagedbg",dbginfo);
    if (newpage) {
      if (splitblock) {
	curpage.last=splitblock;
	curpage.bottomedge=splitblock;}
      else if (!(curpage.bottom)) curpage.bottom=newinfo.top;
      else if (newinfo.top<curpage.bottom) curpage.bottom=newinfo.top;
      if (sbook_trace_pagination) 
	fdjtLog("[%f] New %spage break P%d[%d,%d]#%s %o, closed P%d[%d,%d] %o",
		fdjtET(),((splitblock)?("split "):("")),
		pages.length,newinfo.top,newinfo.bottom,newpage.id,newpage,
		curpage.pagenum,curpage.top,curpage.bottom,curpage);
      curpage={}; curpage.pagenum=pages.length;
      if (splitblock)
	curpage.top=pageinfo[curpage.pagenum-1].bottom;
      else curpage.top=newinfo.top;
      if (newinfo.height>pagesize) curpage.oversize=true;
      curpage.first=newpage; curpage.last=newpage;
      if (splitblock) curpage.topedge=splitblock;
      pagetop=curpage.top; pagelim=pagetop+pagesize;
      pages.push(pagetop); pageinfo.push(curpage);
      scan=newpage; splitblock=false; newpage=false;}
    else {
      if (info.bottom<=pagelim) curpage.bottom=info.bottom;
      curpage.last=scan;}
    if (!(curpage.focus))
      if (fdjtElementMatches(scan,sbook_focus_rules)) curpage.focus=scan;
    if (next) {scan=next; info=nextinfo;}
    else {
      scan=_sbookScanPageContent(scan,skipchildren);
      if (scan) info=sbookNodeInfo(scan);}
    nodecount++;}
  var done1=fdjtET();
  var i=0; var len=pages.length;
  while (i<len) sbookAdjustPage(pages,pageinfo,i++);
  var done2=fdjtET();
  fdjtLog("[%f] Paginated %d nodes into %d pages with pagesize=%d in %s=%s+%s",
	  fdjtET(),nodecount,pages.length,pagesize,
	  fdjtShortIntervalString(done2-start),
	  fdjtShortIntervalString(done1-start),
	  fdjtShortIntervalString(done2-done1));
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

function _sbookScanPageContent(scan,skipchildren)
{
  var next=((skipchildren)?
	    (fdjtNextNode(scan,_sbookIsContentBlock)):
	    (fdjtForwardNode(scan,_sbookIsContentBlock)));
  if (!(next)) {}
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

function _sbookIsContentBlock(node)
{
  if (node.nodeType===1)
    if (node.sbookui) return false;
    else if ((node.tagName==='IMG')||(node.tagName==='HR')) return true;
    else if (fdjtDisplayStyle(node)==="inline") return false;
    else return true;
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

function _sbookPageNodeInfo(elt,info)
{
  return "["+info.top+","+info.bottom+"/"+info.height+"] t"+
    (elt.toclevel||0)+
    ((sbookIsPageHead(elt))?"/ph":"")+
    ((sbookIsPageBlock(elt))?"/pb":"")+
    ((sbookAvoidPageHead(elt))?"/ah":"")+
    ((sbookAvoidPageFoot(elt))?"/af":"")+
    ((fdjtHasText(elt))?"/ht":"");
}

/* Adjusting pages */

/* This adjusts the offset of a page and its successor to avoid widows */

function sbookAdjustPage(pages,pageinfo,num)
{
  var info=pageinfo[num];
  // Not neccessary
  if (!(info.bottomedge)) {
    // fdjtTrace("No problem with page #%d",num);
    return;}
  var nextinfo=pageinfo[num+1];
  var edge=info.bottom;
  if (sbook_trace_pagination)
    fdjtTrace("Adjusting page #%d relative to %d",num,edge);
  if (edge!==nextinfo.top) {
    fdjtWarn("Weird page %o",info);
    return;}
  var newedge=false; var lastbottom=0;
  var node=info.bottomedge;
  var nodeinfo=fdjtGetOffset(node);
  if (nodeinfo.bottom<(edge+(sbook_bottom_px/3))) {
    newedge=nodeinfo.bottom;}
  else {
    var children=node.childNodes;
    var len=children.length;
    var i=0; while (i<len) {
      var child=children[i];
      if (child.nodeType===1) {
	var offinfo=fdjtGetOffset(child);
	if (offinfo.bottom>lastbottom) lastbottom=offinfo.bottom;
	if ((offinfo.top<edge)&&(offinfo.bottom>=edge)) {
	  newedge=offinfo.top; break;}
	else i++;}
      else if (child.nodeType===3) {
	var chunk=fdjtSpan(false,child.nodeValue);
	node.replaceChild(chunk,child);
	// fdjtTrace("Placed chunk");
	var offinfo=fdjtGetOffset(chunk);
	if ((offinfo.top>=edge)&&(lastbottom)) {
	  newedge=lastbottom; break;}
	else if ((offinfo.top<edge)&&(offinfo.bottom>=edge)) {
	  var split=sbookSplitNode(child);
	  node.replaceChild(split,chunk);
	  // fdjtTrace("Placed split");
	  var words=split.childNodes;
	  var j=words.length-1;
	  while (j>=0) {
	    var word=words[j--];
	    if (word.nodeType!==1) continue;
	    var wordoff=fdjtGetOffset(word);
	    if (wordoff.bottom<edge) {
	      if (!(newedge)) newedge=wordoff.bottom;
	      break;}
	    else if (wordoff.top<edge) {
	      if (newedge)
		if (wordoff.top<newedge) newedge=wordoff.top;
		else {}
	      else newedge=wordoff.top;}}
	  // Remove this line if you want to debug the adjustment
	  //  It keeps the temporary spans in place for DOM inspection
	  node.replaceChild(child,split);
	  if (newedge) break;
	  else i++;}
	else {
	  node.replaceChild(child,chunk);
	  i++;}}
      else i++;}}
  if (newedge) {
    if (sbook_trace_pagination)
      fdjtTrace("Moving bottom for page #%d from %d to %o",
		num,info.bottom,newedge+2);
    info.bottom=newedge+2; nextinfo.top=newedge+2;
    pages[num+1]=nextinfo.top;
    return true;}
  else return false;
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
  var off=sbook_pages[pagenum]+(pageoff||0);
  var info=sbook_pageinfo[pagenum];
  if (sbook_trace_paging)
    if (sbook_curpage>=0)
      fdjtLog("[%f] Jumped to P%d@%d=%d+%d P%d@[%d,%d]#%s+%d (%o) from P%d@[%d,%d]#%s (%o)",
	      fdjtET(),pagenum,off,sbook_pages[pagenum],pageoff,
	      pagenum,info.top,info.bottom,info.first.id,pageoff||0,info,
	      sbook_curpage,sbook_pages[sbook_curpage],
	      sbook_curinfo.top,sbook_curinfo.bottom,
	      sbook_curinfo.first.id,sbook_curinfo);
    else ("[%f] Jumped to %d P%d@[%d,%d]#%s+%d (%o)",
	  fdjtET(),off,
	  pagenum,info.top,info.bottom,info.first.id,pageoff||0,info);
  window.scrollTo(0,(off-sbook_top_px));
  var footheight=(window.scrollY+window.innerHeight)-info.bottom;
  if (footheight<0) {
    $("SBOOKBOTTOMMARGIN").style.height=0;
    sbook_curbottom=sbook_bottom_px;}
  else {
    $("SBOOKBOTTOMMARGIN").style.height=footheight+'px';
    sbook_curbottom=footheight;}
  sbook_curpage=pagenum;
  sbook_curoff=pageoff||0;
  sbook_curinfo=info;
  if ((sbook_focus)&&(!(fdjtIsVisible(sbook_focus))))
    sbookSetFocus(info.focus||info.first);
  sbook_pagescroll=window.scrollY+sbook_top_px;
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
  return 0;
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
	sbook_curpage++; sbookGoToPage(sbook_curpage);}}}
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
	sbook_curpage--; sbookGoToPage(sbook_curpage);}}}
  else window.scrollBy(0,sbook_pagesize);
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

function sbookPageView(flag)
{
  if (flag) {
    sbook_pageview=true;
    $("SBOOKPAGEVIEW").checked=true;
    fdjtSetCookie("sbookpageview","yes",false,"/");
    fdjtAddClass(document.body,"sbookpageview");
    fdjtDropClass(document.body,"sbookscroll");
    sbookGoToPage(sbookGetPage(sbook_focus||sbook_root));}
  else {
    sbook_pageview=false;
    sbook_nextpage=false; sbook_pagebreak=false;
    $("SBOOKPAGEVIEW").checked=false;
    fdjtAddClass(document.body,"sbookscroll");
    fdjtDropClass(document.body,"sbookpageview");
    fdjtSetCookie("sbookpageview","no",false,"/");}
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

function sbookPageSetup()
{
  var pagehead=sbookMakeMargin(".sbookmargin#SBOOKTOPMARGIN"," ");
  var pagefoot=sbookMakeMargin(".sbookmargin#SBOOKBOTTOMMARGIN"," ");
  var topleading=fdjtDiv("#SBOOKTOPLEADING.leading.top"," ");
  var bottomleading=fdjtDiv("#SBOOKBOTTOMLEADING.leading.bottom"," ");
  topleading.sbookui=true; bottomleading.sbookui=true;
  fdjtPrepend(document.body,pagehead,pagefoot);
  fdjtPrepend(document.body,topleading);  
  fdjtAppend(document.body,bottomleading);
  var bgcolor=document.body.style.backgroundColor;
  if ((!(bgcolor)) && (window.getComputedStyle)) {
    var bodystyle=window.getComputedStyle(document.body,null);
    var bgcolor=((bodystyle)&&(bodystyle.backgroundColor));
    if ((bgcolor==='transparent')||(bgcolor.search('rgba')>=0))
      bgcolor=false;}
  if (bgcolor) {
    pagehead.style.backgroundColor=bgcolor;
    pagefoot.style.backgroundColor=bgcolor;}
  pagehead.style.display='block'; pagefoot.style.display='block';
  sbook_top_px=pagehead.offsetHeight;
  sbook_bottom_px=pagefoot.offsetHeight;
  pagehead.style.display=null; pagefoot.style.display=null;
  pagehead.sbookui=true; pagefoot.sbookui=true;
}

function sbookUpdatePagination()
{
  var pagesize=window.innerHeight-
    (sbook_top_px+sbook_bottom_px);
  var focus=sbook_focus;
  var pagination=sbookPaginate(pagesize);
  $("SBOOKBOTTOMLEADING").style.height=pagesize+'px';
  sbook_pages=pagination.pages;
  sbook_pageinfo=pagination.info;
  sbook_pagesize=pagesize;
  if (focus)
    sbookGoToPage(sbookGetPage(focus));
  else sbookGoToPage(sbookGetPage(window.scrollY));
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
