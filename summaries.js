/* -*- Mode: Javascript; -*- */

var sbooks_searchui_id="$Id$";
var sbooks_searchui_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
   This file implements the search component of a 
    Javascript/DHTML UI for reading large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knowlets, visit www.knowlets.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.
   This file assumes that the sbooks.js file has already been loaded.

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

var sbook_eye_icon=
  "http://static.beingmeta.com/graphics/EyeIcon25.png";
var sbook_small_eye_icon=
  "http://static.beingmeta.com/graphics/EyeIcon13x10.png";
var sbook_details_icon=
  "http://static.beingmeta.com/graphics/detailsicon16x16.png";
var sbook_outlink_icon=
  "http://static.beingmeta.com/graphics/outlink16x16.png";
var sbook_small_remark_icon=
  "http://static.beingmeta.com/graphics/remarkballoon16x13.png";
var sbook_delete_icon=
  "http://static.beingmeta.com/graphics/redx16x16.png";


function _sbook_sort_summaries(x,y)
{
  var xid=((x.id)||(x.fragid)||false);
  var yid=((y.id)||(y.fragid)||false);
  if ((xid)&&(yid))
    if (xid===yid)
      if ((x.tstamp)&&(y.tstamp))
	return (y.tstamp<x.tstamp)-(x.tstamp<y.tstamp);
      else if (x.tstamp) return -1;
      else if (y.tstamp) return 1;
      else return 0;
    else if (xid<yid) return -1; else return 1;
  else if (xid) return -1;
  else if (yid) return 1;
  else return 0;
}

function sbookSummaryHead(target,head,eltspec,extra)
{
  var head=sbook_toc_head(target);
  var eye=fdjtImage(sbook_eye_icon,"eye","(\u00b7)",
		    _("previewing: move mouse to restore"));
  if (typeof extra === "undefined")
    if (target===head) extra="\u00A7";
    else extra="\u00B6";
  var basespan=fdjtSpan(false,((extra)&&(fdjtSpan("extra",extra))),eye);
  if (head.sbookinfo) {
    var info=head.sbookinfo;
    if (info.title) fdjtAppend(basespan,fdjtSpan("headtext",info.title));
    var heads=((info) ? (info.sbook_heads) : []);
    var curspan=basespan;
    j=heads.length-1; while (j>=0) {
      var h=heads[j--]; var hinfo=h.sbookinfo;
      var newspan=fdjtSpan("head",fdjtSpan("headtext",hinfo.title));
      fdjtAppend(curspan," \\ ",newspan);
      curspan=newspan;}}
  else {
    if (head.title) fdjtAppend(basespan,fdjtSpan("headtext",head.title));
    else if (head.id) fdjtAppend(basespan,fdjtSpan("headtext",head.id));
    else {
      var text=fdjtTextify(summary,true);
      if (text.length>50) fdjtAppend(basespan,text.slice);
      else fdjtAppend(basespan,fdjtSpan("headtext",text));}}
  eye.onmouseover=sbookPreview_onmouseover;
  eye.onmouseout=sbookPreview_onmouseout;
  basespan.onclick=sbookSummary_onclick;
  basespan.sbook_ref=target;
  var tocblock=((eltspec)?(fdjtNewElt(eltspec,basespan)):
		(fdjtDiv("tochead",basespan)));
  tocblock.blocktarget=target;
  return tocblock;
}

function sbookShowSummaries(summaries,summary_div,query)
{
  var todisplay=[].concat(summaries);
  var curtarget=false; var curblock=false;
  todisplay.sort(_sbook_sort_summaries);
  i=0; while (i<todisplay.length) {
    var summary=todisplay[i++];
    var target_id=((summary.id)||(summary.fragid)||false);
    var target=((target_id)&&($(target_id)));
    if (!target) continue;
    if (target!==curtarget) {
      var head=sbook_toc_head(target);
      var blockhead=sbookSummaryHead(target,head);
      var block=fdjtDiv("tocblock",blockhead);
      block.blocktarget=target;
      fdjtAppend(summary_div,block);
      curblock=block; curtarget=target;}
    fdjtAppend(curblock,sbookShowSummary(summary,query,true));}
  return summary_div;
}

