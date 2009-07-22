/* -*- Mode: Javascript; -*- */

var sbooks_nav_id="$Id$";
var sbooks_nav_version=parseInt("$Revision$".slice(10,-1));

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

/* Updating the HUD */

function _sbook_generate_spanbar(head,headinfo,child)
{
  if (!(headinfo)) headinfo=head.sbookinfo;
  if (!(child)) child=false;
  var spanbar=fdjtDiv("spanbar");
  var spans=fdjtDiv("spans");
  var start=headinfo.starts_at;
  var end=headinfo.ends_at;
  var len=end-start;
  var subsections=headinfo.sub; var last_info;
  var sectnum=0; var percent=0;
  spanbar.starts=start; spanbar.ends=end;
  if ((!(subsections)) || (subsections.length===0))
    return false;
  var progress=fdjtDiv("progressbox","\u00A0");
  var range=false; // fdjtDiv("rangebox","\u00A0");
  fdjtAppend(spanbar,spans);
  fdjtAppend(spans,range,progress);
  progress.style.left="0%";
  if (range) range.style.left="0%";
  var i=0; while (i<subsections.length) {
    var subsection=subsections[i++];
    var spaninfo=subsection.sbookinfo;
    var spanstart; var spanend; var spanlen;
    if ((sectnum===0) && ((spaninfo.starts_at-start)>0)) {
      spanstart=start;  spanend=spaninfo.starts_at;
      spaninfo=headinfo; subsection=head;
      i--; sectnum++;}
    else {
      spanstart=spaninfo.starts_at; spanend=spaninfo.ends_at;
      sectnum++;}
    var span=_sbook_generate_span
      (sectnum,subsection,spaninfo.title,spanstart,spanend,len);
    /*
    span.setAttribute("startpercent",percent);
    percent=percent+(Math.round(10000*((spanend-spanstart)/len))/100);
    span.setAttribute("endpercent",percent);
    */
    if (subsection===child) fdjtAddClass(span,"current");
    fdjtAppend(spans,span);
    last_info=spaninfo;}
  if ((end-last_info.ends_at)>20) {
    var span=_sbook_generate_span
      (sectnum,head,headinfo.title,last_info.ends_at,end,len);
    fdjtAppend(spanbar,span);}    
  return spanbar;
}

function _sbook_generate_span(sectnum,subsection,title,spanstart,spanend,len)
{
  var spanlen=spanend-spanstart;
  var span=fdjtDiv("sbookhudspan","\u00A0");
  var width=(Math.floor(10000*(spanlen/len))/100)+"%";
  var odd=((sectnum%2)==1);
  if (odd) span.setAttribute("odd",sectnum);
  else span.setAttribute("even",sectnum);
  span.style.width=width;
  span.title=title+" ("+spanstart+"+"+(spanend-spanstart)+")";
  span.headelt=subsection;
  return span;
}

function _sbook_generate_subsections_div(subsections,start,end)
{
  if ((!(subsections)) || (subsections.length<1))
    return false;
  var subsections_div=fdjtDiv("subsections");
  var spanbar=fdjtDiv("spanbar");
  var spans=fdjtDiv("spans");
  var sectlist=fdjtDiv("sectlist");
  var len=end-start;
  var char_count=0; var size_base=70; var at_first=true;
  spanbar.starts=start; spanbar.ends=end;
  var progress=fdjtDiv("progressbox","\u00A0");
  fdjtAppend(spanbar,spans);
  fdjtAppend(spans,progress);
  var i=0; while (i<subsections.length) {
    var subsect=subsections[i++];
    var subsect_info=subsect.sbookinfo;
    char_count=char_count+2+subsect_info.title.length;}
  var i=0; while (i<subsections.length) {
    var odd=((i%2)==1);
    var subsection=subsections[i++];
    var info=subsection.sbookinfo;
    var spanlen=info.ends_at-info.starts_at;
    var span=fdjtDiv("sbookhudspan","\u00A0");
    var namespan=_sbook_add_head(sectlist,subsection,info,true);
    var width=100*(spanlen/len)+"%";
    namespan.fdjt_cohi=span;
    span.fdjt_cohi=namespan;
    if (odd) {
      span.setAttribute("odd",i-1);
      namespan.setAttribute("odd",i-1);}
    else {
      span.setAttribute("even",i-1);
      namespan.setAttribute("even",i-1);}
    span.style.width=width;
    span.title=info.title+
      " ("+info.starts_at+"+"+(info.ends_at-info.starts_at)+")";
    span.headelt=subsection;
    if (at_first) at_first=false;
    else fdjtInsertBefore(namespan," \u00B7 ");
    // span.onclick=sbook_spanelt_onclick;
    fdjtAppend(spans,span);}
  if (subsections.length>1)
    fdjtAppend(subsections_div,spanbar,"\n",sectlist);
  else fdjtAppend(subsections_div,sectlist);
  // subsections_div.onmouseover=fdjtCoHi_onmouseover;
  // subsections_div.onmouseout=fdjtCoHi_onmouseout;
  return subsections_div;
}

