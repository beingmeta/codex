/* -*- Mode: Javascript; -*- */

/* Copyright (C) 2009 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
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

var sbookTOC=
  (function(){
    function sbookTOC(headinfo,depth,tocspec,prefix){
      var progressbar=fdjtDOM("HR.progressbar");
      var head=fdjtDOM("A.sectname",headinfo.title);
      var spec=tocspec||"DIV.sbooktoc";
      var toc=fdjtDOM(spec,fdjtDOM("DIV.head",progressbar,head),
		      generate_spanbar(headinfo),
		      generate_subsections(headinfo));
      var sub=headinfo.sub;
      if (!(depth)) depth=0;
      head.name="SBR"+headinfo.frag;
      head.about="#"+headinfo.frag;
      toc.sbook_start=headinfo.starts_at;
      toc.sbook_end=headinfo.ends_at;
      fdjtDOM.addClass(toc,"toc"+depth);
      toc.id=(prefix||"SBOOKTOC4")+headinfo.frag;
      if ((!(sub)) || (!(sub.length))) {
	fdjtDOM.addClass(toc,"sbooktocleaf");
	return toc;}
      var i=0; var n=sub.length;
      while (i<n) {
	toc.appendChild(sbookTOC(sub[i++],depth+1,spec,prefix));}
      return toc;}
    
    function generate_subsections(headinfo) {
      var sub=headinfo.sub;
      if ((!(sub)) || (!(sub.length))) return false;
      var div=fdjtDOM("div.sub");
      var i=0; var n=sub.length;
      div.title='hold to glimpse, click to go';
      while (i<n) {
	var subinfo=sub[i];
	var subspan=fdjtDOM("A.sectname",subinfo.title);
	subspan.about="#"+subinfo.frag;
	subspan.name="SBR"+subinfo.frag;
	fdjtDOM(div,((i>0)&&" \u00b7 "),subspan);
	i++;}
      return div;}
    
    function generate_spanbar(headinfo){
      var spanbar=fdjtDOM("div.spanbar.sbookslice");
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
      fdjtDOM(spanbar,spans);
      fdjtDOM(spans,range,progress);
      progress.style.left="0%";
      if (range) range.style.left="0%";
      var i=0; while (i<subsections.length) {
	var spaninfo=subsections[i++];
	var subsection=document.getElementById(spaninfo.frag);
	var spanstart; var spanend; var addname=true;
	if ((sectnum===0) && ((spaninfo.starts_at-start)>0)) {
	  /* Add 'fake section' for the precursor of the first actual section */
	  spanstart=start;  spanend=spaninfo.starts_at;
	  spaninfo=headinfo; subsection=document.getElementById(headinfo.frag);
	  i--; sectnum++; addname=false;}
	else {
	  spanstart=spaninfo.starts_at; spanend=spaninfo.ends_at;
	  sectnum++;}
	var span=generate_span
	  (sectnum,subsection,spaninfo.title,spanstart,spanend,len,
	   ((addname)&&("SBR"+spaninfo.frag)));
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
      span.about="#"+subsection.id;
      if (name) anchor.name=name;
      return span;}
    sbookTOC.id="$Id$";
    sbookTOC.version=parseInt("$Revision$".slice(10,-1));

    function updateTOC(prefix,head,cur){
      if (!(prefix)) prefix="SBOOKTOC4";
      if (cur) {
	// Hide the current head and its (TOC) parents
	var tohide=[];
	var base_elt=document.getElementById(prefix+cur.frag);
	while (cur) {
	  var tocelt=document.getElementById(prefix+cur.frag);
	  tohide.push(tocelt);
	  // Get TOC parent
	  cur=cur.head;}
	var n=tohide.length-1;
	// Go backwards (up) to potentially accomodate some redisplayers
	while (n>=0) {fdjtDOM.dropClass(tohide[n--],"live");}
	fdjtDOM.dropClass(base_elt,"cur");}
      if (!(head)) return;
      var base_elt=document.getElementById(prefix+head.frag);
      var toshow=[];
      while (head) {
	var tocelt=document.getElementById(prefix+head.frag);
	toshow.push(tocelt);
	head=head.head;}
      var n=toshow.length-1;
      // Go backwards to accomodate some redisplayers
      while (n>=0) {fdjtDOM.addClass(toshow[n--],"live");}
      fdjtDOM.addClass(base_elt,"cur");};
    sbookTOC.update=updateTOC;

    // In mouse-based interfaces, TOC spanbars provide preview on mouseover
    //  and jump on click
    var mouseout_timer=false;
    function toc_mouseover(evt){
      var target=fdjtUI.T(evt);
      var ref=sbook.getRef(target);
      if (fdjtDOM.hasParent(target,".sbookhudspan")) {
	if (mouseout_timer) {
	  clearTimeout(mouseout_timer);
	  mouseout_timer=false;}
	if (!(ref)) return;
	else if (sbook.preview===ref) return;
	else sbook.Preview(ref,false);}
      else if (sbook.preview) sbook.Preview(false);}
    function toc_mouseout(evt){
      var target=fdjtUI.T(evt);
      var ref=sbook.getRef(target);
      if (fdjtDOM.hasParent(target,".sbookhudspan")) {
	if (!(ref)) return;
	if (!(mouseout_timer)) 
	  mouseout_timer=setTimeout(function(){
	      sbook.Preview(false); mouseout_timer=false;},
	    300);}}
    function toc_click(evt){
      var target=fdjtUI.T(evt);
      if (fdjtDOM.hasParent(target,".sbookhudspan")) {
	var ref=sbook.getRef(target);
	if (!(ref)) return;
	var info=sbook.docinfo[ref.id];
	if ((info.sub)&&(info.sub.length>3))
	  sbook.GoTo(ref);
	else sbook.JumpTo(ref);};}
    function toc_ignore(evt){
      var target=fdjtUI.T(evt);
      if (fdjtDOM.hasParent(target,".sbookhudspan"))
	fdjtUI.cancel(evt);}
    sbook.UI.handlers.mouse.toc=
      {mouseover: toc_mouseover,
       mouseout: toc_mouseout,click: toc_click,
       mousedown: toc_ignore,mouseup: toc_ignore};
    return sbookTOC;})();


/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