function sbookAddSummary(summary,summary_div,query)
{
  var curtarget=false; var curblock=false;
  var target_id=((summary.id)||(summary.fragid)||false);
  var target=((target_id)&&($(target_id)));
  if (!target) return;
  var head=sbook_toc_head(target);
  var children=summary_div.childNodes; var placed=false;
  var sum_div=sbookShowSummary(summary,query,true);
  var i=0; while (i<children.length) {
    var child=children[i++];
    if (child.nodeType!==1) continue;
    var block_target=child.blocktarget;
    if (!(block_target)) continue;
    if (block_target===target) {
      fdjtAppend(child,sum_div);
      placed=true;
      break;}
    else if (block_target.id>target_id) {
      var blockhead=sbookSummaryHead(target,head);
      var block=fdjtDiv("tocblock",blockhead,sum_div);
      fdjtInsertBefore(child,block);
      placed=true;
      break;}}
  if (!(placed)) {
    var blockhead=sbookSummaryHead(target,head);
    var block=fdjtDiv("tocblock",blockhead,sum_div);
    fdjtAppend(summary_div,block);}
  return;
}

/* Showing a single summary */


// Gets a DOM element from a search summary (section or echo)
// QUERY is the query which generated this summary (could be false)
// NOTOC indicates whether to include location information in the
//  displayed information.  This is true if the context somehow
//  provides that information
function sbookShowSummary(summary,query,notoc)
{
  var key=summary.sortkey;
  var refiners=((query) && (query._refiners));
  var target_id=((typeof summary === "string") ? (summary) :
		 (summary.id||summary.fragid));
  var target=$(target_id);
  var sumdiv=fdjtDiv((summary.echo) ? "summary echo" : "summary");
  if (target) sumdiv.sbook_ref=target;
  if (summary.echo) sumdiv.sbookecho=summary;
  var info=fdjtSpan("info");
  if ((query) && (query[target_id])) { /* If you have a score, use it */
    var scorespan=fdjtSpan("score");
    var score=query[key]; var k=0;
    while (k<score) {fdjtAppend(scorespan,"*"); k++;}
    fdjtAppend(info,scorespan);}
  fdjtAppend(sumdiv,info);
  sumdiv.searchsummary=target;
  var tags=summary.tags||[];
  var dist=summary.tribes||[];
  if (refiners)
    tags.sort(function(t1,t2) {
	var s1=refiners[t1]; var s2=refiners[t2];
	if ((s1) && (s2))
	  if (s1>s2) return -1;
	  else if (s1===s2) return 0;
	  else return -1;
	else if (s1) return -1;
	else if (s2) return 1;
	else return 0;});
  var head=(((target.sbookinfo) && (target.sbookinfo.level)) ? (target) :
	    ((target.sbook_head)||(target)));
  if (head===document.body) head=target;
  if (summary.echo) {
    var user=summary.user;
    var userinfo=social_info[user];
    var usrimg=fdjtImage((summary.pic)||(summary.echo.pic)||(userinfo.pic),"userpic",userinfo.name);
    var interval=((summary.tstamp) ? (fdjtTick()-summary.tstamp) : (-1));
    var delete_icon=
      ((user===sbook_user)&&(fdjtImage(sbook_delete_icon,false,"x")));
    var delete_button=
      ((delete_icon)&&
       (fdjtAnchorC("http://echoes.sbooks.net/delete/"+summary.pingid,
		    ".deletebutton",delete_icon)));
    var agespan=
      ((interval>0)&&
       ((interval>(3*24*3600)) 
	? (fdjtAnchorC("http://echoes.sbooks.net/ref/"+summary.pingid,
		       "age",fdjtTickDate(summary.tstamp)))
	: (fdjtAnchorC("http://echoes.sbooks.net/ref/"+summary.pingid,
		       "age",
		       fdjtSpan("altreltime",fdjtIntervalString(interval)),
		       fdjtSpan("altabstime",fdjtTickDate(summary.tstamp)),
		       " ago"))));
    if (agespan) {
      agespan.onclick=function(evt) {
	evt.cancelBubble=true;};
      agespan.target="sbookechoes";
      agespan.title="browse this note/echo";}
    if (delete_button) {
      delete_button.onclick=function(evt) {
	evt.cancelBubble=true;};
      delete_button.target="_blank";
      delete_icon.title="delete this note/echo";
      delete_button.title="delete this note/echo";}
    var relay_button;
    if (user===sbook_user) {
      relay_button=
	fdjtImage(sbook_small_remark_icon,"remarkbutton","ping",
		  _("click to edit your comment"));
      relay_button.onclick=function(evt){
	sbook_ping(target,summary);
	evt.preventDefault(); evt.cancelBubble=true;};}
    else {
      relay_button=
	fdjtImage(sbook_small_remark_icon,"remarkbutton","ping",
		  _("click to relay or respond"));
      relay_button.onclick=function(evt){
	sbook_ping(target,summary);
	evt.preventDefault(); evt.cancelBubble=true;};}
    fdjtAppend
      (sumdiv,usrimg,
       relay_button,delete_button,
       ((summary.detail)&&(_sbookDetailsButton())),((summary.detail)&&" "),
       ((summary.xrefs)&&(_sbookXrefsButton())),
       agespan);}
  if ((head) && (!(notoc)))
    fdjtAppend(sumdiv,sbookSummaryHead(target));
  else {
    var eye=fdjtImage(sbook_small_eye_icon,"eye","(\u00b7)",
		      _("previewing: move mouse to restore"));
    eye.onmouseover=sbookPreview_onmouseover;
    eye.onmouseout=sbookPreview_onmouseout;
    eye.onclick=sbookSummary_onclick;
    eye.sbook_ref=target;
    fdjtAppend(sumdiv,eye);}

  if (summary.echo)
    fdjtAppend(sumdiv,
	       ((summary.msg)&&(fdjtSpan("msg",summary.msg))),((summary.msg)&&" "),
	       ((summary.excerpt)&&(_sbookExcerptSpan(summary.excerpt))),
	       ((summary.excerpt)&&" "));
  var tagspan=sumdiv;
  if ((tags)&&(tags.length>0)) fdjtAppend(sumdiv," // ");
  var j=0; var first=true; while (j<tags.length) {
    var tag=tags[j++];
    if (j===1) 
      fdjtAppend(tagspan,knoSpan(tag));
    else if ((j===7) &&
	     (tagspan===sumdiv) &&
	     (tags.length>10)) {
      var controller=fdjtSpan("controller",
			      "\u00b7\u00b7\u00b7",tags.length-6,
			      "+\u00b7\u00b7\u00b7");
      tagspan=fdjtSpan("moretags");
      tagspan.style.display='none';
      controller.title=("click to toggle more tags");
      controller.onclick=fdjtShowHide_onclick;
      controller.clicktotoggle=new Array(tagspan);
      fdjtAppend(sumdiv," ",controller," ",tagspan);
      fdjtAppend(tagspan,knoSpan(tag));}
    else fdjtAppend(tagspan," \u00b7 ",knoSpan(tag));}
  var distspan=sumdiv;
  if ((dist)&&(dist.length>0)) fdjtAppend(sumdiv," // ");
  var j=0; var first=true; while (j<dist.length) {
    var d=dist[j++];
    if (j===1) 
      fdjtAppend(distspan,sbookTribeSpan(d));
    else if ((j===4) &&
	     (distspan===sumdiv) &&
	     (dist.length>7)) {
      var controller=fdjtSpan("controller",
			      "\u00b7\u00b7\u00b7",tags.length-6,
			      "+\u00b7\u00b7\u00b7");
      distspan=fdjtSpan("moretags");
      distspan.style.display='none';
      controller.title=("click to toggle more targets");
      controller.onclick=fdjtShowHide_onclick;
      controller.clicktotoggle=new Array(distspan);
      fdjtAppend(sumdiv," ",controller," ",distspan);
      fdjtAppend(distspan,sbookTribeSpan(d));}
    else fdjtAppend(distspan," \u00b7 ",sbookTribeSpan(d));}
  if (summary.detail) 
    fdjtAppend(sumdiv,fdjtDiv("detail",summary.detail));
  if ((summary.xrefs) && (summary.xrefs.length>0))  {
    var xrefsdiv=fdjtDiv("xrefs");
    var xrefs=summary.xrefs;
    var i=0; while (i<xrefs.length) {
      var xref=xrefs[i++];
      var anchor=fdjtAnchor(xref,xref);
      anchor.target='_blank';
      anchor.onclick=function(evt) { evt.cancelBubble=true;};
      fdjtAppend(xrefsdiv,anchor);}
    fdjtAppend(sumdiv,xrefsdiv);}
  if (summary.echo) sumdiv.echo=summary.echo;
  return sumdiv;
}

