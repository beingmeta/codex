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

var sbook_pagebreak=false;
var sbook_nextpage=false;

var sbook_trace_pagination=false;
var sbook_trace_framepage=false;


function sbookForward(simple)
{
  if (sbook_nextpage)
    window.scrollTo(0,sbook_nextpage-sbook_top_margin_px);
  else window.scrollBy(0,(window.innerHeight)-(sbook_top_margin_px+sbook_bottom_margin_px+10));
  if (sbook_pageview) sbookFramePage();
}

function sbookBackward()
{
  window.scrollBy(0,-(window.innerHeight-(sbook_top_margin_px+sbook_bottom_margin_px+10)));
  if (sbook_pageview) sbookFramePage();
}

/* Setting the page break at the bottom. */
/* This is done by moving up the bottom margin to cover break
   element.  */

function sbookSetPageBreak(elt)
{
  if (!(elt)) return sbookClearPageBreak(elt);
  var top=window.scrollY+sbook_top_margin_px;
  var hardbottom=window.scrollY+window.innerHeight;
  var bottom=hardbottom-sbook_bottom_margin_px;
  var height=window.innerHeight-(sbook_top_margin_px+sbook_bottom_margin_px);
  var offsets=fdjtGetOffset(elt);
  var breaktop=offsets.top;
  if (((breaktop)>(top))&& ((breaktop)<(hardbottom))) {
    if (sbook_trace_pagination) {
      fdjtLog("[%f] BREAK [%d,%d/%d] height=%o break[%d,%d]='%s'\n%o",
	      fdjtET(),top,bottom,hardbottom,height,
	      breaktop,breaktop+offsets.height,elt.id,elt);}
    sbook_pagebreak=elt; sbook_nextpage=offsets.top;
    $("SBOOKBOTTOMMARGIN").style.height=
      (window.innerHeight-(sbook_nextpage-window.scrollY))+"px";}
  else {
    if (sbook_trace_pagination) 
      fdjtLog("[%f] SKIPBREAK top=%o bottom=%o height=%o break@%o=%o",
	      fdjtET(),top,bottom,height,breaktop,elt);
    sbook_pagebreak=false; sbook_nextpage=false;}
}

function sbookClearPageBreak(elt)
{
  if (sbook_trace_pagination) fdjtLog("[%f] NOBREAK",fdjtET());
  sbook_pagebreak=false; sbook_nextpage=false;
  $("SBOOKBOTTOMMARGIN").style.height=null;
}

/* Pagination algorithm */

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

/* Core pagination algorithm */

function sbookFramePage(elt)
{
  var top=window.scrollY+sbook_top_margin_px;
  var hardbottom=window.scrollY+window.innerHeight;
  var bottom=hardbottom-sbook_bottom_margin_px;
  var midpage=top+(bottom-top)/2;
  var height=window.innerHeight-(sbook_top_margin_px+sbook_bottom_margin_px);
  var next=elt||
    sbookGetXYFocus(window.scrollX+100,window.scrollY+sbook_top_margin_px+5);
  /* Get inside the window */
  while (next) {
    var offset=fdjtGetOffset(next); 
    if (offset.top>top) break;
    else next=fdjtForwardNode(next);}
  var foot=next; var prev=false;
  var footoff=false; var prevoff=false; var nextoff=false;
  /* Now keep going until you get out of the window, tracking
     the last/overlapping item, the previous and the next. */
  while (next) {
    nextoff=fdjtGetOffset(next);
    if (sbook_trace_framepage) 
      fdjtLog("sbookFramePage %o %o %o",next.id,nextoff,next);
    if (nextoff.top>bottom) break;
    else if (((nextoff.top-top)>20)&&
	     ((sbookIsPageHead(next))||
	      ((foot)&&(sbookIsPageFoot(foot)))||
	      ((next.toclevel)&&
	       ((bottom-nextoff.bottom)<sbook_bottom_margin_px))||
	      ((sbookIsPageBlock(next))&&(nextoff.bottom>bottom)))) {
      // Always break on page heads, tocheads at the bottom, and page blocks
      //  which don't fit.
      if ((nextoff.top-top)<20)  // Too hard
	sbookClearPageBreak(); 
      else sbookSetPageBreak(next);
      return;}
    else {
      prev=foot; prevoff=footoff;
      foot=next; footoff=nextoff;
      next=fdjtForwardNode(next,_sbookIsContentBlock);
      nextoff=false;}}
  if (sbook_trace_pagination) {
    sbookTracePaging("FOOT",foot);
    sbookTracePaging("PREV",prev);
    sbookTracePaging("NEXT",next);}
  if ((footoff.top-top)<20)
    // Too hard to solve
    sbookClearPageBreak();
  else if (footoff.bottom<bottom)
    // The foot is entirely on the page
    if (sbookAvoidPageFoot(foot))
      if ((sbookAvoidPageFoot(prev))||(prevoff.top<midpage))
	sbookClearPageBreak();
      else sbookSetPageBreak(prev);
    else if ((sbookAvoidPageHead(next))&&(footoff.top>midpage))
      sbookSetPageBreak(foot);
    else sbookClearPageBreak();
  else if ((bottom-footoff.top)<sbook_bottom_margin_px)
    // The foot starts a little bit above the bottom
    if (sbookAvoidPageHead(foot))
      if (sbookAvoidPageFoot(prev))
	sbookSetPageBreak(prev);
      else sbookClearPageBreak();
    else if (sbookAvoidPageFoot(prev))
      sbookSetPageBreak(prev);
    else sbookSetPageBreak(foot);
  else sbookClearPageBreak();
}

function _sbookIsContentBlock(node)
{
  if (node.nodeType===1)
    if (sbookInUI(node)) return false;
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
   sbookFramePage();}
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
  fdjtPrepend(document.body,pagehead,pagefoot);
  fdjtPrepend(document.body,fdjtDiv("leading top"," "));  
  fdjtAppend(document.body,fdjtDiv("leading bottom"," "));
  if (window.getComputedStyle) {
    var bodystyle=window.getComputedStyle(document.body);
    var bgcolor=((bodystyle)&&(bodystyle.backgroundColor));
    if (bgcolor) {
      pagehead.style.backgroundColor=bgcolor;
      pagefoot.style.backgroundColor=bgcolor;}}
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
