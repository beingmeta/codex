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

/* New NAV hud design
   One big DIV for the whole TOC, use CSS to change what's visible
   General structure:
     div.sbooktoc.toc0
       div.head (contains section name)
       div.spanbar (contains spanbar)
       div.sub (contains all the subsections names)
       div.sbooktoc.toc1 (tree for first section)
       div.sbooktoc.toc1 (tree for second section)
    Controlling display:
       .cur class on current head
       .live class on div.sbooktoc and parents

     
*/

/* Creating the HUD */

function sbookCreateNavHUD(eltspec)
{
  var toc_div=sbookTOCDiv(sbook_getinfo(sbook_root),0);
  var div=fdjtDiv(eltspec||"#SBOOKTOC.hudblock.hud",toc_div);
  div.onmouseover=sbookTOC_onmouseover;
  div.onmouseout=sbookTOC_onmouseout;
  div.onclick=sbookTOC_onclick;
  if (!(eltspec)) sbookNavHUD=div;
  return div;
}

/* Building the DIV */

function sbookTOCDiv(headinfo,depth,classname)
{
  var progressbar=
    fdjtImage('http://static.beingmeta.com/graphics/silverbrick.png',
	      'progressbar');
  var progressbar=fdjtNewElt("HR.progressbar");
  var head=fdjtNewElt("A.sectname",headinfo.title);
  var toc=fdjtDiv(classname||"sbooktoc",
		  fdjtDiv("head",progressbar,head),
		  _sbook_generate_spanbar(headinfo),
		  sbookTOCDivSubsections(headinfo));
  var tocid="SBOOKTOC4"+headinfo.id;
  var sub=headinfo.sub;
  if (!(depth)) depth=0;
  head.name="SBR"+headinfo.id;
  head.sbook_ref=headinfo.id;
  toc.sbook_start=headinfo.starts_at;
  toc.sbook_end=headinfo.ends_at;
  fdjtAddClass(toc,"toc"+depth);
  headinfo.tocid=tocid;
  if (!(toc.id)) {
    headinfo.tocid=tocid;
    toc.id=tocid;}
  else headinfo.tocid=toc.id;
  if ((!(sub)) || (!(sub.length))) return toc;
  var i=0; var n=sub.length;
  while (i<n)
    fdjtAppend(toc,sbookTOCDiv(sub[i++],depth+1));
  return toc;
}

function sbookTOCDivSubsections(headinfo)
{
  var sub=headinfo.sub;
  if ((!(sub)) || (!(sub.length))) return false;
  var div=fdjtDiv("sub");
  var i=0; var n=sub.length;
  while (i<n) {
    var subinfo=sub[i];
    var subspan=fdjtNewElt("A.sectname",subinfo.title);
    subspan.sbook_ref=subinfo.id;
    subspan.name="SBR"+subinfo.id;
    fdjtAppend(div,((i>0)&&" \u00b7 "),subspan);
    i++;}
  return div;
}

/* Updating the HUD */

function _sbook_generate_spanbar(headinfo)
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
  var range=false; // fdjtDiv("rangebox","\u00A0");
  fdjtAppend(spanbar,spans);
  fdjtAppend(spans,range,progress);
  progress.style.left="0%";
  if (range) range.style.left="0%";
  var i=0; while (i<subsections.length) {
    var spaninfo=subsections[i++];
    var subsection=document.getElementById(spaninfo.id);
    var spanstart; var spanend; var spanlen; var addname=true;
    if ((sectnum===0) && ((spaninfo.starts_at-start)>0)) {
      /* Add 'fake section' for the precursor of the first actual section */
      spanstart=start;  spanend=spaninfo.starts_at;
      spaninfo=headinfo; subsection=document.getElementById(headinfo.id);
      i--; sectnum++; addname=false;}
    else {
      spanstart=spaninfo.starts_at; spanend=spaninfo.ends_at;
      sectnum++;}
    var span=_sbook_generate_span
      (sectnum,subsection,spaninfo.title,spanstart,spanend,len,
       ((addname)&&("SBR"+subsection.id)));
    fdjtAppend(spans,span);
    last_info=spaninfo;}
  if ((end-last_info.ends_at)>0) {
    /* Add 'fake section' for the content after the last actual section */
    var span=_sbook_generate_span
      (sectnum,head,headinfo.title,last_info.ends_at,end,len);
    fdjtAppend(spanbar,span);}    
  return spanbar;
}

function _sbook_generate_span(sectnum,subsection,title,spanstart,spanend,len,name)
{
  var spanlen=spanend-spanstart;
  var anchor=fdjtNewElt("A.brick","\u00A0");
  var span=fdjtDiv("sbookhudspan",anchor);
  var width=(Math.floor(10000*(spanlen/len))/100)+"%";
  var odd=((sectnum%2)==1);
  if (odd) span.setAttribute("odd",sectnum);
  else span.setAttribute("even",sectnum);
  span.style.width=width;
  span.title=(title||"section")+" ("+spanstart+"+"+(spanend-spanstart)+")";
  span.sbook_ref=subsection.id;
  if (name) anchor.name=name;
  return span;
}

/* TOC handlers */

function sbookTOC_onmouseover(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbookTOC_onmouseover",evt);
  var target=sbookGetRef($T(evt));
  if (!((sbook_mode)||(fdjtHasClass(document.body,"hudup")))) return;
  sbookHUD_onmouseover(evt);
  fdjtCoHi_onmouseover(evt);
  if (target===null) return;
  fdjtDelayHandler(250,sbookPreviewNoMode,target,document.body,"previewing");
}

function sbookTOC_onmouseout(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbookTOC_onmouseout",evt);
  sbookHUD_onmouseout(evt);
  fdjtCoHi_onmouseout(evt);
  fdjtDelayHandler(250,sbookStopPreview,false,document.body,"previewing");
  var rtarget=evt.relatedTarget;
  if (!(rtarget)) return;
  while (rtarget)
    if (rtarget===sbookHUD) return;
    else if (rtarget===document.body) break;
    else if (rtarget===window) break;
    else if (rtarget===document) break;
    else try {rtarget=rtarget.parentNode;}
      catch (e) {break;}
  sbook_hud_forced=false;
}

function sbookTOC_onclick(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbookTOC_onclick",evt);
  var target=sbookGetRef($T(evt));
  if (target===null) {
    sbookHUDToggle("toc");
    return;}
  sbook_preview=false;
  fdjtScrollDiscard();
  if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
  evt.cancelBubble=true;
  sbookSetHead(target);
  var info=sbook_getinfo(target);
  sbookScrollTo(target);
  if (!((info.sub) && ((info.sub.length)>2)))
    sbookHUDMode(false);
  sbookSetTarget(target);
  return false;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