function sbookTribeSpan(dist)
{
  var info=social_info[dist];
  if (info) {
    var span=fdjtSpan("tribe",info.name);
    if (info.gloss) span.title=info.gloss;
    else if (info.summary) span.title=info.summary;
    return span;}
  else return fdjtSpan("tribe",dist);
}

function _sbookExcerptSpan(excerpt)
{
  var content=fdjtSpan("content",excerpt);
  var ellipsis=fdjtSpan("ellipsis","...");
  var container=fdjtSpan("excerpt","\u201c",content,ellipsis,"\u201d");
  container.onclick=function(evt) {
    var parent=$P(".summary",$T(evt));
    if (parent) {
      fdjtToggleClass(parent,"showexcerpt");
      evt.preventDefault(); evt.cancelBubble=true;}};
  return container;
}

function _sbookDetailsButton(excerpt)
{
  var img=fdjtImage(sbook_details_icon,"detailsbutton","details");
  img.onclick=function(evt) {
    var anchor=$P(".summary",$T(evt));
    if (anchor) fdjtToggleClass(anchor,"showdetail");
    $T(evt).blur(); if (anchor) anchor.blur();
    evt.preventDefault(); evt.cancelBubble=true;
    return false;};
  img.title=_("show/hide details");
  return img;
}