function _sbook_add_head(toc,head,headinfo,spanp)
{
  var level=headinfo.level;
  var sectid="SBOOKHEAD"+level;
  var secthead=document.getElementById(sectid);
  var content=headinfo.content;
  var parent=headinfo.sbook_head;
  var pinfo=sbook_getinfo(parent);
  var new_elt, content_elt;
  if (spanp) {
    new_elt=fdjtAnchor("#"+headinfo.id);
    new_elt.headelt=head;
    new_elt.className='sbookhudsect';
    content_elt=new_elt;}
  else {
    var spanbar=((parent) && (_sbook_generate_spanbar(parent,pinfo,head)));
    content_elt=fdjtSpan("sectname");
    var anchor=fdjtAnchor("#"+headinfo.id,content_elt);
    content_elt.headelt=head;
    new_elt=fdjtDiv('sbookhudsect');
    fdjtAppend(new_elt,spanbar,anchor);}
  new_elt.id=sectid;
  if (head===document.body) {
    if (document.title)
      fdjtAppend(content_elt,document.title);
    else return null;}
  else if (!(content)) {
    // fdjtLog("No content for %o info=%o",head,headinfo);
    return null;}
  else {
    var i=0; while (i<content.length) {
      var node=content[i++].cloneNode(true);
      if (node) content_elt.appendChild(node);}}
  fdjtAppend(toc,new_elt);
  // fdjtLog("Added elts %o/%o w/span=%o",new_elt,content_elt,spanp);
  return new_elt;
}

function createSBOOKHUDnav(head,info)
{
  var id=fdjtForceId(head);
  if (sbook_debug)
    fdjtLog('Generating TOC from from %o/%s (%o)',head,id,info);
  var new_toc=fdjtDiv("sbooktoc hud");
  new_toc.onclick=sbookTOC_onclick;
  new_toc.onmouseover=sbookTOC_onmouseover;
  new_toc.onmouseout=sbookTOC_onmouseout;
  // new_toc.onmousemove=sbookTOC_onmousemove;
  if (sbook_debug_hud)
    fdjtLog("Adding supersections %o",info.sbook_heads);
  var supersections_div=fdjtDiv("supersections");
  var supersections=info.sbook_heads;
  var i=0; while (i<supersections.length) {
    var supersection=supersections[i++];
    var relchild=((i<supersections.length) ? (supersections[i]) : (head));
    var head_elt=
      _sbook_add_head(supersections_div,
		      supersection,
		      supersection.sbookinfo,
		      false);
    if (head_elt) head_elt.className="supersection";}
  fdjtAppend(new_toc,supersections_div);
  if (sbook_debug_hud)
    fdjtLog("Adding main elt %o %o",head,info);
  var sect_elt=_sbook_add_head(new_toc,head,info,false);
  if (sect_elt) {
    sect_elt.className='sbookhudsect';
    if ((info.title) && (info.title.length>60))
      sect_elt.style.fontSize="75%";}
  if (sbook_debug_hud)
    fdjtLog("Adding subsections %o",info.sub);
  if ((info.sub) && (info.sub.length>0))
    if ((sbook_list_subsections) || (!(sbook_use_spanbars))) {
      var subsections_div=
	_sbook_generate_subsections_div(info.sub,info.starts_at,info.ends_at);
      fdjtAppend(new_toc,subsections_div);}
  new_toc.onfocus=function(evt) {
    if (sbookHUDechoes)
      sbookSetEchoes(sbookGetEchoesUnder(sbook_head.id));}
  return new_toc;
}

function createSBOOKHUDnav_new(head,info)
{
  var id=fdjtForceId(head);
  if (sbook_debug)
    fdjtLog('Generating TOC from from %o/%s (%o)',head,id,info);
  var head2=
    ((head.sbookinfo) &&
     (((head.sbookinfo.sub) && (head.sbookinfo.sub.length>0))
      ? (head)
      : ((head.sbookinfo.sbook_head)||(false))));
  var head2info=((head2)&&(head2.sbookinfo));
  var tocbar=_sbook_generate_spanbar(document.body,document.body.sbookinfo);
  var locbar=((head2) && (_sbook_generate_spanbar(head2,head2info)));
  var new_toc=fdjtDiv("sbooktoc hud",tocbar,locbar);
  new_toc.onclick=sbookTOC_onclick;
  new_toc.onmouseover=sbookTOC_onmouseover;
  new_toc.onmouseout=sbookTOC_onmouseout;
  new_toc.onfocus=function(evt) {
    if (sbookHUDechoes)
      sbookSetEchoes(sbookGetEchoesUnder(sbook_head.id));}
  /*
  if (head2) {
    var starts=head2info.starts_at; var ends=head2info.ends_at;
    var docsize=
      document.body.sbookinfo.ends_at-document.body.sbookinfo.starts_at;
    var ratio=(starts/docsize);
    var size=(ends-starts)/docsize;
    var range1=$$(".rangebox",tocbar)[0];
    range1.style.left=((Math.round(ratio*10000))/100)+"%";
    range1.style.width=((Math.round(size*10000))/100)+"%";}
  */
  return new_toc;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

