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

var sbook_pagenum=-1;
var sbook_pagesize=-1;
var sbook_pages=[];
var sbook_pageinfo=[];

var sbook_top_margin_px=40;
var sbook_bottom_margin_px=40;

var sbook_trace_pagination=false;
var sbook_trace_framepage=false;


/* Pagination predicates */

function sbookIsPageHead(elt)
{
  return ((elt)&&
	  ((fdjtHasClass(elt,"pagehead"))||
	   ((elt.toclevel)&&(sbook_tocmajor)&&(elt.toclevel<=sbook_tocmajor))||
	   ((sbook_pageheads)&&(fdjtElementMatches(elt,sbook_pageheads)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt).pageBreakBefore==='always'))));
}

function sbookIsPageFoot(elt)
{
  return ((elt)&&
	  ((fdjtHasClass(elt,"pagefoot"))||
	   ((sbook_pagefeet)&&(fdjtElementMatches(elt,sbook_pagefeet)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt).pageBreakAfter==='always'))));
}

function sbookIsPageBlock(elt)
{
  return ((elt)&&
	  ((fdjtHasClass(elt,"pageblock"))||
	   ((sbook_pageblocks)&&(fdjtElementMatches(elt,sbook_pageblocks)))||
	   ((window.getComputedStyle)&&
	    (window.getComputedStyle(elt).pageBreakInside==='avoid'))));
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

function _sbook_paginate(pagesize,pages,info,start)
{
  if (!(start)) start=sbook_root||document.body;
  var startinfo=fdjtGetOffset(start); var pageinfo={};
  var pagetop=startinfo.top; var pagelim=pagetop+pagesize;
  pageinfo.top=pagetop; pageinfo.first=start;
  pages.push(pagetop); info.push(pageinfo);
  var prev=start; var prevoff=startinfo;
  var scan=fdjtForwardNode(prev); var off=((scan)&&(fdjtGetOffset(scan)));
  var next=((scan)&&(fdjtForwardNode(scan)));
  var nextoff=((next)&&(fdjtGetOffset(next)));
  while (scan) {
    var pagehead=false; var overlap=false;
    if ((off.top-pagetop)<10) {}
    else if (sbookIsPageHead(scan)) pagehead=scan;
    else if ((sbookIsPageBlock(scan))&&((off.bottom)>pagelim))
      if (sbookAvoidPageHead(scan)) pagehead=prev;
      else pagehead=scan;
    else if ((off.top<pagelim)&&(off.bottom>pagelim))
      if (sbookAvoidPageFoot(scan)) pagehead=prev;
      else if ((pagelim-off.top)<sbook_bottom_margin_px) pagehead=scan;
      else pagehead=scan;
    else if ((off.top<pagelim)&&(off.bottom<pagelim)&&(next.top>pagelim)&&
	     ((sbookAvoidPageFoot(scan))||(sbookAvoidPageHead(next)))) {
      pagehead=scan; overlap=scan;}
    else {}
    if (pagehead) {
      pageinfo.bottom=off.top; pageinfo.overlap=overlap;
      if (off.top>pagelim) pageinfo.oversize=true;
      pageinfo={}; pageinfo.top=off.top; pageinfo.first=pagehead;
      pages.push(off.top); info.push(pageinfo);
      pagetop=pageinfo.top; pagelim=pagetop+pagesize;}
    prev=scan; prevoff=off;
    scan=next; off=nextoff;
    next=fdjtForwardNode(scan,_sbookIsContentBlock);
    nextoff=fdjtGetOffset(next);}
  pageinfo.bottom=prev.bottom;
}

function _sbookIsContentBlock(node)
{
  if (node.nodeType===1)
    if (node.sbookui) return false;
    else if (!(fdjtIsBlockElt(node))) return false;
    else if (node.childNodes) {
      var children=node.childNodes;
      var i=0; var len=children.length;
      while (i<len) {
	var child=children[i++];
	if (child.nodeType===1)
	  if (node.offsetX) return false;
	  else return true;
	else if (child.nodeType===3)
	  if (fdjtIsEmptyString(child.nodeValue)) continue;
	  else return true;
	else continue;}
      return false;}
    else return true;
  else return false;
}

/* Framing a page */

function sbookGoToPage(pagenum)
{
  var off=sbook_pages[pagenum];
  var info=sbook_pageinfo[pagenum];
  window.scrollTo(0,off-sbook_top_margin_px);
  var height=(window.scrollY+window.innerHeight)-info.bottom;
  if (info.oversize)
    $("SBOOKBOTTOMMARGIN").style.height=null;
  else $("SBOOKBOTTOMMARGIN").style.height=height+'px';
  sbook_pagenum=pagenum;
  sbookSetFocus(info.first);
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
    if ((sbook_pagenum<0)||(sbook_pagenum>=sbook_pages.length)) {
      var pagenum=sbookGetPage(window.scrollY);
      if (pagenum<(sbook_pages.length-1)) sbook_pagenum=pagenum+1;
      sbookGoToPage(sbook_pagenum);}
    else {
      var info=sbook_pageinfo[sbook_pagenum];
      var pagebottom=window.scrollY+sbook_pagesize+sbook_top_margin_px;
      if ((info.oversize)&&(pagebottom<=info.bottom))
	window.scrollBy(0,sbook_pagesize);
      else if (sbook_pagenum===sbook_pages.length) {}
      else {
	sbook_pagenum++; sbookGoToPage(sbook_pagenum);}}}
  else window.scrollBy(0,sbook_pagesize);
}