function _sbookXrefsButton(excerpt)
{
  var img=fdjtImage(sbook_outlink_icon,"xrefsbutton","xrefs");
  img.onclick=function(evt) {
    var anchor=$P(".summary",$T(evt));
    if (anchor) fdjtToggleClass(anchor,"showxrefs");
    $T(evt).blur(); if (anchor) anchor.blur();
    evt.preventDefault(); evt.cancelBubble=true;
    return false;};
  img.title=_("show/hide web references");
  return img;
}

/* Results handlers */

function sbookSummary_onclick(evt)
{
  var target=$T(evt);
  while (target)
    if (target.sbook_ref) {
      fdjtScrollDiscard();
      var elt=target.sbook_ref;
      var head=elt.sbook_head;
      if (head) sbookScrollTo(elt,head);
      else sbookScrollTo(elt);
      evt.preventDefault(); evt.cancelBubble=true;
      sbookHUDMode(false);
      return false;}
    else if ((target.tagName==='INPUT') ||
	     (target.tagName==='TEXTAREA') ||
	     ((target.tagName==='A') && (target.href)))
      return;
    else target=target.parentNode;
}

function sbookSummary_onmouseover(evt)
{
  var target=$T(evt);
  while (target)
    if (target.sbook_ref) break;
    else target=target.parentNode;
  if (!(target)) return;
  sbookPreviewLocation(target.sbook_ref);
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
