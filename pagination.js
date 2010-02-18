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
var sbook_curbottom=sbook_bottom_margin_px;
var sbook_pagesize=-1;
var sbook_pages=[];
var sbook_pageinfo=[];
var sbook_pagescroll=false;

var sbook_top_margin_px=40;
var sbook_bottom_margin_px=40;

var sbook_debug_pagination=false;
var sbook_trace_pagination=0;
var sbook_trace_paging=false;

/* Pagination predicates */

function sbookIsPageHead(elt)
{
  return ((elt)&&
	  ((fdjtHasClass(elt,"pagehead"))||
	   ((elt.toclevel||0)&&
	    (sbook_tocmajor)&&
	    (elt.toclevel<=sbook_tocmajor))||
	   ((sbook_pageheads)&&(fdjtElementMatches(elt,sbook_pageheads)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt,null).pageBreakBefore==='always'))));
}

function sbookIsPageFoot(elt)
{ 
  return ((elt)&&
	  ((fdjtHasClass(elt,"pagefoot"))||
	   ((sbook_pagefeet)&&(fdjtElementMatches(elt,sbook_pagefeet)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt,null).pageBreakAfter==='always'))));
}

function sbookIsPageBlock(elt)
{
  return ((elt)&&
	  ((fdjtHasClass(elt,"pageblock"))||
	   ((sbook_pageblocks)&&(fdjtElementMatches(elt,sbook_pageblocks)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt,null).pageBreakInside==='avoid'))));
}

function sbookAvoidPageHead(elt)
{
  return ((elt)&&
	  ((fdjtHasClass(elt,"nobreakbefore"))||
	   ((sbook_avoid_pagehead)&&(fdjtElementMatches(elt,sbook_avoid_pagehead)))));
}

function sbookAvoidPageFoot(elt)
{
  return ((elt)&&
	  ((elt.toclevel)||(fdjtHasClass(elt,"nobreakafter"))||
	   ((sbook_avoid_pagefoot)&&(fdjtElementMatches(elt,sbook_avoid_pagefoot)))));
}

/* Pagination loop */

function sbookPaginate(pagesize,start)
{
  if (!(start)) start=sbook_root||document.body;
  var result={}; var pages=[]; var pageinfo=[];
  result.pages=pages; result.info=pageinfo;
  var scan=start; var info=fdjtGetOffset(scan);
  var pagetop=info.top; var pagelim=pagetop+pagesize;
  fdjtLog("[%f] Starting pagination with pagesize=%o at #%s=%o",
	  fdjtET(),pagesize,start.id,start);
  var curpage={}; var newpage=false; var nodecount=1;
  curpage.pagenum=pages.length;
  curpage.top=pagetop;
  curpage.first=start; curpage.last=start;
  pages.push(pagetop); pageinfo.push(curpage);
  scan=_sbookScanPageContent(scan);
  if (scan) info=fdjtGetOffset(scan);
  while (scan) {
    var newinfo=false; var next=false; var nextinfo=false;
    var splitblock=false; var forcebottom=false;
    if (sbook_trace_pagination>1) _sbookTracePagination("SCAN",scan,info);
    if (sbookIsPageHead(scan)) newpage=scan;
    else if (info.top>pagelim) newpage=scan;
    else if (info.bottom<pagelim)
      if (sbookAvoidPageHead(scan)) {}
      else if (next=_sbookScanPageContent(scan)) {
	nextinfo=fdjtGetOffset(next);
	if ((nextinfo.bottom>pagelim)&&(sbookAvoidPageHead(next)))
	  if ((pagelim-info.top)<pagesize/4) newpage=scan;
	  else {
	    newpage=splitblock=scan;
	    curpage.bottom=info.bottom-pagesize/5;}
	else if ((nextinfo.bottom>(pagelim-sbook_bottom_margin_px))&&
		 ((scan.toclevel)||(sbookAvoidPageFoot(scan))))
	  newpage=scan;
	else {
	  curpage.bottom=info.bottom; curpage.last=scan;}}
      else {}
    else if (sbookIsPageBlock(scan)) newpage=scan;
    else if ((pagelim-info.top)<sbook_bottom_margin_px) newpage=scan;
    else if ((info.bottom-pagelim)<(sbook_bottom_margin_px/2)) {
      curpage=info.bottom;}
    else if (fdjtHasText(scan)) {
      newpage=splitblock=scan;
      curpage.bottom=pagelim;}
    else {}
    if ((newpage)&&(!(newinfo))) newinfo=info;
    if (sbook_debug_pagination) 
      scan.setAttribute
	("sbpageinfo",
	 _sbookPaginationInfo(scan,info,newpage,splitblock));
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
      scan=newpage;
      newpage=false;}
    else {
      if (info.bottom<=pagelim) curpage.bottom=info.bottom;
      curpage.last=scan;}
    if (next) {scan=next; info=nextinfo;}
    else {
      scan=_sbookScanPageContent(scan);
      if (scan) info=fdjtGetOffset(scan);}
    nodecount++;}
  fdjtLog("[%f] Finished paginating %d nodes into %d pages",
	  fdjtET(),nodecount,pages.length);
  return result;
}

var sbook_content_nodes=['IMG','BR','HR'];

function _sbookScanPageContent(scan)
{
  var next=fdjtForwardNode(scan,_sbookIsContentBlock);
  if (!(next)) {}
  else if ((sbookIsPageHead(next))||(sbookIsPageBlock(next))) {}
  else if ((next.childNodes)&&(next.childNodes.length>0)) {
    var children=next.childNodes;
    if (children[0].nodeType===1) next=children[0];
    else if ((children[0].nodeType===3)&&
	     (fdjtIsEmptyString(children[0].nodeValue))&&
	     (children.length>1)&&(children[1].nodeType===1))
      next=children[1];}
  if ((next)&&(sbook_debug_pagination)) {
    if (next.id) scan.setAttribute("sbookpagenext",next.id);
    if (scan.id) next.setAttribute("sbookpageprev",scan.id);}
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
    " ["+info.top+","+info.bottom+"]"+
    ((newpage)?((newpage!==elt)?("ph="+newpage.id):""):"");
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
  window.scrollTo(0,(off-sbook_top_margin_px));
  var footheight=(window.scrollY+window.innerHeight)-info.bottom;
  if (footheight<0) {
    $("SBOOKBOTTOMMARGIN").style.height=null;
    sbook_curbottom=sbook_bottom_margin_px;}
  else {
    $("SBOOKBOTTOMMARGIN").style.height=footheight+'px';
    sbook_curbottom=footheight;}
  sbook_curpage=pagenum;
  sbook_curoff=pageoff||0;
  sbook_curinfo=info;
  sbookSetFocus(info.first);
  sbook_pagescroll=window.scrollY+sbook_top_margin_px;
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
      var pagebottom=window.scrollY+window.innerHeight-sbook_curbottom;
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
      var pagetop=window.scrollY+sbook_top_margin_px;
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
  var top=window.scrollY+sbook_top_margin_px;
  var bottom=window.scrollY+(window.innerHeight-sbook_bottom_margin_px);
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
  sbook_top_margin_px=pagehead.offsetHeight+8;
  sbook_bottom_margin_px=pagefoot.offsetHeight+8;
  pagehead.style.display=null; pagefoot.style.display=null;
  pagehead.sbookui=true; pagehead.sbookui=true;
}

function sbookUpdatePagination()
{
  var pagesize=window.innerHeight-
    (sbook_top_margin_px+sbook_bottom_margin_px);
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