function sbookBackward()
{
  if (sbook_pageview) {
    var goto=-1;
    if ((sbook_pagenum<0)||(sbook_pagenum>=sbook_pages.length)) {
      var pagenum=sbookGetPage
	(window.scrollY+sbook_pagesize+sbook_top_margin_px);
      if (pagenum>=1) sbook_pagenum=pagenum-1;
      sbookGoToPage(sbook_pagenum);}
    else {
      var info=sbook_pageinfo[sbook_pagenum];
      var pagetop=window.scrollY+sbook_top_margin_px;
      if ((info.oversize)&&(info.top<pagetop))
	window.scrollBy(0,-sbook_pagesize);
      else if (sbook_pagenum<1) {}
      else {sbook_pagenum--; sbookGoToPage(sbook_pagenum);}}}
  else window.scrollBy(0,-sbook_pagesize);
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
    $("SBOOKNOPAGEVIEW").checked=false;
    fdjtSetCookie("sbookpageview","yes",false,"/");
    fdjtDropClass(document.body,"sbookscroll");
    sbookGoToPage(sbookGetPage(sbook_focus||sbook_root));}
  else {
    sbook_pageview=false;
    sbook_nextpage=false; sbook_pagebreak=false;
    $("SBOOKNOPAGEVIEW").checked=true;
    fdjtAddClass(document.body,"sbookscroll");
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
  var topleading=fdjtDiv("leading top"," ");
  var bottomleading=fdjtDiv("leading bottom"," ");
  topleading.sbookui=true; bottomleading.sbookui=true;
  fdjtPrepend(document.body,pagehead,pagefoot);
  fdjtPrepend(document.body,topleading);  
  fdjtAppend(document.body,bottomleading);
  if (window.getComputedStyle) {
    var bodystyle=window.getComputedStyle(document.body);
    var bgcolor=((bodystyle)&&(bodystyle.backgroundColor));
    if (bgcolor) {
      pagehead.style.backgroundColor=bgcolor;
      pagefoot.style.backgroundColor=bgcolor;}}
  pagehead.style.display='block'; pagefoot.style.display='block';
  sbook_top_margin_px=pagehead.offsetHeight;
  sbook_bottom_margin_px=pagefoot.offsetHeight;
  pagehead.style.display=null; pagefoot.style.display=null;
  pagehead.sbookui=true; pagehead.sbookui=true;
  sbookUpdatePagination();
}

function sbookUpdatePagination()
{
  var pagesize=window.innerHeight-
    (sbook_top_margin_px+sbook_bottom_margin_px);
  var pages=[]; var pageinfo=[];
  var focus=sbook_focus;
  fdjtLog("[%f] Updating pagination for pagesize=%o",fdjtET(),pagesize);
  _sbook_paginate(pagesize,pages,pageinfo);
  sbook_pages=pages;
  sbook_pageinfo=pageinfo;
  sbook_pagesize=pagesize;
  fdjtLog("[%f] Paginated %d pages with pagesize=%o",
	  fdjtET(),pages.length,pagesize);
  if (focus)
    sbookGoToPage(sbookGetPage(focus));
  else sbookGoToPage(sbookGetPage(window.scrollY));
}

/* Dead code */

/*
  var deltapage=(window.innerHeight)-(sbook_top_margin_px+sbook_top_margin_px+10);
  var top=window.scrollY+sbook_top_margin_px+20;
  var bottom=window.scrollY+window.innerHeight-sbook_bottom_margin_px;
  var focus=sbookGetXYFocus(window.scrollX+100,window.scrollY+sbook_top_margin_px+5);
  var head=sbookNextHead(sbookGetHead(focus));
  while ((head)&&(head.Yoff<bottom))
    if (head.Yoff>top) {
      var deltahead=((head)?(((head.Yoff)-(window.scrollY+sbook_top_margin_px))):(0));
      window.scrollBy(0,deltahead);
      return;}
    else head=sbookNextHead(head);
  window.scrollBy(0,(window.innerHeight)-(sbook_top_margin_px+sbook_top_margin_px));
  return;

 */

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
