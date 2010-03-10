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

var sbook_eye_icon="EyeIcon25.png";
var sbook_small_eye_icon="EyeIcon13x10.png";
var sbook_details_icon="detailsicon16x16.png";
var sbook_outlink_icon="outlink16x16.png";
var sbook_small_remark_icon="remarkballoon16x13.png";
var sbook_delete_icon="redx16x16.png";

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
    else {
      var xelt=document.getElementById(xid);
      var xloc=((xelt)&&(xelt.sbookloc));
      var yelt=document.getElementById(yid);
      var yloc=((yelt)&&(yelt.sbookloc));
      if ((xloc)&&(yloc))
	if (xloc<yloc) return -1; else return 1;
      else if (xloc) return -1;
      else return -1;}
  else if (xid) return -1;
  else if (yid) return 1;
  else return 0;
}

function sbookSourceIcon(info)
{
  var pic=_sbookSourceImage(info);
  if (pic) return fdjtImage(pic,"feedpic",info.name);
  else return false;
}

function _sbookSourceImage(info)
{
  if (info.pic) return info.pic;
  var kind=info.kind;
  if (kind===':PERSON')
    return sbicon("sbooksperson40x40.png");
  else if (kind===':CIRCLE')
    return sbicon("sbookscircle40x40.png");
  else if (kind===':OVERDOC')
    return sbicon("sbooksoverdoc40x40.png");
  else return false;
}

function sbookSummaryHead(target,head,eltspec,extra)
{
  var title=sbookGetTitle(target);
  var head=sbookGetHead(target);
  var preview=sbookPreviewIcon();
  var basespan=fdjtSpan(false);
  if (target!==head)
    if (title) 
      fdjtAppend
	(basespan,fdjtSpan("paratext",fdjtSpan("spacer","\u00B6"),title));
    else {
      var text=fdjtTextify(target);
      if ((text)&&(text.length>0)) {
	title=text.replace(/\n\n+/g,"\n");
	var extract=((title.length<40)?(title):((title.slice(0,40))+"\u22ef "));
	var paratext=fdjtSpan("paratext",fdjtSpan("spacer","\u00B6"),extract);
	fdjtAppend(basespan,paratext," ");}}
  var info;
  if (info=sbook_getinfo(head)) {
    if (info.title)
      fdjtAppend(basespan,fdjtSpan("headtext",fdjtSpan("spacer","\u00A7"),
				   info.title));
    var heads=((info) ? (info.sbook_heads) : []);
    var curspan=basespan;
    j=heads.length-1; while (j>=0) {
      var hinfo=heads[j--]; var elt=$(hinfo.id);
      if ((elt===sbook_root)||(elt===document.body)) continue;
      var newspan=fdjtSpan("head",
			   fdjtSpan("headtext",fdjtSpan("spacer","\u00A7"),
				    hinfo.title));
      fdjtAppend(curspan," \u22ef ",newspan);
      curspan=newspan;}}
  var tocblock=((eltspec)?(fdjtNewElt(eltspec,preview,basespan)):
		(fdjtDiv("tochead",preview,basespan)));
  tocblock.title=title;
  tocblock.sbook_ref=target.id;
  return tocblock;
}

function sbookShowSummaries(summaries,summary_div,query)
{
  var todisplay=[].concat(summaries).sort(_sbook_sort_summaries);
  var curtarget=false; var curblock=false;
  var i=0; var len=todisplay.length; while (i<len) {
    var summary=todisplay[i++];
    var target_id=((summary.id)||(summary.fragid)||false);
    var target=((target_id)&&($(target_id)));
    if (!target) continue;
    if (target!==curtarget) {
      var head=sbookGetHead(target);
      var blockhead=sbookSummaryHead(target,head);
      var block=fdjtDiv("tocblock",blockhead);
      block.blockloc=target.sbookloc;
      block.sbook_ref=block.blockid=target.id;
      fdjtAppend(summary_div,block);
      curblock=block; curtarget=target;}
    fdjtAppend(curblock,sbookSummaryDiv(summary,query));}
  return summary_div;
}

function sbookAddSummary(summary,summary_div,query)
{
  var curtarget=false; var curblock=false;
  var target_id=((summary.id)||(summary.fragid)||false);
  var target=((target_id)&&($(target_id)));
  if (!target) return;
  var targetloc=target.sbookloc;
  var head=sbookGetHead(target);
  var children=summary_div.childNodes; var placed=false;
  var sum_div=sbookSummaryDiv(summary,query);
  var i=0; while (i<children.length) {
    var child=children[i++];
    if (child.nodeType!==1) continue;
    if (!(child.blockloc)) continue;
    var block_target=child.blocktarget;
    if (child.blockid===target_id) {
      fdjtAppend(child,sum_div);
      placed=true;
      break;}
    else if (child.blockloc>targetloc) {
      var blockhead=sbookSummaryHead(target,head);
      var block=fdjtDiv("tocblock",blockhead,sum_div);
      block.blockloc=target.sbookloc;
      block.sbook_ref=block.blockid=target.id;
      fdjtInsertBefore(child,block);
      placed=true;
      break;}}
  if (!(placed)) {
    var blockhead=sbookSummaryHead(target,head);
    var block=fdjtDiv("tocblock",blockhead,sum_div);
    block.blockloc=target.sbookloc;
    block.sbook_ref=block.blockid=target.id;
    fdjtAppend(summary_div,block);}
  return;
}

