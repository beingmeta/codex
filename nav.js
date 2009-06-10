/* -*- Mode: Javascript; -*- */

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
  fdjtAppend(spanbar,spans);
  fdjtAppend(spans,progress);
  progress.style.left="0%";
  var i=0; while (i<subsections.length) {
    var subsection=subsections[i++];
    var spaninfo=subsection.sbookinfo;
    var spanstart; var spanend; var spanlen;
    if ((sectnum===0) && ((spaninfo.starts_at-start)>20)) {
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
    if (subsection===child) {
      span.style.color='orange';
      span.style.backgroundColor='orange';
      span.style.borderColor='orange';}
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
    if (odd) span.setAttribute("odd",i-1);
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
  subsections_div.onmouseover=fdjtCoHi_onmouseover;
  subsections_div.onmouseout=fdjtCoHi_onmouseover;
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
    new_elt.className='sbookhudsect';
    content_elt=new_elt;}
  else {
    var spanbar=_sbook_generate_spanbar(parent,pinfo,head);
    content_elt=fdjtAnchor("#"+headinfo.id);
    new_elt=fdjtDiv('sbookhudsect');
    if (spanbar) fdjtAppend(new_elt,spanbar);
    fdjtAppend(new_elt,content_elt);}
  new_elt.id=sectid;
  new_elt.headelt=head;
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
  var new_toc=fdjtDiv("sbooktoc");
  new_toc.onclick=sbookTOC_onclick;
  new_toc.onmouseover=sbookTOC_onmouseover;
  new_toc.onmouseout=sbookTOC_onmouseout;
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
  return new_toc;
}
