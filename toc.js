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

/* Building the DIV */

function sbookTOC(headinfo,depth,tocspec,prefix)
{
  var progressbar=fdjtDOM("HR.progressbar");
  var head=fdjtDOM("A.sectname",headinfo.title);
  var spec=tocspec||"DIV.sbooktoc";
  var toc=fdjtDOM(spec,fdjtDOM("DIV.head",progressbar,head),
		  generate_spanbar(headinfo),
		  generate_subsections(headinfo));
  var sub=headinfo.sub;
  if (!(depth)) depth=0;
  head.name="SBR"+headinfo.id;
  head.sbook_ref=headinfo.id;
  toc.sbook_start=headinfo.starts_at;
  toc.sbook_end=headinfo.ends_at;
  fdjtDOM.addClass(toc,"toc"+depth);
  toc.id=(prefix||"SBOOKTOC4")+headinfo.id;
  if ((!(sub)) || (!(sub.length))) {
    fdjtDOM.addClass(toc,"sbooktocleaf");
    return toc;}
  var i=0; var n=sub.length;
  while (i<n) {
    toc.appendChild(sbookTOC(sub[i++],depth+1,spec,prefix));}
  return toc;

  function generate_subsections(headinfo) {
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
    return div;}

  function generate_spanbar(headinfo){
    var spanbar=fdjtDOM("div.spanbar");
    var spans=fdjtDOM("div.spans");
    var start=headinfo.starts_at;
    var end=headinfo.ends_at;
    var len=end-start;
    var subsections=headinfo.sub; var last_info;
    var sectnum=0; var percent=0;
    spanbar.starts=start; spanbar.ends=end;
    if ((!(subsections)) || (subsections.length===0))
      return false;
    var progress=fdjtDOM("div.progressbox","\u00A0");
    var range=false;
    fdjtAppend(spanbar,spans);
    fdjtAppend(spans,range,progress);
    progress.style.left="0%";
    if (range) range.style.left="0%";
    var i=0; while (i<subsections.length) {
      var spaninfo=subsections[i++];
      var subsection=document.getElementById(spaninfo.id);
      var spanstart; var spanend; var addname=true;
      if ((sectnum===0) && ((spaninfo.starts_at-start)>0)) {
	/* Add 'fake section' for the precursor of the first actual section */
	spanstart=start;  spanend=spaninfo.starts_at;
	spaninfo=headinfo; subsection=document.getElementById(headinfo.id);
	i--; sectnum++; addname=false;}
      else {
	spanstart=spaninfo.starts_at; spanend=spaninfo.ends_at;
	sectnum++;}
      var span=generate_span
	(sectnum,subsection,spaninfo.title,spanstart,spanend,len,
	 ((addname)&&("SBR"+subsection.id)));
      spans.appendChild(span);
      last_info=spaninfo;}
    if ((end-last_info.ends_at)>0) {
      /* Add 'fake section' for the content after the last actual section */
      var span=generate_span
	(sectnum,head,headinfo.title,last_info.ends_at,end,len);
      spanbar.appendChild(span);}    
    return spanbar;}
  
  function generate_span(sectnum,subsection,title,spanstart,spanend,len,name){
    var spanlen=spanend-spanstart;
    var anchor=fdjtDOM("A.brick","\u00A0");
    var span=fdjtDOM("DIV.sbookhudspan",anchor);
    var width=(Math.floor(10000*(spanlen/len))/100)+"%";
    span.style.width=width;
    span.title=(title||"section")+" ("+spanstart+"+"+(spanend-spanstart)+")";
    span.sbook_ref=subsection.id;
    if (name) anchor.name=name;
    return span;}
}
sbookTOC.id="$Id$";
sbookTOC.version=parseInt("$Revision$".slice(10,-1));