/* Showing a single summary */


// Gets a DOM element from a search summary (section or gloss)
// QUERY is the query which generated this summary (could be false)
// NOTOC indicates whether to include location information in the
//  displayed information.  This is true if the context somehow
//  provides that information
function sbookItemInfo(item)
{
  if (typeof item === 'string')
    if (item[0]===':') return sbookOIDRef(item);
    else sbook_info[item];
  else if (item.oid) return item;
  else if (item._fdjtid)
    return sbook_info[item._fdjtid]||false;
  else return false;
}

function sbookSummaryDiv(item,query)
{
  var info=sbookItemInfo(item);
  var key=info._fdjtid; var target_id=(info.id); var oid=info.oid;
  var refiners=((query) && (query._refiners));
  var target=$(target_id);
  var sumdiv=fdjtDiv(((info.glossid) ? "summary gloss" : "summary"),
		     false);
  if (target_id) sumdiv.sbook_ref=target_id;
  if (oid) sumdiv.sbook_oid=oid;
  var infospan=fdjtSpan("info");
  if ((query) && (query[key])) { /* If you have a score, use it */
    var scorespan=fdjtSpan("score");
    var score=query[key]; var k=0;
    while (k<score) {fdjtAppend(scorespan,"*"); k++;}
    fdjtAppend(infospan,scorespan);}
  fdjtAppend(sumdiv,infospan);
  var tags=info.tags||[];
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
  var head=((target.sbooklevel) ? (target) :
	    ((sbookGetHead(target))||(target)));
  if (head===document.body) head=target;
  if (info.glossid) sbookMarkInfo(sumdiv,info);
  if (info.glossid)
    fdjtAppend(sumdiv,
	       (sbookDetailsButton(info)),(sbookXRefsButton(info)),
	       ((item.msg)&&(fdjtSpan("msg",item.msg))),((item.msg)&&" "),
	       ((item.excerpt)&&(sbookExcerptSpan(item.excerpt))));
  else {
    var contentspan=fdjtSpan("content");
    fdjtAppend(sumdiv,contentspan);}
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
  if (info.detail) 
    fdjtAppend(sumdiv,fdjtDiv("detail",item.detail));
  if ((info.xrefs) && (info.xrefs.length>0))  {
    var xrefsdiv=fdjtDiv("xrefs");
    var xrefs=info.xrefs;
    var i=0; while (i<xrefs.length) {
      var xref=xrefs[i++];
      var anchor=fdjtAnchor(xref,xref);
      anchor.target='_blank';
      anchor.onclick=fdjtCancelBubble;
      fdjtAppend(xrefsdiv,anchor);}
    fdjtAppend(sumdiv,xrefsdiv);}
  return sumdiv;
}

function sbookMarkInfo(sumdiv,info)
{
  var user=info.user;
  var feed=info.feed||false;
  var userinfo=fdjtOIDs[user];
  var feedinfo=fdjtOIDs[feed];
  var img=((info.pic)&&(fdjtImage((info.pic),"glosspic",userinfo.name)))||
    ((userinfo.pic)&&(fdjtImage((userinfo.pic),"userpic",userinfo.name)))||
    (sbookSourceIcon(feedinfo))||(sbookSourceIcon(userinfo));
  var interval=((info.tstamp) ? (fdjtTick()-info.tstamp) : (-1));
  var delete_button=
    ((user===sbook_user)&&
     (fdjtAnchorC("http://"+sbook_server+"/sbook/delete?GLOSS="+info.oid,
		  ".deletebutton",
		  fdjtImage(sbicon(sbook_delete_icon),false,"x"))));
  var agespan=
    ((interval>0)&&
     ((interval>(5*24*3600)) 
      ? (fdjtAnchorC("http://"+sbook_server+"/sbook/browse/"+info.glossid,
		     "age",fdjtTickDate(info.tstamp)))
      : (fdjtAnchorC("http://"+sbook_server+"/sbook/browse/"+info.glossid,
		     "age",
		     fdjtSpan("altreltime",fdjtIntervalString(interval)),
		     fdjtSpan("altabstime",fdjtTickDate(info.tstamp)),
		     " ago"))));
  if (agespan) {
    agespan.onclick=fdjtCancelBubble;
    agespan.target="sbookglosses";
    agespan.title="browse this note/gloss";}
  if (delete_button) {
    delete_button.onclick=fdjtCancelBubble;
    delete_button.target="_blank";
    delete_button.title="delete this note/gloss";}
  var relay_button;
  if (user===sbook_user) 
    relay_button=
      fdjtImage(sbicon(sbook_small_remark_icon),"remarkbutton","mark",
		_("click to edit your comment"));
  else relay_button=
	 fdjtImage(sbicon(sbook_small_remark_icon),"remarkbutton","mark",
		   _("click to relay or respond"));
  relay_button.onclick=sbookRelay_onclick;
  fdjtAppend(sumdiv,img,
	     fdjtSpan("glossinfo",agespan," ",relay_button," ",delete_button));
}

function sbookExcerptSpan(excerpt)
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

function sbookDetailsButton(info)
{
  if (info.detail) {
    var img=fdjtImage(sbicon(sbook_details_icon),"detailsbutton","details");
    img.title="(show/hide) "+info.detail.replace(/\n\n+/g,'\n');
    img.onclick=function(evt) {
      var anchor=$P(".summary",$T(evt));
      if (anchor) fdjtToggleClass(anchor,"showdetail");
      $T(evt).blur(); if (anchor) anchor.blur();
      evt.preventDefault(); evt.cancelBubble=true;
      return false;};
    return img;}
  else return false;
}

function sbookXRefsButton(info)
{
  if ((info.xrefs)&&(info.xrefs.length>0))
    if (info.xrefs.length===1) {
      var img=fdjtImage(sbicon(sbook_outlink_icon),"xrefsbutton","xrefs");
      var anchor=fdjtAnchor(info.xrefs[0],img);
      anchor.title='click to follow'; anchor.target='_blank';
      return anchor;}
    else {
      var img=fdjtImage(sbicon(sbook_outlink_icon),"xrefsbutton","xrefs");
      img.onclick=function(evt) {
	var anchor=$P(".summary",$T(evt));
	if (anchor) fdjtToggleClass(anchor,"showxrefs");
	$T(evt).blur(); if (anchor) anchor.blur();
	evt.preventDefault(); evt.cancelBubble=true;
	return false;};
      img.title=_("show/hide web references");
      return img;}
  else return false;
}

function sbookRelay_onclick(evt)
{
  var target=evt.target;
  while (target)
    if (target.sbook_ref) break;
    else target=target.parentNode;
  if (!(target)) return;
  if (target.sbook_oid)
    sbook_mark($(target.sbook_ref),fdjtOIDs[target.sbook_oid]||false);
  else sbook_mark($(target.sbook_ref),false);
  evt.preventDefault(); evt.cancelBubble=true;
}

/* Selecting a subset of glosses to display */

function sbookSelectSources(results_div,sources)
{
  if (!(sources)) {
    fdjtDropClass(results_div,"sourced");
    fdjtDropClass($$(".sourced",results_div),"sourced");
    return;}
  fdjtAddClass(results_div,"sourced");
  var blocks=$$(".tocblock",results_div);
  var i=0; while (i<blocks.length) {
    var block=blocks[i++];  var empty=true;
    var summaries=$$(".summary",block);
    var j=0; while (j<summaries.length) {
      var summary=summaries[j++];
      var gloss=(summary.sbook_oid)&&fdjtOIDs[summary.sbook_oid];
      if ((fdjtContains(sources,gloss.user))||
	  (fdjtContains(sources,gloss.feed))) {
	fdjtAddClass(summary,"sourced");
	empty=false;}
      else fdjtDropClass(summary,"sourced");}
    if (empty) fdjtDropClass(block,"sourced");
    else fdjtAddClass(block,"sourced");}
  if (sbook_focus) sbookScrollGlosses(results_div,sbook_focus);
}

/* Selecting a subset of glosses to display */

function sbookSelectTargets(results_div,ids)
{
  if (!(ids)) {
    fdjtDropClass(results_div,"targeted");
    fdjtDropClass($$(".targeted",results_div),"targeted");
    return;}
  if (typeof ids === 'string') ids=new Array(ids);
  fdjtAddClass(results_div,"targeted");
  var blocks=$$(".tocblock",results_div);
  var i=0; while (i<blocks.length) {
    var block=blocks[i++];  var empty=true;
    var summaries=$$(".summary",block);
    var j=0; while (j<summaries.length) {
      var summary=summaries[j++];
      var gloss=(summary.sbook_oid)&&fdjtOIDs[summary.sbook_oid];
      if (fdjtContains(ids,gloss.id)) {
	fdjtAddClass(summary,"targeted");
	empty=false;}
      else fdjtDropClass(summary,"targeted");}
    if (empty) fdjtDropClass(block,"targeted");
    else fdjtAddClass(block,"targeted");}
  if (sbook_focus) sbookScrollGlosses(results_div,sbook_focus);
}

/* Results handlers */

function sbookSetupSummaryDiv(div)
{
  div.onclick=sbookSummary_onclick;
}

function sbookSummary_onclick(evt)
{
  evt=evt||event;
  if (!(evt)) return;
  var target=$T(evt);
  if (fdjtIsClickactive(target)) return;
  var ref=sbookGetRef(target);
  if (ref) {
    fdjtCancelEvent(evt);
    sbookGoTo(ref);}
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