sbookTOC.update=function(prefix,head,cur){
  if (!(prefix)) prefix="SBOOKTOC4";
  if (cur) {
    // Hide the current head and its (TOC) parents
    var tohide=[];
    var base_elt=document.getElementById(prefix+cur.id);
    while (cur) {
      var tocelt=document.getElementById(prefix+cur.id);
      tohide.push(tocelt);
      // Get TOC parent
      cur=cur.head;}
    var n=tohide.length-1;
    // Go backwards (up) to potentially accomodate some redisplayers
    while (n>=0) {fdjtDOM.dropClass(tohide[n--],"live");}
    fdjtDOM.dropClass(base_elt,"cur");}
  if (!(head)) return;
  var base_elt=document.getElementById(prefix+head.id);
  var toshow=[];
  while (head) {
    var tocelt=document.getElementById(prefix+head.id);
    toshow.push(tocelt);
    head=head.head;}
  var n=toshow.length-1;
  // Go backwards to accomodate some redisplayers
  while (n>=0) {fdjtDOM.addClass(toshow[n--],"live");}
  fdjtDOM.addClass(base_elt,"cur");};

/* TOC handlers */

sbookTOC.onmouseover=function(evt){
  evt=evt||event;
  var target=$T(evt);
  fdjtWidget.cohi.onmouseover(evt);
  if (fdjtDOM.isClickable(target)) return;
  if (!((fdjtDOM.hasParent(target,"spanbar"))||
	(fdjtDOM.hasParent(target,"previewicon")))) {
    if (sbook_preview) sbookSetPreview(false);
    return;}
  var ref=sbookGetRef(target);
  if (sbook_preview) {
    if (ref===sbook_preview) {}
    else if (ref) sbookSetPreview(ref);
    else sbookSetPreview(false);
    fdjtDOM.cancel(evt);}
  else if (ref) {
    sbookSetPreview(ref);
    fdjtDOM.cancel(evt);}
  else {
    sbookSetPreview(false);
    fdjtDOM.cancel(evt);}};

sbookTOC.onmouseout=function(evt){
  evt=evt||event;
  var target=$T(evt);
  fdjtWidget.cohi.onmouseout(evt);
  var ref=sbookGetRef(target);
  if (ref) sbookSetPreview(false);};

sbookTOC.onmousedown=function(evt){
  evt=evt||event;
  sbook_mousedown=fdjtTime();
  var target=$T(evt);
  fdjtCoHi_onmouseout(evt);
  if (!((FDJT$P(".sectname",target))||
	(FDJT$P(".sbooksummaries",target))))
    return;
  var ref=sbookGetRef(target);
  if (ref) sbookSetPreview(ref);};

sbookTOC.onmouseup=function(evt){
  evt=evt||event;
  if ((sbook_preview)||(sbook_preview_target))
    sbookSetPreview(false);
  fdjtDOM.cancel(evt);};

sbookTOC.onclick=function(evt){
  evt=evt||event;
  if ((sbook_mousedown)&&
      ((fdjtTime()-sbook_mousedown)>sbook_hold_threshold)) {
    sbook_mousedown=false;
    fdjtDOM.cancel(evt);
    return false;}
  var target=$T(evt);
  var ref=sbookGetRef(target);
  if (!(ref)) return;
  sbookGoTo(ref);
  var info=sbook_getinfo(ref);
  if ((info.sub)&&(info.sub.length>1)) sbookHUDMode("toc");
  else sbookHUDMode(false);
  fdjtDOM.cancel(evt);};

sbookTOC.oneclick=function(evt){
  evt=evt||event;
  if (sbook_preview) return;
  var target=$T(evt);
  var ref=sbookGetRef(target);
  if (sbook_preview===ref) sbookPreview(false);
  else if (ref) sbookPreview(ref);
  else if (sbook_preview) sbookPreview(false);
  else {}
  fdjtDOM.cancel(evt);};

sbookTOC.onholdclick=function(evt){
  evt=evt||event;
  if ((sbook_mousedown)&&
      ((fdjtTime()-sbook_mousedown)>sbook_hold_threshold)) {
    sbook_mousedown=false;
    fdjtDOM.cancel(evt);
    return false;}
  var target=$T(evt);
  var ref=sbookGetRef(target);
  if (!(ref)) return;
  sbookGoTo(ref);
  sbookPreview(false);
  sbookHUDMode(false);
  fdjtDOM.cancel(evt);
};

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
